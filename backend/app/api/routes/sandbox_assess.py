"""
Assessment Simulation API — AI Agent Assessment Testing

Endpoints:
  POST /sandbox/assess           — run single persona (agent or math mode)
  POST /sandbox/assess/batch     — run batch (math mode only)
  POST /sandbox/assess/validate  — validate graph with real DB data
  GET  /sandbox/assess/personas  — list built-in personas
  GET  /sandbox/assess/cost      — agent cost tracking

Architecture:
  - Agent mode: Gemini reads actual questions → answers in-character
  - Math mode: IRT formula → fast, for batch analysis
  - Both use the SAME CATController (production engine)
"""

from __future__ import annotations

import asyncio
from typing import Literal, Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import select, text
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.engines.assessment_sim import (
    StudentPersona,
    run_agent_assessment,
    run_math_assessment,
    compare_diagnosis,
)
from app.engines.agent_student import get_agent_cost_summary
from app.models.models import Item, KnowledgeComponent
from app.services.graph_service import get_graph

router = APIRouter(prefix="/sandbox/assess", tags=["Assessment Simulation"])


# ── Schemas ───────────────────────────────────────────────────────────────────

class PersonaInput(BaseModel):
    name: str = "test_student"
    true_theta: float = 0.0
    true_mastery: dict[str, bool]  # kc_id → True (knows) / False (gap)
    p_slip: float = 0.10
    p_guess: float = 0.25
    
    # Persona description (for agent mode)
    ability_description: str = "Học sinh trung bình"
    knowledge_detail: str = ""
    carefulness: str = "trung bình"
    when_unsure: str = "đoán đại, chọn đáp án trông quen nhất"
    speed: str = "trung bình"
    common_mistakes: str = "hay nhầm dấu, quên quy tắc"

    def to_persona(self) -> StudentPersona:
        return StudentPersona(
            name=self.name,
            true_theta=self.true_theta,
            true_mastery=self.true_mastery,
            p_slip=self.p_slip,
            p_guess=self.p_guess,
            ability_description=self.ability_description,
            knowledge_detail=self.knowledge_detail,
            carefulness=self.carefulness,
            when_unsure=self.when_unsure,
            speed=self.speed,
            common_mistakes=self.common_mistakes,
        )


class AssessRequest(BaseModel):
    persona: PersonaInput
    mode: Literal["agent", "math"] = "agent"
    max_items: int = 60


class BatchRequest(BaseModel):
    personas: list[PersonaInput]
    trials_per_persona: int = 5
    max_items: int = 60


# ── Helpers ───────────────────────────────────────────────────────────────────

async def _load_all_items(db: AsyncSession) -> dict[str, list[dict]]:
    """Load all active items grouped by kc_id."""
    result = await db.execute(select(Item).where(Item.is_active == True))
    items = result.scalars().all()
    grouped: dict[str, list[dict]] = {}
    for item in items:
        kc_str = str(item.kc_id)
        grouped.setdefault(kc_str, []).append({
            "id": str(item.id),
            "kc_id": kc_str,
            "content": item.content,
            "irt_a": item.irt_a,
            "irt_b": item.irt_b,
            "irt_c": item.irt_c,
            "is_diagnostic_anchor": item.is_diagnostic_anchor,
        })
    return grouped


async def _load_kc_names(db: AsyncSession) -> dict[str, str]:
    """Load kc_id → name mapping."""
    result = await db.execute(select(KnowledgeComponent))
    kcs = result.scalars().all()
    return {str(kc.id): kc.name for kc in kcs}


# ── Routes ────────────────────────────────────────────────────────────────────

@router.post("", summary="Run single assessment simulation")
async def run_assessment(
    body: AssessRequest,
    db: AsyncSession = Depends(get_db),
):
    """
    Run a full CAT assessment with a simulated student.
    
    Modes:
    - `agent`: Gemini reads actual question text → answers in-character (slow, tests content)
    - `math`: IRT formula → fast, for statistical analysis
    
    Returns:
    - Step-by-step log with agent's thinking
    - Diagnostic comparison (ground truth vs assessment)
    - Precision/recall/F1 metrics
    """
    kg = await get_graph(db)
    available_items = await _load_all_items(db)
    kc_names = await _load_kc_names(db)
    persona = body.persona.to_persona()
    
    if body.mode == "agent":
        result = await run_agent_assessment(
            persona=persona,
            kg=kg,
            available_items=available_items,
            kc_names=kc_names,
            max_items=body.max_items,
        )
    else:
        result = await run_math_assessment(
            persona=persona,
            kg=kg,
            available_items=available_items,
            max_items=body.max_items,
        )
    
    return result


