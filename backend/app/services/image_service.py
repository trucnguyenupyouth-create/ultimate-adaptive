"""
image_service.py — Image storage for the KC graph + MCQ questions.

Sections:
  A) WebP compression (Pillow) — compress_to_webp()
  B) KC image storage (original) — upload_to_supabase / delete_from_supabase
     Uses kc-images bucket via raw httpx (proven working in production)
  C) Question/draft image storage (new) — upload_images, delete_image, etc.
     Reuses the same kc-images bucket under a "questions/" prefix.
     All storage calls use async httpx so no blocking of the event loop.
"""

from __future__ import annotations

import asyncio
import io
import logging
import uuid as uuid_mod
from typing import Optional

import httpx
from PIL import Image, UnidentifiedImageError
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.models.models import ItemImage

log = logging.getLogger(__name__)

# ── Shared storage config ─────────────────────────────────────────────────────
# Both KC images and question images share the same Supabase bucket.
# KC images  → kc-images/{kc_id}/{image_id}.webp
# Question images → kc-images/questions/{item_or_draft_id}/{uuid}.{ext}

KC_BUCKET = "kc-images"
MAX_WIDTH = 800
WEBP_QUALITY = 82

MAX_IMAGES_PER_QUESTION = 5
MAX_FILE_BYTES = 10 * 1024 * 1024  # 10 MB
ALLOWED_MIME = {"image/jpeg", "image/png", "image/webp", "image/gif"}


# ═══════════════════════════════════════════════════════════════════════════════
# A) WebP compression
# ═══════════════════════════════════════════════════════════════════════════════

def compress_to_webp(raw_bytes: bytes) -> bytes:
    """
    Convert raw image bytes to WebP.
    - Resizes to max MAX_WIDTH wide (preserving aspect ratio)
    - Converts RGBA/P/L to RGB (composited on white background)
    - Raises ValueError for unsupported formats (SVG, etc.)
    """
    try:
        img = Image.open(io.BytesIO(raw_bytes))
    except UnidentifiedImageError:
        raise ValueError(
            "Định dạng ảnh không được hỗ trợ. Vui lòng dùng JPG, PNG, GIF, BMP, hoặc WebP."
        )

    # Normalise to RGB — handle transparency by compositing on white
    if img.mode in ("RGBA", "LA", "PA"):
        bg = Image.new("RGB", img.size, (255, 255, 255))
        mask = img.split()[-1]
        bg.paste(img.convert("RGB"), mask=mask)
        img = bg
    elif img.mode == "P":
        img = img.convert("RGBA")
        bg = Image.new("RGB", img.size, (255, 255, 255))
        bg.paste(img.convert("RGB"), mask=img.split()[-1])
        img = bg
    elif img.mode != "RGB":
        img = img.convert("RGB")

    if img.width > MAX_WIDTH:
        ratio = MAX_WIDTH / img.width
        img = img.resize((MAX_WIDTH, int(img.height * ratio)), Image.LANCZOS)

    buf = io.BytesIO()
    img.save(buf, format="WEBP", quality=WEBP_QUALITY, method=6)
    return buf.getvalue()


# ═══════════════════════════════════════════════════════════════════════════════
# B) KC image storage  (original implementation — do not change)
# ═══════════════════════════════════════════════════════════════════════════════

def _storage_url(bucket: str, path: str) -> str:
    return f"{settings.SUPABASE_URL}/storage/v1/object/{bucket}/{path}"

def _auth_headers() -> dict:
    return {"Authorization": f"Bearer {settings.SUPABASE_SERVICE_KEY}"}

def _public_url(bucket: str, path: str) -> str:
    return f"{settings.SUPABASE_URL}/storage/v1/object/public/{bucket}/{path}"


async def upload_to_supabase(kc_id: str, image_id: str, webp_bytes: bytes) -> str:
    """Upload WebP bytes to Supabase Storage under kc-images. Returns the public URL."""
    if not settings.SUPABASE_URL or not settings.SUPABASE_SERVICE_KEY:
        raise ValueError(
            "Supabase Storage chưa được cấu hình (thiếu SUPABASE_URL hoặc SUPABASE_SERVICE_KEY)."
        )

    path = f"{kc_id}/{image_id}.webp"
    url = _storage_url(KC_BUCKET, path)

    async with httpx.AsyncClient(timeout=30) as client:
        resp = await client.post(
            url,
            content=webp_bytes,
            headers={**_auth_headers(), "Content-Type": "image/webp", "x-upsert": "true"},
        )
        if resp.status_code not in (200, 201):
            log.error("Supabase upload failed %s: %s", resp.status_code, resp.text)
            raise ValueError(f"Upload lên Storage thất bại ({resp.status_code}). Vui lòng thử lại.")

    return _public_url(KC_BUCKET, path)


