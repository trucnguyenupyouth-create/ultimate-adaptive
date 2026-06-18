"""
Question Generation Service — AI-powered MCQ Seeder

Pipeline:
  1. Query all KCs that have at least 1 prerequisite edge in DB
  2. For each KC, extract the matching SGK section from chapter_info (e.g. "B1K1")
  3. Call OpenAI gpt-4o-mini with the structured prompt + SGK content
  4. Parse the 6-question response into structured dicts
  5. Save as ItemDraft rows (status='pending') for human review

Design principles:
  - Sequential generation with rate limiting (avoid OpenAI quota bursts)
  - Skip KCs already having >= 6 active items
  - Raw AI output stored for debugging / re-parsing
  - SGK content capped at ~4000 chars to stay within prompt budget
  - Per-call token usage tracked → cumulative USD cost in _COST_LEDGER

OpenAI gpt-4o-mini pricing (as of mid-2025):
  Input:  $0.150 / 1M tokens
  Output: $0.600 / 1M tokens
"""

from __future__ import annotations

import asyncio
import re
import uuid
from datetime import datetime, timezone
from pathlib import Path
from typing import Optional

from sqlalchemy import select, func, text
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.models import KnowledgeComponent, KCPrerequisite, Item, ItemDraft
from app.core.config import settings

# Paths to SGK markdown files — Grade 6
SGK_KI1_PATH = Path(__file__).parent.parent.parent.parent / "docs" / "toan-6-tap-1-ly-thuyet.md"
SGK_KI2_PATH = Path(__file__).parent.parent.parent.parent / "docs" / "toan-6-tap-2-ly-thuyet.md"

# Paths to SGK markdown files — Grade 7 (standardized naming: toan-7-tap-N-ly-thuyet.md)
# Tập 1: Bài 1–19 (Kì 1), Tập 2: Bài 20–37 (Kì 2)
SGK_G7_TAP1_PATH = Path(__file__).parent.parent.parent.parent / "docs" / "toan-7-tap-1-ly-thuyet.md"
SGK_G7_TAP2_PATH = Path(__file__).parent.parent.parent.parent / "docs" / "toan-7-tap-2-ly-thuyet.md"

