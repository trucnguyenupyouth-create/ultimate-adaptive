-- 013_assessment_v2_sessions.sql
-- DB-backed student pilot sessions for Assessment V2.

CREATE TABLE IF NOT EXISTS assessment_v2_sessions (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_code    VARCHAR(64) UNIQUE NOT NULL,
    status          VARCHAR(20) NOT NULL DEFAULT 'in_progress',
    max_questions   INTEGER NOT NULL DEFAULT 35,
    student_label   TEXT,
    payload         JSONB NOT NULL DEFAULT '{}',
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    completed_at    TIMESTAMPTZ,

    CONSTRAINT assessment_v2_sessions_status_check
        CHECK (status IN ('in_progress', 'completed'))
);

CREATE INDEX IF NOT EXISTS idx_assessment_v2_sessions_status
    ON assessment_v2_sessions(status);

CREATE INDEX IF NOT EXISTS idx_assessment_v2_sessions_code
    ON assessment_v2_sessions(session_code);
