"""
Learning Service — Layer 2 (BKT Learning Loop)

Orchestrates the full learning cycle per student per KC:
  start_kc()       → init BKT state with IRT theta injection, return content
  after_content()  → BKT update after viewing learning content
  after_practice() → BKT + IRT update after practice response
  get_review_due() → KCs due for spaced review (stub for Layer 3)

DB interactions:
  - student_irt    : read theta for IRT→BKT injection
  - student_kc     : read/write BKT state per student×KC
  - responses      : immutable insert after each practice
  - content_assets : read learning content per KC
  - items          : read practice items (IRT ZPD selection)
"""

from __future__ import annotations

import uuid
from datetime import datetime, timezone

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.engines import bkt as BKT
from app.engines import irt as IRT
from app.engines.bkt import BKTState
from app.models.models import (
    ContentAsset, Item, StudentIRT, StudentKC, Response
)


# ── Internal helpers ──────────────────────────────────────────────────────────

async def _get_theta(db: AsyncSession, student_id: uuid.UUID) -> float:
    result = await db.execute(
        select(StudentIRT).where(StudentIRT.student_id == student_id)
    )
    row = result.scalar_one_or_none()
    return row.theta if row else 0.0


async def _get_or_init_bkt(
    db: AsyncSession,
    student_id: uuid.UUID,
    kc_id: uuid.UUID,
    theta: float,
) -> tuple[StudentKC, bool]:
    """
    Get existing BKT state for student×KC, or create with IRT-injected params.
    Returns (StudentKC row, was_created).
    """
    result = await db.execute(
        select(StudentKC).where(
            StudentKC.student_id == student_id,
            StudentKC.kc_id == kc_id,
        )
    )
    row = result.scalar_one_or_none()

    if row:
        return row, False

    # New KC for this student — init with IRT theta injection
    state = BKT.init_with_irt(theta)
    row = StudentKC(
        student_id=student_id,
        kc_id=kc_id,
        p_mastery=state.p_mastery,
        p_know0=state.p_know0,
        p_transit=state.p_transit,
        p_guess=state.p_guess,
        p_slip=state.p_slip,
        is_mastered=False,
        updated_at=datetime.now(timezone.utc),
    )
    db.add(row)
    await db.flush()  # get the row without committing
    return row, True


def _row_to_state(row: StudentKC) -> BKTState:
    return BKTState(
        p_mastery=row.p_mastery,
        p_know0=row.p_know0,
        p_transit=row.p_transit,
        p_guess=row.p_guess,
        p_slip=row.p_slip,
    )


def _apply_state(row: StudentKC, state: BKTState) -> None:
    """Write BKT state back to ORM row."""
    row.p_mastery = state.p_mastery
    row.p_know0 = state.p_know0
    row.p_transit = state.p_transit
    row.p_guess = state.p_guess
    row.p_slip = state.p_slip
    row.is_mastered = BKT.is_mastered(state)
    row.updated_at = datetime.now(timezone.utc)


async def _load_kc_items(db: AsyncSession, kc_id: uuid.UUID) -> list[dict]:
    """Load all active items for a KC as IRT-ready dicts."""
    result = await db.execute(
        select(Item).where(Item.kc_id == kc_id, Item.is_active == True)
    )
    return [
        {
            "id": str(item.id),
            "kc_id": str(item.kc_id),
            "content": item.content,
            "irt_a": item.irt_a,
            "irt_b": item.irt_b,
            "irt_c": item.irt_c,
            "difficulty_label": item.difficulty_label,
            "format_type": item.format_type,
        }
        for item in result.scalars().all()
    ]


# ── Public API ────────────────────────────────────────────────────────────────

