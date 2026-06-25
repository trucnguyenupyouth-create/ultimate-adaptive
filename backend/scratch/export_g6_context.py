"""
Export G6 KCs needing items to CSV with full context for question generation.
Run: python scratch/export_g6_context.py
"""
import asyncio
import csv
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent))

from sqlalchemy import text
from app.core.database import AsyncSessionLocal

TARGET = 10

QUERY_KCS = """
    SELECT
        kc.id::text, kc.code, kc.name, kc.grade, kc.chapter_info,
        COUNT(DISTINCT i.id) FILTER (WHERE i.is_active = true)                                    AS have,
        COUNT(DISTINCT i.id) FILTER (WHERE i.is_active = true AND i.difficulty_label = 'easy')   AS have_easy,
        COUNT(DISTINCT i.id) FILTER (WHERE i.is_active = true AND i.difficulty_label = 'medium') AS have_med,
        COUNT(DISTINCT i.id) FILTER (WHERE i.is_active = true AND i.difficulty_label = 'hard')   AS have_hard,
        COUNT(DISTINCT i.id) FILTER (WHERE i.is_active = true AND i.is_diagnostic_anchor = true) AS have_anchor
    FROM knowledge_components kc
    JOIN kc_prerequisites kcp ON (kcp.kc_id = kc.id OR kcp.prereq_id = kc.id)
    LEFT JOIN items i ON i.kc_id = kc.id
    WHERE kc.grade = 6
    GROUP BY kc.id, kc.code, kc.name, kc.grade, kc.chapter_info
    HAVING COUNT(DISTINCT i.id) FILTER (WHERE i.is_active = true) < :target
    ORDER BY COUNT(DISTINCT i.id) FILTER (WHERE i.is_active = true) ASC, kc.code
"""

QUERY_PREREQS = """
    SELECT kcp.kc_id::text, pre.code AS prereq_code, pre.name AS prereq_name
    FROM kc_prerequisites kcp
    JOIN knowledge_components pre ON pre.id = kcp.prereq_id
    WHERE kcp.kc_id = ANY(:ids) AND kcp.edge_type = 'prerequisite'
"""

QUERY_SUCCESSORS = """
    SELECT kcp.prereq_id::text, post.code AS post_code, post.name AS post_name
    FROM kc_prerequisites kcp
    JOIN knowledge_components post ON post.id = kcp.kc_id
    WHERE kcp.prereq_id = ANY(:ids) AND kcp.edge_type = 'prerequisite'
"""

QUERY_EXISTING = """
    SELECT i.kc_id::text,
           (i.content->>'question') AS q_text,
           i.difficulty_label
    FROM items i
    WHERE i.kc_id = ANY(:ids) AND i.is_active = true
"""


