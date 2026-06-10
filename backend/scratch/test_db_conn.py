import asyncio
import traceback
from sqlalchemy.ext.asyncio import create_async_engine
from sqlalchemy import text

async def test_conn():
    url = "postgresql+asyncpg://postgres:Wizzdom2026@db.xfzbmwsbyzbehbwuidah.supabase.co:6543/postgres"
    print("Connecting to:", url)
    try:
        engine = create_async_engine(url, echo=False)
        async with engine.begin() as conn:
            res = await conn.execute(text("SELECT 1"))
            print("Success! Result:", res.scalar())
        await engine.dispose()
    except Exception as e:
        print("Failed to connect!")
        traceback.print_exc()

if __name__ == '__main__':
    asyncio.run(test_conn())
