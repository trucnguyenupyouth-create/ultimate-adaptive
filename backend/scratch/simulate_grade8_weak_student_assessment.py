#!/usr/bin/env python3
"""Run deterministic Grade 8 official-path simulations for a very weak student.

No production writes. The script reads the current production graph so the V2
state-space selector sees real prerequisite edges, then uses local draft items.
"""

from __future__ import annotations

import asyncio
import json
import os
import random
import sys
from pathlib import Path
from typing import Any

from sqlalchemy import text
from sqlalchemy.ext.asyncio import create_async_engine

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / "backend"))

from app.engines.assessment_v2.diagnostic_engine import (  # noqa: E402
    DiagnosticItem,
    DiagnosticResponse,
    V2DiagnosticEngine,
)

ITEMS_JSON = ROOT / "docs" / "grade8_exam_path_official_item_drafts.json"
SCOPE_JSON = ROOT / "docs" / "grade8_exam_scope.json"
MAX_QUESTIONS = 35


def _load_env() -> None:
    env_path = ROOT / "backend" / ".env"
    if not env_path.exists():
        return
    for line in env_path.read_text(encoding="utf-8").splitlines():
        if "=" in line and not line.strip().startswith("#"):
            key, value = line.split("=", 1)
            os.environ.setdefault(key.strip(), value.strip().strip('"').strip("'"))


async def _load_production_graph() -> tuple[list[dict[str, Any]], list[dict[str, Any]], dict[str, str]]:
    _load_env()
    scope = json.loads(SCOPE_JSON.read_text(encoding="utf-8"))
    scope_codes = set(scope.get("reportable_scope_codes") or [])
    scope_codes.update(scope.get("support_scope_codes") or [])
    if not scope_codes:
        raise RuntimeError("Grade 8 simulation scope is empty.")
    engine = create_async_engine(
        os.environ["DATABASE_URL"],
        echo=False,
        connect_args={"statement_cache_size": 0, "prepared_statement_cache_size": 0},
    )
    async with engine.connect() as conn:
        node_rows = await conn.execute(
            text(
                """
                select id::text, code, name, grade
                from knowledge_components
                where code = any(:codes)
                """
            ),
            {"codes": sorted(scope_codes)},
        )
        nodes = [dict(row._mapping) for row in node_rows]
        node_ids = {node["id"] for node in nodes}
        missing_codes = sorted(scope_codes - {node["code"] for node in nodes})
        if missing_codes:
            raise RuntimeError(f"Missing scope KCs in production DB: {missing_codes}")

        edge_rows = await conn.execute(
            text(
                """
                select prereq_id::text as source, kc_id::text as target, edge_type
                from kc_prerequisites
                where edge_type = 'prerequisite'
                """
            )
        )
        edges = [
            dict(row._mapping)
            for row in edge_rows
            if row._mapping["source"] in node_ids and row._mapping["target"] in node_ids
        ]
    await engine.dispose()
    names = {node["id"]: f'{node["code"]} — {node["name"]}' for node in nodes}
    return nodes, edges, names


def _load_items(strong_reviewed: bool) -> list[DiagnosticItem]:
    raw_items = json.loads(ITEMS_JSON.read_text(encoding="utf-8"))["items"]
    items: list[DiagnosticItem] = []
    for raw in raw_items:
        content = dict(raw)
        if strong_reviewed:
            content["academic_reviewed"] = True
            content["inference_strength"] = "strong" if raw.get("item_role") in {"anchor", "misconception", "bridge"} else "medium"
        widget = raw.get("answer_widget") or raw.get("answer_type") or "short_text"
        fmt = "open" if widget in {"number", "decimal", "fraction", "coordinate_pair", "ordered_pair_list"} else "open_short"
        items.append(
            DiagnosticItem(
                id=raw["review_id"],
                kc_id=raw["kc_id"],
                format_type=fmt,
                difficulty_label=raw.get("item_role") or raw.get("difficulty_label", "medium"),
                is_diagnostic_anchor=raw.get("item_role") == "anchor",
                content=content,
            )
        )
    return items


