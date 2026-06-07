"""
Assessment API Routes (Layer 0)

Student-facing endpoints for the diagnostic assessment.
Session state is kept in Redis (fast reads between requests).
"""

import json
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.engines.assessment import CATController
from app.models.models import Item, StudentIRT
from app.services.graph_service import get_graph

router = APIRouter(prefix="/assessment", tags=["Assessment"])

# ── Redis client (injected lazily) ────────────────────────────────────────────
_redis = None

async def get_redis():
    global _redis
    if _redis is None:
        import redis.asyncio as aioredis
        from app.core.config import settings
        _redis = aioredis.from_url(settings.REDIS_URL, decode_responses=True)
    return _redis


# ── Helpers ───────────────────────────────────────────────────────────────────

async def _load_items_for_graph(db: AsyncSession, kg) -> dict[str, list[dict]]:
    """Load all active items grouped by kc_id."""
    result = await db.execute(select(Item).where(Item.is_active == True))
    items = result.scalars().all()
    grouped: dict[str, list[dict]] = {}
    for item in items:
        kc_str = str(item.kc_id)
        grouped.setdefault(kc_str, []).append({
            "id": str(item.id),
            "kc_id": kc_str,
            "content": item.content,
            "irt_a": item.irt_a,
            "irt_b": item.irt_b,
            "irt_c": item.irt_c,
        })
    return grouped


async def _get_student_theta(db: AsyncSession, student_id: str) -> float:
    result = await db.execute(
        select(StudentIRT).where(StudentIRT.student_id == student_id)
    )
    irt = result.scalar_one_or_none()
    return irt.theta if irt else 0.0


SESSION_TTL = 3600  # 1 hour


# ── Schemas ───────────────────────────────────────────────────────────────────

class RespondRequest(BaseModel):
    session_id: str
    item_id: str
    correct: bool
    time_spent_ms: int | None = None


# ── Routes ────────────────────────────────────────────────────────────────────

@router.post("/start/{student_id}", summary="Start a new assessment session")
async def start_assessment(
    student_id: str,
    db: AsyncSession = Depends(get_db),
):
    """
    Begins the CAT diagnostic for a student.
    Returns the first item and a session_id (used for subsequent /respond calls).
    """
    redis = await get_redis()
    kg = await get_graph(db)
    cat = CATController(kg)

    # Get student's existing theta and known KCs (for returning students)
    theta = await _get_student_theta(db, student_id)
    # TODO: load known_kcs from student_kc table (for now assume new student)
    known_kcs: set[str] = set()

    available_items = await _load_items_for_graph(db, kg)
    result = cat.start(student_id, known_kcs, theta, available_items)

    if result["status"] == "no_kcs_available":
        raise HTTPException(status_code=404, detail="No KCs available for assessment")

    # Persist session to Redis
    session_id = f"assessment:{student_id}:{result['session']['kc']}"
    await redis.setex(session_id, SESSION_TTL, json.dumps(result["session"]))

    return {
        "session_id": session_id,
        "item": result["item"],
        "status": result["status"],
    }


@router.post("/respond", summary="Submit an answer and get the next item")
async def respond(
    body: RespondRequest,
    db: AsyncSession = Depends(get_db),
):
    """
    Submit an answer. Returns next item or final result when assessment completes.
    """
    redis = await get_redis()
    session_raw = await redis.get(body.session_id)
    if not session_raw:
        raise HTTPException(status_code=404, detail="Session not found or expired")

    session_dict = json.loads(session_raw)
    kg = await get_graph(db)
    cat = CATController(kg)

    # Fetch item details (need IRT params)
    item_result = await db.execute(
        select(Item).where(Item.id == body.item_id, Item.is_active == True)
    )
    item_obj = item_result.scalar_one_or_none()
    if not item_obj:
        raise HTTPException(status_code=404, detail="Item not found")

    item_dict = {
        "id": str(item_obj.id),
        "kc_id": str(item_obj.kc_id),
        "content": item_obj.content,
        "irt_a": item_obj.irt_a,
        "irt_b": item_obj.irt_b,
        "irt_c": item_obj.irt_c,
    }

    available_items = await _load_items_for_graph(db, kg)
    result = cat.respond(session_dict, item_dict, body.correct, available_items)

    # Persist updated session or clean up if done
    if result["status"] == "done":
        await redis.delete(body.session_id)
        # TODO Layer 1+: persist theta to student_irt, log responses to responses table
    else:
        await redis.setex(body.session_id, SESSION_TTL, json.dumps(result["session"]))

    return result


@router.get("/session/{session_id}", summary="Get current session state (for debugging/X-Ray)")
async def get_session(session_id: str):
    redis = await get_redis()
    session_raw = await redis.get(session_id)
    if not session_raw:
        raise HTTPException(status_code=404, detail="Session not found or expired")
    return json.loads(session_raw)