# Hardcoded master prompt (translated from user specification)
MASTER_PROMPT = """# VAI TRÒ VÀ BỐI CẢNH HỆ THỐNG
Bạn là một Chuyên gia Giáo dục Toán học (Math SME), Kỹ sư Đo lường Tâm lý (Psychometrician), và Kiến trúc sư Nội dung EdTech (EdTech Content Architect).
Nhiệm vụ của bạn là thiết kế ngân hàng 6 câu hỏi Trắc nghiệm khách quan (MCQ - 4 đáp án) cho một Node kiến thức Toán THCS dựa trên nội dung Sách giáo khoa được cung cấp.

Hệ thống Adaptive Learning của chúng tôi sử dụng kiến trúc lai:
1. KST (Knowledge Space Theory): Rẽ nhánh và dò lỗ hổng dựa trên kết quả 1/0.
2. IRT (Item Response Theory): Đo lường năng lực (θ) và tinh chỉnh độ khó (ω).
3. BKT (Bayesian Knowledge Tracing): Đo lường sự tinh thông (Mastery) và tracking các tham số đoán mò (Guess), bất cẩn (Slip).

# 3 NGUYÊN TẮC THIẾT KẾ BẤT DI BẤT DỊCH (SỐNG CÒN)
1. VÔ HIỆU HÓA MÁY TÍNH (Anti-Brute Force): Tuyệt đối KHÔNG yêu cầu tính ra đáp số cuối cùng của một phép tính cồng kềnh. Bắt buộc hỏi vào: Quy trình, Cấu trúc, Bước trung gian, Khái quát hóa đại số (ẩn a, b, x, y), hoặc Đọc hiểu ký hiệu. Mục tiêu là triệt tiêu xác suất đoán mò P(G).
2. ĐÁP ÁN NHIỄU CÓ CHỦ ĐÍCH (Distractor-Driven Diagnosis): 3 đáp án sai KHÔNG được là các con số ngẫu nhiên. MỖI đáp án sai BẮT BUỘC phải đại diện cho một "Cạm bẫy nhận thức" (Misconception) cụ thể (Ví dụ: nhầm dấu, nhầm từ vựng, đảo chiều vị trí, ảo giác phép tính, quên điều kiện biên b≠0).
3. ĐỊNH DẠNG THUẦN UNICODE (Pure Text): Trình bày text thuần túy. KHÔNG sử dụng mã LaTeX (như \\frac, $$, \\geq) hay Markdown định dạng bên trong nội dung câu hỏi. Bắt buộc dùng các ký tự Unicode toán học chuẩn (Ví dụ: ², ³, ·, ×, ÷, ≥, ≤, ≠, ∈, ℕ) để tôi copy trực tiếp vào Database không bị lỗi.

# CẤU TRÚC 6 CÂU HỎI (PHÂN LỚP THEO THUẬT TOÁN)
Dựa vào SGK, hãy sinh ra chính xác 6 câu hỏi theo cấu trúc sau:

[LỚP 1] Mức độ Trung bình (ω = 0) - Số lượng: 2 Câu.
- Vai trò: ENTRY POINT (Mỏ neo chẩn đoán). Dùng làm câu chạm đầu tiên khi Cold-start.
- Yêu cầu: Trực diện vào định nghĩa/quy tắc cốt lõi, tinh khiết 100%, tư duy đơn bước (Single-step), không gài bẫy lắt léo để giảm P(Slip). Ràng buộc tag: [is_diagnostic_anchor = TRUE].

[LỚP 2] Mức độ Dễ (ω < 0) - Số lượng: 2 Câu.
- Vai trò: PREREQUISITE CHECK (Dò lỗ hổng KST).
- Yêu cầu: Dùng để chẩn đoán khi học sinh làm sai Lớp 1. Bóc tách quy trình thành bước nhỏ nhất, hỏi về từ vựng, hoặc test các trường hợp biên dễ nhất.

[LỚP 3] Mức độ Khó (ω > 0) - Số lượng: 2 Câu.
- Vai trò: RANK BOOSTER & MASTERY (Nâng hạng θ).
- Yêu cầu: Kéo hạng năng lực và xác nhận Tinh thông. KHÔNG làm khó bằng tính toán số to. Đòi hỏi tư duy trừu tượng (ẩn số đa biến), tính chất bắc cầu, hoặc "Phân tích Meta-cognition" (Đưa ra lời giải sai của một học sinh ảo và yêu cầu phân tích vì sao sai).

# ĐỊNH DẠNG ĐẦU RA (Cho từng câu hỏi)
Trình bày chính xác theo template sau:

**Câu [X] (Mức độ [Dễ/TB/Khó] - Vai trò: [Entry Point / Dò lỗ hổng / Nâng hạng θ]):**
[Nội dung câu hỏi thuần Unicode]
A. [Đáp án A]
B. [Đáp án B]
C. [Đáp án C]
D. [Đáp án D]
*Đáp án: [A/B/C/D]*
*(Tag thuật toán KST/IRT: Viết 2-3 câu phân tích: Câu này vô hiệu hóa máy tính bằng cách nào? Các đáp án sai gài bẫy Lỗi nhận thức gì? Nếu học sinh chọn sai thì hệ thống nên chẩn đoán lỗ hổng nằm ở đâu để rẽ nhánh?)*

=================================
# KIỂM TRA TÍNH NHẤT QUÁN (BẮT BUỘC — ƯU TIÊN CAO NHẤT)
Trước khi tạo bất kỳ câu hỏi nào, hãy đọc kỹ tên Node và nội dung SGK được cung cấp.
Nếu chủ đề của nội dung SGK KHÔNG LIÊN QUAN đến tên Node (ví dụ: tên Node nói về Hình học nhưng SGK cung cấp nội dung về Số học, hoặc ngược lại), hãy BẮT ĐẦU output bằng ĐÚNG dòng sau và DỪNG NGAY:
  [MISMATCH DETECTED: Nội dung SGK không khớp với node. Từ chối tạo câu hỏi.]
Không tạo bất kỳ câu hỏi nào khi phát hiện mismatch. Chỉ tiếp tục khi SGK thực sự liên quan đến node.

=================================
# ĐẦU VÀO DỮ LIỆU CỦA PHIÊN LÀM VIỆC:
- Tên Node kiến thức (Target KC): {kc_name}
- Nội dung SGK: {sgk_content}
Hãy bắt đầu phân tích và tạo ngân hàng câu hỏi."""


# ─────────────────────────────────────────────────────────────────────────────
# SGK Content Extraction
# ─────────────────────────────────────────────────────────────────────────────

def _load_sgk_for_grade(grade: int) -> dict[int, str]:
    """
    Load SGK content taps for the given grade.
    Returns a dict: { 1: "<tap-1-text>", 2: "<tap-2-text>" }
    Missing files return empty strings.

    Grade 6: tap 1 = Kì 1 (B1–B16), tap 2 = Kì 2 (B17–B26)
    Grade 7: tap 1 = Bài 1–19 (Kì 1), tap 2 = Bài 20–37 (Kì 2 chapters)
    """
    paths: list[tuple[int, Path]] = []
    if grade == 6:
        paths = [(1, SGK_KI1_PATH), (2, SGK_KI2_PATH)]
    elif grade == 7:
        paths = [(1, SGK_G7_TAP1_PATH), (2, SGK_G7_TAP2_PATH)]
    else:
        return {}

    result: dict[int, str] = {}
    for tap, path in paths:
        try:
            result[tap] = path.read_text(encoding="utf-8")
        except FileNotFoundError:
            result[tap] = ""
    return result


