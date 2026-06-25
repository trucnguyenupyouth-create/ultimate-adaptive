"""
Smoke-test the production assessment engine with today's pending draft import.

This script is read-only. It does NOT approve drafts and does NOT write to DB.

What it does:
  1. Loads the real production graph.
  2. Loads active items, same as production assessment.
  3. Loads pending drafts from the import batch tags and maps them to item-shaped
     dicts in memory only.
  4. Runs the real CATController with active + draft items.
  5. Runs targeted checks for draft-only KCs to prove draft items can be picked.

Usage:
  cd backend
  .venv/bin/python scratch/test_assessment_with_pending_drafts.py

Optional:
  DRAFT_TAGS=batch_import_20260622,batch_import_70_115_20260622 ...
"""

from __future__ import annotations

import asyncio
import json
import os
import random
import sys
from collections import Counter, defaultdict
from datetime import datetime, timezone
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent))

from sqlalchemy import select

from app.core.database import AsyncSessionLocal
from app.engines import irt as IRT
from app.engines.agent_student import StudentPersona
from app.engines.assessment import AssessmentSession, CATController
from app.models.models import Item, ItemDraft, KnowledgeComponent
from app.services.graph_service import get_graph


DEFAULT_DRAFT_TAGS = (
    "batch_import_20260622",
    "batch_import_70_115_20260622",
)

DIFFICULTY_TO_B = {
    "easy": -1.0,
    "medium": 0.0,
    "hard": 1.5,
}


def draft_tags() -> list[str]:
    raw = os.environ.get("DRAFT_TAGS")
    if not raw:
        return list(DEFAULT_DRAFT_TAGS)
    return [t.strip() for t in raw.split(",") if t.strip()]


def item_dict_from_item(item: Item) -> dict:
    return {
        "id": str(item.id),
        "kc_id": str(item.kc_id),
        "content": item.content,
        "irt_a": float(item.irt_a or 1.0),
        "irt_b": float(item.irt_b or 0.0),
        "irt_c": float(item.irt_c or 0.25),
        "is_diagnostic_anchor": bool(item.is_diagnostic_anchor),
        "_source": "active_item",
    }


def item_dict_from_draft(draft: ItemDraft) -> dict:
    difficulty = (draft.difficulty_label or "medium").lower()
    return {
        "id": f"draft:{draft.id}",
        "kc_id": str(draft.kc_id),
        "content": draft.content,
        "irt_a": 1.0,
        "irt_b": DIFFICULTY_TO_B.get(difficulty, 0.0),
        "irt_c": 0.25,
        "is_diagnostic_anchor": bool(draft.is_diagnostic_anchor),
        "_source": "pending_draft",
        "_draft_status": draft.status,
        "_draft_tag": draft.kst_irt_tag,
        "_difficulty_label": draft.difficulty_label,
    }


async def load_data(tags: list[str]) -> tuple:
    async with AsyncSessionLocal() as db:
        kg = await get_graph(db)

        item_rows = (await db.execute(
            select(Item).where(Item.is_active == True)
        )).scalars().all()

        draft_rows = (await db.execute(
            select(ItemDraft).where(
                ItemDraft.status == "pending",
                ItemDraft.kst_irt_tag.in_(tags),
                (ItemDraft.flagged == False) | (ItemDraft.flagged.is_(None)),
            )
        )).scalars().all()

        kc_rows = (await db.execute(select(KnowledgeComponent))).scalars().all()

    active_by_kc: dict[str, list[dict]] = defaultdict(list)
    with_drafts_by_kc: dict[str, list[dict]] = defaultdict(list)
    source_by_id: dict[str, str] = {}

    for item in item_rows:
        mapped = item_dict_from_item(item)
        active_by_kc[mapped["kc_id"]].append(mapped)
        with_drafts_by_kc[mapped["kc_id"]].append(mapped)
        source_by_id[mapped["id"]] = "active_item"

    for draft in draft_rows:
        mapped = item_dict_from_draft(draft)
        with_drafts_by_kc[mapped["kc_id"]].append(mapped)
        source_by_id[mapped["id"]] = "pending_draft"

    kc_names = {str(kc.id): kc.name for kc in kc_rows}
    kc_codes = {str(kc.id): kc.code for kc in kc_rows}

    return kg, dict(active_by_kc), dict(with_drafts_by_kc), source_by_id, kc_names, kc_codes, draft_rows


def simulate_response(persona: StudentPersona, item: dict, kc_id: str) -> bool:
    knows_kc = persona.true_mastery.get(kc_id, False)
    if knows_kc:
        p = IRT.p_correct(
            persona.true_theta,
            item.get("irt_a", 1.0),
            item.get("irt_b", 0.0),
            item.get("irt_c", 0.25),
        )
        return random.random() < p * (1.0 - persona.p_slip)
    return random.random() < persona.p_guess


