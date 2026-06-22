"""
Targeted difficulty top-up script for G7 Semester 1.

Strategy:
  - Query DB to find exactly which difficulty tiers are missing per KC
  - Build a focused prompt asking ONLY for those tiers (e.g. "2 Khó + 2 Dễ")
  - Filter parsed questions to only save correct-difficulty ones
  - One Gemini call per KC (efficient)

Excluded nodes (wrong chapter_info, will be fixed manually):
  G7-MATH-SO-SANH-HAI, G7-MATH-TINH-GIA-TRI,
  G7-MATH-TINH-SO-DO-2, G7-MATH-VE-TIA-PHAN
"""
import asyncio, sys, os, uuid, json, re
from pathlib import Path
from datetime import datetime, timezone

sys.path.insert(0, str(Path(__file__).parent.parent))
os.chdir(Path(__file__).parent.parent)

from dotenv import load_dotenv
load_dotenv(Path(__file__).parent.parent / ".env")

from sqlalchemy import select, func, text
from app.core.database import AsyncSessionLocal
from app.models.models import ItemDraft, KnowledgeComponent
from app.services.question_gen_service import (
    _call_gemini,
    _parse_ai_response,
    _load_sgk_for_grade,
    extract_sgk_section,
)

# ─── Config ──────────────────────────────────────────────────────────────────

EXCLUDED_CODES = {
    "G7-MATH-SO-SANH-HAI",
    "G7-MATH-TINH-GIA-TRI",
    "G7-MATH-TINH-SO-DO-2",
    "G7-MATH-VE-TIA-PHAN",
}

GRADE         = 7
RATE_LIMIT_S  = 2.0   # seconds between calls
TARGET_PER_DIFF = 2   # we want exactly 2 of each difficulty

# ─── Targeted prompt (does NOT modify MASTER_PROMPT) ────────────────────────

TOPUP_PROMPT = """\
Bạn là chuyên gia thiết kế câu hỏi MCQ Toán THCS cho hệ thống Adaptive Learning.

# NHIỆM VỤ
Sinh ra chính xác {n_total} câu hỏi MCQ cho node kiến thức: **{kc_name}**
Phân bổ bắt buộc: {distribution_str}

# NỘI DUNG SGK
{sgk_content}

# YÊU CẦU CHẤT LƯỢNG (BẮT BUỘC)
1. VÔ HIỆU HÓA MÁY TÍNH: Hỏi Quy trình, Cấu trúc, Khái quát hóa (biến a,b,x,y). KHÔNG tính số to.
2. NHIỄU CÓ CHỦ ĐÍCH: Mỗi đáp án sai = một lỗi nhận thức cụ thể.
3. UNICODE THUẦN: ², ³, ·, ×, ÷, ≥, ≤, ≠, ∈, ℕ. KHÔNG dùng LaTeX.
4. 4 đáp án A/B/C/D, chỉ 1 đúng.

# MÔ TẢ CÁC LỚP CẦN SINH
{tier_specs}

# KIỂM TRA NHẤT QUÁN
Nếu SGK KHÔNG liên quan đến tên Node → bắt đầu bằng:
[MISMATCH DETECTED: Nội dung SGK không khớp với node. Từ chối tạo câu hỏi.]

# ĐỊNH DẠNG ĐẦU RA (mỗi câu)
**Câu [X] (Mức độ [Dễ/TB/Khó] - Vai trò: [Entry Point / Dò lỗ hổng / Nâng hạng θ]):**
[Nội dung câu hỏi]
A. [Đáp án A]
B. [Đáp án B]
C. [Đáp án C]
D. [Đáp án D]
*Đáp án: [A/B/C/D]*
*(Tag thuật toán KST/IRT: [Phân tích 2-3 câu về bẫy nhận thức và rẽ nhánh])*
"""

TIER_EASY = """\
[DỄ] Mức độ Dễ (ω < 0) — {n} câu — Vai trò: DÒ LỖ HỔNG KST
  Bóc tách quy trình thành bước nhỏ nhất, hỏi từ vựng, test trường hợp biên.
  KHÔNG gắn [is_diagnostic_anchor = TRUE]."""

TIER_MEDIUM = """\
[TRUNG BÌNH / ENTRY POINT] Mức độ TB (ω = 0) — {n} câu — Vai trò: MỎ NEO CHẨN ĐOÁN
  Trực diện vào định nghĩa/quy tắc cốt lõi, tư duy đơn bước, KHÔNG gài bẫy phức tạp.
  Bắt buộc gắn tag [is_diagnostic_anchor = TRUE]."""

TIER_HARD = """\
[KHÓ] Mức độ Khó (ω > 0) — {n} câu — Vai trò: NÂNG HẠNG θ / MASTERY
  Tư duy trừu tượng (ẩn số đa biến), tính chất bắc cầu, hoặc phân tích meta-cognition
  (đưa lời giải sai của học sinh ảo → yêu cầu tìm lỗi sai). KHÔNG dùng số to."""

