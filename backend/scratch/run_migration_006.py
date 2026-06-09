"""
Run migration 006 via the live FastAPI app's DB connection.
Usage: python3 scratch/run_migration_006.py
"""
import asyncio
import os
from pathlib import Path

# Load .env manually
env_path = Path(__file__).parent.parent / ".env"
if env_path.exists():
    for line in env_path.read_text().splitlines():
        if "=" in line and not line.startswith("#"):
            k, v = line.split("=", 1)
            os.environ.setdefault(k.strip(), v.strip())

from sqlalchemy.ext.asyncio import create_async_engine
from sqlalchemy import text

DATABASE_URL = os.environ["DATABASE_URL"]

SQL = """
ALTER TABLE kc_prerequisites
  ADD COLUMN IF NOT EXISTS edge_type VARCHAR(20) NOT NULL DEFAULT 'prerequisite';

ALTER TABLE kc_prerequisites
  DROP CONSTRAINT IF EXISTS kc_prerequisites_edge_type_check;

ALTER TABLE kc_prerequisites
  ADD CONSTRAINT kc_prerequisites_edge_type_check
  CHECK (edge_type IN ('prerequisite', 'inference', 'unsure'));

CREATE TABLE IF NOT EXISTS graph_notes (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    content     TEXT NOT NULL DEFAULT '',
    x           FLOAT NOT NULL DEFAULT 0.0,
    y           FLOAT NOT NULL DEFAULT 0.0,
    width       FLOAT NOT NULL DEFAULT 200.0,
    height      FLOAT NOT NULL DEFAULT 150.0,
    color       VARCHAR(20) NOT NULL DEFAULT 'yellow',
    created_at  TIMESTAMPTZ DEFAULT NOW(),
    updated_at  TIMESTAMPTZ DEFAULT NOW()
);
"""

async def main():
    engine = create_async_engine(DATABASE_URL, echo=True)
    async with engine.begin() as conn:
        for statement in SQL.strip().split(";"):
            stmt = statement.strip()
            if stmt:
                print(f"\n>>> Executing:\n{stmt}\n")
                await conn.execute(text(stmt))
    print("\n✅ Migration 006 applied successfully!")
    await engine.dispose()

if __name__ == "__main__":
    asyncio.run(main())
