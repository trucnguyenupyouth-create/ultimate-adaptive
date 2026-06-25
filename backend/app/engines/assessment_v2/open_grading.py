"""
Deterministic open-ended grading primitives for Assessment V2.

The goal is not to replace human/LLM review. This module handles the safe,
auditable cases first: exact text, numeric equality, fraction equivalence,
and known wrong patterns. Anything uncertain returns low confidence.
"""

from __future__ import annotations

import math
import re
import unicodedata
from dataclasses import dataclass, field
from fractions import Fraction
from typing import Any


OPEN_FORMAT_TYPES = {"open", "open_short", "fillin", "freetext"}
UNKNOWN_RESPONSES = {
    "",
    "khong biet",
    "khongbiet",
    "em khong biet",
    "con khong biet",
    "không biết",
    "em không biết",
    "con không biết",
    "idk",
    "i don't know",
    "i dont know",
}


@dataclass(frozen=True)
class OpenGradeResult:
    is_correct: bool
    confidence: float
    matched_rule: str
    normalized_answer: str
    diagnosed_misconception: str | None = None
    diagnosed_kcs: list[str] = field(default_factory=list)
    notes: list[str] = field(default_factory=list)


def normalize_text(value: Any) -> str:
    text = "" if value is None else str(value)
    text = unicodedata.normalize("NFC", text)
    text = text.strip().lower()
    text = re.sub(r"\s+", " ", text)
    return text


def normalize_ascii_key(value: Any) -> str:
    text = normalize_text(value)
    text = unicodedata.normalize("NFD", text)
    text = "".join(ch for ch in text if unicodedata.category(ch) != "Mn")
    text = re.sub(r"[^a-z0-9/.,+\-*= ]+", "", text)
    return text.strip()


def is_unknown_response(answer: Any) -> bool:
    text = normalize_ascii_key(answer)
    return text in UNKNOWN_RESPONSES


def _to_float(value: Any) -> float | None:
    text = normalize_ascii_key(value).replace(",", ".")
    text = re.sub(r"[^0-9+\-.]", "", text)
    if text in {"", "+", "-", ".", "+.", "-."}:
        return None
    try:
        number = float(text)
    except ValueError:
        return None
    return number if math.isfinite(number) else None


def _to_fraction(value: Any) -> Fraction | None:
    text = normalize_ascii_key(value).replace(" ", "")
    if not text:
        return None
    try:
        if "/" in text:
            return Fraction(text)
        number = _to_float(text)
        if number is None:
            return None
        return Fraction(str(number))
    except (ValueError, ZeroDivisionError):
        return None


def _accepted_answers(content: dict) -> list[Any]:
    answers = content.get("accepted_answers")
    if isinstance(answers, list):
        return answers
    if "expected_answer" in content:
        return [content["expected_answer"]]
    return []


def _match_common_wrong_pattern(content: dict, answer: str) -> tuple[str | None, list[str]]:
    for pattern in content.get("common_wrong_patterns", []) or []:
        raw = pattern.get("pattern") if isinstance(pattern, dict) else None
        if not raw:
            continue
        mode = pattern.get("mode", "exact")
        matched = False
        if mode == "regex":
            matched = re.search(raw, answer) is not None
        else:
            matched = normalize_ascii_key(raw) == answer
        if matched:
            diagnosed = pattern.get("diagnosis") or pattern.get("diagnosed_misconception")
            kcs = pattern.get("diagnoses_kcs") or pattern.get("kc_ids") or []
            return diagnosed, [str(kc) for kc in kcs]
    return None, []


def grade_open_response(content: dict, student_answer: Any) -> OpenGradeResult:
    answer_key = normalize_ascii_key(student_answer)
    answer_text = normalize_text(student_answer)

    if is_unknown_response(student_answer):
        return OpenGradeResult(
            is_correct=False,
            confidence=1.0,
            matched_rule="unknown_response",
            normalized_answer=answer_key,
            notes=["Student explicitly reported not knowing the answer."],
        )

    misconception, diagnosed_kcs = _match_common_wrong_pattern(content, answer_key)
    if misconception:
        return OpenGradeResult(
            is_correct=False,
            confidence=0.95,
            matched_rule="common_wrong_pattern",
            normalized_answer=answer_key,
            diagnosed_misconception=misconception,
            diagnosed_kcs=diagnosed_kcs,
        )

    answer_type = normalize_ascii_key(content.get("answer_type") or "short_text")
    accepted = _accepted_answers(content)
    tolerance = float(content.get("tolerance", 1e-9))

    if answer_type in {"integer", "decimal", "number", "numeric"}:
        got = _to_float(student_answer)
        for expected in accepted:
            exp = _to_float(expected)
            if got is not None and exp is not None and abs(got - exp) <= tolerance:
                return OpenGradeResult(True, 1.0, "numeric_equal", answer_key)

    if answer_type in {"fraction", "ratio"}:
        got = _to_fraction(student_answer)
        for expected in accepted:
            exp = _to_fraction(expected)
            if got is not None and exp is not None and got == exp:
                return OpenGradeResult(True, 1.0, "fraction_equal", answer_key)

    if answer_type in {"set", "list"}:
        got_parts = sorted(part.strip() for part in re.split(r"[,;]", answer_key) if part.strip())
        for expected in accepted:
            exp_parts = sorted(part.strip() for part in re.split(r"[,;]", normalize_ascii_key(expected)) if part.strip())
            if got_parts and got_parts == exp_parts:
                return OpenGradeResult(True, 0.98, "set_equal", answer_key)

    for expected in accepted:
        if answer_text == normalize_text(expected) or answer_key == normalize_ascii_key(expected):
            return OpenGradeResult(True, 0.98, "exact_text", answer_key)

    return OpenGradeResult(
        is_correct=False,
        confidence=0.70,
        matched_rule="no_match",
        normalized_answer=answer_key,
        notes=["No deterministic accepted-answer rule matched."],
    )


def validate_open_item_content(content: dict) -> list[str]:
    """Return validation errors for an open-ended diagnostic item."""
    errors: list[str] = []
    if not normalize_text(content.get("question")):
        errors.append("question is required")
    if not normalize_ascii_key(content.get("answer_type")):
        errors.append("answer_type is required")
    if not _accepted_answers(content):
        errors.append("accepted_answers or expected_answer is required")
    if content.get("inference_strength") == "strong" and not content.get("academic_reviewed"):
        errors.append("strong inference requires academic_reviewed=true")
    for key in ("requires_kcs", "diagnoses_kcs"):
        value = content.get(key, [])
        if value is not None and not isinstance(value, list):
            errors.append(f"{key} must be a list")
    return errors