async def start_kc(
    db: AsyncSession,
    student_id: str,
    kc_id: str,
) -> dict:
    """
    Begin the learning cycle for a student on a KC.

    1. Load student theta from student_irt
    2. Init BKT state (IRT→BKT 3-channel injection) if not already started
    3. Load learning content for the KC
    4. Return content list + current P(mastery) + first practice item

    Called when: assessment ends → gaps → student starts learning first gap KC
    """
    sid = uuid.UUID(student_id)
    kcid = uuid.UUID(kc_id)

    theta = await _get_theta(db, sid)
    kc_row, created = await _get_or_init_bkt(db, sid, kcid, theta)
    state = _row_to_state(kc_row)

    # Load content assets for this KC
    content_result = await db.execute(
        select(ContentAsset).where(
            ContentAsset.kc_id == kcid,
            ContentAsset.is_active == True,
        ).order_by(ContentAsset.created_at)
    )
    content_assets = content_result.scalars().all()
    content_list = [
        {
            "id": str(asset.id),
            "type": asset.asset_type,
            "title": asset.title,
            "url": asset.content_url,
            "body": asset.content_body,
            "bkt_p_transit": asset.bkt_p_transit,
        }
        for asset in content_assets
    ]

    # First practice item (ZPD-selected based on current P(mastery) stage)
    items = await _load_kc_items(db, kcid)
    target_p = IRT.zpd_target_for_mastery(state.p_mastery)
    first_item = IRT.select_zpd(theta, items, target_p=target_p) if items else None

    await db.commit()

    return {
        "student_id": student_id,
        "kc_id": kc_id,
        "theta": round(theta, 3),
        "p_mastery": round(state.p_mastery, 4),
        "is_mastered": BKT.is_mastered(state),
        "bkt_params": state.to_dict(),
        "content": content_list,
        "has_content": len(content_list) > 0,
        "first_practice_item": first_item,
        "zpd_target": round(target_p, 2),
        "initialized": created,
    }


async def after_content(
    db: AsyncSession,
    student_id: str,
    kc_id: str,
    asset_id: str,
) -> dict:
    """
    Called after student views a learning content asset (video, text, etc.).

    Updates BKT P(mastery) via the content's bkt_p_transit value.
    Returns next practice item.
    """
    sid = uuid.UUID(student_id)
    kcid = uuid.UUID(kc_id)
    aid = uuid.UUID(asset_id)

    # Load content asset to get its P(T) value
    asset_result = await db.execute(
        select(ContentAsset).where(ContentAsset.id == aid)
    )
    asset = asset_result.scalar_one_or_none()
    if not asset:
        raise ValueError(f"Content asset {asset_id} not found")

    p_transit_content = asset.bkt_p_transit

    # Load BKT state
    theta = await _get_theta(db, sid)
    kc_row, _ = await _get_or_init_bkt(db, sid, kcid, theta)
    state = _row_to_state(kc_row)

    # BKT update: learning event
    new_state = BKT.update_learning_event(state, p_transit_content=p_transit_content)
    _apply_state(kc_row, new_state)

    # Select next practice item
    items = await _load_kc_items(db, kcid)
    target_p = IRT.zpd_target_for_mastery(new_state.p_mastery)
    next_item = IRT.select_zpd(theta, items, target_p=target_p) if items else None

    await db.commit()

    return {
        "student_id": student_id,
        "kc_id": kc_id,
        "content_viewed": asset_id,
        "p_transit_applied": round(p_transit_content, 3),
        "p_mastery_before": round(state.p_mastery, 4),
        "p_mastery_after": round(new_state.p_mastery, 4),
        "is_mastered": BKT.is_mastered(new_state),
        "next_practice_item": next_item,
        "zpd_target": round(target_p, 2),
    }


