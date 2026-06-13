"""
Learning API Routes (Layer 2)

Student learning loop endpoints:
  POST /learn/start/{student_id}/{kc_id}           → begin KC learning
  POST /learn/content-viewed/{student_id}/{kc_id}  → viewed a content asset
  POST /learn/practice/{student_id}/{kc_id}        → submit practice answer
  GET  /learn/review-due/{student_id}              → KCs due for review
  GET  /learn/status/{student_id}/{kc_id}          → current BKT state for a KC
"""

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.services import learning_service as svc

router = APIRouter(prefix="/learn", tags=["Learning"])


# ── Schemas ───────────────────────────────────────────────────────────────────

class ContentViewedRequest(BaseModel):
    asset_id: str


class PracticeRequest(BaseModel):
    item_id: str
    correct: bool
    time_spent_ms: int | None = None


# ── Routes ────────────────────────────────────────────────────────────────────

@router.post(
    "/start/{student_id}/{kc_id}",
    summary="Begin learning a KC",
)
async def start_kc(
    student_id: str,
    kc_id: str,
    db: AsyncSession = Depends(get_db),
):
    """
    Initialize the learning cycle for student on a KC.

    - Injects IRT theta into BKT params (stronger students get higher P(L0), lower P(S), higher P(T))
    - Returns: content list + current P(mastery) + first practice item

    Typical flow:
      1. Assessment finishes → result.first_learning_kc
      2. Frontend calls POST /learn/start/{sid}/{kc_id}
      3. Student sees content → POST /learn/content-viewed/...
      4. Student practices → POST /learn/practice/...
      5. On mastered → call start on next KC
    """
    try:
        result = await svc.start_kc(db, student_id, kc_id)
        return result
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post(
    "/content-viewed/{student_id}/{kc_id}",
    summary="Mark a content asset as viewed (triggers BKT P(T) update)",
)
async def content_viewed(
    student_id: str,
    kc_id: str,
    body: ContentViewedRequest,
    db: AsyncSession = Depends(get_db),
):
    """
    Called when student finishes viewing a content asset (video, text, worked example).

    Updates BKT P(mastery) using the asset's bkt_p_transit value:
      P_new = P_old + (1 - P_old) × P(T_content)

    Returns: updated P(mastery) + next practice item
    """
    try:
        result = await svc.after_content(db, student_id, kc_id, body.asset_id)
        return result
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post(
    "/practice/{student_id}/{kc_id}",
    summary="Submit a practice answer (BKT + IRT update)",
)
async def practice(
    student_id: str,
    kc_id: str,
    body: PracticeRequest,
    db: AsyncSession = Depends(get_db),
):
    """
    Submit a practice response. Updates BKT mastery + IRT theta.

    Response includes:
      - p_mastery_before / p_mastery_after: see BKT change
      - is_mastered: True when P(L) >= 0.95
      - next_practice_item: next IRT ZPD item (null if mastered)
      - theta: updated student ability estimate

    When is_mastered=True:
      → Frontend should congratulate student and call /learn/start for next KC
    """
    try:
        result = await svc.after_practice(
            db, student_id, kc_id, body.item_id, body.correct, body.time_spent_ms
        )
        return result
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get(
    "/review-due/{student_id}",
    summary="Get KCs due for spaced review",
)
async def review_due(
    student_id: str,
    db: AsyncSession = Depends(get_db),
):
    """
    Returns KCs the student should review, ordered by urgency.

    Layer 2 stub: returns mastered KCs ordered by last_practiced (oldest first).
    Layer 3 will add Forgetting Curve P(t) filtering (trigger when P(t) < 0.80).
    """
    try:
        result = await svc.get_review_due(db, student_id)
        return {"student_id": student_id, "review_queue": result}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get(
    "/status/{student_id}/{kc_id}",
    summary="Get current BKT mastery state for a KC",
)
async def kc_status(
    student_id: str,
    kc_id: str,
    db: AsyncSession = Depends(get_db),
):
    """
    Returns the current BKT state for student×KC.
    Useful for X-Ray Sandbox and debugging.
    """
    from sqlalchemy import select
    from app.models.models import StudentKC, StudentIRT
    import uuid

    sid = uuid.UUID(student_id)
    kcid = uuid.UUID(kc_id)

    kc_result = await db.execute(
        select(StudentKC).where(
            StudentKC.student_id == sid,
            StudentKC.kc_id == kcid,
        )
    )
    kc_row = kc_result.scalar_one_or_none()
    if not kc_row:
        raise HTTPException(status_code=404, detail="No learning state found for this student×KC")

    irt_result = await db.execute(
        select(StudentIRT).where(StudentIRT.student_id == sid)
    )
    irt = irt_result.scalar_one_or_none()

    return {
        "student_id": student_id,
        "kc_id": kc_id,
        "p_mastery": round(kc_row.p_mastery, 4),
        "is_mastered": kc_row.is_mastered,
        "bkt_params": {
            "p_know0": round(kc_row.p_know0, 4),
            "p_transit": round(kc_row.p_transit, 4),
            "p_guess": round(kc_row.p_guess, 4),
            "p_slip": round(kc_row.p_slip, 4),
        },
        "theta": round(irt.theta, 3) if irt else 0.0,
        "last_practiced": kc_row.last_practiced.isoformat() if kc_row.last_practiced else None,
        "updated_at": kc_row.updated_at.isoformat(),
    }
