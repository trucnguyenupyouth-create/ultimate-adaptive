"""
Generate questions for KCs missing items — FIXED version.
Creates a fresh DB session per KC to avoid connection timeout.
Only generates for KCs with 0 active items.
"""
import asyncio
import uuid
import sys
sys.path.insert(0, "/Users/admin/ultimate-adaptive/backend")

from sqlalchemy import text
from app.core.database import AsyncSessionLocal
from app.services import question_gen_service as qg

async def get_kcs_needing_items():
    """Get all KCs with edges but 0 active items."""
    async with AsyncSessionLocal() as db:
        result = await db.execute(text("""
            SELECT 
                kc.id::text as id,
                kc.code,
                kc.name,
                kc.chapter_info,
                kc.grade
            FROM knowledge_components kc
            WHERE kc.grade = 6
            AND (
                SELECT COUNT(*) FROM kc_prerequisites e 
                WHERE e.kc_id = kc.id OR e.prereq_id = kc.id
            ) > 0
            AND (
                SELECT COUNT(*) FROM items i 
                WHERE i.kc_id = kc.id AND i.is_active = TRUE
            ) = 0
            AND (
                SELECT COUNT(*) FROM item_drafts d
                WHERE d.kc_id = kc.id AND d.status = 'pending'
            ) < 6
            ORDER BY kc.chapter_info, kc.code
        """))
        return [dict(r._mapping) for r in result.fetchall()]


async def generate_for_single_kc(kc: dict, job_id: uuid.UUID) -> dict:
    """Generate items for a single KC with its own DB session."""
    async with AsyncSessionLocal() as db:
        try:
            # Load SGK content
            grade = kc.get("grade", 6)
            sgk_by_tap = qg._load_sgk_for_grade(grade)
            
            result = await qg.generate_for_kc(
                db=db,
                kc=kc,
                sgk_by_tap=sgk_by_tap,
                job_id=job_id,
                skip_threshold=100,  # never skip (these KCs have 0 items)
                grade=grade,
            )
            return result
        except Exception as e:
            return {"status": "error", "error": str(e), "count": 0}


async def main():
    kcs = await get_kcs_needing_items()
    print(f"Found {len(kcs)} KCs needing items\n")
    
    if not kcs:
        print("All KCs already have items or pending drafts.")
        return
    
    job_id = uuid.uuid4()
    generated = 0
    errors = 0
    total_items = 0
    
    for i, kc in enumerate(kcs):
        print(f"[{i+1}/{len(kcs)}] {kc['code']} ({kc['name'][:40]})...", end=" ", flush=True)
        
        result = await generate_for_single_kc(kc, job_id)
        status = result.get("status", "error")
        count = result.get("count", 0)
        
        if status == "generated":
            generated += 1
            total_items += count
            cost = result.get("cost_usd", 0)
            print(f"✅ {count} items (${cost:.4f})")
        elif status == "skipped":
            reason = result.get("reason", "")[:50]
            print(f"⏭️ {reason}")
        else:
            errors += 1
            err = result.get("error", "unknown")[:80]
            print(f"❌ {err}")
        
        # Rate limiting between Gemini API calls
        await asyncio.sleep(2.0)
    
    print(f"\n{'='*60}")
    print(f"DONE: {generated} KCs generated, {total_items} total items, {errors} errors")
    
    # Check pending drafts count
    async with AsyncSessionLocal() as db:
        result = await db.execute(text("SELECT COUNT(*) FROM item_drafts WHERE status = 'pending'"))
        pending = result.scalar()
        print(f"Pending drafts ready to approve: {pending}")

asyncio.run(main())