def _parse_bai_ki(chapter_info: Optional[str]) -> tuple[Optional[int], Optional[int]]:
    """Parse 'B{n}K{k}' → (bai_num, ki_num). Returns (None, None) on failure."""
    if not chapter_info:
        return None, None
    match = re.match(r"[Bb](\d+)[Kk](\d+)", chapter_info.strip())
    if not match:
        return None, None
    return int(match.group(1)), int(match.group(2))


def extract_sgk_section(
    chapter_info: Optional[str],
    sgk_by_tap: dict[int, str],
    grade: int = 6,
) -> str:
    """
    Parse chapter_info like "B1K1" or "B23K2" → extract the matching
    Bài section from the appropriate SGK tap (volume).

    Tap selection logic:
    - Grade 6: tap = ki_num (B..K1 → tap 1, B..K2 → tap 2)
    - Grade 7: tap = 1 if bai_num <= 19 else 2 (Tập 1 covers Bài 1–19)

    Returns the section text (capped at 4000 chars for prompt budget).
    Falls back gracefully if chapter_info is None/unparseable, file not
    loaded, or section header not found.
    """
    if not chapter_info:
        return ""

    bai_num, ki_num = _parse_bai_ki(chapter_info)
    if bai_num is None:
        return ""

    # Select the correct tap based on grade
    if grade == 7:
        tap = 1 if bai_num <= 19 else 2
    else:  # grade 6 (and default)
        tap = ki_num if ki_num else 1

    sgk_text = sgk_by_tap.get(tap, "")
    if not sgk_text:
        return f"[SGK Lớp {grade} Tập {tap} chưa được tải. Không thể tạo câu hỏi.]"

    # Find "## Bài {n}." or "## Bài {n} " in the markdown
    start_match = re.search(rf"## Bài {bai_num}[.:]", sgk_text)
    if not start_match:
        start_match = re.search(rf"## Bài {bai_num}\s", sgk_text)
    if not start_match:
        return ""

    start_pos = start_match.start()

    # Find next section boundary
    next_patterns = [
        rf"## Bài {bai_num + 1}[.:\ ]",
        r"# CHƯƠNG",
        r"---\s*\n# ",
    ]
    end_pos = len(sgk_text)
    for pattern in next_patterns:
        nm = re.search(pattern, sgk_text[start_pos + 1:])
        if nm:
            candidate = start_pos + 1 + nm.start()
            if candidate < end_pos:
                end_pos = candidate

    section = sgk_text[start_pos:end_pos].strip()

    # Cap at 4000 chars for prompt budget
    if len(section) > 4000:
        section = section[:4000] + "\n[...nội dung bị cắt bớt...]"

    return section


def chapter_info_matches_semester(
    chapter_info: Optional[str],
    target_semester: int,
    grade: int,
) -> bool:
    """
    Return True if the KC's chapter_info belongs to target_semester for the given grade.

    Grade 6: semester determined by ki_num in 'B{n}K{k}'
    Grade 7: semester 1 = Bài 1–19 (Tập 1), semester 2 = Bài 20+ (Tập 2)
             KCs with bài ≥ 20 labelled K1 are treated as potentially erroneous
             and are EXCLUDED from generation (not matched to either semester).
    """
    bai_num, ki_num = _parse_bai_ki(chapter_info)
    if bai_num is None:
        return False

    if grade == 7:
        if target_semester == 1:
            # Only Bài 1–19 are firmly in Tập 1 / Kì 1
            return bai_num <= 19
        else:  # semester 2
            return bai_num >= 20
    else:  # grade 6
        return ki_num == target_semester


# ─────────────────────────────────────────────────────────────────────────────
# OpenAI API Call + Cost Tracking
# ─────────────────────────────────────────────────────────────────────────────

# gemini-3-flash-preview pricing (USD per 1M tokens)
_PRICE_INPUT_PER_1M  = 0.500   # $0.50 / 1M input tokens
_PRICE_OUTPUT_PER_1M = 3.000   # $3.00 / 1M output tokens
GEMINI_MODEL = "gemini-3-flash-preview"

# In-memory cost ledger — resets on server restart
# Each entry: { kc_code, input_tokens, output_tokens, cost_usd, created_at }
_COST_LEDGER: list[dict] = []

# Cached Gemini client — created once, reused across all calls
_gemini_client = None

def _get_gemini_client():
    """Return a cached Gemini client, initializing on first call."""
    global _gemini_client
    if _gemini_client is None:
        from google import genai
        if not settings.GEMINI_API_KEY:
            raise ValueError("GEMINI_API_KEY not set in .env")
        _gemini_client = genai.Client(api_key=settings.GEMINI_API_KEY)
    return _gemini_client


