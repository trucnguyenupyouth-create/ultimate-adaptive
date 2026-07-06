# Grade 8 Official Path Item Input QA

Generated from current item draft bank and production session `v2-1ec389464cd7`.

## Executive Summary

- Item bank size: 101
- Items with input/typo risk: 52
- Production transcript answers with likely false-wrong or confusing-input risk: 5
- Immediate code mitigation: expression parser now accepts implicit multiplication and percent notation; Grade 8 UI now uses template inputs for simple expression families.
- Content requirement: items that ask students to write full expressions/equations should be split into structured sub-answers or held from pilot until a proper equation-builder widget exists.

## Production Transcript Risk Notes

### Step 2 — `g8-path-011` `G8-MATH-XAC-DINH-MAU`
- Question: Mẫu thức chung đơn giản của hai phân thức 1/x và 1/(x + 2) là gì?
- Student answer: `x(x+2)`
- Checker: `expression_equivalent` / widget `expression` / matched `no_match`
- Risk: likely_checker_or_input_format_false_wrong
- Note: `x(x+2)` should be accepted as `x*(x+2)`; parser mitigation added.

### Step 6 — `g8-path-063` `G6-MATH-TIM-GIA-TRI-1`
- Question: Viết biểu thức tiền lãi của khoản x triệu với lãi suất 6% một năm.
- Student answer: `6%.x`
- Checker: `expression_equivalent` / widget `expression` / matched `no_match`
- Risk: likely_checker_or_input_format_false_wrong, prompt_too_open
- Note: percent-expression prompts invite many equivalent formats; replace with coefficient/template widget before pilot.

### Step 7 — `g8-path-064` `G6-MATH-TIM-GIA-TRI-1`
- Question: Viết biểu thức tiền lãi của khoản 300-x triệu với lãi suất 5.8% một năm.
- Student answer: `(300-x).5,8%`
- Checker: `expression_equivalent` / widget `expression` / matched `no_match`
- Risk: likely_checker_or_input_format_false_wrong, prompt_too_open
- Note: percent-expression prompts invite many equivalent formats; replace with coefficient/template widget before pilot.

### Step 8 — `g8-path-056` `G6-MATH-B31K2`
- Question: Viết 6% dưới dạng số thập phân.
- Student answer: `0.06`
- Checker: `decimal_equal` / widget `decimal` / matched `no_match`
- Risk: likely_checker_or_input_format_false_wrong
- Note: `0.06` should be accepted for expected `3/50`; decimal checker mitigation added.

### Step 14 — `g8-path-036` `G6-MATH-BO-DAU-NGOAC`
- Question: Khai triển biểu thức 3(x - 2).
- Student answer: `3x-6`
- Checker: `expression_equivalent` / widget `expression` / matched `no_match`
- Risk: likely_checker_or_input_format_false_wrong

## Item Bank Risk List

### `g8-path-006` — `G8-MATH-PHAN-TICH-DA`
- Family: `factor_common_x_from_quadratic`
- Checker/widget: `expression_equivalent` / `expression`
- Question: Điền biểu thức còn thiếu: x^2 + 2x = x · ____.
- Accepted: `x+2`
- Tags: covered_by_template_widget
- Recommended action: covered by current structured/template widget; still needs academic review for wording.

### `g8-path-007` — `G8-MATH-PHAN-TICH-DA`
- Family: `factor_common_x_from_quadratic`
- Checker/widget: `expression_equivalent` / `expression`
- Question: Điền biểu thức còn thiếu: x^2 + 3x = x · ____.
- Accepted: `x+3`
- Tags: covered_by_template_widget
- Recommended action: covered by current structured/template widget; still needs academic review for wording.

### `g8-path-008` — `G8-MATH-PHAN-TICH-DA`
- Family: `factor_common_x_from_quadratic`
- Checker/widget: `expression_equivalent` / `expression`
- Question: Điền biểu thức còn thiếu: x^2 + 4x = x · ____.
- Accepted: `x+4`
- Tags: covered_by_template_widget
- Recommended action: covered by current structured/template widget; still needs academic review for wording.

