"""
X-Ray Sandbox API (Layer 1/2)

Simulation endpoint — runs assessment + learning loop entirely in-memory.
NO DB writes. For academic team + testing team to verify system behavior.

Usage:
  POST /sandbox/simulate
  → Feed pre-scripted responses, get step-by-step reasoning log

5 built-in student profiles:
  strong    θ=1.5  → 85% correct
  average   θ=0.0  → 60% correct
  weak      θ=-1.5 → 30% correct
  guesser   θ=-1.0 → responses match random guessing (P ≈ 0.25)
  careless  θ=1.0  → knows content but slips often (P(S) high)
"""

from __future__ import annotations

import random
from typing import Literal

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from app.engines import irt as IRT
from app.engines import bkt as BKT
from app.engines.bkt import BKTState

router = APIRouter(prefix="/sandbox", tags=["X-Ray Sandbox"])


# ── Student profiles ──────────────────────────────────────────────────────────

PROFILES = {
    "strong":   {"theta": 1.5,  "p_slip_override": None, "random_guess": False},
    "average":  {"theta": 0.0,  "p_slip_override": None, "random_guess": False},
    "weak":     {"theta": -1.5, "p_slip_override": None, "random_guess": False},
    "guesser":  {"theta": -1.0, "p_slip_override": None, "random_guess": True},
    "careless": {"theta": 1.0,  "p_slip_override": 0.40, "random_guess": False},
}


def _simulate_correct(
    theta: float,
    item: dict,
    random_guess: bool = False,
    p_slip_override: float | None = None,
) -> bool:
    """
    Simulate whether the student gets the item correct.
    Uses IRT P(correct|θ) + optional overrides for guesser/careless profiles.
    """
    if random_guess:
        # Guesser: uniform random, P ≈ c (guessing floor)
        return random.random() < item.get("irt_c", 0.25)

    p = IRT.p_correct(theta, item.get("irt_a", 1.0), item.get("irt_b", 0.0), item.get("irt_c", 0.25))

    if p_slip_override is not None:
        # Careless: knows content but slips often
        p = p * (1.0 - p_slip_override)

    return random.random() < p


# ── Schemas ───────────────────────────────────────────────────────────────────

class SimulateRequest(BaseModel):
    # Items pool to simulate against (list of item dicts with IRT params)
    items: list[dict]

    # Student profile
    profile: Literal["strong", "average", "weak", "guesser", "careless"] = "average"
    custom_theta: float | None = None  # override profile theta

    # Optional: pre-scripted responses (True/False per step)
    # If provided, overrides the simulated responses
    scripted_responses: list[bool] | None = None

    # How many steps to simulate
    max_steps: int = 20

    # Starting BKT state
    initial_p_mastery: float = 0.10

    # Verbose: include per-step reasoning text
    verbose: bool = True


# ── Route ─────────────────────────────────────────────────────────────────────

