"""
Assessment API Routes (Layer 1)

Student-facing endpoints for the diagnostic assessment.
Session state is kept in Redis (fast reads between requests).
Assessment results (theta, KC outcomes) are persisted to DB on completion.
"""

import json
import uuid
from datetime import datetime, timezone
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import select, delete
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.engines.assessment import CATController
from app.models.models import Item, StudentIRT, StudentKC, Response
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
            "difficulty_label": item.difficulty_label,
            "is_diagnostic_anchor": item.is_diagnostic_anchor,
        })
    return grouped


async def _get_student_theta(db: AsyncSession, student_id: str) -> tuple[float, float]:
    """Return (theta, theta_se) for student, or (0.0, 1.0) if new."""
    result = await db.execute(
        select(StudentIRT).where(StudentIRT.student_id == student_id)
    )
    irt = result.scalar_one_or_none()
    return (irt.theta, irt.theta_se) if irt else (0.0, 1.0)


async def _get_known_kcs(db: AsyncSession, student_id: str) -> set[str]:
    """Return set of kc_ids the student has already mastered."""
    result = await db.execute(
        select(StudentKC).where(
            StudentKC.student_id == student_id,
            StudentKC.is_mastered == True,
        )
    )
    rows = result.scalars().all()
    return {str(row.kc_id) for row in rows}