def _record_cost(kc_code: str, input_tokens: int, output_tokens: int) -> float:
    """Append a cost entry and return the USD amount for this call."""
    cost = (
        input_tokens  / 1_000_000 * _PRICE_INPUT_PER_1M +
        output_tokens / 1_000_000 * _PRICE_OUTPUT_PER_1M
    )
    _COST_LEDGER.append({
        "kc_code":       kc_code,
        "input_tokens":  input_tokens,
        "output_tokens": output_tokens,
        "cost_usd":      round(cost, 6),
        "created_at":    datetime.now(timezone.utc).isoformat(),
    })
    return cost


def get_cost_summary() -> dict:
    """Return aggregate cost stats from the in-memory ledger."""
    if not _COST_LEDGER:
        return {
            "calls":               0,
            "total_input_tokens":  0,
            "total_output_tokens": 0,
            "total_cost_usd":      0.0,
            "model":               GEMINI_MODEL,
            "price_input_per_1m":  _PRICE_INPUT_PER_1M,
            "price_output_per_1m": _PRICE_OUTPUT_PER_1M,
            "entries":             [],
        }
    return {
        "calls":               len(_COST_LEDGER),
        "total_input_tokens":  sum(e["input_tokens"]  for e in _COST_LEDGER),
        "total_output_tokens": sum(e["output_tokens"] for e in _COST_LEDGER),
        "total_cost_usd":      round(sum(e["cost_usd"] for e in _COST_LEDGER), 6),
        "model":               GEMINI_MODEL,
        "price_input_per_1m":  _PRICE_INPUT_PER_1M,
        "price_output_per_1m": _PRICE_OUTPUT_PER_1M,
        "entries":             list(_COST_LEDGER),
    }


async def _call_gemini(prompt: str, kc_code: str = "") -> str:
    """
    Call Gemini gemini-3-flash-preview via google.genai SDK and return raw text.
    Automatically records token usage to _COST_LEDGER.
    """
    from google.genai import types as genai_types

    client = _get_gemini_client()

    system_prompt = (
        "Bạn là chuyên gia thiết kế câu hỏi MCQ cho hệ thống Adaptive Learning. "
        "Tuân thủ chính xác định dạng đầu ra được yêu cầu."
    )

    loop = asyncio.get_event_loop()
    response = await loop.run_in_executor(
        None,
        lambda: client.models.generate_content(
            model=GEMINI_MODEL,
            contents=prompt,
            config=genai_types.GenerateContentConfig(
                system_instruction=system_prompt,
                temperature=0.7,
                max_output_tokens=2048,  # 6 MCQs fit well within 2048
            ),
        ),
    )

    # Record token usage
    usage = getattr(response, "usage_metadata", None)
    if usage:
        _record_cost(
            kc_code=kc_code,
            input_tokens=getattr(usage, "prompt_token_count", 0) or 0,
            output_tokens=getattr(usage, "candidates_token_count", 0) or 0,
        )
    else:
        _record_cost(kc_code=kc_code, input_tokens=1500, output_tokens=800)

    return response.text


# ─────────────────────────────────────────────────────────────────────────────
# Response Parser
# ─────────────────────────────────────────────────────────────────────────────

# Difficulty label mapping from AI output
_DIFFICULTY_MAP = {
    "dễ": "easy",
    "de": "easy",
    "tb": "medium",
    "trung bình": "medium",
    "khó": "hard",
    "kho": "hard",
}

def _normalize_difficulty(raw: str) -> str:
    """Normalize AI difficulty string to easy|medium|hard."""
    raw_lower = raw.lower().strip()
    for k, v in _DIFFICULTY_MAP.items():
        if k in raw_lower:
            return v
    return "medium"  # safe default


