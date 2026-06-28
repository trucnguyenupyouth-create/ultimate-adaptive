#!/usr/bin/env python3
"""
Assessment V2 — Grade 6 Algebra deterministic report.

No AI calls and no production writes. Uses:
  - /tmp/g6_kc_graph.json
  - backend/data/assessment_v2_review/review_items.json

Outputs:
  - docs/assessment_v2_g6_algebra_deterministic_report.md
  - docs/assessment_v2_g6_algebra_deterministic_report.json
"""

from __future__ import annotations

import json
import random
import sys
from collections import Counter, defaultdict
from dataclasses import asdict
from pathlib import Path
from typing import Any

ROOT = Path(__file__).resolve().parents[1]
REPO = ROOT.parent
sys.path.insert(0, str(ROOT))

from app.engines.assessment_v2.diagnostic_engine import (  # noqa: E402
    DiagnosticItem,
    DiagnosticResponse,
    V2DiagnosticEngine,
)
from app.engines.assessment_v2.strand_scope import (  # noqa: E402
    STRAND_G6_ALGEBRA,
    STRAND_G6_GEOMETRY_DEFERRED,
    STRAND_REVIEW_REQUIRED,
    algebra_scope_ids,
    propose_g6_strands,
)
from app.services.assessment_v2_review_service import enrich_review_item  # noqa: E402


ITEMS_JSON = ROOT / "data" / "assessment_v2_review" / "review_items.json"
GRAPH_JSON = Path("/tmp/g6_kc_graph.json")
REPORT_MD = REPO / "docs" / "assessment_v2_g6_algebra_deterministic_report.md"
REPORT_JSON = REPO / "docs" / "assessment_v2_g6_algebra_deterministic_report.json"

RNG_SEED = 20260626
CAPS = (30, 35)

STRONG_ITEM_IDS = {
    "v2-003",
    "v2-005",
    "v2-010",
    "v2-013",
    "v2-028",
    "v2-030",
    "v2-032",
    "v2-033",
    "v2-044",
}

PERSONAS = {
    "mastered_all": {"gap_clusters": set(), "slip": 0.0, "guess": 0.04},
    "careless_mastered": {"gap_clusters": set(), "slip": 0.18, "guess": 0.04},
    "fraction_gap": {"gap_clusters": {"Fractions Equivalence và Operations"}, "slip": 0.08, "guess": 0.04},
    "integer_gap": {"gap_clusters": {"Integers & Order"}, "slip": 0.08, "guess": 0.06},
    "foundation_gap": {
        "gap_clusters": {"Number Foundations & Divisibility", "Fractions Equivalence và Operations"},
        "slip": 0.08,
        "guess": 0.04,
    },
    "random_guesser": {"gap_clusters": "__all__", "slip": 0.08, "guess": 0.04},
}


def load_graph() -> dict[str, Any]:
    if not GRAPH_JSON.exists():
        raise FileNotFoundError(f"Missing graph snapshot: {GRAPH_JSON}")
    return json.loads(GRAPH_JSON.read_text(encoding="utf-8"))


def load_review_items() -> list[dict[str, Any]]:
    raw_items = json.loads(ITEMS_JSON.read_text(encoding="utf-8"))["items"]
    return [enrich_review_item(item) for item in raw_items]


def g6_graph_payload(graph: dict[str, Any]) -> dict[str, Any]:
    nodes = [node for node in graph["nodes"] if int(node.get("grade") or 0) == 6]
    node_ids = {str(node["id"]) for node in nodes}
    edges = [
        edge for edge in graph["edges"]
        if str(edge.get("prereq_id") or edge.get("source")) in node_ids
        and str(edge.get("kc_id") or edge.get("target")) in node_ids
    ]
    return {"nodes": nodes, "edges": edges}


def subgraph_for_scope(graph: dict[str, Any], scope_ids: set[str]) -> tuple[list[dict], list[dict]]:
    nodes = [
        {"id": str(node["id"]), "code": node.get("code", ""), "name": node.get("name", ""), "grade": node.get("grade")}
        for node in graph["nodes"]
        if str(node["id"]) in scope_ids
    ]
    edges = [
        {
            "source": str(edge.get("prereq_id") or edge.get("source")),
            "target": str(edge.get("kc_id") or edge.get("target")),
            "edge_type": edge.get("edge_type", "prerequisite"),
        }
        for edge in graph["edges"]
        if str(edge.get("prereq_id") or edge.get("source")) in scope_ids
        and str(edge.get("kc_id") or edge.get("target")) in scope_ids
    ]
    return nodes, edges


