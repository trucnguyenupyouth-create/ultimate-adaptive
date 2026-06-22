"""
IRT Engine — Layer 1 (3-Parameter Logistic Model)

Implements:
  - p_correct(theta, a, b, c)       : probability student gets item right
  - information(theta, a, b, c)     : Fisher information at given theta
  - update_theta(responses, init)   : MLE estimate of theta from responses
  - select_zpd(theta, items, target): ZPD item selection

Design decisions:
  - Pure Python (math stdlib only), NO scipy dependency.
  - MLE uses grid search over 801 points in [-4.0, 4.0].
    Precision: 0.01 logit units — sufficient for educational assessment.
  - D = 1.7 scaling constant (standard in psychometrics).

Cold start defaults (per spec):
  a = 1.0  (average discrimination)
  b = 0.0  (medium difficulty)
  c = 0.25 (MCQ 4-option guessing)
  theta_0 = 0.0 (assume average ability for new student)
"""

from __future__ import annotations

import math
import random
from typing import Optional


# ── Constants ─────────────────────────────────────────────────────────────────

D = 1.7          # logistic–normal scaling constant (standard in IRT)
THETA_MIN = -4.0
THETA_MAX = 4.0
GRID_POINTS = 801  # precision: 0.01 logit units


# ── Core functions ────────────────────────────────────────────────────────────

def p_correct(theta: float, a: float, b: float, c: float) -> float:
    """
    3PL: P(X=1 | θ) = c + (1-c) / [1 + exp(-D·a·(θ-b))]

    θ: student ability
    a: item discrimination  (higher = better at separating able vs unable)
    b: item difficulty      (θ=b → student has ~50% chance above guessing floor)
    c: guessing parameter   (lower bound, ~0.25 for 4-option MCQ)
    """
    exponent = -D * a * (theta - b)
    # Clamp exponent to avoid overflow
    exponent = max(-500.0, min(500.0, exponent))
    return c + (1.0 - c) / (1.0 + math.exp(exponent))


def information(theta: float, a: float, b: float, c: float) -> float:
    """
    Fisher information for a 3PL item at given θ.

    I(θ) = D² · a² · (P - c)² · (1 - P) / [(1 - c)² · P + ε]

    Peaks near θ ≈ b (item is most informative near its own difficulty).
    Used for:
      1. Item selection (max information = most informative for current θ)
      2. SE calculation: SE = 1/√(ΣI(θ))
    """
    p = p_correct(theta, a, b, c)
    numerator = (D ** 2) * (a ** 2) * ((p - c) ** 2) * (1.0 - p)
    denominator = ((1.0 - c) ** 2) * p + 1e-10  # avoid div/0
    return numerator / denominator


# ── MLE theta estimation ──────────────────────────────────────────────────────

def update_theta(
    responses: list[tuple[bool, float, float, float]],
    init: float = 0.0,
) -> tuple[float, float]:
    """
    Maximum Likelihood Estimate of θ from response history.

    responses: list of (correct, a, b, c) tuples
    init:      starting θ (not used in grid search, kept for API compatibility)

    Returns: (theta_hat, standard_error)

    Algorithm:
      Grid search over 801 evenly spaced θ values in [-4, 4].
      For each grid point, compute log-likelihood:
        LL(θ) = Σ [ correct·log(P) + (1-correct)·log(1-P) ]
      θ_hat = argmax LL(θ)
      SE = 1/√(ΣI(θ_hat))  — precision of estimate

    Requires ≥2 responses (returns (init, 1.0) if not enough data).
    """
    if len(responses) < 2:
        return init, 1.0

    step = (THETA_MAX - THETA_MIN) / (GRID_POINTS - 1)
    best_ll = float("-inf")
    best_theta = init

    for i in range(GRID_POINTS):
        theta = THETA_MIN + i * step
        ll = 0.0
        for correct, a, b, c in responses:
            p = p_correct(theta, a, b, c)
            p_clamped = max(1e-9, min(1.0 - 1e-9, p))
            ll += math.log(p_clamped) if correct else math.log(1.0 - p_clamped)
        if ll > best_ll:
            best_ll = ll
            best_theta = theta

    # Standard error from Fisher information
    total_info = sum(
        information(best_theta, a, b, c)
        for _, a, b, c in responses
    )
    se = 1.0 / math.sqrt(max(total_info, 0.01))

    return best_theta, se


# ── ZPD item selection ────────────────────────────────────────────────────────

def select_zpd(
    theta: float,
    items: list[dict],
    target_p: float = 0.65,
    seen_ids: set[str] | None = None,
) -> Optional[dict]:
    """
    Zone of Proximal Development: pick item closest to target P(correct|θ).

    Default target_p = 0.65:
      - Not too easy (boring) → not too hard (frustrating)
      - Optimal challenge zone for learning

    In practice phase, target_p shifts by mastery:
      Early (P(L) < 0.4):   target_p = 0.75  (build confidence)
      Mid   (0.4–0.75):     target_p = 0.65  (challenge zone)
      Late  (P(L) ≥ 0.75):  target_p = 0.55  (confirm mastery)

    items: list of dicts with keys {id, irt_a, irt_b, irt_c}
    seen_ids: already-answered item IDs to exclude
    """
    if not items:
        return None

    pool = items
    is_repeat_fallback = False
    if seen_ids:
        pool = [i for i in items if i.get("id") not in seen_ids]
    if not pool:
        # Item pool exhausted — fall back to repeats
        pool = items
        is_repeat_fallback = True

    # Shuffle before min() to randomise tie-breaking.
    # Without this, when all items share the same b value (and therefore
    # the same |P - target_p| distance), min() always returns the first
    # item in the list, causing the same question to appear repeatedly.
    pool = list(pool)  # copy so we don't mutate caller's list
    random.shuffle(pool)

    best = min(
        pool,
        key=lambda item: abs(
            p_correct(theta, item.get("irt_a", 1.0), item.get("irt_b", 0.0), item.get("irt_c", 0.25))
            - target_p
        )
    )

    if is_repeat_fallback:
        best = dict(best)  # shallow copy so we can annotate
        best["_is_repeat"] = True

    return best


# ── ZPD target helper ─────────────────────────────────────────────────────────

def zpd_target_for_mastery(p_mastery: float) -> float:
    """
    Adaptive ZPD target based on BKT mastery stage.

    Early:  build confidence → 75%
    Mid:    challenge zone → 65%
    Late:   confirm mastery, reduce guessing → 55%
    """
    if p_mastery < 0.40:
        return 0.75
    elif p_mastery < 0.75:
        return 0.65
    else:
        return 0.55


# ── Difficulty label mapping ──────────────────────────────────────────────────

DIFFICULTY_TO_B = {
    "easy": -1.0,
    "medium": 0.0,
    "hard": 1.5,
}

def label_to_b(label: str | None) -> float:
    """Academic-facing label ('easy'/'medium'/'hard') → IRT b value."""
    return DIFFICULTY_TO_B.get(label or "medium", 0.0)
