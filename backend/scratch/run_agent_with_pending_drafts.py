"""
Run one Gemini-agent assessment using active items + today's pending drafts.

Read-only:
  - Does not approve drafts.
  - Does not insert/update/delete DB rows.
  - Pending drafts are mapped into item-shaped dicts in memory only.

Outputs:
  - docs/agent_pending_draft_assessment.json
  - docs/agent_pending_draft_assessment.md
"""

from __future__ import annotations

import asyncio
import json
import os
import re
import sys
from collections import Counter, defaultdict
from datetime import datetime, timezone
from pathlib import Path
from urllib.parse import urlparse

from sqlalchemy import select
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine

sys.path.insert(0, str(Path(__file__).parent.parent))

from app.engines.agent_student import StudentPersona, create_agent_session, get_correct_answer
from app.engines.assessment import CATController
from app.engines.knowledge_graph import KnowledgeGraph
from app.models.models import Item, ItemDraft, KCPrerequisite, KnowledgeComponent


DEFAULT_DRAFT_TAGS = (
    "batch_import_20260622",
    "batch_import_70_115_20260622",
)

DIFFICULTY_TO_B = {
    "easy": -1.0,
    "medium": 0.0,
    "hard": 1.5,
}


MINH_KNOWS_CODE_SNIPPETS = (
    "NHAN-BIET-TAP",
    "BIEU-DIEN-TAP",
    "DAU-HIEU-CHIA",
    "NHAN-BIET-DIEU",
    "CONG-HAI-SO",
    "TU-CHO-SO",
    "TIA",
    "DOAN",
    "DIEM",
    "BA-DIEM-THANG",
)

MINH_GAP_CODE_SNIPPETS = (
    "LUY",
    "UCLN",
    "BCNN",
    "UOC-LUONG",
    "PHAN",
    "QUY-DONG",
    "GOC",
    "THONG-KE",
    "BIEU-DO",
)


def load_env_file() -> dict[str, str]:
    env = {}
    env_path = Path(__file__).parent.parent / ".env"
    if env_path.exists():
        for line in env_path.read_text(encoding="utf-8").splitlines():
            line = line.strip()
            if not line or line.startswith("#") or "=" not in line:
                continue
            key, value = line.split("=", 1)
            env[key.strip()] = value.strip().strip('"').strip("'")
    return env


def database_url() -> str:
    env = load_env_file()
    url = os.environ.get("DATABASE_URL") or env.get("DATABASE_URL")

    # The repo has an older direct Supabase connection smoke test. Prefer an
    # explicit env var, but use this fallback if the pooler DNS is unavailable.
    if os.environ.get("USE_DIRECT_DB_FALLBACK", "1") == "1":
        conn_test = Path(__file__).parent / "test_db_conn.py"
        if conn_test.exists():
            match = re.search(r'url = "([^"]+)"', conn_test.read_text(encoding="utf-8"))
            if match:
                url = match.group(1)

    if not url:
        raise RuntimeError("DATABASE_URL is not configured")
    return url


def draft_tags() -> list[str]:
    raw = os.environ.get("DRAFT_TAGS")
    if not raw:
        return list(DEFAULT_DRAFT_TAGS)
    return [tag.strip() for tag in raw.split(",") if tag.strip()]


def item_summary(item: dict) -> dict:
    content = item.get("content") or {}
    if isinstance(content, str):
        try:
            content = json.loads(content)
        except json.JSONDecodeError:
            content = {"question": content, "answers": []}
    answers = content.get("answers") or []
    return {
        "question": content.get("question", ""),
        "answers": [
            {
                "label": a.get("label"),
                "text": a.get("text", ""),
                "is_correct": bool(a.get("is_correct")),
            }
            for a in answers
        ],
        "correct_answer": next((a.get("label") for a in answers if a.get("is_correct")), None),
    }


def map_item(item: Item) -> dict:
    return {
        "id": str(item.id),
        "kc_id": str(item.kc_id),
        "content": item.content,
        "irt_a": float(item.irt_a or 1.0),
        "irt_b": float(item.irt_b or 0.0),
        "irt_c": float(item.irt_c or 0.25),
        "is_diagnostic_anchor": bool(item.is_diagnostic_anchor),
        "difficulty_label": item.difficulty_label,
        "_source": "active_item",
    }


