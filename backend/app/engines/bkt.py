"""
BKT Engine — Layer 2 (Bayesian Knowledge Tracing)

Implements Corbett & Anderson (1994) standard BKT:
  - update_observation(state, correct)         : update P(L) after answering
  - update_learning_event(state, p_t_content)  : update P(L) after viewing content
  - is_mastered(state)                         : P(L) >= MASTERY_THRESHOLD
  - init_with_irt(theta, ...)                  : inject IRT theta into BKT params

Design decisions:
  - Pure Python (math stdlib only), NO external dependencies.
  - BKT state is a plain dataclass — stored in DB (student_kc table).
  - 3-channel IRT integration: theta affects P(L0), P(S), P(T) at KC init.
  - P(G) is NOT affected by theta — it depends on question format.

Default params (per original spec, cold start):
  P(L0) = 0.10  prior probability of knowing (before any instruction)
  P(T)  = 0.30  transition: probability of learning from one opportunity
  P(G)  = 0.25  guess: P(correct | not learned), 0.25 for 4-option MCQ
  P(S)  = 0.10  slip: P(wrong | learned), careless error rate
  threshold = 0.95  → mastered

Content P(T) values (per spec):
  Video (detailed):    0.75–0.85
  Short text/reading:  0.50–0.65
  Worked example:      0.60–0.75
"""

from __future__ import annotations

import math
from dataclasses import dataclass, field
from typing import Optional


# ── Constants ─────────────────────────────────────────────────────────────────

MASTERY_THRESHOLD = 0.95
P_MASTERY_MIN = 0.01
P_MASTERY_MAX = 0.999

# Content type → P(T) mapping (used when asset has no custom bkt_p_transit)
CONTENT_TYPE_P_TRANSIT = {
    "video": 0.80,
    "worked_example": 0.70,
    "text": 0.55,
    "interactive": 0.75,
}


# ── BKT State ─────────────────────────────────────────────────────────────────

@dataclass
class BKTState:
    """
    BKT state for one student × one KC.
    Mirrors the student_kc table columns.
    """
    p_mastery: float = 0.10   # P(L_n) — updated after each observation
    p_know0: float = 0.10     # P(L_0) — prior knowledge (set at KC init)
    p_transit: float = 0.30   # P(T) — learning rate per opportunity
    p_guess: float = 0.25     # P(G) — guessing rate
    p_slip: float = 0.10      # P(S) — slip rate (knows but answers wrong)

    def to_dict(self) -> dict:
        return {
            "p_mastery": round(self.p_mastery, 4),
            "p_know0": round(self.p_know0, 4),
            "p_transit": round(self.p_transit, 4),
            "p_guess": round(self.p_guess, 4),
            "p_slip": round(self.p_slip, 4),
        }

    @classmethod
    def from_dict(cls, d: dict) -> "BKTState":
        return cls(
            p_mastery=d.get("p_mastery", 0.10),
            p_know0=d.get("p_know0", 0.10),
            p_transit=d.get("p_transit", 0.30),
            p_guess=d.get("p_guess", 0.25),
            p_slip=d.get("p_slip", 0.10),
        )


# ── Core BKT update ───────────────────────────────────────────────────────────

def update_observation(state: BKTState, correct: bool) -> BKTState:
    """
    Corbett & Anderson (1994) standard BKT update after one response.

    Step 1 — Bayesian update (posterior given observation):
      P(correct)   = P(L)·(1-P(S)) + (1-P(L))·P(G)
      P(wrong)     = P(L)·P(S) + (1-P(L))·(1-P(G))
      P(L|correct) = P(L)·(1-P(S)) / P(correct)
      P(L|wrong)   = P(L)·P(S) / P(wrong)

    Step 2 — Transition (one learning opportunity):
      P(L_{n+1}) = P(L_n|obs) + (1 - P(L_n|obs)) · P(T)

    Returns new BKTState (immutable update — caller replaces state).
    """
    p = state.p_mastery

    # Observation probabilities
    p_correct_obs = p * (1.0 - state.p_slip) + (1.0 - p) * state.p_guess
    p_wrong_obs   = p * state.p_slip          + (1.0 - p) * (1.0 - state.p_guess)

    # Posterior P(L | observation)
    if correct:
        denominator = max(p_correct_obs, 1e-10)
        p_post = (p * (1.0 - state.p_slip)) / denominator
    else:
        denominator = max(p_wrong_obs, 1e-10)
        p_post = (p * state.p_slip) / denominator

    # Transition: one learning opportunity
    p_next = p_post + (1.0 - p_post) * state.p_transit
    p_next = max(P_MASTERY_MIN, min(P_MASTERY_MAX, p_next))

    return BKTState(
        p_mastery=p_next,
        p_know0=state.p_know0,
        p_transit=state.p_transit,
        p_guess=state.p_guess,
        p_slip=state.p_slip,
    )


