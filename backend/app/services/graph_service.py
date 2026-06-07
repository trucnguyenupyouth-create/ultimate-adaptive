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
from app.models.models import KnowledgeComponent, KCPrerequisite, GraphEditHistory, CMSUser


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
            "label": e.label,
            "weight": e.weight,
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
    label: str | None = None,
    weight: float = 1.0,
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
        kg.add_prerequisite(kc_id=kc_id, prereq_id=prereq_id, label=label, weight=weight)
    except ValueError as e:
        return {"ok": False, "error": str(e)}

    # Persist
    edge = KCPrerequisite(
        kc_id=uuid.UUID(kc_id),
        prereq_id=uuid.UUID(prereq_id),
        label=label,
        weight=weight,
        created_by=uuid.UUID(performed_by) if performed_by else None,
    )
    db.add(edge)

    db.add(GraphEditHistory(
        action="add_edge",
        entity_type="edge",
        payload={"kc_id": kc_id, "prereq_id": prereq_id, "label": label, "weight": weight},
        performed_by=uuid.UUID(performed_by) if performed_by else None,
    ))

    await db.commit()
    # Note: do NOT invalidate cache — we already mutated the in-memory graph
    return {"ok": True}


async def get_edge_detail(db: AsyncSession, kc_id: str, prereq_id: str) -> dict | None:
    # 1. Fetch the edge
    kc_uuid = uuid.UUID(kc_id)
    prereq_uuid = uuid.UUID(prereq_id)

    edge_stmt = select(KCPrerequisite).where(
        KCPrerequisite.kc_id == kc_uuid,
        KCPrerequisite.prereq_id == prereq_uuid
    )
    edge_res = await db.execute(edge_stmt)
    edge = edge_res.scalar_one_or_none()
    if not edge:
        return None

    # Fetch source & target KCs details
    source_kc = await db.get(KnowledgeComponent, prereq_uuid)
    target_kc = await db.get(KnowledgeComponent, kc_uuid)

    if not source_kc or not target_kc:
        return None

    # Fetch creator name if created_by is set
    creator_name = None
    if edge.created_by:
        creator = await db.get(CMSUser, edge.created_by)
        if creator:
            creator_name = creator.name

    # 2. Fetch last 5 history logs
    hist_stmt = (
        select(GraphEditHistory, CMSUser.name)
        .outerjoin(CMSUser, GraphEditHistory.performed_by == CMSUser.id)
        .where(
            GraphEditHistory.entity_type == "edge",
            (
                (GraphEditHistory.payload["kc_id"].astext == kc_id) & (GraphEditHistory.payload["prereq_id"].astext == prereq_id)
            ) | (
                (GraphEditHistory.payload["kc_id"].astext == prereq_id) & (GraphEditHistory.payload["prereq_id"].astext == kc_id)
            )
        )
        .order_by(GraphEditHistory.created_at.desc())
        .limit(5)
    )
    hist_res = await db.execute(hist_stmt)
    history = []
    for row in hist_res.all():
        h = row[0]
        perf_name = row[1]
        history.append({
            "id": str(h.id),
            "action": h.action,
            "payload": h.payload,
            "created_at": h.created_at.isoformat(),
            "performed_by_name": perf_name or "System",
        })

    return {
        "kc_id": kc_id,
        "prereq_id": prereq_id,
        "label": edge.label,
        "weight": edge.weight,
        "created_at": edge.created_at.isoformat() if edge.created_at else None,
        "created_by": str(edge.created_by) if edge.created_by else None,
        "created_by_name": creator_name,
        "source_code": source_kc.code,
        "source_name": source_kc.name,
        "target_code": target_kc.code,
        "target_name": target_kc.name,
        "history": history
    }


async def update_edge(
    db: AsyncSession,
    kc_id: str,
    prereq_id: str,
    label: str | None = None,
    weight: float = 1.0,
    performed_by: str | None = None,
) -> dict:
    kc_uuid = uuid.UUID(kc_id)
    prereq_uuid = uuid.UUID(prereq_id)
    stmt = select(KCPrerequisite).where(
        KCPrerequisite.kc_id == kc_uuid,
        KCPrerequisite.prereq_id == prereq_uuid
    )
    res = await db.execute(stmt)
    edge = res.scalar_one_or_none()
    if not edge:
        raise ValueError("Edge not found")

    edge.label = label
    edge.weight = weight

    db.add(GraphEditHistory(
        action="update_edge",
        entity_type="edge",
        payload={"kc_id": kc_id, "prereq_id": prereq_id, "label": label, "weight": weight},
        performed_by=uuid.UUID(performed_by) if performed_by else None,
    ))
    await db.commit()
    invalidate_graph_cache()
    return {"ok": True}