def map_draft(draft: ItemDraft) -> dict:
    difficulty = (draft.difficulty_label or "medium").lower()
    return {
        "id": f"draft:{draft.id}",
        "kc_id": str(draft.kc_id),
        "content": draft.content,
        "irt_a": 1.0,
        "irt_b": DIFFICULTY_TO_B.get(difficulty, 0.0),
        "irt_c": 0.25,
        "is_diagnostic_anchor": bool(draft.is_diagnostic_anchor),
        "difficulty_label": draft.difficulty_label,
        "_source": "pending_draft",
        "_draft_tag": draft.kst_irt_tag,
    }


async def load_data() -> tuple:
    url = database_url()
    parsed = urlparse(url)
    print(f"Connecting read-only to DB host: {parsed.hostname}")
    engine = create_async_engine(
        url,
        echo=False,
        connect_args={
            "statement_cache_size": 0,
            "prepared_statement_cache_size": 0,
        },
    )
    Session = async_sessionmaker(engine, expire_on_commit=False)
    tags = draft_tags()

    async with Session() as db:
        kcs = (await db.execute(select(KnowledgeComponent))).scalars().all()
        edges = (await db.execute(select(KCPrerequisite))).scalars().all()
        items = (await db.execute(select(Item).where(Item.is_active == True))).scalars().all()
        drafts = (await db.execute(
            select(ItemDraft).where(
                ItemDraft.status == "pending",
                ItemDraft.kst_irt_tag.in_(tags),
                (ItemDraft.flagged == False) | (ItemDraft.flagged.is_(None)),
            )
        )).scalars().all()

    await engine.dispose()

    kg = KnowledgeGraph()
    kg.load_from_dicts(
        kcs=[{
            "id": str(kc.id),
            "code": kc.code,
            "name": kc.name,
            "grade": kc.grade,
            "subject": kc.subject,
            "chapter_info": kc.chapter_info,
            "metadata": kc.metadata_,
        } for kc in kcs],
        prerequisites=[{
            "kc_id": str(edge.kc_id),
            "prereq_id": str(edge.prereq_id),
            "label": edge.label,
            "weight": edge.weight,
            "edge_type": edge.edge_type,
        } for edge in edges],
    )

    available: dict[str, list[dict]] = defaultdict(list)
    for item in items:
        mapped = map_item(item)
        available[mapped["kc_id"]].append(mapped)
    for draft in drafts:
        mapped = map_draft(draft)
        available[mapped["kc_id"]].append(mapped)

    kc_names = {str(kc.id): kc.name for kc in kcs}
    kc_codes = {str(kc.id): kc.code for kc in kcs}
    return kg, dict(available), kc_names, kc_codes, items, drafts


def build_minh_persona(kc_codes: dict[str, str]) -> StudentPersona:
    true_mastery: dict[str, bool] = {}
    for kc_id, code in kc_codes.items():
        if any(snippet in code for snippet in MINH_KNOWS_CODE_SNIPPETS):
            true_mastery[kc_id] = True
        elif any(snippet in code for snippet in MINH_GAP_CODE_SNIPPETS):
            true_mastery[kc_id] = False
        else:
            # Unknown topics default to gap for a conservative student model.
            true_mastery[kc_id] = False

    return StudentPersona(
        name="Minh_pending_draft_smoke",
        true_theta=0.25,
        true_mastery=true_mastery,
        p_slip=0.08,
        p_guess=0.25,
        ability_description="Học sinh lớp 6 trung bình khá: biết nền tảng tập hợp, chia hết cơ bản, điểm/đường thẳng; hổng phân số, UCLN/BCNN, lũy thừa và góc.",
        knowledge_detail=(
            "Em BIẾT: nhận biết/liệt kê tập hợp, một số dấu hiệu chia hết cơ bản, "
            "điểm/đoạn thẳng/tia, vài phép cộng trừ số nguyên đơn giản.\n"
            "Em KHÔNG VỮNG: phân số, quy đồng, UCLN/BCNN, lũy thừa, góc, biểu đồ/thống kê."
        ),
        carefulness="trung bình, đôi khi đọc nhanh",
        when_unsure="đoán theo đáp án trông quen hoặc theo quy tắc em nhớ mang máng",
        speed="vừa phải",
        common_mistakes="nhầm quy tắc phân số, lẫn UCLN/BCNN, nhầm lũy thừa thành nhân, chưa chắc về góc",
    )


