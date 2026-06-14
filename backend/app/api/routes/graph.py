"""
Knowledge Graph API Routes (Layer 0 — Operation System)

Endpoints for the Visual Graph Builder CMS.
All mutating endpoints run DAG validation before persisting.
"""

import hashlib
import json
from typing import Optional
from uuid import UUID

from fastapi import APIRouter, Depends, File, HTTPException, Request, Response, UploadFile, status
from fastapi.responses import JSONResponse
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
    chapter_info: str
    block_id: Optional[str] = None


class UpdateKCRequest(BaseModel):
    name: Optional[str] = None
    grade: Optional[int] = None
    subject: Optional[str] = None
    description: Optional[str] = None
    notes: Optional[str] = None
    chapter_info: Optional[str] = None
    block_id: Optional[str] = None
    x: Optional[float] = None
    y: Optional[float] = None


class CreateBlockRequest(BaseModel):
    name: str
    x: float
    y: float
    width: Optional[float] = 400.0
    height: Optional[float] = 300.0


class UpdateBlockRequest(BaseModel):
    name: Optional[str] = None
    x: Optional[float] = None
    y: Optional[float] = None
    width: Optional[float] = None
    height: Optional[float] = None


class AddPrerequisiteRequest(BaseModel):
    kc_id: str       # the KC that REQUIRES the prerequisite
    prereq_id: str   # the KC that must be mastered first
    label: Optional[str] = None
    weight: Optional[float] = 1.0
    edge_type: Optional[str] = "prerequisite"


class UpdateEdgeRequest(BaseModel):
    kc_id: str
    prereq_id: str
    label: Optional[str] = None
    weight: Optional[float] = 1.0
    edge_type: Optional[str] = None


class ChangeEdgeTypeRequest(BaseModel):
    kc_id: str
    prereq_id: str
    edge_type: str  # 'prerequisite' | 'inference' | 'unsure'


class ReverseEdgeRequest(BaseModel):
    kc_id: str
    prereq_id: str


class CreateNoteRequest(BaseModel):
    content: Optional[str] = ""
    x: float = 0.0
    y: float = 0.0
    width: Optional[float] = 200.0
    height: Optional[float] = 150.0
    color: Optional[str] = "yellow"


class UpdateNoteRequest(BaseModel):
    content: Optional[str] = None
    x: Optional[float] = None
    y: Optional[float] = None
    width: Optional[float] = None
    height: Optional[float] = None


# ── Routes ────────────────────────────────────────────────────────────────────

@router.get("/", summary="Get full graph (nodes + edges) for React Flow")
async def get_graph(request: Request, db: AsyncSession = Depends(get_db)):
    data = await graph_service.get_graph_json(db)
    content = json.dumps(data, separators=(",", ":"), sort_keys=True)
    etag = f'"{hashlib.md5(content.encode()).hexdigest()[:16]}"'

    # Return 304 if client already has the latest version
    if request.headers.get("if-none-match") == etag:
        return Response(status_code=304, headers={"ETag": etag})

    return JSONResponse(
        data,
        headers={
            "ETag": etag,
            "Cache-Control": "public, max-age=15, stale-while-revalidate=30",
        },
    )


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
            chapter_info=body.chapter_info,
            block_id=body.block_id,
        )
        return {"id": str(kc.id), "code": kc.code, "name": kc.name, "grade": kc.grade, "chapter_info": kc.chapter_info, "block_id": str(kc.block_id) if kc.block_id else None}
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
        req_dict = body.dict(exclude_unset=True)
        update_block_id = "block_id" in req_dict

        kc = await graph_service.update_kc(
            db,
            kc_id=kc_id,
            name=body.name,
            grade=body.grade,
            subject=body.subject,
            description=body.description,
            chapter_info=body.chapter_info,
            notes=body.notes,
            block_id=body.block_id,
            update_block_id=update_block_id,
            x=body.x,
            y=body.y,
        )
        return {
            "id": str(kc.id),
            "code": kc.code,
            "name": kc.name,
            "grade": kc.grade,
            "subject": kc.subject,
            "description": kc.description,
            "chapter_info": kc.chapter_info,
            "notes": kc.notes,
            "block_id": str(kc.block_id) if kc.block_id else None,
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
        weight=body.weight or 1.0,
        edge_type=body.edge_type or "prerequisite",
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
            weight=body.weight or 1.0,
            edge_type=body.edge_type,
        )
        return {"ok": True}
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/edge/change-type", summary="Change edge type (prerequisite/inference/unsure) — deletes and recreates")
async def change_edge_type(
    body: ChangeEdgeTypeRequest,
    db: AsyncSession = Depends(get_db),
):
    result = await graph_service.change_edge_type(
        db,
        kc_id=body.kc_id,
        prereq_id=body.prereq_id,
        edge_type=body.edge_type,
    )
    if not result.get("ok"):
        raise HTTPException(status_code=400, detail=result.get("error", "Unknown error"))
    return {"ok": True}


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


