"""
Smart import for batch 70-115:
- Only imports items for KCs that still need more questions
- Caps import per KC at the shortfall (need - have_in_DB - have_pending)
- Skips KCs with invalid/unknown codes
- Tags all imported drafts with batch_import_70_115_20260622
"""
import asyncio, sys, json, re, os, uuid
from pathlib import Path
from collections import defaultdict

sys.path.insert(0, str(Path(__file__).parent.parent))
from sqlalchemy import text
from app.core.database import AsyncSessionLocal
from app.models.models import ItemDraft

DRY_RUN: bool = os.environ.get("DRY_RUN", "1") != "0"
BATCH_TAG = "batch_import_70_115_20260622"
BATCH_JOB_ID = uuid.uuid4()

MD_FILE = Path("/Users/admin/Downloads/g6_generated_questions_batch_70_79(4).md")


def parse_batch_file(path: Path) -> dict[str, list[dict]]:
    text_content = path.read_text(encoding="utf-8")
    blocks = re.findall(r"```json\s*(\{.*?\})\s*```", text_content, re.DOTALL)
    by_kc: dict[str, list[dict]] = defaultdict(list)
    skipped = 0
    for block in blocks:
        try:
            data = json.loads(block)
        except json.JSONDecodeError:
            skipped += 1
            continue
        if not {"kc_code", "difficulty", "question", "answers"}.issubset(data):
            skipped += 1
            continue
        by_kc[data["kc_code"]].append(data)
    if skipped:
        print(f"  ⚠ Skipped {skipped} malformed JSON blocks")
    return dict(by_kc)


def build_content(data: dict) -> dict:
    return {
        "question": data["question"],
        "answers": [
            {"label": a["label"], "text": a["text"], "is_correct": a["is_correct"]}
            for a in data["answers"]
        ],
        "misconceptions": data.get("misconceptions", ""),
    }


async def main():
    print(f"\n{'='*65}")
    print(f"  Smart Import — Batch 70–115")
    print(f"  Source:  {MD_FILE.name}")
    print(f"  Tag:     {BATCH_TAG}")
    print(f"  Job ID:  {BATCH_JOB_ID}")
    print(f"  Mode:    {'DRY RUN' if DRY_RUN else '⚡ LIVE'}")
    print(f"{'='*65}\n")

    # ── Parse file ──────────────────────────────────────────────────────────
    by_kc = parse_batch_file(MD_FILE)
    all_codes = list(by_kc.keys())
    print(f"  Parsed {sum(len(v) for v in by_kc.values())} items across {len(all_codes)} KCs\n")

    # ── Query DB: KC metadata + current item counts + pending drafts ─────────
    async with AsyncSessionLocal() as db:
        r_kc = await db.execute(text("""
            SELECT kc.id::text, kc.code, kc.name, kc.chapter_info,
                   COUNT(i.id) FILTER (WHERE i.is_active) AS db_items
            FROM knowledge_components kc
            LEFT JOIN items i ON i.kc_id = kc.id
            WHERE kc.code = ANY(:codes)
            GROUP BY kc.id, kc.code, kc.name, kc.chapter_info
        """), {"codes": all_codes})
        kc_map = {r.code: {"id": uuid.UUID(r.id), "name": r.name,
                            "chapter": r.chapter_info or "", "db": r.db_items or 0}
                  for r in r_kc.fetchall()}

        r_pending = await db.execute(text("""
            SELECT kc.code, COUNT(d.id) AS cnt
            FROM item_drafts d
            JOIN knowledge_components kc ON kc.id = d.kc_id
            WHERE kc.code = ANY(:codes)
              AND d.status = 'pending'
              AND (d.flagged IS NULL OR d.flagged = false)
            GROUP BY kc.code
        """), {"codes": all_codes})
        pending_map = {r.code: r.cnt for r in r_pending.fetchall()}

        # need_total from context CSV (filtered)
        csv_path = Path(__file__).parent.parent.parent / "docs" / "g6_question_gen_context_filtered.csv"
        import csv
        need_map: dict[str, int] = {}
        if csv_path.exists():
            with open(csv_path, encoding="utf-8-sig") as f:
                for row in csv.DictReader(f):
                    code = row.get("kc_code", "").strip()
                    try:
                        need_map[code] = int(row.get("need_total", 0))
                    except ValueError:
                        need_map[code] = 0

    # ── Decide what to import ─────────────────────────────────────────────────
    unknown_codes = set(all_codes) - set(kc_map)
    if unknown_codes:
        print(f"  ⚠ KC codes NOT in DB (will be skipped): {sorted(unknown_codes)}\n")

    to_import: list[tuple[str, dict, dict]] = []  # (code, kc_info, item)
    report_lines = []

    for code in sorted(all_codes):
        if code not in kc_map:
            continue
        kc = kc_map[code]
        items_in_file = by_kc[code]
        db_have   = kc["db"]
        pending   = pending_map.get(code, 0)
        need      = need_map.get(code, 0)
        already   = db_have + pending
        shortfall = max(0, need - already) if need > 0 else len(items_in_file)

        will_import = min(shortfall, len(items_in_file))

        if will_import == 0:
            status = f"SKIP (already {already}/{need})"
        elif will_import < len(items_in_file):
            status = f"PARTIAL {will_import}/{len(items_in_file)} (need {shortfall} more)"
        else:
            status = f"IMPORT ALL {will_import}"

        report_lines.append((code, kc["name"][:45], need, db_have, pending,
                              len(items_in_file), will_import, status))

        for item in items_in_file[:will_import]:
            to_import.append((code, kc, item))

    # ── Print report ──────────────────────────────────────────────────────────
    print(f"  {'Code':<35} {'Name':<47} {'need':>4} {'DB':>4} {'pend':>5} {'file':>5} {'imp':>4}  Status")
    print(f"  {'-'*35} {'-'*47} {'-'*4} {'-'*4} {'-'*5} {'-'*5} {'-'*4}  ------")
    for code, name, need, db, pend, file_cnt, imp, status in report_lines:
        imp_str = str(imp) if imp > 0 else "–"
        marker = "→" if imp > 0 else " "
        print(f"  {marker}{code:<34} {name:<47} {need:>4} {db:>4} {pend:>5} {file_cnt:>5} {imp_str:>4}  {status}")

    print(f"\n  Total items to import: {len(to_import)}")

    if DRY_RUN:
        print(f"\n  DRY RUN — set DRY_RUN=0 to write.\n")
        return

    # ── Write to DB ───────────────────────────────────────────────────────────
    print(f"\n  Writing to DB...")
    saved = errors = 0

    async with AsyncSessionLocal() as db:
        for code, kc, item in to_import:
            try:
                draft = ItemDraft(
                    kc_id=kc["id"],
                    kc_name=kc["name"],
                    kc_code=code,
                    content=build_content(item),
                    difficulty_label=item["difficulty"],
                    is_diagnostic_anchor=bool(item.get("is_diagnostic_anchor", False)),
                    kst_irt_tag=BATCH_TAG,
                    generation_job_id=BATCH_JOB_ID,
                    sgk_section=kc["chapter"],
                    raw_ai_output=json.dumps(item, ensure_ascii=False),
                    status="pending",
                    flagged=False,
                    flag_note=None,
                )
                db.add(draft)
                saved += 1
            except Exception as e:
                print(f"  ✗ [{code}]: {e}")
                errors += 1
        await db.commit()

    print(f"\n{'='*65}")
    print(f"  ✅ Saved {saved} drafts  |  ✗ Errors: {errors}")
    print(f"  Tag: {BATCH_TAG}")
    print(f"{'='*65}\n")


asyncio.run(main())
