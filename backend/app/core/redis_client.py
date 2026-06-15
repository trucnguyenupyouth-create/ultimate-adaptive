"""
Shared async Redis client — used by graph cache and assessment service.

Gracefully degrades: if Redis is unavailable, callers receive None and
fall back to their own strategies (in-memory or DB).
"""

from __future__ import annotations
import logging

import redis.asyncio as aioredis

from app.core.config import settings

log = logging.getLogger(__name__)

_client: aioredis.Redis | None = None
_failed: bool = False  # set True after first failed connect, stops retry spam


async def get_redis() -> aioredis.Redis | None:
    """Return shared Redis client, or None if unavailable."""
    global _client, _failed
    if _client is not None:
        return _client
    if _failed:
        return None  # don't spam retry on every request
    if not settings.REDIS_URL or settings.REDIS_URL.startswith("redis://localhost"):
        _failed = True
        return None
    try:
        _client = await aioredis.from_url(
            settings.REDIS_URL,
            decode_responses=True,
            socket_connect_timeout=2,
        )
        await _client.ping()
        log.info("Redis connected: %s", settings.REDIS_URL.split("@")[-1])
        return _client
    except Exception as e:
        log.warning("Redis unavailable, using fallback: %s", e)
        _failed = True
        _client = None
        return None


async def close_redis() -> None:
    global _client
    if _client:
        await _client.aclose()
        _client = None