def _parse_ai_response(raw_text: str) -> list[dict]:  # noqa: C901
    """
    Parse OpenAI response into a list of structured question dicts.

    Expected format per question:
        **Câu X (Mức độ [Dễ/TB/Khó] - Vai trò: [...]):**
        [question text]
        A. [text]
        B. [text]
        C. [text]
        D. [text]
        *Đáp án: [A/B/C/D]*
        *(Tag thuật toán KST/IRT: ...)*

    Returns list of dicts:
    {
        "question_text": str,
        "answers": [{"label": "A", "text": str, "is_correct": bool}, ...],
        "difficulty_label": "easy"|"medium"|"hard",
        "is_diagnostic_anchor": bool,
        "kst_irt_tag": str,
        "raw_block": str,
    }
    """
    questions = []

    # Detect mismatch guard response from the AI
    stripped = raw_text.strip()
    if stripped.startswith("[MISMATCH DETECTED") or "[MISMATCH DETECTED" in stripped[:200]:
        return []  # Caller should treat this as status="mismatch"

    # Split by question header: **Câu N (...):**
    # We use a broad pattern to handle formatting variations
    question_blocks = re.split(
        r"\*\*Câu\s+\d+\s*\([^)]+\)\s*:\*\*",
        raw_text,
        flags=re.IGNORECASE,
    )

    # Also capture the headers to extract difficulty
    headers = re.findall(
        r"\*\*Câu\s+(\d+)\s*\(([^)]+)\)\s*:\*\*",
        raw_text,
        flags=re.IGNORECASE,
    )

    # question_blocks[0] is text before "Câu 1", skip it
    blocks = question_blocks[1:]  # align with headers

    for i, (header_match, block) in enumerate(zip(headers, blocks)):
        try:
            header_text = header_match[1]  # e.g. "Mức độ TB - Vai trò: Entry Point"
            block = block.strip()

            # ── Extract difficulty ──
            difficulty_raw = ""
            diff_match = re.search(r"Mức\s+độ\s+([^\-–]+)", header_text, re.IGNORECASE)
            if diff_match:
                difficulty_raw = diff_match.group(1).strip()
            difficulty = _normalize_difficulty(difficulty_raw)

            # ── Is diagnostic anchor? (Lớp 1 / TB / Entry Point) ──
            is_anchor = (
                "entry point" in header_text.lower()
                or "tb" in difficulty_raw.lower()
                or "trung bình" in difficulty_raw.lower()
            )

            # ── Extract answer choices ──
            answer_matches = re.findall(
                r"^([A-D])\.\s*(.+)$",
                block,
                re.MULTILINE,
            )

            # ── Extract correct answer ──
            correct_match = re.search(
                r"\*Đáp\s+án\s*:\s*([A-D])\*",
                block,
                re.IGNORECASE,
            )
            correct_label = correct_match.group(1).upper() if correct_match else "A"

            # ── Extract KST/IRT tag ──
            tag_match = re.search(
                r"\*\(Tag\s+thuật\s+toán[^:]*:\s*(.*?)\)\*",
                block,
                re.IGNORECASE | re.DOTALL,
            )
            kst_tag = tag_match.group(1).strip() if tag_match else ""

            # ── Extract question text (lines before "A.") ──
            answer_section_start = block.find("A.")
            if answer_section_start == -1:
                # No answers found — skip
                continue
            question_text = block[:answer_section_start].strip()

            # Remove the *Đáp án:* and *(Tag...)* lines from question_text if any leaked
            question_text = re.sub(r"\*Đáp\s+án.*", "", question_text, flags=re.IGNORECASE).strip()

            if not question_text or not answer_matches:
                continue

            answers = []
            for label, text_raw in answer_matches:
                # Clean up text — remove trailing *Đáp án:* if it leaked
                clean_text = re.sub(r"\s*\*Đáp\s+án.*$", "", text_raw, flags=re.IGNORECASE).strip()
                answers.append({
                    "label": label,
                    "text": clean_text,
                    "is_correct": (label == correct_label),
                })

            if len(answers) < 2:
                continue

            questions.append({
                "question_text": question_text,
                "answers": answers,
                "difficulty_label": difficulty,
                "is_diagnostic_anchor": is_anchor,
                "kst_irt_tag": kst_tag,
                "raw_block": block,
            })

        except Exception:
            # Parsing error for one block → skip, don't crash the whole batch
            continue

    return questions


# ─────────────────────────────────────────────────────────────────────────────
# DB Queries
# ─────────────────────────────────────────────────────────────────────────────

async def get_kcs_with_edges(db: AsyncSession) -> list[dict]:
    """
    Return all KCs that have at least 1 edge (either as kc_id or prereq_id).
    These are the nodes that are properly situated in the knowledge space.
    """
    result = await db.execute(text("""
        SELECT DISTINCT kc.id, kc.code, kc.name, kc.grade, kc.chapter_info
        FROM knowledge_components kc
        WHERE EXISTS (
            SELECT 1 FROM kc_prerequisites e
            WHERE e.kc_id = kc.id OR e.prereq_id = kc.id
        )
        ORDER BY kc.code
    """))
    return [
        {
            "id": str(row.id),
            "code": row.code,
            "name": row.name,
            "grade": row.grade,
            "chapter_info": row.chapter_info,
        }
        for row in result.fetchall()
    ]


async def count_active_items(db: AsyncSession, kc_id: str) -> int:
    """Return the number of active items for a KC."""
    result = await db.execute(
        select(func.count()).select_from(Item).where(
            Item.kc_id == uuid.UUID(kc_id),
            Item.is_active == True,
        )
    )
    return result.scalar() or 0


async def count_pending_drafts(db: AsyncSession, kc_id: str) -> int:
    """Return the number of pending drafts for a KC."""
    result = await db.execute(
        select(func.count()).select_from(ItemDraft).where(
            ItemDraft.kc_id == uuid.UUID(kc_id),
            ItemDraft.status == "pending",
        )
    )
    return result.scalar() or 0


# ─────────────────────────────────────────────────────────────────────────────
# Core Generation Pipeline
# ─────────────────────────────────────────────────────────────────────────────

