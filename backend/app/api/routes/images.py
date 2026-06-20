"""
images.py — REST endpoints for question image management.

Endpoints:
  POST   /images/upload                  Upload 1–5 images to an item or draft
  GET    /images/{id}                    Get single image metadata
  PATCH  /images/{id}                    Update caption or display_order
  DELETE /images/{id}                    Delete image (storage + DB)
  POST   /images/{id}/replace            Replace file (keeps same ID)
  POST   /images/reorder                 Batch update display_order
  GET    /images/for-item/{item_id}      List images for an approved item
  GET    /images/for-draft/{draft_id}    List images for a draft
"""

from typing import List, Optional

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile, status
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.services import image_service

router = APIRouter(prefix="/images", tags=["Images"])


# ── List ──────────────────────────────────────────────────────────────────────

@router.get("/for-item/{item_id}", summary="List images for an approved item")
async def list_images_for_item(item_id: str, db: AsyncSession = Depends(get_db)):
    return await image_service.get_images(db, item_id=item_id)


@router.get("/for-draft/{draft_id}", summary="List images for a draft")
async def list_images_for_draft(draft_id: str, db: AsyncSession = Depends(get_db)):
    return await image_service.get_images(db, draft_id=draft_id)


@router.get("/{image_id}", summary="Get a single image record")
async def get_image(image_id: str, db: AsyncSession = Depends(get_db)):
    img = await image_service.get_image(db, image_id)
    if not img:
        raise HTTPException(status_code=404, detail="Image not found")
    return img


# ── Upload ────────────────────────────────────────────────────────────────────

@router.post(
    "/upload",
    status_code=status.HTTP_201_CREATED,
    summary="Upload images (multipart). Attach to item_id OR draft_id.",
)
async def upload_images(
    files: List[UploadFile] = File(..., description="1–5 image files (jpg/png/webp/gif, ≤5MB each)"),
    item_id: Optional[str]  = Form(None, description="Attach to approved item"),
    draft_id: Optional[str] = Form(None, description="Attach to draft"),
    db: AsyncSession = Depends(get_db),
):
    if not files:
        raise HTTPException(status_code=422, detail="At least one file is required")
    if bool(item_id) == bool(draft_id):
        raise HTTPException(status_code=422, detail="Provide exactly one of item_id or draft_id")

    file_tuples = []
    for f in files:
        content = await f.read()
        mime = f.content_type or "image/jpeg"
        file_tuples.append((f.filename or "upload.jpg", content, mime))

    try:
        return await image_service.upload_images(
            db, file_tuples, item_id=item_id, draft_id=draft_id
        )
    except ValueError as e:
        raise HTTPException(status_code=422, detail=str(e))
    except RuntimeError as e:
        # Supabase not configured on this environment
        raise HTTPException(
            status_code=503,
            detail=f"Image storage not configured: {e}. Set SUPABASE_URL and SUPABASE_SERVICE_KEY in environment variables.",
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Upload failed: {e}")


# ── Update metadata ───────────────────────────────────────────────────────────

class ImageMetaUpdate(BaseModel):
    caption: Optional[str] = None
    display_order: Optional[int] = None


@router.patch("/{image_id}", summary="Update image caption or display_order")
async def update_image(
    image_id: str,
    body: ImageMetaUpdate,
    db: AsyncSession = Depends(get_db),
):
    result = await image_service.update_image_meta(
        db, image_id,
        caption=body.caption,
        display_order=body.display_order,
    )
    if not result:
        raise HTTPException(status_code=404, detail="Image not found")
    return result


# ── Delete ────────────────────────────────────────────────────────────────────

@router.delete("/{image_id}", status_code=status.HTTP_204_NO_CONTENT, summary="Delete image")
async def delete_image(image_id: str, db: AsyncSession = Depends(get_db)):
    deleted = await image_service.delete_image(db, image_id)
    if not deleted:
        raise HTTPException(status_code=404, detail="Image not found")


# ── Replace ───────────────────────────────────────────────────────────────────

@router.post(
    "/{image_id}/replace",
    summary="Replace image file (keeps same ID and display_order)",
)
async def replace_image(
    image_id: str,
    file: UploadFile = File(..., description="New image file"),
    db: AsyncSession = Depends(get_db),
):
    content = await file.read()
    mime = file.content_type or "image/jpeg"
    try:
        result = await image_service.replace_image(
            db, image_id,
            filename=file.filename or "upload.jpg",
            content=content,
            mime_type=mime,
        )
    except ValueError as e:
        raise HTTPException(status_code=422, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Replace failed: {e}")

    if not result:
        raise HTTPException(status_code=404, detail="Image not found")
    return result


# ── Reorder ───────────────────────────────────────────────────────────────────

class ReorderRequest(BaseModel):
    image_ids: List[str]   # IDs in desired display order (index 0 = first)


@router.post("/reorder", summary="Batch-update display_order for a question's images")
async def reorder_images(body: ReorderRequest, db: AsyncSession = Depends(get_db)):
    if not body.image_ids:
        raise HTTPException(status_code=422, detail="image_ids cannot be empty")
    return await image_service.reorder_images(db, body.image_ids)