def to_diagnostic_items(items: list[dict[str, Any]], scope_ids: set[str], mode: str) -> list[DiagnosticItem]:
    diagnostic_items: list[DiagnosticItem] = []
    for item in items:
        if item["grader_readiness"] != "ready":
            continue
        if item["kc_id"] not in scope_ids:
            continue

        content = dict(item)
        if mode == "provisional_ready" and item["review_id"] in STRONG_ITEM_IDS:
            content["inference_strength"] = "strong"
            content["academic_reviewed"] = True
        else:
            content["inference_strength"] = "weak"
            content["academic_reviewed"] = False

        answer_type = item.get("answer_type") or "short_text"
        format_type = "open" if answer_type in {"integer", "decimal", "number", "fraction", "ratio", "set"} else "open_short"
        diagnostic_items.append(DiagnosticItem(
            id=item["review_id"],
            kc_id=item["kc_id"],
            format_type=format_type,
            difficulty_label=item.get("difficulty_label") or "medium",
            is_diagnostic_anchor=bool(item.get("is_diagnostic_anchor")),
            content=content,
        ))
    return diagnostic_items


def cluster_kcs(items: list[dict[str, Any]], scope_ids: set[str]) -> dict[str, set[str]]:
    result: dict[str, set[str]] = defaultdict(set)
    for item in items:
        if item["kc_id"] in scope_ids:
            result[item.get("cluster") or "unknown"].add(item["kc_id"])
    return result


def persona_knows_kc(persona: str, kc_id: str, cluster_by_kc: dict[str, str]) -> bool:
    config = PERSONAS[persona]
    if config["gap_clusters"] == "__all__":
        return False
    return cluster_by_kc.get(kc_id) not in config["gap_clusters"]


def sample_correct(persona: str, item: DiagnosticItem, rng: random.Random, cluster_by_kc: dict[str, str]) -> bool:
    config = PERSONAS[persona]
    if persona_knows_kc(persona, item.kc_id, cluster_by_kc):
        return rng.random() > float(config["slip"])
    return rng.random() < float(config["guess"])


def run_once(
    persona: str,
    cap: int,
    mode: str,
    nodes: list[dict],
    edges: list[dict],
    diagnostic_items: list[DiagnosticItem],
    cluster_by_kc: dict[str, str],
) -> dict[str, Any]:
    rng = random.Random(f"{RNG_SEED}:{persona}:{cap}:{mode}")
    engine = V2DiagnosticEngine(nodes=nodes, edges=edges, items=diagnostic_items)
    run = engine.new_run()
    step_log: list[dict[str, Any]] = []

    for step in range(1, cap + 1):
        item = engine.select_next(run)
        if item is None:
            break
        correct = sample_correct(persona, item, rng, cluster_by_kc)
        answer = (item.content.get("accepted_answers") or ["correct"])[0] if correct else "wrong"
        engine.apply_response(run, item, DiagnosticResponse(item_id=item.id, correct=correct, student_answer=answer))
        step_log.append({
            "step": step,
            "item_id": item.id,
            "kc_id": item.kc_id,
            "kc_code": next((n.get("code") for n in nodes if n["id"] == item.kc_id), item.kc_id),
            "cluster": cluster_by_kc.get(item.kc_id, "unknown"),
            "correct": correct,
        })

    states = {kc_id: state.to_dict() for kc_id, state in run.states.items()}
    labels = Counter(state["label"] for state in states.values())
    bands = Counter(state["probability_band"] for state in states.values())
    predicted_gaps = {kc_id for kc_id, state in states.items() if state["label"] in {"tested_gap", "inferred_gap"}}
    gt_gaps = {
        kc_id for kc_id in states
        if not persona_knows_kc(persona, kc_id, cluster_by_kc)
    }
    if persona == "random_guesser":
        gt_gaps = set(states)

    tp = len(predicted_gaps & gt_gaps)
    fp = len(predicted_gaps - gt_gaps)
    fn = len(gt_gaps - predicted_gaps)
    precision = tp / (tp + fp) if tp + fp else None
    recall = tp / (tp + fn) if tp + fn else None
    item_ids = [step["item_id"] for step in step_log]

    def clean_frontier(history: list[dict[str, Any]]) -> list[dict[str, Any]]:
        cleaned = []
        for entry in history:
            row = {key: value for key, value in entry.items() if key != "top_candidates"}
            row["top_candidates"] = [
                {key: value for key, value in candidate.items() if key != "item"}
                for candidate in entry.get("top_candidates", [])
            ]
            cleaned.append(row)
        return cleaned

    return {
        "persona": persona,
        "cap": cap,
        "mode": mode,
        "questions_asked": len(step_log),
        "unique_items": len(set(item_ids)),
        "duplicate_items": len(item_ids) - len(set(item_ids)),
        "tested_kcs": len([state for state in states.values() if state["direct_evidence_count"] > 0]),
        "labels": dict(labels),
        "probability_bands": dict(bands),
        "gap_precision": precision,
        "gap_recall": recall,
        "predicted_gaps": len(predicted_gaps),
        "ground_truth_gaps": len(gt_gaps),
        "missed_gaps": len(gt_gaps - predicted_gaps),
        "false_gaps": len(predicted_gaps - gt_gaps),
        "tested_order": run.tested_order,
        "step_log": step_log,
        "frontier_tail": clean_frontier(run.frontier_history[-3:]),
    }


