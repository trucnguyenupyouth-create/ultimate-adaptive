"""
Assessment Engine — Layer 0/1 (CAT Controller, IRT-enhanced)

Orchestrates the Computerised Adaptive Test using KST navigation.

Layer 0: streak counting for pass/fail (simple, auditable)
Layer 1: IRT ZPD item selection + MLE theta estimation + SE-based stop
Layer 2: (Learning Loop) BKT mastery tracking — handled by LearningService

Session state is a plain dict — stored in Redis for fast access.

Toggle:
  use_irt=True  → Layer 1 behavior (IRT item selection + theta tracking)
  use_irt=False → Layer 0 behavior (random items + streak counting)
"""

from __future__ import annotations

import math
import random
from dataclasses import dataclass, field
from typing import Optional

from app.engines.knowledge_graph import KnowledgeGraph
from app.engines import irt as IRT


STATE_TESTED_MASTERED = "tested_mastered"
STATE_TESTED_GAP = "tested_gap"
STATE_INFERRED_MASTERED = "inferred_mastered"
STATE_INFERRED_GAP = "inferred_gap"
STATE_UNKNOWN = "unknown"

MASTERY_STATES = {STATE_TESTED_MASTERED, STATE_INFERRED_MASTERED}
GAP_STATES = {STATE_TESTED_GAP, STATE_INFERRED_GAP}
TESTED_STATES = {STATE_TESTED_MASTERED, STATE_TESTED_GAP}
INFERRED_STATES = {STATE_INFERRED_MASTERED, STATE_INFERRED_GAP}

MASTERED_THRESHOLD = 0.80
NOT_MASTERED_THRESHOLD = 0.30
MIN_DIRECT_EVIDENCE_FOR_STATUS = 2
DEFAULT_UNKNOWN_PRIOR = 0.50
KNOWN_KC_PRIOR = 0.90

DIRECT_UPDATE_CLAMP = 0.25
P_MASTERY_MIN = 0.02
P_MASTERY_MAX = 0.98
P_CORRECT_MIN = 0.05
P_CORRECT_MAX = 0.95

ANCESTOR_BOOST_ON_CORRECT = 0.12
DESCENDANT_DECAY_ON_WRONG = 0.12
DISTANCE_DECAY_BASE = 0.60
MAX_GRAPH_DELTA_PER_KC = 0.08

WEIGHT_EXPECTED_GAIN = 100
WEIGHT_RESPONSE_BALANCE = 30
WEIGHT_FRONTIER = 30
WEIGHT_EVIDENCE_COMPLETION = 70
WEIGHT_SPLIT_PRIOR = 10
WEIGHT_ITEM_QUALITY = 10
REPEAT_ITEM_PENALTY = 10000
NO_ITEM_PENALTY = 10000
KC_RETEST_PENALTY = 20

SLIP_GUESS_BY_DIFFICULTY = {
    "easy": (0.08, 0.30),
    "anchor": (0.12, 0.25),
    "medium": (0.12, 0.25),
    "hard": (0.20, 0.18),
}


# ── Session state ─────────────────────────────────────────────────────────────

@dataclass
class AssessmentSession:
    student_id: str
    kc: str                             # current KC being tested
    theta: float = 0.0                  # IRT ability (Layer 1+ updates this)
    theta_se: float = 1.0               # standard error of θ
    kc_theta: float = 0.0               # KC-local theta for the current KC only
    kc_theta_se: float = 1.0            # KC-local SE for the current KC only
    streak_correct: int = 0
    streak_wrong: int = 0
    n: int = 0                          # total items answered (global, for hard cap only)
    kc_n: int = 0                       # items answered in CURRENT KC (reset on KC switch)
    responses: list[tuple] = field(default_factory=list)  # (correct, a, b, c) — global theta history
    kc_responses: list[tuple] = field(default_factory=list)  # (correct, a, b, c) — PER-KC evidence (reset on switch)
    seen_item_ids: list[str] = field(default_factory=list)  # item ids already served in this session
    kc_results: dict[str, str] = field(default_factory=dict)  # kc_id: 'pass'|'fail'|'gap'
    known_kcs: set[str] = field(default_factory=set)
    kc_states: dict[str, str] = field(default_factory=dict)  # kc_id: tested/inferred/unknown state
    kc_mastery: dict[str, float] = field(default_factory=dict)  # kc_id: P(mastery | responses so far)
    direct_evidence_count: dict[str, int] = field(default_factory=dict)
    correct_count: dict[str, int] = field(default_factory=dict)
    wrong_count: dict[str, int] = field(default_factory=dict)
    inferred_update_count: dict[str, int] = field(default_factory=dict)
    state_conflicts: list[dict] = field(default_factory=list)
    frontier_history: list[dict] = field(default_factory=list)
    state_transitions: list[dict] = field(default_factory=list)
    evidence_by_kc: dict[str, list[dict]] = field(default_factory=dict)
    is_done: bool = False

    def to_dict(self) -> dict:
        return {
            "student_id": self.student_id,
            "kc": self.kc,
            "theta": round(self.theta, 3),
            "theta_se": round(self.theta_se, 3),
            "kc_theta": round(self.kc_theta, 3),
            "kc_theta_se": round(self.kc_theta_se, 3),
            "streak_correct": self.streak_correct,
            "streak_wrong": self.streak_wrong,
            "n": self.n,
            "kc_n": self.kc_n,
            "responses": self.responses,
            "kc_responses": self.kc_responses,
            "seen_item_ids": self.seen_item_ids,
            "kc_results": self.kc_results,
            "known_kcs": list(self.known_kcs),
            "kc_states": self.kc_states,
            "kc_mastery": {k: round(v, 4) for k, v in self.kc_mastery.items()},
            "direct_evidence_count": self.direct_evidence_count,
            "correct_count": self.correct_count,
            "wrong_count": self.wrong_count,
            "inferred_update_count": self.inferred_update_count,
            "state_conflicts": self.state_conflicts,
            "frontier_history": self.frontier_history,
            "state_transitions": self.state_transitions,
            "evidence_by_kc": self.evidence_by_kc,
            "is_done": self.is_done,
        }

    @classmethod
    def from_dict(cls, d: dict) -> "AssessmentSession":
        s = cls(student_id=d["student_id"], kc=d["kc"])
        s.theta = d.get("theta", 0.0)
        s.theta_se = d.get("theta_se", 1.0)
        s.kc_theta = d.get("kc_theta", s.theta)
        s.kc_theta_se = d.get("kc_theta_se", 1.0)
        s.streak_correct = d.get("streak_correct", 0)
        s.streak_wrong = d.get("streak_wrong", 0)
        s.n = d.get("n", 0)
        s.kc_n = d.get("kc_n", 0)
        s.responses = d.get("responses", [])
        s.kc_responses = d.get("kc_responses", [])
        s.seen_item_ids = d.get("seen_item_ids", [])
        s.kc_results = d.get("kc_results", {})
        s.known_kcs = set(d.get("known_kcs", []))
        s.kc_states = d.get("kc_states", {})
        s.kc_mastery = d.get("kc_mastery", {})
        s.direct_evidence_count = d.get("direct_evidence_count", {})
        s.correct_count = d.get("correct_count", {})
        s.wrong_count = d.get("wrong_count", {})
        s.inferred_update_count = d.get("inferred_update_count", {})
        s.state_conflicts = d.get("state_conflicts", [])
        s.frontier_history = d.get("frontier_history", [])
        s.state_transitions = d.get("state_transitions", [])
        s.evidence_by_kc = d.get("evidence_by_kc", {})
        s.is_done = d.get("is_done", False)
        return s


