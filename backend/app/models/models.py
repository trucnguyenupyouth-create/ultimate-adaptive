"""
SQLAlchemy ORM models mirroring 001_initial_schema.sql

Layer 0: All 10 tables defined here.
Engines (IRT, BKT, KST) operate on plain dicts/dataclasses —
ORM models are only for DB persistence.
"""

import uuid
from datetime import datetime
from typing import Optional

from sqlalchemy import (
    Boolean, Float, ForeignKey, Index, Integer, String, Text,
    UniqueConstraint, CheckConstraint, TIMESTAMP
)
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.sql import func

from app.core.database import Base

TIMESTAMPTZ = TIMESTAMP(timezone=True)



# ── helpers ───────────────────────────────────────────────────────────────────
def uuid_pk() -> Mapped[uuid.UUID]:
    return mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)


def now_col() -> Mapped[datetime]:
    return mapped_column(TIMESTAMPTZ, server_default=func.now())


# ─────────────────────────────────────────────────────────────────────────────
# CORE TABLES
# ─────────────────────────────────────────────────────────────────────────────

class GraphBlock(Base):
    __tablename__ = "graph_blocks"

    id: Mapped[uuid.UUID] = uuid_pk()
    name: Mapped[str] = mapped_column(Text, nullable=False)
    x: Mapped[float] = mapped_column(Float, nullable=False, default=0.0)
    y: Mapped[float] = mapped_column(Float, nullable=False, default=0.0)
    width: Mapped[float] = mapped_column(Float, nullable=False, default=400.0)
    height: Mapped[float] = mapped_column(Float, nullable=False, default=300.0)
    created_at: Mapped[datetime] = now_col()
    updated_at: Mapped[datetime] = now_col()

    # relationships
    kcs: Mapped[list["KnowledgeComponent"]] = relationship("KnowledgeComponent", back_populates="block")


class KnowledgeComponent(Base):
    __tablename__ = "knowledge_components"

    id: Mapped[uuid.UUID] = uuid_pk()
    code: Mapped[str] = mapped_column(String(64), unique=True, nullable=False)
    name: Mapped[str] = mapped_column(Text, nullable=False)
    grade: Mapped[int] = mapped_column(Integer, nullable=False)
    subject: Mapped[str] = mapped_column(String(32), nullable=False, default="math")
    description: Mapped[Optional[str]] = mapped_column(Text)
    chapter_info: Mapped[Optional[str]] = mapped_column(Text)
    notes: Mapped[Optional[str]] = mapped_column(Text)  # pedagogical notes (Tab "Ghi chú")
    metadata_: Mapped[dict] = mapped_column("metadata", JSONB, default=dict)
    block_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True), ForeignKey("graph_blocks.id", ondelete="SET NULL"), nullable=True
    )
    created_at: Mapped[datetime] = now_col()
    updated_at: Mapped[datetime] = now_col()

    # relationships
    block: Mapped[Optional["GraphBlock"]] = relationship("GraphBlock", back_populates="kcs")
    prerequisites: Mapped[list["KCPrerequisite"]] = relationship(
        "KCPrerequisite", foreign_keys="KCPrerequisite.kc_id", back_populates="kc"
    )
    required_by: Mapped[list["KCPrerequisite"]] = relationship(
        "KCPrerequisite", foreign_keys="KCPrerequisite.prereq_id", back_populates="prereq"
    )
    items: Mapped[list["Item"]] = relationship("Item", back_populates="kc")
    content_assets: Mapped[list["ContentAsset"]] = relationship("ContentAsset", back_populates="kc")


class KCPrerequisite(Base):
    __tablename__ = "kc_prerequisites"
    __table_args__ = (
        CheckConstraint("kc_id != prereq_id", name="no_self_loop"),
    )

    kc_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("knowledge_components.id", ondelete="CASCADE"),
        primary_key=True
    )
    prereq_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("knowledge_components.id", ondelete="CASCADE"),
        primary_key=True
    )

    label: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    weight: Mapped[float] = mapped_column(Float, nullable=False, default=1.0)
    edge_type: Mapped[str] = mapped_column(String(20), nullable=False, default="prerequisite")
    created_at: Mapped[datetime] = now_col()
    created_by: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True), ForeignKey("cms_users.id"), nullable=True
    )

    kc: Mapped["KnowledgeComponent"] = relationship(
        "KnowledgeComponent", foreign_keys=[kc_id], back_populates="prerequisites"
    )
    prereq: Mapped["KnowledgeComponent"] = relationship(
        "KnowledgeComponent", foreign_keys=[prereq_id], back_populates="required_by"
    )