def update_learning_event(
    state: BKTState,
    p_transit_content: float = 0.70,
) -> BKTState:
    """
    BKT update after viewing learning content (video, text, etc.).

    Unlike practice (which uses Corbett update), content exposure is modelled
    as a one-shot large transition:
      P_new = P_old + (1 - P_old) × P(T_content)

    Example (from original spec):
      P_old = 0.05, P(T_video) = 0.85
      → P_new = 0.05 + 0.95 × 0.85 = 0.857 ≈ 85%

    p_transit_content comes from content_assets.bkt_p_transit in DB.
    """
    p_new = state.p_mastery + (1.0 - state.p_mastery) * p_transit_content
    p_new = max(P_MASTERY_MIN, min(P_MASTERY_MAX, p_new))

    return BKTState(
        p_mastery=p_new,
        p_know0=state.p_know0,
        p_transit=state.p_transit,
        p_guess=state.p_guess,
        p_slip=state.p_slip,
    )


# ── Mastery check ─────────────────────────────────────────────────────────────

def is_mastered(state: BKTState, threshold: float = MASTERY_THRESHOLD) -> bool:
    """Returns True when P(L) ≥ threshold (default 0.95)."""
    return state.p_mastery >= threshold


# ── IRT → BKT initialisation (3-channel injection) ───────────────────────────

def init_with_irt(
    theta: float,
    base_p_know0: float = 0.10,
    base_p_transit: float = 0.30,
    base_p_guess: float = 0.25,
    base_p_slip: float = 0.10,
) -> BKTState:
    """
    Initialise BKT state for a new KC, adjusting params based on IRT theta.

    3 channels from original spec:

    Channel 1: theta → P(L0) — stronger students have higher prior knowledge
      P(L0) = 0.05 + 0.40 / (1 + exp(-(theta - 0.5)))
      θ=-1.5 → P(L0)≈0.09  |  θ=0.0 → P(L0)≈0.18  |  θ=1.5 → P(L0)≈0.38

    Channel 2: theta → P(S) lower — stronger students are less careless
      P(S) = max(0.04, base_slip - 0.015 * clip(theta, -2, 2))
      θ=2.0 → P(S)=0.07  |  θ=0.0 → P(S)=0.10  |  θ=-2.0 → P(S)=0.13

    Channel 3: theta → P(T) higher — stronger students learn faster
      P(T) = min(0.85, base_transit + 0.04 * clip(theta, -2, 2))
      θ=2.0 → P(T)=0.38  |  θ=0.0 → P(T)=0.30  |  θ=-2.0 → P(T)=0.22

    Channel NOT changed: P(G) — depends on question FORMAT, not student ability.
      IRT controls effective guessing by selecting harder items for strong students.
    """
    # Channel 1: P(L0)
    p_know0 = 0.05 + 0.40 / (1.0 + math.exp(-(theta - 0.5)))
    p_know0 = max(0.05, min(0.45, p_know0))

    # Channel 2: P(S)
    theta_clipped = max(-2.0, min(2.0, theta))
    p_slip = max(0.04, base_p_slip - 0.015 * theta_clipped)

    # Channel 3: P(T)
    p_transit = min(0.85, base_p_transit + 0.04 * theta_clipped)

    # P(G) unchanged
    p_guess = base_p_guess

    return BKTState(
        p_mastery=p_know0,   # initial mastery = P(L0)
        p_know0=p_know0,
        p_transit=p_transit,
        p_guess=p_guess,
        p_slip=p_slip,
    )


# ── Utility ───────────────────────────────────────────────────────────────────

def p_correct_expected(state: BKTState) -> float:
    """
    Expected P(correct) for next item, given current mastery.
    Useful for debugging / Sandbox display.
    """
    p = state.p_mastery
    return p * (1.0 - state.p_slip) + (1.0 - p) * state.p_guess