### `g8-path-009` — `G8-MATH-PHAN-TICH-DA`
- Family: `factor_common_x_from_quadratic`
- Checker/widget: `expression_equivalent` / `expression`
- Question: Điền biểu thức còn thiếu: x^2 + 5x = x · ____.
- Accepted: `x+5`
- Tags: covered_by_template_widget
- Recommended action: covered by current structured/template widget; still needs academic review for wording.

### `g8-path-010` — `G8-MATH-PHAN-TICH-DA`
- Family: `factor_common_x_from_quadratic`
- Checker/widget: `expression_equivalent` / `expression`
- Question: Điền biểu thức còn thiếu: x^2 + 6x = x · ____.
- Accepted: `x+6`
- Tags: covered_by_template_widget
- Recommended action: covered by current structured/template widget; still needs academic review for wording.

### `g8-path-011` — `G8-MATH-XAC-DINH-MAU`
- Family: `common_denominator_x_and_x_plus_a`
- Checker/widget: `expression_equivalent` / `expression`
- Question: Mẫu thức chung đơn giản của hai phân thức 1/x và 1/(x + 2) là gì?
- Accepted: `x*(x+2)`
- Tags: covered_by_template_widget
- Recommended action: covered by current structured/template widget; still needs academic review for wording.

### `g8-path-012` — `G8-MATH-XAC-DINH-MAU`
- Family: `common_denominator_x_and_x_plus_a`
- Checker/widget: `expression_equivalent` / `expression`
- Question: Mẫu thức chung đơn giản của hai phân thức 1/x và 1/(x + 3) là gì?
- Accepted: `x*(x+3)`
- Tags: covered_by_template_widget
- Recommended action: covered by current structured/template widget; still needs academic review for wording.

### `g8-path-013` — `G8-MATH-XAC-DINH-MAU`
- Family: `common_denominator_x_and_x_plus_a`
- Checker/widget: `expression_equivalent` / `expression`
- Question: Mẫu thức chung đơn giản của hai phân thức 1/x và 1/(x + 4) là gì?
- Accepted: `x*(x+4)`
- Tags: covered_by_template_widget
- Recommended action: covered by current structured/template widget; still needs academic review for wording.

### `g8-path-014` — `G8-MATH-XAC-DINH-MAU`
- Family: `common_denominator_x_and_x_plus_a`
- Checker/widget: `expression_equivalent` / `expression`
- Question: Mẫu thức chung đơn giản của hai phân thức 1/x và 1/(x + 5) là gì?
- Accepted: `x*(x+5)`
- Tags: covered_by_template_widget
- Recommended action: covered by current structured/template widget; still needs academic review for wording.

### `g8-path-015` — `G8-MATH-XAC-DINH-MAU`
- Family: `common_denominator_x_and_x_plus_a`
- Checker/widget: `expression_equivalent` / `expression`
- Question: Mẫu thức chung đơn giản của hai phân thức 1/x và 1/(x + 6) là gì?
- Accepted: `x*(x+6)`
- Tags: covered_by_template_widget
- Recommended action: covered by current structured/template widget; still needs academic review for wording.

### `g8-path-016` — `G8-MATH-QUY-DONG-MAU`
- Family: `convert_one_over_x_to_common_denominator`
- Checker/widget: `expression_equivalent` / `expression`
- Question: Khi quy đồng 1/x về mẫu x(x + 2), tử thức mới là gì?
- Accepted: `x+2`
- Tags: covered_by_template_widget
- Recommended action: covered by current structured/template widget; still needs academic review for wording.

