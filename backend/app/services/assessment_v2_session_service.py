"""Student-facing Assessment V2 pilot session service."""

from __future__ import annotations

import json
import uuid
from datetime import datetime, timezone
from fractions import Fraction
from pathlib import Path
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
DEFAULT_ASSESSMENT_SCOPE = "g6_algebra_pilot"
GRADE8_EXAM_PATH_SCOPE = "grade8_exam_path"
ROOT = Path(__file__).resolve().parents[3]
GRADE8_DRAFT_ITEMS_PATH = ROOT / "docs" / "grade8_exam_path_official_item_drafts.json"
GRADE8_SCOPE_PATH = ROOT / "docs" / "grade8_exam_scope.json"


def _now() -> datetime:
    return datetime.now(timezone.utc)


def _now_iso() -> str:
    return _now().isoformat()


def _fraction_value(value: str) -> Fraction | None:
    text = str(value or "").strip().lower().replace(" ", "").replace(",", ".")
    if not text:
        return None
    try:
        if "/" in text:
            return Fraction(text)
        return Fraction(str(float(text)))
    except (ValueError, ZeroDivisionError):
        return None


def _answers_equivalent(answer: str, accepted: list[str]) -> bool:
    normalized = str(answer or "").strip().lower().replace(" ", "").replace(",", ".")
    answer_fraction = _fraction_value(normalized)
    for expected in accepted:
        expected_normalized = str(expected or "").strip().lower().replace(" ", "").replace(",", ".")
        if normalized == expected_normalized:
            return True
        expected_fraction = _fraction_value(expected_normalized)
        if answer_fraction is not None and expected_fraction is not None and answer_fraction == expected_fraction:
            return True
    return False


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


async def _load_grade8_exam_path_context(db: AsyncSession) -> tuple[list[dict[str, Any]], list[dict[str, Any]], list[DiagnosticItem]]:
    if not GRADE8_DRAFT_ITEMS_PATH.exists():
        raise ValueError("Grade 8 official-path draft item bank is not available on this deployment.")
    if not GRADE8_SCOPE_PATH.exists():
        raise ValueError("Grade 8 official-path scope is not available on this deployment.")
    raw_items = json.loads(GRADE8_DRAFT_ITEMS_PATH.read_text(encoding="utf-8")).get("items", [])
    scope_config = json.loads(GRADE8_SCOPE_PATH.read_text(encoding="utf-8"))
    if not raw_items:
        raise ValueError("Grade 8 official-path draft item bank is empty.")

    scope_codes = set(scope_config.get("reportable_scope_codes") or [])
    scope_codes.update(scope_config.get("support_scope_codes") or [])
    if not scope_codes:
        raise ValueError("Grade 8 official-path scope has no reportable/support nodes.")

    node_result = await db.execute(select(KnowledgeComponent).where(KnowledgeComponent.code.in_(sorted(scope_codes))))
    node_rows = list(node_result.scalars().all())
    nodes_by_id = {str(row.id): row for row in node_rows}
    ids_by_code = {row.code: str(row.id) for row in node_rows}
    missing_codes = sorted(scope_codes - set(ids_by_code))
    if missing_codes:
        raise ValueError(f"Grade 8 official-path scope references missing KCs: {missing_codes}")

    scope_ids = set(nodes_by_id)
    for item in raw_items:
        if item.get("official_assessment_scope") != GRADE8_EXAM_PATH_SCOPE:
            continue
        item_code = item.get("kc_code")
        if item_code in scope_codes and item.get("kc_id"):
            scope_ids.add(str(item["kc_id"]))
        for id_key, code_key in (("requires_kcs", "requires_kc_codes"), ("diagnoses_kcs", "diagnoses_kc_codes")):
            ids = [str(kc_id) for kc_id in item.get(id_key, []) or []]
            codes = [str(kc_code) for kc_code in item.get(code_key, []) or []]
            for kc_id, kc_code in zip(ids, codes):
                if kc_code in scope_codes:
                    scope_ids.add(kc_id)

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
        for row in node_rows
        if str(row.id) in scope_ids
    ]
    existing_ids = {node["id"] for node in nodes}
    edge_result = await db.execute(select(KCPrerequisite).where(KCPrerequisite.edge_type == "prerequisite"))
    edges = [
        {
            "source": str(row.prereq_id),
            "target": str(row.kc_id),
            "edge_type": row.edge_type,
            "weight": row.weight,
        }
        for row in edge_result.scalars().all()
        if str(row.prereq_id) in existing_ids and str(row.kc_id) in existing_ids
    ]

    diagnostic_items: list[DiagnosticItem] = []
    for raw in raw_items:
        if raw.get("official_assessment_scope") != GRADE8_EXAM_PATH_SCOPE:
            continue
        if raw.get("kc_code") not in scope_codes:
            continue
        if str(raw.get("kc_id")) not in existing_ids:
            continue
        widget = raw.get("answer_widget") or raw.get("answer_type") or "short_text"
        format_type = "open" if widget in {"number", "decimal", "fraction", "coordinate_pair", "ordered_pair_list"} else "open_short"
        diagnostic_items.append(DiagnosticItem(
            id=raw["review_id"],
            kc_id=str(raw["kc_id"]),
            format_type=format_type,
            difficulty_label=raw.get("item_role") or raw.get("difficulty_label") or "medium",
            is_diagnostic_anchor=raw.get("item_role") == "anchor",
            content=dict(raw),
        ))

    if not diagnostic_items:
        raise ValueError("Grade 8 official-path assessment has no usable local draft items.")
    return nodes, edges, diagnostic_items


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


