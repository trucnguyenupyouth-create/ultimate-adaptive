#!/usr/bin/env python3
"""
Assessment V2 — Deterministic Algebra G6 30-Question Simulation
================================================================
Run: python scratch/v2_algebra_30q_simulation.py

Requires:
  - /tmp/g6_kc_graph.json  (fetched from production DB)
  - backend/data/assessment_v2_review/review_items.json

No AI. Seed fixed. No production writes.
"""

from __future__ import annotations

import json
import random
import sys
from pathlib import Path
from typing import Any

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from app.engines.assessment_v2.diagnostic_engine import (
    DiagnosticItem,
    DiagnosticResponse,
    V2DiagnosticEngine,
)

# ── Config ────────────────────────────────────────────────────────────────────
ITEMS_JSON   = ROOT / "data" / "assessment_v2_review" / "review_items.json"
GRAPH_JSON   = Path("/tmp/g6_kc_graph.json")
MAX_QUESTIONS = 30
RNG_SEED      = 42

# ── Inference upgrades (simulate academic_reviewed=true) ──────────────────────
# Strong: numeric/fraction items with canonical misconception pattern, prerequisite clear
STRONG_ITEM_IDS = {
    "v2-005",   # 1/2 + 1/3 = ? — canonical misconception 2/5
    "v2-032",   # 1/4 + 2/3 — fraction add unlike denominators
    "v2-033",   # 3/5 - 1/4 — fraction subtract unlike denominators
    "v2-003",   # rut gon 18/24 — simplification with clear patterns
    "v2-030",   # rut gon (alternate)
    "v2-010",   # ti so A/B — unit conversion prerequisite clear
    "v2-028",   # xac suat k/n — fraction toi gian, 2 wrong patterns clear
    "v2-013",   # M = 100 - 2·3² + 5 — order of operations
    "v2-044",   # order of ops #2
}
# Medium: numeric/fraction/set items where prerequisite listed but sai may have multiple causes
MEDIUM_ITEM_IDS = {
    "v2-004", "v2-006", "v2-007",
    "v2-008", "v2-009", "v2-011", "v2-012", "v2-014",
    "v2-019", "v2-020", "v2-021",
    "v2-022", "v2-023", "v2-024",
    "v2-027", "v2-031", "v2-034", "v2-035",
    "v2-038", "v2-039", "v2-040", "v2-041", "v2-042", "v2-043",
    "v2-045",
    "v2-051", "v2-052", "v2-053",
    "v2-054", "v2-055", "v2-056", "v2-057",
    "v2-058", "v2-059", "v2-060",
}
# Rest: weak (short_text, binary, MCQ-disguised)

PERSONA_SLIP  = 0.08   # mastered student slip rate
PERSONA_GUESS = 0.05   # non-mastered open-ended guess rate

# ── Loaders ───────────────────────────────────────────────────────────────────
def _load_items() -> list[DiagnosticItem]:
    raw_list = json.loads(ITEMS_JSON.read_text(encoding="utf-8"))["items"]
    items = []
    for raw in raw_list:
        rid = raw.get("review_id", "")
        at  = raw.get("answer_type", "short_text")
        fmt = "open" if at in ("integer", "decimal", "number", "fraction", "ratio", "set") else "open_short"
        content = dict(raw)
        if rid in STRONG_ITEM_IDS:
            content["inference_strength"] = "strong"
            content["academic_reviewed"]  = True
        elif rid in MEDIUM_ITEM_IDS:
            content["inference_strength"] = "medium"
            content["academic_reviewed"]  = True
        items.append(DiagnosticItem(
            id=rid,
            kc_id=raw["kc_id"],
            format_type=fmt,
            difficulty_label=raw.get("difficulty_label", "medium"),
            is_diagnostic_anchor=bool(raw.get("is_diagnostic_anchor", False)),
            content=content,
        ))
    return items


def _load_graph() -> tuple[list[dict], list[dict]]:
    g = json.loads(GRAPH_JSON.read_text())
    nodes = [{"id": str(n["id"]), "code": n.get("code",""), "name": n.get("name","")} for n in g["nodes"]]
    edges = [
        {"source": str(e["prereq_id"]), "target": str(e["kc_id"]), "edge_type": "prerequisite"}
        for e in g["edges"]
    ]
    return nodes, edges