def qualitative_step_note(*, step: dict, previous: dict | None) -> str:
    if previous is None:
        return (
            "Câu đầu của KC: hệ thống nên ưu tiên diagnostic anchor nếu có. "
            f"Item source={step['source']}, anchor={step['is_diagnostic_anchor']}."
        )
    if step["kc_id"] == previous["kc_id"]:
        return (
            "Hệ thống tiếp tục cùng KC để tích lũy bằng chứng trước khi pass/fail. "
            "Đây là hợp lý nếu chưa đủ streak/IRT confidence."
        )
    prev_result = "đúng" if previous["agent_correct"] else "sai"
    direction = "đổi KC sau câu trước"
    return (
        f"Hệ thống {direction}; câu trước agent trả lời {prev_result}. "
        "Cần xem KC mới là prerequisite/successor để judge hướng đi KST có hợp lý."
    )


async def main() -> None:
    kg, available, kc_names, kc_codes, active_items, drafts = await load_data()
    persona = build_minh_persona(kc_codes)
    agent = await create_agent_session(persona)
    cat = CATController(kg, use_irt=True)

    result = cat.start(
        student_id="agent_pending_draft_smoke",
        known_kcs=set(),
        theta=0.0,
        available_items=available,
    )
    if result["status"] == "no_kcs_available":
        raise RuntimeError("No KCs available")

    steps = []
    max_items = int(os.environ.get("MAX_AGENT_ITEMS", "18"))
    previous = None
    for idx in range(1, max_items + 1):
        if result["status"] == "done":
            break
        item = result.get("item")
        if item is None:
            break

        session = result["session"]
        kc_id = session["kc"]
        kc_code = kc_codes.get(kc_id, kc_id)
        kc_name = kc_names.get(kc_id, kc_id)
        agent_response = await agent.answer_question(item, kc_name)
        q = item_summary(item)

        step = {
            "step": idx,
            "kc_id": kc_id,
            "kc_code": kc_code,
            "kc_name": kc_name,
            "item_id": item.get("id"),
            "source": item.get("_source", "active_item"),
            "difficulty_label": item.get("difficulty_label"),
            "irt_b": item.get("irt_b"),
            "is_diagnostic_anchor": item.get("is_diagnostic_anchor", False),
            "question": q["question"],
            "answers": q["answers"],
            "correct_answer": q["correct_answer"] or get_correct_answer(item),
            "agent_answer": agent_response.answer,
            "agent_correct": agent_response.correct,
            "agent_thinking": agent_response.thinking,
            "persona_knows_kc": persona.true_mastery.get(kc_id),
            "theta_before": session.get("theta"),
            "theta_se_before": session.get("theta_se"),
            "streak_correct_before": session.get("streak_correct"),
            "streak_wrong_before": session.get("streak_wrong"),
        }
        step["qualitative_note"] = qualitative_step_note(step=step, previous=previous)
        steps.append(step)
        previous = step

        result = cat.respond(result["session"], item, agent_response.correct, available)

    session = result.get("session", {})
    assessed = session.get("kc_results", {})
    passed = [kc_id for kc_id, outcome in assessed.items() if outcome == "pass"]
    gaps = [kc_id for kc_id, outcome in assessed.items() if outcome != "pass"]
    source_counts = Counter(step["source"] for step in steps)

    judgement = []
    if not steps:
        judgement.append("Không có step nào được chạy.")
    elif source_counts.get("pending_draft", 0) == 0:
        judgement.append(
            "Run agent tự nhiên chưa chạm tới pending drafts. Điều này không sai về mặt engine, "
            "nhưng chưa validate chất lượng các câu mới import trong đường đi tự nhiên này."
        )
    else:
        judgement.append(
            "Run agent đã dùng pending drafts, nên có thể đọc trực tiếp chất lượng câu mới trong transcript."
        )

    if len(assessed) <= 2:
        judgement.append(
            "Assessment đi qua rất ít KC. Với mục tiêu identify lỗ hổng rộng của trẻ lớp 6, "
            "đây là tín hiệu chưa đủ tốt: engine còn thiên về single-path KST, dễ bỏ sót lỗ hổng ở nhánh khác."
        )
    else:
        judgement.append(
            "Assessment đi qua nhiều hơn 2 KC, có tín hiệu khám phá được nhiều điểm hơn một single-path ngắn."
        )

    repeated_items = [
        item_id for item_id, cnt in Counter(step["item_id"] for step in steps).items()
        if cnt > 1
    ]
    if repeated_items:
        judgement.append(
            "Có item bị hỏi lặp lại trong cùng run. Đây là điểm yếu nghiêm trọng cho diagnostic validity; "
            "student có thể trả lời bằng trí nhớ thay vì năng lực, và evidence IRT/streak bị méo."
        )

    report = {
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "mode": "agent",
        "draft_tags": draft_tags(),
        "counts": {
            "active_items": len(active_items),
            "pending_drafts_injected": len(drafts),
            "available_kcs": len(available),
            "steps": len(steps),
            "pending_draft_steps": source_counts.get("pending_draft", 0),
        },
        "persona": persona.to_dict(),
        "assessment_result": {
            "status": result.get("status"),
            "theta": session.get("theta"),
            "theta_se": session.get("theta_se"),
            "kcs_visited": len(assessed),
            "passed": [{"code": kc_codes.get(k), "name": kc_names.get(k)} for k in passed],
            "gaps": [{"code": kc_codes.get(k), "name": kc_names.get(k), "outcome": assessed.get(k)} for k in gaps],
        },
        "judgement": judgement,
        "steps": steps,
        "cost": {
            "api_calls": agent.step_count,
            "total_cost_usd": round(agent.total_cost, 6),
        },
    }

    root = Path(__file__).parent.parent.parent
    json_path = root / "docs" / "agent_pending_draft_assessment.json"
    md_path = root / "docs" / "agent_pending_draft_assessment.md"
    json_path.write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding="utf-8")
    md_path.write_text(render_markdown(report), encoding="utf-8")

    print(f"Agent steps: {len(steps)}")
    print(f"Pending draft steps: {source_counts.get('pending_draft', 0)}")
    print(f"KCs visited: {len(assessed)}")
    print(f"Cost: ${agent.total_cost:.6f} / {agent.step_count} calls")
    print(f"Wrote {json_path}")
    print(f"Wrote {md_path}")


