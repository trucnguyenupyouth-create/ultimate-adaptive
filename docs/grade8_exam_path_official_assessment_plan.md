# Grade 8 Exam-Path Official Assessment Plan

Created: 2026-07-05  
Scope: official pilot assessment based on the Grade 8 exam path shared by the user.  
Constraint: **do not add graph nodes in this phase**. Missing concepts are handled as item metadata/workarounds, not new `knowledge_components`.

## Goal

Build an official open-ended adaptive diagnostic for a student who can do simple substitution but fails the remaining Grade 8 algebra exam path:

1. Rational expressions.
2. Linear equations.
3. Word-problem modeling with percentages.
4. Linear functions and parallel-line conditions.

The assessment should identify the root blocker and ready-to-learn path, not produce only a score.

## Runtime And Bank Size

Student runtime:

- Target: 25-35 questions.
- Stop early if a prerequisite blocker is confirmed and the rest of the path is no longer diagnostically useful.

Item bank:

- Minimum pilot bank: **90 usable reviewed items**.
- Better official bank: **120 reviewed items**.
- Do not generate only 1 item per node. The algorithm needs alternatives, confirmation items, and non-duplicate variants.

## Official Item Metadata

Every official item must include:

```json
{
  "official_assessment_scope": "grade8_exam_path",
  "target_exam_path": "rational_expression | linear_equation | word_problem_modeling | linear_function",
  "item_role": "anchor | misconception | confirmation | transfer | bridge | readiness",
  "item_family": "stable template family name",
  "surface_signature": "normalized structural signature",
  "parameter_set": "stable parameter identifier",
  "answer_widget": "number | fraction | decimal | power | expression | ordered_list | set | probability | coordinate_pair | ordered_pair_list",
  "checker_type": "numeric_equal | fraction_equal | decimal_equal | power_tuple | expression_equivalent | ordered_list_equal | set_equal | probability_equal | coordinate_pair_equal | ordered_pair_list_equal",
  "requires_kcs": ["all non-primary required KCs"],
  "diagnoses_kcs": ["KCs this item can diagnose"],
  "common_wrong_patterns": []
}
```

### Why These Fields Matter

- `item_family` prevents the bank from pretending that 5 copies of the same template are 5 independent items.
- `parameter_set` prevents exact duplicates.
- `surface_signature` catches near-duplicates even when numbers change.
- `item_role` makes sure the bank has anchor, misconception, confirmation, transfer, and bridge evidence.
- `requires_kcs` prevents hidden skills from polluting inference.

## Hard Item Rules

Reject or revise if any rule is violated:

- No yes/no questions.
- No disguised MCQ.
- No prompt where the answer is selected from a visible list.
- No long free-text accepted answer for auto-scored diagnostic.
- No item requiring unsupported widget/checker.
- No strong inference unless `academic_reviewed=true`.
- No strong inference from a question where one wrong answer could mean many unrelated gaps.
- No duplicate `item_family + parameter_set`.
- Avoid asking two items from the same `item_family` in the same student run unless it is an explicit confirmation item.

## Worklist By Path

### Path A: Rational Expression Transformation

Exam anchor: I.2 prove `B=(x-2)/x`.

Existing graph nodes to use now:

- `G8-MATH-NHAN-BIET-PHAN`
- `G8-MATH-XAC-DINH-DIEU`
- `G8-MATH-XAC-DINH-MAU`
- `G8-MATH-QUY-DONG-MAU`
- `G8-MATH-RUT-GON-PHAN`
- `G8-MATH-KIEM-TRA-HAI`
- `G8-MATH-NHAN-DANG-A`
- `G8-MATH-PHAN-TICH-DA`
- `G8-MATH-THU-GON-DA`
- `G6-MATH-TINH-CHAT-CO`
- `G6-MATH-QUY-DONG-MAU`

Do not add a new node now. For the missing "cộng/trừ phân thức" concept, tag items with:

```json
{
  "target_exam_path": "rational_expression",
  "item_family": "combine_rational_expressions_unlike_denominators",
  "flags": ["concept_missing_explicit_graph_node:cộng_trừ_phân_thức"]
}
```

Item targets:

| Role | Count | Widget/checker | Example family |
|---|---:|---|---|
| Anchor | 5 | expression / expression_equivalent | identify_denominator_domain |
| Misconception | 8 | expression or fraction | common_denominator_wrong_factor |
| Confirmation | 5 | expression | convert_fraction_to_common_denominator |
| Transfer | 6 | expression | simplify_rational_expression_after_factor |
| Bridge | 6 | expression | factor_then_cancel_rational_expression |

Target: **30 items**.

### Path B: Linear Equation Mechanics

Exam anchors: II.1a and II.1b.

Existing graph nodes to use now:

- `G8-MATH-NHAN-BIET-PHUONG`
- `G8-MATH-KIEM-TRA-GIA`
- `G8-MATH-NHAN-BIET-PHUONG-1`
- `G8-MATH-GIAI-PHUONG-TRINH`
- `G7-MATH-KHAI-NIEM-DANG`
- `G7-MATH-QUY-TAC-CHUYEN`
- `G6-MATH-BO-DAU-NGOAC`
- `G6-MATH-BO-DAU-NGOAC-1`
- `G6-MATH-QUY-DONG-MAU`
- `G6-MATH-CONG-HAI-PHAN-1`

