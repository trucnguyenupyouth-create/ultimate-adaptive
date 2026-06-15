"""
KnowledgeGraph Service — DB ↔ Engine bridge (Layer 0)

Handles:
  - Loading the KG from PostgreSQL into the in-memory NetworkX graph
  - CRUD operations for KCs and prerequisites with guardrails
  - Serving graph data to the API layer
"""

from __future__ import annotations

import asyncio
import json
import uuid
from datetime import datetime, timezone

from sqlalchemy import select, delete
from sqlalchemy.ext.asyncio import AsyncSession

from app.engines.knowledge_graph import KnowledgeGraph, KCNode
from app.models.models import KnowledgeComponent, KCPrerequisite, GraphEditHistory, CMSUser, GraphBlock, GraphNote


# Module-level singleton graph — loaded once on startup, invalidated on writes
_graph_cache: KnowledgeGraph | None = None
REDIS_GRAPH_KEY = "GRAPH_JSON"
REDIS_GRAPH_TTL = 120  # seconds


async def get_graph(db: AsyncSession) -> KnowledgeGraph:
    """Return cached KG or rebuild from DB."""
    global _graph_cache
    if _graph_cache is None:
        _graph_cache = await _build_graph(db)
    return _graph_cache


def invalidate_graph_cache() -> None:
    """Clear in-memory cache and schedule Redis invalidation (fire-and-forget)."""
    global _graph_cache
    _graph_cache = None
    try:
        loop = asyncio.get_event_loop()
        if loop.is_running():
            loop.create_task(_invalidate_redis_cache())
    except RuntimeError:
        pass


