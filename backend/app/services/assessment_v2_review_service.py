"""
Assessment V2 item review store.

Production review state is DB-backed so academic decisions/comments survive
deploys and server restarts. The JSON file remains the seed/export artifact for
the generated V2 item set.
"""

from __future__ import annotations

import json
import os
import re
from copy import deepcopy
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.models import AssessmentV2ItemReview


ROOT = Path(__file__).resolve().parents[2]
STORE_PATH = ROOT / "data" / "assessment_v2_review" / "review_items.json"

VALID_DECISIONS = {"needs_review", "accepted", "rejected", "revise"}

REPLACEMENT_SUGGESTIONS: dict[str, dict[str, Any]] = {
    "v2-001": {
        "recommended_review_action": "replace_required",
        "suggested_replacement": {
            "question": "Với biểu thức 7/(n - 3), giá trị nào của n làm biểu thức không phải là phân số hợp lệ?",
            "answer_type": "integer",
            "accepted_answers": ["3"],
            "reason": "Đo điều kiện mẫu số khác 0 mà không đưa sẵn lựa chọn 5/0 trong đề.",
        },
    },
    "v2-037": {
        "recommended_review_action": "replace_required",
        "suggested_replacement": {
            "question": "Điền một số nguyên vào ô trống để 4/□ không phải là phân số hợp lệ.",
            "answer_type": "integer",
            "accepted_answers": ["0"],
            "reason": "Loại bỏ danh sách lựa chọn nhìn-ra-ngay; vẫn đo zero denominator.",
        },
    },
    "v2-002": {
        "recommended_review_action": "replace_required",
        "suggested_replacement": {
            "question": "Điền k để 6/8 = k/12.",
            "answer_type": "integer",
            "accepted_answers": ["9"],
            "reason": "Thay câu Có/Không 50% guessing bằng equivalent-fraction construction.",
        },
    },
    "v2-036": {
        "recommended_review_action": "replace_required",
        "suggested_replacement": {
            "question": "Rút gọn phân số 14/21 về dạng tối giản.",
            "answer_type": "fraction",
            "accepted_answers": ["2/3"],
            "reason": "Đo trực tiếp năng lực rút gọn, không phải binary equality.",
        },
    },
    "v2-029": {
        "recommended_review_action": "replace_required",
        "suggested_replacement": {
            "question": "Lan gieo 20 lần được 8 lần mặt ngửa; Minh gieo 50 lần được 20 lần mặt ngửa. Tính xác suất thực nghiệm của mỗi bạn, viết dạng {Lan; Minh}.",
            "answer_type": "set",
            "accepted_answers": ["{2/5; 2/5}", "{8/20; 20/50}"],
            "reason": "Bắt học sinh tính hai xác suất trước, rồi hệ thống có thể suy ra bằng nhau.",
        },
    },
    "v2-025": {
        "recommended_review_action": "replace_required",
        "suggested_replacement": {
            "question": "Số 37 có bao nhiêu ước dương?",
            "answer_type": "integer",
            "accepted_answers": ["2"],
            "reason": "Tránh nhãn nguyên tố/hợp số dạng binary; đo hiểu biết qua số ước.",
        },
    },
    "v2-026": {
        "recommended_review_action": "human_review_only",
        "suggested_replacement": {
            "question": "Tìm ƯCLN(18, 24), rồi liệt kê tất cả ước dương của số đó.",
            "answer_type": "set",
            "accepted_answers": ["{1,2,3,6}"],
            "reason": "Nếu cần auto-score, chuyển conceptual explanation thành thao tác tính có thể chấm chắc.",
        },
    },
}

WIDGET_REQUIRED_IDS: dict[str, str] = {
    "v2-015": "power_widget",
    "v2-016": "power_widget",
    "v2-046": "power_widget",
    "v2-047": "power_widget",
    "v2-017": "expression_parser",
    "v2-048": "expression_parser",
    "v2-049": "expression_parser",
    "v2-018": "ordered_list_widget",
    "v2-050": "ordered_list_widget",
}


