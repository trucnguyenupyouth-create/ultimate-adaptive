"""
Full audit: quantity + quality readiness for ALL G6 KCs in the filtered list.

Checks per KC:
  1. Total items (active in item bank) vs need_total
  2. Pending drafts (not yet approved) — buffer
  3. Difficulty distribution: easy / medium / hard
  4. Anchor coverage (is_diagnostic_anchor=True)
  5. Need to generate more? (gap = need_total - active - pending)

Adaptive Learning Requirements (from gen_guide.md):
  - Minimum: need_total items active in item bank (10 for big KCs, 4-5 for small)
  - Must have: ≥1 diagnostic anchor (is_diagnostic_anchor=True)
  - Distribution: roughly 2-3 easy, 2-3 medium, 3-5 hard for a 10-item KC
  - For small KCs (need=4): ≥1 easy, ≥1 medium, ≥1 hard
"""
import asyncio, sys, csv
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent))
from sqlalchemy import text
from app.core.database import AsyncSessionLocal

CSV_PATH = Path(__file__).parent.parent.parent / "docs" / "g6_question_gen_context_filtered.csv"


async def main():
    # ── Load filtered KC list ─────────────────────────────────────────────────
    kc_list = []
    with open(CSV_PATH, encoding="utf-8-sig") as f:
        for row in csv.DictReader(f):
            code = row.get("kc_code", "").strip()
            if not code:
                continue
            try:
                need = int(row.get("need_total", 0))
            except ValueError:
                need = 0
            kc_list.append({
                "code": code,
                "name": row.get("kc_name", "").strip(),
                "need": need,
            })
    codes = [k["code"] for k in kc_list]
    print(f"Filtered KC list: {len(kc_list)} nodes\n")

    # ── Query DB ──────────────────────────────────────────────────────────────
    async with AsyncSessionLocal() as db:
        r_items = await db.execute(text("""
            SELECT kc.code,
                   COUNT(i.id) FILTER (WHERE i.is_active)                                   AS total,
                   COUNT(i.id) FILTER (WHERE i.is_active AND i.difficulty_label='easy')     AS easy,
                   COUNT(i.id) FILTER (WHERE i.is_active AND i.difficulty_label='medium')   AS medium,
                   COUNT(i.id) FILTER (WHERE i.is_active AND i.difficulty_label='hard')     AS hard,
                   COUNT(i.id) FILTER (WHERE i.is_active AND i.is_diagnostic_anchor)        AS anchors
            FROM knowledge_components kc
            LEFT JOIN items i ON i.kc_id = kc.id
            WHERE kc.code = ANY(:codes)
            GROUP BY kc.code
        """), {"codes": codes})
        db_items = {r.code: {"total": r.total or 0, "easy": r.easy or 0,
                              "med": r.medium or 0, "hard": r.hard or 0,
                              "anchors": r.anchors or 0}
                    for r in r_items.fetchall()}

        r_drafts = await db.execute(text("""
            SELECT kc.code, COUNT(d.id) AS cnt
            FROM item_drafts d
            JOIN knowledge_components kc ON kc.id = d.kc_id
            WHERE kc.code = ANY(:codes)
              AND d.status = 'pending'
              AND (d.flagged IS NULL OR d.flagged = false)
            GROUP BY kc.code
        """), {"codes": codes})
        pending_map = {r.code: r.cnt for r in r_drafts.fetchall()}

    # ── Evaluate each KC ──────────────────────────────────────────────────────
    # Status categories
    READY       = []  # item bank fully stocked, all quality checks pass
    NEAR_READY  = []  # pending drafts make up the gap — just need approval
    NEEDS_GEN   = []  # still short even counting pending
    QUALITY_GAP = []  # quantity ok but missing anchor or bad distribution

    print(f"{'Code':<35} {'Name':<45} {'need':>4} {'DB':>4} {'pend':>5} {'gap':>4}  {'e/m/h/anc':>10}  Issues")
    print("-" * 130)

    for kc in kc_list:
        code  = kc["code"]
        need  = kc["need"]
        db    = db_items.get(code, {"total": 0, "easy": 0, "med": 0, "hard": 0, "anchors": 0})
        pend  = pending_map.get(code, 0)
        total = db["total"]
        gap   = max(0, need - total)
        issues = []

        # Quantity check
        if total >= need:
            qty_ok = True
        elif total + pend >= need:
            qty_ok = True  # pending will cover
        else:
            qty_ok = False
            issues.append(f"SHORT {total+pend}/{need}")

        # Anchor check
        if db["anchors"] == 0 and total > 0:
            issues.append("NO_ANCHOR")
        elif db["anchors"] == 0 and pend > 0:
            issues.append("no_anchor_yet(pending)")

        # Distribution check (only meaningful for ≥4 active items)
        if total >= 4:
            if db["hard"] == 0:
                issues.append("NO_HARD")
            if db["easy"] == 0:
                issues.append("NO_EASY")
            if need >= 8 and db["med"] == 0:
                issues.append("NO_MED")

        diff_str = f"{db['easy']}/{db['med']}/{db['hard']}/{db['anchors']}"

        # Classify
        if not issues:
            READY.append(code)
            status = "✅"
        elif qty_ok and all(i.startswith("no_anchor_yet") for i in issues):
            NEAR_READY.append(code)
            status = "🟡 approve_pending"
        elif not qty_ok:
            NEEDS_GEN.append(code)
            status = "🔴"
        else:
            QUALITY_GAP.append(code)
            status = "🟠"

        issues_str = ", ".join(issues) if issues else ""
        print(f"  {code:<33} {kc['name'][:43]:<45} {need:>4} {total:>4} {pend:>5} {gap:>4}  {diff_str:>10}  {status} {issues_str}")

    # ── Summary ───────────────────────────────────────────────────────────────
    print(f"\n{'='*130}")
    print(f"\n  📊 SUMMARY ({len(kc_list)} KCs total in filtered list)")
    print(f"  ✅  READY             — {len(READY):>3}  (item bank full, anchor present, distribution ok)")
    print(f"  🟡  NEAR READY        — {len(NEAR_READY):>3}  (pending drafts cover gap — just APPROVE)")
    print(f"  🟠  QUALITY GAP       — {len(QUALITY_GAP):>3}  (enough items but missing anchor or distribution)")
    print(f"  🔴  NEEDS GENERATION  — {len(NEEDS_GEN):>3}  (still short even with pending)")
    total_pend_needed = sum(max(0, kc_list[i]["need"] - db_items.get(kc_list[i]["code"],{}).get("total",0)) for i in range(len(kc_list)))

    if NEEDS_GEN:
        print(f"\n  🔴 KCs still short (need more generation):")
        for code in NEEDS_GEN:
            kc = next(k for k in kc_list if k["code"] == code)
            db = db_items.get(code, {"total": 0})
            pend = pending_map.get(code, 0)
            still_need = kc["need"] - db["total"] - pend
            print(f"    {code}: need {still_need} more (active={db['total']}, pending={pend}, need={kc['need']})")

    if QUALITY_GAP:
        print(f"\n  🟠 KCs with quality gaps:")
        for code in QUALITY_GAP:
            kc = next(k for k in kc_list if k["code"] == code)
            db = db_items.get(code, {"total": 0, "easy": 0, "med": 0, "hard": 0, "anchors": 0})
            issues = []
            if db["anchors"] == 0:
                issues.append("no anchor")
            if db["hard"] == 0:
                issues.append("no hard")
            if db["easy"] == 0:
                issues.append("no easy")
            print(f"    {code}: {', '.join(issues)}")

    if NEAR_READY:
        print(f"\n  🟡 Near-ready KCs (approve pending drafts to unlock):")
        for code in NEAR_READY:
            pend = pending_map.get(code, 0)
            print(f"    {code}: {pend} pending drafts to approve")

asyncio.run(main())