def summarize_scope(graph: dict[str, Any], items: list[dict[str, Any]]) -> dict[str, Any]:
    g6 = g6_graph_payload(graph)
    assignments = propose_g6_strands(g6)
    algebra_ids = algebra_scope_ids(assignments, include_review_required=False)
    review_required_ids = {kc_id for kc_id, assignment in assignments.items() if assignment.strand == STRAND_REVIEW_REQUIRED}
    geometry_ids = {kc_id for kc_id, assignment in assignments.items() if assignment.strand == STRAND_G6_GEOMETRY_DEFERRED}
    algebra_items = [item for item in items if item["kc_id"] in algebra_ids]
    ready_items = [item for item in algebra_items if item["grader_readiness"] == "ready"]
    blocked_items = [item for item in algebra_items if item["grader_readiness"] != "ready"]
    item_counts = Counter(item["kc_id"] for item in ready_items)
    cluster_counts = Counter(item.get("cluster") or "unknown" for item in algebra_items)
    blocked_actions = Counter(item.get("recommended_review_action") for item in blocked_items)
    risk_counts = Counter(tag for item in blocked_items for tag in item.get("risk_tags", []))

    return {
        "assignments": assignments,
        "algebra_ids": algebra_ids,
        "review_required_ids": review_required_ids,
        "geometry_ids": geometry_ids,
        "algebra_items": algebra_items,
        "ready_items": ready_items,
        "blocked_items": blocked_items,
        "scope_summary": {
            "g6_nodes": len(g6["nodes"]),
            "g6_edges": len(g6["edges"]),
            "algebra_nodes": len(algebra_ids),
            "review_required_nodes": len(review_required_ids),
            "geometry_deferred_nodes": len(geometry_ids),
            "algebra_items_total": len(algebra_items),
            "ready_items": len(ready_items),
            "blocked_items": len(blocked_items),
            "ready_item_kcs": len(item_counts),
            "ready_kcs_with_2plus_items": sum(1 for count in item_counts.values() if count >= 2),
            "cluster_counts": dict(cluster_counts),
            "blocked_actions": dict(blocked_actions),
            "risk_counts": dict(risk_counts),
        },
    }


def fmt_float(value: float | None) -> str:
    return "N/A" if value is None else f"{value:.2f}"


