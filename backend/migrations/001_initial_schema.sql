-- ============================================================
-- ULTIMATE ADAPTIVE LEARNING SYSTEM — DB SCHEMA v1.0 (Layer 0)
-- ============================================================
-- Convention:
--   - All IDs: UUID (gen_random_uuid())
--   - All timestamps: TIMESTAMPTZ (UTC)
--   - NEVER UPDATE items table after student responses exist
--   - Soft Delete pattern: is_active = false → create new version
-- ============================================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================================
-- CORE TABLES (6 — Layer 0)
-- ============================================================

-- 1. Knowledge Components (KST nodes)
CREATE TABLE knowledge_components (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code        VARCHAR(64) UNIQUE NOT NULL,   -- e.g. "G9-ALG-PT1"
    name        TEXT NOT NULL,                  -- e.g. "Phương trình bậc 1 ẩn"
    grade       INT NOT NULL,                   -- 6, 7, 8, 9
    subject     VARCHAR(32) NOT NULL DEFAULT 'math',
    description TEXT,
    metadata    JSONB DEFAULT '{}',             -- extra info, tags
    created_at  TIMESTAMPTZ DEFAULT NOW(),
    updated_at  TIMESTAMPTZ DEFAULT NOW()
);

-- 2. KST Graph Edges (A → B = A is prerequisite of B)
CREATE TABLE kc_prerequisites (
    kc_id      UUID REFERENCES knowledge_components(id) ON DELETE CASCADE,
    prereq_id  UUID REFERENCES knowledge_components(id) ON DELETE CASCADE,
    PRIMARY KEY (kc_id, prereq_id),
    CHECK (kc_id != prereq_id)                 -- no self-loops
);

