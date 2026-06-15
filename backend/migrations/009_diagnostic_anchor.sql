-- Migration 009: Diagnostic Anchor field for Entry-Point Constraint-Based Item Selection
--
-- is_diagnostic_anchor = TRUE marks items that are:
--   1. Pure definitional (no cognitive load overhead / no reading comprehension barrier)
--   2. Single-step (low P(Slip))
--   3. irt_b ≈ 0 (medium difficulty, max Fisher Information at θ=0)
--   4. High irt_a (high discrimination — reliable 0/1 signal)
--
-- Used by CATController._pick_item() for Cold Start (first item on a new KC).
-- References: Construct-Irrelevant Variance (KST), ALEKS/MAP best practices.

ALTER TABLE items
  ADD COLUMN IF NOT EXISTS is_diagnostic_anchor BOOLEAN NOT NULL DEFAULT FALSE;

-- Partial index for fast anchor lookup per KC (assessment hot path)
CREATE INDEX IF NOT EXISTS idx_items_anchor
  ON items (kc_id, irt_a DESC)
  WHERE is_active = TRUE AND is_diagnostic_anchor = TRUE;

COMMENT ON COLUMN items.is_diagnostic_anchor IS
  'TRUE = câu thuần túy định nghĩa, đơn bước, dùng làm Entry Point (Cold Start) cho CAT. Tag bởi Content Team.';