DIFF_LABEL_MAP = {"easy": "Dễ", "medium": "Trung bình / Entry Point", "hard": "Khó"}

# ─── DB helpers ──────────────────────────────────────────────────────────────

async def get_needs(db):
    """
    Return list of dicts: {kc_id, kc_code, kc_name, chapter_info,
                           need_easy, need_medium, need_hard}
    Only includes KCs that need at least one more question in some tier.
    """
    rows = await db.execute(text("""
        SELECT
            d.kc_id::text,
            d.kc_code,
            d.kc_name,
            kc.chapter_info,
            GREATEST(0, 2 - COUNT(*) FILTER (WHERE d.flagged=false AND d.difficulty_label='easy'))    AS need_easy,
            GREATEST(0, 2 - COUNT(*) FILTER (WHERE d.flagged=false AND d.difficulty_label='medium'))  AS need_medium,
            GREATEST(0, 2 - COUNT(*) FILTER (WHERE d.flagged=false AND d.difficulty_label='hard'))    AS need_hard,
            COUNT(*) FILTER (WHERE d.flagged=false) AS valid_total
        FROM item_drafts d
        JOIN knowledge_components kc ON d.kc_id = kc.id
        WHERE kc.grade = :grade
          AND kc.chapter_info ~ :pattern
        GROUP BY d.kc_id, d.kc_code, d.kc_name, kc.chapter_info
        HAVING
            GREATEST(0, 2 - COUNT(*) FILTER (WHERE d.flagged=false AND d.difficulty_label='easy'))   > 0
         OR GREATEST(0, 2 - COUNT(*) FILTER (WHERE d.flagged=false AND d.difficulty_label='medium')) > 0
         OR GREATEST(0, 2 - COUNT(*) FILTER (WHERE d.flagged=false AND d.difficulty_label='hard'))   > 0
        ORDER BY d.kc_code
    """), {"grade": GRADE, "pattern": r"^[Bb][0-9]+(K|k)1$"})

    result = []
    for r in rows.mappings():
        code = r["kc_code"]
        if code in EXCLUDED_CODES:
            continue
        result.append(dict(r))
    return result


async def get_needs_for_zero_valid(db):
    """
    KCs with 0 valid drafts at all (not in item_drafts or only flagged).
    These need a full 2+2+2 generation.
    """
    rows = await db.execute(text("""
        SELECT
            kc.id::text as kc_id,
            kc.code as kc_code,
            kc.name as kc_name,
            kc.chapter_info
        FROM knowledge_components kc
        WHERE kc.grade = :grade
          AND kc.chapter_info ~ :pattern
          AND kc.id NOT IN (
              SELECT DISTINCT d.kc_id
              FROM item_drafts d
              WHERE d.flagged = false
          )
        ORDER BY kc.code
    """), {"grade": GRADE, "pattern": r"^[Bb][0-9]+(K|k)1$"})

    result = []
    for r in rows.mappings():
        code = r["kc_code"]
        if code in EXCLUDED_CODES:
            continue
        result.append({
            "kc_id": r["kc_id"],
            "kc_code": r["kc_code"],
            "kc_name": r["kc_name"],
            "chapter_info": r["chapter_info"],
            "need_easy": 2,
            "need_medium": 2,
            "need_hard": 2,
            "valid_total": 0,
        })
    return result

# ─── Prompt builder ───────────────────────────────────────────────────────────

def build_prompt(kc_name: str, sgk_content: str, need_easy: int, need_medium: int, need_hard: int) -> str:
    tiers = []
    dist_parts = []
    if need_easy > 0:
        tiers.append(TIER_EASY.format(n=need_easy))
        dist_parts.append(f"{need_easy} câu Dễ")
    if need_medium > 0:
        tiers.append(TIER_MEDIUM.format(n=need_medium))
        dist_parts.append(f"{need_medium} câu Trung bình (Entry Point)")
    if need_hard > 0:
        tiers.append(TIER_HARD.format(n=need_hard))
        dist_parts.append(f"{need_hard} câu Khó")

    n_total = need_easy + need_medium + need_hard
    distribution_str = " + ".join(dist_parts)
    tier_specs = "\n\n".join(tiers)

    return TOPUP_PROMPT.format(
        kc_name=kc_name,
        sgk_content=sgk_content[:4000],
        n_total=n_total,
        distribution_str=distribution_str,
        tier_specs=tier_specs,
    )

# ─── Main ─────────────────────────────────────────────────────────────────────