### `g8-path-017` — `G8-MATH-QUY-DONG-MAU`
- Family: `convert_one_over_x_to_common_denominator`
- Checker/widget: `expression_equivalent` / `expression`
- Question: Khi quy đồng 1/x về mẫu x(x + 3), tử thức mới là gì?
- Accepted: `x+3`
- Tags: covered_by_template_widget
- Recommended action: covered by current structured/template widget; still needs academic review for wording.

### `g8-path-018` — `G8-MATH-QUY-DONG-MAU`
- Family: `convert_one_over_x_to_common_denominator`
- Checker/widget: `expression_equivalent` / `expression`
- Question: Khi quy đồng 1/x về mẫu x(x + 4), tử thức mới là gì?
- Accepted: `x+4`
- Tags: covered_by_template_widget
- Recommended action: covered by current structured/template widget; still needs academic review for wording.

### `g8-path-019` — `G8-MATH-QUY-DONG-MAU`
- Family: `convert_one_over_x_to_common_denominator`
- Checker/widget: `expression_equivalent` / `expression`
- Question: Khi quy đồng 1/x về mẫu x(x + 5), tử thức mới là gì?
- Accepted: `x+5`
- Tags: covered_by_template_widget
- Recommended action: covered by current structured/template widget; still needs academic review for wording.

### `g8-path-020` — `G8-MATH-QUY-DONG-MAU`
- Family: `convert_one_over_x_to_common_denominator`
- Checker/widget: `expression_equivalent` / `expression`
- Question: Khi quy đồng 1/x về mẫu x(x + 6), tử thức mới là gì?
- Accepted: `x+6`
- Tags: covered_by_template_widget
- Recommended action: covered by current structured/template widget; still needs academic review for wording.

### `g8-path-021` — `G8-MATH-NHAN-DANG-A`
- Family: `difference_of_squares_factor_missing`
- Checker/widget: `expression_equivalent` / `expression`
- Question: Điền nhân tử còn thiếu: x^2 - 4 = (x - 2)(____).
- Accepted: `x+2`
- Tags: covered_by_template_widget
- Recommended action: covered by current structured/template widget; still needs academic review for wording.

### `g8-path-022` — `G8-MATH-NHAN-DANG-A`
- Family: `difference_of_squares_factor_missing`
- Checker/widget: `expression_equivalent` / `expression`
- Question: Điền nhân tử còn thiếu: x^2 - 9 = (x - 3)(____).
- Accepted: `x+3`
- Tags: covered_by_template_widget
- Recommended action: covered by current structured/template widget; still needs academic review for wording.

### `g8-path-023` — `G8-MATH-NHAN-DANG-A`
- Family: `difference_of_squares_factor_missing`
- Checker/widget: `expression_equivalent` / `expression`
- Question: Điền nhân tử còn thiếu: x^2 - 16 = (x - 4)(____).
- Accepted: `x+4`
- Tags: covered_by_template_widget
- Recommended action: covered by current structured/template widget; still needs academic review for wording.

### `g8-path-024` — `G8-MATH-NHAN-DANG-A`
- Family: `difference_of_squares_factor_missing`
- Checker/widget: `expression_equivalent` / `expression`
- Question: Điền nhân tử còn thiếu: x^2 - 25 = (x - 5)(____).
- Accepted: `x+5`
- Tags: covered_by_template_widget
- Recommended action: covered by current structured/template widget; still needs academic review for wording.

### `g8-path-025` — `G8-MATH-NHAN-DANG-A`
- Family: `difference_of_squares_factor_missing`
- Checker/widget: `expression_equivalent` / `expression`
- Question: Điền nhân tử còn thiếu: x^2 - 36 = (x - 6)(____).
- Accepted: `x+6`
- Tags: covered_by_template_widget
- Recommended action: covered by current structured/template widget; still needs academic review for wording.

### `g8-path-026` — `G8-MATH-RUT-GON-PHAN`
- Family: `simplify_cancel_common_factor`
- Checker/widget: `expression_equivalent` / `expression`
- Question: Rút gọn phân thức (x^2 - 4)/[x(x + 2)].
- Accepted: `(x-2)/x`
- Tags: expression_raw_typo_risk
- Recommended action: replace with structured widget or rewrite as numeric sub-answer

