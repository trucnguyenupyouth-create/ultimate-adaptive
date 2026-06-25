-- 012_assessment_v2_item_reviews.sql
-- Durable academic review state for Assessment V2 open diagnostic items.
-- The item content remains JSON-first, but review decisions/comments must persist in production.

CREATE TABLE IF NOT EXISTS assessment_v2_item_reviews (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    review_id           VARCHAR(64) UNIQUE NOT NULL,
    item_payload         JSONB NOT NULL DEFAULT '{}',

    review_decision      VARCHAR(20) NOT NULL DEFAULT 'needs_review',
    flagged_for_review   BOOLEAN NOT NULL DEFAULT FALSE,
    review_comment       TEXT NOT NULL DEFAULT '',
    review_history       JSONB NOT NULL DEFAULT '[]',

    reviewed_at          TIMESTAMPTZ,
    created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT assessment_v2_item_reviews_decision_check
        CHECK (review_decision IN ('needs_review', 'accepted', 'rejected', 'revise'))
);

CREATE INDEX IF NOT EXISTS idx_assessment_v2_item_reviews_decision
    ON assessment_v2_item_reviews(review_decision);

CREATE INDEX IF NOT EXISTS idx_assessment_v2_item_reviews_flagged
    ON assessment_v2_item_reviews(flagged_for_review);
