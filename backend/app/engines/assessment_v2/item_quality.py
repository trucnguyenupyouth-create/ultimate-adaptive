"""Quality gates for official Assessment V2 open-ended item banks.

These checks protect against the mistakes that make an adaptive diagnostic
look larger than it really is: disguised MCQ items, binary prompts, unsupported
widgets/checkers, hidden skills, and duplicated surface forms.
"""

from __future__ import annotations

import re
import unicodedata
from collections import defaultdict
from typing import Any


OFFICIAL_ITEM_ROLES = {
    "anchor",
    "misconception",
    "prerequisite_probe",
    "confirmation",
    "transfer",
    "bridge",
    "readiness",
}

SUPPORTED_WIDGET_CHECKERS = {
    "number": {"numeric_equal"},
    "decimal": {"numeric_equal", "decimal_equal"},
    "fraction": {"fraction_equal"},
    "power": {"power_tuple"},
    "expression": {"expression_equivalent"},
    "ordered_list": {"ordered_list_equal"},
    "set": {"set_equal"},
    "probability": {"probability_equal"},
    "coordinate_pair": {"coordinate_pair_equal"},
    "ordered_pair_list": {"ordered_pair_list_equal"},
}


def _normalize_ascii(value: Any) -> str:
    text = "" if value is None else str(value)
    text = unicodedata.normalize("NFD", text.strip().lower())
    text = "".join(ch for ch in text if unicodedata.category(ch) != "Mn")
    return re.sub(r"\s+", " ", text)


def infer_surface_signature(question: str) -> str:
    """Create a rough structural fingerprint for duplicate detection."""
    text = _normalize_ascii(question)
    text = re.sub(r"\d+\s*/\s*\d+", "<frac>", text)
    text = re.sub(r"\d+(?:[.,]\d+)?%?", "<num>", text)
    text = re.sub(r"\b[a-z]\b", "<var>", text)
    text = re.sub(r"[+\-*/^=(){}\[\]]+", " <op> ", text)
    text = re.sub(r"\s+", " ", text).strip()
    return text[:180]


def risk_tags_for_official_item(item: dict[str, Any]) -> list[str]:
    question = _normalize_ascii(item.get("question"))
    answer_type = _normalize_ascii(item.get("answer_type"))
    accepted_answers = item.get("accepted_answers") or []
    tags: list[str] = []

    if re.search(r"\btrong cac\b|cach viet nao|khẳng định nào|khang dinh nao|chon|lua chon", question):
        tags.append("mcq_disguised")
    if re.search(r"tra loi ['\"]?co|co hay khong|dung hay sai|co bang nhau khong|yes/no", question):
        tags.append("binary_disguised")
    if re.search(r"neu li do|neu ly do|giai thich|vi sao", question):
        tags.append("reasoning_hard_to_auto_grade")
    if answer_type in {"short_text", "text"}:
        tags.append("fragile_text_grader")
    if any(isinstance(answer, str) and len(answer) > 32 for answer in accepted_answers):
        tags.append("long_accepted_answer")
    if not item.get("common_wrong_patterns"):
        tags.append("missing_common_wrong_patterns")
    if item.get("requires_kcs") is None:
        tags.append("missing_requires_kcs")
    return list(dict.fromkeys(tags))


def validate_official_item(item: dict[str, Any], *, strict_metadata: bool = True) -> dict[str, list[str]]:
    errors: list[str] = []
    warnings: list[str] = []

    question = str(item.get("question") or "").strip()
    if not question:
        errors.append("question is required")
    if not item.get("kc_id"):
        errors.append("kc_id is required")
    if not item.get("accepted_answers"):
        errors.append("accepted_answers is required")

    widget = str(item.get("answer_widget") or "").strip()
    checker = str(item.get("checker_type") or "").strip()
    if widget not in SUPPORTED_WIDGET_CHECKERS:
        errors.append(f"unsupported answer_widget: {widget or '<missing>'}")
    elif checker not in SUPPORTED_WIDGET_CHECKERS[widget]:
        errors.append(f"checker_type {checker or '<missing>'} is not supported for widget {widget}")

    role = str(item.get("item_role") or "").strip()
    if role and role not in OFFICIAL_ITEM_ROLES:
        errors.append(f"invalid item_role: {role}")

    if item.get("inference_strength") == "strong" and not item.get("academic_reviewed"):
        errors.append("strong inference requires academic_reviewed=true")

    if strict_metadata:
        for key in ("item_role", "item_family", "surface_signature"):
            if not item.get(key):
                errors.append(f"{key} is required for official assessment items")
    else:
        for key in ("item_role", "item_family", "surface_signature"):
            if not item.get(key):
                warnings.append(f"{key} is recommended for official assessment items")

    tags = risk_tags_for_official_item(item)
    blocking_tags = {"mcq_disguised", "binary_disguised", "fragile_text_grader", "reasoning_hard_to_auto_grade"}
    for tag in tags:
        if tag in blocking_tags:
            errors.append(tag)
        else:
            warnings.append(tag)

    if question and item.get("surface_signature") and item["surface_signature"] != infer_surface_signature(question):
        warnings.append("surface_signature differs from inferred signature; confirm this is intentional")

    return {"errors": list(dict.fromkeys(errors)), "warnings": list(dict.fromkeys(warnings))}


def validate_official_item_bank(items: list[dict[str, Any]]) -> dict[str, Any]:
    per_item: dict[str, dict[str, list[str]]] = {}
    family_params: dict[tuple[str, str], list[str]] = defaultdict(list)
    signatures: dict[str, list[str]] = defaultdict(list)

    for index, item in enumerate(items):
        item_id = str(item.get("review_id") or item.get("id") or f"item-{index + 1}")
        per_item[item_id] = validate_official_item(item)
        family = str(item.get("item_family") or "")
        params = str(item.get("parameter_set") or "")
        signature = str(item.get("surface_signature") or infer_surface_signature(str(item.get("question") or "")))
        if family and params:
            family_params[(family, params)].append(item_id)
        if signature:
            signatures[signature].append(item_id)

    duplicate_family_params = {
        f"{family}|{params}": ids
        for (family, params), ids in family_params.items()
        if len(ids) > 1
    }
    duplicate_signatures = {signature: ids for signature, ids in signatures.items() if len(ids) > 1}

    for ids in duplicate_family_params.values():
        for item_id in ids:
            per_item[item_id]["errors"].append("duplicate item_family + parameter_set")
    for ids in duplicate_signatures.values():
        for item_id in ids:
            per_item[item_id]["warnings"].append("duplicate surface_signature")

    errors = sum(len(result["errors"]) for result in per_item.values())
    warnings = sum(len(result["warnings"]) for result in per_item.values())
    return {
        "items": per_item,
        "summary": {
            "total": len(items),
            "errors": errors,
            "warnings": warnings,
            "duplicate_family_params": duplicate_family_params,
            "duplicate_surface_signatures": duplicate_signatures,
        },
    }