async def _load_context_for_scope(
    db: AsyncSession,
    assessment_scope: str,
) -> tuple[list[dict[str, Any]], list[dict[str, Any]], list[DiagnosticItem]]:
    if assessment_scope == GRADE8_EXAM_PATH_SCOPE:
        return await _load_grade8_exam_path_context(db)
    if assessment_scope == DEFAULT_ASSESSMENT_SCOPE:
        return await _load_pilot_context(db)
    raise ValueError(f"Unsupported Assessment V2 scope: {assessment_scope}")


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
        particle_state=payload.get("run", {}).get("particle_state"),
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
        "target_exam_path": content.get("target_exam_path"),
        "item_role": content.get("item_role"),
        "item_family": content.get("item_family"),
        "surface_signature": content.get("surface_signature"),
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


def _pick_learning_recommendation(summary: dict[str, Any]) -> dict[str, Any] | None:
    for key in ("skills_to_review", "ready_to_learn", "possibly_affected", "not_enough_evidence"):
        rows = summary.get(key) or []
        if rows:
            recommendation = dict(rows[0])
            recommendation["source_bucket"] = key
            return recommendation
    return None


def _lesson_for_recommendation(recommendation: dict[str, Any] | None) -> dict[str, Any]:
    code = str((recommendation or {}).get("code") or "")
    name = str((recommendation or {}).get("name") or "Selected skill")
    if "PHAN" in code or "B31K2" in code or "TINH-CHAT-CO" in code:
        return {
            "lesson_id": "fraction-simplify-foundation",
            "title": "Target lesson: rút gọn phân số",
            "subtitle": name,
            "concept": (
                "Một phân số không đổi giá trị nếu chia cả tử và mẫu cho cùng một số khác 0. "
                "Mục tiêu là đưa về dạng không còn ước chung lớn hơn 1."
            ),
            "worked_example": [
                "18 và 24 cùng chia hết cho 6.",
                "18/24 = (18 : 6)/(24 : 6).",
                "Kết quả là 3/4, vì 3 và 4 không còn ước chung lớn hơn 1.",
            ],
            "practice_prompt": "Thử nhanh: 21/28 rút gọn thành phân số nào?",
            "mastery": {
                "prompt": "Mastery check: rút gọn 30/45 về dạng tối giản.",
                "answer_widget": "fraction",
                "accepted_answers": ["2/3"],
                "hint": "Nhập tử số và mẫu số sau khi chia cho ước chung lớn nhất.",
            },
        }
    if "LUY" in code or "CAU" in code or "SO-3" in code:
        return {
            "lesson_id": "power-notation-foundation",
            "title": "Target lesson: đọc cấu trúc lũy thừa",
            "subtitle": name,
            "concept": "Trong a^n, a là cơ số và n là số mũ. Số mũ cho biết cơ số được nhân với chính nó bao nhiêu lần.",
            "worked_example": [
                "7^4 có cơ số là 7.",
                "Số mũ là 4.",
                "Giá trị 7^4 khác với việc chỉ ra số mũ.",
            ],
            "practice_prompt": "Trong 5^3, số mũ là bao nhiêu?",
            "mastery": {
                "prompt": "Mastery check: trong 9^2, số mũ là bao nhiêu?",
                "answer_widget": "number",
                "accepted_answers": ["2"],
                "hint": "Chỉ nhập số mũ, không nhập cả biểu thức.",
            },
        }
    return {
        "lesson_id": "generic-missing-step",
        "title": "Target lesson: rebuild the missing step",
        "subtitle": name,
        "concept": "Hệ thống chọn kỹ năng này vì nó nằm gần ranh giới giữa vùng đã chắc và vùng cần ôn.",
        "worked_example": ["Đọc yêu cầu.", "Làm từng bước.", "Đối chiếu đáp án với điều kiện của bài."],
        "practice_prompt": "Làm lại một câu cùng kỹ năng với đáp án ngắn gọn.",
        "mastery": {
            "prompt": "Mastery check: nhập 1 nếu đã sẵn sàng tiếp tục.",
            "answer_widget": "number",
            "accepted_answers": ["1"],
            "hint": "Demo generic cho kỹ năng chưa có lesson riêng.",
        },
    }


