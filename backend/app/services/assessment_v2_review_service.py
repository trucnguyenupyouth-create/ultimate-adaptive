"""
File-backed Assessment V2 item review store.

This is intentionally JSON-first: the V2 review flow is a local academic review
workspace, not production item approval. No DB migration is required.
"""

from __future__ import annotations

import json
import os
from copy import deepcopy
from datetime import datetime, timezone
from pathlib import Path
from typing import Any


ROOT = Path(__file__).resolve().parents[2]
STORE_PATH = ROOT / "data" / "assessment_v2_review" / "review_items.json"

VALID_DECISIONS = {"needs_review", "accepted", "rejected", "revise"}


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def _load_store() -> dict[str, Any]:
    if not STORE_PATH.exists():
        return {"items": [], "gap_records": []}
    return json.loads(STORE_PATH.read_text(encoding="utf-8"))


def _write_store(data: dict[str, Any]) -> None:
    STORE_PATH.parent.mkdir(parents=True, exist_ok=True)
    tmp = STORE_PATH.with_suffix(".json.tmp")
    tmp.write_text(json.dumps(data, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    os.replace(tmp, STORE_PATH)


def _summarize(items: list[dict[str, Any]], gap_records: list[dict[str, Any]]) -> dict[str, Any]:
    decisions = {decision: 0 for decision in VALID_DECISIONS}
    clusters: dict[str, int] = {}
    answer_types: dict[str, int] = {}
    flagged = 0
    codex_added = 0
    short_text = 0
    missing_requires = 0

    for item in items:
        decision = item.get("review_decision") or "needs_review"
        decisions[decision] = decisions.get(decision, 0) + 1
        cluster = item.get("cluster") or "unknown"
        clusters[cluster] = clusters.get(cluster, 0) + 1
        answer_type = item.get("answer_type") or "unknown"
        answer_types[answer_type] = answer_types.get(answer_type, 0) + 1
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
        "flagged": flagged,
        "codex_added": codex_added,
        "short_text": short_text,
        "missing_requires": missing_requires,
    }


def list_review_items() -> dict[str, Any]:
    data = _load_store()
    items = data.get("items", [])
    gap_records = data.get("gap_records", [])
    return {
        "items": items,
        "gap_records": gap_records,
        "summary": _summarize(items, gap_records),
    }


def update_review_item(review_id: str, patch: dict[str, Any]) -> dict[str, Any]:
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
        return deepcopy(item)

    raise KeyError(f"Review item {review_id} not found")