@router.get("/db-info", summary="Get database table info/counts")
async def get_db_info(db: AsyncSession = Depends(get_db)):
    from sqlalchemy import text
    tables = [
        "kc_prerequisites", "responses", "student_kc", "student_irt",
        "item_edit_log", "item_versions", "items", "content_assets",
        "graph_edit_history", "kc_notes", "knowledge_components", "cms_users",
        "graph_blocks"
    ]
    counts = {}
    for table in tables:
        try:
            res = await db.execute(text(f"SELECT COUNT(*) FROM {table}"))
            counts[table] = res.scalar()
        except Exception as e:
            counts[table] = f"Error: {e}"
    return counts


@router.post("/db-clean", summary="Dangerously truncate all tables in database")
async def db_clean(db: AsyncSession = Depends(get_db)):
    from sqlalchemy import text
    tables = [
        "kc_prerequisites", "responses", "student_kc", "student_irt",
        "item_edit_log", "item_versions", "items", "content_assets",
        "graph_edit_history", "kc_notes", "knowledge_components", "cms_users",
        "graph_blocks"
    ]
    truncated = []
    for table in tables:
        try:
            await db.execute(text(f"TRUNCATE TABLE {table} CASCADE;"))
            truncated.append(table)
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"Failed to truncate {table}: {e}")
    await db.commit()
    graph_service.invalidate_graph_cache()
    return {"status": "success", "truncated": truncated}


@router.post("/block", status_code=status.HTTP_201_CREATED, summary="Create a new visual group block")
async def create_block(body: CreateBlockRequest, db: AsyncSession = Depends(get_db)):
    try:
        block = await graph_service.create_block(
            db,
            name=body.name,
            x=body.x,
            y=body.y,
            width=body.width or 400.0,
            height=body.height or 300.0,
        )
        return {
            "id": str(block.id),
            "name": block.name,
            "x": block.x,
            "y": block.y,
            "width": block.width,
            "height": block.height,
        }
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.put("/block/{block_id}", summary="Update a block's details (name, coordinates, dimensions)")
async def update_block(block_id: str, body: UpdateBlockRequest, db: AsyncSession = Depends(get_db)):
    try:
        block = await graph_service.update_block(
            db,
            block_id=block_id,
            name=body.name,
            x=body.x,
            y=body.y,
            width=body.width,
            height=body.height,
        )
        return {
            "id": str(block.id),
            "name": block.name,
            "x": block.x,
            "y": block.y,
            "width": block.width,
            "height": block.height,
        }
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.delete("/block/{block_id}", summary="Delete a block (dissociating all member nodes)")
async def delete_block(block_id: str, db: AsyncSession = Depends(get_db)):
    try:
        result = await graph_service.delete_block(db, block_id)
        return result
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


# ── Note (Sticky Notes) Routes ────────────────────────────────────────────────