class Item(Base):
    __tablename__ = "items"

    id: Mapped[uuid.UUID] = uuid_pk()
    kc_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("knowledge_components.id"), nullable=False
    )
    version: Mapped[int] = mapped_column(Integer, nullable=False, default=1)
    parent_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True), ForeignKey("items.id"), nullable=True
    )

    content: Mapped[dict] = mapped_column(JSONB, nullable=False)

    # IRT params — cold start defaults, calibrated in Layer 3
    irt_a: Mapped[float] = mapped_column(Float, nullable=False, default=1.0)
    irt_b: Mapped[float] = mapped_column(Float, nullable=False, default=0.0)
    irt_c: Mapped[float] = mapped_column(Float, nullable=False, default=0.25)

    # Academic-facing labels (Mapping Layer)
    difficulty_label: Mapped[Optional[str]] = mapped_column(String(16))  # easy|medium|hard
    format_type: Mapped[Optional[str]] = mapped_column(String(16))       # mcq4|fillin|freetext

    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    # Pedagogical tag: TRUE = pure definitional, single-step, Entry Point for Cold Start CAT
    is_diagnostic_anchor: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    created_by: Mapped[Optional[uuid.UUID]] = mapped_column(UUID(as_uuid=True))
    created_at: Mapped[datetime] = now_col()

    kc: Mapped["KnowledgeComponent"] = relationship("KnowledgeComponent", back_populates="items")
    images: Mapped[list["ItemImage"]] = relationship(
        "ItemImage", primaryjoin="Item.id == foreign(ItemImage.item_id)",
        cascade="all, delete-orphan", lazy="select"
    )

    __table_args__ = (
        Index("idx_items_kc_active", "kc_id", postgresql_where="is_active = TRUE"),
        Index("idx_items_anchor", "kc_id", "irt_a",
              postgresql_where="is_active = TRUE AND is_diagnostic_anchor = TRUE"),
    )


class StudentIRT(Base):
    __tablename__ = "student_irt"

    student_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True)
    theta: Mapped[float] = mapped_column(Float, nullable=False, default=0.0)
    theta_se: Mapped[float] = mapped_column(Float, nullable=False, default=1.0)
    updated_at: Mapped[datetime] = now_col()


class StudentKC(Base):
    __tablename__ = "student_kc"

    student_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True)
    kc_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("knowledge_components.id"), primary_key=True
    )

    p_mastery: Mapped[float] = mapped_column(Float, nullable=False, default=0.10)
    p_know0: Mapped[float] = mapped_column(Float, nullable=False, default=0.10)
    p_transit: Mapped[float] = mapped_column(Float, nullable=False, default=0.30)
    p_guess: Mapped[float] = mapped_column(Float, nullable=False, default=0.25)
    p_slip: Mapped[float] = mapped_column(Float, nullable=False, default=0.10)

    is_mastered: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)

    # Forgetting curve (Layer 3 populates these)
    stability: Mapped[float] = mapped_column(Float, nullable=False, default=1.0)
    p_at_mastery: Mapped[Optional[float]] = mapped_column(Float)
    last_practiced: Mapped[Optional[datetime]] = mapped_column(TIMESTAMPTZ)
    review_due_at: Mapped[Optional[datetime]] = mapped_column(TIMESTAMPTZ)

    updated_at: Mapped[datetime] = now_col()


class Response(Base):
    __tablename__ = "responses"

    id: Mapped[uuid.UUID] = uuid_pk()
    student_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), nullable=False)
    item_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("items.id"), nullable=False
    )
    kc_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("knowledge_components.id"), nullable=False
    )
    correct: Mapped[bool] = mapped_column(Boolean, nullable=False)
    context: Mapped[str] = mapped_column(String(20), nullable=False)  # assessment|practice|review
    time_spent_ms: Mapped[Optional[int]] = mapped_column(Integer)
    created_at: Mapped[datetime] = now_col()

    __table_args__ = (
        Index("idx_responses_student", "student_id", "created_at"),
        Index("idx_responses_kc", "student_id", "kc_id"),
    )


# ─────────────────────────────────────────────────────────────────────────────
# OPERATION SYSTEM TABLES
# ─────────────────────────────────────────────────────────────────────────────

class CMSUser(Base):
    __tablename__ = "cms_users"

    id: Mapped[uuid.UUID] = uuid_pk()
    email: Mapped[str] = mapped_column(String(255), unique=True, nullable=False)
    name: Mapped[str] = mapped_column(Text, nullable=False)
    role: Mapped[str] = mapped_column(String(20), nullable=False, default="academic")
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    created_at: Mapped[datetime] = now_col()