def write_reports(payload: dict[str, Any]) -> None:
    summary = payload["scope_summary"]
    lines: list[str] = []
    lines.append("# Assessment V2 G6 Algebra Deterministic Report")
    lines.append("")
    lines.append("No AI persona was used. This run uses the graph snapshot at `/tmp/g6_kc_graph.json` and the V2 review item JSON fixture.")
    lines.append("")
    lines.append("## Scope and Item Readiness")
    lines.append("")
    lines.append(f"- G6 graph snapshot: {summary['g6_nodes']} nodes, {summary['g6_edges']} prerequisite edges.")
    lines.append(f"- Proposed algebra scope: {summary['algebra_nodes']} nodes.")
    lines.append(f"- Review-required/mixed scope: {summary['review_required_nodes']} nodes.")
    lines.append(f"- Geometry deferred: {summary['geometry_deferred_nodes']} nodes.")
    lines.append(f"- Algebra V2 items: {summary['algebra_items_total']} total, {summary['ready_items']} ready, {summary['blocked_items']} blocked.")
    lines.append(f"- Ready item coverage: {summary['ready_item_kcs']} KCs have at least 1 ready item; {summary['ready_kcs_with_2plus_items']} KCs have at least 2 ready items.")
    lines.append("")
    lines.append("### Blocked Item Reasons")
    lines.append("")
    for key, count in sorted(summary["blocked_actions"].items()):
        lines.append(f"- {key}: {count}")
    lines.append("")
    lines.append("### Risk Tags")
    lines.append("")
    for key, count in sorted(summary["risk_counts"].items()):
        lines.append(f"- {key}: {count}")
    lines.append("")
    lines.append("## Simulation Results")
    lines.append("")
    lines.append("| Mode | Cap | Persona | Q | Tested KCs | Tested Mastered | Tested Gap | Inferred Mastered | Inferred Gap | Unknown | Precision | Recall | Duplicate Items |")
    lines.append("|---|---:|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|")
    for row in payload["runs"]:
        labels = row["labels"]
        lines.append(
            f"| {row['mode']} | {row['cap']} | {row['persona']} | {row['questions_asked']} | "
            f"{row['tested_kcs']} | {labels.get('tested_mastered', 0)} | {labels.get('tested_gap', 0)} | "
            f"{labels.get('inferred_mastered', 0)} | {labels.get('inferred_gap', 0)} | {labels.get('unknown', 0)} | "
            f"{fmt_float(row['gap_precision'])} | {fmt_float(row['gap_recall'])} | {row['duplicate_items']} |"
        )
    lines.append("")
    lines.append("### Probability Bands At 35 Questions")
    lines.append("")
    lines.append("| Mode | Persona | Strong Gap | Likely Gap | Uncertain | Likely Mastered | Strong Mastered |")
    lines.append("|---|---|---:|---:|---:|---:|---:|")
    for row in payload["runs"]:
        if row["cap"] != 35:
            continue
        bands = row["probability_bands"]
        lines.append(
            f"| {row['mode']} | {row['persona']} | {bands.get('strong_gap', 0)} | "
            f"{bands.get('likely_gap', 0)} | {bands.get('uncertain', 0)} | "
            f"{bands.get('likely_mastered', 0)} | {bands.get('strong_mastered', 0)} |"
        )
    lines.append("")
    lines.append("## Interpretation")
    lines.append("")
    lines.append("- The supplemental fixture now gives every proposed algebra KC at least one ready, auto-gradable V2 item, so the assessment can use the full 30-35 question breadth without repeating KCs early.")
    lines.append("- Assessment-mode direct evidence now uses a BKT-style posterior with item slip/guess parameters. Open-ended wrong answers are strong evidence from a cold prior because guessing probability is low; MCQ answers remain less discriminating because guessing probability is higher.")
    lines.append("- Graph propagation uses the actual posterior delta and decays by graph distance. This improves gap recall substantially, but it also creates false-gap risk when a mastered student makes careless mistakes early in the assessment.")
    lines.append("- The `mastered_all` persona is a clean no-slip baseline. The `careless_mastered` persona is the stress test for tolerance and should be used to tune slip, thresholds, and confirmation policy.")
    lines.append("- Provisional-ready mode shows possible graph closure after academic approval of selected strong items, but it is not production approval.")
    lines.append("")
    lines.append("## Recommended Next Step")
    lines.append("")
    lines.append("1. Academic team should review the 40 Codex supplemental items and either approve, revise, or reject them.")
    lines.append("2. Add a student-facing `I don't know` control; that response remains a strong gap signal distinct from a normal wrong answer.")
    lines.append("3. Add second-family confirmation items for high-closure KCs where false gaps from careless mistakes are costly.")
    lines.append("")
    lines.append("## Example Trace: Provisional Ready, 35 Questions, Fraction Gap")
    lines.append("")
    trace = next(row for row in payload["runs"] if row["mode"] == "provisional_ready" and row["cap"] == 35 and row["persona"] == "fraction_gap")
    lines.append("| Step | Item | KC | Cluster | Correct |")
    lines.append("|---:|---|---|---|---|")
    for step in trace["step_log"]:
        lines.append(f"| {step['step']} | {step['item_id']} | {step['kc_code']} | {step['cluster']} | {step['correct']} |")

    REPORT_MD.write_text("\n".join(lines) + "\n", encoding="utf-8")
    REPORT_JSON.write_text(json.dumps(payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def main() -> None:
    graph = load_graph()
    items = load_review_items()
    scope = summarize_scope(graph, items)
    algebra_ids = scope["algebra_ids"]
    nodes, edges = subgraph_for_scope(graph, algebra_ids)
    cluster_sets = cluster_kcs(scope["algebra_items"], algebra_ids)
    cluster_by_kc: dict[str, str] = {}
    for cluster, ids in cluster_sets.items():
        for kc_id in ids:
            cluster_by_kc.setdefault(kc_id, cluster)

    runs = []
    for mode in ("strict_current_review", "provisional_ready"):
        diagnostic_items = to_diagnostic_items(scope["algebra_items"], algebra_ids, mode)
        for cap in CAPS:
            for persona in PERSONAS:
                runs.append(run_once(persona, cap, mode, nodes, edges, diagnostic_items, cluster_by_kc))

    payload = {
        "generated_at": "2026-06-26",
        "rng_seed": RNG_SEED,
        "caps": CAPS,
        "scope_summary": scope["scope_summary"],
        "runs": runs,
        "blocked_items": [
            {
                "review_id": item["review_id"],
                "cluster": item.get("cluster"),
                "question": item.get("question"),
                "recommended_review_action": item.get("recommended_review_action"),
                "risk_tags": item.get("risk_tags", []),
                "suggested_replacement": item.get("suggested_replacement"),
            }
            for item in scope["blocked_items"]
        ],
    }
    write_reports(payload)
    print(f"Wrote {REPORT_MD}")
    print(f"Wrote {REPORT_JSON}")
    print(json.dumps(payload["scope_summary"], ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