def render_markdown(report: dict) -> str:
    lines = []
    lines.append("# Agent Assessment With Pending Drafts")
    lines.append("")
    lines.append("## Summary")
    counts = report["counts"]
    lines.append(f"- Active items: {counts['active_items']}")
    lines.append(f"- Pending drafts injected in memory: {counts['pending_drafts_injected']}")
    lines.append(f"- Steps: {counts['steps']}")
    lines.append(f"- Pending draft steps: {counts['pending_draft_steps']}")
    lines.append(f"- KCs visited: {report['assessment_result']['kcs_visited']}")
    lines.append(f"- Cost: ${report['cost']['total_cost_usd']} / {report['cost']['api_calls']} calls")
    lines.append("")
    lines.append("## Expert Judgement")
    for note in report["judgement"]:
        lines.append(f"- {note}")
    lines.append("")
    lines.append("## Assessment Result")
    lines.append("### Passed")
    for kc in report["assessment_result"]["passed"]:
        lines.append(f"- {kc['code']} - {kc['name']}")
    lines.append("")
    lines.append("### Gaps")
    for kc in report["assessment_result"]["gaps"]:
        lines.append(f"- {kc['code']} - {kc['name']} ({kc['outcome']})")
    lines.append("")
    lines.append("## Full Transcript")
    for step in report["steps"]:
        lines.append("")
        lines.append(f"### Step {step['step']}: {step['kc_code']} - {step['kc_name']}")
        lines.append(f"- Item: `{step['item_id']}`")
        lines.append(f"- Source: `{step['source']}`")
        lines.append(f"- Difficulty: `{step['difficulty_label']}` / b={step['irt_b']}")
        lines.append(f"- Diagnostic anchor: `{step['is_diagnostic_anchor']}`")
        lines.append(f"- Persona knows KC: `{step['persona_knows_kc']}`")
        lines.append(f"- Theta before: `{step['theta_before']}`, SE: `{step['theta_se_before']}`")
        lines.append("")
        lines.append(f"Question: {step['question']}")
        lines.append("")
        for ans in step["answers"]:
            marker = " (correct)" if ans["is_correct"] else ""
            lines.append(f"- {ans['label']}. {ans['text']}{marker}")
        lines.append("")
        lines.append(f"Agent thinking: {step['agent_thinking']}")
        lines.append(f"Agent answer: `{step['agent_answer']}`")
        lines.append(f"Correct answer: `{step['correct_answer']}`")
        lines.append(f"Outcome: `{'correct' if step['agent_correct'] else 'wrong'}`")
        lines.append(f"Qualitative note: {step['qualitative_note']}")
    lines.append("")
    return "\n".join(lines)


if __name__ == "__main__":
    asyncio.run(main())
