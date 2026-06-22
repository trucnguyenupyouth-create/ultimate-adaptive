"""
Check KC readiness for Assessment Simulation — Grade 6
Queries DB for all KCs, their prerequisite edges, and item counts.
"""
import asyncio
import sys
sys.path.insert(0, "/Users/admin/ultimate-adaptive/backend")

from sqlalchemy import text
from app.core.database import engine

async def main():
    async with engine.connect() as conn:
        # 1. All Grade 6 KCs with item counts and edge counts
        result = await conn.execute(text("""
            SELECT 
                kc.id,
                kc.code,
                kc.name,
                kc.grade,
                kc.chapter_info,
                COUNT(DISTINCT i.id) FILTER (WHERE i.is_active = TRUE) AS total_items,
                COUNT(DISTINCT i.id) FILTER (WHERE i.is_active = TRUE AND i.irt_b < -0.5) AS easy_items,
                COUNT(DISTINCT i.id) FILTER (WHERE i.is_active = TRUE AND i.irt_b BETWEEN -0.5 AND 0.5) AS medium_items,
                COUNT(DISTINCT i.id) FILTER (WHERE i.is_active = TRUE AND i.irt_b > 0.5) AS hard_items,
                COUNT(DISTINCT i.id) FILTER (WHERE i.is_active = TRUE AND i.is_diagnostic_anchor = TRUE) AS anchor_items,
                (SELECT COUNT(*) FROM kc_prerequisites e WHERE e.kc_id = kc.id OR e.prereq_id = kc.id) AS edge_count
            FROM knowledge_components kc
            LEFT JOIN items i ON i.kc_id = kc.id
            WHERE kc.grade = 6
            GROUP BY kc.id, kc.code, kc.name, kc.grade, kc.chapter_info
            ORDER BY kc.code
        """))
        
        rows = result.fetchall()
        
        print("=" * 120)
        print(f"{'Code':<20} {'Name':<30} {'ChInfo':<8} {'Total':>5} {'Easy':>5} {'Med':>5} {'Hard':>5} {'Anchor':>6} {'Edges':>5} {'Status'}")
        print("=" * 120)
        
        ready = 0
        not_ready = 0
        no_items = 0
        
        for row in rows:
            code = row.code or "?"
            name = (row.name or "?")[:28]
            ch = row.chapter_info or "-"
            total = row.total_items
            easy = row.easy_items
            med = row.medium_items
            hard = row.hard_items
            anchor = row.anchor_items
            edges = row.edge_count
            
            # Readiness criteria:
            # - At least 3 items total
            # - At least 1 easy, 1 medium, 1 hard
            # - At least 1 diagnostic anchor
            # - At least 1 edge in graph
            issues = []
            if total < 3:
                issues.append(f"items<3({total})")
            if easy < 1:
                issues.append("no_easy")
            if med < 1:
                issues.append("no_med")
            if hard < 1:
                issues.append("no_hard")
            if anchor < 1:
                issues.append("no_anchor")
            if edges < 1:
                issues.append("no_edges")
            
            if not issues:
                status = "✅ READY"
                ready += 1
            elif total == 0:
                status = "🔴 NO ITEMS"
                no_items += 1
            else:
                status = f"⚠️  {', '.join(issues)}"
                not_ready += 1
            
            print(f"{code:<20} {name:<30} {ch:<8} {total:>5} {easy:>5} {med:>5} {hard:>5} {anchor:>6} {edges:>5} {status}")
        
        print("=" * 120)
        print(f"\nSummary: {len(rows)} KCs total | ✅ {ready} ready | ⚠️  {not_ready} partial | 🔴 {no_items} no items")
        
        # 2. Prerequisite edges for grade 6
        print("\n\n--- Prerequisite Edges (Grade 6) ---")
        edge_result = await conn.execute(text("""
            SELECT 
                src.code as prereq_code,
                tgt.code as kc_code,
                src.name as prereq_name,
                tgt.name as kc_name
            FROM kc_prerequisites e
            JOIN knowledge_components src ON src.id = e.prereq_id
            JOIN knowledge_components tgt ON tgt.id = e.kc_id
            WHERE src.grade = 6 AND tgt.grade = 6
            ORDER BY src.code, tgt.code
        """))
        
        edges = edge_result.fetchall()
        print(f"\nTotal edges: {len(edges)}")
        for e in edges:
            print(f"  {e.prereq_code} → {e.kc_code}  ({e.prereq_name} → {e.kc_name})")

asyncio.run(main())