def _learning_loop(payload: dict[str, Any], summary: dict[str, Any]) -> dict[str, Any]:
    existing = dict(payload.get("learning_loop") or {})
    recommendation = existing.get("recommendation") or _pick_learning_recommendation(summary)
    lesson = existing.get("lesson") or _lesson_for_recommendation(recommendation)
    return {
        "recommendation": recommendation,
        "lesson": lesson,
        "mastery_status": existing.get("mastery_status") or "not_started",
        "mastery_checks": list(existing.get("mastery_checks") or []),
        "updated_at": existing.get("updated_at"),
    }


def _session_response_from_row(row: AssessmentV2Session) -> dict[str, Any]:
    payload = dict(row.payload or {})
    nodes = list(payload.get("nodes", []))
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
    current_item = item_by_id.get(payload.get("current_item_id"))
    responses = list(payload.get("responses", []))
    return {
        "session_id": str(row.id),
        "session_code": row.session_code,
        "status": row.status,
        "assessment_scope": payload.get("assessment_scope") or DEFAULT_ASSESSMENT_SCOPE,
        "max_questions": row.max_questions,
        "question_number": len(responses) + 1,
        "item": _serialize_item(current_item, {node["id"]: node for node in nodes}) if current_item else None,
        "responses": responses,
    }


async def create_session(
    db: AsyncSession,
    max_questions: int = DEFAULT_MAX_QUESTIONS,
    student_label: str | None = None,
    assessment_scope: str = DEFAULT_ASSESSMENT_SCOPE,
) -> dict[str, Any]:
    nodes, edges, items = await _load_context_for_scope(db, assessment_scope)
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
        "assessment_scope": assessment_scope,
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
    return _session_response_from_row(row)


def _session_metadata_from_row(row: AssessmentV2Session) -> dict[str, Any]:
    payload = dict(row.payload or {})
    responses = list(payload.get("responses", []))
    run = _run_from_payload(payload)
    summary = _student_summary(run, list(payload.get("nodes", []))) if payload.get("run") else None
    correct_count = sum(1 for response in responses if (response.get("grading") or {}).get("is_correct") is True)
    unknown_count = sum(1 for response in responses if response.get("response_type") == "unknown")
    return {
        "session_id": str(row.id),
        "session_code": row.session_code,
        "status": row.status,
        "assessment_scope": payload.get("assessment_scope") or DEFAULT_ASSESSMENT_SCOPE,
        "student_label": row.student_label,
        "max_questions": row.max_questions,
        "questions_asked": len(responses),
        "correct_count": correct_count,
        "unknown_count": unknown_count,
        "skills_directly_tested": (summary or {}).get("value_metrics", {}).get("skills_directly_tested", 0),
        "skills_inferred": (summary or {}).get("value_metrics", {}).get("skills_inferred", 0),
        "created_at": row.created_at.isoformat() if row.created_at else None,
        "updated_at": row.updated_at.isoformat() if row.updated_at else None,
        "completed_at": row.completed_at.isoformat() if row.completed_at else None,
        "recommendation": (_learning_loop(payload, summary or {}).get("recommendation") if summary else None),
    }