### `g8-path-027` — `G8-MATH-RUT-GON-PHAN`
- Family: `simplify_cancel_common_factor`
- Checker/widget: `expression_equivalent` / `expression`
- Question: Rút gọn phân thức (x^2 - 9)/[x(x + 3)].
- Accepted: `(x-3)/x`
- Tags: expression_raw_typo_risk
- Recommended action: replace with structured widget or rewrite as numeric sub-answer

### `g8-path-028` — `G8-MATH-RUT-GON-PHAN`
- Family: `simplify_cancel_common_factor`
- Checker/widget: `expression_equivalent` / `expression`
- Question: Rút gọn phân thức (x^2 - 16)/[x(x + 4)].
- Accepted: `(x-4)/x`
- Tags: expression_raw_typo_risk
- Recommended action: replace with structured widget or rewrite as numeric sub-answer

### `g8-path-029` — `G8-MATH-RUT-GON-PHAN`
- Family: `simplify_cancel_common_factor`
- Checker/widget: `expression_equivalent` / `expression`
- Question: Rút gọn phân thức (x^2 - 25)/[x(x + 5)].
- Accepted: `(x-5)/x`
- Tags: expression_raw_typo_risk
- Recommended action: replace with structured widget or rewrite as numeric sub-answer

### `g8-path-030` — `G8-MATH-RUT-GON-PHAN`
- Family: `simplify_cancel_common_factor`
- Checker/widget: `expression_equivalent` / `expression`
- Question: Rút gọn phân thức (x^2 - 36)/[x(x + 6)].
- Accepted: `(x-6)/x`
- Tags: expression_raw_typo_risk
- Recommended action: replace with structured widget or rewrite as numeric sub-answer

### `g8-path-036` — `G6-MATH-BO-DAU-NGOAC`
- Family: `expand_coefficient_parentheses`
- Checker/widget: `expression_equivalent` / `expression`
- Question: Khai triển biểu thức 3(x - 2).
- Accepted: `3*x-6`
- Tags: covered_by_template_widget
- Recommended action: covered by current structured/template widget; still needs academic review for wording.

### `g8-path-037` — `G6-MATH-BO-DAU-NGOAC`
- Family: `expand_coefficient_parentheses`
- Checker/widget: `expression_equivalent` / `expression`
- Question: Khai triển biểu thức 4(x - 3).
- Accepted: `4*x-12`
- Tags: covered_by_template_widget
- Recommended action: covered by current structured/template widget; still needs academic review for wording.

### `g8-path-038` — `G6-MATH-BO-DAU-NGOAC`
- Family: `expand_coefficient_parentheses`
- Checker/widget: `expression_equivalent` / `expression`
- Question: Khai triển biểu thức 5(x - 1).
- Accepted: `5*x-5`
- Tags: covered_by_template_widget
- Recommended action: covered by current structured/template widget; still needs academic review for wording.

### `g8-path-039` — `G6-MATH-BO-DAU-NGOAC`
- Family: `expand_coefficient_parentheses`
- Checker/widget: `expression_equivalent` / `expression`
- Question: Khai triển biểu thức 2(x - 7).
- Accepted: `2*x-14`
- Tags: covered_by_template_widget
- Recommended action: covered by current structured/template widget; still needs academic review for wording.

### `g8-path-040` — `G6-MATH-BO-DAU-NGOAC`
- Family: `expand_coefficient_parentheses`
- Checker/widget: `expression_equivalent` / `expression`
- Question: Khai triển biểu thức 6(x - 4).
- Accepted: `6*x-24`
- Tags: covered_by_template_widget
- Recommended action: covered by current structured/template widget; still needs academic review for wording.