async def generate_for_kc(
    db: AsyncSession,
    kc: dict,
    sgk_by_tap: dict[int, str],
    job_id: uuid.UUID,
    skip_threshold: int = 6,
    grade: int = 6,
) -> dict:
    """
    Generate 6 MCQ drafts for a single KC.

    Returns:
        { "status": "skipped"|"generated"|"mismatch"|"error", "count": int, "reason": str }
    """
    kc_id = kc["id"]
    kc_name = kc["name"]
    kc_code = kc["code"]
    chapter_info = kc.get("chapter_info", "")

    # ── Skip if already has enough active items ──
    active_count = await count_active_items(db, kc_id)
    if active_count >= skip_threshold:
        return {
            "status": "skipped",
            "count": 0,
            "reason": f"Already has {active_count} active items",
        }

    # ── Skip if already has pending drafts from this job ──
    pending_count = await count_pending_drafts(db, kc_id)
    if pending_count >= 6:
        return {
            "status": "skipped",
            "count": 0,
            "reason": f"Already has {pending_count} pending drafts",
        }

    # ── Extract SGK section ──
    sgk_section = extract_sgk_section(chapter_info, sgk_by_tap, grade=grade)
    if not sgk_section:
        sgk_section = f"[Không tìm thấy nội dung SGK cho {chapter_info}. Hãy tạo câu hỏi dựa trên tên node: {kc_name}]"

    # ── Build prompt ──
    prompt = MASTER_PROMPT.format(
        kc_name=kc_name,
        sgk_content=sgk_section,
    )

    # ── Call Gemini ──
    try:
        raw_output = await _call_gemini(prompt, kc_code=kc_code)
    except Exception as e:
        return {
            "status": "error",
            "count": 0,
            "reason": f"Gemini API error: {str(e)}",
        }

    # ── Parse response ──
    parsed = _parse_ai_response(raw_output)
    if not parsed:
        # Distinguish mismatch guard vs genuine parse failure
        if "[MISMATCH DETECTED" in raw_output[:300]:
            return {
                "status": "mismatch",
                "count": 0,
                "reason": f"AI detected SGK/node mismatch for chapter_info={chapter_info!r}",
            }
        return {
            "status": "error",
            "count": 0,
            "reason": "Failed to parse any questions from AI response",
        }

    # ── Save drafts to DB ──
    saved = 0
    for q in parsed:
        draft = ItemDraft(
            kc_id=uuid.UUID(kc_id),
            kc_name=kc_name,
            kc_code=kc_code,
            content={
                "question": q["question_text"],
                "answers": q["answers"],
            },
            difficulty_label=q["difficulty_label"],
            is_diagnostic_anchor=q["is_diagnostic_anchor"],
            kst_irt_tag=q["kst_irt_tag"],
            generation_job_id=job_id,
            sgk_section=chapter_info or "",
            raw_ai_output=raw_output if saved == 0 else None,  # store once per KC
            status="pending",
        )
        db.add(draft)
        saved += 1

    await db.commit()

    # Return cost info for this KC
    last_entry = _COST_LEDGER[-1] if _COST_LEDGER else {}
    return {
        "status":        "generated",
        "count":         saved,
        "reason":        f"Generated {saved} drafts from {len(parsed)} parsed questions",
        "input_tokens":  last_entry.get("input_tokens", 0),
        "output_tokens": last_entry.get("output_tokens", 0),
        "cost_usd":      last_entry.get("cost_usd", 0.0),
    }


async def run_generation_job(
    db: AsyncSession,
    skip_threshold: int = 6,
    rate_limit_seconds: float = 0.5,
    progress_callback=None,
    target_grade: int = 6,
    target_semester: int = 1,
) -> dict:
    """
    Main orchestrator: run generation for all KCs with edges.

    Args:
        db: AsyncSession
        skip_threshold: skip KC if it already has this many active items
        rate_limit_seconds: wait between Gemini API calls
        progress_callback: optional async callable(kc_code, result) for streaming
        target_grade: which grade to generate for (default: 6)
        target_semester: which semester/kì to generate for (default: 1)

    Returns:
        { job_id, total, generated, skipped, errors, cost_usd, details }
    """
    job_id = uuid.uuid4()
    # Load SGK content for the target grade
    sgk_by_tap = _load_sgk_for_grade(target_grade)
    all_kcs = await get_kcs_with_edges(db)

    # Filter by target grade + semester using helper
    kcs = [
        kc for kc in all_kcs
        if kc.get("grade") == target_grade
        and chapter_info_matches_semester(
            kc.get("chapter_info"), target_semester, target_grade
        )
    ]
                
    job_start_ledger_len = len(_COST_LEDGER)

    summary = {
        "job_id":    str(job_id),
        "total":     len(kcs),
        "generated": 0,
        "skipped":   0,
        "errors":    0,
        "cost_usd":  0.0,
        "details":   [],
    }

    for kc in kcs:
        result = await generate_for_kc(
            db=db,
            kc=kc,
            sgk_by_tap=sgk_by_tap,
            job_id=job_id,
            skip_threshold=skip_threshold,
            grade=target_grade,
        )

        detail = {
            "kc_id": kc["id"],
            "kc_code": kc["code"],
            "kc_name": kc["name"],
            **result,
        }
        summary["details"].append(detail)

        if result["status"] == "generated":
            summary["generated"] += 1
        elif result["status"] == "skipped":
            summary["skipped"] += 1
        elif result["status"] == "mismatch":
            summary["errors"] += 1  # count mismatch as error to surface it
        else:
            summary["errors"] += 1

        if progress_callback:
            await progress_callback(kc["code"], result)

        # Rate limiting — avoid OpenAI quota bursts
        if result["status"] == "generated":
            await asyncio.sleep(rate_limit_seconds)

    # Tally cost for this job's calls
    job_entries = _COST_LEDGER[job_start_ledger_len:]
    summary["cost_usd"] = round(sum(e["cost_usd"] for e in job_entries), 6)
    return summary


