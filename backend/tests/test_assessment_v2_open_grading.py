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


def test_numeric_grading_accepts_null_tolerance():
    result = grade_open_response(
        {
            "question": "A cach goc O 5 don vi ve ben trai",
            "answer_type": "integer",
            "accepted_answers": ["-5"],
            "tolerance": None,
        },
        "-5",
    )

    assert result.is_correct is True
    assert result.matched_rule == "numeric_equal"


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


def test_unknown_response_is_not_correct():
    result = grade_open_response({"answer_type": "integer", "accepted_answers": ["4"]}, "em không biết")

    assert result.matched_rule == "unknown_response"
    assert result.is_correct is False


def test_power_tuple_checker_accepts_base_exponent():
    result = grade_open_response(
        {"answer_type": "power", "checker_type": "power_tuple", "accepted_answers": ["4^2"]},
        "4 ** 2",
    )

    assert result.is_correct is True
    assert result.matched_rule == "power_tuple"


def test_expression_equivalent_checker():
    result = grade_open_response(
        {"answer_type": "expression", "checker_type": "expression_equivalent", "accepted_answers": ["2*x + 6"]},
        "2*(x+3)",
    )

    assert result.is_correct is True
    assert result.matched_rule == "expression_equivalent"


def test_expression_equivalent_accepts_implicit_multiplication():
    result = grade_open_response(
        {"answer_type": "expression", "checker_type": "expression_equivalent", "accepted_answers": ["3*x - 6"]},
        "3x-6",
    )

    assert result.is_correct is True
    assert result.matched_rule == "expression_equivalent"


def test_ordered_list_preserves_order():
    content = {
        "answer_type": "ordered_list",
        "checker_type": "ordered_list_equal",
        "accepted_answers": ["-8 < -5 < 0 < 3"],
    }

    assert grade_open_response(content, "-8; -5; 0; 3").is_correct is True
    assert grade_open_response(content, "-5; -8; 0; 3").is_correct is False


def test_probability_equivalence_accepts_fraction_decimal_percent():
    content = {"answer_type": "probability", "checker_type": "probability_equal", "accepted_answers": ["1/4"]}

    assert grade_open_response(content, "0.25").is_correct is True
    assert grade_open_response(content, "25%").is_correct is True


def test_coordinate_pair_checker_accepts_parenthesized_pair():
    content = {
        "answer_type": "coordinate",
        "checker_type": "coordinate_pair_equal",
        "accepted_answers": ["(0,-4)"],
    }

    result = grade_open_response(content, "0; -4")

    assert result.is_correct is True
    assert result.matched_rule == "coordinate_pair_equal"


def test_ordered_pair_list_checker_preserves_order():
    content = {
        "answer_type": "ordered_pair_list",
        "checker_type": "ordered_pair_list_equal",
        "accepted_answers": ["(0,-4);(2,0)"],
    }

    assert grade_open_response(content, "(0,-4); (2,0)").is_correct is True
    assert grade_open_response(content, "(2,0); (0,-4)").is_correct is False
