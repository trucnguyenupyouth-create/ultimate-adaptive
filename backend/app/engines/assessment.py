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

import random
from dataclasses import dataclass, field
from typing import Optional
from uuid import UUID

from app.engines.knowledge_graph import KnowledgeGraph
from app.engines import irt as IRT


# ── Session state ─────────────────────────────────────────────────────────────

@dataclass
class AssessmentSession:
    student_id: str
    kc: str                             # current KC being tested
    theta: float = 0.0                  # IRT ability (Layer 1+ updates this)
    theta_se: float = 1.0               # standard error of θ
    streak_correct: int = 0
    streak_wrong: int = 0
    n: int = 0                          # total items answered (global, for hard cap only)
    kc_n: int = 0                       # items answered in CURRENT KC (reset on KC switch)
    responses: list[tuple] = field(default_factory=list)  # (correct, a, b, c) — global theta history
    kc_responses: list[tuple] = field(default_factory=list)  # (correct, a, b, c) — PER-KC evidence (reset on switch)
    kc_results: dict[str, str] = field(default_factory=dict)  # kc_id: 'pass'|'fail'|'gap'
    known_kcs: set[str] = field(default_factory=set)
    is_done: bool = False

    def to_dict(self) -> dict:
        return {
            "student_id": self.student_id,
            "kc": self.kc,
            "theta": round(self.theta, 3),
            "theta_se": round(self.theta_se, 3),
            "streak_correct": self.streak_correct,
            "streak_wrong": self.streak_wrong,
            "n": self.n,
            "kc_n": self.kc_n,
            "responses": self.responses,
            "kc_responses": self.kc_responses,
            "kc_results": self.kc_results,
            "known_kcs": list(self.known_kcs),
            "is_done": self.is_done,
        }

    @classmethod
    def from_dict(cls, d: dict) -> "AssessmentSession":
        s = cls(student_id=d["student_id"], kc=d["kc"])
        s.theta = d.get("theta", 0.0)
        s.theta_se = d.get("theta_se", 1.0)
        s.streak_correct = d.get("streak_correct", 0)
        s.streak_wrong = d.get("streak_wrong", 0)
        s.n = d.get("n", 0)
        s.kc_n = d.get("kc_n", 0)
        s.responses = d.get("responses", [])
        s.kc_responses = d.get("kc_responses", [])
        s.kc_results = d.get("kc_results", {})
        s.known_kcs = set(d.get("known_kcs", []))
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
      - KC selection: same KST (unchanged)
      - Item selection: IRT ZPD (item difficulty ≈ student theta)
      - Pass/fail: streak counting + SE-based early stop
        When SE < SE_STOP and n >= MIN_ITEMS: compare theta vs avg_b(KC)
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
        start_kc = self.kg.find_starting_kc(known_kcs)
        if start_kc is None:
            return {"status": "no_kcs_available", "session": None, "item": None}

        session = AssessmentSession(
            student_id=student_id,
            kc=start_kc,
            theta=theta,
            known_kcs=set(known_kcs),
            kc_n=0,
        )

        item = self._pick_item(start_kc, seen_items=set(), available_items=available_items,
                               theta=theta, kc_n=0)
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
    ) -> dict:
        """
        Process a student response and advance the session.

        Returns one of:
            {"status": "continue", "session": ..., "item": ...}
            {"status": "done", "session": ..., "result": {...}}
        """
        s = AssessmentSession.from_dict(session_dict)
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

        # ── Layer 1: Update theta via MLE ─────────────────────────────────
        # Use global responses for theta (more data = better global estimate).
        # Per-KC responses used only for the SE gate below.
        if self.use_irt and len(s.responses) >= 2:
            s.theta, s.theta_se = IRT.update_theta(s.responses, init=s.theta)

        # ── Pass / Fail decision ──────────────────────────────────────────

        # L1: SE-based early stop — theta reliable enough to decide.
        # UNIT FIX: gate on kc_n (per-KC items) not n (global session items).
        # Both conditions now count in the same unit as the decision: per-KC.
        if self.use_irt and s.theta_se < self.SE_STOP and s.kc_n >= self.MIN_KC_ITEMS_FOR_IRT:
            avg_b = self._avg_difficulty(s.kc, available_items)
            if s.theta > avg_b:
                return self._pass_kc(s, available_items)
            else:
                return self._fail_kc(s, available_items)

        # L0/L1: Streak-based pass/fail (L1 uses this as fallback if SE not reached)
        if s.streak_correct >= self.PASS_STREAK:
            return self._pass_kc(s, available_items)

        if s.streak_wrong >= self.FAIL_STREAK:
            return self._fail_kc(s, available_items)

        # ── Hard cap ─────────────────────────────────────────────────────
        if s.n >= self.MAX_ITEMS:
            return self._finalize(s)

        # ── Continue: pick next item in same KC ───────────────────────────
        seen = {r[0] if isinstance(r, tuple) and len(r) > 0 and isinstance(r[0], str)
                else None for r in s.responses}
        # More reliable seen set from item id tracking
        item_id = item.get("id")
        seen_ids: set[str] = set()
        if item_id:
            seen_ids.add(item_id)

        next_item = self._pick_item(s.kc, seen_items=seen_ids, available_items=available_items, theta=s.theta)
        return {"status": "continue", "session": s.to_dict(), "item": next_item}

    # ── Internal ──────────────────────────────────────────────────────────

    def _pass_kc(self, s: AssessmentSession, available_items) -> dict:
        s.kc_results[s.kc] = "pass"
        s.known_kcs.add(s.kc)
        s.streak_correct = s.streak_wrong = 0

        next_kc = self.kg.navigate(s.kc, passed=True, known_kcs=s.known_kcs)
        if next_kc:
            s.kc = next_kc
            s.kc_n = 0          # reset per-KC item counter
            s.kc_responses = [] # reset per-KC evidence — new KC, fresh IRT gate
            item = self._pick_item(next_kc, seen_items=set(), available_items=available_items,
                                   theta=s.theta, kc_n=0)
            return {"status": "continue", "session": s.to_dict(), "item": item}

        return self._finalize(s)

    def _fail_kc(self, s: AssessmentSession, available_items) -> dict:
        s.kc_results[s.kc] = "fail"
        s.streak_correct = s.streak_wrong = 0

        next_kc = self.kg.navigate(s.kc, passed=False, known_kcs=s.known_kcs)
        if next_kc:
            s.kc = next_kc
            s.kc_n = 0          # reset per-KC item counter
            s.kc_responses = [] # reset per-KC evidence — new KC, fresh IRT gate
            item = self._pick_item(next_kc, seen_items=set(), available_items=available_items,
                                   theta=s.theta, kc_n=0)
            return {"status": "continue", "session": s.to_dict(), "item": item}

        # No prerequisite to go to — fundamental gap at root level
        s.kc_results[s.kc] = "fundamental_gap"
        return self._finalize(s)

    def _finalize(self, s: AssessmentSession) -> dict:
        s.is_done = True
        gaps = [k for k, v in s.kc_results.items() if v != "pass"]
        mastered = [k for k, v in s.kc_results.items() if v == "pass"]
        return {
            "status": "done",
            "session": s.to_dict(),
            "result": {
                "theta": round(s.theta, 3),
                "theta_se": round(s.theta_se, 3),
                "gaps": gaps,
                "mastered": mastered,
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
