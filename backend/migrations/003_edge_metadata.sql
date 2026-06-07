-- ============================================================
-- MIGRATION 003: Prerequisite Edge Metadata
-- Safe: all changes are additive (no table drops or column changes)
-- ============================================================

ALTER TABLE kc_prerequisites
  ADD COLUMN IF NOT EXISTS label TEXT,
  ADD COLUMN IF NOT EXISTS weight FLOAT DEFAULT 1.0,
  ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW(),
  ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES cms_users(id);