# ── KC cluster sets ───────────────────────────────────────────────────────────
def _build_cluster_kc_sets(items: list[DiagnosticItem], raw_items: list[dict]) -> dict[str, set[str]]:
    cluster_map: dict[str, set[str]] = {}
    for raw in raw_items:
        cluster = raw.get("cluster", "unknown")
        cluster_map.setdefault(cluster, set()).add(raw["kc_id"])
    return cluster_map


# ── Persona answer sampling ───────────────────────────────────────────────────
def persona_correct(
    persona: str,
    item: DiagnosticItem,
    rng: random.Random,
    fraction_kcs: set[str],
    integer_kcs: set[str],
    number_kcs: set[str],
) -> bool:
    kc = item.kc_id
    if persona == "mastered":
        return rng.random() > PERSONA_SLIP
    if persona == "fraction_gap":
        return rng.random() < PERSONA_GUESS if kc in fraction_kcs else rng.random() > PERSONA_SLIP
    if persona == "integer_gap":
        return rng.random() < PERSONA_GUESS * 2.5 if kc in integer_kcs else rng.random() > PERSONA_SLIP
    if persona == "foundation_gap":
        return rng.random() < PERSONA_GUESS if kc in (number_kcs | fraction_kcs) else rng.random() > PERSONA_SLIP
    if persona == "random_guesser":
        return rng.random() < PERSONA_GUESS
    return True


# ── Simulation runner ─────────────────────────────────────────────────────────
def run_simulation(
    persona: str,
    engine: V2DiagnosticEngine,
    items: list[DiagnosticItem],
    fraction_kcs: set[str],
    integer_kcs: set[str],
    number_kcs: set[str],
) -> dict[str, Any]:
    rng = random.Random(RNG_SEED)
    run = engine.new_run()
    step_log: list[dict] = []
    q = 0

    while q < MAX_QUESTIONS:
        item = engine.select_next(run)
        if item is None:
            break
        correct = persona_correct(persona, item, rng, fraction_kcs, integer_kcs, number_kcs)
        if correct:
            ans = (item.content.get("accepted_answers") or ["correct"])[0]
        else:
            patterns = item.content.get("common_wrong_patterns") or []
            ans = patterns[0]["pattern"] if patterns else "wrong"

        engine.apply_response(run, item, DiagnosticResponse(item_id=item.id, correct=correct, student_answer=ans))
        step_log.append({"step": q + 1, "item_id": item.id, "kc_id": item.kc_id, "correct": correct, "answer": ans})
        q += 1

    return {"run": run, "questions_asked": q, "step_log": step_log}


# ── Metrics ───────────────────────────────────────────────────────────────────
def ground_truth_gaps(persona: str, fraction_kcs: set[str], integer_kcs: set[str], number_kcs: set[str]) -> set[str]:
    if persona == "fraction_gap":    return fraction_kcs.copy()
    if persona == "integer_gap":     return integer_kcs.copy()
    if persona == "foundation_gap":  return number_kcs | fraction_kcs
    return set()


def compute_metrics(result: dict, persona: str, fraction_kcs: set, integer_kcs: set, number_kcs: set) -> dict:
    run = result["run"]
    q   = result["questions_asked"]

    by_label: dict[str, list[str]] = {"tested_mastered": [], "tested_gap": [], "inferred_mastered": [], "inferred_gap": [], "unknown": []}
    for kc_id, st in run.states.items():
        by_label.setdefault(st.label, []).append(kc_id)

    predicted_gaps = set(by_label["tested_gap"]) | set(by_label["inferred_gap"])
    gt = ground_truth_gaps(persona, fraction_kcs, integer_kcs, number_kcs)

    if gt:
        tp = len(predicted_gaps & gt)
        fp = len(predicted_gaps - gt)
        fn = len(gt - predicted_gaps)
        prec = tp / (tp + fp) if (tp + fp) > 0 else 0.0
        rec  = tp / (tp + fn) if (tp + fn) > 0 else 0.0
    else:
        prec = rec = None

    # False strong diagnoses: strong_open_diagnoses fired on KC not in ground truth gap
    false_strong = 0
    for transition in run.state_transitions:
        for change in transition.get("changes", []):
            if "strong_open_diagnoses" in change.get("reason", ""):
                kc = change["kc_id"]
                if gt and kc not in gt:
                    false_strong += 1

    seen = list(result["step_log"])
    item_ids_used = [s["item_id"] for s in seen]
    repeat_bug = len(item_ids_used) != len(set(item_ids_used))

    return {
        "questions_asked":       q,
        "kcs_directly_tested":   len([s for s in run.states.values() if s.direct_evidence_count > 0]),
        "tested_mastered":       len(by_label["tested_mastered"]),
        "tested_gap":            len(by_label["tested_gap"]),
        "inferred_mastered":     len(by_label["inferred_mastered"]),
        "inferred_gap":          len(by_label["inferred_gap"]),
        "unknown":               len(by_label["unknown"]),
        "total_kcs":             len(run.states),
        "gap_precision":         prec,
        "gap_recall":            rec,
        "false_strong":          false_strong,
        "repeat_bug":            repeat_bug,
        "predicted_gaps":        sorted(predicted_gaps),
        "ground_truth_gaps":     sorted(gt),
        "missed_gaps":           sorted(gt - predicted_gaps),
        "frontier_end":          run.frontier_history[-1] if run.frontier_history else None,
        "step_log":              result["step_log"],
        "states":                run.states,
    }