### `g8-path-059` — `G7-MATH-VIET-BIEU-THUC`
- Family: `represent_remaining_amount_total_minus_x`
- Checker/widget: `expression_equivalent` / `expression`
- Question: Một tổng tiền 300 triệu được chia làm hai phần. Nếu phần thứ nhất là x triệu, phần thứ hai là bao nhiêu triệu?
- Accepted: `300-x`
- Tags: covered_by_template_widget
- Recommended action: covered by current structured/template widget; still needs academic review for wording.

### `g8-path-060` — `G7-MATH-VIET-BIEU-THUC`
- Family: `represent_remaining_amount_total_minus_x`
- Checker/widget: `expression_equivalent` / `expression`
- Question: Một tổng tiền 250 triệu được chia làm hai phần. Nếu phần thứ nhất là x triệu, phần thứ hai là bao nhiêu triệu?
- Accepted: `250-x`
- Tags: covered_by_template_widget
- Recommended action: covered by current structured/template widget; still needs academic review for wording.

### `g8-path-061` — `G7-MATH-VIET-BIEU-THUC`
- Family: `represent_remaining_amount_total_minus_x`
- Checker/widget: `expression_equivalent` / `expression`
- Question: Một tổng tiền 180 triệu được chia làm hai phần. Nếu phần thứ nhất là x triệu, phần thứ hai là bao nhiêu triệu?
- Accepted: `180-x`
- Tags: covered_by_template_widget
- Recommended action: covered by current structured/template widget; still needs academic review for wording.

### `g8-path-062` — `G7-MATH-VIET-BIEU-THUC`
- Family: `represent_remaining_amount_total_minus_x`
- Checker/widget: `expression_equivalent` / `expression`
- Question: Một tổng tiền 420 triệu được chia làm hai phần. Nếu phần thứ nhất là x triệu, phần thứ hai là bao nhiêu triệu?
- Accepted: `420-x`
- Tags: covered_by_template_widget
- Recommended action: covered by current structured/template widget; still needs academic review for wording.

### `g8-path-063` — `G6-MATH-TIM-GIA-TRI-1`
- Family: `write_interest_expression`
- Checker/widget: `expression_equivalent` / `expression`
- Question: Viết biểu thức tiền lãi của khoản x triệu với lãi suất 6% một năm.
- Accepted: `0.06*x`
- Tags: expression_raw_typo_risk, too_open_for_pilot, prompt_can_invite_format_variants
- Recommended action: replace with structured widget or rewrite as numeric sub-answer, split into numeric coefficient / equation-builder steps

### `g8-path-064` — `G6-MATH-TIM-GIA-TRI-1`
- Family: `write_interest_expression`
- Checker/widget: `expression_equivalent` / `expression`
- Question: Viết biểu thức tiền lãi của khoản 300-x triệu với lãi suất 5.8% một năm.
- Accepted: `0.057999999999999996*(300-x)`
- Tags: expression_raw_typo_risk, too_open_for_pilot, prompt_can_invite_format_variants
- Recommended action: replace with structured widget or rewrite as numeric sub-answer, split into numeric coefficient / equation-builder steps

### `g8-path-065` — `G6-MATH-TIM-GIA-TRI-1`
- Family: `write_interest_expression`
- Checker/widget: `expression_equivalent` / `expression`
- Question: Viết biểu thức tiền lãi của khoản x triệu với lãi suất 7% một năm.
- Accepted: `0.07*x`
- Tags: expression_raw_typo_risk, too_open_for_pilot, prompt_can_invite_format_variants
- Recommended action: replace with structured widget or rewrite as numeric sub-answer, split into numeric coefficient / equation-builder steps

### `g8-path-066` — `G6-MATH-TIM-GIA-TRI-1`
- Family: `write_interest_expression`
- Checker/widget: `expression_equivalent` / `expression`
- Question: Viết biểu thức tiền lãi của khoản 250-x triệu với lãi suất 4.5% một năm.
- Accepted: `0.045*(250-x)`
- Tags: expression_raw_typo_risk, too_open_for_pilot, prompt_can_invite_format_variants
- Recommended action: replace with structured widget or rewrite as numeric sub-answer, split into numeric coefficient / equation-builder steps

