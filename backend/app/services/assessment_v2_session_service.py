"""Student-facing Assessment V2 pilot session service."""

from __future__ import annotations

import uuid
from datetime import datetime, timezone
from typing import Any

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.engines.assessment_v2.diagnostic_engine import (
    DiagnosticItem,
    DiagnosticResponse,
    DiagnosticRun,
    DiagnosticState,
    V2DiagnosticEngine,
)
from app.engines.assessment_v2.open_grading import grade_open_response
from app.engines.assessment_v2.strand_scope import algebra_scope_ids, propose_g6_strands
from app.models.models import AssessmentV2ItemReview, AssessmentV2Session, KCPrerequisite, KnowledgeComponent
from app.services.assessment_v2_review_service import _ensure_seeded, enrich_review_item, is_pilot_ready


DEFAULT_MAX_QUESTIONS = 35


def _now() -> datetime:
    return datetime.now(timezone.utc)


def _now_iso() -> str:
    return _now().isoformat()


async def _load_g6_graph(db: AsyncSession) -> dict[str, list[dict[str, Any]]]:
    node_result = await db.execute(select(KnowledgeComponent).where(KnowledgeComponent.grade == 6))
    nodes = [
        {
            "id": str(row.id),
            "code": row.code,
            "name": row.name,
            "grade": row.grade,
            "subject": row.subject,
            "chapter_info": row.chapter_info,
            "description": row.description,
        }
        for row in node_result.scalars().all()
    ]
    node_ids = {node["id"] for node in nodes}
    edge_result = await db.execute(select(KCPrerequisite).where(KCPrerequisite.edge_type == "prerequisite"))
    edges = [
        {
            "source": str(row.prereq_id),
            "target": str(row.kc_id),
            "prereq_id": str(row.prereq_id),
            "kc_id": str(row.kc_id),
            "edge_type": row.edge_type,
            "weight": row.weight,
        }
        for row in edge_result.scalars().all()
        if str(row.prereq_id) in node_ids and str(row.kc_id) in node_ids
    ]
    return {"nodes": nodes, "edges": edges}


async def _load_pilot_context(db: AsyncSession) -> tuple[list[dict[str, Any]], list[dict[str, Any]], list[DiagnosticItem]]:
    await _ensure_seeded(db)
    graph = await _load_g6_graph(db)
    assignments = propose_g6_strands(graph)
    scope_ids = algebra_scope_ids(assignments, include_review_required=False)

    nodes = [
        {"id": node["id"], "code": node["code"], "name": node["name"], "grade": node["grade"]}
        for node in graph["nodes"]
        if node["id"] in scope_ids
    ]
    edges = [
        {"source": edge["source"], "target": edge["target"], "edge_type": edge["edge_type"]}
        for edge in graph["edges"]
        if edge["source"] in scope_ids and edge["target"] in scope_ids
    ]

    result = await db.execute(select(AssessmentV2ItemReview).order_by(AssessmentV2ItemReview.review_id))
    diagnostic_items: list[DiagnosticItem] = []
    for row in result.scalars().all():
        item = dict(row.item_payload or {})
        item["review_id"] = row.review_id
        item["review_decision"] = row.review_decision
        item["flagged_for_review"] = bool(row.flagged_for_review)
        item["review_comment"] = row.review_comment or ""
        enriched = enrich_review_item(item)
        if enriched.get("kc_id") not in scope_ids or not is_pilot_ready(enriched):
            continue
        content = dict(enriched)
        format_type = "open" if enriched.get("answer_widget") != "expression" else "open_short"
        diagnostic_items.append(DiagnosticItem(
            id=enriched["review_id"],
            kc_id=str(enriched["kc_id"]),
            format_type=format_type,
            difficulty_label=enriched.get("difficulty_label") or "medium",
            is_diagnostic_anchor=bool(enriched.get("is_diagnostic_anchor")),
            content=content,
        ))
    return nodes, edges, diagnostic_items


def _run_from_payload(payload: dict[str, Any]) -> DiagnosticRun:
    states = {
        kc_id: DiagnosticState(
            kc_id=kc_id,
            p_mastery=float(state.get("p_mastery", 0.5)),
            direct_evidence_count=int(state.get("direct_evidence_count", 0)),
            correct_count=int(state.get("correct_count", 0)),
            wrong_count=int(state.get("wrong_count", 0)),
            inferred_evidence_count=int(state.get("inferred_evidence_count", 0)),
        )
        for kc_id, state in payload.get("run", {}).get("states", {}).items()
    }
    return DiagnosticRun(
        states=states,
        tested_order=list(payload.get("run", {}).get("tested_order", [])),
        seen_items=set(payload.get("run", {}).get("seen_items", [])),
        evidence_by_kc=dict(payload.get("run", {}).get("evidence_by_kc", {})),
        frontier_history=list(payload.get("run", {}).get("frontier_history", [])),
        state_transitions=list(payload.get("run", {}).get("state_transitions", [])),
    )


