"""
Import AI-generated MCQ questions from a markdown file into item_drafts.

Strategy:
  - Parse all ```json blocks from the markdown file
  - For each item, insert as ItemDraft with:
      status          = 'pending'   → appears in "Chờ duyệt" queue immediately
      kst_irt_tag     = 'batch_import_20260622'  → visible tag in UI for easy identification
      generation_job_id = one shared UUID for this whole import run
      sgk_section     = kc.chapter_info (from DB)
  - Skips items whose kc_code does not exist in DB (logs warning)
  - Dry-run mode: set DRY_RUN = True to preview without writing

Usage:
  cd backend
  .venv/bin/python scratch/import_drafts.py [path_to_md_file]

  # Dry run (default):
  DRY_RUN=1 .venv/bin/python scratch/import_drafts.py ~/Downloads/g6_generated_questions\(12\).md

  # Actual import:
  DRY_RUN=0 .venv/bin/python scratch/import_drafts.py ~/Downloads/g6_generated_questions\(12\).md
"""
import asyncio
import json
import os
import re
import sys
import uuid
from collections import defaultdict
from datetime import datetime, timezone
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent))

from sqlalchemy import text
from app.core.database import AsyncSessionLocal
from app.models.models import ItemDraft, KnowledgeComponent

# ── Config ────────────────────────────────────────────────────────────────────
DRY_RUN: bool = os.environ.get("DRY_RUN", "1") != "0"

# Tag that will appear in the UI alongside each draft so you can spot-filter them
BATCH_TAG = "batch_import_20260622"

# One UUID per import run — lets you group/query all items from this batch
BATCH_JOB_ID = uuid.uuid4()

# ── Parse markdown file ───────────────────────────────────────────────────────
def parse_md_file(path: str) -> list[dict]:
    """Extract all ```json blocks from the markdown file."""
    text_content = Path(path).read_text(encoding="utf-8")
    raw_blocks = re.findall(r"```json\s*(\{.*?\})\s*```", text_content, re.DOTALL)
    items = []
    for i, block in enumerate(raw_blocks):
        try:
            data = json.loads(block)
        except json.JSONDecodeError as e:
            print(f"  ⚠ Block {i+1}: JSON parse error — {e}")
            continue
        # Validate required keys
        required = {"kc_code", "difficulty", "question", "answers"}
        if not required.issubset(data):
            print(f"  ⚠ Block {i+1}: Missing keys {required - set(data)} — skipping")
            continue
        items.append(data)
    return items


# ── Build content JSONB (same shape as items.content) ─────────────────────────
def build_content(data: dict) -> dict:
    """Convert the generated JSON block into the DB content schema."""
    return {
        "question": data["question"],
        "answers": [
            {
                "label": a["label"],
                "text": a["text"],
                "is_correct": a["is_correct"],
            }
            for a in data["answers"]
        ],
        "misconceptions": data.get("misconceptions", ""),
    }


# ── Main ──────────────────────────────────────────────────────────────────────
async def main(md_path: str):
    print(f"\n{'='*60}")
    print(f"  Import AI-generated drafts")
    print(f"  Source:  {md_path}")
    print(f"  Tag:     {BATCH_TAG}")
    print(f"  Job ID:  {BATCH_JOB_ID}")
    print(f"  Mode:    {'DRY RUN — no DB writes' if DRY_RUN else '⚡ LIVE — will write to DB'}")
    print(f"{'='*60}\n")

    items = parse_md_file(md_path)
    print(f"  Parsed {len(items)} JSON blocks from markdown\n")

    if not items:
        print("  Nothing to import.")
        return

    # ── Resolve kc_code → kc_id, kc_name, chapter_info ──────────────────────
    all_codes = list({i["kc_code"] for i in items})
    async with AsyncSessionLocal() as db:
        rows = (await db.execute(
            text("SELECT id::text, code, name, chapter_info FROM knowledge_components WHERE code = ANY(:codes)"),
            {"codes": all_codes}
        )).fetchall()

    kc_map = {r.code: {"id": uuid.UUID(r.id), "name": r.name, "chapter": r.chapter_info or ""} for r in rows}
    missing = set(all_codes) - set(kc_map)
    if missing:
        print(f"  ⚠ KC codes NOT found in DB (will be skipped): {sorted(missing)}\n")

    # ── Stats ──────────────────────────────────────────────────────────────────
    per_kc: dict[str, list[dict]] = defaultdict(list)
    skipped = 0
    for item in items:
        code = item["kc_code"]
        if code not in kc_map:
            skipped += 1
            continue
        per_kc[code].append(item)

    print(f"  ── Preview by KC ──")
    grand_total = 0
    for code in sorted(per_kc):
        kc = kc_map[code]
        batch = per_kc[code]
        by_diff = defaultdict(int)
        by_anchor = 0
        for b in batch:
            by_diff[b["difficulty"]] += 1
            if b.get("is_diagnostic_anchor"):
                by_anchor += 1
        print(f"  [{code}] {kc['name'][:50]}")
        diff_str = "  ".join(f"{d}={n}" for d, n in sorted(by_diff.items()))
        print(f"    → {len(batch)} items  ({diff_str}  anchors={by_anchor})")
        grand_total += len(batch)

    print(f"\n  Total to import: {grand_total}  |  Skipped (unknown KC): {skipped}\n")

    if DRY_RUN:
        print("  DRY RUN — set DRY_RUN=0 to actually write.\n")
        return

    # ── Write to DB ───────────────────────────────────────────────────────────
    print("  Writing to DB...\n")
    saved = 0
    errors = 0

    async with AsyncSessionLocal() as db:
        for code in sorted(per_kc):
            kc = kc_map[code]
            for item in per_kc[code]:
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
                    print(f"  ✗ Error on [{code}] '{item.get('question', '')[:60]}': {e}")
                    errors += 1

        await db.commit()

    print(f"\n{'='*60}")
    print(f"  ✅  Saved {saved} drafts  |  ✗ Errors: {errors}")
    print(f"  Tag '{BATCH_TAG}' applied to all imported drafts.")
    print(f"  In the UI: select any KC → filter 'Chờ duyệt' → look for tag '{BATCH_TAG}'")
    print(f"{'='*60}\n")


if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage: python import_drafts.py <path_to_md_file>")
        sys.exit(1)
    asyncio.run(main(sys.argv[1]))
