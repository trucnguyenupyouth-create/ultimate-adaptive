"""
Knowledge Graph API Routes (Layer 0 — Operation System)

Endpoints for the Visual Graph Builder CMS.
All mutating endpoints run DAG validation before persisting.
"""

from typing import Optional
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.services import graph_service

router = APIRouter(prefix="/graph", tags=["Knowledge Graph"])


# ── Schemas ───────────────────────────────────────────────────────────────────

class CreateKCRequest(BaseModel):
    code: str
    name: str
    grade: int
    subject: str = "math"
    description: Optional[str] = None


class AddPrerequisiteRequest(BaseModel):
    kc_id: str       # the KC that REQUIRES the prerequisite
    prereq_id: str   # the KC that must be mastered first


# ── Routes ────────────────────────────────────────────────────────────────────

@router.get("/", summary="Get full graph (nodes + edges) for React Flow")
async def get_graph(db: AsyncSession = Depends(get_db)):
    return await graph_service.get_graph_json(db)


@router.get("/health", summary="Graph health check — item counts, dead-ends, cycle check")
async def get_health(db: AsyncSession = Depends(get_db)):
    return await graph_service.get_graph_health(db)


@router.post("/kc", status_code=status.HTTP_201_CREATED, summary="Add a Knowledge Component node")
async def create_kc(body: CreateKCRequest, db: AsyncSession = Depends(get_db)):
    try:
        kc = await graph_service.create_kc(
            db,
            code=body.code,
            name=body.name,
            grade=body.grade,
            subject=body.subject,
            description=body.description,
        )
        return {"id": str(kc.id), "code": kc.code, "name": kc.name, "grade": kc.grade}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/prerequisite", summary="Add prerequisite edge (with cycle detection)")
async def add_prerequisite(body: AddPrerequisiteRequest, db: AsyncSession = Depends(get_db)):
    result = await graph_service.add_prerequisite(db, body.kc_id, body.prereq_id)
    if not result["ok"]:
        raise HTTPException(status_code=409, detail=result["error"])
    return {"ok": True, "message": f"{body.prereq_id} → {body.kc_id} added"}


@router.delete("/prerequisite", summary="Remove prerequisite edge")
async def remove_prerequisite(
    kc_id: str,
    prereq_id: str,
    db: AsyncSession = Depends(get_db),
):
    await graph_service.remove_prerequisite(db, kc_id, prereq_id)
    return {"ok": True}
