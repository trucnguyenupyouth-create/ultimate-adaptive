-- Migration 006: Edge types + Sticky notes
-- ============================================================

-- 1. Add edge_type column to kc_prerequisites
ALTER TABLE kc_prerequisites
  ADD COLUMN IF NOT EXISTS edge_type VARCHAR(20) NOT NULL DEFAULT 'prerequisite';

-- Ensure only valid values
ALTER TABLE kc_prerequisites
  DROP CONSTRAINT IF EXISTS kc_prerequisites_edge_type_check;

ALTER TABLE kc_prerequisites
  ADD CONSTRAINT kc_prerequisites_edge_type_check
  CHECK (edge_type IN ('prerequisite', 'inference', 'unsure'));

-- 2. Create graph_notes table
CREATE TABLE IF NOT EXISTS graph_notes (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    content     TEXT NOT NULL DEFAULT '',
    x           FLOAT NOT NULL DEFAULT 0.0,
    y           FLOAT NOT NULL DEFAULT 0.0,
    width       FLOAT NOT NULL DEFAULT 200.0,
    height      FLOAT NOT NULL DEFAULT 150.0,
    color       VARCHAR(20) NOT NULL DEFAULT 'yellow',
    created_at  TIMESTAMPTZ DEFAULT NOW(),
    updated_at  TIMESTAMPTZ DEFAULT NOW()
);
