"""
Deterministic open-ended grading primitives for Assessment V2.

The goal is not to replace human/LLM review. This module handles the safe,
auditable cases first: exact text, numeric equality, fraction equivalence,
and known wrong patterns. Anything uncertain returns low confidence.
"""

from __future__ import annotations

import math
import operator
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


def normalize_math_key(value: Any) -> str:
    text = normalize_text(value)
    text = unicodedata.normalize("NFD", text)
    text = "".join(ch for ch in text if unicodedata.category(ch) != "Mn")
    text = re.sub(r"[^a-z0-9/.,+\-*=^(){}\\[\\];<>% ]+", "", text)
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


def _strip_wrappers(value: Any) -> str:
    text = normalize_math_key(value).replace(" ", "")
    return text.strip("{}[]()")


def _to_probability(value: Any) -> Fraction | None:
    text = normalize_math_key(value).replace(" ", "").replace(",", ".")
    if not text:
        return None
    if text.endswith("%"):
        number = _to_float(text[:-1])
        if number is None:
            return None
        return Fraction(str(number)) / 100
    return _to_fraction(text)


def _to_power_tuple(value: Any) -> tuple[Fraction, Fraction] | None:
    text = normalize_math_key(value).replace(" ", "").replace("**", "^")
    if "^" in text:
        base, exponent = text.split("^", 1)
    elif "," in _strip_wrappers(text):
        base, exponent = _strip_wrappers(text).split(",", 1)
    elif ";" in _strip_wrappers(text):
        base, exponent = _strip_wrappers(text).split(";", 1)
    else:
        return None
    base_value = _to_fraction(base)
    exponent_value = _to_fraction(exponent)
    if base_value is None or exponent_value is None:
        return None
    return base_value, exponent_value


def _to_coordinate_pair(value: Any) -> tuple[Fraction, Fraction] | None:
    text = _strip_wrappers(value).replace(" ", "")
    parts = [part for part in re.split(r"[,;]", text) if part]
    if len(parts) != 2:
        return None
    x_value = _to_fraction(parts[0])
    y_value = _to_fraction(parts[1])
    if x_value is None or y_value is None:
        return None
    return x_value, y_value


def _to_ordered_pair_list(value: Any) -> list[tuple[Fraction, Fraction]] | None:
    text = normalize_math_key(value).replace(" ", "")
    pairs = re.findall(r"\(([^()]+)\)", text)
    if not pairs:
        pairs = [part for part in text.split("|") if part]
    result: list[tuple[Fraction, Fraction]] = []
    for raw_pair in pairs:
        pair = _to_coordinate_pair(raw_pair)
        if pair is None:
            return None
        result.append(pair)
    return result or None


_OPS: dict[str, tuple[int, str, Any]] = {
    "+": (1, "left", operator.add),
    "-": (1, "left", operator.sub),
    "*": (2, "left", operator.mul),
    "/": (2, "left", operator.truediv),
    "^": (3, "right", operator.pow),
}


def _tokenize_expression(value: Any) -> list[str] | None:
    text = normalize_math_key(value).replace(" ", "").replace("**", "^")
    text = text.replace("×", "*").replace(":", "/")
    if not text:
        return None
    tokens: list[str] = []
    i = 0
    prev: str | None = None
    while i < len(text):
        ch = text[i]
        if ch.isdigit() or ch == "." or (ch in "+-" and (prev is None or prev in _OPS or prev == "(")):
            j = i + 1
            while j < len(text) and (text[j].isdigit() or text[j] == "."):
                j += 1
            if ch in "+-" and j == i + 1:
                tokens.append("0")
                tokens.append(ch)
                prev = ch
                i += 1
                continue
            tokens.append(text[i:j])
            prev = "number"
            i = j
            continue
        if ch.isalpha():
            j = i + 1
            while j < len(text) and text[j].isalpha():
                j += 1
            tokens.append(text[i:j])
            prev = "var"
            i = j
            continue
        if ch in _OPS or ch in "()":
            tokens.append(ch)
            prev = ch
            i += 1
            continue
        return None
    return tokens


def _eval_expression(value: Any, variables: dict[str, float] | None = None) -> float | None:
    tokens = _tokenize_expression(value)
    if not tokens:
        return None
    variables = variables or {}
    output: list[str] = []
    ops: list[str] = []
    for token in tokens:
        if token in _OPS:
            prec, assoc, _fn = _OPS[token]
            while ops and ops[-1] in _OPS:
                top_prec, _top_assoc, _ = _OPS[ops[-1]]
                if top_prec > prec or (top_prec == prec and assoc == "left"):
                    output.append(ops.pop())
                else:
                    break
            ops.append(token)
        elif token == "(":
            ops.append(token)
        elif token == ")":
            while ops and ops[-1] != "(":
                output.append(ops.pop())
            if not ops:
                return None
            ops.pop()
        else:
            output.append(token)
    while ops:
        if ops[-1] in {"(", ")"}:
            return None
        output.append(ops.pop())

    stack: list[float] = []
    for token in output:
        if token in _OPS:
            if len(stack) < 2:
                return None
            b = stack.pop()
            a = stack.pop()
            try:
                value = float(_OPS[token][2](a, b))
            except (ZeroDivisionError, OverflowError, ValueError):
                return None
            if not math.isfinite(value):
                return None
            stack.append(value)
        else:
            if re.fullmatch(r"[a-z]+", token):
                if token not in variables:
                    return None
                stack.append(float(variables[token]))
            else:
                try:
                    stack.append(float(token))
                except ValueError:
                    return None
    return stack[0] if len(stack) == 1 and math.isfinite(stack[0]) else None


