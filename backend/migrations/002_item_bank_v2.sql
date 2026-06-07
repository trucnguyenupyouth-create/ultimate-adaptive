-- ============================================================
-- MIGRATION 002: Item Bank V2 — Operation System Enhancements
-- Safe: all changes are additive (no table drops or column changes)
-- ============================================================

-- 1. Add notes column to knowledge_components (for "Ghi chú" tab)
ALTER TABLE knowledge_components
  ADD COLUMN IF NOT EXISTS notes TEXT;

-- 2. Better index for querying items by KC + difficulty + active status
CREATE INDEX IF NOT EXISTS idx_items_kc_active_difficulty
  ON items (kc_id, difficulty_label, is_active)
  WHERE is_active = TRUE;

-- 3. Audit log for item edits (every create/deactivate/replace is logged)
CREATE TABLE IF NOT EXISTS item_edit_log (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  item_id      UUID NOT NULL REFERENCES items(id),
  action       VARCHAR(20) NOT NULL,   -- 'created' | 'deactivated' | 'replaced'
  old_item_id  UUID REFERENCES items(id),  -- for 'replaced': the item being replaced
  reason       TEXT,
  performed_by UUID REFERENCES cms_users(id),
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_item_edit_log_item
  ON item_edit_log (item_id, created_at DESC);

-- 4. KC notes table (separate from metadata_ for clarity)
--    One row per KC, upsert on save
CREATE TABLE IF NOT EXISTS kc_notes (
  kc_id       UUID PRIMARY KEY REFERENCES knowledge_components(id) ON DELETE CASCADE,
  notes       TEXT NOT NULL DEFAULT '',
  updated_by  UUID REFERENCES cms_users(id),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- NOTES on items.content JSONB schema (MCQ format):
-- {
--   "question": "string (supports LaTeX $...$)",
--   "answers": [
--     { "label": "A", "text": "string", "is_correct": true },
--     { "label": "B", "text": "string", "is_correct": false },
--     ...
--   ]
-- }
-- difficulty_label -> irt_b mapping:
--   easy   -> irt_b = -1.0
--   medium -> irt_b =  0.0
--   hard   -> irt_b =  1.5
-- ============================================================