-- 3. Items / Questions
--    IMMUTABLE after student responses exist.
--    If wrong: is_active=false (Soft Delete) + create new version.
CREATE TABLE items (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    kc_id       UUID NOT NULL REFERENCES knowledge_components(id),
    version     INT NOT NULL DEFAULT 1,
    parent_id   UUID REFERENCES items(id),     -- previous version (Soft Delete chain)

    -- Content (JSONB for flexibility: MCQ, fill-in, free-text)
    content     JSONB NOT NULL,                 -- {type, stem, options, answer, explanation}

    -- IRT Parameters (3PL)
    -- Cold-start defaults — recalibrated after 50+ responses (Layer 3)
    irt_a       FLOAT NOT NULL DEFAULT 1.0,    -- discrimination
    irt_b       FLOAT NOT NULL DEFAULT 0.0,    -- difficulty (b=0 = medium, ω=0)
    irt_c       FLOAT NOT NULL DEFAULT 0.25,   -- guessing (MCQ 4-opt = 0.25)

    -- Academic input (Mapping Layer — Auto-translated to IRT params)
    difficulty_label  VARCHAR(16),             -- "easy" | "medium" | "hard"
    format_type       VARCHAR(16),             -- "mcq4" | "fillin" | "freetext"

    -- BKT content P(T) — for learning content attached to this KC
    -- Set on content_assets, not here. Items are practice questions.

    is_active   BOOLEAN NOT NULL DEFAULT TRUE,
    created_by  UUID,                          -- cms_users.id
    created_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_items_kc_id ON items(kc_id) WHERE is_active = TRUE;
CREATE INDEX idx_items_difficulty ON items(kc_id, irt_b) WHERE is_active = TRUE;

-- 4. Student IRT Profile (ability θ)
CREATE TABLE student_irt (
    student_id  UUID PRIMARY KEY,
    theta       FLOAT NOT NULL DEFAULT 0.0,   -- ability estimate (ω=0 for new)
    theta_se    FLOAT NOT NULL DEFAULT 1.0,   -- standard error (high = uncertain)
    updated_at  TIMESTAMPTZ DEFAULT NOW()
);

-- 5. Student Knowledge State per KC (BKT state — Layer 2 adds full params)
CREATE TABLE student_kc (
    student_id    UUID NOT NULL,
    kc_id         UUID NOT NULL REFERENCES knowledge_components(id),

    -- BKT mastery state (4 params — defaults used, Layer 1+ calibrate)
    p_mastery     FLOAT NOT NULL DEFAULT 0.10,  -- P(L_n) — updates after each response
    p_know0       FLOAT NOT NULL DEFAULT 0.10,  -- P(L_0) — initial knowledge
    p_transit     FLOAT NOT NULL DEFAULT 0.30,  -- P(T) — learning rate
    p_guess       FLOAT NOT NULL DEFAULT 0.25,  -- P(G) — guessing probability
    p_slip        FLOAT NOT NULL DEFAULT 0.10,  -- P(S) — slip/careless probability

    is_mastered   BOOLEAN NOT NULL DEFAULT FALSE,

    -- Forgetting Curve (Layer 3)
    stability     FLOAT NOT NULL DEFAULT 1.0,   -- memory stability score
    p_at_mastery  FLOAT,                         -- P(L) at time of mastery (for FC)
    last_practiced TIMESTAMPTZ,
    review_due_at  TIMESTAMPTZ,

    PRIMARY KEY (student_id, kc_id),
    updated_at    TIMESTAMPTZ DEFAULT NOW()
);

-- 6. Response History (IMMUTABLE — never update or delete)
CREATE TABLE responses (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    student_id  UUID NOT NULL,
    item_id     UUID NOT NULL REFERENCES items(id),
    kc_id       UUID NOT NULL REFERENCES knowledge_components(id),
    correct     BOOLEAN NOT NULL,
    context     VARCHAR(20) NOT NULL,           -- 'assessment' | 'practice' | 'review'
    time_spent_ms INT,                          -- milliseconds to answer
    created_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_responses_student ON responses(student_id, created_at DESC);
CREATE INDEX idx_responses_item ON responses(item_id);
CREATE INDEX idx_responses_kc ON responses(student_id, kc_id);

-- ============================================================
-- OPERATION SYSTEM TABLES (4 — Layer 0)
-- ============================================================

-- 7. CMS Users (role-based access for Operation System)
CREATE TABLE cms_users (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email       VARCHAR(255) UNIQUE NOT NULL,
    name        TEXT NOT NULL,
    role        VARCHAR(20) NOT NULL DEFAULT 'academic',  -- 'admin' | 'academic' | 'viewer'
    is_active   BOOLEAN NOT NULL DEFAULT TRUE,
    created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- 8. Content Assets (videos, worked examples, text — linked to KCs)
CREATE TABLE content_assets (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    kc_id           UUID NOT NULL REFERENCES knowledge_components(id),
    asset_type      VARCHAR(20) NOT NULL,       -- 'video' | 'worked_example' | 'text_summary' | 'simulation'
    title           TEXT NOT NULL,
    content_url     TEXT,                        -- external URL or internal path
    content_body    TEXT,                        -- for text-based content
    bkt_p_transit   FLOAT NOT NULL DEFAULT 0.70, -- P(T) for this content type
    -- Academic input → auto-mapped to bkt_p_transit:
    --   video_detailed → 0.80, worked_example → 0.65, text_summary → 0.40
    content_tag     VARCHAR(30),                 -- 'video_detailed' | 'worked_example' | 'text_summary'
    is_active       BOOLEAN NOT NULL DEFAULT TRUE,
    created_by      UUID REFERENCES cms_users(id),
    created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- 9. Graph Edit History (changelog — allows rollback)
CREATE TABLE graph_edit_history (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    action      VARCHAR(20) NOT NULL,           -- 'add_kc' | 'remove_kc' | 'add_edge' | 'remove_edge'
    entity_id   UUID,                            -- kc_id or edge (kc_id, prereq_id)
    entity_type VARCHAR(20),                     -- 'kc' | 'edge'
    payload     JSONB NOT NULL,                  -- full state before change
    performed_by UUID REFERENCES cms_users(id),
    created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- 10. Item Versions (tracks Soft Delete chain for audit)
CREATE TABLE item_versions (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    item_id     UUID NOT NULL REFERENCES items(id),
    version     INT NOT NULL,
    change_reason TEXT,                          -- why was old version deactivated?
    deactivated_by UUID REFERENCES cms_users(id),
    deactivated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- VIEWS (convenience)
-- ============================================================

-- Active items per KC with difficulty distribution
CREATE VIEW kc_item_health AS
SELECT
    kc.id,
    kc.code,
    kc.name,
    kc.grade,
    COUNT(i.id) FILTER (WHERE i.irt_b < -0.5)  AS easy_count,
    COUNT(i.id) FILTER (WHERE i.irt_b BETWEEN -0.5 AND 0.5) AS medium_count,
    COUNT(i.id) FILTER (WHERE i.irt_b > 0.5)   AS hard_count,
    COUNT(i.id)                                   AS total_count,
    COUNT(ca.id)                                  AS content_asset_count
FROM knowledge_components kc
LEFT JOIN items i ON i.kc_id = kc.id AND i.is_active = TRUE
LEFT JOIN content_assets ca ON ca.kc_id = kc.id AND ca.is_active = TRUE
GROUP BY kc.id, kc.code, kc.name, kc.grade;

-- ============================================================
-- FUNCTIONS
-- ============================================================

-- Auto-update updated_at on knowledge_components
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_kc_updated_at
BEFORE UPDATE ON knowledge_components
FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER trg_student_kc_updated_at
BEFORE UPDATE ON student_kc
FOR EACH ROW EXECUTE FUNCTION update_updated_at();
