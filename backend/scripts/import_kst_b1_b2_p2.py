"""
Import KST items from kst_items_b1_b2 (2).html — sections kc11 through kc16.

Usage:
    cd backend
    POOLER_URL="postgresql+asyncpg://..." .venv/bin/python scripts/import_kst_b1_b2_p2.py

Prerequisites:
    - KC nodes for kc11–kc16 must already exist in the database
    - Run from the backend/ directory so .env is found
"""

import asyncio
import json
import os
import re
import uuid
from collections import Counter
from pathlib import Path
from typing import Optional

# ── Load .env ─────────────────────────────────────────────────────────────────
env_path = Path(__file__).parent.parent / ".env"
if env_path.exists():
    for line in env_path.read_text().splitlines():
        if "=" in line and not line.startswith("#"):
            k, v = line.split("=", 1)
            os.environ.setdefault(k.strip(), v.strip())

from sqlalchemy.ext.asyncio import create_async_engine
from sqlalchemy import text

DATABASE_URL = os.environ.get("POOLER_URL") or os.environ["DATABASE_URL"]

# ── HTML data file path ────────────────────────────────────────────────────────
HTML_FILE = Path(__file__).parent.parent.parent / "question data" / "kst_items_b1_b2 (2).html"

# ── Section → KC code mapping (kc11-kc16 only) ────────────────────────────────
SECTION_TO_KC = {
    "kc11": "G9-MATH-DAU-HIEU-CHIA-1",
    "kc12": "G6-MATH-DAU-HIEU-CHIA-1",
    "kc13": "G9-MATH-BIEU-DIEN-SO",
    "kc14": "G6-MATH-KI-HIEU-NHO",
    "kc15": "G9-MATH-SO-LIEN-TRUOC",
    "kc16": "G9-MATH-SO-SANH-HAI",
}

# ─────────────────────────────────────────────────────────────────────────────
# HTML PARSING UTILITIES  (same logic as import_kst_b1_b2.py)
# ─────────────────────────────────────────────────────────────────────────────

def strip_tags(html: str) -> str:
    html = re.sub(r"<br\s*/?>", " ", html, flags=re.IGNORECASE)
    html = re.sub(r"<[^>]+>", "", html)
    html = (html
            .replace("&amp;", "&").replace("&lt;", "<").replace("&gt;", ">")
            .replace("&nbsp;", " ").replace("&#160;", " ")
            .replace("&le;", "≤").replace("&ge;", "≥"))
    return re.sub(r"\s+", " ", html).strip()


def extract_section_html(html: str, section_id: str) -> Optional[str]:
    pattern = rf'<section\s+id="{re.escape(section_id)}"[^>]*>(.*?)</section>'
    m = re.search(pattern, html, re.DOTALL | re.IGNORECASE)
    return m.group(1) if m else None


def split_item_cards(section_html: str) -> list[str]:
    pattern = r'<div class="item-card">'
    positions = [m.start() for m in re.finditer(pattern, section_html)]
    cards = []
    for i, start in enumerate(positions):
        end = positions[i + 1] if i + 1 < len(positions) else len(section_html)
        cards.append(section_html[start:end])
    return cards


def parse_format_type(card_html: str) -> str:
    m = re.search(r'class="type-badge"[^>]*>(.*?)</span>', card_html, re.DOTALL)
    if m:
        badge = strip_tags(m.group(1)).strip().upper()
        if badge == "MCQ":
            return "mcq4"
        elif badge == "OPEN":
            return "open"
    return "mcq4"


def parse_stem(card_html: str) -> str:
    m = re.search(r'<div class="stem">(.*?)</div>', card_html, re.DOTALL)
    return strip_tags(m.group(1)) if m else ""


def parse_mcq_options(card_html: str) -> list[dict]:
    options_m = re.search(r'<div class="options">(.*)', card_html, re.DOTALL)
    if not options_m:
        return []
    options_html = options_m.group(1)
    option_pattern = re.compile(
        r'<div class="option (correct|wrong)">(.*?)(?=<div class="option|$)',
        re.DOTALL
    )
    answers = []
    for opt_m in option_pattern.finditer(options_html):
        correctness = opt_m.group(1)
        opt_html = opt_m.group(2)
        label_m = re.search(r'class="opt-label"[^>]*>(.*?)</span>', opt_html, re.DOTALL)
        text_m = re.search(r'class="opt-text"[^>]*>(.*?)</span>', opt_html, re.DOTALL)
        why_m = re.search(r'class="opt-why"[^>]*>(.*?)</div>', opt_html, re.DOTALL)
        answer = {
            "label": strip_tags(label_m.group(1)).strip() if label_m else "",
            "text": strip_tags(text_m.group(1)).strip() if text_m else "",
            "is_correct": correctness == "correct",
        }
        if why_m:
            note = strip_tags(why_m.group(1)).strip()
            if note:
                answer["distractor_note"] = note
        answers.append(answer)
    return answers


def parse_open_answer(card_html: str) -> str:
    m = re.search(r'<div class="open-answer">(.*)', card_html, re.DOTALL)
    if not m:
        return ""
    answer_html = m.group(1)
    answer_html = re.sub(r'<div class="label">.*?</div>', "", answer_html, flags=re.DOTALL)
    answer_html = re.sub(r'<span style="font-size:[^"]*"[^>]*>.*?</span>', "", answer_html, flags=re.DOTALL)
    return strip_tags(answer_html)