def _serialize_item(item: DiagnosticItem, nodes_by_id: dict[str, dict[str, Any]]) -> dict[str, Any]:
    content = item.content
    return {
        "item_id": item.id,
        "kc_id": item.kc_id,
        "kc_code": nodes_by_id.get(item.kc_id, {}).get("code"),
        "kc_name": nodes_by_id.get(item.kc_id, {}).get("name"),
        "question": content.get("question"),
        "answer_type": content.get("answer_type"),
        "answer_widget": content.get("answer_widget"),
        "checker_type": content.get("checker_type"),
        "difficulty_label": item.difficulty_label,
        "is_diagnostic_anchor": item.is_diagnostic_anchor,
        "progress_hint": "This adaptive check may finish before the maximum question count.",
    }


def _serialize_diagnostic_item_for_payload(item: DiagnosticItem) -> dict[str, Any]:
    return {
        "id": item.id,
        "kc_id": item.kc_id,
        "format_type": item.format_type,
        "content": item.content,
        "difficulty_label": item.difficulty_label,
        "is_diagnostic_anchor": item.is_diagnostic_anchor,
    }


def _normalize_student_answer(answer: Any) -> str:
    if isinstance(answer, dict):
        if "raw" in answer:
            return str(answer.get("raw") or "")
        if {"numerator", "denominator"} <= set(answer):
            return f"{answer.get('numerator')}/{answer.get('denominator')}"
        if {"base", "exponent"} <= set(answer):
            return f"{answer.get('base')}^{answer.get('exponent')}"
        if "parts" in answer and isinstance(answer["parts"], list):
            return ";".join(str(part) for part in answer["parts"])
    return "" if answer is None else str(answer)


def _student_summary(run: DiagnosticRun, nodes: list[dict[str, Any]]) -> dict[str, Any]:
    node_by_id = {node["id"]: node for node in nodes}
    states = {kc_id: state.to_dict() for kc_id, state in run.states.items()}

    def rows_for(labels: set[str], limit: int = 12) -> list[dict[str, Any]]:
        rows = []
        for kc_id, state in sorted(states.items(), key=lambda row: row[1]["p_mastery"]):
            if state["label"] not in labels:
                continue
            node = node_by_id.get(kc_id, {})
            rows.append({
                "kc_id": kc_id,
                "code": node.get("code"),
                "name": node.get("name"),
                "state": state["label"],
                "probability_band": state["probability_band"],
                "p_mastery": round(state["p_mastery"], 3),
            })
        return rows[:limit]

    strong = sorted(
        [
            {
                "kc_id": kc_id,
                "code": node_by_id.get(kc_id, {}).get("code"),
                "name": node_by_id.get(kc_id, {}).get("name"),
                "state": state["label"],
                "probability_band": state["probability_band"],
                "p_mastery": round(state["p_mastery"], 3),
            }
            for kc_id, state in states.items()
            if state["label"] in {"tested_mastered", "inferred_mastered"} and state["p_mastery"] >= 0.85
        ],
        key=lambda row: row["p_mastery"],
        reverse=True,
    )[:12]

    uncertain = [
        {
            "kc_id": kc_id,
            "code": node_by_id.get(kc_id, {}).get("code"),
            "name": node_by_id.get(kc_id, {}).get("name"),
            "state": state["label"],
            "probability_band": state["probability_band"],
            "p_mastery": round(state["p_mastery"], 3),
        }
        for kc_id, state in states.items()
        if state["label"] == "unknown" and 0.35 < state["p_mastery"] < 0.80
    ][:12]

    return {
        "strong_areas": strong,
        "skills_to_review": rows_for({"tested_gap"}),
        "possibly_affected": rows_for({"inferred_gap"}),
        "not_enough_evidence": uncertain,
        "ready_to_learn": uncertain[:5],
        "value_metrics": {
            "questions_asked": len(run.seen_items),
            "skills_directly_tested": sum(1 for state in states.values() if state["direct_evidence_count"] > 0),
            "skills_inferred": sum(1 for state in states.values() if state["inferred_evidence_count"] > 0),
            "skills_not_directly_asked": sum(1 for state in states.values() if state["direct_evidence_count"] == 0),
        },
    }