# ─────────────────────────────────────────────────────────────────────────────
# Draft CRUD (used by API routes)
# ─────────────────────────────────────────────────────────────────────────────

async def get_drafts(
    db: AsyncSession,
    kc_id: Optional[str] = None,
    status: Optional[str] = None,
    limit: int = 200,
    offset: int = 0,
) -> list[dict]:
    """List drafts with optional filters."""
    stmt = select(ItemDraft).order_by(ItemDraft.created_at.asc())
    if kc_id:
        stmt = stmt.where(ItemDraft.kc_id == uuid.UUID(kc_id))
    if status:
        stmt = stmt.where(ItemDraft.status == status)
    stmt = stmt.limit(limit).offset(offset)

    result = await db.execute(stmt)
    drafts = result.scalars().all()
    return [_draft_to_dict(d) for d in drafts]


async def get_draft(db: AsyncSession, draft_id: str) -> Optional[dict]:
    """Get a single draft by ID."""
    draft = await db.get(ItemDraft, uuid.UUID(draft_id))
    if not draft:
        return None
    return _draft_to_dict(draft)


async def update_draft(
    db: AsyncSession,
    draft_id: str,
    content: Optional[dict] = None,
    difficulty_label: Optional[str] = None,
    kst_irt_tag: Optional[str] = None,
    status: Optional[str] = None,
) -> Optional[dict]:
    """Update draft fields (human edits).

    If the draft was already approved and has an imported_item_id,
    the linked Item record is also updated so the item bank stays in sync.
    Status is promoted to 'edited_approved' to signal a post-approval revision.
    """
    from app.models.models import Item

    draft = await db.get(ItemDraft, uuid.UUID(draft_id))
    if not draft:
        return None

    if content is not None:
        draft.content = content
    if difficulty_label is not None:
        draft.difficulty_label = difficulty_label
    if kst_irt_tag is not None:
        draft.kst_irt_tag = kst_irt_tag
    if status is not None:
        draft.status = status

    # ── Sync Item record when post-approval edit ──────────────────────────
    is_post_approval = draft.status in ("approved", "edited_approved") and draft.imported_item_id
    if is_post_approval and (content is not None or difficulty_label is not None):
        item = await db.get(Item, draft.imported_item_id)
        if item:
            if content is not None:
                item.content = content
            if difficulty_label is not None:
                item.difficulty_label = difficulty_label
        # Promote status so reviewers know this was revised after approval
        draft.status = "edited_approved"

    await db.commit()
    await db.refresh(draft)
    return _draft_to_dict(draft)



async def approve_draft(db: AsyncSession, draft_id: str) -> dict:
    """
    Approve a draft: create an Item from it, mark draft as approved.
    Returns { ok, item_id, draft_id }
    """
    from app.services.graph_service import create_item

    draft = await db.get(ItemDraft, uuid.UUID(draft_id))
    if not draft:
        raise ValueError(f"Draft {draft_id} not found")
    if draft.status not in ("pending", "edited_approved", "rejected"):
        raise ValueError(f"Draft is already {draft.status}")

    # Create the item
    item_data = await create_item(
        db=db,
        kc_id=str(draft.kc_id),
        difficulty_label=draft.difficulty_label,
        format_type="mcq",
        content=draft.content,
    )

    # Mark draft as approved
    draft.status = "approved"
    draft.imported_item_id = uuid.UUID(item_data["id"])
    draft.reviewed_at = datetime.now(timezone.utc)
    await db.commit()

    # Set diagnostic anchor if needed
    if draft.is_diagnostic_anchor:
        from app.services.graph_service import toggle_anchor
        try:
            await toggle_anchor(db, item_id=item_data["id"], is_anchor=True)
        except Exception:
            pass  # non-critical

    return {
        "ok": True,
        "item_id": item_data["id"],
        "draft_id": draft_id,
    }