# ── Printing ──────────────────────────────────────────────────────────────────
def pf(cond: bool | None, pass_th=True) -> str:
    if cond is None:     return "N/A"
    return "✅ PASS" if (cond == pass_th) else "❌ FAIL"


def print_result(persona: str, m: dict, kc_name: dict[str, str]) -> None:
    W = 76
    print(f"\n{'═'*W}")
    print(f"  PERSONA: {persona.upper()}")
    print(f"{'═'*W}")
    total = m["total_kcs"]
    print(f"  Questions asked : {m['questions_asked']}/30          {pf(m['questions_asked'] <= 30)}")
    print(f"  Directly tested : {m['kcs_directly_tested']} KCs  "
          f"(tested_mastered:{m['tested_mastered']}  tested_gap:{m['tested_gap']})")
    print(f"  Inferred        : {m['inferred_mastered']+m['inferred_gap']} KCs  "
          f"(inferred_mastered:{m['inferred_mastered']}  inferred_gap:{m['inferred_gap']})")
    print(f"  Still unknown   : {m['unknown']}/{total} KCs   {pf(m['unknown'] < total * 0.6)}")

    print(f"\n  Accuracy:")
    if m["gap_precision"] is not None:
        print(f"    Precision : {m['gap_precision']:.2f}   {pf(m['gap_precision'] >= 0.80)}")
        print(f"    Recall    : {m['gap_recall']:.2f}   {pf(m['gap_recall'] >= 0.70)}")
        if m["missed_gaps"]:
            print(f"    Missed    : {len(m['missed_gaps'])} KCs — ", end="")
            print(", ".join(kc_name.get(k, k[:8]) for k in m["missed_gaps"][:5]))
    else:
        print(f"    N/A (no ground truth for this persona)")

    print(f"\n  Quality:")
    print(f"    False strong inference : {m['false_strong']}   {pf(m['false_strong'] <= 2)}")
    print(f"    Repeat item bug        : {m['repeat_bug']}       {pf(not m['repeat_bug'])}")
    print(f"    Tested ≥ 10 KCs        : {m['kcs_directly_tested'] >= 10}  {pf(m['kcs_directly_tested'] >= 10)}")

    fe = m["frontier_end"]
    if fe:
        top = fe.get("top_candidates", [])[:3]
        print(f"\n  Frontier (last step {fe['step']}):")
        for i, c in enumerate(top):
            print(f"    #{i+1} KC={kc_name.get(c['kc_id'], c['kc_id'][:12]):<28s} "
                  f"p_mastery={c['p_mastery']:.2f}  expected_gain={c['expected_gain']:.3f}")


def print_step_trace(persona: str, m: dict, kc_name: dict[str, str], max_steps: int = 20) -> None:
    print(f"\n  Step-by-step trace ({persona}, first {max_steps} steps):")
    print(f"  {'Step':>4s}  {'Item':>8s}  {'KC Code':<32s}  {'✓/✗'}  {'Answer':<22s}  {'p_mast':>7s}  {'label'}")
    print(f"  {'-'*100}")
    states = m["states"]
    for s in m["step_log"][:max_steps]:
        kc  = s["kc_id"]
        st  = states[kc]
        ans = str(s["answer"])[:20] + ("…" if len(str(s["answer"])) > 20 else "")
        code = kc_name.get(kc, kc[:16])
        icon = "✓" if s["correct"] else "✗"
        print(f"  {s['step']:>4d}  {s['item_id']:>8s}  {code:<32s}  {icon}    {ans:<22s}  {st.p_mastery:>7.3f}  {st.label}")