async def create_session(db: AsyncSession, max_questions: int = DEFAULT_MAX_QUESTIONS, student_label: str | None = None) -> dict[str, Any]:
    nodes, edges, items = await _load_pilot_context(db)
    if not items:
        raise ValueError("No Assessment V2 pilot-ready items are available.")
    engine = V2DiagnosticEngine(nodes=nodes, edges=edges, items=items)
    run = engine.new_run()
    first = engine.select_next(run)
    if first is None:
        raise ValueError("Assessment V2 could not select a first item.")

    session_code = f"v2-{uuid.uuid4().hex[:12]}"
    payload = {
        "version": 1,
        "created_at": _now_iso(),
        "nodes": nodes,
        "edges": edges,
        "items": [_serialize_diagnostic_item_for_payload(item) for item in items],
        "run": run.to_dict(),
        "current_item_id": first.id,
        "responses": [],
    }
    row = AssessmentV2Session(
        session_code=session_code,
        status="in_progress",
        max_questions=max_questions,
        student_label=student_label,
        payload=payload,
        updated_at=_now(),
    )
    db.add(row)
    await db.commit()
    await db.refresh(row)
    return {
        "session_id": str(row.id),
        "session_code": row.session_code,
        "status": row.status,
        "max_questions": row.max_questions,
        "question_number": 1,
        "item": _serialize_item(first, {node["id"]: node for node in nodes}),
    }


async def submit_response(
    db: AsyncSession,
    session_id: str,
    item_id: str,
    answer: Any = None,
    response_type: str = "answer",
) -> dict[str, Any]:
    result = await db.execute(select(AssessmentV2Session).where(AssessmentV2Session.id == uuid.UUID(session_id)))
    row = result.scalar_one_or_none()
    if row is None:
        raise KeyError(f"Assessment V2 session {session_id} not found")
    if row.status == "completed":
        return await get_result(db, session_id)

    payload = dict(row.payload or {})
    nodes = list(payload.get("nodes", []))
    edges = list(payload.get("edges", []))
    items = [
        DiagnosticItem(
            id=item["id"],
            kc_id=item["kc_id"],
            format_type=item["format_type"],
            content=item["content"],
            difficulty_label=item.get("difficulty_label", "medium"),
            is_diagnostic_anchor=bool(item.get("is_diagnostic_anchor")),
        )
        for item in payload.get("items", [])
    ]
    item_by_id = {item.id: item for item in items}
    item = item_by_id.get(item_id)
    if item is None or payload.get("current_item_id") != item_id:
        raise ValueError("Submitted item_id does not match the active session item.")

    run = _run_from_payload(payload)
    answer_text = _normalize_student_answer(answer)
    grading = grade_open_response(item.content, answer_text)
    is_unknown = response_type == "unknown" or grading.matched_rule == "unknown_response"
    diagnostic_response = DiagnosticResponse(
        item_id=item.id,
        correct=False if is_unknown else grading.is_correct,
        student_answer=answer_text,
        grading=grading.__dict__,
        response_type="unknown" if is_unknown else "answer",
    )
    engine = V2DiagnosticEngine(nodes=nodes, edges=edges, items=items)
    engine.apply_response(run, item, diagnostic_response)

    responses = list(payload.get("responses", []))
    responses.append({
        "step": len(responses) + 1,
        "item": _serialize_item(item, {node["id"]: node for node in nodes}),
        "answer": answer_text,
        "response_type": diagnostic_response.response_type,
        "grading": grading.__dict__,
    })

    next_item = None
    if len(responses) < row.max_questions:
        next_item = engine.select_next(run)

    payload["run"] = run.to_dict()
    payload["responses"] = responses
    payload["current_item_id"] = next_item.id if next_item else None

    row.payload = payload
    row.updated_at = _now()
    if next_item is None or len(responses) >= row.max_questions:
        row.status = "completed"
        row.completed_at = _now()
    await db.commit()
    await db.refresh(row)

    if row.status == "completed":
        return await get_result(db, session_id)
    return {
        "session_id": str(row.id),
        "session_code": row.session_code,
        "status": row.status,
        "question_number": len(responses) + 1,
        "max_questions": row.max_questions,
        "last_grading": grading.__dict__,
        "item": _serialize_item(next_item, {node["id"]: node for node in nodes}) if next_item else None,
    }


async def get_result(db: AsyncSession, session_id: str) -> dict[str, Any]:
    result = await db.execute(select(AssessmentV2Session).where(AssessmentV2Session.id == uuid.UUID(session_id)))
    row = result.scalar_one_or_none()
    if row is None:
        raise KeyError(f"Assessment V2 session {session_id} not found")
    payload = dict(row.payload or {})
    run = _run_from_payload(payload)
    summary = _student_summary(run, list(payload.get("nodes", [])))
    return {
        "session_id": str(row.id),
        "session_code": row.session_code,
        "status": row.status,
        "max_questions": row.max_questions,
        "summary": summary,
        "responses": payload.get("responses", []),
        "run": run.to_dict(),
    }


async def get_review(db: AsyncSession, session_id: str) -> dict[str, Any]:
    result = await get_result(db, session_id)
    result["audit"] = {
        "frontier_history": result["run"].get("frontier_history", []),
        "state_transitions": result["run"].get("state_transitions", []),
        "evidence_by_kc": result["run"].get("evidence_by_kc", {}),
    }
    return result