def item_question_summary(item: dict) -> dict:
    content = item.get("content") or {}
    if isinstance(content, str):
        try:
            content = json.loads(content)
        except json.JSONDecodeError:
            content = {"question": content, "answers": []}

    answers = content.get("answers") or []
    correct_answer = next(
        (a.get("label") for a in answers if a.get("is_correct")),
        None,
    )
    return {
        "question": content.get("question", ""),
        "answers": [
            {
                "label": a.get("label"),
                "text": a.get("text", ""),
                "is_correct": bool(a.get("is_correct", False)),
            }
            for a in answers
        ],
        "correct_answer": correct_answer,
    }


def math_response_reason(persona: StudentPersona, item: dict, kc_id: str, correct: bool) -> str:
    knows_kc = persona.true_mastery.get(kc_id, False)
    if knows_kc and correct:
        return "Math-mode: persona knows this KC; response sampled correct from IRT probability minus slip."
    if knows_kc and not correct:
        return "Math-mode: persona knows this KC but sampled wrong via slip/IRT uncertainty."
    if not knows_kc and correct:
        return "Math-mode: persona does not know this KC but guessed correctly."
    return "Math-mode: persona does not know this KC; response sampled wrong."


def run_math_trace(
    *,
    persona: StudentPersona,
    kg,
    available_items: dict[str, list[dict]],
    source_by_id: dict[str, str],
    max_items: int,
    seed: int,
) -> dict:
    random.seed(seed)
    cat = CATController(kg, use_irt=True)
    result = cat.start(
        student_id=f"draft_smoke_{persona.name}_{seed}",
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
        correct = simulate_response(persona, item, kc_id)
        item_count += 1
        steps.append({
            "step": item_count,
            "kc_id": kc_id,
            "item_id": item.get("id"),
            "kc_code": getattr(run_math_trace, "kc_codes", {}).get(kc_id),
            "kc_name": getattr(run_math_trace, "kc_names", {}).get(kc_id),
            "source": source_by_id.get(item.get("id"), item.get("_source", "unknown")),
            "irt_b": item.get("irt_b", 0.0),
            "anchor": item.get("is_diagnostic_anchor", False),
            "correct": correct,
            "persona_knows_kc": persona.true_mastery.get(kc_id, "unknown"),
            "response_reason": math_response_reason(persona, item, kc_id, correct),
            **item_question_summary(item),
        })

        result = cat.respond(result["session"], item, correct, available_items)

    session = result.get("session", {})
    assessed = session.get("kc_results", {})
    source_counts = Counter(step["source"] for step in steps)

    return {
        "status": "completed",
        "seed": seed,
        "total_items": item_count,
        "kcs_visited": len(assessed),
        "assessed_theta": session.get("theta", 0.0),
        "source_counts": dict(source_counts),
        "used_pending_drafts": source_counts.get("pending_draft", 0),
        "mastered_count": sum(1 for v in assessed.values() if v == "pass"),
        "gap_count": sum(1 for v in assessed.values() if v != "pass"),
        "steps": steps,
    }


def build_personas(kc_ids: list[str]) -> list[StudentPersona]:
    kc_list = sorted(kc_ids)
    half = len(kc_list) // 2
    return [
        StudentPersona(
            name="complete_beginner",
            true_theta=-2.0,
            true_mastery={kc: False for kc in kc_list},
            p_guess=0.25,
            p_slip=0.10,
        ),
        StudentPersona(
            name="expert",
            true_theta=2.0,
            true_mastery={kc: True for kc in kc_list},
            p_guess=0.25,
            p_slip=0.05,
        ),
        StudentPersona(
            name="chapter1_only",
            true_theta=0.5,
            true_mastery={kc: (i < half) for i, kc in enumerate(kc_list)},
            p_guess=0.25,
            p_slip=0.10,
        ),
    ]


def targeted_draft_kc_smoke(
    *,
    kg,
    available_items: dict[str, list[dict]],
    source_by_id: dict[str, str],
    kc_names: dict[str, str],
    kc_codes: dict[str, str],
    max_kcs: int = 8,
) -> list[dict]:
    draft_only_kcs = [
        kc_id for kc_id, items in available_items.items()
        if any(i.get("_source") == "pending_draft" for i in items)
        and not any(i.get("_source") == "active_item" for i in items)
    ]

    results = []
    for kc_id in sorted(draft_only_kcs, key=lambda k: kc_codes.get(k, k))[:max_kcs]:
        cat = CATController(kg, use_irt=True)
        session = AssessmentSession(student_id="targeted_draft_smoke", kc=kc_id).to_dict()
        item = cat._pick_item(kc_id, seen_items=set(), available_items=available_items, theta=0.0, kc_n=0)
        if item is None:
            results.append({
                "kc_id": kc_id,
                "kc_code": kc_codes.get(kc_id),
                "kc_name": kc_names.get(kc_id),
                "ok": False,
                "error": "No item picked",
            })
            continue

        first_source = source_by_id.get(item.get("id"), item.get("_source", "unknown"))
        trace = []
        result = {"status": "continue", "session": session, "item": item}
        for step in range(1, 6):
            item = result.get("item")
            if item is None:
                break
            trace.append({
                "step": step,
                "item_id": item.get("id"),
                "source": source_by_id.get(item.get("id"), item.get("_source", "unknown")),
                "irt_b": item.get("irt_b"),
                "anchor": item.get("is_diagnostic_anchor"),
                **item_question_summary(item),
            })
            result = cat.respond(result["session"], item, correct=True, available_items=available_items)
            if result["status"] == "done" or result["session"].get("kc") != kc_id:
                break

        results.append({
            "kc_id": kc_id,
            "kc_code": kc_codes.get(kc_id),
            "kc_name": kc_names.get(kc_id),
            "ok": first_source == "pending_draft",
            "first_item_source": first_source,
            "steps": trace,
            "final_status": result.get("status"),
            "kc_result": result.get("session", {}).get("kc_results", {}).get(kc_id),
        })

    return results


async def main() -> None:
    tags = draft_tags()
    print(f"Loading production graph and pending draft tags: {', '.join(tags)}")

    kg, active_items, with_drafts, source_by_id, kc_names, kc_codes, draft_rows = await load_data(tags)
    graph_kc_ids = [node["id"] for node in kg.to_dict().get("nodes", [])]

    active_total = sum(len(v) for v in active_items.values())
    merged_total = sum(len(v) for v in with_drafts.values())
    draft_total = merged_total - active_total

    print(f"Active items: {active_total} across {len(active_items)} KCs")
    print(f"Pending draft items injected in memory: {draft_total} across {len({str(d.kc_id) for d in draft_rows})} KCs")
    print("No DB writes will be performed.")

    personas = build_personas(graph_kc_ids)
    run_math_trace.kc_names = kc_names
    run_math_trace.kc_codes = kc_codes
    validation = {}
    for persona in personas:
        trials = []
        for seed in range(1, 6):
            trials.append(run_math_trace(
                persona=persona,
                kg=kg,
                available_items=with_drafts,
                source_by_id=source_by_id,
                max_items=60,
                seed=seed,
            ))
        validation[persona.name] = {
            "trials": len(trials),
            "total_draft_items_used": sum(t.get("used_pending_drafts", 0) for t in trials),
            "avg_items": round(sum(t.get("total_items", 0) for t in trials) / len(trials), 2),
            "avg_kcs_visited": round(sum(t.get("kcs_visited", 0) for t in trials) / len(trials), 2),
            "sample": trials[0],
        }
        print(
            f"{persona.name}: "
            f"draft_items_used={validation[persona.name]['total_draft_items_used']} "
            f"avg_items={validation[persona.name]['avg_items']} "
            f"avg_kcs={validation[persona.name]['avg_kcs_visited']}"
        )

    targeted = targeted_draft_kc_smoke(
        kg=kg,
        available_items=with_drafts,
        source_by_id=source_by_id,
        kc_names=kc_names,
        kc_codes=kc_codes,
    )
    targeted_ok = sum(1 for r in targeted if r.get("ok"))
    print(f"Targeted draft-only KC smoke: {targeted_ok}/{len(targeted)} picked pending drafts")

    draft_by_tag = Counter(d.kst_irt_tag for d in draft_rows)
    draft_by_kc = Counter(str(d.kc_id) for d in draft_rows)
    report = {
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "draft_tags": tags,
        "counts": {
            "active_items": active_total,
            "active_kcs": len(active_items),
            "pending_drafts_injected": draft_total,
            "pending_draft_kcs": len(draft_by_kc),
            "merged_items": merged_total,
            "merged_kcs": len(with_drafts),
        },
        "drafts_by_tag": dict(draft_by_tag),
        "validation": validation,
        "targeted_draft_only_kc_smoke": targeted,
    }

    out_path = Path(__file__).parent.parent.parent / "docs" / "pending_draft_assessment_smoke.json"
    out_path.write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"Report written to {out_path}")


if __name__ == "__main__":
    asyncio.run(main())
