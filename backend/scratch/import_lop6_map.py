import asyncio
import os
import sys
import uuid
from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker
from sqlalchemy import select, delete

# Add parent directory to path so app can be imported
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.models.models import KnowledgeComponent, KCPrerequisite, GraphEditHistory

DATABASE_URL = os.environ.get("DATABASE_URL")
if not DATABASE_URL:
    print("Error: DATABASE_URL environment variable is not set.")
    sys.exit(1)

# List of Grade 6 Math Knowledge Components to import
KCS_DATA = [
    {
        "code": "PREREQ.C4.K1.L6",
        "name": "Hình học cơ bản Tiểu học (Assumed)",
        "grade": 6,
        "subject": "math",
        "description": "Kiến thức hình học cơ bản Tiểu học làm điều kiện đầu vào",
        "notes": "Hình học cơ bản Tiểu học"
    },
    {
        "code": "B1.C1.K1.L6",
        "name": "Tập hợp",
        "grade": 6,
        "subject": "math",
        "description": "Nhận biết tập hợp; liệt kê; phần tử thuộc hoặc không thuộc tập hợp; tính chất đặc trưng; tập hợp rỗng ∅",
        "notes": "- Nhận biết tập hợp và liệt kê tập hợp\n- Nhận biết phần tử thuộc (∈) hoặc không thuộc (∉) tập hợp\n- Biểu diễn tập hợp — chỉ ra tính chất đặc trưng\n- Tập hợp rỗng (∅)"
    },
    {
        "code": "B2.C1.K1.L6",
        "name": "Chữ số & Số tự nhiên",
        "grade": 6,
        "subject": "math",
        "description": "Phân biệt chữ số và số; số La Mã <30; giá trị chữ số trong hệ thập phân; đọc và viết; biểu diễn tổng",
        "notes": "- Phân biệt chữ số và số\n- Biểu diễn số tự nhiên nhỏ hơn 30 thành số La Mã\n- Nhận biết giá trị các chữ số của một số tự nhiên viết trong hệ thập phân\n- Đọc và viết chữ số\n- Biểu diễn mỗi số tự nhiên thành tổng giá trị các chữ số của nó"
    },
    {
        "code": "B3.C1.K1.L6",
        "name": "So sánh và Thứ tự",
        "grade": 6,
        "subject": "math",
        "description": "Ký hiệu ≤, ≥; so sánh theo số chữ số hoặc theo từng hàng; số liền trước/sau; sắp xếp dãy số",
        "notes": "- Ký hiệu nhỏ hơn hoặc bằng (≤) và lớn hơn hoặc bằng (≥)\n- So sánh hai số tự nhiên: (a) Theo số chữ số, (b) Theo từng hàng\n- Số liền trước, số liền sau\n- Sắp xếp dãy số"
    },
    {
        "code": "B4.C1.K1.L6",
        "name": "Cộng và Trừ",
        "grade": 6,
        "subject": "math",
        "description": "Cộng/trừ đặt tính; điều kiện phép trừ thực hiện được trong số tự nhiên; giao hoán và kết hợp",
        "notes": "- Cộng, trừ đặt tính (Tiểu học)\n- Nhận biết điều kiện phép trừ thực hiện được trong ℕ\n- Áp dụng tính chất giao hoán và kết hợp để tính hợp lý phép cộng"
    },
    {
        "code": "B5.C1.K1.L6",
        "name": "Nhân",
        "grade": 6,
        "subject": "math",
        "description": "Nhân đặt tính; tính chất giao hoán, kết hợp; tính chất phân phối của phép nhân đối với phép cộng",
        "notes": "- Nhân đặt tính (Tiểu học)\n- Áp dụng tính chất giao hoán, kết hợp để tính hợp lý\n- Phân phối nhân qua cộng: a × (b + c) = a×b + a×c"
    },
    {
        "code": "B6.C1.K1.L6",
        "name": "Lũy thừa",
        "grade": 6,
        "subject": "math",
        "description": "Cơ số, số mũ, đọc/viết lũy thừa; tính giá trị; nhân/chia cùng cơ số; bình phương và lập phương; số chính phương",
        "notes": "- Nhận biết cấu trúc lũy thừa: cơ số, số mũ, đọc/viết ký hiệu aⁿ\n- Tính giá trị lũy thừa\n- Nhân lũy thừa cùng cơ số: aᵐ × aⁿ = aᵐ⁺ⁿ\n- Chia lũy thừa cùng cơ số: aᵐ ÷ aⁿ = aᵐ⁻ⁿ (m ≥ n)\n- Nhận biết bình phương (a²) và lập phương (a³)\n- Nhận biết số chính phương"
    },
    {
        "code": "B7.C1.K1.L6",
        "name": "Thứ tự phép tính",
        "grade": 6,
        "subject": "math",
        "description": "Quy tắc thứ tự phép tính không ngoặc (lũy thừa → nhân/chia → cộng/trừ) và có ngoặc lồng nhau",
        "notes": "- Áp dụng đúng thứ tự phép tính không có ngoặc: Lũy thừa → Nhân/Chia → Cộng/Trừ\n- Áp dụng đúng thứ tự phép tính có ngoặc: [...] → {...} → (...)"
    },
    {
        "code": "B8.C1.K1.L6",
        "name": "Chia",
        "grade": 6,
        "subject": "math",
        "description": "Chia đặt tính; chia hết và chia có dư; tìm thương và số dư; tính chất phân phối để thực hiện phép chia hợp lý",
        "notes": "- Chia đặt tính (Tiểu học)\n- Phân biệt phép chia hết và phép chia có dư; tìm đúng thương và số dư\n- Áp dụng tính chất phân phối để thực hiện phép chia hợp lý"
    },
    {
        "code": "B9.C1.K1.L6",
        "name": "Dấu hiệu chia hết",
        "grade": 6,
        "subject": "math",
        "description": "Nhận biết và áp dụng dấu hiệu chia hết cho 2, 5, 3 và 9",
        "notes": "- Dấu hiệu chia hết cho 2\n- Dấu hiệu chia hết cho 5\n- Dấu hiệu chia hết cho 3\n- Dấu hiệu chia hết cho 9"
    },
    {
        "code": "B10.C2.K1.L6",
        "name": "Ước và Bội",
        "grade": 6,
        "subject": "math",
        "description": "Ký hiệu chia hết | và không chia hết ∤; tính chất chia hết của tổng; xác định ước và bội",
        "notes": "- Nhận biết ký hiệu chia hết (|) và không chia hết (∤)\n- Tính chất chia hết của một tổng — TC1, TC2\n- Xác định ước và bội trong phép chia hết\n- Tìm ước của một số\n- Tìm bội của một số\n- Tìm ước và bội số (kết hợp)"
    },
    {
        "code": "B11.C2.K1.L6",
        "name": "ƯCLN",
        "grade": 6,
        "subject": "math",
        "description": "Nhận biết ước chung và ước chung lớn nhất; cách tìm ƯCLN; ứng dụng rút gọn phân số tối giản",
        "notes": "- Nhận biết ước chung và ƯCLN\n- Tìm ƯCLN\n- Rút gọn phân số về phân số tối giản"
    },
    {
        "code": "B12.C2.K1.L6",
        "name": "BCNN",
        "grade": 6,
        "subject": "math",
        "description": "Phân tích số ra thừa số nguyên tố; bội chung và bội chung nhỏ nhất; cách tìm BCNN; ứng dụng quy đồng phân số",
        "notes": "- Phân tích ra thừa số nguyên tố\n- Nhận biết bội chung và BCNN\n- Tìm BCNN\n- Quy đồng phân số"
    },
    {
        "code": "B★.C2.K1.L6",
        "name": "Số nguyên tố và Hợp số",
        "grade": 6,
        "subject": "math",
        "description": "Nhận biết số nguyên tố, hợp số; phân biệt số nguyên tố và hợp số",
        "notes": "- Nhận biết số nguyên tố\n- Nhận biết hợp số\n- Phân biệt số nguyên tố và hợp số"
    },
    {
        "code": "B13.C3.K1.L6",
        "name": "Tập hợp ℤ và Trục số nguyên",
        "grade": 6,
        "subject": "math",
        "description": "Nhận biết số nguyên âm; tập hợp số nguyên ℤ; biểu diễn số nguyên trên trục số; so sánh hai số nguyên",
        "notes": "- Nhận biết, đọc, viết số nguyên âm\n- Nhận biết tập hợp số nguyên ℤ và biểu diễn trên trục số\n- Trục số tự nhiên → Trục số nguyên\n- So sánh hai số nguyên"
    },
    {
        "code": "B14.C3.K1.L6",
        "name": "Cộng và Trừ số nguyên",
        "grade": 6,
        "subject": "math",
        "description": "Cộng hai số nguyên cùng dấu hoặc khác dấu; số đối; tính chất giao hoán, kết hợp của phép cộng số nguyên; trừ số nguyên",
        "notes": "- Cộng hai số nguyên âm\n- Nhận biết số đối\n- Cộng hai số nguyên khác dấu\n- Tính chất phép cộng (giao hoán, kết hợp)\n- Áp dụng tính chất giao hoán và kết hợp để tính hợp lý phép cộng\n- Trừ cho số âm: a − (−b) = a + b"
    },
    {
        "code": "B15.C3.K1.L6",
        "name": "Bỏ dấu ngoặc",
        "grade": 6,
        "subject": "math",
        "description": "Quy tắc bỏ dấu ngoặc có dấu cộng hoặc dấu trừ đằng trước; quy tắc bỏ ngoặc lồng nhau",
        "notes": "- Bỏ dấu ngoặc có dấu + đằng trước: +(a + b) = a + b\n- Bỏ dấu ngoặc có dấu − đằng trước: −(a + b) = −a − b\n- Bỏ ngoặc lồng nhau"
    },
    {
        "code": "B16a.C3.K1.L6",
        "name": "Nhân số nguyên",
        "grade": 6,
        "subject": "math",
        "description": "Nhân hai số nguyên khác dấu hoặc cùng dấu; tính chất phép nhân số nguyên",
        "notes": "- Nhân hai số nguyên khác dấu → kết quả âm\n- Nhân hai số nguyên cùng dấu → kết quả dương\n- Tính chất phép nhân số nguyên"
    },
    {
        "code": "B16b.C3.K1.L6",
        "name": "Chia số nguyên & Mở rộng chia hết",
        "grade": 6,
        "subject": "math",
        "description": "Chia hết hai số nguyên và xác định dấu của thương; mở rộng quan hệ chia hết, ước và bội sang tập số nguyên âm",
        "notes": "- Thực hiện phép chia hết hai số nguyên — xác định đúng dấu của thương\n- Nhận biết và mở rộng quan hệ chia hết sang số nguyên âm\n- Nhận biết và mở rộng ước và bội sang số nguyên âm\n- Tìm ước và bội số (trong ℤ)"
    },
    {
        "code": "B18.C4.K1.L6",
        "name": "Hình phẳng cơ bản",
        "grade": 6,
        "subject": "math",
        "description": "Nhận dạng và mô tả tính chất, cách vẽ tam giác đều, hình vuông, lục giác đều, hình chữ nhật, hình thoi, hình bình hành, hình thang cân",
        "notes": "- Nhận dạng tam giác đều, hình vuông, lục giác đều\n- Mô tả các tính chất và vẽ tam giác đều, hình vuông, lục giác đều\n- Mô tả các tính chất và vẽ hình chữ nhật, hình thoi, hình bình hành, hình thang cân"
    },
    {
        "code": "B19.C4.K1.L6",
        "name": "Chu vi và Diện tích",
        "grade": 6,
        "subject": "math",
        "description": "Tính chu vi và diện tích của hình bình hành, hình thoi, hình chữ nhật, hình vuông",
        "notes": "- Tính chu vi hình bình hành\n- Tính chu vi hình thoi\n- Tính diện tích hình thoi\n- Tính diện tích hình bình hành"
    },
    {
        "code": "B21.C4.K1.L6",
        "name": "Trục đối xứng",
        "grade": 6,
        "subject": "math",
        "description": "Nhận biết hình có trục đối xứng; tìm và xác định trục đối xứng của hình phẳng và các vật thể thực tế",
        "notes": "- Nhận biết hình có trục đối xứng\n- Tìm và xác định trục đối xứng của hình phẳng\n- Tìm và xác định trục đối xứng của vật thể"
    },
    {
        "code": "B22.C4.K1.L6",
        "name": "Tâm đối xứng",
        "grade": 6,
        "subject": "math",
        "description": "Nhận biết hình có tâm đối xứng; xác định vị trí tâm đối xứng của hình phẳng và các vật thể thực tế",
        "notes": "- Nhận biết hình có tâm đối xứng\n- Xác định vị trí tâm đối xứng của hình phẳng cụ thể\n- Xác định vị trí tâm đối xứng của các vật thể"
    }
]

