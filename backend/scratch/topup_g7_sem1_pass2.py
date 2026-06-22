"""
Pass 2: Hard-question-only top-up.
Strategy: Ask for "2 easy + N hard" even when we only need hard.
  - The easy anchor forces the AI to use the correct template format
  - We filter out easy from the response and only save hard
  - This fixes the parse failures seen in pass 1 for hard-only requests
"""
import asyncio, sys, os, uuid
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent))
os.chdir(Path(__file__).parent.parent)

from dotenv import load_dotenv
load_dotenv(Path(__file__).parent.parent / ".env")

from sqlalchemy import text
from app.core.database import AsyncSessionLocal
from app.models.models import ItemDraft
from app.services.question_gen_service import (
    _call_gemini, _parse_ai_response,
    _load_sgk_for_grade, extract_sgk_section,
)

EXCLUDED_CODES = {
    "G7-MATH-SO-SANH-HAI", "G7-MATH-TINH-GIA-TRI",
    "G7-MATH-TINH-SO-DO-2", "G7-MATH-VE-TIA-PHAN",
}
GRADE = 7
RATE_LIMIT_S = 2.0

# Key insight: always include 2 easy + hard as anchor so AI uses correct template
HARD_ANCHOR_PROMPT = """\
Bạn là chuyên gia thiết kế câu hỏi MCQ Toán THCS cho hệ thống Adaptive Learning.

# NHIỆM VỤ
Sinh ra chính xác {n_total} câu hỏi MCQ cho node kiến thức: **{kc_name}**
Phân bổ BẮT BUỘC: 2 câu Dễ + {n_hard} câu Khó (tổng {n_total} câu)

# NỘI DUNG SGK
{sgk_content}

# YÊU CẦU CHẤT LƯỢNG
1. VÔ HIỆU HÓA MÁY TÍNH: Hỏi Quy trình, Cấu trúc, Khái quát hóa (biến a,b,x,y).
2. NHIỄU CÓ CHỦ ĐÍCH: Mỗi đáp án sai = một lỗi nhận thức cụ thể.
3. UNICODE THUẦN: ², ³, ·, ×, ÷, ≥, ≤, ≠, ∈. KHÔNG dùng LaTeX.

[DỄ] Mức độ Dễ (ω < 0) — 2 câu — Vai trò: DÒ LỖ HỔNG KST
  Hỏi từ vựng, định nghĩa cơ bản, bước nhỏ nhất của quy trình.

[KHÓ] Mức độ Khó (ω > 0) — {n_hard} câu — Vai trò: NÂNG HẠNG θ / MASTERY
  Tư duy trừu tượng (ẩn số đa biến), tính chất bắc cầu, hoặc phân tích
  meta-cognition (đưa lời giải SAI của học sinh ảo → yêu cầu tìm lỗi).

# KIỂM TRA NHẤT QUÁN
Nếu SGK không liên quan → bắt đầu bằng:
[MISMATCH DETECTED: Nội dung SGK không khớp với node. Từ chối tạo câu hỏi.]

# ĐỊNH DẠNG BẮT BUỘC (mỗi câu)
**Câu [X] (Mức độ [Dễ/Khó] - Vai trò: [Dò lỗ hổng / Nâng hạng θ]):**
[Nội dung câu hỏi]
A. [Đáp án A]
B. [Đáp án B]
C. [Đáp án C]
D. [Đáp án D]
*Đáp án: [A/B/C/D]*
*(Tag thuật toán KST/IRT: [Phân tích bẫy nhận thức và rẽ nhánh])*

Sinh đúng thứ tự: 2 câu Dễ trước, rồi {n_hard} câu Khó sau.\
"""

