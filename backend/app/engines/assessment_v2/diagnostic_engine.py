"""
Standalone Assessment V2 diagnostic engine.

This is a lab engine for deterministic simulations. It does not modify or call
the current production assessment controller.
"""

from __future__ import annotations

import math
import random
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
GRADE8_EXAM_PATH_SCOPE = "grade8_exam_path"
GRADE8_MAX_TESTS_PER_KC = 2
GRADE8_DEEP_DIVE_ROLES = {
    "misconception": 0,
    "prerequisite_probe": 1,
    "anchor": 2,
    "bridge": 3,
    "confirmation": 4,
    "transfer": 5,
    "readiness": 6,
}
GRADE8_FOUNDATION_GRADES = {6, 7}
PARTICLE_COUNT = 800
PARTICLE_PREFILTER_LIMIT = 12
PARTICLE_RESAMPLE_ESS_RATIO = 0.30
PARTICLE_RNG_SEED = 20260704

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
    particle_state: dict[str, Any] | None = None

    def to_dict(self) -> dict:
        def strip_runtime_objects(value: Any) -> Any:
            if isinstance(value, DiagnosticItem):
                return {
                    "id": value.id,
                    "kc_id": value.kc_id,
                    "format_type": value.format_type,
                    "difficulty_label": value.difficulty_label,
                    "is_diagnostic_anchor": value.is_diagnostic_anchor,
                    "content": value.content,
                }
            if isinstance(value, dict):
                return {
                    key: strip_runtime_objects(inner)
                    for key, inner in value.items()
                    if key != "item"
                }
            if isinstance(value, list):
                return [strip_runtime_objects(inner) for inner in value]
            if isinstance(value, set):
                return sorted(strip_runtime_objects(inner) for inner in value)
            return value

        return {
            "states": {kc_id: state.to_dict() for kc_id, state in self.states.items()},
            "tested_order": self.tested_order,
            "seen_items": sorted(self.seen_items),
            "evidence_by_kc": self.evidence_by_kc,
            "frontier_history": strip_runtime_objects(self.frontier_history),
            "state_transitions": strip_runtime_objects(self.state_transitions),
            "particle_state": strip_runtime_objects(self.particle_state),
        }


