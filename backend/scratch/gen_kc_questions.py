"""
Targeted Question Generation for 3 KCs in Minh's assessment path.

Goals:
- G9-MATH-NHAN-BIET-PHAN: 1 item → 10 items (critically low, repeated 7 times)
- G6-MATH-NHAN-BIET-DOC:  6 items → 10 items (repeated in test, need 4 more)
- G6-MATH-QUY-DONG-MAU:   8 items → 10 items (some items are wrong KC, add 2 correct)

All questions follow the master prompt pipeline:
  Layer 1 (anchor, b=0):  2 items each KC
  Layer 2 (easy, b=-1):   3 items each KC
  Layer 3 (hard, b=+1.5): 3 items each KC
  Layer 4 (medium-hard):  2 items each KC → total 10

Uses Gemini API (same as agent_student) since we're in Gemini ecosystem.
"""

import asyncio, sys, json, re, uuid
from datetime import datetime, timezone
sys.path.insert(0, "/Users/admin/ultimate-adaptive/backend")

from sqlalchemy import text, select
from app.core.database import AsyncSessionLocal
from app.models.models import KnowledgeComponent, Item, ItemDraft
from app.core.config import settings
from google import genai
from google.genai import types as genai_types

# ── Target KCs ────────────────────────────────────────────────────────────────

TARGET_KCS = {
    "G9-MATH-NHAN-BIET-PHAN": {
        "target_total": 10,
        "need": 9,  # has 1, needs 9 more
        "topic": """Phân số có tử và mẫu là số nguyên (mẫu khác 0)
        
Nội dung cốt lõi:
- Định nghĩa: a/b là phân số khi a, b ∈ ℤ và b ≠ 0
- Phân số âm: -3/5 = 3/(-5) = -(3/5)
- Phân số dương: khi tử và mẫu cùng dấu
- Phân số âm: khi tử và mẫu khác dấu
- Mọi số nguyên n = n/1 là phân số
- Số 0 = 0/b với mọi b ≠ 0
- Điều kiện: mẫu KHÁC 0 (không phải tử)

Sai lầm học sinh hay mắc:
- Nhầm điều kiện: "a ≠ 0" thay vì "b ≠ 0" (nhầm tử với mẫu)
- Tưởng phân số phải có tử/mẫu là số tự nhiên (không nhớ mở rộng sang số nguyên)
- Nhầm số nguyên âm không phải là phân số
- Không nhận ra 5/1 là phân số""",
    },
    "G6-MATH-NHAN-BIET-DOC": {
        "target_total": 10,
        "need": 4,  # has 6, needs 4 more
        "topic": """Nhận biết, đọc và viết số nguyên âm (lớp 6)
        
Nội dung cốt lõi:
- Số nguyên âm: -1, -2, -3, ... (nhỏ hơn 0)
- Ký hiệu: dấu - trước số
- Tập ℤ = {..., -3, -2, -1, 0, 1, 2, 3, ...} = ℤ⁻ ∪ {0} ∪ ℕ*
- Ứng dụng: nhiệt độ dưới 0°C, độ cao dưới mực nước biển, nợ tiền
- Trên trục số: số âm nằm bên TRÁI số 0
- Số đối của số nguyên âm a là -a (số dương)

Sai lầm hay mắc:
- Nhầm ℤ = số âm + số dương (quên số 0)
- Nhầm trục số: nghĩ số âm ở bên phải
- Nhầm số đối: đối của -3 là 3 nhưng hay viết -3 lần nữa
- Nhầm giữa số nguyên âm và số tự nhiên""",
    },
    "G6-MATH-QUY-DONG-MAU": {
        "target_total": 10,
        "need": 2,  # has 8 but 2 are wrong KC (bar chart), need 2 correct replacements
        "topic": """Quy đồng mẫu các phân số có tử/mẫu là số nguyên (lớp 6)
        
Nội dung cốt lõi:
- Mẫu chung: M = BCNN(|b₁|, |b₂|, ...) nhưng M > 0
- Thừa số phụ: M/bᵢ cho từng phân số
- Bước quy đồng: aᵢ/bᵢ → (aᵢ × M/bᵢ) / M
- Chú ý: nếu mẫu âm → nhân tử-mẫu với (-1) để mẫu dương
- Phân số bằng nhau: a/b = (a×k)/(b×k) với k ≠ 0

Sai lầm hay mắc:
- Thừa số phụ: nhân tử mà không nhân mẫu
- Nhầm M/bᵢ là thừa số phụ của tử hay mẫu
- Quên đưa về mẫu dương khi mẫu âm
- Tính BCNN sai → mẫu chung sai
- Nhân mẫu với tử thay vì dùng thừa số phụ""",
    }
}

# ── Prompt Template ────────────────────────────────────────────────────────────