async def list_sessions(
    db: AsyncSession,
    limit: int = 50,
    status: str | None = None,
    assessment_scope: str | None = None,
) -> dict[str, Any]:
    query = select(AssessmentV2Session)
    if status:
        query = query.where(AssessmentV2Session.status == status)
    query = query.order_by(AssessmentV2Session.created_at.desc()).limit(limit)
    result = await db.execute(query)
    rows = result.scalars().all()
    if assessment_scope:
        rows = [
            row for row in rows
            if (dict(row.payload or {}).get("assessment_scope") or DEFAULT_ASSESSMENT_SCOPE) == assessment_scope
        ]
    return {
        "sessions": [_session_metadata_from_row(row) for row in rows],
        "limit": limit,
        "status": status,
        "assessment_scope": assessment_scope,
    }


async def get_session(db: AsyncSession, session_id: str) -> dict[str, Any]:
    result = await db.execute(select(AssessmentV2Session).where(AssessmentV2Session.id == uuid.UUID(session_id)))
    row = result.scalar_one_or_none()
    if row is None:
        raise KeyError(f"Assessment V2 session {session_id} not found")
    if row.status == "completed":
        return await get_result(db, session_id)
    return _session_response_from_row(row)


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
    learning_loop = _learning_loop(payload, summary)
    return {
        "session_id": str(row.id),
        "session_code": row.session_code,
        "status": row.status,
        "assessment_scope": payload.get("assessment_scope") or DEFAULT_ASSESSMENT_SCOPE,
        "max_questions": row.max_questions,
        "summary": summary,
        "learning_loop": learning_loop,
        "responses": payload.get("responses", []),
        "run": run.to_dict(),
    }


async def get_learning_loop(db: AsyncSession, session_id: str) -> dict[str, Any]:
    result = await get_result(db, session_id)
    return {
        "session_id": result["session_id"],
        "session_code": result["session_code"],
        "learning_loop": result["learning_loop"],
    }


async def submit_mastery_response(
    db: AsyncSession,
    session_id: str,
    answer: Any = None,
) -> dict[str, Any]:
    result = await db.execute(select(AssessmentV2Session).where(AssessmentV2Session.id == uuid.UUID(session_id)))
    row = result.scalar_one_or_none()
    if row is None:
        raise KeyError(f"Assessment V2 session {session_id} not found")

    payload = dict(row.payload or {})
    run = _run_from_payload(payload)
    summary = _student_summary(run, list(payload.get("nodes", [])))
    learning_loop = _learning_loop(payload, summary)
    recommendation = learning_loop.get("recommendation")
    lesson = learning_loop.get("lesson") or {}
    mastery = lesson.get("mastery") or {}
    accepted = [str(value) for value in mastery.get("accepted_answers", [])]
    answer_text = _normalize_student_answer(answer)
    is_correct = _answers_equivalent(answer_text, accepted)

    check = {
        "step": len(learning_loop.get("mastery_checks") or []) + 1,
        "submitted_at": _now_iso(),
        "answer": answer_text,
        "accepted_answers": accepted,
        "correct": is_correct,
        "lesson_id": lesson.get("lesson_id"),
        "target_kc_id": (recommendation or {}).get("kc_id"),
        "target_kc_code": (recommendation or {}).get("code"),
    }
    learning_loop["mastery_checks"] = [*list(learning_loop.get("mastery_checks") or []), check]
    learning_loop["mastery_status"] = "passed" if is_correct else "needs_more_practice"
    learning_loop["updated_at"] = _now_iso()

    if is_correct and recommendation and recommendation.get("kc_id") in run.states:
        kc_id = str(recommendation["kc_id"])
        state = run.states[kc_id]
        before = state.p_mastery
        state.p_mastery = max(state.p_mastery, 0.92)
        state.direct_evidence_count += 1
        state.correct_count += 1
        run.evidence_by_kc.setdefault(kc_id, []).append({
            "context": "mastery_check",
            "lesson_id": lesson.get("lesson_id"),
            "correct": True,
            "student_answer": answer_text,
            "p_mastery_before": round(before, 4),
            "p_mastery_after_direct": round(state.p_mastery, 4),
        })
        run.state_transitions.append({
            "step": len(run.state_transitions) + 1,
            "item_id": f"mastery:{lesson.get('lesson_id')}",
            "kc_id": kc_id,
            "correct": True,
            "changes": [{
                "kc_id": kc_id,
                "from_p_mastery": round(before, 4),
                "to_p_mastery": round(state.p_mastery, 4),
                "reason": "learning_loop_mastery_check_passed",
            }],
        })

    payload["run"] = run.to_dict()
    payload["learning_loop"] = learning_loop
    row.payload = payload
    row.updated_at = _now()
    await db.commit()
    await db.refresh(row)
    updated = await get_result(db, session_id)
    updated["mastery_check"] = check
    return updated


