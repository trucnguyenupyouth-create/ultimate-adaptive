"""
Assessment Engine — Layer 0 (CAT Controller, streak-based)

Orchestrates the Computerised Adaptive Test using KST navigation.
Layer 0: streak counting for pass/fail (simple, auditable)
Layer 1: will inject IRT item selection
Layer 2: will inject BKT mastery tracking

Session state is a plain dict — stored in Redis for fast access.
"""

from __future__ import annotations

import random
from dataclasses import dataclass, field
from typing import Optional
from uuid import UUID

from app.engines.knowledge_graph import KnowledgeGraph


# ── Session state ─────────────────────────────────────────────────────────────

@dataclass
class AssessmentSession:
    student_id: str
    kc: str                             # current KC being tested
    theta: float = 0.0                  # IRT ability (Layer 1+ updates this)
    theta_se: float = 1.0               # standard error of θ
    streak_correct: int = 0
    streak_wrong: int = 0
    n: int = 0                          # total items answered
    responses: list[tuple] = field(default_factory=list)  # (correct, a, b, c)
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
            "responses": self.responses,
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
        s.responses = d.get("responses", [])
        s.kc_results = d.get("kc_results", {})
        s.known_kcs = set(d.get("known_kcs", []))
        s.is_done = d.get("is_done", False)
        return s


# ── CAT Controller ────────────────────────────────────────────────────────────

class CATController:
    """
    Computerised Adaptive Test controller.

    Layer 0 decisions:
      - KC selection: KST middle-node (find_starting_kc / navigate)
      - Item selection: random within KC (Layer 1 replaces with IRT ZPD)
      - Pass/fail: streak counting (3 correct = pass, 3 wrong = fail)
        (Layer 2 replaces with BKT threshold)

    Stop criteria (already future-proof for Layer 1):
      - SE < SE_STOP and n >= MIN_ITEMS_FOR_STOP → reliable θ estimate
      - n >= MAX_ITEMS → hard cap (prevent infinite sessions)
      - Graph exhausted (no more eligible KCs)
    """

    PASS_STREAK = 3    # 3 correct in a row → KC passed
    FAIL_STREAK = 3    # 3 wrong in a row → KC failed (go to prerequisite)
    SE_STOP = 0.30     # θ reliable enough (Layer 1 activates this)
    MIN_ITEMS_FOR_STOP = 10
    MAX_ITEMS = 40

    def __init__(self, kg: KnowledgeGraph):
        self.kg = kg

    # ── Public API ────────────────────────────────────────────────────────

    def start(
        self,
        student_id: str,
        known_kcs: set[str],
        theta: float = 0.0,
        available_items: dict[str, list[dict]] | None = None,  # kc_id → [item, ...]
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
        )

        item = self._pick_item(start_kc, seen_items=set(), available_items=available_items)
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
        s.streak_correct = (s.streak_correct + 1) if correct else 0
        s.streak_wrong = (s.streak_wrong + 1) if not correct else 0

        # Store response tuple (correct, a, b, c) — Layer 1 will use a,b,c for MLE
        irt_a = item.get("irt_a", 1.0)
        irt_b = item.get("irt_b", 0.0)
        irt_c = item.get("irt_c", 0.25)
        s.responses.append((correct, irt_a, irt_b, irt_c))

        # ── Pass / Fail decision ──────────────────────────────────────────
        if s.streak_correct >= self.PASS_STREAK:
            return self._pass_kc(s, available_items)

        if s.streak_wrong >= self.FAIL_STREAK:
            return self._fail_kc(s, available_items)

        # ── Hard cap ─────────────────────────────────────────────────────
        if s.n >= self.MAX_ITEMS:
            return self._finalize(s)

        # ── Continue: pick next item in same KC ───────────────────────────
        seen = {r_item["id"] for r_item in s.responses if isinstance(r_item, dict)}
        item = self._pick_item(s.kc, seen_items=seen, available_items=available_items)
        return {"status": "continue", "session": s.to_dict(), "item": item}

    # ── Internal ──────────────────────────────────────────────────────────

    def _pass_kc(self, s: AssessmentSession, available_items) -> dict:
        s.kc_results[s.kc] = "pass"
        s.known_kcs.add(s.kc)
        s.streak_correct = s.streak_wrong = 0

        next_kc = self.kg.navigate(s.kc, passed=True, known_kcs=s.known_kcs)
        if next_kc:
            s.kc = next_kc
            item = self._pick_item(next_kc, seen_items=set(), available_items=available_items)
            return {"status": "continue", "session": s.to_dict(), "item": item}

        return self._finalize(s)

    def _fail_kc(self, s: AssessmentSession, available_items) -> dict:
        s.kc_results[s.kc] = "fail"
        s.streak_correct = s.streak_wrong = 0

        next_kc = self.kg.navigate(s.kc, passed=False, known_kcs=s.known_kcs)
        if next_kc:
            s.kc = next_kc
            item = self._pick_item(next_kc, seen_items=set(), available_items=available_items)
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
    ) -> Optional[dict]:
        """
        Layer 0: random item selection from KC's item pool.
        Layer 1 will replace this with IRT ZPD selection.
        """
        if not available_items or kc_id not in available_items:
            return None
        pool = [i for i in available_items[kc_id] if i["id"] not in seen_items]
        return random.choice(pool) if pool else None
