"""
Check batch file coverage vs CSV rows 70-115.
Compares:
  1. KCs needed (from CSV rows 70-115)
  2. Questions already in DB (items table, is_active=true)
  3. Questions already imported as pending drafts
  4. Questions in the new batch file

For each KC: shows need_total, have_in_DB, have_in_batch_file, shortfall
"""
import asyncio, sys, csv, re, json
from pathlib import Path
from collections import defaultdict

sys.path.insert(0, str(Path(__file__).parent.parent))
from sqlalchemy import text
from app.core.database import AsyncSessionLocal

MD_FILE = Path("/Users/admin/Downloads/g6_generated_questions_batch_70_79(4).md")
CONTEXT_CSV = Path(__file__).parent.parent.parent / "docs" / "g6_question_gen_context_filtered.csv"
ROW_START = 70   # 1-indexed data rows (row 1 = first data row after header)
ROW_END   = 115

BATCH_TAG = "batch_import_20260622"  # already-imported drafts from batch 12


def parse_batch_file(path: Path) -> dict[str, list[dict]]:
    """Parse all ```json blocks → grouped by kc_code."""
    text_content = path.read_text(encoding="utf-8")
    blocks = re.findall(r"```json\s*(\{.*?\})\s*```", text_content, re.DOTALL)
    by_kc: dict[str, list[dict]] = defaultdict(list)
    for block in blocks:
        try:
            data = json.loads(block)
        except json.JSONDecodeError:
            continue
        code = data.get("kc_code", "UNKNOWN")
        by_kc[code].append(data)
    return dict(by_kc)


def load_csv_rows(path: Path, row_start: int, row_end: int) -> list[dict]:
    """Load data rows from CSV (1-indexed, excluding header)."""
    with open(path, encoding="utf-8-sig") as f:
        reader = csv.DictReader(f)
        rows = list(reader)
    return rows[row_start - 1 : row_end]


async def main():
    # ── 1. Load CSV rows ──────────────────────────────────────────────────────
    csv_rows = load_csv_rows(CONTEXT_CSV, ROW_START, ROW_END)
    target_kcs = {}
    for row in csv_rows:
        code = row.get("kc_code", "").strip()
        if not code:
            continue
        try:
            need = int(row.get("need_total", 0))
        except ValueError:
            need = 0
        target_kcs[code] = {
            "name":  row.get("kc_name", "").strip(),
            "need":  need,
        }

    print(f"Target KCs from rows {ROW_START}–{ROW_END}: {len(target_kcs)}")
    if not target_kcs:
        print("No valid KCs found — check CSV path / row range")
        return

    # ── 2. Parse batch file ───────────────────────────────────────────────────
    batch = parse_batch_file(MD_FILE)
    batch_only_kcs = set(batch) - set(target_kcs)
    if batch_only_kcs:
        print(f"\n⚠ KCs in batch file NOT in target range (ignored in coverage check):")
        for c in sorted(batch_only_kcs):
            print(f"  {c} ({len(batch[c])} items)")

    # ── 3. Query DB ───────────────────────────────────────────────────────────
    codes = list(target_kcs.keys())
    async with AsyncSessionLocal() as db:
        # Active items in item bank
        r_items = await db.execute(text("""
            SELECT kc.code,
                   COUNT(i.id) FILTER (WHERE i.is_active)                                   AS total,
                   COUNT(i.id) FILTER (WHERE i.is_active AND i.difficulty_label='easy')     AS easy,
                   COUNT(i.id) FILTER (WHERE i.is_active AND i.difficulty_label='medium')   AS medium,
                   COUNT(i.id) FILTER (WHERE i.is_active AND i.difficulty_label='hard')     AS hard
            FROM knowledge_components kc
            LEFT JOIN items i ON i.kc_id = kc.id
            WHERE kc.code = ANY(:codes)
            GROUP BY kc.code
        """), {"codes": codes})
        db_items = {r.code: {"total": r.total, "easy": r.easy, "med": r.medium, "hard": r.hard}
                    for r in r_items.fetchall()}

        # Pending drafts (already imported batch 12 + any other pending)
        r_drafts = await db.execute(text("""
            SELECT kc.code, COUNT(d.id) AS cnt
            FROM item_drafts d
            JOIN knowledge_components kc ON kc.id = d.kc_id
            WHERE kc.code = ANY(:codes)
              AND d.status = 'pending'
              AND (d.flagged = false OR d.flagged IS NULL)
            GROUP BY kc.code
        """), {"codes": codes})
        db_pending = {r.code: r.cnt for r in r_drafts.fetchall()}

    # ── 4. Report ─────────────────────────────────────────────────────────────
    print(f"\n{'KC Code':<35} {'Name':<45} {'need':>4} {'DB':>4} {'pend':>5} {'new':>4} {'OK?':>5}")
    print("-" * 110)

    needs_more  = []
    already_ok  = []
    not_in_file = []

    for code, info in sorted(target_kcs.items()):
        need       = info["need"]
        db_total   = db_items.get(code, {}).get("total", 0)
        pending    = db_pending.get(code, 0)
        new_batch  = len(batch.get(code, []))
        covered    = db_total + pending + new_batch

        if need == 0:
            status = "–"
        elif covered >= need:
            status = "✅"
            already_ok.append(code)
        else:
            status = f"❌ need {need - covered} more"
            if new_batch == 0:
                not_in_file.append(code)
            else:
                needs_more.append(code)

        print(f"  {code:<33} {info['name'][:43]:<45} {need:>4} {db_total:>4} {pending:>5} {new_batch:>4} {status}")

    print(f"\n{'='*110}")
    print(f"  ✅ Already covered (no more needed):  {len(already_ok)}")
    print(f"  ❌ In batch file but still short:      {len(needs_more)}")
    print(f"  ⚠  Not in batch file at all:          {len(not_in_file)}")

    if needs_more:
        print(f"\n  Need more questions (in file but insufficient):")
        for c in needs_more:
            need = target_kcs[c]["need"]
            have = db_items.get(c, {}).get("total", 0) + db_pending.get(c, 0) + len(batch.get(c, []))
            print(f"    {c}: need {need - have} more (have {have}/{need})")

    if not_in_file:
        print(f"\n  Missing from batch file entirely:")
        for c in not_in_file:
            need = target_kcs[c]["need"]
            have = db_items.get(c, {}).get("total", 0) + db_pending.get(c, 0)
            print(f"    {c}: need {need - have} more (have {have}/{need})")


asyncio.run(main())