def _now() -> datetime:
    return datetime.now(timezone.utc)


def _now_iso() -> str:
    return _now().isoformat()


def _load_store() -> dict[str, Any]:
    if not STORE_PATH.exists():
        return {"items": [], "gap_records": []}
    return json.loads(STORE_PATH.read_text(encoding="utf-8"))


def _write_store(data: dict[str, Any]) -> None:
    STORE_PATH.parent.mkdir(parents=True, exist_ok=True)
    tmp = STORE_PATH.with_suffix(".json.tmp")
    tmp.write_text(json.dumps(data, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    os.replace(tmp, STORE_PATH)


def _risk_tags_for_item(item: dict[str, Any]) -> list[str]:
    question = str(item.get("question") or "").lower()
    answer_type = item.get("answer_type")
    accepted_answers = item.get("accepted_answers") or []
    tags: list[str] = []

    if re.search(r"trong các|các cách viết|cách viết nào|nào không|chọn", question):
        tags.append("mcq_disguised")
    if re.search(
        r'trả lời\s+["“]?có|có bằng|có hay không|đúng hay sai|nguyên tố hay hợp số|hợp số hay nguyên tố',
        question,
    ):
        tags.append("binary_disguised")
    if re.search(r"sắp xếp các số|sắp xếp.*theo", question):
        tags.append("ordered_list_widget")
    if answer_type == "short_text" and re.search(r"lũy thừa|bỏ dấu ngoặc", question):
        tags.append("expression_parser_widget")
    if answer_type == "short_text" and any(isinstance(answer, str) and len(answer) > 18 for answer in accepted_answers):
        tags.append("fragile_text_grader")
    if re.search(r"nêu lí do|nêu lý do|giải thích|vì sao", question):
        tags.append("reasoning_hard_to_auto_grade")

    return list(dict.fromkeys(tags))


def enrich_review_item(item: dict[str, Any]) -> dict[str, Any]:
    """Attach review-risk metadata without mutating source persistence."""
    enriched = deepcopy(item)
    tags = _risk_tags_for_item(enriched)
    review_id = enriched.get("review_id")

    if review_id in WIDGET_REQUIRED_IDS and "needs_widget_checker" not in tags:
        tags.append("needs_widget_checker")

    suggestion = REPLACEMENT_SUGGESTIONS.get(str(review_id))
    if suggestion:
        enriched.update(deepcopy(suggestion))
    elif review_id in WIDGET_REQUIRED_IDS:
        enriched["recommended_review_action"] = "needs_widget_checker"
        enriched["required_checker"] = WIDGET_REQUIRED_IDS[str(review_id)]
    elif tags:
        enriched["recommended_review_action"] = "review_risk"
    else:
        enriched["recommended_review_action"] = "ready_for_algorithm"

    enriched["risk_tags"] = tags
    enriched["grader_readiness"] = "ready" if enriched["recommended_review_action"] == "ready_for_algorithm" else "blocked"
    return enriched


def _seed_review_values(item: dict[str, Any]) -> dict[str, Any]:
    enriched = enrich_review_item(item)
    risky = enriched["recommended_review_action"] != "ready_for_algorithm"
    decision = item.get("review_decision") or ("revise" if risky else "needs_review")
    flagged = bool(item.get("flagged_for_review") or risky)
    history = item.get("review_history") or []

    if risky and not history:
        history = [{
            "at": _now_iso(),
            "action": "auto_risk_audit",
            "before": None,
            "after": {
                "review_decision": decision,
                "flagged_for_review": flagged,
                "risk_tags": enriched["risk_tags"],
                "recommended_review_action": enriched["recommended_review_action"],
            },
            "note": "Codex flagged this item before academic approval because it is not ready for auto-scored open diagnostic use.",
        }]

    return {
        "review_decision": decision,
        "flagged_for_review": flagged,
        "review_comment": item.get("review_comment") or "",
        "reviewed_at": item.get("reviewed_at"),
        "review_history": history,
    }


def _merge_row(row: AssessmentV2ItemReview) -> dict[str, Any]:
    item = deepcopy(row.item_payload or {})
    item["review_id"] = row.review_id
    item["review_decision"] = row.review_decision
    item["flagged_for_review"] = bool(row.flagged_for_review)
    item["review_comment"] = row.review_comment or ""
    item["reviewed_at"] = row.reviewed_at.isoformat() if row.reviewed_at else None
    item["review_history"] = row.review_history or []
    return enrich_review_item(item)


async def _ensure_seeded(db: AsyncSession) -> None:
    seed_items = _load_store().get("items", [])
    if not seed_items:
        return

    result = await db.execute(select(AssessmentV2ItemReview.review_id))
    existing = {row[0] for row in result.fetchall()}
    missing = [item for item in seed_items if item.get("review_id") and item["review_id"] not in existing]
    if not missing:
        return

    now = _now()
    for item in missing:
        review_values = _seed_review_values(item)
        payload = {
            key: value
            for key, value in item.items()
            if key not in {"review_decision", "flagged_for_review", "review_comment", "reviewed_at", "review_history"}
        }
        reviewed_at = review_values["reviewed_at"]
        if isinstance(reviewed_at, str) and reviewed_at:
            reviewed_at = datetime.fromisoformat(reviewed_at.replace("Z", "+00:00"))
        else:
            reviewed_at = None

        db.add(AssessmentV2ItemReview(
            review_id=item["review_id"],
            item_payload=payload,
            review_decision=review_values["review_decision"],
            flagged_for_review=review_values["flagged_for_review"],
            review_comment=review_values["review_comment"],
            review_history=review_values["review_history"],
            reviewed_at=reviewed_at,
            updated_at=now,
        ))
    await db.commit()


def _summarize(items: list[dict[str, Any]], gap_records: list[dict[str, Any]]) -> dict[str, Any]:
    decisions = {decision: 0 for decision in VALID_DECISIONS}
    clusters: dict[str, int] = {}
    answer_types: dict[str, int] = {}
    risk_counts: dict[str, int] = {}
    action_counts: dict[str, int] = {}
    flagged = 0
    codex_added = 0
    short_text = 0
    missing_requires = 0
    ready_for_algorithm = 0

    for item in items:
        decision = item.get("review_decision") or "needs_review"
        decisions[decision] = decisions.get(decision, 0) + 1
        cluster = item.get("cluster") or "unknown"
        clusters[cluster] = clusters.get(cluster, 0) + 1
        answer_type = item.get("answer_type") or "unknown"
        answer_types[answer_type] = answer_types.get(answer_type, 0) + 1
        action = item.get("recommended_review_action") or "unknown"
        action_counts[action] = action_counts.get(action, 0) + 1
        for tag in item.get("risk_tags") or []:
            risk_counts[tag] = risk_counts.get(tag, 0) + 1
        if item.get("grader_readiness") == "ready":
            ready_for_algorithm += 1
        if item.get("flagged_for_review"):
            flagged += 1
        if item.get("codex_review_status") == "provisionally_accepted_for_algorithm_test_only":
            codex_added += 1
        if answer_type == "short_text":
            short_text += 1
        if not item.get("requires_kcs"):
            missing_requires += 1

    return {
        "total": len(items),
        "gap_records": len(gap_records),
        "decisions": decisions,
        "clusters": clusters,
        "answer_types": answer_types,
        "risk_counts": risk_counts,
        "action_counts": action_counts,
        "flagged": flagged,
        "codex_added": codex_added,
        "short_text": short_text,
        "missing_requires": missing_requires,
        "ready_for_algorithm": ready_for_algorithm,
    }


async def list_review_items_db(db: AsyncSession) -> dict[str, Any]:
    await _ensure_seeded(db)
    result = await db.execute(select(AssessmentV2ItemReview).order_by(AssessmentV2ItemReview.review_id))
    items = [_merge_row(row) for row in result.scalars().all()]
    gap_records = _load_store().get("gap_records", [])
    return {
        "items": items,
        "gap_records": gap_records,
        "summary": _summarize(items, gap_records),
    }


async def update_review_item_db(db: AsyncSession, review_id: str, patch: dict[str, Any]) -> dict[str, Any]:
    await _ensure_seeded(db)
    result = await db.execute(select(AssessmentV2ItemReview).where(AssessmentV2ItemReview.review_id == review_id))
    row = result.scalar_one_or_none()
    if row is None:
        raise KeyError(f"Review item {review_id} not found")

    before = {
        "review_decision": row.review_decision,
        "flagged_for_review": bool(row.flagged_for_review),
        "review_comment": row.review_comment or "",
    }

    if "review_decision" in patch and patch["review_decision"] is not None:
        decision = patch["review_decision"]
        if decision not in VALID_DECISIONS:
            raise ValueError(f"Invalid review_decision: {decision}")
        row.review_decision = decision
        row.reviewed_at = _now() if decision != "needs_review" else None

    if "flagged_for_review" in patch and patch["flagged_for_review"] is not None:
        row.flagged_for_review = bool(patch["flagged_for_review"])

    if "review_comment" in patch and patch["review_comment"] is not None:
        row.review_comment = str(patch["review_comment"])

    after = {
        "review_decision": row.review_decision,
        "flagged_for_review": bool(row.flagged_for_review),
        "review_comment": row.review_comment or "",
    }
    history = list(row.review_history or [])
    history.append({
        "at": _now_iso(),
        "action": "review_update",
        "before": before,
        "after": after,
        "note": patch.get("note"),
    })
    row.review_history = history
    row.updated_at = _now()

    await db.commit()
    await db.refresh(row)
    return _merge_row(row)


def list_review_items() -> dict[str, Any]:
    """File-backed fallback used by small unit tests and local JSON inspection."""
    data = _load_store()
    items = [enrich_review_item(item) for item in data.get("items", [])]
    gap_records = data.get("gap_records", [])
    return {
        "items": items,
        "gap_records": gap_records,
        "summary": _summarize(items, gap_records),
    }


def update_review_item(review_id: str, patch: dict[str, Any]) -> dict[str, Any]:
    """File-backed fallback used by existing unit tests."""
    data = _load_store()
    items = data.get("items", [])
    now = _now_iso()

    for item in items:
        if item.get("review_id") != review_id:
            continue

        before = {
            "review_decision": item.get("review_decision", "needs_review"),
            "flagged_for_review": bool(item.get("flagged_for_review")),
            "review_comment": item.get("review_comment", ""),
        }

        if "review_decision" in patch and patch["review_decision"] is not None:
            decision = patch["review_decision"]
            if decision not in VALID_DECISIONS:
                raise ValueError(f"Invalid review_decision: {decision}")
            item["review_decision"] = decision
            item["reviewed_at"] = now if decision != "needs_review" else None

        if "flagged_for_review" in patch and patch["flagged_for_review"] is not None:
            item["flagged_for_review"] = bool(patch["flagged_for_review"])

        if "review_comment" in patch and patch["review_comment"] is not None:
            item["review_comment"] = str(patch["review_comment"])

        history = item.setdefault("review_history", [])
        history.append({
            "at": now,
            "action": "review_update",
            "before": before,
            "after": {
                "review_decision": item.get("review_decision", "needs_review"),
                "flagged_for_review": bool(item.get("flagged_for_review")),
                "review_comment": item.get("review_comment", ""),
            },
            "note": patch.get("note"),
        })

        _write_store(data)
        return enrich_review_item(item)

    raise KeyError(f"Review item {review_id} not found")