@router.post("/note", status_code=status.HTTP_201_CREATED, summary="Create a sticky note on the canvas")
async def create_note(body: CreateNoteRequest, db: AsyncSession = Depends(get_db)):
    try:
        note = await graph_service.create_note(
            db,
            content=body.content or "",
            x=body.x,
            y=body.y,
            width=body.width or 200.0,
            height=body.height or 150.0,
            color=body.color or "yellow",
        )
        return note
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.put("/note/{note_id}", summary="Update a sticky note's content or position")
async def update_note(note_id: str, body: UpdateNoteRequest, db: AsyncSession = Depends(get_db)):
    try:
        note = await graph_service.update_note(
            db,
            note_id=note_id,
            content=body.content,
            x=body.x,
            y=body.y,
            width=body.width,
            height=body.height,
        )
        if not isinstance(note, dict) or note.get("ok") is False:
            raise HTTPException(status_code=404, detail=note.get("error", "Not found"))
        return note
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.delete("/note/{note_id}", summary="Delete a sticky note")
async def delete_note(note_id: str, db: AsyncSession = Depends(get_db)):
    try:
        result = await graph_service.delete_note(db, note_id)
        return result
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


# ── KC Image Endpoints ────────────────────────────────────────────────────────

MAX_IMAGE_SIZE = 10 * 1024 * 1024  # 10 MB
ALLOWED_CONTENT_TYPES = {
    "image/jpeg", "image/png", "image/gif", "image/bmp",
    "image/webp", "image/tiff", "image/heic", "image/heif",
}
BLOCKED_TYPES = {"image/svg+xml"}  # Pillow cannot rasterise SVG


@router.post("/kc/{kc_id}/images", summary="Upload an image for a KC")
async def upload_kc_image(
    kc_id: str,
    file: UploadFile = File(...),
    db: AsyncSession = Depends(get_db),
):
    from app.services.image_service import compress_to_webp, upload_to_supabase
    import uuid as uuid_mod

    # ── Validate content type
    ct = (file.content_type or "").lower()
    if ct in BLOCKED_TYPES:
        raise HTTPException(status_code=422, detail="SVG không được hỗ trợ. Dùng JPG, PNG, hoặc WebP.")
    if ct and ct not in ALLOWED_CONTENT_TYPES and not ct.startswith("image/"):
        raise HTTPException(status_code=422, detail=f"Định dạng không hỗ trợ: {ct}")

    raw = await file.read()

    # ── Validate size (server-side guard even if frontend checks)
    if len(raw) > MAX_IMAGE_SIZE:
        raise HTTPException(
            status_code=413,
            detail=f"Ảnh quá lớn ({len(raw) // 1024}KB). Giới hạn là 10MB.",
        )
    if len(raw) < 100:
        raise HTTPException(status_code=422, detail="File ảnh bị hỏng hoặc quá nhỏ.")

    # ── Convert to WebP
    try:
        webp_bytes = compress_to_webp(raw)
    except ValueError as e:
        raise HTTPException(status_code=422, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=422, detail=f"Không thể xử lý ảnh: {e}")

    # ── Upload to Supabase Storage
    image_id = str(uuid_mod.uuid4())
    try:
        url = await upload_to_supabase(kc_id, image_id, webp_bytes)
    except ValueError as e:
        raise HTTPException(status_code=503, detail=str(e))

    # ── Persist URL in KC metadata
    try:
        entry = await graph_service.add_kc_image(
            db,
            kc_id=kc_id,
            url=url,
            original_name=file.filename or "image",
            size_bytes=len(webp_bytes),
        )
        return {"ok": True, **entry}
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.delete("/kc/{kc_id}/images/{image_id}", summary="Delete a KC image")
async def delete_kc_image(
    kc_id: str,
    image_id: str,
    db: AsyncSession = Depends(get_db),
):
    from app.services.image_service import delete_from_supabase

    # Delete from Storage (soft-fail if already gone)
    try:
        await delete_from_supabase(kc_id, image_id)
    except Exception:
        pass  # log but don't block DB cleanup

    # Remove from KC metadata
    try:
        await graph_service.remove_kc_image(db, kc_id=kc_id, image_id=image_id)
        return {"ok": True}
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))