async def main():
    print(f"\n{'='*65}")
    print("  Pass 2: Hard-question anchor top-up")
    print(f"{'='*65}\n")

    sgk_by_tap = _load_sgk_for_grade(GRADE)
    job_id = uuid.uuid4()
    generated = errors = total_saved = 0

    async with AsyncSessionLocal() as db:
        # Get current state — only KCs still missing hard questions
        rows = await db.execute(text("""
            SELECT
                d.kc_id::text, d.kc_code, d.kc_name, kc.chapter_info,
                GREATEST(0, 2 - COUNT(*) FILTER (WHERE d.flagged=false AND d.difficulty_label='easy'))    AS need_easy,
                GREATEST(0, 2 - COUNT(*) FILTER (WHERE d.flagged=false AND d.difficulty_label='medium'))  AS need_medium,
                GREATEST(0, 2 - COUNT(*) FILTER (WHERE d.flagged=false AND d.difficulty_label='hard'))    AS need_hard,
                COUNT(*) FILTER (WHERE d.flagged=false) AS valid_total
            FROM item_drafts d
            JOIN knowledge_components kc ON d.kc_id = kc.id
            WHERE kc.grade = :grade
              AND kc.chapter_info ~ :pattern
            GROUP BY d.kc_id, d.kc_code, d.kc_name, kc.chapter_info
            HAVING GREATEST(0, 2 - COUNT(*) FILTER (WHERE d.flagged=false AND d.difficulty_label='hard')) > 0
               OR  GREATEST(0, 2 - COUNT(*) FILTER (WHERE d.flagged=false AND d.difficulty_label='easy')) > 0
               OR  GREATEST(0, 2 - COUNT(*) FILTER (WHERE d.flagged=false AND d.difficulty_label='medium')) > 0
            ORDER BY d.kc_code
        """), {"grade": GRADE, "pattern": r"^[Bb][0-9]+(K|k)1$"})

        needs = [dict(r) for r in rows.mappings() if r["kc_code"] not in EXCLUDED_CODES]

        print(f"  KCs still needing questions: {len(needs)}\n")
        print(f"  {'Code':<38} {'Valid':>5}  {'E+M+H still needed'}")
        print(f"  {'-'*65}")
        for n in needs:
            print(f"  {n['kc_code']:<38} {n['valid_total']:>5}  "
                  f"{n['need_easy']}+{n['need_medium']}+{n['need_hard']}")
        print(f"\n  Starting pass 2...\n")

        for idx, kc in enumerate(needs, 1):
            code     = kc["kc_code"]
            name     = kc["kc_name"]
            kc_id    = kc["kc_id"]
            ch_info  = kc["chapter_info"]
            n_easy   = kc["need_easy"]
            n_medium = kc["need_medium"]
            n_hard   = kc["need_hard"]

            # Determine what to request
            # Always anchor with 2 easy even if we don't need them
            # For medium gaps: include them too
            anchor_easy = max(2, n_easy)  # at least 2 for anchor
            n_total_request = anchor_easy + n_medium + n_hard

            if n_hard == 0 and n_easy == 0 and n_medium == 0:
                continue

            sgk_section = extract_sgk_section(ch_info, sgk_by_tap, grade=GRADE)
            if not sgk_section:
                sgk_section = f"[SGK không tìm thấy cho {ch_info}. Dựa trên tên node: {name}]"

            # Build prompt with anchor easy + needed hard (+ optional medium)
            if n_medium > 0:
                prompt = HARD_ANCHOR_PROMPT.replace(
                    "Phân bổ BẮT BUỘC: 2 câu Dễ + {n_hard} câu Khó (tổng {n_total} câu)",
                    f"Phân bổ BẮT BUỘC: {anchor_easy} câu Dễ + {n_medium} câu Trung bình + {n_hard} câu Khó (tổng {n_total_request} câu)"
                ).replace(
                    "Sinh đúng thứ tự: 2 câu Dễ trước, rồi {n_hard} câu Khó sau.",
                    f"Sinh đúng thứ tự: {anchor_easy} câu Dễ → {n_medium} câu Trung bình → {n_hard} câu Khó."
                )
            else:
                prompt = HARD_ANCHOR_PROMPT

            prompt = prompt.format(
                kc_name=name,
                sgk_content=sgk_section[:4000],
                n_hard=n_hard if n_hard > 0 else 2,
                n_total=n_total_request,
            )

            print(f"  [{idx:>2}/{len(needs)}] {code}")
            print(f"         Request: {anchor_easy}E+{n_medium}M+{n_hard}H  |  Save only: {n_easy}E+{n_medium}M+{n_hard}H")

            try:
                raw = await _call_gemini(prompt, kc_code=code)
            except Exception as e:
                errors += 1
                print(f"         ❌ Gemini error: {e}\n")
                await asyncio.sleep(RATE_LIMIT_S)
                continue

            if "[MISMATCH DETECTED" in raw[:300]:
                errors += 1
                print(f"         ❌ Mismatch\n")
                await asyncio.sleep(RATE_LIMIT_S)
                continue

            parsed = _parse_ai_response(raw)
            if not parsed:
                errors += 1
                print(f"         ❌ Parse failed\n")
                await asyncio.sleep(RATE_LIMIT_S)
                continue

            # Save ONLY what's still needed (filter out anchor easy if not needed)
            need_per_diff  = {"easy": n_easy, "medium": n_medium, "hard": n_hard}
            saved_per_diff = {"easy": 0, "medium": 0, "hard": 0}
            saved_this_kc  = 0

            for q in parsed:
                diff = q.get("difficulty_label", "medium")
                if diff not in need_per_diff:
                    continue
                if need_per_diff[diff] == 0:
                    continue  # don't save anchor easy if not needed
                if saved_per_diff[diff] >= need_per_diff[diff]:
                    continue

                draft = ItemDraft(
                    kc_id=uuid.UUID(kc_id),
                    kc_name=name,
                    kc_code=code,
                    content={"question": q["question_text"], "answers": q["answers"]},
                    difficulty_label=diff,
                    is_diagnostic_anchor=q.get("is_diagnostic_anchor", False),
                    kst_irt_tag=q.get("kst_irt_tag"),
                    generation_job_id=job_id,
                    sgk_section=ch_info or "",
                    raw_ai_output=raw if saved_this_kc == 0 else None,
                    status="pending",
                    flagged=False,
                )
                db.add(draft)
                saved_per_diff[diff] += 1
                saved_this_kc += 1

            await db.commit()

            saved_str = f"easy={saved_per_diff['easy']}, medium={saved_per_diff['medium']}, hard={saved_per_diff['hard']}"
            missing = {d: need_per_diff[d] - saved_per_diff[d]
                       for d in need_per_diff if saved_per_diff[d] < need_per_diff[d]}

            if saved_this_kc > 0:
                generated += 1
                total_saved += saved_this_kc
                print(f"         ✅ Saved {saved_this_kc}: {saved_str}")
            else:
                errors += 1
                print(f"         ❌ No usable questions")

            if missing:
                print(f"         ⚠️  Still missing: {missing}")
            print()

            await asyncio.sleep(RATE_LIMIT_S)

    print(f"\n{'='*65}")
    print(f"  ✅ KCs topped up  : {generated}")
    print(f"  ❌ Errors         : {errors}")
    print(f"  📝 New drafts     : {total_saved}")
    print(f"{'='*65}\n")

asyncio.run(main())