def _answer_for_persona(item: DiagnosticItem, rng: random.Random, *, force_wrong: bool) -> DiagnosticResponse:
    role = item.content.get("item_role", "")
    family = item.content.get("item_family", "")

    # A very weak student may still answer some low-root, recognition-like tasks.
    simple_known = {
        "percent_to_decimal",
        "identify_slope_in_y_ax_plus_b",
        "compute_remaining_amount",
    }
    p_correct = 0.35 if family in simple_known else 0.03
    p_unknown = 0.20 if force_wrong else 0.58

    draw = rng.random()
    if draw < p_unknown:
        return DiagnosticResponse(
            item_id=item.id,
            correct=False,
            student_answer="I don't know",
            response_type="unknown",
        )
    if draw < p_unknown + p_correct:
        answer = (item.content.get("accepted_answers") or ["correct"])[0]
        return DiagnosticResponse(item_id=item.id, correct=True, student_answer=answer)

    wrong_patterns = item.content.get("common_wrong_patterns") or []
    wrong_answer = wrong_patterns[0]["pattern"] if wrong_patterns else "wrong"
    return DiagnosticResponse(item_id=item.id, correct=False, student_answer=wrong_answer)


def _summarize(run: Any, names: dict[str, str], steps: list[dict[str, Any]]) -> dict[str, Any]:
    labels: dict[str, list[str]] = {}
    for kc_id, state in run.states.items():
        labels.setdefault(state.label, []).append(kc_id)
    direct_gaps = labels.get("tested_gap", [])
    inferred_gaps = labels.get("inferred_gap", [])
    direct_mastered = labels.get("tested_mastered", [])
    inferred_mastered = labels.get("inferred_mastered", [])
    unknown = labels.get("unknown", [])
    bands: dict[str, int] = {}
    for state in run.states.values():
        bands[state.probability_band] = bands.get(state.probability_band, 0) + 1
    item_ids = [step["item_id"] for step in steps]
    surfaces = [step.get("surface_signature") for step in steps if step.get("surface_signature")]
    code_by_kc = {kc_id: names.get(kc_id, kc_id).split(" — ")[0] for kc_id in run.states}

    def grade_of_kc(kc_id: str) -> str:
        code = code_by_kc.get(kc_id, "")
        if code.startswith("G6"):
            return "G6"
        if code.startswith("G7"):
            return "G7"
        if code.startswith("G8"):
            return "G8"
        return "unknown"

    foundation_step_count = sum(1 for step in steps if grade_of_kc(step["kc_id"]) in {"G6", "G7"})
    foundation_tested = [kc_id for kc_id in run.tested_order if grade_of_kc(kc_id) in {"G6", "G7"}]
    foundation_confirmed = [
        kc_id
        for kc_id in foundation_tested
        if run.states[kc_id].direct_evidence_count >= 2
    ]

    return {
        "scope_nodes": len(run.states),
        "questions": len(steps),
        "unknown_responses": sum(1 for step in steps if step["response_type"] == "unknown"),
        "wrong_attempts": sum(1 for step in steps if step["response_type"] == "answer" and not step["correct"]),
        "correct": sum(1 for step in steps if step["correct"]),
        "tested_kcs": len(run.tested_order),
        "tested_gap": len(direct_gaps),
        "tested_mastered": len(direct_mastered),
        "inferred_gap": len(inferred_gaps),
        "inferred_mastered": len(inferred_mastered),
        "unknown_nodes": len(unknown),
        "deep_dive_steps": sum(1 for step in steps if step.get("selector_policy") == "grade8_deep_dive"),
        "root_cause_steps": sum(1 for step in steps if step.get("selector_policy") == "grade8_root_cause"),
        "foundation_questions": foundation_step_count,
        "foundation_question_ratio": round(foundation_step_count / max(len(steps), 1), 4),
        "foundation_tested_kcs": len(foundation_tested),
        "foundation_confirmed_kcs": len(foundation_confirmed),
        "duplicate_item_count": len(item_ids) - len(set(item_ids)),
        "duplicate_surface_count": len(surfaces) - len(set(surfaces)),
        "bands": bands,
        "gap_examples": [names.get(kc, kc) for kc in (direct_gaps + inferred_gaps)[:12]],
        "mastered_examples": [names.get(kc, kc) for kc in (direct_mastered + inferred_mastered)[:8]],
    }


