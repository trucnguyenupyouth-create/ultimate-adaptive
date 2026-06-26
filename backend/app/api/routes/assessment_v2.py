"""Student-facing Assessment V2 pilot APIs."""

from __future__ import annotations

from typing import Any

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.services import assessment_v2_session_service as service


router = APIRouter(prefix="/assessment-v2", tags=["Assessment V2"])


class CreateSessionRequest(BaseModel):
    max_questions: int = Field(default=35, ge=1, le=35)
    student_label: str | None = None


class SubmitResponseRequest(BaseModel):
    item_id: str
    answer: Any = None
    response_type: str = "answer"


@router.post("/sessions")
async def create_session(body: CreateSessionRequest, db: AsyncSession = Depends(get_db)):
    try:
        return await service.create_session(
            db,
            max_questions=body.max_questions,
            student_label=body.student_label,
        )
    except ValueError as e:
        raise HTTPException(status_code=422, detail=str(e))


@router.post("/sessions/{session_id}/responses")
async def submit_response(session_id: str, body: SubmitResponseRequest, db: AsyncSession = Depends(get_db)):
    try:
        return await service.submit_response(
            db,
            session_id=session_id,
            item_id=body.item_id,
            answer=body.answer,
            response_type=body.response_type,
        )
    except KeyError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except ValueError as e:
        raise HTTPException(status_code=422, detail=str(e))


@router.get("/sessions/{session_id}/result")
async def get_result(session_id: str, db: AsyncSession = Depends(get_db)):
    try:
        return await service.get_result(db, session_id)
    except KeyError as e:
        raise HTTPException(status_code=404, detail=str(e))


@router.get("/sessions/{session_id}/review")
async def get_review(session_id: str, db: AsyncSession = Depends(get_db)):
    try:
        return await service.get_review(db, session_id)
    except KeyError as e:
        raise HTTPException(status_code=404, detail=str(e))