@dataclass
class KnowledgeStateParticleSelector:
    """Particle approximation of a KST-style feasible knowledge-state posterior."""

    graph: nx.DiGraph
    kc_index: list[str]
    particles: list[tuple[int, float]]

    @classmethod
    def from_run(cls, graph: nx.DiGraph, run: DiagnosticRun, count: int = PARTICLE_COUNT) -> "KnowledgeStateParticleSelector":
        kc_index = list(graph.nodes)
        payload = run.particle_state or {}
        if payload.get("kc_index") == kc_index and payload.get("particles"):
            particles = [
                (int(row["bits"], 16), float(row["weight"]))
                for row in payload.get("particles", [])
            ]
            selector = cls(graph=graph, kc_index=kc_index, particles=particles)
            selector._normalize()
            return selector

        selector = cls(
            graph=graph,
            kc_index=kc_index,
            particles=cls._initial_particles(graph, kc_index, run, count),
        )
        selector._normalize()
        run.particle_state = selector.to_dict()
        return selector

    @staticmethod
    def _initial_particles(
        graph: nx.DiGraph,
        kc_index: list[str],
        run: DiagnosticRun,
        count: int,
    ) -> list[tuple[int, float]]:
        rng = random.Random(PARTICLE_RNG_SEED + len(kc_index))
        particles: list[tuple[int, float]] = []
        for _ in range(count):
            bits = KnowledgeStateParticleSelector._sample_feasible_ideal(graph, kc_index, rng)
            particles.append((bits, 1.0))

        index_by_kc = {kc_id: i for i, kc_id in enumerate(kc_index)}
        log_weights: list[float] = []
        for bits, _weight in particles:
            log_weight = 0.0
            for kc_id, i in index_by_kc.items():
                target = run.states.get(kc_id, DiagnosticState(kc_id=kc_id)).p_mastery
                target = min(0.98, max(0.02, target))
                mastered = bool(bits & (1 << i))
                log_weight += math.log(target if mastered else 1.0 - target)
            log_weights.append(log_weight)
        max_log = max(log_weights) if log_weights else 0.0
        return [
            (bits, math.exp(log_weight - max_log))
            for (bits, _weight), log_weight in zip(particles, log_weights)
        ]

    @staticmethod
    def _sample_feasible_ideal(graph: nx.DiGraph, kc_index: list[str], rng: random.Random) -> int:
        target_size = rng.randint(0, len(kc_index))
        mastered: set[str] = set()
        remaining = set(kc_index)
        available = [kc_id for kc_id in kc_index if graph.in_degree(kc_id) == 0]
        while available and len(mastered) < target_size:
            kc_id = available.pop(rng.randrange(len(available)))
            if kc_id not in remaining:
                continue
            mastered.add(kc_id)
            remaining.remove(kc_id)
            for successor in graph.successors(kc_id):
                if successor in remaining and all(pred in mastered for pred in graph.predecessors(successor)):
                    available.append(successor)
        index_by_kc = {kc_id: i for i, kc_id in enumerate(kc_index)}
        bits = 0
        for kc_id in mastered:
            bits |= 1 << index_by_kc[kc_id]
        return bits

    def to_dict(self) -> dict[str, Any]:
        return {
            "strategy": "state_space_particles",
            "kc_index": self.kc_index,
            "particles": [
                {"bits": hex(bits), "weight": round(weight, 12)}
                for bits, weight in self.particles
            ],
        }

    def score_item(
        self,
        run: DiagnosticRun,
        item: DiagnosticItem,
        item_quality: float,
        entropy_before: float | None = None,
    ) -> dict[str, Any]:
        entropy_before = self.entropy() if entropy_before is None else entropy_before
        correct_weights, p_correct = self._posterior_weights(item, correct=True)
        wrong_weights, p_wrong = self._posterior_weights(item, correct=False)
        correct_marginals = self.marginals(correct_weights)
        wrong_marginals = self.marginals(wrong_weights)
        entropy_correct = self._entropy_from_marginals(correct_marginals)
        entropy_wrong = self._entropy_from_marginals(wrong_marginals)
        expected_entropy_after = p_correct * entropy_correct + p_wrong * entropy_wrong
        information_gain = max(0.0, entropy_before - expected_entropy_after)
        split_balance = 4.0 * p_correct * p_wrong
        score = 100.0 * information_gain + 10.0 * split_balance + 5.0 * item_quality
        return {
            "score": round(score, 4),
            "reason": "state_space_expected_information_gain",
            "selector_strategy": "state_space_eig",
            "p_correct": round(p_correct, 4),
            "gain_if_correct": round(max(0.0, entropy_before - entropy_correct), 4),
            "gain_if_wrong": round(max(0.0, entropy_before - entropy_wrong), 4),
            "expected_gain": round(information_gain, 4),
            "information_gain": round(information_gain, 4),
            "entropy_before": round(entropy_before, 4),
            "expected_entropy_after": round(expected_entropy_after, 4),
            "split_balance": round(split_balance, 4),
            "response_balance": round(split_balance, 4),
            "item_quality": round(item_quality, 4),
            "effective_particle_count": round(self.effective_particle_count(), 2),
            "posterior_if_correct_counts": self.posterior_counts(correct_marginals),
            "posterior_if_wrong_counts": self.posterior_counts(wrong_marginals),
        }

    def update_from_response(
        self,
        run: DiagnosticRun,
        item: DiagnosticItem,
        response: DiagnosticResponse,
    ) -> list[dict[str, Any]]:
        if response.response_type == "unknown":
            weights, _prob = self._posterior_weights(item, correct=False, unknown=True)
        else:
            weights, _prob = self._posterior_weights(item, correct=response.correct)
        self.particles = [(bits, weight) for (bits, _old_weight), weight in zip(self.particles, weights)]
        self._normalize()
        if self.effective_particle_count() < PARTICLE_COUNT * PARTICLE_RESAMPLE_ESS_RATIO:
            self._resample()

        changes: list[dict[str, Any]] = []
        marginals = self.marginals()
        for kc_id, marginal in marginals.items():
            state = run.states.get(kc_id)
            if state is None or state.direct_evidence_count > 0:
                continue
            before = state.p_mastery
            if abs(before - marginal) < 0.01:
                state.p_mastery = marginal
                continue
            state.p_mastery = marginal
            state.inferred_evidence_count += 1
            changes.append({
                "kc_id": kc_id,
                "from_p_mastery": round(before, 4),
                "to_p_mastery": round(marginal, 4),
                "reason": f"state_space_particle_update:{item.kc_id}",
            })
        run.particle_state = self.to_dict()
        return changes

    def marginals(self, weights: list[float] | None = None) -> dict[str, float]:
        weights = self._normalized_weights(weights)
        totals = {kc_id: 0.0 for kc_id in self.kc_index}
        for (bits, _weight), weight in zip(self.particles, weights):
            for i, kc_id in enumerate(self.kc_index):
                if bits & (1 << i):
                    totals[kc_id] += weight
        return totals

    def entropy(self, weights: list[float] | None = None) -> float:
        return self._entropy_from_marginals(self.marginals(weights))

    def _entropy_from_marginals(self, marginals: dict[str, float]) -> float:
        total = 0.0
        for p in marginals.values():
            p = min(0.999999, max(0.000001, p))
            total += -(p * math.log2(p) + (1.0 - p) * math.log2(1.0 - p))
        return total

    def posterior_counts(self, marginals: dict[str, float]) -> dict[str, int]:
        counts = {"mastered": 0, "gap": 0, "uncertain": 0}
        for p in marginals.values():
            if p >= MASTERED_THRESHOLD:
                counts["mastered"] += 1
            elif p <= GAP_THRESHOLD:
                counts["gap"] += 1
            else:
                counts["uncertain"] += 1
        return counts

    def effective_particle_count(self) -> float:
        weights = self._normalized_weights()
        denom = sum(weight * weight for weight in weights)
        return 1.0 / denom if denom else 0.0

    def _posterior_weights(
        self,
        item: DiagnosticItem,
        correct: bool,
        unknown: bool = False,
    ) -> tuple[list[float], float]:
        kc_position = self.kc_index.index(item.kc_id)
        slip, guess = SLIP_GUESS.get(item.format_type, SLIP_GUESS["mcq"])
        raw_weights: list[float] = []
        response_probability = 0.0
        for bits, weight in self.particles:
            mastered = bool(bits & (1 << kc_position))
            if unknown:
                likelihood = 0.02 if mastered else 0.65
            elif correct:
                likelihood = (1.0 - slip) if mastered else guess
            else:
                likelihood = slip if mastered else (1.0 - guess)
            raw_weight = weight * likelihood
            raw_weights.append(raw_weight)
            response_probability += raw_weight
        normalized = self._normalized_weights(raw_weights)
        return normalized, min(0.95, max(0.05, response_probability))

    def _normalize(self) -> None:
        weights = self._normalized_weights()
        self.particles = [
            (bits, weight)
            for (bits, _old_weight), weight in zip(self.particles, weights)
        ]

    def _normalized_weights(self, weights: list[float] | None = None) -> list[float]:
        if weights is None:
            weights = [weight for _bits, weight in self.particles]
        total = sum(weights)
        if total <= 0:
            return [1.0 / len(weights)] * len(weights) if weights else []
        return [weight / total for weight in weights]

    def _resample(self) -> None:
        rng = random.Random(PARTICLE_RNG_SEED + len(self.kc_index) + len(self.particles))
        weights = self._normalized_weights()
        cumulative: list[float] = []
        running = 0.0
        for weight in weights:
            running += weight
            cumulative.append(running)
        new_particles: list[tuple[int, float]] = []
        for _ in self.particles:
            draw = rng.random()
            index = 0
            while index < len(cumulative) - 1 and cumulative[index] < draw:
                index += 1
            new_particles.append((self.particles[index][0], 1.0 / len(self.particles)))
        self.particles = new_particles


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
        self.items_by_id: dict[str, DiagnosticItem] = {}
        for item in items:
            self.items_by_kc.setdefault(item.kc_id, []).append(item)
            self.items_by_id[item.id] = item

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
        if self.mode == "grade8_path":
            return self._select_next_grade8_path(run)
        selector = KnowledgeStateParticleSelector.from_run(self.graph, run)
        candidates = self._frontier_candidates(run, allow_confirmation=False, selector=selector)
        reason_suffix = ""
        policy = "state_space_eig"
        if not candidates and self.mode == "assessment" and self.enable_confirmation_phase:
            candidates = self._frontier_candidates(run, allow_confirmation=True, selector=selector)
            reason_suffix = "_confirmation"
            policy = "confirmation"
        if not candidates:
            return None
        selected = max(candidates, key=lambda row: row["score"])
        if reason_suffix:
            selected["reason"] = "confirmation_after_breadth"
        run.frontier_history.append({
            "step": len(run.frontier_history) + 1,
            "selected_kc": selected["kc_id"],
            "selected_item": selected["item_id"],
            "reason": selected["reason"],
            "selector_policy": policy,
            "deep_dive_reason": selected.get("deep_dive_reason"),
            "source_failed_kc": selected.get("source_failed_kc"),
            "candidate_pool": selected.get("candidate_pool"),
            "skipped_candidates": selected.get("skipped_candidates", []),
            "top_candidates": sorted(candidates, key=lambda row: row["score"], reverse=True)[:5],
        })
        return selected["item"]

    def _select_next_grade8_path(self, run: DiagnosticRun) -> DiagnosticItem | None:
        """Grade 8 path-aware diagnostic selection — two phases only.

        Phase 1 — Grade 8 EIG scan:
            Ask Grade 8 anchor questions in order of expected information gain.
            Goal: identify which Grade 8 KCs are gaps.

        Phase 2 — Path drill-down:
            When a Grade 8 gap is found, follow its prerequisite chain downward
            one level at a time. Ask the direct prerequisite of the gap KC.
            - If the prerequisite is CORRECT  → root gap is the Grade 8 KC itself
              (prerequisite knowledge is fine). Stop drilling this chain.
            - If the prerequisite is WRONG    → prerequisite is now the new gap.
              Drill into ITS prerequisites next question.
            - Continue until the deepest failed prerequisite is found (root cause).

        Grade 6/7 questions are ONLY served if the drill-down path from a
        Grade 8 gap leads there. There is NO global lower-grade sweep.
        """
        # ── Phase 2: Path drill-down ────────────────────────────────────────────
        # Find the most recently tested KC that is still a gap (p_mastery low,
        # has been directly tested). Walk tested_order in reverse so we always
        # drill the most recent gap first (depth-first).
        for kc_id in reversed(run.tested_order):
            state = run.states.get(kc_id)
            if state is None or state.direct_evidence_count == 0:
                continue
            if state.p_mastery >= MASTERED_THRESHOLD:
                continue  # Mastered — not a gap, skip

            # kc_id is a gap. Find untested direct prerequisites that have items.
            direct_prereqs = list(self.graph.predecessors(kc_id))
            drillable = [
                p for p in direct_prereqs
                if p in run.states
                and run.states[p].direct_evidence_count == 0
                and self.items_by_kc.get(p)
            ]

            if not drillable:
                # No untested prerequisites with items for this gap.
                # kc_id IS the root cause gap — nothing further to drill.
                continue  # Try next gap in tested_order (if any)

            # Pick the prerequisite whose p_mastery is most uncertain (closest to 0.5).
            # This gives the highest diagnostic value.
            best_prereq = min(drillable, key=lambda p: abs(run.states[p].p_mastery - 0.5))
            usable = [
                i for i in self.items_by_kc[best_prereq]
                if i.id not in run.seen_items
            ]
            if not usable:
                continue

            item = sorted(usable, key=self._item_sort_key)[0]
            gap_node = self.graph.nodes.get(kc_id, {})
            drill_node = self.graph.nodes.get(best_prereq, {})
            run.frontier_history.append({
                "step": len(run.frontier_history) + 1,
                "selected_kc": best_prereq,
                "selected_item": item.id,
                "selector_policy": "grade8_path_drill",
                "reason": "drill_prerequisite_of_gap",
                "source_gap_kc": kc_id,
                "source_gap_code": gap_node.get("code", "?"),
                "drill_target_code": drill_node.get("code", "?"),
                "drill_target_grade": drill_node.get("grade"),
                "drill_depth": len(run.tested_order),
            })
            return item

        # ── Phase 1: Grade 8 EIG scan ───────────────────────────────────────────
        # No active drill-down (no gaps yet, or all gaps exhausted their chains).
        # Scan ONLY Grade 8 KCs using expected information gain.
        g8_candidates: list[dict[str, Any]] = []
        for kc_id in self.graph.nodes:
            node_data = self.graph.nodes[kc_id]
            if node_data.get("grade") != 8:
                continue  # Phase 1 touches Grade 8 only
            state = run.states.get(kc_id)
            if state is None:
                continue
            if state.direct_evidence_count >= ASSESSMENT_MAX_TESTS_PER_KC:
                continue
            if state.label in {"tested_mastered", "tested_gap"}:
                continue
            usable = [
                i for i in self.items_by_kc.get(kc_id, [])
                if i.id not in run.seen_items
            ]
            if not usable:
                continue
            item = sorted(usable, key=self._item_sort_key)[0]
            g8_candidates.append(self._candidate_score(run, kc_id, item))

        if g8_candidates:
            selected = max(g8_candidates, key=lambda c: c["score"])
            run.frontier_history.append({
                "step": len(run.frontier_history) + 1,
                "selected_kc": selected["kc_id"],
                "selected_item": selected["item_id"],
                "selector_policy": "grade8_scan_eig",
                "reason": "grade8_eig_scan",
                "p_mastery": selected["p_mastery"],
                "score": selected["score"],
            })
            return selected["item"]

        return None  # All Grade 8 KCs tested and all drill-down chains exhausted

    def _frontier_candidates(
        self,
        run: DiagnosticRun,
        allow_confirmation: bool,
        selector: KnowledgeStateParticleSelector | None = None,
    ) -> list[dict[str, Any]]:
        selector = selector or KnowledgeStateParticleSelector.from_run(self.graph, run)
        raw_candidates: list[tuple[float, str, DiagnosticItem]] = []
        for kc_id in self.graph.nodes:
            state = run.states[kc_id]
            if allow_confirmation and self._grade8_scope_has_items_for_kc(kc_id):
                if not self._grade8_can_confirm_kc(run, kc_id):
                    continue
            elif not self._can_select_new_kc_evidence(run, kc_id, allow_confirmation=allow_confirmation):
                continue
            usable = [item for item in self.items_by_kc.get(kc_id, []) if item.id not in run.seen_items]
            usable = [item for item in usable if not self._surface_was_seen(run, item)]
            if not usable:
                continue
            item = sorted(usable, key=self._item_sort_key)[0]
            raw_candidates.append((self._cheap_candidate_score(run, kc_id, item), kc_id, item))

        raw_candidates = sorted(raw_candidates, key=lambda row: row[0], reverse=True)[:PARTICLE_PREFILTER_LIMIT]
        entropy_before = selector.entropy()
        return [
            self._candidate_score(run, kc_id, item, selector=selector, entropy_before=entropy_before)
            for _score, kc_id, item in raw_candidates
        ]

    def _can_select_new_kc_evidence(self, run: DiagnosticRun, kc_id: str, *, allow_confirmation: bool) -> bool:
        state = run.states[kc_id]
        if state.label in {"tested_mastered", "tested_gap"}:
            return False
        if self.mode == "assessment" and state.direct_evidence_count >= ASSESSMENT_MAX_TESTS_PER_KC:
            if not allow_confirmation:
                return False
            if state.direct_evidence_count >= ASSESSMENT_CONFIRMATION_MAX_TESTS_PER_KC:
                return False
            if state.probability_band not in {"likely_gap", "uncertain", "likely_mastered"}:
                return False
        elif allow_confirmation:
            return False
        return True

    def _grade8_scope_has_items_for_kc(self, kc_id: str) -> bool:
        return any(self._is_grade8_exam_path_item(item) for item in self.items_by_kc.get(kc_id, []))

    def _is_grade8_exam_path_item(self, item: DiagnosticItem) -> bool:
        return item.content.get("official_assessment_scope") == GRADE8_EXAM_PATH_SCOPE

    def _is_grade8_root_cause_mode(self) -> bool:
        return any(self._is_grade8_exam_path_item(item) for item in self.items_by_id.values())

    def _is_foundation_kc(self, kc_id: str) -> bool:
        try:
            return int(self.graph.nodes[kc_id].get("grade", 99)) in GRADE8_FOUNDATION_GRADES
        except (TypeError, ValueError):
            return False

    def _grade8_item_role_rank(self, item: DiagnosticItem) -> int:
        return GRADE8_DEEP_DIVE_ROLES.get(str(item.content.get("item_role") or ""), 99)

    def _grade8_can_confirm_kc(self, run: DiagnosticRun, kc_id: str) -> bool:
        state = run.states[kc_id]
        if self.mode != "assessment":
            return False
        if state.direct_evidence_count <= 0 or state.direct_evidence_count >= GRADE8_MAX_TESTS_PER_KC:
            return False
        if state.probability_band not in {"strong_gap", "likely_gap", "uncertain", "likely_mastered"}:
            return False
        return True

    def _grade8_root_cause_candidates(
        self,
        run: DiagnosticRun,
        selector: KnowledgeStateParticleSelector,
    ) -> list[dict[str, Any]]:
        if self.mode != "assessment" or not self._is_grade8_root_cause_mode():
            return []

        foundation_tested = sum(1 for kc_id in run.tested_order if self._is_foundation_kc(kc_id))
        total_tested = max(len(run.tested_order), 1)
        foundation_ratio = foundation_tested / total_tested
        root_pressure = len(run.frontier_history) >= 3 and foundation_ratio < 0.68

        raw_candidates: list[tuple[float, str, DiagnosticItem, str]] = []
        for kc_id in self.graph.nodes:
            if not self._is_foundation_kc(kc_id):
                continue
            state = run.states[kc_id]
            if state.label == "tested_mastered":
                continue
            if state.direct_evidence_count >= GRADE8_MAX_TESTS_PER_KC:
                continue
            usable = [
                item for item in self.items_by_kc.get(kc_id, [])
                if item.id not in run.seen_items
                and self._is_grade8_exam_path_item(item)
                and not self._surface_was_seen(run, item)
            ]
            if not usable:
                continue
            item = sorted(usable, key=lambda candidate: (self._grade8_item_role_rank(candidate), self._item_sort_key(candidate)))[0]
            if state.direct_evidence_count == 1 and state.probability_band in {"strong_gap", "likely_gap", "uncertain"}:
                priority = 120.0
                reason = "confirm_foundation_root_candidate"
            elif state.direct_evidence_count == 0 and (root_pressure or state.p_mastery <= 0.42):
                priority = 90.0 if state.p_mastery <= 0.42 else 70.0
                reason = "probe_foundation_before_more_grade8_scan"
            else:
                continue
            try:
                grade = int(self.graph.nodes[kc_id].get("grade", 99))
            except (TypeError, ValueError):
                grade = 99
            grade_bonus = 12.0 if grade == 6 else 6.0
            role_bonus = max(0.0, 20.0 - self._grade8_item_role_rank(item) * 3.0)
            raw_candidates.append((priority + grade_bonus + role_bonus + self._cheap_candidate_score(run, kc_id, item), kc_id, item, reason))

        if not raw_candidates:
            return []

        selected_pool = sorted(raw_candidates, key=lambda row: row[0], reverse=True)[:PARTICLE_PREFILTER_LIMIT]
        entropy_before = selector.entropy()
        candidates: list[dict[str, Any]] = []
        for priority, kc_id, item, reason in selected_pool:
            payload = self._candidate_score(run, kc_id, item, selector=selector, entropy_before=entropy_before)
            payload["score"] = round(payload["score"] + priority, 4)
            payload["reason"] = reason
            payload["selector_strategy"] = "grade8_root_cause_state_space_eig"
            payload["deep_dive_reason"] = (
                f"root_cause_priority; grade:{self.graph.nodes[kc_id].get('grade')}; "
                f"direct_evidence:{run.states[kc_id].direct_evidence_count}; "
                f"band:{run.states[kc_id].probability_band}; "
                f"foundation_ratio:{foundation_ratio:.2f}"
            )
            payload["candidate_pool"] = {
                "foundation_tested": foundation_tested,
                "total_tested": total_tested,
                "foundation_ratio": round(foundation_ratio, 4),
                "root_pressure": root_pressure,
            }
            candidates.append(payload)
        return candidates

    def _grade8_unresolved_follow_up_candidates(
        self,
        run: DiagnosticRun,
        selector: KnowledgeStateParticleSelector,
    ) -> list[dict[str, Any]]:
        context = self._last_grade8_unresolved_miss_context(run)
        if context is None:
            return []

        source_item = context["item"]
        source_state = run.states.get(source_item.kc_id)
        if source_state is None:
            return []

        target_path = source_item.content.get("target_exam_path")
        skipped: list[dict[str, str]] = []
        raw_candidates: list[tuple[int, float, str, str, DiagnosticItem, bool]] = []
        target_kcs = self._grade8_follow_up_target_kcs(source_item)
        for kc_id in target_kcs:
            if kc_id not in run.states:
                skipped.append({"kc_id": kc_id, "reason": "kc_not_in_scope"})
                continue
            state = run.states[kc_id]
            if state.label == "tested_mastered":
                skipped.append({"kc_id": kc_id, "reason": "already_tested_mastered"})
                continue
            if state.direct_evidence_count >= GRADE8_MAX_TESTS_PER_KC:
                skipped.append({"kc_id": kc_id, "reason": "max_tests_per_kc"})
                continue
            usable = [
                item for item in self.items_by_kc.get(kc_id, [])
                if item.id not in run.seen_items
                and self._is_grade8_exam_path_item(item)
                and not self._surface_was_seen(run, item)
            ]
            same_path = [item for item in usable if item.content.get("target_exam_path") == target_path]
            if same_path:
                usable = same_path
            if not usable:
                skipped.append({"kc_id": kc_id, "reason": "no_distinct_follow_up_item"})
                continue
            for item in usable:
                role_rank = self._grade8_item_role_rank(item)
                kc_rank = target_kcs.index(kc_id)
                raw_candidates.append((kc_rank * 10 + role_rank, -self._cheap_candidate_score(run, kc_id, item), kc_id, item.id, item))

        if not raw_candidates:
            return []

        selected_pool = sorted(raw_candidates)[:PARTICLE_PREFILTER_LIMIT]
        entropy_before = selector.entropy()
        candidates: list[dict[str, Any]] = []
        for _rank, _cheap, kc_id, _item_id, item in selected_pool:
            payload = self._candidate_score(run, kc_id, item, selector=selector, entropy_before=entropy_before)
            same_kc_bonus = 36.0 if kc_id == source_item.kc_id else 18.0
            unknown_bonus = 10.0 if context["response_type"] == "unknown" else 0.0
            target_order_bonus = max(0.0, 24.0 - float(_rank))
            payload["score"] = round(payload["score"] + same_kc_bonus + unknown_bonus + target_order_bonus, 4)
            payload["reason"] = "grade8_confirm_unresolved_direct_miss"
            payload["selector_strategy"] = "grade8_unresolved_follow_up_state_space_eig"
            payload["deep_dive_reason"] = self._grade8_follow_up_reason(context, item)
            payload["source_failed_kc"] = source_item.kc_id
            payload["source_failed_item"] = source_item.id
            payload["source_response_type"] = context["response_type"]
            payload["candidate_pool"] = {
                "target_exam_path": target_path,
                "target_kcs": target_kcs,
                "pool_size": len(raw_candidates),
                "source_probability_band": source_state.probability_band,
                "source_p_mastery": round(source_state.p_mastery, 4),
                "surface_relaxed": False,
            }
            payload["skipped_candidates"] = skipped[:12]
            candidates.append(payload)
        return candidates

    def _last_grade8_unresolved_miss_context(self, run: DiagnosticRun) -> dict[str, Any] | None:
        if self.mode != "assessment" or not run.state_transitions:
            return None
        transition = run.state_transitions[-1]
        if transition.get("correct") is True:
            return None
        item = self.items_by_id.get(str(transition.get("item_id")))
        if item is None or not self._is_grade8_exam_path_item(item):
            return None
        state = run.states.get(item.kc_id)
        if state is None:
            return None
        if state.direct_evidence_count >= GRADE8_MAX_TESTS_PER_KC:
            return None
        if state.label == "tested_mastered":
            return None
        response_type = "answer"
        for evidence in reversed(run.evidence_by_kc.get(item.kc_id, [])):
            if evidence.get("item_id") == item.id:
                response_type = str(evidence.get("response_type") or "answer")
                break
        return {"item": item, "response_type": response_type, "transition": transition}

    def _grade8_follow_up_target_kcs(self, item: DiagnosticItem) -> list[str]:
        ordered = [item.kc_id] if item.kc_id in self.graph else []
        for kc_id in self._grade8_deep_dive_target_kcs(item):
            if kc_id not in ordered:
                ordered.append(kc_id)
        return ordered

    def _grade8_follow_up_reason(self, context: dict[str, Any], item: DiagnosticItem) -> str:
        source_item = context["item"]
        response_text = "unknown" if context["response_type"] == "unknown" else "wrong"
        if item.kc_id == source_item.kc_id:
            relation = "same KC confirmation because one miss left the node unresolved"
        elif item.kc_id in self.graph and source_item.kc_id in self.graph and nx.has_path(self.graph, item.kc_id, source_item.kc_id):
            relation = "near prerequisite probe after unresolved miss"
        else:
            relation = "related diagnostic follow-up after unresolved miss"
        role = item.content.get("item_role") or "item"
        return f"{response_text}_on:{source_item.id}; follow_up:{relation}; role:{role}"

    def _grade8_deep_dive_candidates(
        self,
        run: DiagnosticRun,
        selector: KnowledgeStateParticleSelector,
    ) -> list[dict[str, Any]]:
        context = self._last_grade8_failed_context(run)
        if context is None:
            return []

        source_item = context["item"]
        target_path = source_item.content.get("target_exam_path")
        target_kcs = self._grade8_deep_dive_target_kcs(source_item)
        if not target_kcs:
            return []

        skipped: list[dict[str, str]] = []
        raw_candidates: list[tuple[int, float, str, str, DiagnosticItem]] = []
        for kc_id in target_kcs:
            if kc_id not in run.states:
                skipped.append({"kc_id": kc_id, "reason": "kc_not_in_scope"})
                continue
            state = run.states[kc_id]
            if state.label == "tested_mastered":
                skipped.append({"kc_id": kc_id, "reason": "already_tested_mastered"})
                continue
            if state.direct_evidence_count >= GRADE8_MAX_TESTS_PER_KC:
                skipped.append({"kc_id": kc_id, "reason": "max_tests_per_kc"})
                continue
            usable = [
                item for item in self.items_by_kc.get(kc_id, [])
                if item.id not in run.seen_items
                and self._is_grade8_exam_path_item(item)
                and item.content.get("target_exam_path") == target_path
                and not self._surface_was_seen(run, item)
            ]
            if not usable:
                skipped.append({"kc_id": kc_id, "reason": "no_usable_deep_dive_item"})
                continue
            for item in usable:
                role_rank = self._grade8_item_role_rank(item)
                raw_candidates.append((role_rank, -self._cheap_candidate_score(run, kc_id, item), kc_id, item.id, item))

        if not raw_candidates:
            return []

        selected_pool = sorted(raw_candidates)[:PARTICLE_PREFILTER_LIMIT]
        entropy_before = selector.entropy()
        candidates: list[dict[str, Any]] = []
        for role_rank, _cheap, kc_id, _item_id, item in selected_pool:
            payload = self._candidate_score(run, kc_id, item, selector=selector, entropy_before=entropy_before)
            response_weight = 1.5 if context["response_type"] == "unknown" else 1.0
            role_bonus = max(0.0, 30.0 - role_rank * 4.0)
            payload["score"] = round(payload["score"] * response_weight + role_bonus, 4)
            payload["reason"] = "grade8_deep_dive_after_failed_response"
            payload["selector_strategy"] = "grade8_deep_dive_state_space_eig"
            payload["deep_dive_reason"] = self._grade8_deep_dive_reason(context, item)
            payload["source_failed_kc"] = source_item.kc_id
            payload["source_failed_item"] = source_item.id
            payload["source_response_type"] = context["response_type"]
            payload["candidate_pool"] = {
                "target_exam_path": target_path,
                "target_kcs": list(target_kcs),
                "pool_size": len(raw_candidates),
            }
            payload["skipped_candidates"] = skipped[:12]
            candidates.append(payload)
        return candidates

    def _last_grade8_failed_context(self, run: DiagnosticRun) -> dict[str, Any] | None:
        if self.mode != "assessment" or not run.state_transitions:
            return None
        transition = run.state_transitions[-1]
        if transition.get("correct") is True:
            return None
        item = self.items_by_id.get(str(transition.get("item_id")))
        if item is None or not self._is_grade8_exam_path_item(item):
            return None
        response_type = "answer"
        for evidence in reversed(run.evidence_by_kc.get(item.kc_id, [])):
            if evidence.get("item_id") == item.id:
                response_type = str(evidence.get("response_type") or "answer")
                break
        return {"item": item, "response_type": response_type, "transition": transition}

    def _grade8_deep_dive_target_kcs(self, item: DiagnosticItem) -> list[str]:
        ordered: list[str] = []
        for key in ("diagnoses_kcs", "requires_kcs"):
            for kc_id in item.content.get(key, []) or []:
                kc = str(kc_id)
                if kc in self.graph and kc not in ordered:
                    ordered.append(kc)
        if item.kc_id in self.graph:
            ancestors = sorted(
                nx.ancestors(self.graph, item.kc_id),
                key=lambda kc: nx.shortest_path_length(self.graph, kc, item.kc_id) if nx.has_path(self.graph, kc, item.kc_id) else 999,
            )
            for kc in ancestors:
                if kc not in ordered:
                    ordered.append(kc)
        if item.kc_id not in ordered:
            ordered.append(item.kc_id)
        return ordered

    def _grade8_deep_dive_reason(self, context: dict[str, Any], item: DiagnosticItem) -> str:
        source_item = context["item"]
        response_text = "unknown" if context["response_type"] == "unknown" else "wrong"
        role = item.content.get("item_role") or "item"
        if item.kc_id in {str(kc) for kc in source_item.content.get("diagnoses_kcs", []) or []}:
            relation = "diagnosed misconception"
        elif item.kc_id in {str(kc) for kc in source_item.content.get("requires_kcs", []) or []}:
            relation = "required prerequisite"
        elif item.kc_id in self.graph and source_item.kc_id in self.graph and nx.has_path(self.graph, item.kc_id, source_item.kc_id):
            relation = "graph ancestor prerequisite"
        else:
            relation = "same skill family follow-up"
        return f"{response_text}_on:{source_item.id}; probe:{relation}; role:{role}"

    def _surface_was_seen(self, run: DiagnosticRun, item: DiagnosticItem) -> bool:
        signature = item.content.get("surface_signature")
        if not signature:
            return False
        for seen_id in run.seen_items:
            seen_item = self.items_by_id.get(seen_id)
            if seen_item and seen_item.content.get("surface_signature") == signature:
                return True
        return False

    def apply_response(self, run: DiagnosticRun, item: DiagnosticItem, response: DiagnosticResponse) -> None:
        if item.id != response.item_id:
            raise ValueError("response.item_id does not match item.id")

        selector = self._selector_for_run(run)
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
        changes.extend(selector.update_from_response(run, item, response))
        changes.extend(self._apply_graph_inference(run, item, response.correct, response.response_type, direct_delta))
        run.state_transitions.append({
            "step": len(run.state_transitions) + 1,
            "item_id": item.id,
            "kc_id": item.kc_id,
            "correct": response.correct,
            "changes": changes,
        })

    def _candidate_score(
        self,
        run: DiagnosticRun,
        kc_id: str,
        item: DiagnosticItem,
        selector: KnowledgeStateParticleSelector | None = None,
        entropy_before: float | None = None,
    ) -> dict[str, Any]:
        state = run.states[kc_id]
        item_quality = self._item_quality(item)
        selector = selector or self._selector_for_run(run)
        payload = selector.score_item(run, item, item_quality, entropy_before=entropy_before)
        if self.mode != "assessment" and state.direct_evidence_count == 1:
            payload["score"] = round(payload["score"] + 80.0, 4)
            payload["reason"] = "complete_min_direct_evidence"
        payload.update({
            "kc_id": kc_id,
            "item_id": item.id,
            "item": item,
            "p_mastery": round(state.p_mastery, 4),
        })
        return payload

    def _cheap_candidate_score(self, run: DiagnosticRun, kc_id: str, item: DiagnosticItem) -> float:
        state = run.states[kc_id]
        p_correct = self._predict_correct(state.p_mastery, item)
        return self._uncertainty(state.p_mastery) + 0.25 * (4.0 * p_correct * (1.0 - p_correct)) + 0.1 * self._item_quality(item)

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
            if self._strong_inference_allowed(item):
                for required in item.content.get("requires_kcs", []) or []:
                    changes.extend(self._strong_update(run, str(required), 0.84, f"strong_open_requires:{item.id}"))
        else:
            if self._strong_inference_allowed(item):
                for diagnosed in item.content.get("diagnoses_kcs", []) or []:
                    changes.extend(self._strong_update(run, str(diagnosed), 0.26, f"strong_open_diagnoses:{item.id}"))
        return changes

    def _selector_for_run(self, run: DiagnosticRun) -> KnowledgeStateParticleSelector:
        return KnowledgeStateParticleSelector.from_run(self.graph, run)

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