class ContentAsset(Base):
    __tablename__ = "content_assets"

    id: Mapped[uuid.UUID] = uuid_pk()
    kc_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("knowledge_components.id"), nullable=False
    )
    asset_type: Mapped[str] = mapped_column(String(20), nullable=False)
    title: Mapped[str] = mapped_column(Text, nullable=False)
    content_url: Mapped[Optional[str]] = mapped_column(Text)
    content_body: Mapped[Optional[str]] = mapped_column(Text)
    bkt_p_transit: Mapped[float] = mapped_column(Float, nullable=False, default=0.70)
    content_tag: Mapped[Optional[str]] = mapped_column(String(30))
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    created_by: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True), ForeignKey("cms_users.id")
    )
    created_at: Mapped[datetime] = now_col()

    kc: Mapped["KnowledgeComponent"] = relationship("KnowledgeComponent", back_populates="content_assets")


class GraphEditHistory(Base):
    __tablename__ = "graph_edit_history"

    id: Mapped[uuid.UUID] = uuid_pk()
    action: Mapped[str] = mapped_column(String(20), nullable=False)
    entity_id: Mapped[Optional[uuid.UUID]] = mapped_column(UUID(as_uuid=True))
    entity_type: Mapped[Optional[str]] = mapped_column(String(20))
    payload: Mapped[dict] = mapped_column(JSONB, nullable=False)
    performed_by: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True), ForeignKey("cms_users.id")
    )
    created_at: Mapped[datetime] = now_col()


class ItemVersion(Base):
    __tablename__ = "item_versions"

    id: Mapped[uuid.UUID] = uuid_pk()
    item_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("items.id"), nullable=False
    )
    version: Mapped[int] = mapped_column(Integer, nullable=False)
    change_reason: Mapped[Optional[str]] = mapped_column(Text)
    deactivated_by: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True), ForeignKey("cms_users.id")
    )
    deactivated_at: Mapped[datetime] = now_col()


class ItemEditLog(Base):
    """Audit log for every item create/deactivate/replace action."""
    __tablename__ = "item_edit_log"

    id: Mapped[uuid.UUID] = uuid_pk()
    item_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("items.id"), nullable=False
    )
    action: Mapped[str] = mapped_column(String(20), nullable=False)  # created | deactivated | replaced
    old_item_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True), ForeignKey("items.id"), nullable=True
    )
    reason: Mapped[Optional[str]] = mapped_column(Text)
    performed_by: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True), ForeignKey("cms_users.id")
    )
    created_at: Mapped[datetime] = now_col()


class KCNotes(Base):
    """Pedagogical notes for a KC — one row per KC, upserted on save."""
    __tablename__ = "kc_notes"

    kc_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("knowledge_components.id", ondelete="CASCADE"),
        primary_key=True
    )
    notes: Mapped[str] = mapped_column(Text, nullable=False, default="")
    updated_by: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True), ForeignKey("cms_users.id")
    )
    updated_at: Mapped[datetime] = now_col()


class GraphNote(Base):
    """Sticky note pinned to the graph canvas."""
    __tablename__ = "graph_notes"

    id: Mapped[uuid.UUID] = uuid_pk()
    content: Mapped[str] = mapped_column(Text, nullable=False, default="")
    x: Mapped[float] = mapped_column(Float, nullable=False, default=0.0)
    y: Mapped[float] = mapped_column(Float, nullable=False, default=0.0)
    width: Mapped[float] = mapped_column(Float, nullable=False, default=200.0)
    height: Mapped[float] = mapped_column(Float, nullable=False, default=150.0)
    color: Mapped[str] = mapped_column(String(20), nullable=False, default="yellow")
    created_at: Mapped[datetime] = now_col()
    updated_at: Mapped[datetime] = now_col()