async def reverse_edge(
    db: AsyncSession,
    kc_id: str,
    prereq_id: str,
    performed_by: str | None = None,
) -> dict:
    """
    Reverse the edge from prereq_id → kc_id (old_prereq → old_kc)
    to kc_id → prereq_id (new_prereq → new_kc).
    Validates DAG cycle safety before committing.
    """
    # Load current graph and test cycle safety
    kg = await get_graph(db)

    # In NetworkX graph representation, B is prereq_id, A is kc_id. Edge is B -> A.
    # We want to remove B -> A and add A -> B.
    # Test on a copy
    test_G = kg._G.copy()
    if test_G.has_edge(prereq_id, kc_id):
        test_G.remove_edge(prereq_id, kc_id)
    
    test_G.add_edge(kc_id, prereq_id)  # new direction: old target (kc_id) -> old source (prereq_id)
    
    import networkx as nx
    if not nx.is_directed_acyclic_graph(test_G):
        return {
            "ok": False,
            "error": "Reversing prerequisite direction would create a cycle."
        }

    # If it is a DAG, we can proceed with DB updates
    kc_uuid = uuid.UUID(kc_id)
    prereq_uuid = uuid.UUID(prereq_id)

    # 1. Fetch old edge metadata to preserve it (label, weight)
    stmt = select(KCPrerequisite).where(
        KCPrerequisite.kc_id == kc_uuid,
        KCPrerequisite.prereq_id == prereq_uuid
    )
    res = await db.execute(stmt)
    old_edge = res.scalar_one_or_none()
    if not old_edge:
        return {"ok": False, "error": "Edge not found"}

    label = old_edge.label
    weight = old_edge.weight

    # 2. Delete old edge
    await db.delete(old_edge)

    # 3. Create new reversed edge
    new_edge = KCPrerequisite(
        kc_id=prereq_uuid,
        prereq_id=kc_uuid,
        label=label,
        weight=weight,
        created_by=uuid.UUID(performed_by) if performed_by else None,
    )
    db.add(new_edge)

    # 4. Log history
    db.add(GraphEditHistory(
        action="reverse_edge",
        entity_type="edge",
        payload={
            "old_kc_id": kc_id,
            "old_prereq_id": prereq_id,
            "new_kc_id": prereq_id,
            "new_prereq_id": kc_id,
        },
        performed_by=uuid.UUID(performed_by) if performed_by else None,
    ))

    await db.commit()
    invalidate_graph_cache()
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


# ── KC Detail / Update / Delete ───────────────────────────────────────────────

async def get_kc_detail(db: AsyncSession, kc_id: str) -> dict:
    """Return full KC detail including prerequisites and successors."""
    kc = await db.get(KnowledgeComponent, uuid.UUID(kc_id))
    if not kc:
        return None

    # Prerequisites: KCs that MUST be mastered before this KC
    prereq_result = await db.execute(
        select(KCPrerequisite).where(KCPrerequisite.kc_id == kc.id)
    )
    prereq_ids = [str(r.prereq_id) for r in prereq_result.scalars().all()]

    # Successors: KCs that REQUIRE this KC as a prerequisite
    successor_result = await db.execute(
        select(KCPrerequisite).where(KCPrerequisite.prereq_id == kc.id)
    )
    successor_ids = [str(r.kc_id) for r in successor_result.scalars().all()]

    # Fetch KC objects for display names
    prereq_kcs = []
    if prereq_ids:
        pq = await db.execute(
            select(KnowledgeComponent).where(
                KnowledgeComponent.id.in_([uuid.UUID(i) for i in prereq_ids])
            )
        )
        prereq_kcs = [
            {"id": str(k.id), "code": k.code, "name": k.name}
            for k in pq.scalars().all()
        ]

    successor_kcs = []
    if successor_ids:
        sq = await db.execute(
            select(KnowledgeComponent).where(
                KnowledgeComponent.id.in_([uuid.UUID(i) for i in successor_ids])
            )
        )
        successor_kcs = [
            {"id": str(k.id), "code": k.code, "name": k.name}
            for k in sq.scalars().all()
        ]

    return {
        "id": str(kc.id),
        "code": kc.code,
        "name": kc.name,
        "grade": kc.grade,
        "subject": kc.subject,
        "description": kc.description,
        "notes": kc.notes,
        "prerequisites": prereq_kcs,
        "successors": successor_kcs,
    }


