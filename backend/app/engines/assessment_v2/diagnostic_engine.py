"""
Standalone Assessment V2 diagnostic engine.

This is a lab engine for deterministic simulations. It does not modify or call
the current production assessment controller.
"""

from __future__ import annotations

import math
from dataclasses import asdict, dataclass, field
from typing import Any

import networkx as nx


MASTERED_THRESHOLD = 0.80
GAP_THRESHOLD = 0.30
DEFAULT_PRIOR = 0.50
MIN_DIRECT_EVIDENCE = 1

ASSESSMENT_CORRECT_DELTA = 0.35
ASSESSMENT_WRONG_DELTA = -0.07
ASSESSMENT_UNKNOWN_DELTA = -0.50
ASSESSMENT_PROPAGATION_FACTOR = 0.60
ASSESSMENT_PROPAGATION_DECAY = 0.55
ASSESSMENT_MAX_TESTS_PER_KC = 1
ASSESSMENT_CONFIRMATION_MAX_TESTS_PER_KC = 2

SLIP_GUESS = {
    "mcq": (0.12, 0.25),
    "mcq4": (0.12, 0.25),
    "open": (0.08, 0.04),
    "open_short": (0.08, 0.04),
    "fillin": (0.08, 0.04),
    "freetext": (0.12, 0.03),
}


@dataclass(frozen=True)
class DiagnosticItem:
    id: str
    kc_id: str
    format_type: str
    content: dict[str, Any]
    difficulty_label: str = "medium"
    is_diagnostic_anchor: bool = False


@dataclass(frozen=True)
class DiagnosticResponse:
    item_id: str
    correct: bool
    student_answer: str | None = None
    grading: dict[str, Any] | None = None
    response_type: str = "answer"  # answer | unknown


@dataclass
class DiagnosticState:
    kc_id: str
    p_mastery: float = DEFAULT_PRIOR
    direct_evidence_count: int = 0
    correct_count: int = 0
    wrong_count: int = 0
    inferred_evidence_count: int = 0

    @property
    def label(self) -> str:
        if self.direct_evidence_count >= MIN_DIRECT_EVIDENCE and self.p_mastery >= MASTERED_THRESHOLD:
            return "tested_mastered"
        if self.direct_evidence_count >= MIN_DIRECT_EVIDENCE and self.p_mastery <= GAP_THRESHOLD:
            return "tested_gap"
        if self.direct_evidence_count == 0 and self.inferred_evidence_count > 0 and self.p_mastery >= MASTERED_THRESHOLD:
            return "inferred_mastered"
        if self.direct_evidence_count == 0 and self.inferred_evidence_count > 0 and self.p_mastery <= GAP_THRESHOLD:
            return "inferred_gap"
        return "unknown"

    @property
    def probability_band(self) -> str:
        if self.p_mastery <= 0.20:
            return "strong_gap"
        if self.p_mastery <= 0.35:
            return "likely_gap"
        if self.p_mastery < 0.70:
            return "uncertain"
        if self.p_mastery < 0.85:
            return "likely_mastered"
        return "strong_mastered"

    def to_dict(self) -> dict:
        payload = asdict(self)
        payload["label"] = self.label
        payload["probability_band"] = self.probability_band
        return payload


@dataclass
class DiagnosticRun:
    states: dict[str, DiagnosticState]
    tested_order: list[str] = field(default_factory=list)
    seen_items: set[str] = field(default_factory=set)
    evidence_by_kc: dict[str, list[dict]] = field(default_factory=dict)
    frontier_history: list[dict] = field(default_factory=list)
    state_transitions: list[dict] = field(default_factory=list)

    def to_dict(self) -> dict:
        return {
            "states": {kc_id: state.to_dict() for kc_id, state in self.states.items()},
            "tested_order": self.tested_order,
            "seen_items": sorted(self.seen_items),
            "evidence_by_kc": self.evidence_by_kc,
            "frontier_history": self.frontier_history,
            "state_transitions": self.state_transitions,
        }


