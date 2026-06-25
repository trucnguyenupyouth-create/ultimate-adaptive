"""
Export active Grade 6 algebra/non-geometry MCQ items from production DB.

Read-only script. It writes a Markdown review artifact for the academic team.
"""

from __future__ import annotations

import asyncio
import os
import re
from collections import defaultdict
from pathlib import Path
from typing import Any

from dotenv import load_dotenv
from sqlalchemy import text
from sqlalchemy.ext.asyncio import create_async_engine


ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / "docs" / "g6_algebra_current_mcq_items.md"

GEOMETRY_TERMS = (
    "hình", "hinh", "điểm", "diem", "đường", "duong", "thẳng", "thang",
    "đoạn", "doan", "tia", "góc", "goc", "tam giác", "tam giac",
    "vuông", "vuong", "song song", "tròn", "tron", "thước", "thuoc",
    "compa",
)

VISUAL_DEFER_TERMS = (
    "vẽ", "ve ", "đo bằng thước", "do bang thuoc", "biểu đồ tranh",
    "bieu do tranh", "biểu đồ cột", "bieu do cot",
)

INCLUDE_NON_GEOMETRY_TERMS = (
    "số", "so ", "phân số", "phan so", "thập phân", "thap phan",
    "ước", "uoc", "bội", "boi", "ucln", "bcnn", "lũy thừa", "luy thua",
    "biểu thức", "bieu thuc", "phép tính", "phep tinh", "tỉ số", "ti so",
    "tỷ số", "ty so", "tỉ lệ", "ti le", "phần trăm", "phan tram",
    "dữ liệu", "du lieu", "thống kê", "thong ke", "xác suất", "xac suat",
    "bảng", "bang", "ngoặc", "ngoac",
)


def md_escape(value: Any) -> str:
    text_value = "" if value is None else str(value)
    return text_value.replace("\r\n", "\n").replace("\r", "\n").strip()


def normalized_text(*parts: Any) -> str:
    return " ".join(str(p or "").lower() for p in parts)


def is_g6_algebra_candidate(kc: dict[str, Any]) -> tuple[bool, str]:
    text_value = normalized_text(kc["code"], kc["name"], kc.get("chapter_info"))
    if any(term in text_value for term in VISUAL_DEFER_TERMS):
        return False, "deferred_visual_or_geometry"
    if any(term in text_value for term in GEOMETRY_TERMS):
        return False, "excluded_geometry_signal"
    if any(term in text_value for term in INCLUDE_NON_GEOMETRY_TERMS):
        return True, "included_non_geometry_algebra_signal"
    return False, "review_required_no_clear_algebra_signal"


def item_sort_key(item: dict[str, Any]) -> tuple:
    difficulty_rank = {"anchor": 0, "medium": 1, "easy": 2, "hard": 3}
    label = item.get("difficulty_label") or "medium"
    return (
        -int(bool(item.get("is_diagnostic_anchor"))),
        difficulty_rank.get(label, 4),
        str(item.get("created_at") or ""),
        str(item["id"]),
    )


def render_item(item: dict[str, Any], index: int) -> list[str]:
    content = item.get("content") or {}
    answers = content.get("answers") or []
    correct_labels = [
        str(answer.get("label"))
        for answer in answers
        if answer.get("is_correct") is True
    ]
    lines = [
        f"**Item {index}:** `{item['id']}`",
        f"- Metadata: difficulty=`{item.get('difficulty_label') or 'unknown'}`, "
        f"anchor=`{bool(item.get('is_diagnostic_anchor'))}`, "
        f"format=`{item.get('format_type') or 'unknown'}`, "
        f"irt_a=`{item.get('irt_a')}`, irt_b=`{item.get('irt_b')}`, irt_c=`{item.get('irt_c')}`",
        f"- Question: {md_escape(content.get('question'))}",
    ]
    if answers:
        lines.append("- Options:")
        for answer in answers:
            marker = " (correct)" if answer.get("is_correct") is True else ""
            lines.append(f"  - {md_escape(answer.get('label'))}. {md_escape(answer.get('text'))}{marker}")
    else:
        lines.append("- Options: missing from exported content")
    lines.append(f"- Correct answer: {', '.join(correct_labels) if correct_labels else 'missing'}")
    return lines