async def get_review(db: AsyncSession, session_id: str) -> dict[str, Any]:
    result = await get_result(db, session_id)
    payload_result = await db.execute(select(AssessmentV2Session).where(AssessmentV2Session.id == uuid.UUID(session_id)))
    row = payload_result.scalar_one_or_none()
    payload = dict(row.payload or {}) if row is not None else {}
    teacher_review = _teacher_review_payload(result, payload)
    result["audit"] = {
        "frontier_history": result["run"].get("frontier_history", []),
        "state_transitions": result["run"].get("state_transitions", []),
        "evidence_by_kc": result["run"].get("evidence_by_kc", {}),
        "teacher_review": teacher_review,
    }
    return result


def _teacher_review_payload(result: dict[str, Any], payload: dict[str, Any]) -> dict[str, Any]:
    nodes = {node["id"]: node for node in payload.get("nodes", [])}
    run = result.get("run", {})
    responses = result.get("responses", [])
    frontier_history = run.get("frontier_history", [])
    state_transitions = run.get("state_transitions", [])
    states = run.get("states", {})

    frontier_by_item = {
        entry.get("selected_item"): entry
        for entry in frontier_history
        if entry.get("selected_item")
    }
    changes_by_kc: dict[str, list[dict[str, Any]]] = {}
    for transition in state_transitions:
        for change in transition.get("changes", []) or []:
            kc_id = str(change.get("kc_id") or "")
            if kc_id:
                changes_by_kc.setdefault(kc_id, []).append({**change, "source_kc": transition.get("kc_id"), "source_item": transition.get("item_id")})

    selection_steps = []
    for response in responses:
        item = response.get("item") or {}
        frontier = frontier_by_item.get(item.get("item_id")) or {}
        candidate = next(
            (row for row in frontier.get("top_candidates", []) or [] if row.get("item_id") == item.get("item_id")),
            (frontier.get("top_candidates") or [{}])[0],
        )
        selection_steps.append({
            "step": response.get("step"),
            "item_id": item.get("item_id"),
            "kc_id": item.get("kc_id"),
            "kc_code": item.get("kc_code"),
            "kc_name": item.get("kc_name"),
            "target_exam_path": item.get("target_exam_path"),
            "item_role": item.get("item_role"),
            "item_family": item.get("item_family"),
            "correct": (response.get("grading") or {}).get("is_correct"),
            "response_type": response.get("response_type"),
            "selection_reason": _selection_reason_text(frontier, candidate, response),
            "selector_policy": frontier.get("selector_policy"),
            "deep_dive_reason": frontier.get("deep_dive_reason"),
            "expected_gain": candidate.get("expected_gain"),
            "gain_if_correct": candidate.get("gain_if_correct"),
            "gain_if_wrong": candidate.get("gain_if_wrong"),
            "candidate_pool": frontier.get("candidate_pool"),
            "skipped_candidates": frontier.get("skipped_candidates", []),
        })

    node_explanations = {}
    response_by_kc = {
        (response.get("item") or {}).get("kc_id"): response
        for response in responses
    }
    for kc_id, state in states.items():
        node = nodes.get(kc_id, {})
        response = response_by_kc.get(kc_id)
        changes = changes_by_kc.get(kc_id, [])
        node_explanations[kc_id] = {
            "kc_id": kc_id,
            "kc_code": node.get("code"),
            "kc_name": node.get("name"),
            "final_state": state.get("label"),
            "p_mastery": state.get("p_mastery"),
            "probability_band": state.get("probability_band"),
            "direct_evidence_count": state.get("direct_evidence_count"),
            "inferred_evidence_count": state.get("inferred_evidence_count"),
            "reason_text": _node_reason_text(state, response, changes),
            "latest_change": changes[-1] if changes else None,
            "direct_step": response.get("step") if response else None,
        }

    path_summaries: dict[str, dict[str, Any]] = {}
    for step in selection_steps:
        path = step.get("target_exam_path") or "unknown_path"
        summary = path_summaries.setdefault(path, {
            "target_exam_path": path,
            "tested_nodes": [],
            "likely_blockers": [],
            "ready_to_learn": [],
            "selection_steps": 0,
        })
        summary["selection_steps"] += 1
        if step.get("kc_code") and step["kc_code"] not in summary["tested_nodes"]:
            summary["tested_nodes"].append(step["kc_code"])
        if step.get("correct") is False and step.get("kc_code") and step["kc_code"] not in summary["likely_blockers"]:
            summary["likely_blockers"].append(step["kc_code"])

    for row in result.get("summary", {}).get("ready_to_learn", []) or []:
        path = "unknown_path"
        for step in selection_steps:
            if step.get("kc_id") == row.get("kc_id") and step.get("target_exam_path"):
                path = step["target_exam_path"]
                break
        path_summaries.setdefault(path, {
            "target_exam_path": path,
            "tested_nodes": [],
            "likely_blockers": [],
            "ready_to_learn": [],
            "selection_steps": 0,
        })["ready_to_learn"].append(row.get("code") or row.get("kc_id"))

    return {
        "selection_steps": selection_steps,
        "node_explanations": node_explanations,
        "path_summaries": list(path_summaries.values()),
    }


