"""
Image Service — WebP conversion + Supabase Storage CRUD

Responsibilities:
- compress_to_webp(): convert any PIL-supported format to WebP (max 800px wide)
- upload_to_supabase(): PUT file to Supabase Storage, return public CDN URL
- delete_from_supabase(): DELETE file from Supabase Storage

Unsupported formats (SVG, raw camera formats not handled by Pillow) raise
ValueError with a user-friendly message — callers should return 422.
"""

from __future__ import annotations

import io
import logging

import httpx
from PIL import Image, UnidentifiedImageError

from app.core.config import settings

log = logging.getLogger(__name__)

BUCKET = "kc-images"
MAX_WIDTH = 800
WEBP_QUALITY = 82  # 0-100; 82 is a good balance of size vs. quality


# ── Compression ──────────────────────────────────────────────────────────────

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
        mask = img.split()[-1]  # alpha channel
        bg.paste(img.convert("RGB"), mask=mask)
        img = bg
    elif img.mode == "P":
        img = img.convert("RGBA")
        bg = Image.new("RGB", img.size, (255, 255, 255))
        bg.paste(img.convert("RGB"), mask=img.split()[-1])
        img = bg
    elif img.mode != "RGB":
        img = img.convert("RGB")

    # Downscale if wider than MAX_WIDTH
    if img.width > MAX_WIDTH:
        ratio = MAX_WIDTH / img.width
        img = img.resize(
            (MAX_WIDTH, int(img.height * ratio)),
            Image.LANCZOS,
        )

    buf = io.BytesIO()
    img.save(buf, format="WEBP", quality=WEBP_QUALITY, method=6)
    return buf.getvalue()


# ── Supabase Storage ──────────────────────────────────────────────────────────

def _storage_url(path: str) -> str:
    return f"{settings.SUPABASE_URL}/storage/v1/object/{BUCKET}/{path}"

def _auth_headers() -> dict:
    return {
        "Authorization": f"Bearer {settings.SUPABASE_SERVICE_KEY}",
    }

def _public_url(path: str) -> str:
    return f"{settings.SUPABASE_URL}/storage/v1/object/public/{BUCKET}/{path}"


async def upload_to_supabase(kc_id: str, image_id: str, webp_bytes: bytes) -> str:
    """Upload WebP bytes to Supabase Storage. Returns the public CDN URL."""
    if not settings.SUPABASE_URL or not settings.SUPABASE_SERVICE_KEY:
        raise ValueError("Supabase Storage chưa được cấu hình (thiếu SUPABASE_URL hoặc SUPABASE_SERVICE_KEY).")

    path = f"{kc_id}/{image_id}.webp"
    url = _storage_url(path)

    async with httpx.AsyncClient(timeout=30) as client:
        resp = await client.post(
            url,
            content=webp_bytes,
            headers={
                **_auth_headers(),
                "Content-Type": "image/webp",
                "x-upsert": "true",  # overwrite if same ID re-uploaded
            },
        )
        if resp.status_code not in (200, 201):
            log.error("Supabase upload failed %s: %s", resp.status_code, resp.text)
            raise ValueError(f"Upload lên Storage thất bại ({resp.status_code}). Vui lòng thử lại.")

    return _public_url(path)


async def delete_from_supabase(kc_id: str, image_id: str) -> None:
    """Remove a single image from Supabase Storage."""
    if not settings.SUPABASE_URL or not settings.SUPABASE_SERVICE_KEY:
        return  # graceful no-op if storage not configured

    path = f"{kc_id}/{image_id}.webp"
    url = _storage_url(path)

    async with httpx.AsyncClient(timeout=10) as client:
        resp = await client.delete(url, headers=_auth_headers())
        # 200 = deleted, 404 = already gone — both are fine
        if resp.status_code not in (200, 404):
            log.warning("Supabase delete returned %s: %s", resp.status_code, resp.text)