@router.post("/batch", summary="Run batch assessment simulation (math mode only)")
async def run_batch(
    body: BatchRequest,
    db: AsyncSession = Depends(get_db),
):
    """
    Run multiple personas × multiple trials for statistical analysis.
    Math mode only (agent mode too expensive for batch).
    
    Returns aggregate precision/recall/F1 with mean/std.
    """
    kg = await get_graph(db)
    available_items = await _load_all_items(db)
    
    all_results = []
    
    for persona_input in body.personas:
        persona = persona_input.to_persona()
        trial_results = []
        
        for trial in range(body.trials_per_persona):
            result = await run_math_assessment(
                persona=persona,
                kg=kg,
                available_items=available_items,
                max_items=body.max_items,
            )
            trial_results.append(result)
        
        # Aggregate per persona
        metrics_list = [r["diagnostic_comparison"]["metrics"] for r in trial_results if r["status"] == "completed"]
        
        if metrics_list:
            avg_metrics = {}
            for key in metrics_list[0]:
                values = [m[key] for m in metrics_list]
                avg_metrics[key] = {
                    "mean": round(sum(values) / len(values), 3),
                    "min": round(min(values), 3),
                    "max": round(max(values), 3),
                }
            
            # Classification consistency: % of trials that agree on each KC
            consistency = _calc_consistency(trial_results)
        else:
            avg_metrics = {}
            consistency = 0.0
        
        all_results.append({
            "persona": persona.to_dict(),
            "trials": len(trial_results),
            "aggregate_metrics": avg_metrics,
            "classification_consistency": round(consistency, 3),
            "sample_result": trial_results[0] if trial_results else None,
        })
    
    return {
        "total_personas": len(body.personas),
        "trials_per_persona": body.trials_per_persona,
        "results": all_results,
    }


@router.post("/validate", summary="Validate graph with built-in personas using real DB data")
async def validate_graph(
    db: AsyncSession = Depends(get_db),
):
    """
    Run all built-in personas against the real knowledge graph + real items.
    Returns a report showing diagnostic accuracy for each persona type.
    
    This is the ONE endpoint to answer: "Is our assessment system working?"
    """
    kg = await get_graph(db)
    available_items = await _load_all_items(db)
    kc_names = await _load_kc_names(db)
    
    # Get all KC IDs in graph
    graph_dict = kg.to_dict()
    all_kc_ids = [node["id"] for node in graph_dict["nodes"]]
    
    # Find KCs with and without items
    kcs_with_items = set(available_items.keys())
    kcs_without_items = [kc for kc in all_kc_ids if kc not in kcs_with_items]
    
    # Build built-in personas based on REAL graph
    builtin = _build_personas_from_graph(all_kc_ids, kc_names)
    
    results = {}
    warnings = []
    
    if kcs_without_items:
        warnings.append(f"{len(kcs_without_items)} KCs have no items — assessment may fail if it traverses there")
    
    for name, persona in builtin.items():
        try:
            trial_results = []
            for _ in range(5):  # 5 trials for consistency
                r = await run_math_assessment(
                    persona=persona,
                    kg=kg,
                    available_items=available_items,
                    max_items=60,
                )
                trial_results.append(r)
            
            completed = [r for r in trial_results if r["status"] == "completed"]
            if completed:
                metrics = [r["diagnostic_comparison"]["metrics"] for r in completed]
                avg = {k: round(sum(m[k] for m in metrics) / len(metrics), 3) for k in metrics[0]}
                results[name] = {
                    "trials": len(completed),
                    "metrics": avg,
                    "consistency": round(_calc_consistency(completed), 3),
                }
                
                # Check for issues
                if avg.get("gap_recall", 1.0) < 0.70:
                    warnings.append(f"{name}: gap_recall={avg['gap_recall']} — assessment missing gaps")
                if avg.get("gap_precision", 1.0) < 0.60:
                    warnings.append(f"{name}: gap_precision={avg['gap_precision']} — too many false positives")
            else:
                results[name] = {"trials": 0, "error": "All trials failed"}
                
        except Exception as e:
            results[name] = {"error": str(e)}
    
    return {
        "graph_stats": {
            "total_kcs": len(all_kc_ids),
            "total_edges": len(graph_dict["edges"]),
            "kcs_with_items": len(kcs_with_items),
            "kcs_without_items": len(kcs_without_items),
        },
        "validation_results": results,
        "warnings": warnings,
    }


@router.get("/personas", summary="List built-in test personas")
async def list_personas():
    """Returns descriptions of built-in student personas for testing."""
    return {
        "personas": [
            {
                "name": "complete_beginner",
                "description": "Knows nothing — system must reach root nodes",
                "true_theta": -2.0,
            },
            {
                "name": "expert",
                "description": "Knows everything — system should pass all KCs quickly",
                "true_theta": 2.0,
            },
            {
                "name": "chapter1_only",
                "description": "Solid on early KCs (roots + first layer), gaps on advanced topics",
                "true_theta": 0.5,
            },
            {
                "name": "scattered_gaps",
                "description": "Knows most things but specific holes in the middle of the graph",
                "true_theta": 0.3,
            },
            {
                "name": "lucky_guesser",
                "description": "Knows nothing but elevated guess rate (P=0.35)",
                "true_theta": -1.5,
            },
        ],
    }


@router.get("/cost", summary="Agent simulation cost tracking")
async def get_cost():
    """Returns cumulative Gemini API cost from agent simulations."""
    return get_agent_cost_summary()


