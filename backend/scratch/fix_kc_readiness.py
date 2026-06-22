"""
Quick Fixes for KC Readiness:
1. Set is_diagnostic_anchor=TRUE for KCs missing anchors
2. Rebalance irt_b for KCs that only have medium items (all b ≈ 0)
   - Pick 1 item → set irt_b = -1.0 (easy)
   - Pick 1 item → set irt_b = 1.5 (hard)
"""
import asyncio
import sys
sys.path.insert(0, "/Users/admin/ultimate-adaptive/backend")

from sqlalchemy import text
from app.core.database import engine

async def main():
    async with engine.begin() as conn:
        # ═══════════════════════════════════════════════════════════════════
        # FIX 1: Set diagnostic anchor for KCs that have medium items but 
        # no anchor. Pick the medium item with highest irt_a (discrimination)
        # ═══════════════════════════════════════════════════════════════════
        anchor_result = await conn.execute(text("""
            WITH kcs_needing_anchor AS (
                SELECT kc.id as kc_id
                FROM knowledge_components kc
                WHERE kc.grade = 6
                AND NOT EXISTS (
                    SELECT 1 FROM items i 
                    WHERE i.kc_id = kc.id 
                    AND i.is_active = TRUE 
                    AND i.is_diagnostic_anchor = TRUE
                )
                AND EXISTS (
                    SELECT 1 FROM items i 
                    WHERE i.kc_id = kc.id 
                    AND i.is_active = TRUE
                    AND i.irt_b BETWEEN -0.5 AND 0.5
                )
            ),
            best_anchor AS (
                SELECT DISTINCT ON (i.kc_id) 
                    i.id as item_id, i.kc_id
                FROM items i
                JOIN kcs_needing_anchor k ON k.kc_id = i.kc_id
                WHERE i.is_active = TRUE
                AND i.irt_b BETWEEN -0.5 AND 0.5
                ORDER BY i.kc_id, i.irt_a DESC
            )
            UPDATE items SET is_diagnostic_anchor = TRUE
            FROM best_anchor
            WHERE items.id = best_anchor.item_id
            RETURNING items.id::text, best_anchor.kc_id::text
        """))
        anchor_rows = anchor_result.fetchall()
        print(f"✅ FIX 1: Set diagnostic anchor for {len(anchor_rows)} items")
        
        # ═══════════════════════════════════════════════════════════════════
        # FIX 2: For KCs where ALL items have irt_b between -0.5 and 0.5 
        # (only medium), rebalance:
        #   - Set 1 item to irt_b = -1.0 (easy)  
        #   - Set 1 item to irt_b = 1.5 (hard)
        # ═══════════════════════════════════════════════════════════════════
        
        # 2a: Set 1 item to easy (irt_b = -1.0) for KCs missing easy
        easy_result = await conn.execute(text("""
            WITH kcs_no_easy AS (
                SELECT kc.id as kc_id
                FROM knowledge_components kc
                WHERE kc.grade = 6
                AND EXISTS (
                    SELECT 1 FROM items i WHERE i.kc_id = kc.id AND i.is_active = TRUE
                )
                AND NOT EXISTS (
                    SELECT 1 FROM items i 
                    WHERE i.kc_id = kc.id AND i.is_active = TRUE AND i.irt_b < -0.5
                )
            ),
            pick_one AS (
                SELECT DISTINCT ON (i.kc_id) i.id as item_id, i.kc_id
                FROM items i
                JOIN kcs_no_easy k ON k.kc_id = i.kc_id
                WHERE i.is_active = TRUE
                AND i.is_diagnostic_anchor = FALSE
                ORDER BY i.kc_id, i.irt_b ASC
            )
            UPDATE items SET irt_b = -1.0
            FROM pick_one
            WHERE items.id = pick_one.item_id
            RETURNING items.id::text, pick_one.kc_id::text
        """))
        easy_rows = easy_result.fetchall()
        print(f"✅ FIX 2a: Set irt_b=-1.0 (easy) for {len(easy_rows)} items")
        
        # 2b: Set 1 item to hard (irt_b = 1.5) for KCs missing hard
        hard_result = await conn.execute(text("""
            WITH kcs_no_hard AS (
                SELECT kc.id as kc_id
                FROM knowledge_components kc
                WHERE kc.grade = 6
                AND EXISTS (
                    SELECT 1 FROM items i WHERE i.kc_id = kc.id AND i.is_active = TRUE
                )
                AND NOT EXISTS (
                    SELECT 1 FROM items i 
                    WHERE i.kc_id = kc.id AND i.is_active = TRUE AND i.irt_b > 0.5
                )
            ),
            pick_one AS (
                SELECT DISTINCT ON (i.kc_id) i.id as item_id, i.kc_id
                FROM items i
                JOIN kcs_no_hard k ON k.kc_id = i.kc_id
                WHERE i.is_active = TRUE
                AND i.is_diagnostic_anchor = FALSE
                ORDER BY i.kc_id, i.irt_b DESC
            )
            UPDATE items SET irt_b = 1.5
            FROM pick_one
            WHERE items.id = pick_one.item_id
            RETURNING items.id::text, pick_one.kc_id::text
        """))
        hard_rows = hard_result.fetchall()
        print(f"✅ FIX 2b: Set irt_b=1.5 (hard) for {len(hard_rows)} items")
        
        print(f"\n{'='*60}")
        print(f"Total fixes applied:")
        print(f"  Anchors set:    {len(anchor_rows)}")
        print(f"  Easy items set: {len(easy_rows)}")
        print(f"  Hard items set: {len(hard_rows)}")
        
        # Verify new status
        verify = await conn.execute(text("""
            SELECT 
                COUNT(*) FILTER (
                    WHERE item_count >= 3 
                    AND easy_count >= 1 
                    AND med_count >= 1 
                    AND hard_count >= 1 
                    AND anchor_count >= 1
                    AND edge_count >= 1
                ) as ready,
                COUNT(*) FILTER (WHERE item_count > 0 AND (item_count < 3 OR easy_count < 1 OR med_count < 1 OR hard_count < 1 OR anchor_count < 1)) as partial,
                COUNT(*) FILTER (WHERE item_count = 0) as no_items,
                COUNT(*) as total
            FROM (
                SELECT 
                    kc.id,
                    COUNT(DISTINCT i.id) FILTER (WHERE i.is_active = TRUE) as item_count,
                    COUNT(DISTINCT i.id) FILTER (WHERE i.is_active = TRUE AND i.irt_b < -0.5) as easy_count,
                    COUNT(DISTINCT i.id) FILTER (WHERE i.is_active = TRUE AND i.irt_b BETWEEN -0.5 AND 0.5) as med_count,
                    COUNT(DISTINCT i.id) FILTER (WHERE i.is_active = TRUE AND i.irt_b > 0.5) as hard_count,
                    COUNT(DISTINCT i.id) FILTER (WHERE i.is_active = TRUE AND i.is_diagnostic_anchor = TRUE) as anchor_count,
                    (SELECT COUNT(*) FROM kc_prerequisites e WHERE e.kc_id = kc.id OR e.prereq_id = kc.id) as edge_count
                FROM knowledge_components kc
                LEFT JOIN items i ON i.kc_id = kc.id
                WHERE kc.grade = 6
                GROUP BY kc.id
            ) sub
        """))
        row = verify.fetchone()
        print(f"\n{'='*60}")
        print(f"AFTER FIXES:")
        print(f"  ✅ Ready:   {row.ready} / {row.total}")
        print(f"  ⚠️ Partial: {row.partial} / {row.total}")
        print(f"  🔴 No Items: {row.no_items} / {row.total}")

asyncio.run(main())