async def main() -> None:
    load_dotenv(ROOT / "backend" / ".env")
    database_url = os.environ["DATABASE_URL"]
    engine = create_async_engine(
        database_url,
        connect_args={
            "statement_cache_size": 0,
            "prepared_statement_cache_size": 0,
        },
    )
    async with engine.connect() as conn:
        kc_rows = (
            await conn.execute(
                text(
                    """
                    select id::text, code, name, grade, subject, chapter_info
                    from knowledge_components
                    where grade = 6 and lower(subject) = 'math'
                    order by code
                    """
                )
            )
        ).mappings().all()
        item_rows = (
            await conn.execute(
                text(
                    """
                    select
                        id::text,
                        kc_id::text,
                        content,
                        difficulty_label,
                        format_type,
                        irt_a,
                        irt_b,
                        irt_c,
                        is_diagnostic_anchor,
                        created_at
                    from items
                    where is_active = true
                      and coalesce(format_type, 'mcq') in ('mcq', 'mcq4')
                    order by created_at desc
                    """
                )
            )
        ).mappings().all()
    await engine.dispose()

    kcs = [dict(row) for row in kc_rows]
    by_kc: dict[str, list[dict[str, Any]]] = defaultdict(list)
    for row in item_rows:
        by_kc[row["kc_id"]].append(dict(row))

    included: list[dict[str, Any]] = []
    excluded_counts: dict[str, int] = defaultdict(int)
    for kc in kcs:
        include, reason = is_g6_algebra_candidate(kc)
        if not include:
            excluded_counts[reason] += 1
            continue
        items = sorted(by_kc.get(kc["id"], []), key=item_sort_key)
        if not items:
            excluded_counts["included_but_no_active_mcq"] += 1
            continue
        kc["items"] = items[:2]
        kc["total_active_mcq"] = len(items)
        kc["anchor_active_mcq"] = sum(1 for item in items if item.get("is_diagnostic_anchor"))
        included.append(kc)

    lines = [
        "# Grade 6 Algebra/Non-Geometry Current MCQ Export",
        "",
        "Source: production database, active MCQ items only.",
        "",
        "Scope note: this export uses a conservative non-geometry filter. Geometry/visual nodes are deferred for the later visual assessment phase. Mixed nodes without a clear algebra signal are not included here.",
        "",
        "Selection rule per KC: export up to 2 active MCQ items, prioritizing diagnostic anchors first, then medium/easy/hard difficulty.",
        "",
        "Important limitation: these are current MCQs, useful for audit and conversion. Assessment V2 should prefer reviewed open-ended diagnostic items for strong inference.",
        "",
        "## Summary",
        "",
        f"- Grade 6 math KCs scanned: {len(kcs)}",
        f"- Algebra/non-geometry KCs exported with active MCQ: {len(included)}",
        f"- Exported MCQ items: {sum(len(kc['items']) for kc in included)}",
    ]
    for reason, count in sorted(excluded_counts.items()):
        lines.append(f"- Not exported ({reason}): {count}")

    lines.extend(["", "## Items By KC", ""])
    for idx, kc in enumerate(included, start=1):
        lines.extend(
            [
                f"### {idx}. {md_escape(kc['code'])} — {md_escape(kc['name'])}",
                "",
                f"- KC id: `{kc['id']}`",
                f"- Chapter/block: `{md_escape(kc.get('chapter_info')) or 'unknown'}`",
                f"- Active MCQ pool: {kc['total_active_mcq']} total, {kc['anchor_active_mcq']} anchor",
                "",
            ]
        )
        for item_index, item in enumerate(kc["items"], start=1):
            lines.extend(render_item(item, item_index))
            lines.append("")

    OUT.write_text("\n".join(lines).rstrip() + "\n", encoding="utf-8")
    print(f"Wrote {OUT}")
    print(f"Exported {len(included)} KCs / {sum(len(kc['items']) for kc in included)} items")


if __name__ == "__main__":
    asyncio.run(main())