# ── Internal Helpers ──────────────────────────────────────────────────────────

def _build_personas_from_graph(
    all_kc_ids: list[str],
    kc_names: dict[str, str],
) -> dict[str, StudentPersona]:
    """Build built-in personas based on actual graph KCs."""
    
    # Sort KCs for consistent ordering
    kc_list = sorted(all_kc_ids)
    n = len(kc_list)
    half = n // 2
    
    return {
        "complete_beginner": StudentPersona(
            name="complete_beginner",
            true_theta=-2.0,
            true_mastery={kc: False for kc in kc_list},
            p_guess=0.25,
            ability_description="Học sinh yếu, chưa nắm được kiến thức lớp 6",
            knowledge_detail="Em chưa học gì cả. Tất cả các chủ đề đều mới với em.",
            carefulness="thấp",
            when_unsure="đoán ngẫu nhiên",
            speed="nhanh, không suy nghĩ kỹ",
            common_mistakes="mọi thứ đều sai vì chưa học",
        ),
        "expert": StudentPersona(
            name="expert",
            true_theta=2.0,
            true_mastery={kc: True for kc in kc_list},
            p_slip=0.05,
            ability_description="Học sinh giỏi, nắm vững tất cả kiến thức lớp 6",
            knowledge_detail="Em đã học và hiểu tất cả các chủ đề Toán lớp 6. Em tự tin với mọi dạng bài.",
            carefulness="cao",
            when_unsure="suy nghĩ kỹ, loại trừ đáp án sai",
            speed="vừa phải, cẩn thận",
            common_mistakes="thỉnh thoảng bất cẩn nhầm dấu, nhưng rất hiếm",
        ),
        "chapter1_only": StudentPersona(
            name="chapter1_only",
            true_theta=0.5,
            true_mastery={kc: (i < half) for i, kc in enumerate(kc_list)},
            ability_description="Học sinh trung bình khá, nắm được nửa đầu chương trình",
            knowledge_detail="Em biết tập hợp, số tự nhiên, chia hết, lũy thừa. "
                           "Nhưng em chưa học phần phân số, hình học, thống kê.",
            carefulness="trung bình",
            when_unsure="cố đoán dựa vào cảm giác",
            speed="trung bình",
            common_mistakes="nhầm quy tắc giữa phép nhân và phép cộng, quên điều kiện chia hết",
        ),
        "scattered_gaps": StudentPersona(
            name="scattered_gaps",
            true_theta=0.3,
            true_mastery={
                kc: (i % 5 != 0)  # gap every 5th KC
                for i, kc in enumerate(kc_list)
            },
            ability_description="Học sinh có kiến thức không đều, có lỗ hổng rải rác",
            knowledge_detail="Em biết hầu hết các chủ đề nhưng có một số chỗ em bị hổng "
                           "vì nghỉ học hoặc không hiểu bài hôm đó.",
            carefulness="trung bình",
            when_unsure="chọn đáp án quen mắt nhất",
            speed="nhanh",
            common_mistakes="nhầm công thức, nhớ nhầm quy tắc đã học",
        ),
        "lucky_guesser": StudentPersona(
            name="lucky_guesser",
            true_theta=-1.5,
            true_mastery={kc: False for kc in kc_list},
            p_guess=0.35,
            ability_description="Học sinh yếu nhưng hay đoán trúng",
            knowledge_detail="Em không biết gì cả nhưng em rất giỏi đoán. "
                           "Em thường loại 1-2 đáp án rồi đoán trong số còn lại.",
            carefulness="thấp",
            when_unsure="loại trừ đáp án trông sai nhất, đoán trong số còn lại",
            speed="rất nhanh, không suy nghĩ",
            common_mistakes="tất cả kiến thức đều sai, chỉ đoán may mắn",
        ),
    }


def _calc_consistency(results: list[dict]) -> float:
    """
    Calculate classification consistency across trials.
    For each KC, check if all trials agree on pass/fail.
    Returns % of KCs with unanimous agreement.
    """
    if not results:
        return 0.0
    
    # Collect all KC results across trials
    kc_votes: dict[str, list[str]] = {}
    for r in results:
        if r["status"] != "completed":
            continue
        for kc_id, outcome in r.get("assessment_result", {}).items():
            if isinstance(outcome, str):
                kc_votes.setdefault(kc_id, []).append(outcome)
        # Also from diagnostic comparison
        session_results = {}
        mastered = r.get("assessment_result", {}).get("mastered", [])
        gaps = r.get("assessment_result", {}).get("gaps", [])
        for kc in mastered:
            kc_votes.setdefault(kc, []).append("pass")
        for kc in gaps:
            kc_votes.setdefault(kc, []).append("fail")
    
    if not kc_votes:
        return 1.0
    
    consistent = 0
    for kc_id, votes in kc_votes.items():
        if len(set(votes)) == 1:  # all agree
            consistent += 1
    
    return consistent / len(kc_votes) if kc_votes else 1.0