# Prerequisite relationships (edges) mapping: (prereq_code, kc_code, optional_label)
EDGES_DATA = [
    ("B1.C1.K1.L6", "B2.C1.K1.L6", None),
    ("B2.C1.K1.L6", "B3.C1.K1.L6", None),
    ("B2.C1.K1.L6", "B4.C1.K1.L6", None),
    ("B3.C1.K1.L6", "B4.C1.K1.L6", None),
    ("B4.C1.K1.L6", "B5.C1.K1.L6", None),
    ("B4.C1.K1.L6", "B8.C1.K1.L6", None),
    ("B5.C1.K1.L6", "B6.C1.K1.L6", None),
    ("B5.C1.K1.L6", "B8.C1.K1.L6", None),
    ("B6.C1.K1.L6", "B7.C1.K1.L6", None),
    ("B8.C1.K1.L6", "B9.C1.K1.L6", None),
    ("B9.C1.K1.L6", "B10.C2.K1.L6", None),
    ("B10.C2.K1.L6", "B11.C2.K1.L6", None),
    ("B10.C2.K1.L6", "B12.C2.K1.L6", None),
    ("B11.C2.K1.L6", "B★.C2.K1.L6", None),
    ("B12.C2.K1.L6", "B★.C2.K1.L6", None),
    
    # Extensions & Chapters
    ("B3.C1.K1.L6", "B13.C3.K1.L6", "extends → ℤ"),
    ("B13.C3.K1.L6", "B14.C3.K1.L6", None),
    ("B14.C3.K1.L6", "B15.C3.K1.L6", None),
    ("B14.C3.K1.L6", "B16a.C3.K1.L6", None),
    ("B16a.C3.K1.L6", "B16b.C3.K1.L6", None),
    ("B10.C2.K1.L6", "B16b.C3.K1.L6", "mở rộng sang ℤ⁻"),
    
    # Geometry
    ("PREREQ.C4.K1.L6", "B18.C4.K1.L6", None),
    ("B18.C4.K1.L6", "B19.C4.K1.L6", None),
    ("B19.C4.K1.L6", "B21.C4.K1.L6", None),
    ("B21.C4.K1.L6", "B22.C4.K1.L6", None)
]