# ── CAT Controller ────────────────────────────────────────────────────────────

class CATController:
    """
    Computerised Adaptive Test controller.

    Layer 0 decisions (use_irt=False):
      - KC selection: KST middle-node (find_starting_kc / navigate)
      - Item selection: random within KC
      - Pass/fail: streak counting (3 correct = pass, 3 wrong = fail)

    Layer 1 decisions (use_irt=True):
      - KC selection: frontier over explicit tested/inferred KC states
      - Item selection: IRT ZPD (item difficulty ≈ student theta)
      - Pass/fail: streak counting + SE-based early stop
        When KC-local SE < SE_STOP and kc_n >= MIN_ITEMS: compare kc_theta vs avg_b(KC)
      - Theta: updated via MLE after each response (≥2 data points)

    Layer 2 (Learning Loop, BKT mastery):
      - Handled separately by LearningService, NOT in this controller.
      - Assessment = "what does the student know?" (diagnostic)
      - Learning Loop = "teach the student, build mastery" (remediation)
    """

    PASS_STREAK = 3    # 3 correct in a row → KC passed (L0 fallback)
    FAIL_STREAK = 3    # 3 wrong in a row → KC failed

    # SE_STOP = 0.30 is GRE/SAT-level (high-stakes, one-shot, irreversible).
    # This system is low-stakes + correctable: L2 (BKT) self-corrects over sessions.
    # 0.50 requires ~4-9 items/KC with a=1.0-1.5 → viable with current item pools.
    # Reference: expert recommendation — match SE_STOP to actual risk profile.
    SE_STOP = 0.50

    # Safety floor: prevent IRT from stopping on statistically-tiny samples.
    # With very few items (1-2), the MLE SE formula can return artificially small
    # values due to statistical noise — not reflecting true measurement confidence.
    # UNIT FIX (expert analysis): must use kc_n (per-KC counter), NOT n (global).
    # Rationale: the PASS/FAIL decision is per-KC → all evidence gating it must
    # also be counted per-KC. Using n conflates evidence from other KCs.
    MIN_KC_ITEMS_FOR_IRT = 5   # renamed from MIN_ITEMS_FOR_STOP to make unit explicit
    MAX_ITEMS = 40

    def __init__(self, kg: KnowledgeGraph, use_irt: bool = True):
        self.kg = kg
        self.use_irt = use_irt

    # ── Public API ────────────────────────────────────────────────────────

    def start(
        self,
        student_id: str,
        known_kcs: set[str],
        theta: float = 0.0,
        available_items: dict[str, list[dict]] | None = None,
    ) -> dict:
        """
        Start a new assessment session.

        Returns:
            {
                "session": AssessmentSession.to_dict(),
                "item": {id, content, kc_id} | None,
                "status": "started" | "no_kcs_available"
            }
        """
        session = AssessmentSession(
            student_id=student_id,
            kc="",
            theta=theta,
            kc_theta=theta,
            known_kcs=set(known_kcs),
            kc_n=0,
            kc_states={kc: STATE_INFERRED_MASTERED for kc in known_kcs},
        )
        self._initialize_mastery_state(session, known_kcs)

        candidate = self._select_next_candidate(session, available_items)
        start_kc = candidate["kc_id"] if candidate else None
        if start_kc is None and available_items is None:
            # Fallback keeps old behavior available for sparse tests/graphs.
            start_kc = self.kg.find_starting_kc(known_kcs)
        if start_kc is None:
            return {"status": "no_kcs_available", "session": None, "item": None}

        session.kc = start_kc

        item = candidate["item"] if candidate else self._pick_item(start_kc, seen_items=set(), available_items=available_items,
                                                                    theta=theta, kc_n=0, session=session)
        return {
            "status": "started",
            "session": session.to_dict(),
            "item": item,
        }

    def respond(
        self,
        session_dict: dict,
        item: dict,
        correct: bool,
        available_items: dict[str, list[dict]] | None = None,
        response_meta: dict | None = None,
    ) -> dict:
        """
        Process a student response and advance the session.

        Returns one of:
            {"status": "continue", "session": ..., "item": ...}
            {"status": "done", "session": ..., "result": {...}}
        """
        s = AssessmentSession.from_dict(session_dict)
        item_id = item.get("id")
        if item_id and item_id not in s.seen_item_ids:
            s.seen_item_ids.append(item_id)

        if not s.kc_mastery:
            self._initialize_mastery_state(s, s.known_kcs)

        s.kc = item.get("kc_id") or s.kc
        s.n += 1
        s.kc_n += 1
        s.streak_correct = (s.streak_correct + 1) if correct else 0
        s.streak_wrong = (s.streak_wrong + 1) if not correct else 0

        # Store response tuple for IRT MLE
        irt_a = item.get("irt_a", 1.0)
        irt_b = item.get("irt_b", 0.0)
        irt_c = item.get("irt_c", 0.25)
        response_tuple = (correct, irt_a, irt_b, irt_c)
        s.responses.append(response_tuple)      # global: feeds global theta trajectory
        s.kc_responses.append(response_tuple)  # per-KC: resets on KC switch
        evidence = {
            "step": s.n,
            "item_id": item_id,
            "kc_id": s.kc,
            "correct": correct,
            "irt_a": irt_a,
            "irt_b": irt_b,
            "irt_c": irt_c,
        }
        if response_meta:
            evidence.update(response_meta)
        p_before = self._get_p_mastery(s, s.kc)
        p_correct = self._predict_p_correct(p_before, item)
        evidence.update({
            "p_mastery_before": round(p_before, 4),
            "p_correct_predicted": round(p_correct, 4),
        })
        s.evidence_by_kc.setdefault(s.kc, []).append(evidence)

        changes = self._update_after_response(s, s.kc, item, correct, p_correct)
        p_after_direct = self._get_p_mastery(s, s.kc)
        evidence["p_mastery_after_graph"] = round(p_after_direct, 4)

        # ── Layer 1: Update theta via MLE ─────────────────────────────────
        # Use global responses for theta (more data = better global estimate).
        # Per-KC responses used only for the SE gate below.
        if self.use_irt and len(s.responses) >= 2:
            s.theta, s.theta_se = IRT.update_theta(s.responses, init=s.theta)
        if self.use_irt and len(s.kc_responses) >= 2:
            s.kc_theta, s.kc_theta_se = IRT.update_theta(s.kc_responses, init=s.theta)

        # ── Hard cap ─────────────────────────────────────────────────────
        if s.n >= self.MAX_ITEMS or self._coverage_ready_to_stop(s):
            self._record_state_transition(s, s.kc, self._status_for_kc(s, s.kc), changes, None)
            return self._finalize(s)

        candidate = self._select_next_candidate(s, available_items)
        next_kc = candidate["kc_id"] if candidate else None
        self._record_state_transition(s, s.kc, self._status_for_kc(s, s.kc), changes, next_kc)
        if candidate is None:
            return self._finalize(s)
        if next_kc != s.kc:
            s.kc_n = 0
            s.kc_theta = s.theta
            s.kc_theta_se = 1.0
            s.kc_responses = []
        s.kc = next_kc
        next_item = candidate["item"]
        return {"status": "continue", "session": s.to_dict(), "item": next_item}

    # ── Internal ──────────────────────────────────────────────────────────

    def _initialize_mastery_state(self, s: AssessmentSession, known_kcs: set[str]) -> None:
        for kc_id in self._all_kc_ids():
            s.kc_mastery.setdefault(kc_id, KNOWN_KC_PRIOR if kc_id in known_kcs else DEFAULT_UNKNOWN_PRIOR)
            s.direct_evidence_count.setdefault(kc_id, 0)
            s.correct_count.setdefault(kc_id, 0)
            s.wrong_count.setdefault(kc_id, 0)
            s.inferred_update_count.setdefault(kc_id, 0)
            existing_state = s.kc_states.get(kc_id)
            if existing_state == STATE_TESTED_MASTERED:
                s.kc_mastery[kc_id] = max(s.kc_mastery[kc_id], MASTERED_THRESHOLD)
                s.direct_evidence_count[kc_id] = max(s.direct_evidence_count.get(kc_id, 0), MIN_DIRECT_EVIDENCE_FOR_STATUS)
            elif existing_state == STATE_TESTED_GAP:
                s.kc_mastery[kc_id] = min(s.kc_mastery[kc_id], NOT_MASTERED_THRESHOLD)
                s.direct_evidence_count[kc_id] = max(s.direct_evidence_count.get(kc_id, 0), MIN_DIRECT_EVIDENCE_FOR_STATUS)
            elif existing_state == STATE_INFERRED_MASTERED:
                s.kc_mastery[kc_id] = max(s.kc_mastery[kc_id], MASTERED_THRESHOLD)
                s.inferred_update_count[kc_id] = max(s.inferred_update_count.get(kc_id, 0), 1)
            elif existing_state == STATE_INFERRED_GAP:
                s.kc_mastery[kc_id] = min(s.kc_mastery[kc_id], NOT_MASTERED_THRESHOLD)
                s.inferred_update_count[kc_id] = max(s.inferred_update_count.get(kc_id, 0), 1)
        for kc_id in known_kcs:
            s.kc_states[kc_id] = STATE_TESTED_MASTERED
            s.direct_evidence_count[kc_id] = max(s.direct_evidence_count.get(kc_id, 0), MIN_DIRECT_EVIDENCE_FOR_STATUS)

    def _select_next_candidate(
        self,
        s: AssessmentSession,
        available_items: dict[str, list[dict]] | None,
    ) -> dict | None:
        completion_candidate = self._current_evidence_completion_candidate(s, available_items)
        if completion_candidate:
            s.frontier_history.append({
                "step": len(s.frontier_history) + 1,
                "selected_kc": completion_candidate["kc_id"],
                "selected_item": completion_candidate["item_id"],
                "reason": "complete_min_direct_evidence",
                "candidates": [self._candidate_log(completion_candidate)],
            })
            return completion_candidate

        candidates: list[dict] = []
        seen_ids = set(s.seen_item_ids)
        for kc_id in self._all_kc_ids():
            if not self._is_candidate_kc(kc_id, s, available_items):
                continue
            item = self._choose_representative_item(kc_id, s, available_items, seen_ids)
            details = self._candidate_score(kc_id, item, s, seen_ids)
            candidates.append(details)

        if not candidates:
            s.frontier_history.append({
                "step": len(s.frontier_history) + 1,
                "selected_kc": None,
                "reason": "no_candidate_items",
                "candidates": [],
            })
            return None

        selected = max(candidates, key=lambda c: c["score"])
        s.frontier_history.append({
            "step": len(s.frontier_history) + 1,
            "selected_kc": selected["kc_id"],
            "selected_item": selected["item_id"],
            "reason": selected["reason"],
            "candidates": [
                self._candidate_log(c)
                for c in sorted(candidates, key=lambda c: c["score"], reverse=True)[:5]
            ],
        })
        return selected

    def _current_evidence_completion_candidate(
        self,
        s: AssessmentSession,
        available_items: dict[str, list[dict]] | None,
    ) -> dict | None:
        if not s.kc:
            return None
        direct_n = s.direct_evidence_count.get(s.kc, 0)
        if direct_n <= 0 or direct_n >= MIN_DIRECT_EVIDENCE_FOR_STATUS:
            return None
        item = self._choose_representative_item(s.kc, s, available_items, set(s.seen_item_ids))
        if item is None:
            return None
        details = self._candidate_score(s.kc, item, s, set(s.seen_item_ids))
        details["reason"] = "complete_min_direct_evidence"
        return details

    def _candidate_log(self, candidate: dict) -> dict:
        """Keep frontier logs compact and JSON-friendly."""
        return {key: value for key, value in candidate.items() if key != "item"}

    def _is_candidate_kc(
        self,
        kc_id: str,
        s: AssessmentSession,
        available_items: dict[str, list[dict]] | None,
    ) -> bool:
        if self._status_for_kc(s, kc_id) in {"mastered", "not_mastered"}:
            return False
        if available_items is not None:
            unseen = [
                item for item in available_items.get(kc_id, [])
                if item.get("id") not in s.seen_item_ids
            ]
            if not unseen:
                return False

        for parent in self._direct_prerequisites(kc_id):
            if self._status_for_kc(s, parent) == "not_mastered":
                return False
        return True

    def _candidate_score(
        self,
        kc_id: str,
        item: dict | None,
        s: AssessmentSession,
        seen_ids: set[str],
    ) -> dict:
        p_mastery = self._get_p_mastery(s, kc_id)
        p_correct = self._predict_p_correct(p_mastery, item or {})
        p_wrong = 1.0 - p_correct
        gain_correct = self._gain_if_correct(kc_id, s)
        gain_wrong = self._gain_if_wrong(kc_id, s)
        expected_gain = p_correct * gain_correct + p_wrong * gain_wrong
        response_balance = 4.0 * p_correct * p_wrong
        frontier_score, reason = self._frontier_position_score(kc_id, s)
        evidence_completion = self._evidence_completion_score(kc_id, s)
        split_prior = self._split_prior(kc_id, s)
        item_quality = self._item_quality_score(item)
        penalty = self._penalty(kc_id, item, s, seen_ids)
        score = (
            WEIGHT_EXPECTED_GAIN * expected_gain
            + WEIGHT_RESPONSE_BALANCE * response_balance
            + WEIGHT_FRONTIER * frontier_score
            + WEIGHT_EVIDENCE_COMPLETION * evidence_completion
            + WEIGHT_SPLIT_PRIOR * split_prior
            + WEIGHT_ITEM_QUALITY * item_quality
            - penalty
        )
        ancestors = set(self.kg.get_prerequisites_recursive(kc_id))
        descendants = set(self.kg.get_successors_recursive(kc_id))
        return {
            "kc_id": kc_id,
            "item": item,
            "item_id": item.get("id") if item else None,
            "score": round(score, 4),
            "reason": reason,
            "p_mastery": round(p_mastery, 4),
            "p_correct": round(p_correct, 4),
            "gain_if_correct": round(gain_correct, 4),
            "gain_if_wrong": round(gain_wrong, 4),
            "expected_gain": round(expected_gain, 4),
            "response_balance": round(response_balance, 4),
            "frontier_score": round(frontier_score, 4),
            "evidence_completion": round(evidence_completion, 4),
            "split_prior": round(split_prior, 4),
            "item_quality_score": round(item_quality, 4),
            "penalty": penalty,
            "unknown_ancestors": sum(1 for k in ancestors if self._status_for_kc(s, k) == "unknown"),
            "unknown_descendants": sum(1 for k in descendants if self._status_for_kc(s, k) == "unknown"),
            "item_count": 0 if item is None else 1,
            "has_items": item is not None,
        }

    def _choose_representative_item(
        self,
        kc_id: str,
        s: AssessmentSession,
        available_items: dict[str, list[dict]] | None,
        seen_ids: set[str],
    ) -> dict | None:
        if not available_items or kc_id not in available_items:
            return None
        pool = [item for item in available_items[kc_id] if item.get("id") not in seen_ids]
        if not pool:
            return None

        p_mastery = self._get_p_mastery(s, kc_id)
        direct_n = s.direct_evidence_count.get(kc_id, 0)
        if direct_n == 0:
            difficulty_order = {"anchor": 0, "medium": 1, "easy": 2, "hard": 3}
        elif p_mastery >= 0.65:
            difficulty_order = {"medium": 0, "hard": 1, "anchor": 2, "easy": 3}
        elif p_mastery <= 0.40:
            difficulty_order = {"easy": 0, "anchor": 1, "medium": 2, "hard": 3}
        else:
            difficulty_order = {"anchor": 0, "medium": 1, "easy": 2, "hard": 3}

        return sorted(
            pool,
            key=lambda item: (
                difficulty_order.get(self._difficulty_tag(item), 4),
                -int(item.get("is_diagnostic_anchor", False)),
                -float(item.get("irt_a", 1.0)),
                abs(float(item.get("irt_b", 0.0))),
            ),
        )[0]

    def _update_after_response(
        self,
        s: AssessmentSession,
        kc_id: str,
        item: dict,
        correct: bool,
        p_correct: float,
    ) -> list[dict]:
        changes: list[dict] = []
        p_before = self._get_p_mastery(s, kc_id)
        slip, _guess = self._slip_guess(item)
        if correct:
            raw_posterior = p_before * (1.0 - slip) / max(p_correct, 1e-10)
        else:
            raw_posterior = p_before * slip / max(1.0 - p_correct, 1e-10)
        p_after_direct = self._capped_update(p_before, raw_posterior, DIRECT_UPDATE_CLAMP)
        self._set_p_mastery(s, kc_id, p_after_direct, "direct_correct" if correct else "direct_wrong", changes)

        s.direct_evidence_count[kc_id] = s.direct_evidence_count.get(kc_id, 0) + 1
        if correct:
            s.correct_count[kc_id] = s.correct_count.get(kc_id, 0) + 1
            self._propagate_correct_to_ancestors(s, kc_id, changes)
        else:
            s.wrong_count[kc_id] = s.wrong_count.get(kc_id, 0) + 1
            self._propagate_wrong_to_descendants(s, kc_id, changes)

        self._refresh_kc_states(s)
        return changes

    def _propagate_correct_to_ancestors(self, s: AssessmentSession, kc_id: str, changes: list[dict]) -> None:
        for ancestor in self.kg.get_prerequisites_recursive(kc_id):
            if s.kc_states.get(ancestor) in TESTED_STATES:
                continue
            distance = self._shortest_path_length(ancestor, kc_id)
            if distance is None:
                continue
            old_p = self._get_p_mastery(s, ancestor)
            boost = ANCESTOR_BOOST_ON_CORRECT * (DISTANCE_DECAY_BASE ** distance) * (1.0 - old_p)
            boost = min(boost, MAX_GRAPH_DELTA_PER_KC)
            if boost > 0:
                self._set_p_mastery(s, ancestor, old_p + boost, f"soft_ancestor_boost:{kc_id}", changes, inferred=True)

    def _propagate_wrong_to_descendants(self, s: AssessmentSession, kc_id: str, changes: list[dict]) -> None:
        for descendant in self.kg.get_successors_recursive(kc_id):
            if s.kc_states.get(descendant) in TESTED_STATES:
                continue
            distance = self._shortest_path_length(kc_id, descendant)
            if distance is None:
                continue
            old_p = self._get_p_mastery(s, descendant)
            decay = DESCENDANT_DECAY_ON_WRONG * (DISTANCE_DECAY_BASE ** distance) * old_p
            decay = min(decay, MAX_GRAPH_DELTA_PER_KC)
            if decay > 0:
                self._set_p_mastery(s, descendant, old_p - decay, f"soft_descendant_decay:{kc_id}", changes, inferred=True)

    def _set_p_mastery(
        self,
        s: AssessmentSession,
        kc_id: str,
        new_p: float,
        reason: str,
        changes: list[dict],
        inferred: bool = False,
    ) -> None:
        old_p = self._get_p_mastery(s, kc_id)
        new_p = max(P_MASTERY_MIN, min(P_MASTERY_MAX, new_p))
        if abs(new_p - old_p) < 1e-6:
            return
        s.kc_mastery[kc_id] = new_p
        if inferred:
            s.inferred_update_count[kc_id] = s.inferred_update_count.get(kc_id, 0) + 1
        changes.append({
            "kc_id": kc_id,
            "from_p_mastery": round(old_p, 4),
            "to_p_mastery": round(new_p, 4),
            "reason": reason,
        })

    def _refresh_kc_states(self, s: AssessmentSession) -> None:
        s.kc_states = {}
        s.kc_results = {}
        for kc_id in self._all_kc_ids():
            status = self._status_for_kc(s, kc_id)
            if status == "mastered":
                s.kc_states[kc_id] = STATE_TESTED_MASTERED
                s.kc_results[kc_id] = "pass"
            elif status == "not_mastered":
                s.kc_states[kc_id] = STATE_TESTED_GAP
                s.kc_results[kc_id] = "fundamental_gap" if len(self._direct_prerequisites(kc_id)) == 0 else "fail"
            else:
                p = self._get_p_mastery(s, kc_id)
                if s.inferred_update_count.get(kc_id, 0) > 0 and s.direct_evidence_count.get(kc_id, 0) == 0:
                    if p >= MASTERED_THRESHOLD:
                        s.kc_states[kc_id] = STATE_INFERRED_MASTERED
                    elif p <= NOT_MASTERED_THRESHOLD:
                        s.kc_states[kc_id] = STATE_INFERRED_GAP
        self._refresh_known_kcs(s)

    def _status_for_kc(self, s: AssessmentSession, kc_id: str) -> str:
        direct_n = s.direct_evidence_count.get(kc_id, 0)
        p = self._get_p_mastery(s, kc_id)
        if direct_n >= MIN_DIRECT_EVIDENCE_FOR_STATUS and p >= MASTERED_THRESHOLD:
            return "mastered"
        if direct_n >= MIN_DIRECT_EVIDENCE_FOR_STATUS and p <= NOT_MASTERED_THRESHOLD:
            return "not_mastered"
        return "unknown"

    def _get_p_mastery(self, s: AssessmentSession, kc_id: str) -> float:
        return float(s.kc_mastery.get(kc_id, DEFAULT_UNKNOWN_PRIOR))

    def _predict_p_correct(self, p_mastery: float, item: dict) -> float:
        slip, guess = self._slip_guess(item)
        p = p_mastery * (1.0 - slip) + (1.0 - p_mastery) * guess
        return max(P_CORRECT_MIN, min(P_CORRECT_MAX, p))

    def _slip_guess(self, item: dict) -> tuple[float, float]:
        difficulty = self._difficulty_tag(item)
        return SLIP_GUESS_BY_DIFFICULTY.get(difficulty, SLIP_GUESS_BY_DIFFICULTY["medium"])

    def _difficulty_tag(self, item: dict | None) -> str:
        if not item:
            return "medium"
        label = item.get("difficulty_label") or item.get("difficulty_tag")
        if label in SLIP_GUESS_BY_DIFFICULTY:
            return label
        if item.get("is_diagnostic_anchor", False):
            return "anchor"
        b = item.get("irt_b", 0.0)
        if b <= -0.5:
            return "easy"
        if b >= 1.0:
            return "hard"
        return "medium"

    def _uncertainty(self, s: AssessmentSession, kc_id: str) -> float:
        p = self._get_p_mastery(s, kc_id)
        return 4.0 * p * (1.0 - p)

    def _gain_if_correct(self, kc_id: str, s: AssessmentSession) -> float:
        gain = self._uncertainty(s, kc_id)
        for ancestor in self.kg.get_prerequisites_recursive(kc_id):
            if self._status_for_kc(s, ancestor) != "unknown":
                continue
            distance = self._shortest_path_length(ancestor, kc_id)
            if distance is not None:
                gain += self._uncertainty(s, ancestor) * (DISTANCE_DECAY_BASE ** distance)
        return gain

    def _gain_if_wrong(self, kc_id: str, s: AssessmentSession) -> float:
        gain = self._uncertainty(s, kc_id)
        for descendant in self.kg.get_successors_recursive(kc_id):
            if self._status_for_kc(s, descendant) != "unknown":
                continue
            distance = self._shortest_path_length(kc_id, descendant)
            if distance is not None:
                gain += self._uncertainty(s, descendant) * (DISTANCE_DECAY_BASE ** distance)
        return gain

    def _frontier_position_score(self, kc_id: str, s: AssessmentSession) -> tuple[float, str]:
        direct_prereqs = set(self._direct_prerequisites(kc_id))
        direct_successors = set(self._direct_successors(kc_id))
        status = self._status_for_kc(s, kc_id)
        score = 0.0
        reason = "uncertain_candidate"

        all_direct_prereqs_mastered = bool(direct_prereqs) and all(
            self._status_for_kc(s, parent) == "mastered" for parent in direct_prereqs
        )
        has_unknown_parent = any(self._status_for_kc(s, parent) == "unknown" for parent in direct_prereqs)
        has_not_mastered_child = any(self._status_for_kc(s, child) == "not_mastered" for child in direct_successors)
        has_mastered_parent = any(self._status_for_kc(s, parent) == "mastered" for parent in direct_prereqs)
        has_unknown_child = any(self._status_for_kc(s, child) == "unknown" for child in direct_successors)

        if all_direct_prereqs_mastered and status == "unknown":
            score, reason = 1.0, "all_direct_prerequisites_mastered"
        if has_mastered_parent and status == "unknown" and score < 0.7:
            score, reason = 0.7, "near_mastered_parent_boundary"
        if has_not_mastered_child and status == "unknown" and score < 0.7:
            score, reason = 0.7, "near_not_mastered_child_boundary"
        if has_unknown_parent and has_unknown_child and score < 0.5:
            score, reason = 0.5, "structural_split_candidate"
        return score, reason

    def _evidence_completion_score(self, kc_id: str, s: AssessmentSession) -> float:
        direct_n = s.direct_evidence_count.get(kc_id, 0)
        if 0 < direct_n < MIN_DIRECT_EVIDENCE_FOR_STATUS:
            return 1.0
        return 0.0

    def _split_prior(self, kc_id: str, s: AssessmentSession) -> float:
        unknown_ancestors = sum(
            1 for k in self.kg.get_prerequisites_recursive(kc_id)
            if self._status_for_kc(s, k) == "unknown"
        )
        unknown_descendants = sum(
            1 for k in self.kg.get_successors_recursive(kc_id)
            if self._status_for_kc(s, k) == "unknown"
        )
        return math.log1p(min(unknown_ancestors + 1, unknown_descendants + 1))

    def _item_quality_score(self, item: dict | None) -> float:
        if item is None:
            return 0.0
        score = 1.0 if item.get("is_diagnostic_anchor", False) else 0.0
        difficulty = self._difficulty_tag(item)
        score += {"anchor": 0.8, "medium": 0.6, "easy": 0.4, "hard": 0.4}.get(difficulty, 0.6)
        return score

    def _penalty(self, kc_id: str, item: dict | None, s: AssessmentSession, seen_ids: set[str]) -> int:
        penalty = 0
        if item is None:
            penalty += NO_ITEM_PENALTY
        elif item.get("id") in seen_ids:
            penalty += REPEAT_ITEM_PENALTY
        penalty += KC_RETEST_PENALTY * s.direct_evidence_count.get(kc_id, 0)
        return penalty

    def _capped_update(self, old_p: float, raw_posterior: float, max_delta: float) -> float:
        delta = max(-max_delta, min(max_delta, raw_posterior - old_p))
        return max(P_MASTERY_MIN, min(P_MASTERY_MAX, old_p + delta))

    def _shortest_path_length(self, source: str, target: str) -> int | None:
        graph = getattr(self.kg, "_G", None)
        if graph is None or source not in graph or target not in graph:
            return None
        try:
            import networkx as nx
            return nx.shortest_path_length(graph, source, target)
        except Exception:
            return None

    def _coverage_ready_to_stop(self, s: AssessmentSession) -> bool:
        if s.n < 8:
            return False
        resolved = sum(
            1 for kc_id in self._all_kc_ids()
            if self._status_for_kc(s, kc_id) in {"mastered", "not_mastered"}
        )
        total = max(len(self._all_kc_ids()), 1)
        return resolved / total >= 0.80

    def _pass_kc(self, s: AssessmentSession, available_items) -> dict:
        decided_kc = s.kc
        s.kc_results[s.kc] = "pass"
        changes = self._apply_mastery_closure(s, s.kc)
        s.streak_correct = s.streak_wrong = 0

        if s.n >= self.MAX_ITEMS:
            self._record_state_transition(s, decided_kc, "pass", changes, None)
            return self._finalize(s)

        next_kc = self._select_frontier_kc(s, available_items)
        self._record_state_transition(s, decided_kc, "pass", changes, next_kc)
        if next_kc:
            return self._switch_kc(s, next_kc, available_items)

        return self._finalize(s)

    def _fail_kc(self, s: AssessmentSession, available_items) -> dict:
        decided_kc = s.kc
        is_fundamental = len(self._direct_prerequisites(s.kc)) == 0
        s.kc_results[s.kc] = "fundamental_gap" if is_fundamental else "fail"
        changes = self._apply_gap_closure(s, s.kc)
        s.streak_correct = s.streak_wrong = 0

        if s.n >= self.MAX_ITEMS:
            self._record_state_transition(s, decided_kc, s.kc_results[decided_kc], changes, None)
            return self._finalize(s)

        next_kc = self._select_frontier_kc(s, available_items)
        self._record_state_transition(s, decided_kc, s.kc_results[decided_kc], changes, next_kc)
        if next_kc:
            return self._switch_kc(s, next_kc, available_items)

        return self._finalize(s)

    def _switch_kc(self, s: AssessmentSession, next_kc: str, available_items) -> dict:
        s.kc = next_kc
        s.kc_n = 0
        s.kc_theta = s.theta
        s.kc_theta_se = 1.0
        s.kc_responses = []
        item = self._pick_item(
            next_kc,
            seen_items=set(s.seen_item_ids),
            available_items=available_items,
            theta=s.theta,
            kc_n=0,
        )
        if item is None:
            return self._finalize(s)
        return {"status": "continue", "session": s.to_dict(), "item": item}

    def _apply_mastery_closure(self, s: AssessmentSession, kc_id: str) -> list[dict]:
        changes: list[dict] = []
        self._set_kc_state(s, kc_id, STATE_TESTED_MASTERED, "tested_pass", changes)
        for ancestor in self.kg.get_prerequisites_recursive(kc_id):
            self._set_kc_state(
                s,
                ancestor,
                STATE_INFERRED_MASTERED,
                f"ancestor_of_passed:{kc_id}",
                changes,
            )
        self._refresh_known_kcs(s)
        return changes

    def _apply_gap_closure(self, s: AssessmentSession, kc_id: str) -> list[dict]:
        changes: list[dict] = []
        self._set_kc_state(s, kc_id, STATE_TESTED_GAP, "tested_fail", changes)
        for descendant in self.kg.get_successors_recursive(kc_id):
            self._set_kc_state(
                s,
                descendant,
                STATE_INFERRED_GAP,
                f"descendant_of_failed:{kc_id}",
                changes,
            )
        self._refresh_known_kcs(s)
        return changes

    def _set_kc_state(
        self,
        s: AssessmentSession,
        kc_id: str,
        new_state: str,
        reason: str,
        changes: list[dict],
    ) -> None:
        old_state = s.kc_states.get(kc_id, STATE_UNKNOWN)
        if old_state == new_state:
            return

        conflict = self._is_state_conflict(old_state, new_state)
        if conflict:
            s.state_conflicts.append({
                "kc_id": kc_id,
                "old_state": old_state,
                "new_state": new_state,
                "reason": reason,
                "step": s.n,
            })

        # Direct tested evidence is the strongest signal. Inferred states may
        # replace older inferred/default states, but never overwrite tested truth.
        if old_state in TESTED_STATES and new_state in INFERRED_STATES:
            return

        s.kc_states[kc_id] = new_state
        changes.append({
            "kc_id": kc_id,
            "from": old_state,
            "to": new_state,
            "reason": reason,
        })

    def _is_state_conflict(self, old_state: str, new_state: str) -> bool:
        if old_state == STATE_UNKNOWN or old_state == new_state:
            return False
        return (
            old_state in MASTERY_STATES and new_state in GAP_STATES
        ) or (
            old_state in GAP_STATES and new_state in MASTERY_STATES
        )

    def _refresh_known_kcs(self, s: AssessmentSession) -> None:
        s.known_kcs = {
            kc_id for kc_id, state in s.kc_states.items()
            if state in MASTERY_STATES
        }

    def _record_state_transition(
        self,
        s: AssessmentSession,
        kc_id: str,
        decision: str,
        changes: list[dict],
        next_kc: str | None,
    ) -> None:
        s.state_transitions.append({
            "step": len(s.state_transitions) + 1,
            "kc_id": kc_id,
            "decision": decision,
            "changes": changes,
            "next_kc": next_kc,
            "state_counts": self._state_counts(s),
        })

    def _state_counts(self, s: AssessmentSession) -> dict[str, int]:
        counts = {
            STATE_TESTED_MASTERED: 0,
            STATE_TESTED_GAP: 0,
            STATE_INFERRED_MASTERED: 0,
            STATE_INFERRED_GAP: 0,
            STATE_UNKNOWN: 0,
        }
        for kc_id in self._all_kc_ids():
            counts[s.kc_states.get(kc_id, STATE_UNKNOWN)] += 1
        return counts

    def _select_frontier_kc(
        self,
        s: AssessmentSession,
        available_items: dict[str, list[dict]] | None,
    ) -> str | None:
        candidates = []
        for kc_id in self._all_kc_ids():
            if s.kc_states.get(kc_id, STATE_UNKNOWN) != STATE_UNKNOWN:
                continue
            details = self._frontier_score(kc_id, s, available_items)
            candidates.append(details)

        if not candidates:
            s.frontier_history.append({
                "step": len(s.frontier_history) + 1,
                "selected_kc": None,
                "reason": "all_kcs_classified",
                "candidates": [],
            })
            return None

        with_items = [c for c in candidates if c["has_items"]]
        scored = with_items or candidates
        selected = max(scored, key=lambda c: c["score"])
        s.frontier_history.append({
            "step": len(s.frontier_history) + 1,
            "selected_kc": selected["kc_id"],
            "reason": selected["reason"],
            "candidates": sorted(scored, key=lambda c: c["score"], reverse=True)[:5],
        })
        return selected["kc_id"] if selected["has_items"] or available_items is None else None

    def _frontier_score(
        self,
        kc_id: str,
        s: AssessmentSession,
        available_items: dict[str, list[dict]] | None,
    ) -> dict:
        ancestors = set(self.kg.get_prerequisites_recursive(kc_id))
        descendants = set(self.kg.get_successors_recursive(kc_id))
        direct_prereqs = set(self._direct_prerequisites(kc_id))
        direct_successors = set(self._direct_successors(kc_id))

        unknown_ancestors = sum(
            1 for k in ancestors if s.kc_states.get(k, STATE_UNKNOWN) == STATE_UNKNOWN
        )
        unknown_descendants = sum(
            1 for k in descendants if s.kc_states.get(k, STATE_UNKNOWN) == STATE_UNKNOWN
        )
        closure_gain = 1 + unknown_ancestors + unknown_descendants

        all_prereqs_mastered = bool(direct_prereqs) and all(
            s.kc_states.get(k, STATE_UNKNOWN) in MASTERY_STATES for k in direct_prereqs
        )
        touches_gap_boundary = any(
            s.kc_states.get(k, STATE_UNKNOWN) in GAP_STATES
            for k in direct_prereqs | direct_successors
        )
        touches_mastery_boundary = any(
            s.kc_states.get(k, STATE_UNKNOWN) in MASTERY_STATES
            for k in direct_prereqs | direct_successors
        )
        boundary_bonus = 0
        reason = "max_expected_closure_gain"
        if all_prereqs_mastered:
            boundary_bonus += 80
            reason = "all_direct_prerequisites_mastered"
        if touches_gap_boundary:
            boundary_bonus += 60
            reason = "near_known_gap_boundary"
        if touches_mastery_boundary:
            boundary_bonus += 30

        item_count = len(available_items.get(kc_id, [])) if available_items is not None else 1
        unseen_count = 0
        anchor_count = 0
        if available_items is not None:
            unseen_count = sum(
                1 for item in available_items.get(kc_id, [])
                if item.get("id") not in s.seen_item_ids
            )
            anchor_count = sum(
                1 for item in available_items.get(kc_id, [])
                if item.get("is_diagnostic_anchor", False)
            )
        has_items = item_count > 0
        item_bonus = min(unseen_count, 5) * 10 + min(anchor_count, 3) * 5
        item_penalty = 0 if has_items else -10000
        split_score = len(ancestors) * len(descendants)
        score = closure_gain * 100 + boundary_bonus + item_bonus + split_score + item_penalty

        return {
            "kc_id": kc_id,
            "score": score,
            "reason": reason if has_items else "no_usable_items",
            "closure_gain": closure_gain,
            "unknown_ancestors": unknown_ancestors,
            "unknown_descendants": unknown_descendants,
            "item_count": item_count,
            "unseen_item_count": unseen_count,
            "anchor_count": anchor_count,
            "has_items": has_items,
        }

    def _all_kc_ids(self) -> list[str]:
        return [node["id"] for node in self.kg.to_dict().get("nodes", [])]

    def _direct_prerequisites(self, kc_id: str) -> list[str]:
        graph = getattr(self.kg, "_G", None)
        if graph is None or kc_id not in graph:
            return []
        return list(graph.predecessors(kc_id))

    def _direct_successors(self, kc_id: str) -> list[str]:
        graph = getattr(self.kg, "_G", None)
        if graph is None or kc_id not in graph:
            return []
        return list(graph.successors(kc_id))

    def _finalize(self, s: AssessmentSession) -> dict:
        s.is_done = True
        self._refresh_kc_states(s)
        tested_mastered = sorted(
            k for k, v in s.kc_states.items() if v == STATE_TESTED_MASTERED
        )
        tested_gaps = sorted(
            k for k, v in s.kc_states.items() if v == STATE_TESTED_GAP
        )
        inferred_mastered = sorted(
            k for k, v in s.kc_states.items() if v == STATE_INFERRED_MASTERED
        )
        inferred_gaps = sorted(
            k for k, v in s.kc_states.items() if v == STATE_INFERRED_GAP
        )
        known_states = set(s.kc_states)
        unknown = sorted(k for k in self._all_kc_ids() if k not in known_states)
        gaps = tested_gaps + inferred_gaps
        mastered = tested_mastered + inferred_mastered
        return {
            "status": "done",
            "session": s.to_dict(),
            "result": {
                "theta": round(s.theta, 3),
                "theta_se": round(s.theta_se, 3),
                "gaps": gaps,
                "mastered": mastered,
                "tested_mastered": tested_mastered,
                "tested_gaps": tested_gaps,
                "inferred_mastered": inferred_mastered,
                "inferred_gaps": inferred_gaps,
                "unknown": unknown,
                "frontier_history": s.frontier_history,
                "evidence_by_kc": s.evidence_by_kc,
                "state_transitions": s.state_transitions,
                "state_conflicts": s.state_conflicts,
                "kc_mastery": {k: round(v, 4) for k, v in s.kc_mastery.items()},
                "direct_evidence_count": s.direct_evidence_count,
                "correct_count": s.correct_count,
                "wrong_count": s.wrong_count,
                "inferred_update_count": s.inferred_update_count,
                "fundamental_gaps": [k for k, v in s.kc_results.items() if v == "fundamental_gap"],
                "first_learning_kc": gaps[0] if gaps else None,
                "total_items": s.n,
            },
        }

    def _pick_item(
        self,
        kc_id: str,
        seen_items: set[str],
        available_items: dict[str, list[dict]] | None,
        theta: float = 0.0,
        kc_n: int = 0,
        session: AssessmentSession | None = None,
    ) -> Optional[dict]:
        """
        Constraint-Based Item Selection:

        Cold Start (kc_n == 0):
          1. Filter pool to diagnostic anchors (is_diagnostic_anchor=True, irt_b in [-0.4, 0.4])
          2. Sort by irt_a DESC (highest discrimination = cleanest 0/1 signal)
          3. Randomly pick from top-3 anchors (prevent item exposure / memorisation)
          4. Fallback → ZPD/random if no anchors available

        Subsequent items (kc_n > 0):
          → IRT ZPD (θ-targeted) or random (L0 fallback), unchanged

        References: ALEKS/MAP entry-point tagging, KST Construct-Irrelevant Variance,
        BKT P(Slip) minimisation.
        """
        if not available_items or kc_id not in available_items:
            return None
        pool = [i for i in available_items[kc_id] if i.get("id") not in seen_items]
        if not pool:
            pool = available_items[kc_id]  # all-seen fallback

        # ── Cold Start: Pedagogical filter ───────────────────────────────────
        if kc_n == 0:
            anchors = [
                i for i in pool
                if i.get("is_diagnostic_anchor", False)
                and -0.4 <= i.get("irt_b", 0.0) <= 0.4
            ]
            if anchors:
                # Sort by discrimination DESC, pick randomly from top-3
                anchors_sorted = sorted(anchors, key=lambda i: i.get("irt_a", 1.0), reverse=True)
                top_pool = anchors_sorted[:3]
                return random.choice(top_pool)
            # Fallback: no anchors → proceed to ZPD/random below

        # ── Normal selection: ZPD (L1) or random (L0) ────────────────────────
        if self.use_irt:
            return IRT.select_zpd(theta, pool, target_p=0.65, seen_ids=seen_items)
        else:
            unseen = [i for i in pool if i.get("id") not in seen_items]
            return random.choice(unseen) if unseen else (random.choice(pool) if pool else None)

    def _avg_difficulty(
        self,
        kc_id: str,
        available_items: dict[str, list[dict]] | None,
    ) -> float:
        """Average irt_b of all items in a KC. Used for SE-based pass/fail decision."""
        if not available_items or kc_id not in available_items:
            return 0.0
        items = available_items[kc_id]
        if not items:
            return 0.0
        return sum(i.get("irt_b", 0.0) for i in items) / len(items)