@router.post("/simulate", summary="Simulate a learning session (X-Ray mode)")
async def simulate(body: SimulateRequest):
    """
    Runs a full in-memory simulation of the BKT learning loop.

    No DB reads or writes. Pure engine simulation.

    Returns step-by-step log showing:
      - Which item was selected and why (IRT ZPD reasoning)
      - Whether student answered correctly (simulated or scripted)
      - BKT P(mastery) before and after
      - IRT theta update
      - Mastery decision

    Use this to:
      - Verify IRT selects appropriate difficulty
      - Verify BKT converges to mastery correctly
      - Demonstrate system behavior to academic/testing teams
      - Debug edge cases (guesser profile, careless profile)
    """
    if not body.items:
        raise HTTPException(status_code=400, detail="items list cannot be empty")

    profile = PROFILES.get(body.profile, PROFILES["average"])
    theta = body.custom_theta if body.custom_theta is not None else profile["theta"]
    random_guess = profile["random_guess"]
    p_slip_override = profile["p_slip_override"]

    # Init BKT with IRT theta
    bkt_state = BKT.init_with_irt(theta)
    bkt_state = BKTState(
        p_mastery=body.initial_p_mastery,
        p_know0=bkt_state.p_know0,
        p_transit=bkt_state.p_transit,
        p_guess=bkt_state.p_guess,
        p_slip=bkt_state.p_slip,
    )

    response_history: list[tuple] = []  # (correct, a, b, c)
    steps = []
    seen_ids: set[str] = set()

    for step_n in range(body.max_steps):
        if BKT.is_mastered(bkt_state):
            break

        # Select item via IRT ZPD
        target_p = IRT.zpd_target_for_mastery(bkt_state.p_mastery)
        item = IRT.select_zpd(theta, body.items, target_p=target_p, seen_ids=seen_ids)
        if item is None:
            break

        seen_ids.add(item.get("id", ""))

        item_a = item.get("irt_a", 1.0)
        item_b = item.get("irt_b", 0.0)
        item_c = item.get("irt_c", 0.25)
        actual_p = IRT.p_correct(theta, item_a, item_b, item_c)
        info = IRT.information(theta, item_a, item_b, item_c)

        # Determine response
        if body.scripted_responses and step_n < len(body.scripted_responses):
            correct = body.scripted_responses[step_n]
        else:
            correct = _simulate_correct(theta, item, random_guess, p_slip_override)

        # BKT update
        bkt_before = bkt_state.p_mastery
        bkt_state = BKT.update_observation(bkt_state, correct=correct)

        # IRT theta update
        response_history.append((correct, item_a, item_b, item_c))
        if len(response_history) >= 2:
            theta, theta_se = IRT.update_theta(response_history, init=theta)
        else:
            theta_se = 1.0

        step_data: dict = {
            "step": step_n + 1,
            "item_id": item.get("id", f"item-{step_n}"),
            "item_b": round(item_b, 3),
            "item_a": round(item_a, 3),
            "correct": correct,
            "theta": round(theta, 3),
            "theta_se": round(theta_se, 3),
            "p_mastery_before": round(bkt_before, 4),
            "p_mastery_after": round(bkt_state.p_mastery, 4),
            "is_mastered": BKT.is_mastered(bkt_state),
            "zpd_target": round(target_p, 2),
            "actual_p_correct": round(actual_p, 3),
        }

        if body.verbose:
            mastery_stage = (
                "early" if bkt_before < 0.40 else
                "mid"   if bkt_before < 0.75 else
                "late"
            )
            step_data["reasoning"] = (
                f"[{mastery_stage.upper()} stage] "
                f"ZPD target={target_p:.0%} → selected item b={item_b:.2f} "
                f"(P(correct|θ={theta:.2f})={actual_p:.2f}, Fisher I={info:.3f}). "
                f"Student {'✓ correct' if correct else '✗ wrong'}. "
                f"P(mastery): {bkt_before:.3f} → {bkt_state.p_mastery:.3f}"
                + (" → ✅ MASTERED" if BKT.is_mastered(bkt_state) else "")
            )

        steps.append(step_data)

        if BKT.is_mastered(bkt_state):
            break

    return {
        "profile": body.profile,
        "initial_theta": body.custom_theta if body.custom_theta is not None else profile["theta"],
        "final_theta": round(theta, 3),
        "final_p_mastery": round(bkt_state.p_mastery, 4),
        "is_mastered": BKT.is_mastered(bkt_state),
        "total_steps": len(steps),
        "final_bkt_params": bkt_state.to_dict(),
        "steps": steps,
    }


@router.get("/profiles", summary="List available student simulation profiles")
async def list_profiles():
    """Returns all built-in student profiles with their parameters."""
    return {
        "profiles": [
            {
                "name": "strong",
                "description": "High-ability student (θ=1.5) — answers ~85% correctly, learns fast",
                "theta": 1.5,
            },
            {
                "name": "average",
                "description": "Average student (θ=0.0) — answers ~60% correctly on medium items",
                "theta": 0.0,
            },
            {
                "name": "weak",
                "description": "Struggling student (θ=-1.5) — answers ~30% correctly, needs prerequisites",
                "theta": -1.5,
            },
            {
                "name": "guesser",
                "description": "Random guesser — answers ~25% correctly (MCQ guessing floor)",
                "theta": -1.0,
            },
            {
                "name": "careless",
                "description": "Capable but careless (θ=1.0, high slip rate) — knows content but makes errors",
                "theta": 1.0,
            },
        ]
    }
