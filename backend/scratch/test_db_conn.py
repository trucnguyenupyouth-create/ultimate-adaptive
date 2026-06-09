import asyncio
import os
from sqlalchemy.ext.asyncio import create_async_engine
from sqlalchemy import text

DATABASE_URL = "postgresql+asyncpg://postgres:Wizzdom2026@db.xfzbmwsbyzbehbwuidah.supabase.co:6543/postgres"

async def test_conn():
    print("Connecting to Supabase...")
    try:
        engine = create_async_engine(DATABASE_URL, echo=True)
        async with engine.connect() as conn:
            res = await conn.execute(text("SELECT 1;"))
            print("Connection successful! Result:", res.scalar())
        await engine.dispose()
    except Exception as e:
        print("Connection failed:", e)

if __name__ == "__main__":
    asyncio.run(test_conn())
