"""
Assessment Simulation Engine — Core logic for diagnostic comparison

Combines:
1. CATController (existing) — runs the actual assessment
2. AgentSession (new) — simulates student responses via Gemini
3. DiagnosticComparator — compares ground truth vs assessment result

All in-memory, no DB writes.
"""

from __future__ import annotations

import random
from dataclasses import dataclass, field
from typing import Optional

from app.engines.knowledge_graph import KnowledgeGraph
from app.engines.assessment import CATController
from app.engines import irt as IRT
from app.engines.agent_student import (
    StudentPersona, AgentSession, AgentResponse,
    create_agent_session, get_correct_answer,
)


# ── Diagnostic Comparison ────────────────────────────────────────────────────

@dataclass
class DiagnosticResult:
    """Result of comparing ground truth vs assessment diagnosis."""
    
    # Per-KC comparison
    kc_comparisons: list[dict] = field(default_factory=list)
    
    # Confusion matrix (for gaps)
    true_positive: int = 0    # truly gap + diagnosed gap
    true_negative: int = 0    # truly mastered + diagnosed mastered
    false_positive: int = 0   # truly mastered + diagnosed gap
    false_negative: int = 0   # truly gap + diagnosed mastered (MISSED)
    
    # KCs not tested (inferred by KST)
    not_tested: int = 0
    
    # Efficiency
    total_items_used: int = 0
    kcs_visited: int = 0
    kcs_in_graph: int = 0
    
    # Theta
    true_theta: float = 0.0
    assessed_theta: float = 0.0
    
    @property
    def gap_precision(self) -> float:
        denom = self.true_positive + self.false_positive
        return self.true_positive / denom if denom > 0 else 1.0
    
    @property
    def gap_recall(self) -> float:
        denom = self.true_positive + self.false_negative
        return self.true_positive / denom if denom > 0 else 1.0
    
    @property
    def f1_score(self) -> float:
        p, r = self.gap_precision, self.gap_recall
        return 2 * p * r / (p + r) if (p + r) > 0 else 0.0
    
    @property
    def mastery_precision(self) -> float:
        denom = self.true_negative + self.false_negative
        return self.true_negative / denom if denom > 0 else 1.0
    
    @property
    def mastery_recall(self) -> float:
        denom = self.true_negative + self.false_positive
        return self.true_negative / denom if denom > 0 else 1.0
    
    @property
    def theta_error(self) -> float:
        return abs(self.assessed_theta - self.true_theta)
    
    @property
    def items_per_kc(self) -> float:
        return self.total_items_used / self.kcs_visited if self.kcs_visited > 0 else 0.0
    
    def to_dict(self) -> dict:
        return {
            "confusion_matrix": {
                "true_positive": self.true_positive,
                "true_negative": self.true_negative,
                "false_positive": self.false_positive,
                "false_negative": self.false_negative,
                "not_tested": self.not_tested,
            },
            "metrics": {
                "gap_precision": round(self.gap_precision, 3),
                "gap_recall": round(self.gap_recall, 3),
                "f1_score": round(self.f1_score, 3),
                "mastery_precision": round(self.mastery_precision, 3),
                "mastery_recall": round(self.mastery_recall, 3),
                "theta_error": round(self.theta_error, 3),
            },
            "efficiency": {
                "total_items_used": self.total_items_used,
                "kcs_visited": self.kcs_visited,
                "kcs_in_graph": self.kcs_in_graph,
                "items_per_kc": round(self.items_per_kc, 1),
            },
            "theta": {
                "true": round(self.true_theta, 3),
                "assessed": round(self.assessed_theta, 3),
                "error": round(self.theta_error, 3),
            },
            "per_kc": self.kc_comparisons,
        }


