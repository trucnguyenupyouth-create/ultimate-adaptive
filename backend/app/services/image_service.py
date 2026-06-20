"""
image_service.py — Supabase Storage integration for question images.

Design:
  - Images live in the Supabase 'question-images' bucket.
  - Each image row has EITHER item_id OR draft_id set (never both).
  - On draft approval, migrate_images_draft_to_item() reassigns rows.
  - All Supabase storage calls are sync (supabase-py v2); wrapped in
    asyncio.to_thread() to avoid blocking the async event loop.
"""

import asyncio
import uuid
from typing import Optional

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from supabase import create_client, Client

from app.core.config import settings
from app.models.models import ItemImage

BUCKET = "question-images"
MAX_IMAGES_PER_QUESTION = 5
MAX_FILE_BYTES = 5 * 1024 * 1024  # 5 MB
ALLOWED_MIME = {"image/jpeg", "image/png", "image/webp", "image/gif"}

_supabase: Optional[Client] = None


def _get_client() -> Client:
    """Singleton Supabase client (connection is cheap to reuse)."""
    global _supabase
    if _supabase is None:
        if not settings.SUPABASE_URL or not settings.SUPABASE_SERVICE_KEY:
            raise RuntimeError("SUPABASE_URL and SUPABASE_SERVICE_KEY must be set")
        _supabase = create_client(settings.SUPABASE_URL, settings.SUPABASE_SERVICE_KEY)
    return _supabase


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
    """Return all images for an item or draft, ordered by display_order."""
    stmt = select(ItemImage).order_by(ItemImage.display_order, ItemImage.created_at)
    if item_id:
        stmt = stmt.where(ItemImage.item_id == uuid.UUID(item_id))
    elif draft_id:
        stmt = stmt.where(ItemImage.draft_id == uuid.UUID(draft_id))
    else:
        return []
    result = await db.execute(stmt)
    return [_image_to_dict(img) for img in result.scalars().all()]


async def get_image(db: AsyncSession, image_id: str) -> Optional[dict]:
    img = await db.get(ItemImage, uuid.UUID(image_id))
    return _image_to_dict(img) if img else None


# ── Upload ────────────────────────────────────────────────────────────────────

async def upload_images(
    db: AsyncSession,
    files: list[tuple[str, bytes, str]],  # [(filename, content, mime_type), ...]
    *,
    item_id: Optional[str] = None,
    draft_id: Optional[str] = None,
) -> list[dict]:
    """
    Upload one or more images to Supabase Storage and create ItemImage rows.
    Exactly one of item_id / draft_id must be provided.
    """
    if bool(item_id) == bool(draft_id):
        raise ValueError("Exactly one of item_id or draft_id must be provided")

    existing = await get_images(db, item_id=item_id, draft_id=draft_id)
    if len(existing) + len(files) > MAX_IMAGES_PER_QUESTION:
        raise ValueError(
            f"Limit is {MAX_IMAGES_PER_QUESTION} images per question. "
            f"Already has {len(existing)}, tried to add {len(files)}."
        )

    client = _get_client()
    folder = draft_id or item_id
    results: list[dict] = []
    max_order = max((img["display_order"] for img in existing), default=-1)

    for filename, content, mime_type in files:
        if mime_type not in ALLOWED_MIME:
            raise ValueError(f"Unsupported file type: {mime_type}. Allowed: jpeg, png, webp, gif")
        if len(content) > MAX_FILE_BYTES:
            raise ValueError(f"File '{filename}' exceeds 5 MB limit")

        ext = filename.rsplit(".", 1)[-1].lower() if "." in filename else "jpg"
        object_path = f"{folder}/{uuid.uuid4()}.{ext}"

        await asyncio.to_thread(
            client.storage.from_(BUCKET).upload,
            path=object_path,
            file=content,
            file_options={"content-type": mime_type, "upsert": "false"},
        )

        public_url: str = client.storage.from_(BUCKET).get_public_url(object_path)

        max_order += 1
        img = ItemImage(
            item_id=uuid.UUID(item_id)   if item_id  else None,
            draft_id=uuid.UUID(draft_id) if draft_id else None,
            storage_path=object_path,
            public_url=public_url,
            filename=filename,
            mime_type=mime_type,
            size_bytes=len(content),
            display_order=max_order,
        )
        db.add(img)
        await db.flush()
        results.append(_image_to_dict(img))

    await db.commit()
    return results


# ── Delete ────────────────────────────────────────────────────────────────────

async def delete_image(db: AsyncSession, image_id: str) -> bool:
    img = await db.get(ItemImage, uuid.UUID(image_id))
    if not img:
        return False

    client = _get_client()
    await asyncio.to_thread(
        client.storage.from_(BUCKET).remove,
        [img.storage_path],
    )

    await db.delete(img)
    await db.commit()
    return True


# ── Replace ───────────────────────────────────────────────────────────────────

async def replace_image(
    db: AsyncSession,
    image_id: str,
    filename: str,
    content: bytes,
    mime_type: str,
) -> Optional[dict]:
    """Replace the file for an existing image row. Same ID, display_order preserved."""
    img = await db.get(ItemImage, uuid.UUID(image_id))
    if not img:
        return None
    if mime_type not in ALLOWED_MIME:
        raise ValueError(f"Unsupported file type: {mime_type}")
    if len(content) > MAX_FILE_BYTES:
        raise ValueError("File exceeds 5 MB limit")

    client = _get_client()
    await asyncio.to_thread(client.storage.from_(BUCKET).remove, [img.storage_path])

    folder = str(img.draft_id or img.item_id)
    ext = filename.rsplit(".", 1)[-1].lower() if "." in filename else "jpg"
    new_path = f"{folder}/{uuid.uuid4()}.{ext}"

    await asyncio.to_thread(
        client.storage.from_(BUCKET).upload,
        path=new_path,
        file=content,
        file_options={"content-type": mime_type, "upsert": "false"},
    )

    public_url: str = client.storage.from_(BUCKET).get_public_url(new_path)

    img.storage_path = new_path
    img.public_url   = public_url
    img.filename     = filename
    img.mime_type    = mime_type
    img.size_bytes   = len(content)
    await db.commit()
    return _image_to_dict(img)


# ── Update metadata ───────────────────────────────────────────────────────────

async def update_image_meta(
    db: AsyncSession,
    image_id: str,
    *,
    caption: Optional[str] = None,
    display_order: Optional[int] = None,
) -> Optional[dict]:
    img = await db.get(ItemImage, uuid.UUID(image_id))
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
    """Set display_order based on the order of IDs in the list."""
    results = []
    for order, image_id in enumerate(image_ids):
        img = await db.get(ItemImage, uuid.UUID(image_id))
        if img:
            img.display_order = order
            results.append(_image_to_dict(img))
    await db.commit()
    return results


# ── Draft → Item migration ────────────────────────────────────────────────────

async def migrate_images_draft_to_item(
    db: AsyncSession,
    draft_id: str,
    item_id: str,
) -> int:
    """
    Reassign all images from a draft to the newly approved item.
    Called inside approve_draft() — caller commits the transaction.
    Returns the number of images migrated.
    """
    stmt = select(ItemImage).where(ItemImage.draft_id == uuid.UUID(draft_id))
    result = await db.execute(stmt)
    images = result.scalars().all()
    for img in images:
        img.item_id  = uuid.UUID(item_id)
        img.draft_id = None
    return len(images)