### `g8-path-067` — `G7-MATH-VIET-BIEU-THUC`
- Family: `build_interest_equation_from_context`
- Checker/widget: `expression_equivalent` / `expression`
- Question: Tổng 300 triệu chia vào hai khoản. Khoản A là x triệu lãi 6%, khoản B là phần còn lại lãi 5.8%. Tổng lãi là 17.72 triệu. Viết phương trình theo x.
- Accepted: `0.06*x+0.057999999999999996*(300-x)`
- Tags: expression_raw_typo_risk, too_open_for_pilot, prompt_can_invite_format_variants
- Recommended action: replace with structured widget or rewrite as numeric sub-answer, split into numeric coefficient / equation-builder steps

### `g8-path-068` — `G7-MATH-VIET-BIEU-THUC`
- Family: `build_interest_equation_from_context`
- Checker/widget: `expression_equivalent` / `expression`
- Question: Tổng 250 triệu chia vào hai khoản. Khoản A là x triệu lãi 7%, khoản B là phần còn lại lãi 5%. Tổng lãi là 16 triệu. Viết phương trình theo x.
- Accepted: `0.07*x+0.05*(250-x)`
- Tags: expression_raw_typo_risk, too_open_for_pilot, prompt_can_invite_format_variants
- Recommended action: replace with structured widget or rewrite as numeric sub-answer, split into numeric coefficient / equation-builder steps

### `g8-path-069` — `G7-MATH-VIET-BIEU-THUC`
- Family: `build_interest_equation_from_context`
- Checker/widget: `expression_equivalent` / `expression`
- Question: Tổng 200 triệu chia vào hai khoản. Khoản A là x triệu lãi 8%, khoản B là phần còn lại lãi 6%. Tổng lãi là 14 triệu. Viết phương trình theo x.
- Accepted: `0.08*x+0.06*(200-x)`
- Tags: expression_raw_typo_risk, too_open_for_pilot, prompt_can_invite_format_variants
- Recommended action: replace with structured widget or rewrite as numeric sub-answer, split into numeric coefficient / equation-builder steps

### `g8-path-070` — `G7-MATH-VIET-BIEU-THUC`
- Family: `build_interest_equation_from_context`
- Checker/widget: `expression_equivalent` / `expression`
- Question: Tổng 400 triệu chia vào hai khoản. Khoản A là x triệu lãi 6.5%, khoản B là phần còn lại lãi 5%. Tổng lãi là 23 triệu. Viết phương trình theo x.
- Accepted: `0.065*x+0.05*(400-x)`
- Tags: expression_raw_typo_risk, too_open_for_pilot, prompt_can_invite_format_variants
- Recommended action: replace with structured widget or rewrite as numeric sub-answer, split into numeric coefficient / equation-builder steps

### `g8-path-087` — `G8-MATH-BIEU-DIEN-DIEM`
- Family: `point_on_line_from_x_value`
- Checker/widget: `coordinate_pair_equal` / `coordinate_pair`
- Question: Trên đồ thị y = 2x - 4, điểm ứng với x = 0 có tọa độ là gì?
- Accepted: `(0,-4)`
- Tags: coordinate_widget_required
- Recommended action: covered by current structured/template widget; still needs academic review for wording.

### `g8-path-088` — `G8-MATH-BIEU-DIEN-DIEM`
- Family: `point_on_line_from_x_value`
- Checker/widget: `coordinate_pair_equal` / `coordinate_pair`
- Question: Trên đồ thị y = 2x - 4, điểm ứng với x = 2 có tọa độ là gì?
- Accepted: `(2,0)`
- Tags: coordinate_widget_required
- Recommended action: covered by current structured/template widget; still needs academic review for wording.