class V2DiagnosticEngine:
    def __init__(
        self,
        nodes: list[dict[str, Any]],
        edges: list[dict[str, Any]],
        items: list[DiagnosticItem],
        mode: str = "assessment",
        enable_confirmation_phase: bool = True,
    ):
        self.mode = mode
        self.enable_confirmation_phase = enable_confirmation_phase
        self.graph = nx.DiGraph()
        for node in nodes:
            self.graph.add_node(str(node["id"]), **node)
        for edge in edges:
            source = str(edge.get("source") or edge.get("prereq_id"))
            target = str(edge.get("target") or edge.get("kc_id"))
            if source in self.graph and target in self.graph and edge.get("edge_type", "prerequisite") == "prerequisite":
                self.graph.add_edge(source, target)
        self.items_by_kc: dict[str, list[DiagnosticItem]] = {}
        for item in items:
            self.items_by_kc.setdefault(item.kc_id, []).append(item)

    def new_run(self, known_kcs: set[str] | None = None) -> DiagnosticRun:
        known_kcs = known_kcs or set()
        states = {
            kc_id: DiagnosticState(
                kc_id=kc_id,
                p_mastery=0.90 if kc_id in known_kcs else DEFAULT_PRIOR,
                direct_evidence_count=MIN_DIRECT_EVIDENCE if kc_id in known_kcs else 0,
                correct_count=MIN_DIRECT_EVIDENCE if kc_id in known_kcs else 0,
            )
            for kc_id in self.graph.nodes
        }
        return DiagnosticRun(states=states, tested_order=list(known_kcs))

    def select_next(self, run: DiagnosticRun) -> DiagnosticItem | None:
        candidates = self._frontier_candidates(run, allow_confirmation=False)
        reason_suffix = ""
        if not candidates and self.mode == "assessment" and self.enable_confirmation_phase:
            candidates = self._frontier_candidates(run, allow_confirmation=True)
            reason_suffix = "_confirmation"
        if not candidates:
            return None
        selected = max(candidates, key=lambda row: row["score"])
        if reason_suffix and selected["reason"] == "max_expected_information_gain":
            selected["reason"] = "confirmation_after_breadth"
        run.frontier_history.append({
            "step": len(run.frontier_history) + 1,
            "selected_kc": selected["kc_id"],
            "selected_item": selected["item_id"],
            "reason": selected["reason"],
            "top_candidates": sorted(candidates, key=lambda row: row["score"], reverse=True)[:5],
        })
        return selected["item"]

    def _frontier_candidates(self, run: DiagnosticRun, allow_confirmation: bool) -> list[dict[str, Any]]:
        candidates: list[dict[str, Any]] = []
        for kc_id in self.graph.nodes:
            state = run.states[kc_id]
            if state.label in {"tested_mastered", "tested_gap"}:
                continue
            if self.mode == "assessment" and state.direct_evidence_count >= ASSESSMENT_MAX_TESTS_PER_KC:
                if not allow_confirmation:
                    continue
                if state.direct_evidence_count >= ASSESSMENT_CONFIRMATION_MAX_TESTS_PER_KC:
                    continue
                if state.probability_band not in {"likely_gap", "uncertain", "likely_mastered"}:
                    continue
            elif allow_confirmation:
                continue
            usable = [item for item in self.items_by_kc.get(kc_id, []) if item.id not in run.seen_items]
            if not usable:
                continue
            item = sorted(usable, key=self._item_sort_key)[0]
            candidates.append(self._candidate_score(run, kc_id, item))
        return candidates

    def apply_response(self, run: DiagnosticRun, item: DiagnosticItem, response: DiagnosticResponse) -> None:
        if item.id != response.item_id:
            raise ValueError("response.item_id does not match item.id")

        run.seen_items.add(item.id)
        if item.kc_id not in run.tested_order:
            run.tested_order.append(item.kc_id)

        state = run.states[item.kc_id]
        before = state.p_mastery
        p_correct = self._predict_correct(state.p_mastery, item)
        if self.mode == "assessment":
            if response.response_type == "unknown":
                state.p_mastery = self._clamp_probability(state.p_mastery + ASSESSMENT_UNKNOWN_DELTA)
                state.wrong_count += 1
            elif response.correct:
                state.p_mastery = self._bkt_posterior(state.p_mastery, item, correct=True, p_correct=p_correct)
                state.correct_count += 1
            else:
                state.p_mastery = self._bkt_posterior(state.p_mastery, item, correct=False, p_correct=p_correct)
                state.wrong_count += 1
        elif response.correct:
            slip, _guess = self._slip_guess(item)
            posterior = state.p_mastery * (1.0 - slip) / max(p_correct, 1e-9)
            state.correct_count += 1
            state.p_mastery = self._clamp_update(state.p_mastery, posterior, 0.25)
        else:
            slip, _guess = self._slip_guess(item)
            posterior = state.p_mastery * slip / max(1.0 - p_correct, 1e-9)
            state.wrong_count += 1
            state.p_mastery = self._clamp_update(state.p_mastery, posterior, 0.25)
        state.direct_evidence_count += 1

        evidence = {
            "item_id": item.id,
            "format_type": item.format_type,
            "difficulty_label": item.difficulty_label,
            "is_diagnostic_anchor": item.is_diagnostic_anchor,
            "correct": response.correct,
            "student_answer": response.student_answer,
            "grading": response.grading,
            "p_mastery_before": round(before, 4),
            "p_correct_predicted": round(p_correct, 4),
            "p_mastery_after_direct": round(state.p_mastery, 4),
            "response_type": response.response_type,
        }
        run.evidence_by_kc.setdefault(item.kc_id, []).append(evidence)

        changes = [{
            "kc_id": item.kc_id,
            "from_p_mastery": round(before, 4),
            "to_p_mastery": round(state.p_mastery, 4),
            "reason": self._direct_reason(response),
        }]
        direct_delta = state.p_mastery - before
        changes.extend(self._apply_graph_inference(run, item, response.correct, response.response_type, direct_delta))
        run.state_transitions.append({
            "step": len(run.state_transitions) + 1,
            "item_id": item.id,
            "kc_id": item.kc_id,
            "correct": response.correct,
            "changes": changes,
        })

    def _candidate_score(self, run: DiagnosticRun, kc_id: str, item: DiagnosticItem) -> dict[str, Any]:
        state = run.states[kc_id]
        p_correct = self._predict_correct(state.p_mastery, item)
        gain_correct = self._gain_if_correct(run, kc_id, item)
        gain_wrong = self._gain_if_wrong(run, kc_id, item)
        expected_gain = p_correct * gain_correct + (1.0 - p_correct) * gain_wrong
        balance = 4.0 * p_correct * (1.0 - p_correct)
        item_quality = self._item_quality(item)
        score = 100.0 * expected_gain + 25.0 * balance + 12.0 * item_quality
        reason = "max_expected_information_gain"
        if self.mode != "assessment" and state.direct_evidence_count == 1:
            score += 80.0
            reason = "complete_min_direct_evidence"
        return {
            "kc_id": kc_id,
            "item_id": item.id,
            "item": item,
            "score": round(score, 4),
            "reason": reason,
            "p_mastery": round(state.p_mastery, 4),
            "p_correct": round(p_correct, 4),
            "gain_if_correct": round(gain_correct, 4),
            "gain_if_wrong": round(gain_wrong, 4),
            "expected_gain": round(expected_gain, 4),
            "response_balance": round(balance, 4),
            "item_quality": round(item_quality, 4),
        }

    def _gain_if_correct(self, run: DiagnosticRun, kc_id: str, item: DiagnosticItem) -> float:
        gain = self._uncertainty(run.states[kc_id].p_mastery)
        for ancestor in nx.ancestors(self.graph, kc_id):
            gain += self._uncertainty(run.states[ancestor].p_mastery) * 0.60
        if self._strong_inference_allowed(item):
            for required in item.content.get("requires_kcs", []) or []:
                if required in run.states:
                    gain += self._uncertainty(run.states[required].p_mastery)
        return gain

    def _gain_if_wrong(self, run: DiagnosticRun, kc_id: str, item: DiagnosticItem) -> float:
        gain = self._uncertainty(run.states[kc_id].p_mastery)
        for descendant in nx.descendants(self.graph, kc_id):
            gain += self._uncertainty(run.states[descendant].p_mastery) * 0.60
        if self._strong_inference_allowed(item):
            for diagnosed in item.content.get("diagnoses_kcs", []) or []:
                if diagnosed in run.states:
                    gain += self._uncertainty(run.states[diagnosed].p_mastery)
        return gain

    def _apply_graph_inference(
        self,
        run: DiagnosticRun,
        item: DiagnosticItem,
        correct: bool,
        response_type: str = "answer",
        direct_delta: float | None = None,
    ) -> list[dict]:
        changes: list[dict] = []
        if direct_delta is None:
            direct_delta = ASSESSMENT_CORRECT_DELTA if correct else ASSESSMENT_WRONG_DELTA
        if correct:
            for ancestor in nx.ancestors(self.graph, item.kc_id):
                distance = nx.shortest_path_length(self.graph, ancestor, item.kc_id)
                changes.extend(self._propagate_assessment_delta(
                    run,
                    ancestor,
                    self._propagated_delta(direct_delta, distance),
                    f"bkt_ancestor_boost:{item.kc_id}",
                ))
            if self._strong_inference_allowed(item):
                for required in item.content.get("requires_kcs", []) or []:
                    changes.extend(self._strong_update(run, str(required), 0.84, f"strong_open_requires:{item.id}"))
        else:
            delta = ASSESSMENT_UNKNOWN_DELTA if response_type == "unknown" else direct_delta
            for descendant in nx.descendants(self.graph, item.kc_id):
                distance = nx.shortest_path_length(self.graph, item.kc_id, descendant)
                changes.extend(self._propagate_assessment_delta(
                    run,
                    descendant,
                    self._propagated_delta(delta, distance),
                    f"bkt_descendant_decay:{item.kc_id}",
                ))
            if self._strong_inference_allowed(item):
                for diagnosed in item.content.get("diagnoses_kcs", []) or []:
                    changes.extend(self._strong_update(run, str(diagnosed), 0.26, f"strong_open_diagnoses:{item.id}"))
        return changes

    def _propagated_delta(self, direct_delta: float, distance: int) -> float:
        distance = max(distance, 1)
        return direct_delta * ASSESSMENT_PROPAGATION_FACTOR * (ASSESSMENT_PROPAGATION_DECAY ** (distance - 1))

    def _propagate_assessment_delta(self, run: DiagnosticRun, kc_id: str, delta: float, reason: str) -> list[dict]:
        if self.mode != "assessment":
            legacy_delta = 0.08 if delta > 0 else -0.08
            return self._soft_update(run, kc_id, legacy_delta, reason.replace("assessment_", "soft_"))
        state = run.states.get(kc_id)
        if state is None or state.direct_evidence_count > 0:
            return []
        before = state.p_mastery
        state.p_mastery = self._clamp_probability(state.p_mastery + delta)
        state.inferred_evidence_count += 1
        return [{
            "kc_id": kc_id,
            "from_p_mastery": round(before, 4),
            "to_p_mastery": round(state.p_mastery, 4),
            "reason": reason,
        }]

    def _soft_update(self, run: DiagnosticRun, kc_id: str, delta: float, reason: str) -> list[dict]:
        state = run.states.get(kc_id)
        if state is None or state.direct_evidence_count > 0:
            return []
        before = state.p_mastery
        state.p_mastery = min(0.98, max(0.02, state.p_mastery + delta))
        state.inferred_evidence_count += 1
        return [{
            "kc_id": kc_id,
            "from_p_mastery": round(before, 4),
            "to_p_mastery": round(state.p_mastery, 4),
            "reason": reason,
        }]

    def _strong_update(self, run: DiagnosticRun, kc_id: str, target: float, reason: str) -> list[dict]:
        state = run.states.get(kc_id)
        if state is None or state.direct_evidence_count > 0:
            return []
        before = state.p_mastery
        if target >= 0.5:
            state.p_mastery = max(state.p_mastery, target)
        else:
            state.p_mastery = min(state.p_mastery, target)
        state.inferred_evidence_count += 1
        return [{
            "kc_id": kc_id,
            "from_p_mastery": round(before, 4),
            "to_p_mastery": round(state.p_mastery, 4),
            "reason": reason,
        }]

    def _slip_guess(self, item: DiagnosticItem) -> tuple[float, float]:
        return SLIP_GUESS.get(item.format_type, SLIP_GUESS["mcq"])

    def _predict_correct(self, p_mastery: float, item: DiagnosticItem) -> float:
        slip, guess = self._slip_guess(item)
        return min(0.95, max(0.05, p_mastery * (1.0 - slip) + (1.0 - p_mastery) * guess))

    def _bkt_posterior(self, p_mastery: float, item: DiagnosticItem, correct: bool, p_correct: float | None = None) -> float:
        slip, _guess = self._slip_guess(item)
        p_correct = self._predict_correct(p_mastery, item) if p_correct is None else p_correct
        if correct:
            posterior = p_mastery * (1.0 - slip) / max(p_correct, 1e-9)
        else:
            posterior = p_mastery * slip / max(1.0 - p_correct, 1e-9)
        return self._clamp_probability(posterior)

    def _item_quality(self, item: DiagnosticItem) -> float:
        score = 1.0 if item.is_diagnostic_anchor else 0.0
        if item.format_type in {"open", "open_short", "fillin"}:
            score += 0.8
        if self._strong_inference_allowed(item):
            score += 1.0
        return score

    def _item_sort_key(self, item: DiagnosticItem) -> tuple:
        difficulty_order = {"anchor": 0, "medium": 1, "easy": 2, "hard": 3}
        return (
            difficulty_order.get(item.difficulty_label, 4),
            -int(item.is_diagnostic_anchor),
            0 if item.format_type in {"open", "open_short", "fillin"} else 1,
            item.id,
        )

    def _strong_inference_allowed(self, item: DiagnosticItem) -> bool:
        return (
            item.format_type in {"open", "open_short", "fillin", "freetext"}
            and item.content.get("inference_strength") == "strong"
            and item.content.get("academic_reviewed") is True
        )

    def _uncertainty(self, p: float) -> float:
        return 4.0 * p * (1.0 - p)

    def _clamp_update(self, before: float, after: float, max_delta: float) -> float:
        delta = max(-max_delta, min(max_delta, after - before))
        return min(0.98, max(0.02, before + delta))

    def _clamp_probability(self, value: float) -> float:
        return min(0.98, max(0.02, value))

    def _direct_reason(self, response: DiagnosticResponse) -> str:
        if response.response_type == "unknown":
            return "direct_unknown"
        return "bkt_direct_correct" if response.correct else "bkt_direct_wrong"