async def delete_from_supabase(kc_id: str, image_id: str) -> None:
    """Remove a KC image from Supabase Storage (soft-fail if already gone)."""
    if not settings.SUPABASE_URL or not settings.SUPABASE_SERVICE_KEY:
        return

    path = f"{kc_id}/{image_id}.webp"
    url = _storage_url(KC_BUCKET, path)

    async with httpx.AsyncClient(timeout=10) as client:
        resp = await client.delete(url, headers=_auth_headers())
        if resp.status_code not in (200, 404):
            log.warning("Supabase delete returned %s: %s", resp.status_code, resp.text)


# ═══════════════════════════════════════════════════════════════════════════════
# C) Question / draft image storage (new)
# ═══════════════════════════════════════════════════════════════════════════════
# Reuses kc-images bucket with path prefix "questions/{folder_id}/{uuid}.ext"
# so no new bucket is needed.

QUESTION_PREFIX = "questions"


def _q_path(folder: str, ext: str) -> str:
    return f"{QUESTION_PREFIX}/{folder}/{uuid_mod.uuid4()}.{ext}"


async def _upload_raw(path: str, content: bytes, mime_type: str) -> str:
    """Upload raw bytes to kc-images bucket. Returns public URL."""
    if not settings.SUPABASE_URL or not settings.SUPABASE_SERVICE_KEY:
        raise RuntimeError(
            "SUPABASE_URL and SUPABASE_SERVICE_KEY must be set for image uploads."
        )
    url = _storage_url(KC_BUCKET, path)
    async with httpx.AsyncClient(timeout=30) as client:
        resp = await client.post(
            url,
            content=content,
            headers={**_auth_headers(), "Content-Type": mime_type, "x-upsert": "true"},
        )
        if resp.status_code not in (200, 201):
            log.error("Question image upload failed %s: %s", resp.status_code, resp.text)
            raise ValueError(f"Upload thất bại ({resp.status_code}): {resp.text[:200]}")
    return _public_url(KC_BUCKET, path)


async def _delete_raw(path: str) -> None:
    """Remove a file from kc-images bucket (soft-fail)."""
    if not settings.SUPABASE_URL or not settings.SUPABASE_SERVICE_KEY:
        return
    url = _storage_url(KC_BUCKET, path)
    async with httpx.AsyncClient(timeout=10) as client:
        resp = await client.delete(url, headers=_auth_headers())
        if resp.status_code not in (200, 404):
            log.warning("Question image delete returned %s: %s", resp.status_code, resp.text)


# ── Serialisation ─────────────────────────────────────────────────────────────

def _image_to_dict(img: ItemImage) -> dict:
    return {
        "id":            str(img.id),
        "item_id":       str(img.item_id)  if img.item_id  else None,
        "draft_id":      str(img.draft_id) if img.draft_id else None,
        "public_url":    img.public_url,
        "filename":      img.filename,
        "mime_type":     img.mime_type,
        "size_bytes":    img.size_bytes,
        "display_order": img.display_order,
        "caption":       img.caption,
        "created_at":    img.created_at.isoformat(),
    }


# ── Queries ───────────────────────────────────────────────────────────────────

async def get_images(
    db: AsyncSession,
    *,
    item_id: Optional[str] = None,
    draft_id: Optional[str] = None,
) -> list[dict]:
    stmt = select(ItemImage).order_by(ItemImage.display_order, ItemImage.created_at)
    if item_id:
        stmt = stmt.where(ItemImage.item_id == uuid_mod.UUID(item_id))
    elif draft_id:
        stmt = stmt.where(ItemImage.draft_id == uuid_mod.UUID(draft_id))
    else:
        return []
    result = await db.execute(stmt)
    return [_image_to_dict(img) for img in result.scalars().all()]


async def get_image(db: AsyncSession, image_id: str) -> Optional[dict]:
    img = await db.get(ItemImage, uuid_mod.UUID(image_id))
    return _image_to_dict(img) if img else None


# ── Upload ────────────────────────────────────────────────────────────────────

