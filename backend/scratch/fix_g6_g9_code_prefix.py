"""
Fix grade=6 KC codes that accidentally start with G9-.

Dry run:
  python scratch/fix_g6_g9_code_prefix.py

Apply:
  python scratch/fix_g6_g9_code_prefix.py --apply
"""

from __future__ import annotations

import argparse
import asyncio
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent))

from sqlalchemy import select

from app.core.config import settings
from app.core.database import AsyncSessionLocal
from app.models.models import GraphEditHistory, KnowledgeComponent


def next_available_code(target: str, existing_codes: set[str]) -> str:
    if target not in existing_codes:
        return target

    suffix = 1
    base = target
    if "-" in target:
        head, tail = target.rsplit("-", 1)
        if tail.isdigit():
            base = head
            suffix = int(tail) + 1

    while True:
        candidate = f"{base}-{suffix}"
        if candidate not in existing_codes:
            return candidate
        suffix += 1


async def clear_redis_graph_cache() -> bool:
    try:
        import redis.asyncio as aioredis

        client = aioredis.from_url(settings.REDIS_URL, decode_responses=True)
        await client.delete("GRAPH_JSON")
        if hasattr(client, "aclose"):
            await client.aclose()
        else:
            await client.close()
        return True
    except Exception as exc:
        print(f"warn: could not clear Redis GRAPH_JSON cache: {exc}")
        return False


async def main(apply: bool) -> None:
    async with AsyncSessionLocal() as db:
        rows = (
            await db.execute(
                select(KnowledgeComponent)
                .where(KnowledgeComponent.grade == 6, KnowledgeComponent.code.like("G9-%"))
                .order_by(KnowledgeComponent.code)
            )
        ).scalars().all()
        existing_codes = set((await db.execute(select(KnowledgeComponent.code))).scalars().all())

        planned: list[tuple[KnowledgeComponent, str, str]] = []
        for kc in rows:
            base_target = "G6-" + kc.code[3:]
            target = next_available_code(base_target, existing_codes)
            existing_codes.remove(kc.code)
            existing_codes.add(target)
            planned.append((kc, base_target, target))

        print(f"Found {len(planned)} grade=6 KCs with G9- prefix.")
        for kc, base_target, target in planned:
            collision_note = " collision-resolved" if base_target != target else ""
            print(f"{kc.code} -> {target}{collision_note} | {kc.name}")

        if not apply:
            print("\nDry run only. Re-run with --apply to update the database.")
            return

        for kc, base_target, target in planned:
            old_code = kc.code
            kc.code = target
            db.add(
                GraphEditHistory(
                    action="update_kc",
                    entity_id=kc.id,
                    entity_type="kc",
                    payload={
                        "code": target,
                        "old_code": old_code,
                        "base_target_code": base_target,
                        "reason": "Normalize grade=6 KC code prefix from G9 to G6",
                    },
                )
            )

        await db.commit()
        print(f"\nUpdated {len(planned)} KC codes.")

    cache_cleared = await clear_redis_graph_cache()
    print(f"Redis graph cache cleared: {cache_cleared}")


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--apply", action="store_true", help="Commit code updates to the database")
    args = parser.parse_args()
    asyncio.run(main(apply=args.apply))