Item targets:

| Role | Count | Widget/checker | Example family |
|---|---:|---|---|
| Anchor | 5 | number / numeric_equal | solve_ax_plus_b_eq_0 |
| Misconception | 6 | number | distribute_parentheses_sign_error |
| Confirmation | 5 | number/fraction | solve_linear_collect_like_terms |
| Transfer | 5 | fraction | solve_linear_with_numeric_denominators |
| Bridge | 4 | number/fraction | check_solution_then_solve_variant |

Target: **25 items**.

### Path C: Word-Problem Modeling

Exam anchor: II.2 savings interest.

Existing graph nodes to use now:

- `G7-MATH-VIET-BIEU-THUC`
- `G7-MATH-NHAN-BIET-BIEU`
- `G8-MATH-GIAI-PHUONG-TRINH`
- `G6-MATH-B31K2`
- `G6-MATH-TIM-GIA-TRI-1`
- `G6-MATH-TIM-MOT-SO`

Do not add a new node now. For the missing "lập phương trình từ bài toán" concept, tag items with:

```json
{
  "target_exam_path": "word_problem_modeling",
  "item_family": "model_linear_equation_from_context",
  "flags": ["concept_missing_explicit_graph_node:lập_phương_trình_bài_toán"]
}
```

Item targets:

| Role | Count | Widget/checker | Example family |
|---|---:|---|---|
| Anchor | 4 | number/decimal | percent_to_decimal |
| Misconception | 5 | expression | represent_remaining_amount_total_minus_x |
| Confirmation | 4 | expression | write_interest_expression |
| Transfer | 5 | expression/number | build_equation_from_total_interest |
| Bridge | 4 | number | solve_modeled_equation |

Target: **22 items**.

### Path D: Linear Function And Parallel Lines

Exam anchors: III.1 and III.2.

Existing graph nodes to use now:

- `G8-MATH-NHAN-BIET-HAM`
- `G8-MATH-TINH-HOAC-XAC`
- `G8-MATH-BIEU-DIEN-DIEM`
- `G8-MATH-BIEU-DIEN-DO`
- `G8-MATH-VE-DO-THI`
- `G8-MATH-XAC-DINH-QUAN`
- `G8-MATH-NHAN-BIET-HUONG`

Do not add a new node now. For the missing parameter-condition concept, tag items with:

```json
{
  "target_exam_path": "linear_function",
  "item_family": "solve_parameter_condition_for_parallel_lines",
  "flags": ["concept_missing_explicit_graph_node:tham_số_đường_thẳng"]
}
```

Item targets:

| Role | Count | Widget/checker | Example family |
|---|---:|---|---|
| Anchor | 5 | number | identify_slope_intercept |
| Confirmation | 4 | number | compute_function_value |
| Transfer | 5 | coordinate_pair | point_on_line |
| Bridge | 5 | ordered_pair_list | two_points_for_line_graph |
| Misconception | 5 | set/number | parallel_vs_coincident_parameter |

Target: **24 items**.

## Total Item Target

| Path | Target items |
|---|---:|
| Rational expression | 30 |
| Linear equation | 25 |
| Word-problem modeling | 22 |
| Linear function | 24 |
| **Total** | **101** |

This is enough for a 25-35 question adaptive run without repeats, while still small enough for academic review.

## Widget And Checker Requirements

Already supported or implemented:

- `number` + `numeric_equal`
- `decimal` + `decimal_equal` / `numeric_equal`
- `fraction` + `fraction_equal`
- `power` + `power_tuple`
- `expression` + `expression_equivalent`
- `ordered_list` + `ordered_list_equal`
- `set` + `set_equal`
- `probability` + `probability_equal`
- `coordinate_pair` + `coordinate_pair_equal`
- `ordered_pair_list` + `ordered_pair_list_equal`

Important workaround:

- Drawing a graph should not be the first official auto-scored item. Until a graph-canvas checker exists, decompose graphing into:
  - find two points;
  - identify intercepts;
  - determine whether a point lies on the line.

## Generation Process

Do not generate the whole bank in one prompt.

For each row in the worklist:

1. Generate 3-5 items for one `item_family`.
2. Force each item to include official metadata.
3. Run linter.
4. Academic review.
5. Only then mark `pilot_status=ready_for_pilot`.

AI defaults:

- `academic_reviewed=false`
- `inference_strength=weak`
- `pilot_status=not_ready`

Academic reviewer may upgrade only after checking:

- primary KC is correct;
- `requires_kcs` is complete;
- wrong patterns are meaningful;
- widget/checker can grade deterministically;
- item is not a duplicate of another family/parameter.

## Deterministic Test Plan

No AI persona until this passes.

Run simulated students:

- clean mastered;
- careless mastered;
- rational-expression gap;
- equation mechanics gap;
- fraction-equation gap;
- word-problem modeling gap;
- function/graph gap;
- parallel-condition gap;
- patchy student;
- random guesser / frequent "I don't know".

Acceptance targets:

- duplicate item count: `0`;
- no two same-family items unless one is explicit confirmation;
- max questions: `35`;
- every reported gap has a "why";
- every inferred state has a source edge/path;
- random guesser does not pass many open-ended items;
- clean mastered has no hard gap from one slip;
- path-specific clear gap recall >= `0.80`;
- strong inference only from reviewed items.