class ItemDraft(Base):
    """AI-generated MCQ draft — awaiting human review before import to items table."""
    __tablename__ = "item_drafts"

    id: Mapped[uuid.UUID] = uuid_pk()

    # KC reference (denormalized for display without join)
    kc_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("knowledge_components.id", ondelete="CASCADE"), nullable=False
    )
    kc_name: Mapped[str] = mapped_column(Text, nullable=False)
    kc_code: Mapped[str] = mapped_column(Text, nullable=False)

    # Question content (same shape as items.content)
    content: Mapped[dict] = mapped_column(JSONB, nullable=False)

    # IRT/KST metadata from AI generation
    difficulty_label: Mapped[str] = mapped_column(String(16), nullable=False)  # easy|medium|hard
    is_diagnostic_anchor: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    kst_irt_tag: Mapped[Optional[str]] = mapped_column(Text, nullable=True)  # AI pedagogical analysis

    # Generation job tracking
    generation_job_id: Mapped[Optional[uuid.UUID]] = mapped_column(UUID(as_uuid=True), nullable=True)
    sgk_section: Mapped[Optional[str]] = mapped_column(Text, nullable=True)  # e.g. "B1K1"
    raw_ai_output: Mapped[Optional[str]] = mapped_column(Text, nullable=True)  # raw Gemini output

    # Review workflow
    status: Mapped[str] = mapped_column(String(20), nullable=False, default="pending")
    # pending | approved | rejected | edited_approved
    imported_item_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True), ForeignKey("items.id", ondelete="SET NULL"), nullable=True
    )
    reviewed_at: Mapped[Optional[datetime]] = mapped_column(TIMESTAMPTZ, nullable=True)

    # Flag / note — reviewer marks as "considering" with optional note
    flagged: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    flag_note: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    created_at: Mapped[datetime] = now_col()

    images: Mapped[list["ItemImage"]] = relationship(
        "ItemImage", primaryjoin="ItemDraft.id == foreign(ItemImage.draft_id)",
        cascade="all, delete-orphan", lazy="select"
    )

    __table_args__ = (
        CheckConstraint(
            "status IN ('pending', 'approved', 'rejected', 'edited_approved')",
            name="item_drafts_status_check"
        ),
        Index("idx_item_drafts_kc", "kc_id"),
        Index("idx_item_drafts_status", "status"),
        Index("idx_item_drafts_job", "generation_job_id"),
    )


class AssessmentV2ItemReview(Base):
    """Persistent academic review state for Assessment V2 open diagnostic items."""
    __tablename__ = "assessment_v2_item_reviews"

    id: Mapped[uuid.UUID] = uuid_pk()
    review_id: Mapped[str] = mapped_column(String(64), unique=True, nullable=False)
    item_payload: Mapped[dict] = mapped_column(JSONB, nullable=False, default=dict)

    review_decision: Mapped[str] = mapped_column(String(20), nullable=False, default="needs_review")
    flagged_for_review: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    review_comment: Mapped[str] = mapped_column(Text, nullable=False, default="")
    review_history: Mapped[list] = mapped_column(JSONB, nullable=False, default=list)

    reviewed_at: Mapped[Optional[datetime]] = mapped_column(TIMESTAMPTZ, nullable=True)
    created_at: Mapped[datetime] = now_col()
    updated_at: Mapped[datetime] = now_col()

    __table_args__ = (
        CheckConstraint(
            "review_decision IN ('needs_review', 'accepted', 'rejected', 'revise')",
            name="assessment_v2_item_reviews_decision_check",
        ),
        Index("idx_assessment_v2_item_reviews_decision", "review_decision"),
        Index("idx_assessment_v2_item_reviews_flagged", "flagged_for_review"),
    )


class AssessmentV2Session(Base):
    """DB-backed student pilot session for Assessment V2."""
    __tablename__ = "assessment_v2_sessions"

    id: Mapped[uuid.UUID] = uuid_pk()
    session_code: Mapped[str] = mapped_column(String(64), unique=True, nullable=False)
    status: Mapped[str] = mapped_column(String(20), nullable=False, default="in_progress")
    max_questions: Mapped[int] = mapped_column(Integer, nullable=False, default=35)
    student_label: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    payload: Mapped[dict] = mapped_column(JSONB, nullable=False, default=dict)
    created_at: Mapped[datetime] = now_col()
    updated_at: Mapped[datetime] = now_col()
    completed_at: Mapped[Optional[datetime]] = mapped_column(TIMESTAMPTZ, nullable=True)

    __table_args__ = (
        CheckConstraint(
            "status IN ('in_progress', 'completed')",
            name="assessment_v2_sessions_status_check",
        ),
        Index("idx_assessment_v2_sessions_status", "status"),
        Index("idx_assessment_v2_sessions_code", "session_code"),
    )


class ItemImage(Base):
    """Image attachment for a question — belongs to either an Item or an ItemDraft."""
    __tablename__ = "item_images"

    id: Mapped[uuid.UUID] = uuid_pk()
    item_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True), ForeignKey("items.id", ondelete="CASCADE"), nullable=True
    )
    draft_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True), ForeignKey("item_drafts.id", ondelete="CASCADE"), nullable=True
    )
    storage_path: Mapped[str] = mapped_column(Text, nullable=False)
    public_url: Mapped[str] = mapped_column(Text, nullable=False)
    filename: Mapped[str] = mapped_column(Text, nullable=False)
    mime_type: Mapped[str] = mapped_column(String(30), nullable=False)
    size_bytes: Mapped[int] = mapped_column(Integer, nullable=False)
    display_order: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    caption: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = now_col()

    __table_args__ = (
        Index("idx_item_images_item",  "item_id",  postgresql_where="item_id  IS NOT NULL"),
        Index("idx_item_images_draft", "draft_id", postgresql_where="draft_id IS NOT NULL"),
    )