### `g8-path-089` — `G8-MATH-BIEU-DIEN-DIEM`
- Family: `point_on_line_from_x_value`
- Checker/widget: `coordinate_pair_equal` / `coordinate_pair`
- Question: Trên đồ thị y = 3x + 1, điểm ứng với x = 1 có tọa độ là gì?
- Accepted: `(1,4)`
- Tags: coordinate_widget_required
- Recommended action: covered by current structured/template widget; still needs academic review for wording.

### `g8-path-090` — `G8-MATH-BIEU-DIEN-DIEM`
- Family: `point_on_line_from_x_value`
- Checker/widget: `coordinate_pair_equal` / `coordinate_pair`
- Question: Trên đồ thị y = -2x + 5, điểm ứng với x = 2 có tọa độ là gì?
- Accepted: `(2,1)`
- Tags: coordinate_widget_required
- Recommended action: covered by current structured/template widget; still needs academic review for wording.

### `g8-path-091` — `G8-MATH-BIEU-DIEN-DIEM`
- Family: `point_on_line_from_x_value`
- Checker/widget: `coordinate_pair_equal` / `coordinate_pair`
- Question: Trên đồ thị y = 4x - 3, điểm ứng với x = 0 có tọa độ là gì?
- Accepted: `(0,-3)`
- Tags: coordinate_widget_required
- Recommended action: covered by current structured/template widget; still needs academic review for wording.

### `g8-path-092` — `G8-MATH-VE-DO-THI`
- Family: `two_points_for_line_graph`
- Checker/widget: `ordered_pair_list_equal` / `ordered_pair_list`
- Question: Cho hàm số y = 2x - 4. Viết hai điểm thuộc đồ thị theo thứ tự khi x = 0 rồi x = 1.
- Accepted: `(0,-4);(1,-2)`
- Tags: coordinate_widget_required
- Recommended action: needs ordered pair list widget, not raw text

### `g8-path-093` — `G8-MATH-VE-DO-THI`
- Family: `two_points_for_line_graph`
- Checker/widget: `ordered_pair_list_equal` / `ordered_pair_list`
- Question: Cho hàm số y = 3x + 1. Viết hai điểm thuộc đồ thị theo thứ tự khi x = 0 rồi x = 1.
- Accepted: `(0,1);(1,4)`
- Tags: coordinate_widget_required
- Recommended action: needs ordered pair list widget, not raw text

### `g8-path-094` — `G8-MATH-VE-DO-THI`
- Family: `two_points_for_line_graph`
- Checker/widget: `ordered_pair_list_equal` / `ordered_pair_list`
- Question: Cho hàm số y = -2x + 5. Viết hai điểm thuộc đồ thị theo thứ tự khi x = 0 rồi x = 1.
- Accepted: `(0,5);(1,3)`
- Tags: coordinate_widget_required
- Recommended action: needs ordered pair list widget, not raw text

### `g8-path-095` — `G8-MATH-VE-DO-THI`
- Family: `two_points_for_line_graph`
- Checker/widget: `ordered_pair_list_equal` / `ordered_pair_list`
- Question: Cho hàm số y = 4x - 3. Viết hai điểm thuộc đồ thị theo thứ tự khi x = 0 rồi x = 1.
- Accepted: `(0,-3);(1,1)`
- Tags: coordinate_widget_required
- Recommended action: needs ordered pair list widget, not raw text

### `g8-path-096` — `G8-MATH-VE-DO-THI`
- Family: `two_points_for_line_graph`
- Checker/widget: `ordered_pair_list_equal` / `ordered_pair_list`
- Question: Cho hàm số y = 1x - 6. Viết hai điểm thuộc đồ thị theo thứ tự khi x = 0 rồi x = 1.
- Accepted: `(0,-6);(1,-5)`
- Tags: coordinate_widget_required
- Recommended action: needs ordered pair list widget, not raw text
