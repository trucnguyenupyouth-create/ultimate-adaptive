-- 011_item_images.sql
-- Stores image attachments for questions (items and item_drafts).
-- Each row belongs to EITHER an approved item OR a pending draft (not both).
-- On draft approval, draft_id is replaced by item_id via image_service.migrate_images_draft_to_item().

CREATE TABLE IF NOT EXISTS item_images (
    id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),

    -- Exactly one of these must be non-null (enforced by CHECK below)
    item_id       UUID        REFERENCES items(id) ON DELETE CASCADE,
    draft_id      UUID        REFERENCES item_drafts(id) ON DELETE CASCADE,

    -- Supabase Storage
    storage_path  TEXT        NOT NULL,            -- e.g. "abc123/uuid.png" (bucket-relative)
    public_url    TEXT        NOT NULL,             -- full Supabase CDN URL

    -- File metadata
    filename      TEXT        NOT NULL,
    mime_type     VARCHAR(30) NOT NULL
                  CHECK (mime_type IN ('image/jpeg','image/png','image/webp','image/gif')),
    size_bytes    INTEGER     NOT NULL CHECK (size_bytes > 0 AND size_bytes <= 10485760),

    -- Display
    display_order INTEGER     NOT NULL DEFAULT 0,
    caption       TEXT,

    created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT one_parent CHECK (
        (item_id IS NOT NULL AND draft_id IS NULL) OR
        (item_id IS NULL     AND draft_id IS NOT NULL)
    )
);

CREATE INDEX IF NOT EXISTS idx_item_images_item
    ON item_images (item_id)  WHERE item_id  IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_item_images_draft
    ON item_images (draft_id) WHERE draft_id IS NOT NULL;