async def import_map():
    print(f"Connecting to database...")
    engine = create_async_engine(DATABASE_URL, echo=False)
    AsyncSessionLocal = async_sessionmaker(engine, expire_on_commit=False)
    
    async with AsyncSessionLocal() as session:
        # 1. Upsert Knowledge Components
        kc_code_to_id = {}
        print("Upserting Knowledge Components...")
        for kc in KCS_DATA:
            # Check if exists
            stmt = select(KnowledgeComponent).where(KnowledgeComponent.code == kc["code"])
            res = await session.execute(stmt)
            existing_kc = res.scalar_one_or_none()
            
            if existing_kc:
                # Update
                existing_kc.name = kc["name"]
                existing_kc.grade = kc["grade"]
                existing_kc.subject = kc["subject"]
                existing_kc.description = kc["description"]
                existing_kc.notes = kc["notes"]
                db_kc = existing_kc
                print(f"  → Updated {kc['code']}")
            else:
                # Insert
                db_kc = KnowledgeComponent(
                    code=kc["code"],
                    name=kc["name"],
                    grade=kc["grade"],
                    subject=kc["subject"],
                    description=kc["description"],
                    notes=kc["notes"]
                )
                session.add(db_kc)
                print(f"  ✓ Inserted {kc['code']}")
            
            await session.flush()  # Make sure we get db_kc.id
            kc_code_to_id[kc["code"]] = db_kc.id
            
        # 2. Upsert Edges
        print("\nUpserting Prerequisite Edges...")
        for prereq_code, kc_code, label in EDGES_DATA:
            prereq_id = kc_code_to_id.get(prereq_code)
            kc_id = kc_code_to_id.get(kc_code)
            
            if not prereq_id or not kc_id:
                print(f"  ✗ Skip edge {prereq_code} → {kc_code} (KC missing from mapping)")
                continue
                
            # Check if edge already exists
            stmt = select(KCPrerequisite).where(
                KCPrerequisite.kc_id == kc_id,
                KCPrerequisite.prereq_id == prereq_id
            )
            res = await session.execute(stmt)
            existing_edge = res.scalar_one_or_none()
            
            if existing_edge:
                existing_edge.label = label
                print(f"  → Updated edge {prereq_code} → {kc_code}")
            else:
                new_edge = KCPrerequisite(
                    kc_id=kc_id,
                    prereq_id=prereq_id,
                    label=label,
                    weight=1.0
                )
                session.add(new_edge)
                
                # Add to edit history
                session.add(GraphEditHistory(
                    action="add_edge",
                    entity_type="edge",
                    payload={"kc_id": str(kc_id), "prereq_id": str(prereq_id), "label": label, "weight": 1.0}
                ))
                print(f"  ✓ Inserted edge {prereq_code} → {kc_code}")
                
        await session.commit()
        print("\nAll nodes and edges successfully imported!")
        
    await engine.dispose()


if __name__ == "__main__":
    asyncio.run(import_map())