def _selection_reason_text(frontier: dict[str, Any], candidate: dict[str, Any], response: dict[str, Any]) -> str:
    policy = frontier.get("selector_policy")
    if policy == "grade8_deep_dive":
        previous = frontier.get("deep_dive_reason") or "previous response showed a gap"
        return f"Deep-dive: {previous}. Engine selected this probe before leaving the strand."
    if frontier.get("reason") == "confirmation_after_breadth":
        return "Confirmation: breadth scan found no new higher-value node, so the engine asked another non-duplicate item for a still-uncertain KC."
    if response.get("step") == 1:
        return "Entry point: state-space EIG selected the item expected to split feasible knowledge states best."
    return "State-space EIG: selected because correct/wrong outcomes are expected to reduce uncertainty over the graph."


def _node_reason_text(state: dict[str, Any], response: dict[str, Any] | None, changes: list[dict[str, Any]]) -> str:
    label = state.get("label")
    if response:
        if response.get("response_type") == "unknown":
            return f"Direct evidence from question {response.get('step')}: student selected I don't know."
        is_correct = (response.get("grading") or {}).get("is_correct")
        return f"Direct evidence from question {response.get('step')}: student answered {'correctly' if is_correct else 'incorrectly'}."
    if changes:
        latest = changes[-1]
        reason = str(latest.get("reason") or "")
        if reason.startswith("state_space_particle_update"):
            return "Inferred from the feasible knowledge-state posterior after previous answers."
        if "strong_open_requires" in reason:
            return "Inferred stronger because the student answered a reviewed open-ended item requiring this KC."
        if "strong_open_diagnoses" in reason:
            return "Possibly affected because a reviewed open-ended wrong answer diagnosed this KC."
        return f"Inferred from graph/state transition: {reason}."
    if label == "unknown":
        return "No direct or strong inferred evidence in this session."
    return "State assigned by current mastery probability thresholds."
