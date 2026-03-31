import asyncpg
from app.config import DB_DSN

pool: asyncpg.Pool | None = None


async def init_pool():
    global pool
    pool = await asyncpg.create_pool(DB_DSN)


async def close_pool():
    global pool
    if pool:
        await pool.close()


def get_pool() -> asyncpg.Pool:
    if pool is None:
        raise RuntimeError("Database pool not initialised")
    return pool
