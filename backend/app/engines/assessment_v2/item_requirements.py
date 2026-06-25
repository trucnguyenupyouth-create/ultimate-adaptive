"""
Item requirements for Grade 6 algebra open-ended diagnostics.

These helpers are product/curriculum scaffolding, not production truth. They
make the requested item inputs explicit so academic authors can prepare a safe
pilot set.
"""

from __future__ import annotations

from dataclasses import asdict, dataclass, field


@dataclass(frozen=True)
class ItemRequirement:
    topic: str
    target_count: int
    preferred_answer_types: list[str]
    must_include: list[str]
    metadata_required: list[str] = field(default_factory=list)

    def to_dict(self) -> dict:
        return asdict(self)


REQUIRED_OPEN_ITEM_METADATA = [
    "kc_id",
    "question",
    "answer_type",
    "accepted_answers",
    "difficulty_label",
    "is_diagnostic_anchor",
    "requires_kcs",
    "diagnoses_kcs",
    "inference_strength",
    "academic_reviewed",
    "common_wrong_patterns",
]


def g6_algebra_pilot_requirements() -> list[ItemRequirement]:
    """
    Target a 30-35 question scan without asking one question per node.

    Counts are authoring targets for strong diagnostic open-ended items across
    prerequisite-rich clusters. MCQ pools can remain as backup evidence.
    """
    base = REQUIRED_OPEN_ITEM_METADATA
    return [
        ItemRequirement(
            topic="number_foundations_and_divisibility",
            target_count=5,
            preferred_answer_types=["integer", "set", "short_text"],
            must_include=[
                "divisibility test",
                "factor/multiple recognition",
                "GCD/LCM bridge item",
                "prime/composite misconception item",
            ],
            metadata_required=base,
        ),
        ItemRequirement(
            topic="integers_and_order",
            target_count=4,
            preferred_answer_types=["integer", "short_text"],
            must_include=[
                "integer comparison",
                "number line/order",
                "absolute value or opposite number",
                "sign error diagnosis",
            ],
            metadata_required=base,
        ),
        ItemRequirement(
            topic="fractions_equivalence_and_operations",
            target_count=7,
            preferred_answer_types=["fraction", "integer", "short_text"],
            must_include=[
                "fraction meaning",
                "equivalent fractions",
                "common denominator",
                "add/subtract unlike denominators",
                "multiply/divide fraction bridge item",
                "simplification misconception",
            ],
            metadata_required=base,
        ),
        ItemRequirement(
            topic="decimals_percent_ratio",
            target_count=6,
            preferred_answer_types=["decimal", "fraction", "number"],
            must_include=[
                "decimal place value",
                "decimal operations",
                "percent conversion",
                "ratio interpretation",
                "proportional reasoning bridge item",
            ],
            metadata_required=base,
        ),
        ItemRequirement(
            topic="expressions_and_order_of_operations",
            target_count=5,
            preferred_answer_types=["integer", "decimal", "short_text"],
            must_include=[
                "operation order",
                "parentheses",
                "powers/exponents",
                "expression evaluation",
                "common precedence misconception",
            ],
            metadata_required=base,
        ),
        ItemRequirement(
            topic="data_statistics_probability_non_visual",
            target_count=5,
            preferred_answer_types=["integer", "decimal", "fraction", "short_text"],
            must_include=[
                "read simple table",
                "mean/median/range if in graph scope",
                "simple probability",
                "data interpretation without heavy visual dependency",
            ],
            metadata_required=base,
        ),
    ]
