"""
Scan database for G6 KCs that should be EXCLUDED from MCQ generation.

Two detection methods:
  1. item_drafts.flag_note contains visual/skill keywords → user manually flagged
  2. KC name starts with "Vẽ" / "Đo...bằng thước" / "Lập bảng" → motor skill

Output:
  - docs/g6_skip_nodes.csv
  - docs/g6_question_gen_context_filtered.csv  (context CSV minus skip nodes)
"""
import asyncio, sys, csv, re
from pathlib import Path
sys.path.insert(0, str(Path(__file__).parent.parent))
from sqlalchemy import text
from app.core.database import AsyncSessionLocal

# ── Method 1: flag_note keywords set by the USER (not auto-flag) ─────────────
# Matches any manual note the user wrote indicating a visual / skill KC
VISUAL_FLAG_NOTE_PATTERNS = [
    r'test bằng visual',
    r'nên test bằng visual',
    r'node vẽ hình',
    r'node khó test',
    r'skill only',
    r'visual only',
    r'không mcq',
    r'no mcq',
]

# ── Method 2: KC name patterns that definitively mean motor/drawing skill ─────
VISUAL_NAME_PATTERNS = [
    r'^vẽ\b',                     # starts with "Vẽ"
    r'\bvẽ biểu đồ\b',           # Vẽ biểu đồ
    r'\blập bảng\b',              # Lập bảng thống kê
    r'^gấp\b',                    # Gấp giấy
    r'^cắt\b',                    # Cắt hình
    r'^đo\b',                     # starts with "Đo" (measuring skill)
    r'\bđo .* bằng thước\b',     # đo góc bằng thước
]

# ── False-positive guard: auto-flagged notes should be ignored ─────────────────
AUTO_FLAG_MARKER = 'Auto-flagged'


QUERY_KCS = """
    SELECT
        kc.id::text, kc.code, kc.name, kc.grade, kc.chapter_info, kc.notes,
        COUNT(DISTINCT i.id) FILTER (WHERE i.is_active = true) AS have_items
    FROM knowledge_components kc
    LEFT JOIN items i ON i.kc_id = kc.id
    WHERE kc.grade = 6
    GROUP BY kc.id, kc.code, kc.name, kc.grade, kc.chapter_info, kc.notes
    ORDER BY kc.code
"""

# Get distinct KCs that have at least one manually-flagged draft with visual keywords
QUERY_VISUAL_FLAGS = """
    SELECT DISTINCT d.kc_id::text, kc.code, kc.name,
           string_agg(DISTINCT d.flag_note, ' | ') as combined_notes
    FROM item_drafts d
    JOIN knowledge_components kc ON kc.id = d.kc_id
    WHERE d.flagged = true
      AND d.flag_note IS NOT NULL
      AND d.flag_note NOT LIKE :auto_marker
    GROUP BY d.kc_id, kc.code, kc.name
"""


def matches_any(text_val: str, patterns: list[str]) -> str | None:
    """Return the first matching pattern, or None."""
    text_lower = text_val.lower()
    for pat in patterns:
        if re.search(pat, text_lower):
            return pat
    return None


async def main():
    async with AsyncSessionLocal() as db:
        kcs = (await db.execute(text(QUERY_KCS))).fetchall()

        # KCs with manual visual flag_notes
        flagged_rows = (await db.execute(
            text(QUERY_VISUAL_FLAGS),
            {"auto_marker": f"%{AUTO_FLAG_MARKER}%"}
        )).fetchall()

    # Build: kc_id → combined_notes from flagged drafts
    visual_flag_map: dict[str, str] = {}
    for row in flagged_rows:
        combined = row.combined_notes or ""
        # Check if any note matches visual keywords
        matched = matches_any(combined, VISUAL_FLAG_NOTE_PATTERNS)
        if matched:
            visual_flag_map[row.kc_id] = f"flag_note matches '{matched}' | notes={combined[:120]}"

    skip_rows = []
    for kc in kcs:
        reasons = []

        # Method 1: user manual visual flag
        if kc.id in visual_flag_map:
            reasons.append(visual_flag_map[kc.id])

        # Method 2: KC name pattern
        name_pat = matches_any(kc.name, VISUAL_NAME_PATTERNS)
        if name_pat:
            reasons.append(f"name pattern '{name_pat}'")

        if reasons:
            skip_rows.append({
                "kc_code":      kc.code,
                "kc_name":      kc.name,
                "chapter_info": kc.chapter_info or "",
                "have_items":   kc.have_items or 0,
                "skip_reasons": " | ".join(reasons),
            })

    # ── Print results ─────────────────────────────────────────────────────────
    print(f"=== G6 KCs to SKIP for MCQ generation ===")
    print(f"Total: {len(skip_rows)}\n")
    by_method1 = [r for r in skip_rows if "flag_note" in r["skip_reasons"]]
    by_method2 = [r for r in skip_rows if "name pattern" in r["skip_reasons"]]
    by_both    = [r for r in skip_rows if "flag_note" in r["skip_reasons"] and "name pattern" in r["skip_reasons"]]
    print(f"  User-flagged (visual note):  {len(by_method1)}")
    print(f"  Name pattern only:           {len(by_method2) - len(by_both)}")
    print(f"  Both:                        {len(by_both)}\n")

    for r in skip_rows:
        print(f"  [{r['kc_code']}] {r['kc_name']}")
        for part in r["skip_reasons"].split(" | "):
            print(f"    → {part[:120]}")

    # ── Export skip CSV ───────────────────────────────────────────────────────
    skip_out = Path(__file__).parent.parent.parent / "docs" / "g6_skip_nodes.csv"
    with open(skip_out, "w", newline="", encoding="utf-8-sig") as f:
        if skip_rows:
            writer = csv.DictWriter(f, fieldnames=skip_rows[0].keys())
            writer.writeheader()
            writer.writerows(skip_rows)
    print(f"\nSkip list → {skip_out}")

    # ── Filter context CSV ────────────────────────────────────────────────────
    context_in  = Path(__file__).parent.parent.parent / "docs" / "g6_question_gen_context.csv"
    context_out = Path(__file__).parent.parent.parent / "docs" / "g6_question_gen_context_filtered.csv"
    if not context_in.exists():
        print(f"WARNING: source CSV not found: {context_in}")
        return

    skip_codes = {r["kc_code"] for r in skip_rows}
    with open(context_in, encoding="utf-8-sig") as f:
        reader = csv.DictReader(f)
        orig = list(reader)
        fields = reader.fieldnames

    kept    = [r for r in orig if r["kc_code"] not in skip_codes]
    removed = [r for r in orig if r["kc_code"] in skip_codes]

    with open(context_out, "w", newline="", encoding="utf-8-sig") as f:
        writer = csv.DictWriter(f, fieldnames=fields)
        writer.writeheader()
        writer.writerows(kept)

    print(f"\nContext CSV: {len(orig)} rows → {len(kept)} kept, {len(removed)} removed")
    print(f"Filtered CSV → {context_out}")
    if removed:
        print("\nRemoved from generation list:")
        for r in removed:
            print(f"  [{r['kc_code']}] {r['kc_name']} (need={r['need_total']})")


asyncio.run(main())