async def _invalidate_redis_cache() -> None:
    from app.core.redis_client import get_redis
    r = await get_redis()
    if r:
        try:
            await r.delete(REDIS_GRAPH_KEY)
        except Exception:
            pass


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
            "chapter_info": kc.chapter_info,
            "block_id": str(kc.block_id) if kc.block_id else None,
            "metadata": kc.metadata_,
        } for kc in kcs],
        prerequisites=[{
            "kc_id": str(e.kc_id),
            "prereq_id": str(e.prereq_id),
            "label": e.label,
            "weight": e.weight,
            "edge_type": e.edge_type,
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
    chapter_info: str | None = None,
    performed_by: str | None = None,
    block_id: str | None = None,
) -> KnowledgeComponent:
    # Resolve code collision automatically
    base_code = code.strip().upper()
    resolved_code = base_code
    
    counter = 1
    while True:
        stmt = select(KnowledgeComponent).where(KnowledgeComponent.code == resolved_code)
        res = await db.execute(stmt)
        if res.scalar_one_or_none() is None:
            break
        resolved_code = f"{base_code}-{counter}"
        counter += 1

    kc = KnowledgeComponent(
        code=resolved_code,
        name=name,
        grade=grade,
        subject=subject,
        description=description,
        chapter_info=chapter_info,
        block_id=uuid.UUID(block_id) if block_id else None,
    )
    db.add(kc)
    await db.flush()  # get kc.id before logging

    # Log to graph edit history
    db.add(GraphEditHistory(
        action="add_kc",
        entity_id=kc.id,
        entity_type="kc",
        payload={"code": resolved_code, "name": name, "grade": grade, "chapter_info": chapter_info, "block_id": block_id},
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
    edge_type: str = "prerequisite",
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
        edge_type=edge_type,
        created_by=uuid.UUID(performed_by) if performed_by else None,
    )
    db.add(edge)

    db.add(GraphEditHistory(
        action="add_edge",
        entity_type="edge",
        payload={"kc_id": kc_id, "prereq_id": prereq_id, "label": label, "weight": weight, "edge_type": edge_type},
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
    edge_type: str | None = None,
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
    if edge_type is not None:
        edge.edge_type = edge_type

    db.add(GraphEditHistory(
        action="update_edge",
        entity_type="edge",
        payload={"kc_id": kc_id, "prereq_id": prereq_id, "label": label, "weight": weight, "edge_type": edge_type},
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
    """Serialised graph for React Flow frontend — Redis L2 cache."""
    from app.core.redis_client import get_redis

    # ── L2: Redis cache ───────────────────────────────────────────────────
    r = await get_redis()
    if r:
        try:
            cached = await r.get(REDIS_GRAPH_KEY)
            if cached:
                return json.loads(cached)
        except Exception:
            pass  # Redis error → fall through to DB

    # ── Build from DB ─────────────────────────────────────────────────────
    kg = await get_graph(db)
    data = kg.to_dict()

    blocks_res = await db.execute(select(GraphBlock))
    blocks = blocks_res.scalars().all()
    data["blocks"] = [
        {
            "id": str(b.id),
            "name": b.name,
            "x": b.x,
            "y": b.y,
            "width": b.width,
            "height": b.height,
        }
        for b in blocks
    ]

    notes_res = await db.execute(select(GraphNote))
    notes = notes_res.scalars().all()
    data["notes"] = [
        {
            "id": str(n.id),
            "content": n.content,
            "x": n.x,
            "y": n.y,
            "width": n.width,
            "height": n.height,
            "color": n.color,
        }
        for n in notes
    ]

    # ── Persist to Redis ──────────────────────────────────────────────────
    if r:
        try:
            await r.setex(REDIS_GRAPH_KEY, REDIS_GRAPH_TTL, json.dumps(data))
        except Exception:
            pass

    return data


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

    meta = dict(kc.metadata_ or {})
    return {
        "id": str(kc.id),
        "code": kc.code,
        "name": kc.name,
        "grade": kc.grade,
        "subject": kc.subject,
        "description": kc.description,
        "chapter_info": kc.chapter_info,
        "notes": kc.notes,
        "block_id": str(kc.block_id) if kc.block_id else None,
        "metadata": meta,
        "images": meta.get("images", []),
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
    chapter_info: str | None = None,
    notes: str | None = None,
    block_id: str | None = None,
    update_block_id: bool = False,
    x: float | None = None,
    y: float | None = None,
) -> KnowledgeComponent:
    """Partial update a KC. Only provided fields are updated."""
    kc = await db.get(KnowledgeComponent, uuid.UUID(kc_id))
    if not kc:
        raise ValueError(f"KC {kc_id} not found")

    payload = {}
    if name is not None:
        kc.name = name
        payload["name"] = name
    if grade is not None:
        kc.grade = grade
        payload["grade"] = grade
    if subject is not None:
        kc.subject = subject
        payload["subject"] = subject
    if description is not None:
        kc.description = description
        payload["description"] = description
    if chapter_info is not None:
        kc.chapter_info = chapter_info
        payload["chapter_info"] = chapter_info
    if notes is not None:
        kc.notes = notes
        payload["notes"] = notes
    if update_block_id:
        kc.block_id = uuid.UUID(block_id) if block_id else None
        payload["block_id"] = block_id
    if x is not None or y is not None:
        meta = dict(kc.metadata_) if kc.metadata_ else {}
        if x is not None:
            meta["x"] = x
        if y is not None:
            meta["y"] = y
        kc.metadata_ = meta
        payload["metadata"] = meta

    db.add(GraphEditHistory(
        action="update_kc",
        entity_id=kc.id,
        entity_type="kc",
        payload=payload,
    ))
    await db.commit()
    await db.refresh(kc)
    invalidate_graph_cache()
    return kc


async def delete_kc(db: AsyncSession, kc_id: str) -> dict:
    """
    Delete a KC:
    - Count and hard-delete all its items (raw SQL to avoid ORM FK nullification)
    - Explicitly delete all prerequisite edges (both directions)
    - Log to GraphEditHistory
    - Delete the KC itself
    """
    from app.models.models import Item
    from sqlalchemy import delete as sql_delete, func as sql_func

    kc_uuid = uuid.UUID(kc_id)

    # Verify KC exists
    kc = await db.get(KnowledgeComponent, kc_uuid)
    if not kc:
        raise ValueError(f"KC {kc_id} not found")

    # 1. Count items first
    count_result = await db.execute(
        select(sql_func.count()).select_from(Item).where(Item.kc_id == kc_uuid)
    )
    deleted_items = count_result.scalar() or 0

    # 2. Hard-delete items via raw SQL (avoids ORM trying to SET kc_id=NULL)
    await db.execute(sql_delete(Item).where(Item.kc_id == kc_uuid))
    await db.flush()

    # 3. Count then delete prerequisite edges
    edges_count_result = await db.execute(
        select(sql_func.count()).select_from(KCPrerequisite).where(
            (KCPrerequisite.kc_id == kc_uuid) | (KCPrerequisite.prereq_id == kc_uuid)
        )
    )
    deleted_edges = edges_count_result.scalar() or 0

    await db.execute(
        sql_delete(KCPrerequisite).where(
            (KCPrerequisite.kc_id == kc_uuid) | (KCPrerequisite.prereq_id == kc_uuid)
        )
    )
    await db.flush()

    # 4. Log history BEFORE deleting KC
    db.add(GraphEditHistory(
        action="delete_kc",
        entity_id=kc_uuid,
        entity_type="kc",
        payload={"kc_id": kc_id, "deleted_items": deleted_items, "deleted_edges": deleted_edges},
    ))
    await db.flush()

    # 5. Delete the KC itself (no ORM children remain now)
    await db.delete(kc)

    await db.commit()
    invalidate_graph_cache()
    return {"ok": True, "deleted_items": deleted_items, "deleted_edges": deleted_edges}



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
            "irt_a": i.irt_a,
            "irt_c": i.irt_c,
            "is_active": i.is_active,
            "is_diagnostic_anchor": i.is_diagnostic_anchor,
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


async def toggle_anchor(
    db: AsyncSession,
    item_id: str,
    is_anchor: bool,
    performed_by: str | None = None,
) -> dict:
    """
    Mark/unmark an item as a Diagnostic Anchor (Entry Point for Cold Start CAT).

    Validation:
    - Item must exist and be active
    - Warns if irt_b outside [-0.5, 0.5] (not ideal difficulty for cold start)
    """
    from app.models.models import Item, ItemEditLog

    item = await db.get(Item, uuid.UUID(item_id))
    if not item:
        raise ValueError(f"Item {item_id} not found")
    if not item.is_active:
        raise ValueError("Chỉ được đánh dấu Entry Point cho câu hỏi đang hoạt động.")

    item.is_diagnostic_anchor = is_anchor
    db.add(ItemEditLog(
        item_id=item.id,
        action="anchor_set" if is_anchor else "anchor_unset",
        reason="Content team tag",
        performed_by=uuid.UUID(performed_by) if performed_by else None,
    ))
    await db.commit()

    warning = None
    if is_anchor and not (-0.5 <= item.irt_b <= 0.5):
        warning = f"Cảnh báo: câu này có độ khó irt_b={item.irt_b:.2f} (không nằm trong [−0.5, 0.5]). Điều này có thể giảm hiệu quả chẩn đoán."

    return {
        "ok": True,
        "item_id": item_id,
        "is_diagnostic_anchor": is_anchor,
        "warning": warning,
    }


# ── Block CRUD ───────────────────────────────────────────────────────────────

async def create_block(
    db: AsyncSession,
    name: str,
    x: float,
    y: float,
    width: float = 400.0,
    height: float = 300.0,
) -> GraphBlock:
    block = GraphBlock(
        name=name,
        x=x,
        y=y,
        width=width,
        height=height,
    )
    db.add(block)
    await db.flush()
    
    db.add(GraphEditHistory(
        action="create_block",
        entity_id=block.id,
        entity_type="block",
        payload={"name": name, "x": x, "y": y, "width": width, "height": height},
    ))
    await db.commit()
    await db.refresh(block)
    return block


async def update_block(
    db: AsyncSession,
    block_id: str,
    name: str | None = None,
    x: float | None = None,
    y: float | None = None,
    width: float | None = None,
    height: float | None = None,
) -> GraphBlock:
    block_uuid = uuid.UUID(block_id)
    block = await db.get(GraphBlock, block_uuid)
    if not block:
        raise ValueError(f"Block {block_id} not found")
    
    payload = {}
    if name is not None:
        block.name = name
        payload["name"] = name
    if x is not None:
        block.x = x
        payload["x"] = x
    if y is not None:
        block.y = y
        payload["y"] = y
    if width is not None:
        block.width = width
        payload["width"] = width
    if height is not None:
        block.height = height
        payload["height"] = height
        
    block.updated_at = datetime.now(timezone.utc)
    
    db.add(GraphEditHistory(
        action="update_block",
        entity_id=block.id,
        entity_type="block",
        payload=payload,
    ))
    await db.commit()
    await db.refresh(block)
    return block


async def delete_block(db: AsyncSession, block_id: str) -> dict:
    block_uuid = uuid.UUID(block_id)
    block = await db.get(GraphBlock, block_uuid)
    if block:
        await db.delete(block)
        db.add(GraphEditHistory(
            action="delete_block",
            entity_id=block_uuid,
            entity_type="block",
            payload={"block_id": block_id},
        ))
        await db.commit()
        invalidate_graph_cache()
    return {"ok": True}


# ── Edge Type Change ──────────────────────────────────────────────────────────

async def change_edge_type(
    db: AsyncSession,
    kc_id: str,
    prereq_id: str,
    edge_type: str,
    performed_by: str | None = None,
) -> dict:
    """Delete old edge and re-create with new edge_type (preserves label/weight)."""
    VALID_TYPES = {"prerequisite", "inference", "unsure"}
    if edge_type not in VALID_TYPES:
        return {"ok": False, "error": f"Invalid edge_type '{edge_type}'. Must be one of {VALID_TYPES}"}

    kc_uuid = uuid.UUID(kc_id)
    prereq_uuid = uuid.UUID(prereq_id)

    stmt = select(KCPrerequisite).where(
        KCPrerequisite.kc_id == kc_uuid,
        KCPrerequisite.prereq_id == prereq_uuid
    )
    res = await db.execute(stmt)
    old_edge = res.scalar_one_or_none()
    if not old_edge:
        return {"ok": False, "error": "Edge not found"}

    old_label = old_edge.label
    old_weight = old_edge.weight

    # Delete old edge
    await db.delete(old_edge)
    await db.flush()

    # Re-create with new type
    new_edge = KCPrerequisite(
        kc_id=kc_uuid,
        prereq_id=prereq_uuid,
        label=old_label,
        weight=old_weight,
        edge_type=edge_type,
        created_by=uuid.UUID(performed_by) if performed_by else None,
    )
    db.add(new_edge)

    db.add(GraphEditHistory(
        action="change_edge_type",
        entity_type="edge",
        payload={"kc_id": kc_id, "prereq_id": prereq_id, "edge_type": edge_type},
        performed_by=uuid.UUID(performed_by) if performed_by else None,
    ))

    await db.commit()
    invalidate_graph_cache()
    return {"ok": True}


# ── Note (Sticky Notes) CRUD ──────────────────────────────────────────────────

async def create_note(
    db: AsyncSession,
    content: str = "",
    x: float = 0.0,
    y: float = 0.0,
    width: float = 200.0,
    height: float = 150.0,
    color: str = "yellow",
) -> dict:
    note = GraphNote(
        content=content,
        x=x,
        y=y,
        width=width,
        height=height,
        color=color,
    )
    db.add(note)
    await db.commit()
    await db.refresh(note)
    return {
        "id": str(note.id),
        "content": note.content,
        "x": note.x,
        "y": note.y,
        "width": note.width,
        "height": note.height,
        "color": note.color,
    }


async def update_note(
    db: AsyncSession,
    note_id: str,
    content: str | None = None,
    x: float | None = None,
    y: float | None = None,
    width: float | None = None,
    height: float | None = None,
) -> dict:
    note = await db.get(GraphNote, uuid.UUID(note_id))
    if not note:
        return {"ok": False, "error": "Note not found"}
    if content is not None:
        note.content = content
    if x is not None:
        note.x = x
    if y is not None:
        note.y = y
    if width is not None:
        note.width = width
    if height is not None:
        note.height = height
    note.updated_at = datetime.now(timezone.utc)
    await db.commit()
    await db.refresh(note)
    return {
        "id": str(note.id),
        "content": note.content,
        "x": note.x,
        "y": note.y,
        "width": note.width,
        "height": note.height,
        "color": note.color,
    }


async def delete_note(db: AsyncSession, note_id: str) -> dict:
    note = await db.get(GraphNote, uuid.UUID(note_id))
    if note:
        await db.delete(note)
        await db.commit()
    return {"ok": True}


# ── KC Image CRUD ──────────────────────────────────────────────────────────────

async def add_kc_image(
    db: AsyncSession,
    kc_id: str,
    url: str,
    original_name: str,
    size_bytes: int,
) -> dict:
    """Append an image entry into KC metadata_.images[]. Returns the new entry."""
    kc = await db.get(KnowledgeComponent, uuid.UUID(kc_id))
    if not kc:
        raise ValueError(f"KC {kc_id} not found")

    meta = dict(kc.metadata_ or {})
    images: list = list(meta.get("images", []))

    # Extract image_id from the URL (last segment without extension)
    image_id = url.rstrip("/").split("/")[-1].replace(".webp", "")
    entry = {
        "id": image_id,
        "url": url,
        "original_name": original_name,
        "size_bytes": size_bytes,
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    images.append(entry)
    meta["images"] = images

    # SQLAlchemy JSONB mutation detection requires reassignment
    kc.metadata_ = {**meta}
    await db.commit()
    await db.refresh(kc)
    return entry


async def remove_kc_image(db: AsyncSession, kc_id: str, image_id: str) -> None:
    """Remove an image entry from KC metadata_.images[]."""
    kc = await db.get(KnowledgeComponent, uuid.UUID(kc_id))
    if not kc:
        raise ValueError(f"KC {kc_id} not found")

    meta = dict(kc.metadata_ or {})
    images = [img for img in meta.get("images", []) if img.get("id") != image_id]
    meta["images"] = images
    kc.metadata_ = {**meta}
    await db.commit()