def compare_diagnosis(
    persona: StudentPersona,
    assessed_results: dict[str, str],  # kc_id → legacy outcome or tested/inferred state
    assessed_theta: float,
    total_items: int,
    all_kc_ids: set[str],
) -> DiagnosticResult:
    """
    Compare persona's ground truth knowledge state vs assessment diagnosis.
    
    Logic:
    - For each KC the persona has a ground truth for:
      - mastered state → assessment says the student knows the KC
      - gap state → assessment says the student has a gap
      - not tested/unknown → no diagnosis for that KC
    """
    result = DiagnosticResult(
        true_theta=persona.true_theta,
        assessed_theta=assessed_theta,
        total_items_used=total_items,
        kcs_in_graph=len(all_kc_ids),
    )
    
    visited_kcs = set(assessed_results.keys())
    result.kcs_visited = len(visited_kcs)
    
    for kc_id in all_kc_ids:
        if kc_id not in persona.true_mastery:
            continue  # persona doesn't define this KC
        
        true_knows = persona.true_mastery[kc_id]
        assessed = assessed_results.get(kc_id)  # None if unclassified
        
        comparison = {
            "kc_id": kc_id,
            "true_state": "mastered" if true_knows else "gap",
            "assessed_state": assessed or "not_tested",
            "tested": kc_id in visited_kcs,
        }
        
        if assessed is None or assessed == "unknown":
            # Unclassified — still a missed opportunity for known gaps.
            result.not_tested += 1
            if true_knows:
                result.true_negative += 1
                comparison["match"] = True
                comparison["category"] = "TN (unclassified but no gap)"
            else:
                result.false_negative += 1
                comparison["match"] = False
                comparison["category"] = "FN ⚠️ (gap missed — unclassified)"
        elif _assessed_as_mastered(assessed):
            if true_knows:
                result.true_negative += 1
                comparison["match"] = True
                comparison["category"] = "TN (correctly mastered)"
            else:
                result.false_negative += 1
                comparison["match"] = False
                comparison["category"] = "FN ⚠️ (gap marked mastered — MISSED)"
        else:  # fail, fundamental_gap, tested_gap, inferred_gap
            if true_knows:
                result.false_positive += 1
                comparison["match"] = False
                comparison["category"] = "FP (mastered but failed)"
            else:
                result.true_positive += 1
                comparison["match"] = True
                comparison["category"] = "TP (gap correctly found)"
        
        result.kc_comparisons.append(comparison)
    
    return result


def _assessed_as_mastered(outcome: str) -> bool:
    return outcome in {"pass", "tested_mastered", "inferred_mastered"}


# ── Assessment Runner (Agent Mode) ───────────────────────────────────────────

async def run_agent_assessment(
    persona: StudentPersona,
    kg: KnowledgeGraph,
    available_items: dict[str, list[dict]],
    kc_names: dict[str, str] | None = None,
    max_items: int = 60,
) -> dict:
    """
    Run full CATController assessment with Gemini agent as student.
    
    Returns complete simulation result with:
    - Step-by-step log (question → thinking → answer → correct/wrong)
    - Diagnostic comparison (ground truth vs assessment result)
    - Agent cost tracking
    """
    # Create agent session
    agent = await create_agent_session(persona)
    
    # Init CATController (same engine as production)
    cat = CATController(kg, use_irt=True)
    
    # Start assessment — system knows nothing about the student
    result = cat.start(
        student_id=f"agent_{persona.name}",
        known_kcs=set(),  # empty — student is new
        theta=0.0,        # system starts from θ=0
        available_items=available_items,
    )
    
    if result["status"] == "no_kcs_available":
        return {
            "status": "error",
            "error": "No KCs available for assessment",
            "persona": persona.to_dict(),
        }
    
    steps = []
    item_count = 0
    
    while result["status"] != "done" and item_count < max_items:
        item = result.get("item")
        if item is None:
            break
        
        session = result["session"]
        kc_id = session["kc"]
        kc_name = ""
        if kc_names:
            kc_name = kc_names.get(kc_id, kc_id)
        else:
            # Try to get from graph
            kc_info = kg.get_kc_info(kc_id)
            if kc_info:
                kc_name = kc_info.get("name", kc_id)
        
        # Agent answers the question
        agent_response = await agent.answer_question(item, kc_name)
        item_count += 1
        
        # Log step
        step = {
            "step": item_count,
            "kc_id": kc_id,
            "kc_name": kc_name,
            "item_id": item.get("id", ""),
            "item_b": item.get("irt_b", 0.0),
            "correct_answer": get_correct_answer(item),
            "agent_answer": agent_response.answer,
            "correct": agent_response.correct,
            "thinking": agent_response.thinking,
            "persona_knows_kc": persona.true_mastery.get(kc_id, "unknown"),
        }
        steps.append(step)
        
        # Feed answer to CATController
        result = cat.respond(
            result["session"],
            item,
            agent_response.correct,
            available_items,
            response_meta={
                "agent_answer": agent_response.answer,
                "thinking": agent_response.thinking,
                "correct_answer": get_correct_answer(item),
            },
        )
    
    # Extract assessment results
    session = result.get("session", {})
    assessed_results = session.get("kc_states") or session.get("kc_results", {})
    assessed_theta = session.get("theta", 0.0)
    
    # Get all KC IDs from graph for comparison
    all_kc_ids = set()
    graph_dict = kg.to_dict()
    for node in graph_dict.get("nodes", []):
        all_kc_ids.add(node["id"])
    
    # Compare diagnosis vs ground truth
    comparison = compare_diagnosis(
        persona=persona,
        assessed_results=assessed_results,
        assessed_theta=assessed_theta,
        total_items=item_count,
        all_kc_ids=all_kc_ids,
    )
    
    # Build final result
    final_result = result.get("result", {})
    mastered = final_result.get(
        "mastered",
        [k for k, v in assessed_results.items() if v in ("pass", "tested_mastered", "inferred_mastered")],
    )
    gaps = final_result.get(
        "gaps",
        [k for k, v in assessed_results.items() if v in ("fail", "fundamental_gap", "tested_gap", "inferred_gap")],
    )
    
    return {
        "status": "completed",
        "persona": persona.to_dict(),
        "assessment_result": {
            "mastered": mastered,
            "gaps": gaps,
            "tested_mastered": final_result.get("tested_mastered", []),
            "tested_gaps": final_result.get("tested_gaps", []),
            "inferred_mastered": final_result.get("inferred_mastered", []),
            "inferred_gaps": final_result.get("inferred_gaps", []),
            "unknown": final_result.get("unknown", []),
            "fundamental_gaps": final_result.get(
                "fundamental_gaps",
                [k for k, v in session.get("kc_results", {}).items() if v == "fundamental_gap"],
            ),
            "assessed_theta": round(assessed_theta, 3),
            "total_items": item_count,
            "kcs_visited": len(session.get("kc_results", {})),
            "kcs_classified": len(assessed_results),
        },
        "diagnostic_comparison": comparison.to_dict(),
        "steps": steps,
        "cost": {
            "total_cost_usd": round(agent.total_cost, 6),
            "api_calls": agent.step_count,
        },
    }