def parse_html(html_content: str) -> list[dict]:
    items = []
    for section_id in SECTION_TO_KC:
        section_html = extract_section_html(html_content, section_id)
        if not section_html:
            print(f"   ⚠️  Section {section_id} not found, skipping")
            continue
        for card_html in split_item_cards(section_html):
            fmt = parse_format_type(card_html)
            stem = parse_stem(card_html)
            if not stem:
                continue
            item: dict = {"section_id": section_id, "format_type": fmt, "question": stem}
            if fmt == "mcq4":
                item["answers"] = parse_mcq_options(card_html)
            else:
                item["expected_answer"] = parse_open_answer(card_html)
            items.append(item)
    return items


# ─────────────────────────────────────────────────────────────────────────────
# DATABASE OPERATIONS
# ─────────────────────────────────────────────────────────────────────────────

async def fetch_kc_map(engine) -> dict[str, str]:
    codes = list(SECTION_TO_KC.values())
    async with engine.connect() as conn:
        rows = await conn.execute(
            text("SELECT id, code FROM knowledge_components WHERE code = ANY(:codes)"),
            {"codes": codes},
        )
        return {row.code: str(row.id) for row in rows}


async def count_items_per_kc(engine, kc_ids: list[str]) -> dict[str, int]:
    async with engine.connect() as conn:
        rows = await conn.execute(
            text("""
                SELECT kc_id::text, COUNT(*) as cnt
                FROM items
                WHERE kc_id = ANY(:ids) AND is_active = TRUE
                GROUP BY kc_id
            """),
            {"ids": kc_ids},
        )
        return {row.kc_id: row.cnt for row in rows}


async def insert_item(engine, kc_id: str, content: dict, format_type: str) -> str:
    item_id = str(uuid.uuid4())
    async with engine.begin() as conn:
        await conn.execute(
            text("""
                INSERT INTO items (id, kc_id, content, format_type, is_active)
                VALUES (:id, :kc_id, CAST(:content AS jsonb), :format_type, TRUE)
            """),
            {
                "id": item_id,
                "kc_id": kc_id,
                "content": json.dumps(content, ensure_ascii=False),
                "format_type": format_type,
            },
        )
    return item_id


# ─────────────────────────────────────────────────────────────────────────────
# MAIN
# ─────────────────────────────────────────────────────────────────────────────

async def main():
    print("=" * 62)
    print("KST Items Import — B1/B2 Part 2 (kc11–kc16)")
    print("=" * 62)

    print(f"\n📂 Parsing: {HTML_FILE.name}")
    if not HTML_FILE.exists():
        raise FileNotFoundError(f"HTML file not found: {HTML_FILE}")

    html_content = HTML_FILE.read_text(encoding="utf-8")
    parsed_items = parse_html(html_content)

    section_counts = Counter(i["section_id"] for i in parsed_items)
    format_counts = Counter(i["format_type"] for i in parsed_items)

    print(f"   Found {len(parsed_items)} items across {len(section_counts)} sections")
    print(f"   Format: MCQ={format_counts.get('mcq4', 0)}, Open={format_counts.get('open', 0)}")
    print()
    for sid, count in sorted(section_counts.items()):
        print(f"   {sid}: {count} items  ({SECTION_TO_KC.get(sid, '?')})")

    if len(parsed_items) < 20:
        print(f"\n⚠️  Expected ~36 items (6 per KC × 6 KCs), only found {len(parsed_items)}. Aborting.")
        return

    print(f"\n🔌 Connecting to database...")
    engine = create_async_engine(DATABASE_URL, echo=False)

    print("🔍 Looking up KC codes...")
    kc_map = await fetch_kc_map(engine)

    missing = [c for c in SECTION_TO_KC.values() if c not in kc_map]
    if missing:
        print("\n❌ ABORT — KC codes not found:")
        for c in missing:
            print(f"   - {c}")
        await engine.dispose()
        return
    print(f"   ✅ All {len(kc_map)} KC codes found")

    kc_ids = list(kc_map.values())
    before_counts = await count_items_per_kc(engine, kc_ids)

    print(f"\n📥 Inserting {len(parsed_items)} items...")
    inserted = 0
    errors = []

    for item in parsed_items:
        kc_id = kc_map[SECTION_TO_KC[item["section_id"]]]
        content = (
            {"question": item["question"], "answers": item.get("answers", [])}
            if item["format_type"] == "mcq4"
            else {"question": item["question"], "expected_answer": item.get("expected_answer", "")}
        )
        try:
            await insert_item(engine, kc_id, content, item["format_type"])
            inserted += 1
        except Exception as e:
            errors.append({
                "section": item["section_id"],
                "q": item["question"][:70],
                "err": str(e)[:120],
            })

    after_counts = await count_items_per_kc(engine, kc_ids)

    print(f"\n{'=' * 62}")
    print("📊 Import Report")
    print(f"{'=' * 62}")
    print(f"{'KC Code':<44} {'Before':>6} {'After':>6} {'Added':>6}")
    print(f"{'-' * 64}")

    total_added = 0
    for sid, kc_code in SECTION_TO_KC.items():
        kid = kc_map[kc_code]
        before = before_counts.get(kid, 0)
        after = after_counts.get(kid, 0)
        added = after - before
        total_added += added
        print(f"{kc_code:<44} {before:>6} {after:>6} {added:>6}")

    print(f"{'-' * 64}")
    print(f"{'TOTAL':<44} {'':>6} {'':>6} {total_added:>6}")
    print(f"\n✅ Inserted: {inserted}  |  Errors: {len(errors)}")

    if errors:
        print(f"\n❌ Errors ({len(errors)}):")
        for e in errors:
            print(f"   [{e['section']}] {e['q']!r}")
            print(f"          → {e['err']}")

    await engine.dispose()
    print("\n✅ Done!")


if __name__ == "__main__":
    asyncio.run(main())
