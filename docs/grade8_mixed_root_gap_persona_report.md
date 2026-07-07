# Grade 8 Mixed Root-Gap Persona Simulation

## Persona Ground Truth

This simulated student has many Grade 6-7 root gaps, but not zero knowledge.

- Knows scattered basics: negative integer notation, integer opposites, simple integer addition, percent-to-decimal, reading variables, simple `total - x`, identifying slope in `y=ax+b`, simple function value.
- Partial/fragile: integer subtraction, opposite-sign multiplication/division, simple parentheses/distribution, percent-of-number, equality concept, expression value, plotting points, recognizing equations.
- Gaps: fraction equivalence/common denominator/operations, rational expressions, polynomial manipulation, equation solving, most graph construction and parameter reasoning.

## Quantitative Outcome

- Questions used: **35**
- Correct / wrong / unknown: **10 / 13 / 12**
- Tested KCs: **21**
- Foundation KCs tested: **20**
- Confirmed tested KCs with 2 direct items: **14**
- Duplicate item / surface: **0 / 0**

## Accuracy Against Persona Truth

- Truth counts: `{'mastered': 11, 'partial': 10, 'gap': 54}`
- Engine label counts: `{'inferred_gap': 47, 'tested_gap': 14, 'inferred_mastered': 7, 'tested_mastered': 4, 'unknown': 3}`
- Direct gap precision/recall: `{'tp': 11, 'fp': 3, 'fn': 43, 'precision': 0.7857, 'recall': 0.2037}`
- All gap precision/recall, including inferred: `{'tp': 52, 'fp': 9, 'fn': 2, 'precision': 0.8525, 'recall': 0.963}`
- Direct mastery precision/recall: `{'tp': 3, 'fp': 1, 'fn': 8, 'precision': 0.75, 'recall': 0.2727}`
- All mastery precision/recall, including inferred: `{'tp': 5, 'fp': 6, 'fn': 6, 'precision': 0.4545, 'recall': 0.4545}`
- Partial nodes marked gap/mastered: **5 / 5**

## Question Path