async def upload_images(
    db: AsyncSession,
    files: list[tuple[str, bytes, str]],
    *,
    item_id: Optional[str] = None,
    draft_id: Optional[str] = None,
) -> list[dict]:
    """Upload 1–5 images and create ItemImage rows. Exactly one parent must be given."""
    if bool(item_id) == bool(draft_id):
        raise ValueError("Exactly one of item_id or draft_id must be provided")

    existing = await get_images(db, item_id=item_id, draft_id=draft_id)
    if len(existing) + len(files) > MAX_IMAGES_PER_QUESTION:
        raise ValueError(
            f"Limit is {MAX_IMAGES_PER_QUESTION} images per question "
            f"(already has {len(existing)}, tried to add {len(files)})."
        )

    folder = draft_id or item_id
    results: list[dict] = []
    max_order = max((img["display_order"] for img in existing), default=-1)

    for filename, content, mime_type in files:
        if mime_type not in ALLOWED_MIME:
            raise ValueError(f"Unsupported type: {mime_type}. Use jpeg/png/webp/gif.")
        if len(content) > MAX_FILE_BYTES:
            raise ValueError(f"File '{filename}' exceeds 10 MB limit")

        ext = filename.rsplit(".", 1)[-1].lower() if "." in filename else "jpg"
        path = _q_path(folder, ext)
        public_url = await _upload_raw(path, content, mime_type)

        max_order += 1
        img_row = ItemImage(
            item_id=uuid_mod.UUID(item_id)   if item_id  else None,
            draft_id=uuid_mod.UUID(draft_id) if draft_id else None,
            storage_path=path,
            public_url=public_url,
            filename=filename,
            mime_type=mime_type,
            size_bytes=len(content),
            display_order=max_order,
        )
        db.add(img_row)
        await db.flush()
        results.append(_image_to_dict(img_row))

    await db.commit()
    return results


# ── Delete ────────────────────────────────────────────────────────────────────

async def delete_image(db: AsyncSession, image_id: str) -> bool:
    img = await db.get(ItemImage, uuid_mod.UUID(image_id))
    if not img:
        return False
    await _delete_raw(img.storage_path)
    await db.delete(img)
    await db.commit()
    return True


# ── Replace ───────────────────────────────────────────────────────────────────

async def replace_image(
    db: AsyncSession, image_id: str, filename: str, content: bytes, mime_type: str
) -> Optional[dict]:
    img = await db.get(ItemImage, uuid_mod.UUID(image_id))
    if not img:
        return None
    if mime_type not in ALLOWED_MIME:
        raise ValueError(f"Unsupported type: {mime_type}")
    if len(content) > MAX_FILE_BYTES:
        raise ValueError("File exceeds 10 MB limit")

    await _delete_raw(img.storage_path)

    folder = str(img.draft_id or img.item_id)
    ext = filename.rsplit(".", 1)[-1].lower() if "." in filename else "jpg"
    new_path = _q_path(folder, ext)
    public_url = await _upload_raw(new_path, content, mime_type)

    img.storage_path = new_path
    img.public_url   = public_url
    img.filename     = filename
    img.mime_type    = mime_type
    img.size_bytes   = len(content)
    await db.commit()
    return _image_to_dict(img)


# ── Update metadata ───────────────────────────────────────────────────────────

async def update_image_meta(
    db: AsyncSession, image_id: str, *, caption: Optional[str] = None, display_order: Optional[int] = None
) -> Optional[dict]:
    img = await db.get(ItemImage, uuid_mod.UUID(image_id))
    if not img:
        return None
    if caption is not None:
        img.caption = caption or None
    if display_order is not None:
        img.display_order = display_order
    await db.commit()
    return _image_to_dict(img)


# ── Reorder ───────────────────────────────────────────────────────────────────

async def reorder_images(db: AsyncSession, image_ids: list[str]) -> list[dict]:
    results = []
    for order, image_id in enumerate(image_ids):
        img = await db.get(ItemImage, uuid_mod.UUID(image_id))
        if img:
            img.display_order = order
            results.append(_image_to_dict(img))
    await db.commit()
    return results


# ── Draft → Item migration ────────────────────────────────────────────────────

async def migrate_images_draft_to_item(db: AsyncSession, draft_id: str, item_id: str) -> int:
    """Reassign all draft images to the newly approved item. Caller commits."""
    stmt = select(ItemImage).where(ItemImage.draft_id == uuid_mod.UUID(draft_id))
    result = await db.execute(stmt)
    images = result.scalars().all()
    for img in images:
        img.item_id  = uuid_mod.UUID(item_id)
        img.draft_id = None
    return len(images)