GENERATION_PROMPT = """Bạn là Chuyên gia Giáo dục Toán học và Psychometrician. Tạo {count} câu hỏi MCQ (4 đáp án) cho node kiến thức sau:

# NODE KIẾN THỨC
{topic}

# YÊU CẦU BẮT BUỘC
1. VÔ HIỆU HÓA MÁY TÍNH: KHÔNG yêu cầu tính toán số cụ thể lớn. Hỏi về định nghĩa, cấu trúc, quy trình, điều kiện.
2. NHIỄU CÓ CHỦ ĐÍCH: Mỗi đáp án sai phải đại diện cho 1 sai lầm cụ thể của học sinh (ghi rõ là sai lầm gì).
3. UNICODE THUẦN: Dùng ký tự Unicode (², ℤ, ℕ, ×, ÷, ≠, ∈, −) không dùng LaTeX.
4. CÁC CÂU PHẢI KHÁC NHAU: Không được lặp lại cùng 1 scenario hay format.

# CẤU TRÚC {count} CÂU (phân theo IRT):
{structure}

# ĐỊNH DẠNG ĐẦU RA (cho MỖI câu):
**Câu [số] ([Dễ/TB/Khó] - b=[giá trị]):**
Q: [câu hỏi]
A: [đáp án A]
B: [đáp án B]  
C: [đáp án C]
D: [đáp án D]
Đúng: [A/B/C/D]
Anchor: [TRUE nếu b=0 và is_diagnostic_anchor, FALSE nếu không]
Sai lầm A: [mô tả sai lầm nhận thức của đáp án A nếu A sai]
Sai lầm B: [tương tự]
Sai lầm C: [tương tự]
Sai lầm D: [tương tự]

Tạo ngay {count} câu hỏi:"""

# ── IRT Structures per need count ─────────────────────────────────────────────

def get_structure(count: int) -> tuple[str, list[float]]:
    """Return structure description and list of b values for `count` items."""
    if count == 9:
        structure = """
- 2 câu Trung bình (b=0.0): Entry point / Anchor chẩn đoán
- 3 câu Dễ (b=-1.0): Dò lỗ hổng nền tảng
- 2 câu Khó (b=+1.5): Nâng hạng năng lực
- 2 câu Trung bình-khó (b=+0.8): Xác nhận mastery"""
        b_values = [0.0, 0.0, -1.0, -1.0, -1.0, 1.5, 1.5, 0.8, 0.8]
    elif count == 4:
        structure = """
- 1 câu Trung bình (b=0.0): Entry point / Anchor
- 1 câu Dễ (b=-1.0): Dò lỗ hổng
- 1 câu Khó (b=+1.5): Nâng hạng
- 1 câu Trung bình-khó (b=+0.8): Xác nhận"""
        b_values = [0.0, -1.0, 1.5, 0.8]
    elif count == 2:
        structure = """
- 1 câu Trung bình-khó (b=+0.8): Câu về cấu trúc/quy trình
- 1 câu Khó (b=+1.5): Câu phân tích meta-cognition (sai lầm của học sinh ảo)"""
        b_values = [0.8, 1.5]
    else:
        structure = f"- {count} câu phân bố đều từ dễ đến khó"
        b_values = [0.0] * count
    return structure, b_values

# ── Parser ────────────────────────────────────────────────────────────────────

def parse_questions(text: str, b_values: list[float]) -> list[dict]:
    """Parse generated questions into structured dicts."""
    questions = []
    
    # Split by Câu markers
    pattern = r'\*\*Câu\s+(\d+)[^*]*\*\*'
    parts = re.split(pattern, text)
    
    # Group: [pre, n1, block1, n2, block2, ...]
    blocks = []
    for i in range(1, len(parts), 2):
        if i+1 < len(parts):
            blocks.append(parts[i+1])
    
    for idx, block in enumerate(blocks):
        try:
            # Extract Q
            q_match = re.search(r'Q:\s*(.+?)(?=\nA:|$)', block, re.DOTALL)
            q = q_match.group(1).strip() if q_match else ""
            
            # Extract options
            opts = {}
            for label in ['A', 'B', 'C', 'D']:
                m = re.search(rf'{label}:\s*(.+?)(?=\n[ABCD]:|Đúng:|$)', block, re.DOTALL)
                opts[label] = m.group(1).strip() if m else ""
            
            # Extract correct answer
            correct_match = re.search(r'Đúng:\s*([A-D])', block)
            correct = correct_match.group(1) if correct_match else "A"
            
            # Extract anchor
            anchor_match = re.search(r'Anchor:\s*(TRUE|FALSE)', block, re.IGNORECASE)
            is_anchor = anchor_match and anchor_match.group(1).upper() == "TRUE"
            
            b = b_values[idx] if idx < len(b_values) else 0.0
            
            if q and opts.get('A'):
                questions.append({
                    "question": q,
                    "answers": [
                        {"label": "A", "text": opts.get("A", ""), "is_correct": correct == "A"},
                        {"label": "B", "text": opts.get("B", ""), "is_correct": correct == "B"},
                        {"label": "C", "text": opts.get("C", ""), "is_correct": correct == "C"},
                        {"label": "D", "text": opts.get("D", ""), "is_correct": correct == "D"},
                    ],
                    "irt_b": b,
                    "irt_a": 1.0,
                    "irt_c": 0.25,
                    "is_diagnostic_anchor": is_anchor or abs(b) < 0.1,
                })
        except Exception as e:
            print(f"  Parse error on block {idx}: {e}")
    
    return questions