def _run_case(
    *,
    label: str,
    nodes: list[dict[str, Any]],
    edges: list[dict[str, Any]],
    names: dict[str, str],
    strong_reviewed: bool,
    force_wrong: bool,
) -> dict[str, Any]:
    items = _load_items(strong_reviewed=strong_reviewed)
    engine = V2DiagnosticEngine(nodes=nodes, edges=edges, items=items, mode="assessment")
    run = engine.new_run()
    rng = random.Random(20260705 + int(strong_reviewed) * 17 + int(force_wrong) * 41)
    steps: list[dict[str, Any]] = []

    for step_no in range(1, MAX_QUESTIONS + 1):
        item = engine.select_next(run)
        if item is None:
            break
        response = _answer_for_persona(item, rng, force_wrong=force_wrong)
        engine.apply_response(run, item, response)
        frontier = run.frontier_history[-1]
        steps.append(
            {
                "step": step_no,
                "item_id": item.id,
                "kc_id": item.kc_id,
                "kc": names.get(item.kc_id, item.kc_id),
                "family": item.content.get("item_family"),
                "surface_signature": item.content.get("surface_signature"),
                "role": item.content.get("item_role"),
                "correct": response.correct,
                "response_type": response.response_type,
                "answer": response.student_answer,
                "reason": frontier.get("reason"),
                "selector_policy": frontier.get("selector_policy"),
                "deep_dive_reason": frontier.get("deep_dive_reason"),
                "expected_gain": frontier["top_candidates"][0].get("expected_gain"),
                "p_correct_selector": frontier["top_candidates"][0].get("p_correct"),
            }
        )

    summary = _summarize(run, names, steps)
    return {"case": label, "summary": summary, "steps": steps}


async def main() -> int:
    nodes, edges, names = await _load_production_graph()
    cases = [
        _run_case(
            label="draft_safe_many_unknown",
            nodes=nodes,
            edges=edges,
            names=names,
            strong_reviewed=False,
            force_wrong=False,
        ),
        _run_case(
            label="draft_safe_forced_wrong",
            nodes=nodes,
            edges=edges,
            names=names,
            strong_reviewed=False,
            force_wrong=True,
        ),
        _run_case(
            label="reviewed_strong_many_unknown",
            nodes=nodes,
            edges=edges,
            names=names,
            strong_reviewed=True,
            force_wrong=False,
        ),
        _run_case(
            label="reviewed_strong_forced_wrong",
            nodes=nodes,
            edges=edges,
            names=names,
            strong_reviewed=True,
            force_wrong=True,
        ),
    ]

    out = ROOT / "docs" / "grade8_weak_student_simulation_report.json"
    out.write_text(json.dumps(cases, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    for case in cases:
        print("\n==", case["case"], "==")
        print(json.dumps(case["summary"], ensure_ascii=False, indent=2))
        print("First 12 steps:")
        for step in case["steps"][:12]:
            print(
                f"{step['step']:02d}. {step['item_id']} | {step['role']} | "
                f"{step['family']} | {step['response_type']} | correct={step['correct']} | "
                f"gain={step['expected_gain']} | {step['kc']}"
            )
    print(f"\nWrote {out}")
    return 0


if __name__ == "__main__":
    raise SystemExit(asyncio.run(main()))
