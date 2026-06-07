#!/usr/bin/env python3
"""
Run DB migrations in order on startup.
Called by Render's start command: python run_migrations.py && uvicorn app.main:app ...
"""

import asyncio
import os
import pathlib
import re
import sys

from sqlalchemy.ext.asyncio import create_async_engine
from sqlalchemy import text

DATABASE_URL = os.environ["DATABASE_URL"]
MIGRATIONS_DIR = pathlib.Path(__file__).parent / "migrations"


async def run_migrations():
    engine = create_async_engine(DATABASE_URL, echo=False)

    # 1. Ensure _migrations table exists
    async with engine.begin() as conn:
        await conn.execute(text("""
            CREATE TABLE IF NOT EXISTS _migrations (
                filename VARCHAR(255) PRIMARY KEY,
                applied_at TIMESTAMPTZ DEFAULT NOW()
            )
        """))

        # 2. Check if knowledge_components table already exists
        res = await conn.execute(text("""
            SELECT EXISTS (
                SELECT FROM pg_tables 
                WHERE schemaname = 'public' 
                AND tablename  = 'knowledge_components'
            )
        """))
        kc_exists = res.scalar()

        if kc_exists:
            # Seed 001_initial_schema.sql if not already marked
            await conn.execute(text("""
                INSERT INTO _migrations (filename) 
                VALUES ('001_initial_schema.sql') 
                ON CONFLICT (filename) DO NOTHING
            """))

        result = await conn.execute(text("SELECT filename FROM _migrations"))
        applied = {row[0] for row in result.fetchall()}

    # Find and sort all .sql files
    sql_files = sorted(MIGRATIONS_DIR.glob("*.sql"))

    for sql_file in sql_files:
        name = sql_file.name
        if name in applied:
            print(f"  ↳ skip {name} (already applied)")
            continue

        print(f"  → applying {name} ...")
        sql = sql_file.read_text()

        # Split on semicolons, skip comments and blank statements
        for stmt in sql.split(";"):
            stmt = stmt.strip()
            # Strip comment-only blocks
            lines = [l for l in stmt.splitlines() if not l.strip().startswith("--")]
            stmt = "\n".join(lines).strip()
            if stmt:
                try:
                    # Run each statement in its own transaction to prevent poisoning the transaction block
                    async with engine.begin() as conn:
                        await conn.execute(text(stmt))
                except Exception as e:
                    err = str(e)
                    # These are safe to ignore (idempotent DDL)
                    if any(x in err for x in [
                        "already exists",
                        "column already exists",
                        "does not exist",
                    ]):
                        print(f"    ⚠ skipped: {err[:80]}")
                    else:
                        print(f"    ✗ FAILED: {err}")
                        raise

        # Mark as applied
        async with engine.begin() as conn:
            await conn.execute(
                text("INSERT INTO _migrations (filename) VALUES (:f) ON CONFLICT (filename) DO NOTHING"),
                {"f": name}
            )
        print(f"    ✓ {name} applied")

    await engine.dispose()
    print("✓ All migrations complete")


if __name__ == "__main__":
    asyncio.run(run_migrations())