def print_summary(all_m: dict[str, dict]) -> None:
    W = 76
    print(f"\n{'═'*W}")
    print("  SUMMARY TABLE")
    print(f"{'═'*W}")
    print(f"  {'Persona':<20s} {'Q':>3s} {'Tested':>7s} {'Infer':>6s} {'Unk':>4s} {'Prec':>6s} {'Rec':>5s} {'FalseStr':>9s} {'Result'}")
    print(f"  {'-'*W}")
    for persona, m in all_m.items():
        prec = f"{m['gap_precision']:.2f}" if m["gap_precision"] is not None else "  N/A"
        rec  = f"{m['gap_recall']:.2f}"  if m["gap_recall"] is not None else " N/A"
        infer = m["inferred_mastered"] + m["inferred_gap"]
        checks = [
            m["questions_asked"] <= 30,
            m["kcs_directly_tested"] >= 10,
            not m["repeat_bug"],
            m["false_strong"] <= 2,
        ]
        if m["gap_precision"] is not None:
            checks += [m["gap_precision"] >= 0.80, m["gap_recall"] >= 0.70]
        result = "✅ PASS" if all(checks) else "❌ FAIL"
        print(f"  {persona:<20s} {m['questions_asked']:>3d} {m['kcs_directly_tested']:>7d} {infer:>6d} "
              f"{m['unknown']:>4d} {prec:>6s} {rec:>5s} {m['false_strong']:>9d}  {result}")
    print()


# ── Main ──────────────────────────────────────────────────────────────────────
def main() -> None:
    print("=" * 76)
    print("  Assessment V2 — Deterministic Algebra G6 Simulation (seed=42)")
    print("=" * 76)

    print("\n[1] Loading KC graph ...")
    nodes, edges = _load_graph()
    kc_name = {n["id"]: n.get("code", n["id"][:12]) for n in nodes}

    print("[2] Loading V2 items ...")
    raw_items = json.loads(ITEMS_JSON.read_text(encoding="utf-8"))["items"]
    items = _load_items()
    strong_n = sum(1 for i in items if i.content.get("inference_strength") == "strong")
    medium_n = sum(1 for i in items if i.content.get("inference_strength") == "medium")
    weak_n   = sum(1 for i in items if i.content.get("inference_strength") not in ("strong", "medium"))
    print(f"    {len(items)} items: {strong_n} strong / {medium_n} medium / {weak_n} weak")

    cluster_map = _build_cluster_kc_sets(items, raw_items)
    fraction_kcs = cluster_map.get("Fractions Equivalence và Operations", set())
    integer_kcs  = cluster_map.get("Integers \u0026 Order", set())
    number_kcs   = cluster_map.get("Number Foundations \u0026 Divisibility", set())
    print(f"    Ground truth clusters — Fraction:{len(fraction_kcs)} Integer:{len(integer_kcs)} Number:{len(number_kcs)}")

    personas = ["mastered", "fraction_gap", "integer_gap", "foundation_gap", "random_guesser"]
    all_metrics: dict[str, dict] = {}

    print("\n[3] Running simulations ...")
    for persona in personas:
        # Fresh engine per persona (state is per-run, but items_by_kc is shared)
        engine = V2DiagnosticEngine(nodes=nodes, edges=edges, items=items)
        result = run_simulation(persona, engine, items, fraction_kcs, integer_kcs, number_kcs)
        m = compute_metrics(result, persona, fraction_kcs, integer_kcs, number_kcs)
        all_metrics[persona] = m
        print(f"    {persona:<20s}: {m['questions_asked']} q, tested={m['kcs_directly_tested']} KCs, unknown={m['unknown']}")

    print("\n[4] Results:")
    for persona in personas:
        print_result(persona, all_metrics[persona], kc_name)

    # Detailed step trace for fraction_gap (most diagnostic)
    print(f"\n{'═'*76}")
    print("  DETAILED STEP TRACE — fraction_gap")
    print(f"{'═'*76}")
    print_step_trace("fraction_gap", all_metrics["fraction_gap"], kc_name, max_steps=20)

    print_summary(all_metrics)


if __name__ == "__main__":
    main()