async def main():
    print(f"\n{'='*65}")
    print(f"  G7 Sem1 Targeted Difficulty Top-up")
    print(f"  Excluded: {', '.join(sorted(EXCLUDED_CODES))}")
    print(f"{'='*65}\n")

    sgk_by_tap = _load_sgk_for_grade(GRADE)
    job_id = uuid.uuid4()

    generated = errors = skipped = 0
    total_saved = 0

    async with AsyncSessionLocal() as db:
        # Merge: KCs with partial valid + KCs with 0 valid
        needs_partial = await get_needs(db)
        # Filter out any that are already in needs_partial from zero-valid
        partial_codes = {n["kc_code"] for n in needs_partial}
        needs_zero = await get_needs_for_zero_valid(db)
        # needs_zero might already be covered by needs_partial if they have only flagged drafts
        # Deduplicate
        all_needs = needs_partial + [n for n in needs_zero if n["kc_code"] not in partial_codes]
        all_needs.sort(key=lambda x: x["kc_code"])

        print(f"  KCs needing top-up: {len(all_needs)}\n")
        print(f"  {'Code':<35} {'Valid':>5} {'Need:E+M+H':>12} {'Action'}")
        print(f"  {'-'*70}")
        for n in all_needs:
            need_str = f"{n['need_easy']}+{n['need_medium']}+{n['need_hard']}"
            print(f"  {n['kc_code']:<35} {n['valid_total']:>5} {need_str:>12}")
        print(f"\n  Starting generation...\n")

        for idx, kc in enumerate(all_needs, 1):
            code      = kc["kc_code"]
            name      = kc["kc_name"]
            kc_id     = kc["kc_id"]
            ch_info   = kc["chapter_info"]
            n_easy    = kc["need_easy"]
            n_medium  = kc["need_medium"]
            n_hard    = kc["need_hard"]
            n_total   = n_easy + n_medium + n_hard

            # Get SGK content
            sgk_section = extract_sgk_section(ch_info, sgk_by_tap, grade=GRADE)
            if not sgk_section:
                sgk_section = f"[SGK không tìm thấy cho {ch_info}. Hãy tạo dựa trên tên node: {name}]"

            prompt = build_prompt(name, sgk_section, n_easy, n_medium, n_hard)

            print(f"  [{idx:>2}/{len(all_needs)}] {code}")
            print(f"         Need: {n_easy} Dễ + {n_medium} TB + {n_hard} Khó = {n_total} questions")

            # Call Gemini
            try:
                raw = await _call_gemini(prompt, kc_code=code)
            except Exception as e:
                errors += 1
                print(f"         ❌ Gemini error: {e}\n")
                await asyncio.sleep(RATE_LIMIT_S)
                continue

            if "[MISMATCH DETECTED" in raw[:300]:
                errors += 1
                print(f"         ❌ Mismatch detected — skip\n")
                await asyncio.sleep(RATE_LIMIT_S)
                continue

            # Parse all questions from response
            parsed = _parse_ai_response(raw)
            if not parsed:
                errors += 1
                print(f"         ❌ Parse failed\n")
                await asyncio.sleep(RATE_LIMIT_S)
                continue

            # Filter: only keep questions of the needed difficulty tiers
            needed_diffs = set()
            if n_easy   > 0: needed_diffs.add("easy")
            if n_medium > 0: needed_diffs.add("medium")
            if n_hard   > 0: needed_diffs.add("hard")

            # Count per difficulty and cap at what's needed
            saved_per_diff = {"easy": 0, "medium": 0, "hard": 0}
            need_per_diff  = {"easy": n_easy, "medium": n_medium, "hard": n_hard}
            saved_this_kc  = 0

            for q in parsed:
                diff = q.get("difficulty_label", "medium")
                if diff not in needed_diffs:
                    continue  # skip wrong difficulty
                if saved_per_diff[diff] >= need_per_diff[diff]:
                    continue  # already have enough of this tier

                draft = ItemDraft(
                    kc_id=uuid.UUID(kc_id),
                    kc_name=name,
                    kc_code=code,
                    content={
                        "question": q["question_text"],
                        "answers":  q["answers"],
                    },
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

            # Report
            saved_str = f"easy={saved_per_diff['easy']}, medium={saved_per_diff['medium']}, hard={saved_per_diff['hard']}"
            missing = {d: need_per_diff[d] - saved_per_diff[d] for d in needed_diffs if saved_per_diff[d] < need_per_diff[d]}

            if saved_this_kc > 0:
                generated += 1
                total_saved += saved_this_kc
                print(f"         ✅ Saved {saved_this_kc}: {saved_str}")
            else:
                errors += 1
                print(f"         ❌ No usable questions of required difficulty")

            if missing:
                print(f"         ⚠️  Still missing: {missing}")
            print()

            await asyncio.sleep(RATE_LIMIT_S)

    print(f"\n{'='*65}")
    print(f"  ✅ KCs successfully topped up : {generated}")
    print(f"  ❌ KCs with errors            : {errors}")
    print(f"  📝 Total new drafts saved     : {total_saved}")
    print(f"{'='*65}\n")


asyncio.run(main())