async def update_kc(
    db: AsyncSession,
    kc_id: str,
    name: str | None = None,
    grade: int | None = None,
    subject: str | None = None,
    description: str | None = None,
    notes: str | None = None,
) -> KnowledgeComponent:
    """Partial update a KC. Only provided fields are updated."""
    kc = await db.get(KnowledgeComponent, uuid.UUID(kc_id))
    if not kc:
        raise ValueError(f"KC {kc_id} not found")

    if name is not None:
        kc.name = name
    if grade is not None:
        kc.grade = grade
    if subject is not None:
        kc.subject = subject
    if description is not None:
        kc.description = description
    if notes is not None:
        kc.notes = notes

    db.add(GraphEditHistory(
        action="update_kc",
        entity_id=kc.id,
        entity_type="kc",
        payload={"name": name, "grade": grade, "subject": subject},
    ))
    await db.commit()
    await db.refresh(kc)
    invalidate_graph_cache()
    return kc


async def delete_kc(db: AsyncSession, kc_id: str) -> dict:
    """
    Soft-delete a KC:
    - Deactivate all its items
    - Remove all prerequisite edges
    - Remove the KC from DB
    Returns counts of affected items and edges.
    """
    from app.models.models import Item
    kc_uuid = uuid.UUID(kc_id)

    # Count and deactivate items
    items_result = await db.execute(
        select(Item).where(Item.kc_id == kc_uuid, Item.is_active == True)
    )
    items = items_result.scalars().all()
    for item in items:
        item.is_active = False

    # Count edges being removed
    edges_result = await db.execute(
        select(KCPrerequisite).where(
            (KCPrerequisite.kc_id == kc_uuid) | (KCPrerequisite.prereq_id == kc_uuid)
        )
    )
    deleted_edges = len(edges_result.scalars().all())

    # Delete the KC (cascade will remove prerequisite edges)
    kc = await db.get(KnowledgeComponent, kc_uuid)
    if kc:
        await db.delete(kc)

    db.add(GraphEditHistory(
        action="delete_kc",
        entity_id=kc_uuid,
        entity_type="kc",
        payload={"kc_id": kc_id, "deleted_items": len(items), "deleted_edges": deleted_edges},
    ))
    await db.commit()
    invalidate_graph_cache()
    return {"ok": True, "deleted_items": len(items), "deleted_edges": deleted_edges}


# ── Item (Question) CRUD ──────────────────────────────────────────────────────

# IRT difficulty mapping
_DIFFICULTY_IRT: dict[str, tuple[float, float]] = {
    "easy":   (-1.0, 0.25),
    "medium": ( 0.0, 0.25),
    "hard":   ( 1.5, 0.10),  # harder items → lower guessing ceiling
}


def _validate_mcq_content(content: dict) -> None:
    """Raise ValueError if MCQ content is malformed."""
    if not content.get("question", "").strip():
        raise ValueError("Question text cannot be empty")
    answers = content.get("answers", [])
    if len(answers) < 2:
        raise ValueError("MCQ must have at least 2 answers")
    correct = [a for a in answers if a.get("is_correct")]
    if not correct:
        raise ValueError("At least one answer must be marked as correct")


async def get_items(db: AsyncSession, kc_id: str, active_only: bool = True) -> list:
    """Return all items for a KC, newest first."""
    from app.models.models import Item
    stmt = select(Item).where(Item.kc_id == uuid.UUID(kc_id))
    if active_only:
        stmt = stmt.where(Item.is_active == True)
    stmt = stmt.order_by(Item.created_at.desc())
    result = await db.execute(stmt)
    items = result.scalars().all()
    return [
        {
            "id": str(i.id),
            "kc_id": str(i.kc_id),
            "version": i.version,
            "content": i.content,
            "difficulty_label": i.difficulty_label,
            "format_type": i.format_type,
            "irt_b": i.irt_b,
            "irt_c": i.irt_c,
            "is_active": i.is_active,
            "created_at": i.created_at.isoformat(),
        }
        for i in items
    ]