def _expression_variables(*values: Any) -> set[str]:
    variables: set[str] = set()
    for value in values:
        tokens = _tokenize_expression(value) or []
        variables.update(token for token in tokens if re.fullmatch(r"[a-z]+", token))
    return variables


def _expressions_equivalent(got: Any, expected: Any, tolerance: float) -> bool:
    variables = _expression_variables(got, expected)
    if not variables:
        got_value = _eval_expression(got)
        exp_value = _eval_expression(expected)
        return got_value is not None and exp_value is not None and abs(got_value - exp_value) <= tolerance

    samples = [-3, -1, 0, 2, 5]
    for sample in samples:
        env = {name: sample + idx for idx, name in enumerate(sorted(variables))}
        got_value = _eval_expression(got, env)
        exp_value = _eval_expression(expected, env)
        if got_value is None or exp_value is None or abs(got_value - exp_value) > tolerance:
            return False
    return True


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
    checker_type = normalize_ascii_key(content.get("checker_type") or "").replace(" ", "")
    accepted = _accepted_answers(content)
    raw_tolerance = content.get("tolerance", 1e-9)
    tolerance = 1e-9 if raw_tolerance is None else float(raw_tolerance)
    effective_type = checker_type or answer_type

    if effective_type in {"integer", "decimal", "number", "numeric", "numericequal", "decimalequal"}:
        got = _to_float(student_answer)
        for expected in accepted:
            exp = _to_float(expected)
            if got is not None and exp is not None and abs(got - exp) <= tolerance:
                return OpenGradeResult(True, 1.0, "numeric_equal", answer_key)

    if effective_type in {"fraction", "ratio", "fractionequal"}:
        got = _to_fraction(student_answer)
        for expected in accepted:
            exp = _to_fraction(expected)
            if got is not None and exp is not None and got == exp:
                return OpenGradeResult(True, 1.0, "fraction_equal", answer_key)

    if effective_type in {"probability", "probabilityequal"}:
        got = _to_probability(student_answer)
        for expected in accepted:
            exp = _to_probability(expected)
            if got is not None and exp is not None and got == exp:
                return OpenGradeResult(True, 1.0, "probability_equal", answer_key)

    if effective_type in {"power", "powertuple"}:
        got_tuple = _to_power_tuple(student_answer)
        for expected in accepted:
            exp_tuple = _to_power_tuple(expected)
            if got_tuple is not None and exp_tuple is not None and got_tuple == exp_tuple:
                return OpenGradeResult(True, 1.0, "power_tuple", answer_key)
        got_value = _eval_expression(student_answer)
        for expected in accepted:
            exp_value = _eval_expression(expected)
            if got_value is not None and exp_value is not None and abs(got_value - exp_value) <= tolerance:
                return OpenGradeResult(True, 1.0, "power_value_equal", answer_key)

    if effective_type in {"expression", "expressionequivalent"}:
        for expected in accepted:
            if _expressions_equivalent(student_answer, expected, tolerance):
                return OpenGradeResult(True, 0.98, "expression_equivalent", answer_key)

    if effective_type in {"orderedlist", "orderedlistequal"}:
        got_parts = [part.strip() for part in re.split(r"[,;<>]", _strip_wrappers(student_answer)) if part.strip()]
        for expected in accepted:
            exp_parts = [part.strip() for part in re.split(r"[,;<>]", _strip_wrappers(expected)) if part.strip()]
            if got_parts and got_parts == exp_parts:
                return OpenGradeResult(True, 0.98, "ordered_list_equal", answer_key)

    if effective_type in {"coordinate", "coordinatepair", "coordinatepairequal"}:
        got_pair = _to_coordinate_pair(student_answer)
        for expected in accepted:
            exp_pair = _to_coordinate_pair(expected)
            if got_pair is not None and exp_pair is not None and got_pair == exp_pair:
                return OpenGradeResult(True, 1.0, "coordinate_pair_equal", answer_key)

    if effective_type in {"orderedpairlist", "orderedpairlistequal"}:
        got_pairs = _to_ordered_pair_list(student_answer)
        for expected in accepted:
            exp_pairs = _to_ordered_pair_list(expected)
            if got_pairs is not None and exp_pairs is not None and got_pairs == exp_pairs:
                return OpenGradeResult(True, 0.98, "ordered_pair_list_equal", answer_key)

    if effective_type in {"set", "list", "setequal"}:
        got_parts = sorted(part.strip() for part in re.split(r"[,;]", _strip_wrappers(student_answer)) if part.strip())
        for expected in accepted:
            exp_parts = sorted(part.strip() for part in re.split(r"[,;]", _strip_wrappers(expected)) if part.strip())
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
