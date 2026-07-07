from app.engines.assessment_v2.item_quality import (
    infer_surface_signature,
    validate_official_item,
    validate_official_item_bank,
)


def _valid_item(**overrides):
    item = {
        "review_id": "g8-001",
        "kc_id": "kc-linear",
        "question": "Giải phương trình 3(x - 2) + 5 = 2x.",
        "answer_widget": "number",
        "checker_type": "numeric_equal",
        "answer_type": "number",
        "accepted_answers": ["1"],
        "requires_kcs": ["kc-parentheses"],
        "diagnoses_kcs": ["kc-linear"],
        "common_wrong_patterns": [{"pattern": "-1", "diagnosis": "Sai chuyển vế"}],
        "item_role": "anchor",
        "item_family": "solve_linear_parentheses",
        "parameter_set": "3_x_minus_2_plus_5_eq_2x",
        "surface_signature": infer_surface_signature("Giải phương trình 3(x - 2) + 5 = 2x."),
        "academic_reviewed": False,
        "inference_strength": "weak",
    }
    item.update(overrides)
    return item


def test_official_item_rejects_disguised_mcq():
    result = validate_official_item(
        _valid_item(question="Trong các cách viết sau, cách viết nào đúng?", accepted_answers=["A"])
    )

    assert "mcq_disguised" in result["errors"]


def test_official_item_requires_supported_widget_checker_pair():
    result = validate_official_item(_valid_item(answer_widget="coordinate_pair", checker_type="numeric_equal"))

    assert "checker_type numeric_equal is not supported for widget coordinate_pair" in result["errors"]


def test_official_item_bank_flags_duplicate_family_parameter_set():
    first = _valid_item(review_id="g8-001")
    second = _valid_item(review_id="g8-002")

    result = validate_official_item_bank([first, second])

    assert result["summary"]["duplicate_family_params"]
    assert "duplicate item_family + parameter_set" in result["items"]["g8-001"]["errors"]