async def _persist_assessment_result(
    db: AsyncSession,
    session: dict,
    item_log: list[dict],  # [{item_id, kc_id, correct, time_spent_ms}]
) -> None:
    """
    Persist assessment results to DB when session completes:
      1. Upsert student_irt (theta + SE)
      2. Persist classified KC states in student_kc
      3. Log all responses to responses table (immutable)
    """
    student_id_str = session["student_id"]
    student_id = uuid.UUID(student_id_str)
    theta = session.get("theta", 0.0)
    theta_se = session.get("theta_se", 1.0)
    now = datetime.now(timezone.utc)

    # 1. Upsert student_irt
    existing_irt = await db.execute(
        select(StudentIRT).where(StudentIRT.student_id == student_id)
    )
    irt_row = existing_irt.scalar_one_or_none()
    if irt_row:
        irt_row.theta = theta
        irt_row.theta_se = theta_se
        irt_row.updated_at = now
    else:
        db.add(StudentIRT(
            student_id=student_id,
            theta=theta,
            theta_se=theta_se,
            updated_at=now,
        ))

    # 2. Upsert student_kc for tested + inferred states.
    # Fallback to legacy kc_results for old sessions still in Redis.
    kc_states: dict = session.get("kc_states") or session.get("kc_results", {})
    for kc_id_str, outcome in kc_states.items():
        if outcome in ("pass", "tested_mastered", "inferred_mastered"):
            is_mastered = True
        elif outcome in ("fail", "fundamental_gap", "tested_gap", "inferred_gap"):
            is_mastered = False
        else:
            continue

        kc_id = uuid.UUID(kc_id_str)
        existing_kc = await db.execute(
            select(StudentKC).where(
                StudentKC.student_id == student_id,
                StudentKC.kc_id == kc_id,
            )
        )
        kc_row = existing_kc.scalar_one_or_none()

        if kc_row:
            kc_row.is_mastered = is_mastered
            kc_row.updated_at = now
        else:
            db.add(StudentKC(
                student_id=student_id,
                kc_id=kc_id,
                is_mastered=is_mastered,
                # BKT params will be set by LearningService when learning begins
                updated_at=now,
            ))

    # 3. Log responses (immutable — never update, only insert)
    for entry in item_log:
        db.add(Response(
            student_id=student_id,
            item_id=uuid.UUID(entry["item_id"]),
            kc_id=uuid.UUID(entry["kc_id"]),
            correct=entry["correct"],
            context="assessment",
            time_spent_ms=entry.get("time_spent_ms"),
        ))

    await db.commit()


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
    - New student: starts from θ=0, known_kcs=∅
    - Returning student: loads θ and previously mastered KCs from DB
    Returns the first item and a session_id.
    """
    redis = await get_redis()
    kg = await get_graph(db)
    cat = CATController(kg, use_irt=True)

    # Load existing student state (returning student support)
    theta, theta_se = await _get_student_theta(db, student_id)
    known_kcs = await _get_known_kcs(db, student_id)

    available_items = await _load_items_for_graph(db, kg)
    result = cat.start(student_id, known_kcs, theta, available_items)

    if result["status"] == "no_kcs_available":
        raise HTTPException(status_code=404, detail="No KCs available for assessment")

    # Persist session to Redis (include item_log for response tracking)
    session_data = result["session"]
    session_data["_item_log"] = []  # will accumulate (item_id, kc_id, correct, ms)

    session_id = f"assessment:{student_id}:{result['session']['kc']}"
    await redis.setex(session_id, SESSION_TTL, json.dumps(session_data))

    return {
        "session_id": session_id,
        "item": result["item"],
        "status": result["status"],
        "theta": round(theta, 3),
    }


@router.post("/respond", summary="Submit an answer and get the next item")
async def respond(
    body: RespondRequest,
    db: AsyncSession = Depends(get_db),
):
    """
    Submit an answer. Updates θ via IRT MLE after each response.
    On completion: persists θ, KC outcomes, and response log to DB.
    Returns next item or final result.
    """
    redis = await get_redis()
    session_raw = await redis.get(body.session_id)
    if not session_raw:
        raise HTTPException(status_code=404, detail="Session not found or expired")

    session_dict = json.loads(session_raw)
    kg = await get_graph(db)
    cat = CATController(kg, use_irt=True)

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
        "difficulty_label": item_obj.difficulty_label,
        "is_diagnostic_anchor": item_obj.is_diagnostic_anchor,
    }

    # Append to item log before processing
    item_log: list = session_dict.pop("_item_log", [])
    item_log.append({
        "item_id": body.item_id,
        "kc_id": str(item_obj.kc_id),
        "correct": body.correct,
        "time_spent_ms": body.time_spent_ms,
    })

    available_items = await _load_items_for_graph(db, kg)
    result = cat.respond(session_dict, item_dict, body.correct, available_items)

    if result["status"] == "done":
        # Persist to DB
        await _persist_assessment_result(db, result["session"], item_log)
        await redis.delete(body.session_id)
    else:
        # Save updated session + item log back to Redis
        updated_session = result["session"]
        updated_session["_item_log"] = item_log
        await redis.setex(body.session_id, SESSION_TTL, json.dumps(updated_session))

    # Remove internal field from response
    result.get("session", {}).pop("_item_log", None)
    return result


@router.get("/session/{session_id}", summary="Get current session state (for debugging/X-Ray)")
async def get_session(session_id: str):
    redis = await get_redis()
    session_raw = await redis.get(session_id)
    if not session_raw:
        raise HTTPException(status_code=404, detail="Session not found or expired")
    data = json.loads(session_raw)
    data.pop("_item_log", None)  # don't expose internal log
    return data


@router.get("/result/{student_id}", summary="Get student's assessment results from DB")
async def get_student_result(
    student_id: str,
    db: AsyncSession = Depends(get_db),
):
    """
    Fetch persisted assessment results for a student.
    Returns theta, SE, and KC outcomes (mastered/gaps).
    """
    irt_result = await db.execute(
        select(StudentIRT).where(StudentIRT.student_id == student_id)
    )
    irt = irt_result.scalar_one_or_none()
    if not irt:
        raise HTTPException(status_code=404, detail="No assessment results found for student")

    kc_result = await db.execute(
        select(StudentKC).where(StudentKC.student_id == student_id)
    )
    kc_rows = kc_result.scalars().all()

    mastered = [str(row.kc_id) for row in kc_rows if row.is_mastered]
    gaps     = [str(row.kc_id) for row in kc_rows if not row.is_mastered]

    return {
        "student_id": student_id,
        "theta": round(irt.theta, 3),
        "theta_se": round(irt.theta_se, 3),
        "mastered_kcs": mastered,
        "gap_kcs": gaps,
        "updated_at": irt.updated_at.isoformat(),
    }