# ── Math-based Simulation (Fast Mode) ────────────────────────────────────────

def simulate_response_math(
    persona: StudentPersona,
    item: dict,
    kc_id: str,
) -> bool:
    """
    Fast mathematical simulation (no AI call).
    Used for batch statistical analysis.
    """
    knows_kc = persona.true_mastery.get(kc_id, False)
    
    if knows_kc:
        # Use IRT probability with slip
        p = IRT.p_correct(
            persona.true_theta,
            item.get("irt_a", 1.0),
            item.get("irt_b", 0.0),
            item.get("irt_c", 0.25),
        )
        p_answer = p * (1.0 - persona.p_slip)
    else:
        p_answer = persona.p_guess
    
    return random.random() < p_answer


async def run_math_assessment(
    persona: StudentPersona,
    kg: KnowledgeGraph,
    available_items: dict[str, list[dict]],
    max_items: int = 60,
) -> dict:
    """
    Run assessment with math-based simulation (fast, no API calls).
    Same structure as run_agent_assessment but uses IRT formula instead of Gemini.
    """
    cat = CATController(kg, use_irt=True)
    
    result = cat.start(
        student_id=f"math_{persona.name}",
        known_kcs=set(),
        theta=0.0,
        available_items=available_items,
    )
    
    if result["status"] == "no_kcs_available":
        return {"status": "error", "error": "No KCs available"}
    
    steps = []
    item_count = 0
    
    while result["status"] != "done" and item_count < max_items:
        item = result.get("item")
        if item is None:
            break
        
        kc_id = result["session"]["kc"]
        correct = simulate_response_math(persona, item, kc_id)
        item_count += 1
        
        steps.append({
            "step": item_count,
            "kc_id": kc_id,
            "item_b": item.get("irt_b", 0.0),
            "correct": correct,
            "persona_knows_kc": persona.true_mastery.get(kc_id, "unknown"),
        })
        
        result = cat.respond(result["session"], item, correct, available_items)
    
    session = result.get("session", {})
    assessed_results = session.get("kc_states") or session.get("kc_results", {})
    assessed_theta = session.get("theta", 0.0)
    
    all_kc_ids = set()
    for node in kg.to_dict().get("nodes", []):
        all_kc_ids.add(node["id"])
    
    comparison = compare_diagnosis(
        persona=persona,
        assessed_results=assessed_results,
        assessed_theta=assessed_theta,
        total_items=item_count,
        all_kc_ids=all_kc_ids,
    )
    
    final_result = result.get("result", {})
    return {
        "status": "completed",
        "persona": persona.to_dict(),
        "assessment_result": {
            "mastered": final_result.get(
                "mastered",
                [k for k, v in assessed_results.items() if v in ("pass", "tested_mastered", "inferred_mastered")],
            ),
            "gaps": final_result.get(
                "gaps",
                [k for k, v in assessed_results.items() if v in ("fail", "fundamental_gap", "tested_gap", "inferred_gap")],
            ),
            "tested_mastered": final_result.get("tested_mastered", []),
            "tested_gaps": final_result.get("tested_gaps", []),
            "inferred_mastered": final_result.get("inferred_mastered", []),
            "inferred_gaps": final_result.get("inferred_gaps", []),
            "unknown": final_result.get("unknown", []),
            "assessed_theta": round(assessed_theta, 3),
            "total_items": item_count,
            "kcs_visited": len(session.get("kc_results", {})),
            "kcs_classified": len(assessed_results),
        },
        "diagnostic_comparison": comparison.to_dict(),
        "steps": steps,
    }
