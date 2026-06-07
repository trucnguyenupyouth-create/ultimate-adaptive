"""
KnowledgeGraph Service — DB ↔ Engine bridge (Layer 0)

Handles:
  - Loading the KG from PostgreSQL into the in-memory NetworkX graph
  - CRUD operations for KCs and prerequisites with guardrails
  - Serving graph data to the API layer
"""

from __future__ import annotations

import uuid
from datetime import datetime, timezone

from sqlalchemy import select, delete
from sqlalchemy.ext.asyncio import AsyncSession

from app.engines.knowledge_graph import KnowledgeGraph, KCNode
from app.models.models import KnowledgeComponent, KCPrerequisite, GraphEditHistory


# Module-level singleton graph — loaded once on startup, invalidated on writes
_graph_cache: KnowledgeGraph | None = None


async def get_graph(db: AsyncSession) -> KnowledgeGraph:
    """Return cached KG or rebuild from DB."""
    global _graph_cache
    if _graph_cache is None:
        _graph_cache = await _build_graph(db)
    return _graph_cache


def invalidate_graph_cache() -> None:
    """Call after any KC or prerequisite mutation."""
    global _graph_cache
    _graph_cache = None


async def _build_graph(db: AsyncSession) -> KnowledgeGraph:
    kcs_result = await db.execute(select(KnowledgeComponent))
    kcs = kcs_result.scalars().all()

    edges_result = await db.execute(select(KCPrerequisite))
    edges = edges_result.scalars().all()

    kg = KnowledgeGraph()
    kg.load_from_dicts(
        kcs=[{
            "id": str(kc.id),
            "code": kc.code,
            "name": kc.name,
            "grade": kc.grade,
            "subject": kc.subject,
        } for kc in kcs],
        prerequisites=[{
            "kc_id": str(e.kc_id),
            "prereq_id": str(e.prereq_id),
        } for e in edges],
    )
    return kg


# ── KC CRUD ────────────────────────────────────────────────────────────────────

async def create_kc(
    db: AsyncSession,
    code: str,
    name: str,
    grade: int,
    subject: str = "math",
    description: str | None = None,
    performed_by: str | None = None,
) -> KnowledgeComponent:
    kc = KnowledgeComponent(
        code=code,
        name=name,
        grade=grade,
        subject=subject,
        description=description,
    )
    db.add(kc)
    await db.flush()  # get kc.id before logging

    # Log to graph edit history
    db.add(GraphEditHistory(
        action="add_kc",
        entity_id=kc.id,
        entity_type="kc",
        payload={"code": code, "name": name, "grade": grade},
        performed_by=uuid.UUID(performed_by) if performed_by else None,
    ))

    await db.commit()
    await db.refresh(kc)
    invalidate_graph_cache()
    return kc


async def add_prerequisite(
    db: AsyncSession,
    kc_id: str,
    prereq_id: str,
    performed_by: str | None = None,
) -> dict:
    """
    Add a prerequisite edge with DAG validation.
    Returns {"ok": True} or {"ok": False, "error": "..."}
    """
    # Load current graph and test cycle safety
    kg = await get_graph(db)
    try:
        # Validate on in-memory graph (cheap, no DB write yet)
        kg.add_prerequisite(kc_id=kc_id, prereq_id=prereq_id)
    except ValueError as e:
        return {"ok": False, "error": str(e)}

    # Persist
    edge = KCPrerequisite(
        kc_id=uuid.UUID(kc_id),
        prereq_id=uuid.UUID(prereq_id),
    )
    db.add(edge)

    db.add(GraphEditHistory(
        action="add_edge",
        entity_type="edge",
        payload={"kc_id": kc_id, "prereq_id": prereq_id},
        performed_by=uuid.UUID(performed_by) if performed_by else None,
    ))

    await db.commit()
    # Note: do NOT invalidate cache — we already mutated the in-memory graph
    return {"ok": True}


async def remove_prerequisite(
    db: AsyncSession,
    kc_id: str,
    prereq_id: str,
    performed_by: str | None = None,
) -> None:
    await db.execute(
        delete(KCPrerequisite).where(
            KCPrerequisite.kc_id == uuid.UUID(kc_id),
            KCPrerequisite.prereq_id == uuid.UUID(prereq_id),
        )
    )
    db.add(GraphEditHistory(
        action="remove_edge",
        entity_type="edge",
        payload={"kc_id": kc_id, "prereq_id": prereq_id},
        performed_by=uuid.UUID(performed_by) if performed_by else None,
    ))
    await db.commit()
    invalidate_graph_cache()


async def get_graph_json(db: AsyncSession) -> dict:
    """Serialised graph for React Flow frontend."""
    kg = await get_graph(db)
    return kg.to_dict()


async def get_graph_health(db: AsyncSession) -> dict:
    """Health stats for the CMS dashboard."""
    from sqlalchemy import text
    kg = await get_graph(db)
    health = kg.health_check()

    # Enrich with item counts from DB
    result = await db.execute(text("""
        SELECT kc_id::text, COUNT(*) as total,
               COUNT(*) FILTER (WHERE irt_b < -0.5) as easy,
               COUNT(*) FILTER (WHERE irt_b BETWEEN -0.5 AND 0.5) as medium,
               COUNT(*) FILTER (WHERE irt_b > 0.5) as hard
        FROM items WHERE is_active = TRUE
        GROUP BY kc_id
    """))
    item_counts = {row.kc_id: dict(row._mapping) for row in result}

    health["item_counts"] = item_counts
    health["low_item_kcs"] = [
        kc_id for kc_id in kg._G.nodes()
        if item_counts.get(kc_id, {}).get("total", 0) < 10
    ]
    return health
