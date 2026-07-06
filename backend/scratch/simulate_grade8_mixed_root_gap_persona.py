#!/usr/bin/env python3
"""Simulate a realistic mixed Grade 8 root-gap persona.

This is a deterministic no-AI simulation. The persona is intentionally not
all-wrong: the student has many Grade 6-7 gaps, but still knows scattered
recognition and simple substitution skills from Grades 6-8.
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

from app.engines.assessment_v2.diagnostic_engine import DiagnosticItem, DiagnosticResponse, V2DiagnosticEngine  # noqa: E402


ITEMS_JSON = ROOT / "docs" / "grade8_exam_path_official_item_drafts.json"
SCOPE_JSON = ROOT / "docs" / "grade8_exam_scope.json"
OUT_JSON = ROOT / "docs" / "grade8_mixed_root_gap_persona_report.json"
OUT_MD = ROOT / "docs" / "grade8_mixed_root_gap_persona_report.md"
MAX_QUESTIONS = 35


MASTERED_CODES = {
    # Scattered Grade 6 basics still retained.
    "G6-MATH-NHAN-BIET-DOC",
    "G6-MATH-NHAN-BIET-SO-1",
    "G6-MATH-CONG-HAI-SO",
    "G6-MATH-CONG-HAI-SO-1",
    "G6-MATH-NHAN-HAI-SO-1",
    "G6-MATH-B31K2",
    # The student can read simple algebra and model a simple remainder.
    "G7-MATH-NHAN-BIET-BIEU",
    "G7-MATH-VIET-BIEU-THUC",
    # Scattered Grade 8 recognition learned by memorization.
    "G8-MATH-TINH-GIA-TRI",
    "G8-MATH-NHAN-BIET-HAM",
    "G8-MATH-TINH-HOAC-XAC",
}

PARTIAL_CODES = {
    # Can sometimes execute simple procedures but is fragile with signs/fractions.
    "G6-MATH-TU-CHO-SO",
    "G6-MATH-NHAN-HAI-SO",
    "G6-MATH-THUC-HIEN-PHEP",
    "G6-MATH-BO-DAU-NGOAC",
    "G6-MATH-PHAN-PHOI-NHAN",
    "G6-MATH-TIM-GIA-TRI-1",
    "G7-MATH-KHAI-NIEM-DANG",
    "G7-MATH-TINH-GIA-TRI-1",
    "G8-MATH-BIEU-DIEN-DIEM",
    "G8-MATH-NHAN-BIET-PHUONG",
}


def _load_env() -> None:
    env_path = ROOT / "backend" / ".env"
    if not env_path.exists():
        return
    for line in env_path.read_text(encoding="utf-8").splitlines():
        if "=" in line and not line.strip().startswith("#"):
            key, value = line.split("=", 1)
            os.environ.setdefault(key.strip(), value.strip().strip('"').strip("'"))


async def _load_graph() -> tuple[list[dict[str, Any]], list[dict[str, Any]], dict[str, str], dict[str, str]]:
    _load_env()
    scope = json.loads(SCOPE_JSON.read_text(encoding="utf-8"))
    scope_codes = set(scope["reportable_scope_codes"])
    engine = create_async_engine(
        os.environ["DATABASE_URL"],
        echo=False,
        connect_args={"statement_cache_size": 0, "prepared_statement_cache_size": 0},
    )
    try:
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
    finally:
        await engine.dispose()
    names = {node["id"]: f'{node["code"]} — {node["name"]}' for node in nodes}
    codes_by_id = {node["id"]: node["code"] for node in nodes}
    return nodes, edges, names, codes_by_id


def _load_items() -> list[DiagnosticItem]:
    raw_items = json.loads(ITEMS_JSON.read_text(encoding="utf-8"))["items"]
    items: list[DiagnosticItem] = []
    for raw in raw_items:
        content = dict(raw)
        content["academic_reviewed"] = True
        content["inference_strength"] = "strong" if raw.get("item_role") in {"anchor", "misconception", "bridge"} else "medium"
        widget = raw.get("answer_widget") or raw.get("answer_type") or "short_text"
        fmt = "open" if widget in {"number", "decimal", "fraction", "coordinate_pair", "ordered_pair_list"} else "open_short"
        items.append(DiagnosticItem(
            id=raw["review_id"],
            kc_id=raw["kc_id"],
            format_type=fmt,
            difficulty_label=raw.get("item_role") or raw.get("difficulty_label", "medium"),
            is_diagnostic_anchor=raw.get("item_role") == "anchor",
            content=content,
        ))
    return items


def _truth_for_code(code: str) -> str:
    if code in MASTERED_CODES:
        return "mastered"
    if code in PARTIAL_CODES:
        return "partial"
    return "gap"


def _answer_for_persona(item: DiagnosticItem, code: str, step_no: int, rng: random.Random) -> DiagnosticResponse:
    truth = _truth_for_code(code)
    family = str(item.content.get("item_family") or "")

    if truth == "mastered":
        p_unknown = 0.03
        p_correct = 0.84
        if family in {"identify_slope_in_y_ax_plus_b", "identify_variable_in_algebraic_expression", "write_negative_integer_context"}:
            p_correct = 0.94
    elif truth == "partial":
        p_unknown = 0.18
        p_correct = 0.48
        if family in {"expand_coefficient_parentheses", "distribute_number_over_sum"}:
            p_correct = 0.38
    else:
        p_unknown = 0.42
        p_correct = 0.08
        if family in {"recognize_valid_fraction_parts", "identify_polynomial_terms"}:
            p_correct = 0.18

    draw = rng.random()
    if draw < p_unknown:
        return DiagnosticResponse(item_id=item.id, correct=False, student_answer="I don't know", response_type="unknown")
    if draw < p_unknown + p_correct:
        answer = str((item.content.get("accepted_answers") or ["correct"])[0])
        return DiagnosticResponse(item_id=item.id, correct=True, student_answer=answer)

    wrong_patterns = item.content.get("common_wrong_patterns") or []
    wrong_answer = str(wrong_patterns[0]["pattern"]) if wrong_patterns else "wrong"
    return DiagnosticResponse(item_id=item.id, correct=False, student_answer=wrong_answer)


def _grade_from_code(code: str) -> str:
    if code.startswith("G6"):
        return "G6"
    if code.startswith("G7") or code == "G9-MATH-NHAN-BIET-SO-1":
        return "G7"
    if code.startswith("G8"):
        return "G8"
    return "unknown"


def _metrics(run: Any, codes_by_id: dict[str, str]) -> dict[str, Any]:
    truth_gap = {kc for kc, code in codes_by_id.items() if _truth_for_code(code) == "gap"}
    truth_mastered = {kc for kc, code in codes_by_id.items() if _truth_for_code(code) == "mastered"}
    truth_partial = {kc for kc, code in codes_by_id.items() if _truth_for_code(code) == "partial"}
    predicted_gap = {kc for kc, state in run.states.items() if state.label in {"tested_gap", "inferred_gap"}}
    predicted_mastered = {kc for kc, state in run.states.items() if state.label in {"tested_mastered", "inferred_mastered"}}
    direct_gap = {kc for kc, state in run.states.items() if state.label == "tested_gap"}
    direct_mastered = {kc for kc, state in run.states.items() if state.label == "tested_mastered"}

    def pr(predicted: set[str], actual: set[str]) -> dict[str, Any]:
        tp = len(predicted & actual)
        fp = len(predicted - actual)
        fn = len(actual - predicted)
        return {
            "tp": tp,
            "fp": fp,
            "fn": fn,
            "precision": round(tp / max(tp + fp, 1), 4),
            "recall": round(tp / max(tp + fn, 1), 4),
        }

    tested = set(run.tested_order)
    foundation_tested = {kc for kc in tested if _grade_from_code(codes_by_id[kc]) in {"G6", "G7"}}
    confirmed = {kc for kc in tested if run.states[kc].direct_evidence_count >= 2}
    labels = {}
    bands = {}
    for state in run.states.values():
        labels[state.label] = labels.get(state.label, 0) + 1
        bands[state.probability_band] = bands.get(state.probability_band, 0) + 1

    return {
        "truth_counts": {
            "mastered": len(truth_mastered),
            "partial": len(truth_partial),
            "gap": len(truth_gap),
        },
        "label_counts": labels,
        "band_counts": bands,
        "tested_kcs": len(tested),
        "foundation_tested_kcs": len(foundation_tested),
        "confirmed_tested_kcs": len(confirmed),
        "direct_gap_metrics_against_true_gap": pr(direct_gap, truth_gap),
        "all_gap_metrics_against_true_gap": pr(predicted_gap, truth_gap),
        "direct_mastery_metrics_against_true_mastered": pr(direct_mastered, truth_mastered),
        "all_mastery_metrics_against_true_mastered": pr(predicted_mastered, truth_mastered),
        "partial_marked_gap": len(predicted_gap & truth_partial),
        "partial_marked_mastered": len(predicted_mastered & truth_partial),
    }


def _write_markdown(report: dict[str, Any]) -> None:
    summary = report["summary"]
    metrics = report["metrics"]
    lines = [
        "# Grade 8 Mixed Root-Gap Persona Simulation",
        "",
        "## Persona Ground Truth",
        "",
        "This simulated student has many Grade 6-7 root gaps, but not zero knowledge.",
        "",
        "- Knows scattered basics: negative integer notation, integer opposites, simple integer addition, percent-to-decimal, reading variables, simple `total - x`, identifying slope in `y=ax+b`, simple function value.",
        "- Partial/fragile: integer subtraction, opposite-sign multiplication/division, simple parentheses/distribution, percent-of-number, equality concept, expression value, plotting points, recognizing equations.",
        "- Gaps: fraction equivalence/common denominator/operations, rational expressions, polynomial manipulation, equation solving, most graph construction and parameter reasoning.",
        "",
        "## Quantitative Outcome",
        "",
        f"- Questions used: **{summary['questions']}**",
        f"- Correct / wrong / unknown: **{summary['correct']} / {summary['wrong_attempts']} / {summary['unknown_responses']}**",
        f"- Tested KCs: **{metrics['tested_kcs']}**",
        f"- Foundation KCs tested: **{metrics['foundation_tested_kcs']}**",
        f"- Confirmed tested KCs with 2 direct items: **{metrics['confirmed_tested_kcs']}**",
        f"- Duplicate item / surface: **{summary['duplicate_item_count']} / {summary['duplicate_surface_count']}**",
        "",
        "## Accuracy Against Persona Truth",
        "",
        f"- Truth counts: `{metrics['truth_counts']}`",
        f"- Engine label counts: `{metrics['label_counts']}`",
        f"- Direct gap precision/recall: `{metrics['direct_gap_metrics_against_true_gap']}`",
        f"- All gap precision/recall, including inferred: `{metrics['all_gap_metrics_against_true_gap']}`",
        f"- Direct mastery precision/recall: `{metrics['direct_mastery_metrics_against_true_mastered']}`",
        f"- All mastery precision/recall, including inferred: `{metrics['all_mastery_metrics_against_true_mastered']}`",
        f"- Partial nodes marked gap/mastered: **{metrics['partial_marked_gap']} / {metrics['partial_marked_mastered']}**",
        "",
        "## Question Path",
        "",
        "| # | KC | Truth | Role | Family | Response | Student answer | Why selected |",
        "|---|---|---|---|---|---|---|---|",
    ]
    for step in report["steps"]:
        answer = str(step["answer"]).replace("|", "/")
        reason = str(step.get("selector_policy") or "").replace("|", "/")
        lines.append(
            f"| {step['step']} | `{step['kc_code']}` | {step['truth']} | {step['role']} | {step['family']} | "
            f"{'correct' if step['correct'] else step['response_type']} | {answer} | {reason} |"
        )
    lines.extend([
        "",
        "## Qualitative Judgment",
        "",
        report["qualitative_judgment"],
        "",
    ])
    OUT_MD.write_text("\n".join(lines), encoding="utf-8")


async def main() -> int:
    nodes, edges, names, codes_by_id = await _load_graph()
    engine = V2DiagnosticEngine(nodes=nodes, edges=edges, items=_load_items(), mode="assessment")
    run = engine.new_run()
    rng = random.Random(20260706)
    steps: list[dict[str, Any]] = []

    for step_no in range(1, MAX_QUESTIONS + 1):
        item = engine.select_next(run)
        if item is None:
            break
        code = codes_by_id[item.kc_id]
        response = _answer_for_persona(item, code, step_no, rng)
        engine.apply_response(run, item, response)
        frontier = run.frontier_history[-1]
        steps.append({
            "step": step_no,
            "item_id": item.id,
            "kc_id": item.kc_id,
            "kc_code": code,
            "kc": names.get(item.kc_id, item.kc_id),
            "truth": _truth_for_code(code),
            "family": item.content.get("item_family"),
            "role": item.content.get("item_role"),
            "question": item.content.get("question"),
            "accepted_answers": item.content.get("accepted_answers"),
            "correct": response.correct,
            "response_type": response.response_type,
            "answer": response.student_answer,
            "selector_policy": frontier.get("selector_policy"),
            "deep_dive_reason": frontier.get("deep_dive_reason"),
            "expected_gain": frontier["top_candidates"][0].get("expected_gain"),
            "p_mastery_after": round(run.states[item.kc_id].p_mastery, 4),
        })

    summary = {
        "questions": len(steps),
        "correct": sum(1 for step in steps if step["correct"]),
        "wrong_attempts": sum(1 for step in steps if step["response_type"] == "answer" and not step["correct"]),
        "unknown_responses": sum(1 for step in steps if step["response_type"] == "unknown"),
        "duplicate_item_count": len([s["item_id"] for s in steps]) - len({s["item_id"] for s in steps}),
        "duplicate_surface_count": len([s["family"] for s in steps]) - len({(s["family"], s["question"]) for s in steps}),
    }
    metrics = _metrics(run, codes_by_id)
    qualitative = (
        "The run behaves like a root-cause diagnostic rather than a Grade 8 scan: it spends most of the budget on "
        "Grade 6-7 foundations after early misses, while still preserving a few mastered scattered skills. The main "
        "risk is that broad graph inference can over-label some partial skills as gaps when the persona is fragile but "
        "not completely missing the skill. Teacher-facing output should therefore separate direct tested gaps from "
        "inferred possibly affected nodes."
    )
    report = {
        "persona": {
            "mastered_codes": sorted(MASTERED_CODES),
            "partial_codes": sorted(PARTIAL_CODES),
            "gap_rule": "all other scope codes",
        },
        "summary": summary,
        "metrics": metrics,
        "steps": steps,
        "qualitative_judgment": qualitative,
    }
    OUT_JSON.write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding="utf-8")
    _write_markdown(report)
    print(json.dumps({"summary": summary, "metrics": metrics, "out_json": str(OUT_JSON), "out_md": str(OUT_MD)}, ensure_ascii=False, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(asyncio.run(main()))