async def main():
    async with AsyncSessionLocal() as db:
        kcs = (await db.execute(text(QUERY_KCS), {"target": TARGET})).fetchall()
        kc_ids = [k.id for k in kcs]

        prereqs_map: dict[str, list[str]] = {}
        for row in (await db.execute(text(QUERY_PREREQS), {"ids": kc_ids})).fetchall():
            prereqs_map.setdefault(row.kc_id, []).append(
                f"{row.prereq_code} ({row.prereq_name})"
            )

        successors_map: dict[str, list[str]] = {}
        for row in (await db.execute(text(QUERY_SUCCESSORS), {"ids": kc_ids})).fetchall():
            successors_map.setdefault(row.prereq_id, []).append(
                f"{row.post_code} ({row.post_name})"
            )

        existing_map: dict[str, list[str]] = {}
        for row in (await db.execute(text(QUERY_EXISTING), {"ids": kc_ids})).fetchall():
            q = (row.q_text or "")[:90]
            existing_map.setdefault(row.kc_id, []).append(
                f"[{row.difficulty_label}] {q}"
            )

    rows = []
    for k in kcs:
        have = k.have or 0
        gap = TARGET - have  # TRUE number of items needed — always use this

        # Per-difficulty distribution targets: 2 anchors + 3 easy + 2 medium + 3 hard = 10
        # NOTE: anchor items are ALSO counted in their difficulty bucket (usually medium),
        # so need_anchor and need_medium can overlap. This means the sum of per-bucket
        # needs can be < gap when the distribution is already met via overlap.
        need_anchor = max(0, 2 - (k.have_anchor or 0))
        need_easy   = max(0, 3 - (k.have_easy   or 0))
        need_med    = max(0, 2 - (k.have_med    or 0))
        need_hard   = max(0, 3 - (k.have_hard   or 0))
        dist_need   = need_anchor + need_easy + need_med + need_hard

        # If distribution targets are met but total < 10, fill remaining with hard items
        # (hard items are most valuable: push theta higher, best discrimination at high ability)
        extra_hard  = max(0, gap - dist_need)
        need_hard  += extra_hard
        need_total  = gap  # always equals gap_to_l1 — no more confusion

        if have == 0:
            tier = "T3_DEAD"
        elif have <= 4:
            tier = "T2_LOW"
        elif gap <= 3:
            tier = "T1_QUICK_WIN"
        else:
            tier = "T2_MID"

        rows.append(
            {
                "priority_tier": tier,
                "gap_to_l1": gap,
                "kc_code": k.code,
                "kc_name": k.name,
                "chapter_info": k.chapter_info or "",
                "have_total": have,
                "have_anchor": k.have_anchor or 0,
                "have_easy": k.have_easy or 0,
                "have_medium": k.have_med or 0,
                "have_hard": k.have_hard or 0,
                "need_anchor": need_anchor,
                "need_easy": need_easy,
                "need_medium": need_med,
                "need_hard": need_hard,
                "need_total": need_total,   # = gap_to_l1, always accurate
                "prerequisites": " | ".join(prereqs_map.get(k.id, ["(none)"])),
                "successors": " | ".join(successors_map.get(k.id, ["(none)"])),
                "existing_questions": " | ".join(existing_map.get(k.id, ["(none)"])),
            }
        )

    tier_order = {"T1_QUICK_WIN": 0, "T2_LOW": 1, "T2_MID": 2, "T3_DEAD": 3}
    rows.sort(key=lambda r: (tier_order.get(r["priority_tier"], 9), r["gap_to_l1"]))

    out = Path(__file__).parent.parent.parent / "docs" / "g6_question_gen_context.csv"
    with open(out, "w", newline="", encoding="utf-8-sig") as f:
        writer = csv.DictWriter(f, fieldnames=rows[0].keys())
        writer.writeheader()
        writer.writerows(rows)

    t1  = [r for r in rows if r["priority_tier"] == "T1_QUICK_WIN"]
    t2l = [r for r in rows if r["priority_tier"] == "T2_LOW"]
    t2m = [r for r in rows if r["priority_tier"] == "T2_MID"]
    t3  = [r for r in rows if r["priority_tier"] == "T3_DEAD"]

    print(f"Exported: {out}")
    print(f"Total G6 KCs needing items: {len(rows)}")
    print()
    print(f"T1 QUICK WIN (need ≤3 items): {len(t1):>3} KCs  →  {sum(r['need_total'] for r in t1):>3} items")
    print(f"T2 LOW       (have 1-4):      {len(t2l):>3} KCs  →  {sum(r['need_total'] for r in t2l):>3} items")
    print(f"T2 MID       (have 5-9, 4-5 gap): {len(t2m):>3} KCs  →  {sum(r['need_total'] for r in t2m):>3} items")
    print(f"T3 DEAD      (0 items):       {len(t3):>3} KCs  →  {sum(r['need_total'] for r in t3):>3} items")
    print()
    print("── T1 QUICK WINS (first 10) ──")
    for r in t1[:10]:
        print(
            f"  [{r['kc_code']}] {r['kc_name'][:42]:<42} "
            f"have={r['have_total']} need={r['need_total']} "
            f"(+{r['need_anchor']}anch +{r['need_easy']}easy +{r['need_medium']}med +{r['need_hard']}hard)"
        )


asyncio.run(main())
