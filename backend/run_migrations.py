#!/usr/bin/env python3
"""
Run DB migrations in order on startup.
Called by Render's start command: python run_migrations.py && uvicorn app.main:app ...
"""

import asyncio
import os
import pathlib

import dotenv
dotenv.load_dotenv()

from sqlalchemy.ext.asyncio import create_async_engine
from sqlalchemy import text

DATABASE_URL = os.environ["DATABASE_URL"]
MIGRATIONS_DIR = pathlib.Path(__file__).parent / "migrations"
CONNECT_TIMEOUT_SECONDS = int(os.getenv("MIGRATION_CONNECT_TIMEOUT_SECONDS", "15"))
COMMAND_TIMEOUT_SECONDS = int(os.getenv("MIGRATION_COMMAND_TIMEOUT_SECONDS", "30"))
LOCK_TIMEOUT_MS = int(os.getenv("MIGRATION_LOCK_TIMEOUT_MS", "5000"))
STATEMENT_TIMEOUT_MS = int(os.getenv("MIGRATION_STATEMENT_TIMEOUT_MS", "30000"))
TOTAL_TIMEOUT_SECONDS = int(os.getenv("MIGRATION_TOTAL_TIMEOUT_SECONDS", "90"))


def log(message: str) -> None:
    print(message, flush=True)


async def run_migrations():
    engine = create_async_engine(
        DATABASE_URL,
        echo=False,
        connect_args={
            "timeout": CONNECT_TIMEOUT_SECONDS,
            "command_timeout": COMMAND_TIMEOUT_SECONDS,
            "statement_cache_size": 0,
            "prepared_statement_cache_size": 0,
        },
    )

    # 1. Ensure _migrations table exists
    async with engine.begin() as conn:
        await conn.execute(text(f"SET lock_timeout = {LOCK_TIMEOUT_MS}"))
        await conn.execute(text(f"SET statement_timeout = {STATEMENT_TIMEOUT_MS}"))
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
            log(f"  ↳ skip {name} (already applied)")
            continue

        log(f"  → applying {name} ...")
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
                        await conn.execute(text(f"SET lock_timeout = {LOCK_TIMEOUT_MS}"))
                        await conn.execute(text(f"SET statement_timeout = {STATEMENT_TIMEOUT_MS}"))
                        await conn.execute(text(stmt))
                except Exception as e:
                    err = str(e)
                    # These are safe to ignore (idempotent DDL)
                    if any(x in err for x in [
                        "already exists",
                        "column already exists",
                        "does not exist",
                    ]):
                        log(f"    ⚠ skipped: {err[:80]}")
                    else:
                        log(f"    ✗ FAILED: {err}")
                        raise

        # Mark as applied
        async with engine.begin() as conn:
            await conn.execute(
                text("INSERT INTO _migrations (filename) VALUES (:f) ON CONFLICT (filename) DO NOTHING"),
                {"f": name}
            )
        log(f"    ✓ {name} applied")

    await engine.dispose()
    log("✓ All migrations complete")


if __name__ == "__main__":
    try:
        asyncio.run(asyncio.wait_for(run_migrations(), timeout=TOTAL_TIMEOUT_SECONDS))
    except asyncio.TimeoutError:
        log(f"✗ Migration timeout after {TOTAL_TIMEOUT_SECONDS}s")
        raise