| # | KC | Truth | Role | Family | Response | Student answer | Why selected |
|---|---|---|---|---|---|---|---|
| 1 | `G8-MATH-NHAN-BIET-PHAN` | gap | anchor | identify_rational_expression_part | unknown | I don't know | state_space_eig |
| 2 | `G7-MATH-NHAN-BIET-BIEU` | mastered | prerequisite_probe | identify_variable_in_algebraic_expression | correct | x | grade8_unresolved_follow_up |
| 3 | `G6-MATH-TINH-CHAT-CO` | gap | prerequisite_probe | equivalent_fraction_missing_part | answer | wrong | grade8_root_cause |
| 4 | `G6-MATH-NHAN-BIET-PHAN-1` | gap | prerequisite_probe | recognize_valid_fraction_parts | unknown | I don't know | grade8_unresolved_follow_up |
| 5 | `G6-MATH-NHAN-BIET-DOC` | mastered | prerequisite_probe | write_negative_integer_context | correct | -5 | grade8_unresolved_follow_up |
| 6 | `G6-MATH-BO-DAU-NGOAC-1` | gap | prerequisite_probe | remove_parentheses_minus_before | unknown | I don't know | grade8_root_cause |
| 7 | `G6-MATH-NHAN-BIET-SO-1` | mastered | prerequisite_probe | opposite_negative_integer | correct | 7 | grade8_unresolved_follow_up |
| 8 | `G6-MATH-THUC-HIEN-PHEP` | partial | prerequisite_probe | divide_negative_by_positive_integer | correct | -4 | grade8_root_cause |
| 9 | `G6-MATH-NHAN-BIET-PHAN-1` | gap | prerequisite_probe | recognize_valid_fraction_parts | answer | wrong | grade8_root_cause |
| 10 | `G6-MATH-BO-DAU-NGOAC-1` | gap | prerequisite_probe | remove_parentheses_minus_before | correct | 3-a | grade8_root_cause |
| 11 | `G6-MATH-BO-NGOAC-LONG` | gap | prerequisite_probe | remove_nested_parentheses_minus_inside | unknown | I don't know | grade8_root_cause |
| 12 | `G6-MATH-BO-DAU-NGOAC` | partial | misconception | expand_coefficient_parentheses | unknown | I don't know | grade8_unresolved_follow_up |
| 13 | `G6-MATH-PHAN-SO-NGHICH` | gap | prerequisite_probe | reciprocal_positive_fraction | unknown | I don't know | grade8_root_cause |
| 14 | `G6-MATH-PHAN-SO-NGHICH` | gap | prerequisite_probe | reciprocal_negative_fraction | unknown | I don't know | grade8_unresolved_follow_up |
| 15 | `G6-MATH-SO-DOI-CUA` | gap | prerequisite_probe | opposite_positive_fraction | unknown | I don't know | grade8_root_cause |
| 16 | `G6-MATH-SO-DOI-CUA` | gap | prerequisite_probe | opposite_negative_fraction | answer | -9/7 | grade8_unresolved_follow_up |
| 17 | `G6-MATH-BO-NGOAC-LONG` | gap | prerequisite_probe | simplify_nested_parentheses_expression | unknown | I don't know | grade8_root_cause |
| 18 | `G6-MATH-AP-DUNG-DUNG-1` | gap | prerequisite_probe | order_operations_parentheses_first | unknown | I don't know | grade8_deep_dive |
| 19 | `G6-MATH-AP-DUNG-DUNG-1` | gap | prerequisite_probe | parentheses_then_multiply | answer | -3 | grade8_unresolved_follow_up |
| 20 | `G6-MATH-AP-DUNG-DUNG` | gap | prerequisite_probe | order_operations_no_parentheses | answer | 14 | grade8_deep_dive |
| 21 | `G6-MATH-AP-DUNG-DUNG` | gap | prerequisite_probe | division_before_addition | answer | 6 | grade8_unresolved_follow_up |
| 22 | `G6-MATH-TINH-CHAT-CO` | gap | prerequisite_probe | equivalent_fraction_missing_part | answer | wrong | grade8_root_cause |
| 23 | `G6-MATH-RUT-GON-VE` | gap | prerequisite_probe | simplify_fraction_by_gcd | answer | 6/9 | grade8_root_cause |
| 24 | `G6-MATH-RUT-GON-VE` | gap | prerequisite_probe | reduce_negative_fraction | answer | 3/4 | grade8_unresolved_follow_up |
| 25 | `G6-MATH-NHAN-HAI-SO-1` | mastered | prerequisite_probe | multiply_two_negative_integers | correct | 24 | grade8_root_cause |
| 26 | `G6-MATH-NHAN-HAI-SO-1` | mastered | prerequisite_probe | positive_product_same_sign | correct | 56 | grade8_root_cause |
| 27 | `G6-MATH-NHAN-HAI-SO` | partial | prerequisite_probe | multiply_opposite_sign_integers | correct | -24 | grade8_root_cause |
| 28 | `G6-MATH-NHAN-HAI-SO` | partial | prerequisite_probe | product_positive_negative_integer | answer | 45 | grade8_root_cause |
| 29 | `G6-MATH-CONG-HAI-SO` | mastered | prerequisite_probe | add_two_negative_integers | answer | 12 | grade8_root_cause |
| 30 | `G6-MATH-CONG-HAI-SO` | mastered | prerequisite_probe | context_two_decreases | correct | -10 | grade8_unresolved_follow_up |
| 31 | `G6-MATH-B31K2` | mastered | anchor | percent_to_decimal | correct | 3/50 | grade8_root_cause |
| 32 | `G7-MATH-NHAN-BIET-DON` | gap | prerequisite_probe | identify_monomial_coefficient | unknown | I don't know | grade8_root_cause |
| 33 | `G7-MATH-NHAN-BIET-DON` | gap | prerequisite_probe | monomial_degree_two_variables | answer | 6 | grade8_unresolved_follow_up |
| 34 | `G7-MATH-CONG-HAI-DA` | gap | prerequisite_probe | add_two_polynomials_g7 | unknown | I don't know | grade8_root_cause |
| 35 | `G7-MATH-CONG-HAI-DA` | gap | prerequisite_probe | sum_polynomial_with_constant_g7 | answer | 4*a^2+5 | grade8_unresolved_follow_up |

## Qualitative Judgment

The run behaves like a root-cause diagnostic rather than a Grade 8 scan: it spends most of the budget on Grade 6-7 foundations after early misses, while still preserving a few mastered scattered skills. The main risk is that broad graph inference can over-label some partial skills as gaps when the persona is fragile but not completely missing the skill. Teacher-facing output should therefore separate direct tested gaps from inferred possibly affected nodes.