async def after_practice(
    db: AsyncSession,
    student_id: str,
    kc_id: str,
    item_id: str,
    correct: bool,
    time_spent_ms: int | None = None,
) -> dict:
    """
    Called after student answers a practice item.

    1. BKT update (Corbett & Anderson)
    2. IRT theta update (MLE)
    3. Log response (immutable)
    4. Check mastery
    5. Return: next item OR mastered status

    If mastered: caller should trigger move to next KC.
    """
    sid = uuid.UUID(student_id)
    kcid = uuid.UUID(kc_id)
    iid = uuid.UUID(item_id)

    # Load item IRT params
    item_result = await db.execute(
        select(Item).where(Item.id == iid, Item.is_active == True)
    )
    item_obj = item_result.scalar_one_or_none()
    if not item_obj:
        raise ValueError(f"Item {item_id} not found")

    # Load current state
    theta = await _get_theta(db, sid)
    kc_row, _ = await _get_or_init_bkt(db, sid, kcid, theta)
    state = _row_to_state(kc_row)

    # BKT update
    new_state = BKT.update_observation(state, correct=correct)
    _apply_state(kc_row, new_state)

    # IRT theta update: append this response and refit
    # Load all prior responses for this student to get full history
    prior_result = await db.execute(
        select(Response).where(
            Response.student_id == sid,
            Response.context.in_(["assessment", "practice"]),
        ).order_by(Response.created_at)
    )
    prior_responses = prior_result.scalars().all()

    # Build response history for MLE
    response_tuples: list[tuple] = []
    for r in prior_responses:
        item_r = await db.execute(select(Item).where(Item.id == r.item_id))
        item_r_obj = item_r.scalar_one_or_none()
        if item_r_obj:
            response_tuples.append((r.correct, item_r_obj.irt_a, item_r_obj.irt_b, item_r_obj.irt_c))

    # Add current response
    response_tuples.append((correct, item_obj.irt_a, item_obj.irt_b, item_obj.irt_c))

    new_theta, new_se = IRT.update_theta(response_tuples, init=theta)

    # Update theta in DB
    irt_result = await db.execute(
        select(StudentIRT).where(StudentIRT.student_id == sid)
    )
    irt_row = irt_result.scalar_one_or_none()
    if irt_row:
        irt_row.theta = new_theta
        irt_row.theta_se = new_se
        irt_row.updated_at = datetime.now(timezone.utc)
    else:
        db.add(StudentIRT(
            student_id=sid,
            theta=new_theta,
            theta_se=new_se,
            updated_at=datetime.now(timezone.utc),
        ))

    # Log response (immutable)
    db.add(Response(
        student_id=sid,
        item_id=iid,
        kc_id=kcid,
        correct=correct,
        context="practice",
        time_spent_ms=time_spent_ms,
    ))

    mastered = BKT.is_mastered(new_state)
    next_item = None

    if not mastered:
        # Select next practice item
        items = await _load_kc_items(db, kcid)
        target_p = IRT.zpd_target_for_mastery(new_state.p_mastery)
        next_item = IRT.select_zpd(new_theta, items, target_p=target_p)

    await db.commit()

    return {
        "student_id": student_id,
        "kc_id": kc_id,
        "correct": correct,
        "p_mastery_before": round(state.p_mastery, 4),
        "p_mastery_after": round(new_state.p_mastery, 4),
        "is_mastered": mastered,
        "theta": round(new_theta, 3),
        "theta_se": round(new_se, 3),
        "next_practice_item": next_item,
        # If mastered, caller should call start_kc() on next gap KC
        "message": "KC mastered! Move to next KC." if mastered else "Continue practicing.",
    }


async def get_review_due(
    db: AsyncSession,
    student_id: str,
) -> list[dict]:
    """
    Return KCs due for spaced review (Layer 3 stub).

    Currently: returns mastered KCs ordered by last_practiced (oldest first).
    Layer 3 will replace with Forgetting Curve P(t) < 0.80 trigger.
    """
    sid = uuid.UUID(student_id)
    result = await db.execute(
        select(StudentKC).where(
            StudentKC.student_id == sid,
            StudentKC.is_mastered == True,
        ).order_by(StudentKC.last_practiced.asc().nullsfirst())
    )
    rows = result.scalars().all()

    return [
        {
            "kc_id": str(row.kc_id),
            "p_mastery": round(row.p_mastery, 4),
            "last_practiced": row.last_practiced.isoformat() if row.last_practiced else None,
            "review_due_at": row.review_due_at.isoformat() if row.review_due_at else None,
            # Layer 3: will add p_retention (Forgetting Curve) here
        }
        for row in rows
    ]
