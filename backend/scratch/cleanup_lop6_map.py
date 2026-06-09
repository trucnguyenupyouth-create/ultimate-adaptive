import asyncio
import os
import sys
import uuid
from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker
from sqlalchemy import select, delete

# Add parent directory to path so app can be imported
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.models.models import KnowledgeComponent, KCPrerequisite, GraphEditHistory

DATABASE_URL = os.environ.get("DATABASE_URL")
if not DATABASE_URL:
    print("Error: DATABASE_URL environment variable is not set.")
    sys.exit(1)

CODES_TO_DELETE = [
    "PREREQ.C4.K1.L6", "B1.C1.K1.L6", "B2.C1.K1.L6", "B3.C1.K1.L6",
    "B4.C1.K1.L6", "B5.C1.K1.L6", "B6.C1.K1.L6", "B7.C1.K1.L6",
    "B8.C1.K1.L6", "B9.C1.K1.L6", "B10.C2.K1.L6", "B11.C2.K1.L6",
    "B12.C2.K1.L6", "B★.C2.K1.L6", "B13.C3.K1.L6", "B14.C3.K1.L6",
    "B15.C3.K1.L6", "B16a.C3.K1.L6", "B16b.C3.K1.L6", "B18.C4.K1.L6",
    "B19.C4.K1.L6", "B21.C4.K1.L6", "B22.C4.K1.L6"
]

async def cleanup():
    print("Connecting to database...")
    engine = create_async_engine(DATABASE_URL, echo=False)
    AsyncSessionLocal = async_sessionmaker(engine, expire_on_commit=False)
    
    async with AsyncSessionLocal() as session:
        # 1. Fetch UUIDs of KCs to delete
        stmt = select(KnowledgeComponent.id).where(KnowledgeComponent.code.in_(CODES_TO_DELETE))
        res = await session.execute(stmt)
        kc_uuids = [str(uid) for uid in res.scalars().all()]
        
        if not kc_uuids:
            print("No matching KCs found to delete. Database is already clean.")
            await engine.dispose()
            return

        print(f"Found {len(kc_uuids)} Knowledge Components to delete.")
        
        # 2. Delete edit history records referencing these KCs
        print("Cleaning up GraphEditHistory...")
        history_stmt = select(GraphEditHistory)
        history_res = await session.execute(history_stmt)
        history_records = history_res.scalars().all()
        
        deleted_history_count = 0
        for h in history_records:
            # Check if payload mentions any of the deleted KC UUIDs
            payload = h.payload or {}
            kc_id = payload.get("kc_id")
            prereq_id = payload.get("prereq_id")
            
            if kc_id in kc_uuids or prereq_id in kc_uuids:
                await session.delete(h)
                deleted_history_count += 1
                
        print(f"  → Deleted {deleted_history_count} history records.")

        # 3. Delete Knowledge Components (this will cascade delete edges from kc_prerequisites)
        print("Deleting Knowledge Components (cascade delete on edges)...")
        delete_stmt = delete(KnowledgeComponent).where(KnowledgeComponent.code.in_(CODES_TO_DELETE))
        delete_res = await session.execute(delete_stmt)
        deleted_kcs = delete_res.rowcount
        
        await session.commit()
        print(f"Successfully deleted {deleted_kcs} Knowledge Components and cascaded all prerequisite edges!")
        
    await engine.dispose()

if __name__ == "__main__":
    asyncio.run(cleanup())
