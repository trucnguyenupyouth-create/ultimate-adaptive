"""
Standalone runner: Grade 7 Semester 1 question generation.
Connects to Supabase production DB via DATABASE_URL in backend/.env
Runs in foreground so output is visible.
"""
import asyncio
import sys
import os
from pathlib import Path

# Add backend to path
sys.path.insert(0, str(Path(__file__).parent.parent))
os.chdir(Path(__file__).parent.parent)

# Load .env
from dotenv import load_dotenv
load_dotenv(Path(__file__).parent.parent / ".env")

from app.core.database import AsyncSessionLocal
from app.services import question_gen_service as qg

TARGET_GRADE    = 7
TARGET_SEMESTER = 1
SKIP_THRESHOLD  = 6   # skip KC only if >= 6 valid (non-flagged) pending drafts
RATE_LIMIT_S    = 2.0 # seconds between Gemini calls

async def main():
    print(f"\n{'='*60}")
    print(f"  Grade {TARGET_GRADE} · Semester {TARGET_SEMESTER} — MCQ Generation")
    print(f"  Skip threshold : {SKIP_THRESHOLD} valid pending drafts")
    print(f"  Rate limit     : {RATE_LIMIT_S}s between calls")
    print(f"{'='*60}\n")

    generated = skipped = errors = 0

    async def progress_cb(kc_code: str, result: dict):
        nonlocal generated, skipped, errors
        status = result["status"]
        reason = result.get("reason", "")
        cost   = result.get("cost_usd", 0.0)

        if status == "generated":
            generated += 1
            print(f"  ✅ [{generated:>3} gen] {kc_code:<35} +{result['count']} drafts  ${cost:.4f}")
        elif status == "skipped":
            skipped += 1
            print(f"  ⏭️  [{skipped:>3} skip] {kc_code:<35} {reason}")
        else:
            errors += 1
            print(f"  ❌ [{errors:>3} err ] {kc_code:<35} {reason}")

    async with AsyncSessionLocal() as db:
        # Dry-run first: show how many KCs will be processed
        all_kcs = await qg.get_kcs_with_edges(db)
        target_kcs = [
            kc for kc in all_kcs
            if kc.get("grade") == TARGET_GRADE
            and qg.chapter_info_matches_semester(
                kc.get("chapter_info"), TARGET_SEMESTER, TARGET_GRADE
            )
        ]
        print(f"  Found {len(target_kcs)} G{TARGET_GRADE} Sem{TARGET_SEMESTER} KCs to process\n")

        result = await qg.run_generation_job(
            db=db,
            skip_threshold=SKIP_THRESHOLD,
            rate_limit_seconds=RATE_LIMIT_S,
            progress_callback=progress_cb,
            target_grade=TARGET_GRADE,
            target_semester=TARGET_SEMESTER,
        )

    print(f"\n{'='*60}")
    print(f"  ✅ Generated : {result['generated']}")
    print(f"  ⏭️  Skipped   : {result['skipped']}")
    print(f"  ❌ Errors    : {result['errors']}")
    print(f"  💰 Cost      : ${result['cost_usd']:.4f} USD")
    print(f"{'='*60}\n")

asyncio.run(main())
