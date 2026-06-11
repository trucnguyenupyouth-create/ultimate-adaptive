-- ============================================================
-- MIGRATION 008: Document 'open' question format type
-- Safe: additive only — adds a COMMENT, no data changes
-- ============================================================
-- format_type values now:
--   'mcq4'     → 4-option multiple choice
--                content = { "question": "...", "answers": [ { "label": "A", "text": "...", "is_correct": true/false, "distractor_note": "..." } ] }
--   'fillin'   → Fill in the blank (short answer, auto-graded)
--   'freetext' → Long-form essay (human graded)
--   'open'     → Short open answer with a model answer key (AI/human graded)
--                content = { "question": "...", "expected_answer": "..." }
-- ============================================================

COMMENT ON COLUMN items.format_type IS 'mcq4 | fillin | freetext | open';