# ── Main ──────────────────────────────────────────────────────────────────────

async def generate_for_kc(client, kc_code: str, kc_id: str, config: dict) -> list[dict]:
    count = config["need"]
    structure, b_values = get_structure(count)
    
    prompt = GENERATION_PROMPT.format(
        count=count,
        topic=config["topic"],
        structure=structure,
    )
    
    print(f"\n  Generating {count} questions for {kc_code}...")
    
    response = await asyncio.to_thread(
        client.models.generate_content,
        model="gemini-3-flash-preview",
        contents=prompt,
        config=genai_types.GenerateContentConfig(
            temperature=0.7,
            max_output_tokens=4000,
        ),
    )
    
    raw = response.text
    print(f"  Raw response: {len(raw)} chars")
    
    questions = parse_questions(raw, b_values)
    print(f"  Parsed: {len(questions)} questions")
    
    return questions, raw

async def save_questions(db, kc_id: str, kc_code: str, questions: list[dict]):
    """Save as approved Items directly (bypassing draft since we're doing manual review here)."""
    saved = 0
    for q in questions:
        b = q["irt_b"]
        if b <= -0.5:
            diff_label = "easy"
        elif b >= 1.0:
            diff_label = "hard"
        else:
            diff_label = "medium"
        item = Item(
            id=uuid.uuid4(),
            kc_id=uuid.UUID(kc_id),
            content=q,
            format_type="mcq4",
            difficulty_label=diff_label,
            irt_a=q["irt_a"],
            irt_b=q["irt_b"],
            irt_c=q["irt_c"],
            is_diagnostic_anchor=q["is_diagnostic_anchor"],
            is_active=True,
        )
        db.add(item)
        saved += 1
    await db.commit()
    return saved

async def main():
    client = genai.Client(api_key=settings.GEMINI_API_KEY)
    
    # Get KC IDs
    async with AsyncSessionLocal() as db:
        codes = list(TARGET_KCS.keys())
        r = await db.execute(text("SELECT id, code FROM knowledge_components WHERE code = ANY(:c)"), {'c': codes})
        kc_id_map = {row.code: str(row.id) for row in r.fetchall()}
    
    print("=== GENERATING QUESTIONS FOR 3 KCs ===")
    print(f"KCs: {list(kc_id_map.keys())}")
    
    all_results = {}
    
    for kc_code, config in TARGET_KCS.items():
        kc_id = kc_id_map.get(kc_code)
        if not kc_id:
            print(f"\nSkipping {kc_code} — not found in DB")
            continue
        
        print(f"\n{'='*60}")
        print(f"KC: {kc_code}")
        print(f"Need: {config['need']} new questions")
        
        questions, raw = await generate_for_kc(client, kc_code, kc_id, config)
        
        if not questions:
            print(f"  ❌ No questions parsed! Raw:\n{raw[:500]}")
            continue
        
        # Preview
        print(f"\n  Preview ({len(questions)} questions):")
        for i, q in enumerate(questions):
            correct = next(a['label'] for a in q['answers'] if a['is_correct'])
            anchor = "⚓" if q['is_diagnostic_anchor'] else ""
            print(f"    Q{i+1} (b={q['irt_b']:+.1f}) {anchor}: {q['question'][:70]}...")
            print(f"         → Correct: {correct}")
        
        all_results[kc_code] = {"kc_id": kc_id, "questions": questions, "raw": raw}
        
        # Save to DB
        async with AsyncSessionLocal() as db:
            saved = await save_questions(db, kc_id, kc_code, questions)
            print(f"\n  ✅ Saved {saved} questions to DB")
        
        # Rate limit
        await asyncio.sleep(2)
    
    # Final count check
    print("\n\n=== FINAL ITEM COUNT CHECK ===")
    async with AsyncSessionLocal() as db:
        for kc_code in TARGET_KCS:
            r = await db.execute(text("""
                SELECT COUNT(*) FROM items i
                JOIN knowledge_components kc ON kc.id = i.kc_id
                WHERE kc.code = :c AND i.is_active = true
            """), {'c': kc_code})
            cnt = r.scalar()
            target = TARGET_KCS[kc_code]["target_total"]
            status = "✅" if cnt >= target else f"⚠️ (target={target})"
            print(f"  {kc_code}: {cnt} items {status}")
    
    # Export raw for review
    out = "/Users/admin/ultimate-adaptive/docs/generated_questions_review.json"
    with open(out, "w", encoding="utf-8") as f:
        json.dump({kc: {"questions": v["questions"], "raw": v["raw"]} for kc, v in all_results.items()},
                  f, ensure_ascii=False, indent=2)
    print(f"\n✅ Full output saved to: {out}")

asyncio.run(main())
