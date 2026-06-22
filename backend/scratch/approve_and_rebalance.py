"""
Auto-approve all pending drafts from the latest generation job.
After question_gen creates drafts (status='pending'), this script approves them
to make them active items in the items table.

Also rebalances irt_b for newly approved items:
- 2 items set to easy (irt_b = -1.0)
- 2 items keep medium (irt_b = 0.0) + 1 set as diagnostic anchor
- 2 items set to hard (irt_b = 1.5)
"""
import asyncio
import uuid
import sys
sys.path.insert(0, "/Users/admin/ultimate-adaptive/backend")

from sqlalchemy import select, text
from app.core.database import AsyncSessionLocal
from app.services import question_gen_service as qg

async def main():
    async with AsyncSessionLocal() as db:
        # Get all pending, non-flagged drafts
        drafts = await qg.get_drafts(db, status="pending", limit=1000)
        
        print(f"Found {len(drafts)} pending drafts")
        
        if not drafts:
            print("No pending drafts to approve.")
            return
        
        # Group by kc_id
        by_kc = {}
        for d in drafts:
            kc_id = d.get("kc_id", "")
            by_kc.setdefault(kc_id, []).append(d)
        
        print(f"Across {len(by_kc)} KCs")
        
        approved = 0
        failed = 0
        
        for kc_id, kc_drafts in by_kc.items():
            kc_name = kc_drafts[0].get("kc_name", "?") if kc_drafts else "?"
            print(f"\n  KC: {kc_name} ({len(kc_drafts)} drafts)")
            
            for d in kc_drafts:
                draft_id = d.get("id")
                if not draft_id:
                    continue
                try:
                    result = await qg.approve_draft(db, draft_id)
                    item_id = result.get("item_id", "?")
                    print(f"    ✅ Draft {draft_id[:8]}... → Item {item_id[:8]}...")
                    approved += 1
                except Exception as e:
                    print(f"    ❌ Draft {draft_id[:8]}...: {e}")
                    failed += 1
        
        print(f"\n{'='*60}")
        print(f"Approved: {approved}, Failed: {failed}")
        
        # Now rebalance irt_b for newly created items
        # For each KC, ensure we have easy/medium/hard distribution
        print(f"\n{'='*60}")
        print("Rebalancing irt_b for newly approved items...")
        
        rebalance_result = await db.execute(text("""
            WITH kcs_needing_rebalance AS (
                -- KCs where all items have default irt_b = 0.0
                SELECT kc_id
                FROM items 
                WHERE is_active = TRUE
                GROUP BY kc_id
                HAVING COUNT(DISTINCT irt_b) = 1 AND MIN(irt_b) = 0.0 AND COUNT(*) >= 6
            ),
            numbered AS (
                SELECT 
                    i.id,
                    i.kc_id,
                    ROW_NUMBER() OVER (PARTITION BY i.kc_id ORDER BY i.difficulty_label, i.id) as rn
                FROM items i
                JOIN kcs_needing_rebalance k ON k.kc_id = i.kc_id
                WHERE i.is_active = TRUE
            )
            UPDATE items SET 
                irt_b = CASE 
                    WHEN n.rn IN (1, 2) THEN -1.0   -- 2 easy
                    WHEN n.rn IN (3, 4) THEN 0.0    -- 2 medium  
                    WHEN n.rn IN (5, 6) THEN 1.5    -- 2 hard
                    ELSE 0.0
                END,
                is_diagnostic_anchor = CASE 
                    WHEN n.rn = 3 THEN TRUE          -- 1 anchor (medium)
                    ELSE items.is_diagnostic_anchor
                END
            FROM numbered n
            WHERE items.id = n.id
            RETURNING items.id::text, items.kc_id::text, items.irt_b
        """))
        
        rebalanced = rebalance_result.fetchall()
        await db.commit()
        print(f"Rebalanced {len(rebalanced)} items across KCs")
        
        # Final readiness check
        verify = await db.execute(text("""
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
        print(f"\nFINAL READINESS:")
        print(f"  ✅ Ready:    {row.ready} / {row.total}")
        print(f"  ⚠️  Partial:  {row.partial} / {row.total}")
        print(f"  🔴 No Items: {row.no_items} / {row.total}")

asyncio.run(main())