async def reject_draft(db: AsyncSession, draft_id: str) -> dict:
    """
    Mark a draft as rejected (non-destructive — draft stays in DB).
    A rejected draft can be approved again at any time.
    """
    draft = await db.get(ItemDraft, uuid.UUID(draft_id))
    if not draft:
        raise ValueError(f"Draft {draft_id} not found")
    if draft.status in ("approved", "edited_approved"):
        raise ValueError("Cannot reject an already-approved draft. Undo the approval first.")
    draft.status = "rejected"
    draft.reviewed_at = datetime.now(timezone.utc)
    await db.commit()
    return {"ok": True, "draft_id": draft_id}


async def revert_draft(db: AsyncSession, draft_id: str) -> dict:
    """
    Undo an approve decision: delete the imported Item and reset draft to 'pending'.
    For rejected drafts: just resets to 'pending' (no Item to delete).
    After reverting, the draft can be approved or rejected again.
    """
    from app.models.models import Item

    draft = await db.get(ItemDraft, uuid.UUID(draft_id))
    if not draft:
        raise ValueError(f"Draft {draft_id} not found")
    if draft.status == "pending":
        raise ValueError("Draft is already pending — nothing to undo")

    previous_status = draft.status
    item_deleted = False

    # If approved: delete the imported Item from items table
    if draft.status in ("approved", "edited_approved") and draft.imported_item_id:
        # Delete item_edit_log rows first to avoid FK violation
        await db.execute(
            text("DELETE FROM item_edit_log WHERE item_id = :item_id"),
            {"item_id": draft.imported_item_id},
        )
        item = await db.get(Item, draft.imported_item_id)
        if item:
            await db.delete(item)
            item_deleted = True
        draft.imported_item_id = None

    # Reset to pending so reviewer can decide again
    draft.status = "pending"
    draft.reviewed_at = None
    await db.commit()

    return {
        "ok": True,
        "draft_id": draft_id,
        "previous_status": previous_status,
        "item_deleted": item_deleted,
    }




async def get_draft_stats(db: AsyncSession) -> dict:
    """Return summary stats grouped by KC and status."""
    result = await db.execute(text("""
        SELECT
            d.kc_id::text AS kc_id,
            d.kc_name,
            d.kc_code,
            kc.grade,
            kc.chapter_info,
            COUNT(*) FILTER (WHERE d.status = 'pending') AS pending,
            COUNT(*) FILTER (WHERE d.status = 'approved') AS approved,
            COUNT(*) FILTER (WHERE d.status = 'rejected') AS rejected,
            COUNT(*) FILTER (WHERE d.status = 'edited_approved') AS edited_approved,
            COUNT(*) AS total
        FROM item_drafts d
        LEFT JOIN knowledge_components kc ON d.kc_id = kc.id
        GROUP BY d.kc_id, d.kc_name, d.kc_code, kc.grade, kc.chapter_info
        ORDER BY d.kc_code
    """))
    rows = result.fetchall()
    return {
        "kcs": [
            {
                "kc_id": row.kc_id,
                "kc_name": row.kc_name,
                "kc_code": row.kc_code,
                "grade": row.grade,
                "chapter_info": row.chapter_info,
                "pending": row.pending,
                "approved": row.approved,
                "rejected": row.rejected,
                "edited_approved": row.edited_approved,
                "total": row.total,
            }
            for row in rows
        ],
        "totals": {
            "pending": sum(r.pending for r in rows),
            "approved": sum(r.approved for r in rows),
            "rejected": sum(r.rejected for r in rows),
            "edited_approved": sum(r.edited_approved for r in rows),
            "total": sum(r.total for r in rows),
        },
    }


def _draft_to_dict(d: ItemDraft) -> dict:
    return {
        "id": str(d.id),
        "kc_id": str(d.kc_id),
        "kc_name": d.kc_name,
        "kc_code": d.kc_code,
        "content": d.content,
        "difficulty_label": d.difficulty_label,
        "is_diagnostic_anchor": d.is_diagnostic_anchor,
        "kst_irt_tag": d.kst_irt_tag,
        "generation_job_id": str(d.generation_job_id) if d.generation_job_id else None,
        "sgk_section": d.sgk_section,
        "status": d.status,
        "imported_item_id": str(d.imported_item_id) if d.imported_item_id else None,
        "reviewed_at": d.reviewed_at.isoformat() if d.reviewed_at else None,
        "created_at": d.created_at.isoformat(),
        "flagged": getattr(d, "flagged", False) or False,
        "flag_note": getattr(d, "flag_note", None),
    }


async def flag_draft(
    db: AsyncSession,
    draft_id: str,
    flagged: bool,
    flag_note: Optional[str] = None,
) -> Optional[dict]:
    """Toggle flag on a draft and optionally set a reviewer note."""
    draft = await db.get(ItemDraft, uuid.UUID(draft_id))
    if not draft:
        return None
    draft.flagged = flagged
    draft.flag_note = flag_note if flagged else None
    await db.commit()
    await db.refresh(draft)
    return _draft_to_dict(draft)

