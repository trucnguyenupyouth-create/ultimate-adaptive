import asyncio, sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).parent.parent))
from sqlalchemy import text
from app.core.database import AsyncSessionLocal

CODE = "G6-MATH-UOC-LUONG-KET"

async def main():
    async with AsyncSessionLocal() as db:
        r = await db.execute(text("""
            SELECT kc.code, kc.name, kc.chapter_info,
                   COUNT(i.id) FILTER (WHERE i.is_active)                                   AS total,
                   COUNT(i.id) FILTER (WHERE i.is_active AND i.difficulty_label='easy')     AS easy,
                   COUNT(i.id) FILTER (WHERE i.is_active AND i.difficulty_label='medium')   AS medium,
                   COUNT(i.id) FILTER (WHERE i.is_active AND i.difficulty_label='hard')     AS hard,
                   COUNT(i.id) FILTER (WHERE i.is_active AND i.is_diagnostic_anchor)        AS anchors
            FROM knowledge_components kc
            LEFT JOIN items i ON i.kc_id = kc.id
            WHERE kc.code = :code
            GROUP BY kc.code, kc.name, kc.chapter_info
        """), {"code": CODE})
        row = r.fetchone()
        if row:
            print(f"[{row.code}] {row.name}")
            print(f"  chapter: {row.chapter_info}")
            print(f"  DB items: total={row.total} easy={row.easy} med={row.medium} hard={row.hard} anchors={row.anchors}")
        else:
            print("Node not found in DB")
            return

        r2 = await db.execute(text("""
            SELECT i.difficulty_label, i.is_diagnostic_anchor,
                   i.content->>'question' as q
            FROM items i
            JOIN knowledge_components kc ON kc.id = i.kc_id
            WHERE kc.code = :code AND i.is_active
            ORDER BY i.difficulty_label, i.is_diagnostic_anchor DESC
        """), {"code": CODE})
        for row in r2.fetchall():
            anchor = "[A]" if row.is_diagnostic_anchor else "   "
            print(f"  [{row.difficulty_label}]{anchor} {(row.q or '')[:90]}")

asyncio.run(main())
