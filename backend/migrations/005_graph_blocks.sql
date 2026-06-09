-- Migration 005: Add graph_blocks table and block_id to knowledge_components
CREATE TABLE IF NOT EXISTS graph_blocks (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name        TEXT NOT NULL,
    x           FLOAT NOT NULL DEFAULT 0.0,
    y           FLOAT NOT NULL DEFAULT 0.0,
    width       FLOAT NOT NULL DEFAULT 400.0,
    height      FLOAT NOT NULL DEFAULT 300.0,
    created_at  TIMESTAMPTZ DEFAULT NOW(),
    updated_at  TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE knowledge_components 
  ADD COLUMN IF NOT EXISTS block_id UUID REFERENCES graph_blocks(id) ON DELETE SET NULL;
