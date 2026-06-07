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


class UpdateKCRequest(BaseModel):
    name: Optional[str] = None
    grade: Optional[int] = None
    subject: Optional[str] = None
    description: Optional[str] = None
    notes: Optional[str] = None


class AddPrerequisiteRequest(BaseModel):
    kc_id: str       # the KC that REQUIRES the prerequisite
    prereq_id: str   # the KC that must be mastered first
    label: Optional[str] = None
    weight: Optional[float] = 1.0


class UpdateEdgeRequest(BaseModel):
    kc_id: str
    prereq_id: str
    label: Optional[str] = None
    weight: Optional[float] = 1.0


class ReverseEdgeRequest(BaseModel):
    kc_id: str
    prereq_id: str


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


@router.get("/kc/{kc_id}", summary="Get full KC detail (info + prerequisites + successors)")
async def get_kc_detail(kc_id: str, db: AsyncSession = Depends(get_db)):
    detail = await graph_service.get_kc_detail(db, kc_id)
    if not detail:
        raise HTTPException(status_code=404, detail=f"KC {kc_id} not found")
    return detail


@router.put("/kc/{kc_id}", summary="Update KC metadata (name, grade, subject, description, notes)")
async def update_kc(kc_id: str, body: UpdateKCRequest, db: AsyncSession = Depends(get_db)):
    try:
        kc = await graph_service.update_kc(
            db,
            kc_id=kc_id,
            name=body.name,
            grade=body.grade,
            subject=body.subject,
            description=body.description,
            notes=body.notes,
        )
        return {
            "id": str(kc.id),
            "code": kc.code,
            "name": kc.name,
            "grade": kc.grade,
            "subject": kc.subject,
            "description": kc.description,
            "notes": kc.notes,
        }
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.delete("/kc/{kc_id}", summary="Delete KC (deactivates items, removes edges)")
async def delete_kc(kc_id: str, db: AsyncSession = Depends(get_db)):
    try:
        result = await graph_service.delete_kc(db, kc_id)
        return result
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/prerequisite", summary="Add prerequisite edge (with cycle detection)")
async def add_prerequisite(body: AddPrerequisiteRequest, db: AsyncSession = Depends(get_db)):
    result = await graph_service.add_prerequisite(
        db,
        kc_id=body.kc_id,
        prereq_id=body.prereq_id,
        label=body.label,
        weight=body.weight or 1.0
    )
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


@router.get("/edge", summary="Get details and edit history of an edge")
async def get_edge(
    kc_id: str,
    prereq_id: str,
    db: AsyncSession = Depends(get_db),
):
    detail = await graph_service.get_edge_detail(db, kc_id=kc_id, prereq_id=prereq_id)
    if not detail:
        raise HTTPException(status_code=404, detail="Edge not found")
    return detail


@router.patch("/edge", summary="Update edge annotation / label")
async def update_edge(
    body: UpdateEdgeRequest,
    db: AsyncSession = Depends(get_db),
):
    try:
        await graph_service.update_edge(
            db,
            kc_id=body.kc_id,
            prereq_id=body.prereq_id,
            label=body.label,
            weight=body.weight or 1.0
        )
        return {"ok": True}
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/edge/reverse", summary="Reverse edge direction with cycle detection")
async def reverse_edge(
    body: ReverseEdgeRequest,
    db: AsyncSession = Depends(get_db),
):
    result = await graph_service.reverse_edge(
        db,
        kc_id=body.kc_id,
        prereq_id=body.prereq_id
    )
    if not result["ok"]:
        raise HTTPException(status_code=409, detail=result["error"])
    return {"ok": True}
