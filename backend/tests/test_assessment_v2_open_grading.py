from app.engines.assessment_v2.open_grading import (
    grade_open_response,
    validate_open_item_content,
)


def test_numeric_grading_accepts_decimal_comma():
    result = grade_open_response(
        {
            "question": "0,25 + 0,5 = ?",
            "answer_type": "decimal",
            "accepted_answers": ["0.75"],
        },
        "0,75",
    )

    assert result.is_correct is True
    assert result.matched_rule == "numeric_equal"
    assert result.confidence == 1.0


def test_fraction_grading_accepts_equivalent_fraction():
    result = grade_open_response(
        {
            "question": "Rut gon 2/4",
            "answer_type": "fraction",
            "accepted_answers": ["1/2"],
        },
        "3/6",
    )

    assert result.is_correct is True
    assert result.matched_rule == "fraction_equal"


def test_common_wrong_pattern_can_diagnose_kc():
    result = grade_open_response(
        {
            "question": "1/2 + 1/3 = ?",
            "answer_type": "fraction",
            "accepted_answers": ["5/6"],
            "common_wrong_patterns": [
                {
                    "pattern": "2/5",
                    "diagnosis": "adds numerators and denominators directly",
                    "diagnoses_kcs": ["kc-common-denominator"],
                }
            ],
        },
        "2/5",
    )

    assert result.is_correct is False
    assert result.matched_rule == "common_wrong_pattern"
    assert result.diagnosed_kcs == ["kc-common-denominator"]


def test_strong_inference_requires_academic_review():
    errors = validate_open_item_content(
        {
            "question": "1/2 + 1/3 = ?",
            "answer_type": "fraction",
            "accepted_answers": ["5/6"],
            "inference_strength": "strong",
            "requires_kcs": ["kc-fraction-meaning"],
        }
    )

    assert "strong inference requires academic_reviewed=true" in errors