async def create_item(
    db: AsyncSession,
    kc_id: str,
    difficulty_label: str,
    format_type: str,
    content: dict,
    performed_by: str | None = None,
) -> dict:
    """Create a new item (question) for a KC."""
    from app.models.models import Item, ItemEditLog

    # Validate
    if format_type == "mcq":
        _validate_mcq_content(content)

    irt_b, irt_c = _DIFFICULTY_IRT.get(difficulty_label, (0.0, 0.25))

    item = Item(
        kc_id=uuid.UUID(kc_id),
        version=1,
        content=content,
        difficulty_label=difficulty_label,
        format_type=format_type,
        irt_b=irt_b,
        irt_c=irt_c,
        is_active=True,
        created_by=uuid.UUID(performed_by) if performed_by else None,
    )
    db.add(item)
    await db.flush()

    db.add(ItemEditLog(
        item_id=item.id,
        action="created",
        performed_by=uuid.UUID(performed_by) if performed_by else None,
    ))

    await db.commit()
    await db.refresh(item)
    return {
        "id": str(item.id),
        "kc_id": str(item.kc_id),
        "version": item.version,
        "content": item.content,
        "difficulty_label": item.difficulty_label,
        "format_type": item.format_type,
        "irt_b": item.irt_b,
        "is_active": item.is_active,
        "created_at": item.created_at.isoformat(),
    }


async def edit_item(
    db: AsyncSession,
    item_id: str,
    difficulty_label: str,
    format_type: str,
    content: dict,
    performed_by: str | None = None,
) -> dict:
    """
    Soft-delete old item + create new version.
    Preserves audit trail.
    """
    from app.models.models import Item, ItemEditLog

    if format_type == "mcq":
        _validate_mcq_content(content)

    old_item = await db.get(Item, uuid.UUID(item_id))
    if not old_item:
        raise ValueError(f"Item {item_id} not found")

    # Deactivate old
    old_item.is_active = False
    db.add(ItemEditLog(
        item_id=old_item.id,
        action="deactivated",
        reason="replaced by new version",
        performed_by=uuid.UUID(performed_by) if performed_by else None,
    ))

    irt_b, irt_c = _DIFFICULTY_IRT.get(difficulty_label, (0.0, 0.25))

    # Create new version
    new_item = Item(
        kc_id=old_item.kc_id,
        version=old_item.version + 1,
        parent_id=old_item.id,
        content=content,
        difficulty_label=difficulty_label,
        format_type=format_type,
        irt_b=irt_b,
        irt_c=irt_c,
        is_active=True,
        created_by=uuid.UUID(performed_by) if performed_by else None,
    )
    db.add(new_item)
    await db.flush()

    db.add(ItemEditLog(
        item_id=new_item.id,
        action="replaced",
        old_item_id=old_item.id,
        performed_by=uuid.UUID(performed_by) if performed_by else None,
    ))

    await db.commit()
    await db.refresh(new_item)
    return {
        "old_id": str(old_item.id),
        "new_item": {
            "id": str(new_item.id),
            "kc_id": str(new_item.kc_id),
            "version": new_item.version,
            "content": new_item.content,
            "difficulty_label": new_item.difficulty_label,
            "format_type": new_item.format_type,
            "irt_b": new_item.irt_b,
            "is_active": new_item.is_active,
            "created_at": new_item.created_at.isoformat(),
        },
    }


async def toggle_item(
    db: AsyncSession,
    item_id: str,
    is_active: bool,
    performed_by: str | None = None,
) -> dict:
    """Toggle item active/inactive (soft deactivate)."""
    from app.models.models import Item, ItemEditLog

    item = await db.get(Item, uuid.UUID(item_id))
    if not item:
        raise ValueError(f"Item {item_id} not found")

    item.is_active = is_active
    db.add(ItemEditLog(
        item_id=item.id,
        action="deactivated" if not is_active else "created",
        reason="manual toggle",
        performed_by=uuid.UUID(performed_by) if performed_by else None,
    ))
    await db.commit()
    return {"ok": True, "is_active": is_active}
