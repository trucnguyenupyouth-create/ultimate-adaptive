"""
Items (Question Bank) API Routes — Operation System V2

Endpoints for managing questions (items) per Knowledge Component.
All MCQ questions are validated for at least 1 correct answer.
"""

from typing import Any, Dict, List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel, field_validator
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.services import graph_service

router = APIRouter(prefix="/items", tags=["Item Bank"])


# ── Schemas ───────────────────────────────────────────────────────────────────

class MCQAnswer(BaseModel):
    label: str           # "A", "B", "C", "D", ...
    text: str
    is_correct: bool = False


class MCQContent(BaseModel):
    question: str
    answers: List[MCQAnswer]

    @field_validator("answers")
    @classmethod
    def validate_answers(cls, v):
        if len(v) < 2:
            raise ValueError("MCQ must have at least 2 answers")
        correct = [a for a in v if a.is_correct]
        if not correct:
            raise ValueError("At least one answer must be marked as correct")
        return v


class CreateItemRequest(BaseModel):
    kc_id: str
    difficulty_label: str     # "easy" | "medium" | "hard"
    format_type: str = "mcq"  # only "mcq" for V2
    content: Dict[str, Any]   # flexible — validated per format_type in service


class ToggleItemRequest(BaseModel):
    is_active: bool


# ── Routes ────────────────────────────────────────────────────────────────────

@router.get("/", summary="List items for a KC")
async def list_items(
    kc_id: str = Query(..., description="KC UUID"),
    active_only: bool = Query(True, description="Only return active items"),
    db: AsyncSession = Depends(get_db),
):
    return await graph_service.get_items(db, kc_id, active_only=active_only)


@router.post(
    "/",
    status_code=status.HTTP_201_CREATED,
    summary="Create a new item (question) for a KC",
)
async def create_item(body: CreateItemRequest, db: AsyncSession = Depends(get_db)):
    try:
        item = await graph_service.create_item(
            db,
            kc_id=body.kc_id,
            difficulty_label=body.difficulty_label,
            format_type=body.format_type,
            content=body.content,
        )
        return item
    except ValueError as e:
        raise HTTPException(status_code=422, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.put(
    "/{item_id}",
    summary="Edit item (soft-delete old, create new version)",
)
async def edit_item(
    item_id: str,
    body: CreateItemRequest,
    db: AsyncSession = Depends(get_db),
):
    try:
        result = await graph_service.edit_item(
            db,
            item_id=item_id,
            difficulty_label=body.difficulty_label,
            format_type=body.format_type,
            content=body.content,
        )
        return result
    except ValueError as e:
        raise HTTPException(status_code=422, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.patch(
    "/{item_id}/toggle",
    summary="Toggle item active/inactive (soft deactivate)",
)
async def toggle_item(
    item_id: str,
    body: ToggleItemRequest,
    db: AsyncSession = Depends(get_db),
):
    try:
        return await graph_service.toggle_item(db, item_id=item_id, is_active=body.is_active)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


class AnchorToggleRequest(BaseModel):
    is_diagnostic_anchor: bool


@router.patch(
    "/{item_id}/anchor",
    summary="Toggle diagnostic anchor tag (Entry Point for Cold Start CAT)",
)
async def toggle_anchor(
    item_id: str,
    body: AnchorToggleRequest,
    db: AsyncSession = Depends(get_db),
):
    """
    Mark/unmark a question as a Diagnostic Anchor (Entry Point).

    Rules enforced:
    - Item must be active
    - Item must be medium difficulty (irt_b in [-0.5, 0.5]) — warn if outside
    """
    try:
        return await graph_service.toggle_anchor(
            db, item_id=item_id, is_anchor=body.is_diagnostic_anchor
        )
    except ValueError as e:
        raise HTTPException(status_code=422, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))
