-- ============================================================
-- Migration 010: item_drafts — AI-generated MCQ Staging Table
-- ============================================================
-- Purpose: Hold AI-generated questions pending human review.
--          Approved drafts are imported into items table.
--          Rejected drafts stay here for audit trail.
-- ============================================================

CREATE TABLE IF NOT EXISTS item_drafts (
    id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- KC reference
    kc_id                UUID NOT NULL REFERENCES knowledge_components(id) ON DELETE CASCADE,
    kc_name              TEXT NOT NULL,
    kc_code              TEXT NOT NULL,

    -- Question content (same shape as items.content)
    content              JSONB NOT NULL,        -- { question, answers: [{label, text, is_correct}] }

    -- IRT/KST metadata from AI
    difficulty_label     VARCHAR(16) NOT NULL,  -- easy | medium | hard
    is_diagnostic_anchor BOOLEAN NOT NULL DEFAULT FALSE,
    kst_irt_tag          TEXT,                  -- AI pedagogical analysis text

    -- Generation job tracking
    generation_job_id    UUID,                  -- groups drafts from same batch run
    sgk_section          TEXT,                  -- which SGK section was used (e.g. "B1K1")
    raw_ai_output        TEXT,                  -- raw Gemini response for debugging

    -- Review workflow
    status               VARCHAR(20) NOT NULL DEFAULT 'pending',
    -- pending | approved | rejected | edited_approved
    imported_item_id     UUID REFERENCES items(id) ON DELETE SET NULL,  -- set after approve
    reviewed_at          TIMESTAMPTZ,

    created_at           TIMESTAMPTZ DEFAULT NOW(),

    CONSTRAINT item_drafts_status_check
        CHECK (status IN ('pending', 'approved', 'rejected', 'edited_approved'))
);

CREATE INDEX idx_item_drafts_kc       ON item_drafts(kc_id);
CREATE INDEX idx_item_drafts_status   ON item_drafts(status);
CREATE INDEX idx_item_drafts_job      ON item_drafts(generation_job_id);
CREATE INDEX idx_item_drafts_pending  ON item_drafts(kc_id) WHERE status = 'pending';
