# Grade 8 Assessment V2 Handoff Summary

## Context

Mục tiêu sản phẩm đã chuyển từ “test nhiều node nhất” sang “đào root cause theo path kiến thức thật”. Với học sinh lớp 8 lên 9, bài assessment không nên cố cover toàn bộ node Grade 6-8, mà phải bám vào mục tiêu học giai đoạn này: phân thức, phương trình, bài toán lập phương trình, hàm số bậc nhất, và các prerequisite Grade 7/6 liên quan.

Người dùng nhấn mạnh nhiều lần:

- Cover nhiều node không phải tiêu chí đúng.
- Nếu sai một node gốc mà probability vẫn còn 75%, engine không được bỏ qua.
- Nếu đã thiết kế deep-dive Grade 8 -> Grade 7 -> Grade 6 thì không hợp lý khi engine dừng vì “hết item”.
- Open-ended là hướng đúng, nhưng nếu input raw text gây typo hoặc format ambiguity thì sẽ tạo sai giả và làm hỏng diagnostic value.
- Product value không nằm ở thuật toán chung chung, mà ở graph kiến thức toán Việt Nam + grading data + remediation workflow.

## What We Built

### 1. Assessment V2 Grade 8 Official Path

Đã tạo standalone production route:

- `/assessment-v2/grade8-path`

Route này dùng:

- `assessment_scope="grade8_exam_path"`
- `max_questions=35`
- item draft từ `docs/grade8_exam_path_official_item_drafts.json`

Teacher review history:

- `/assessment-v2/history?scope=grade8_exam_path`

Mục tiêu của route này là test official Grade 8 path độc lập, không lẫn với demo và không phụ thuộc Assessment V1.

### 2. State-Space EIG Selector

Đã thay selector kiểu topology/frontier proxy bằng particle-based knowledge-state selector.

Engine hiện maintain feasible knowledge-state particles, respecting prerequisite closure:

- mastered child implies mastered ancestors.
- response update làm thay đổi distribution over possible knowledge states.
- candidate item được score bằng expected posterior entropy reduction.

Lý do làm:

Người dùng có sense đúng rằng algorithm cũ không thật sự dựa trên state học sinh được update liên tục, mà giống graph-degree heuristic. Vì vậy engine cần chọn item theo expected information gain trên knowledge state, không chỉ theo số node có thể lan.

### 3. Grade 8 Deep-Dive Policy

Đã thêm policy layer trước global EIG.

Khi học sinh sai hoặc chọn unknown ở một item lớn, engine ưu tiên:

1. `diagnoses_kcs`
2. `requires_kcs`
3. ancestors gần nhất trong graph
4. same target exam path
5. fallback về global EIG nếu không có candidate

Cho phép hỏi tối đa 2 items trong cùng KC khi cần diagnostic confirmation.

Lý do làm:

Người dùng yêu cầu engine phải đào root cause Grade 8 -> Grade 7 -> Grade 6, thay vì hỏi rộng qua nhiều KC rồi kết thúc.

### 4. Unresolved Miss Follow-Up Fix

Production session `v2-1ec389464cd7` dừng ở 20/35 câu.

Diagnosis:

- DB session có `max_questions=35`, không phải 20.
- Engine complete vì `select_next()` trả `None`.
- Grade 8 item bank có 101 items nhưng chỉ 17 unique KCs có item.
- Sau 20 câu, 81 item chưa dùng nhưng 54 item bị chặn vì duplicate `surface_signature`.
- Tất cả 17 KC có item đã được direct tested ít nhất một lần.

Người dùng chỉ ra vấn đề đúng:

Nếu engine đã được thiết kế để đào sâu root cause và confirm node nghi ngờ, thì việc dừng vì “hết candidate” là policy sai, không chỉ thiếu item.

Fix đã làm:

- Mọi first wrong/unknown trong Grade 8 path đều trigger follow-up nếu có item.
- Same-KC confirmation được ưu tiên khi node vừa miss.
- Nếu không có distinct surface item, engine được phép dùng parameterized same-surface fallback.
- Audit ghi `surface_relaxed=true` để team biết confirmation này yếu hơn.

Kết quả simulation:

- Trước fix: khoảng 24-25 câu.
- Sau fix: khoảng 32-33 câu trong weak-student scenarios.
- Node `G6-MATH-BO-DAU-NGOAC` được hỏi item thứ hai sau fail/unknown.

Commit liên quan:

- `0216d97 Improve grade 8 diagnostic follow-up`

### 5. Open-Ended Grading Fixes

Production transcript cho thấy nhiều false negative do parser/checker:

- `x(x+2)` bị chấm sai so với accepted `x*(x+2)`.
- `3x-6` bị chấm sai so với accepted `3*x-6`.
- `6%.x` bị chấm sai, dù học sinh đang biểu diễn `6% * x`.
- `(300-x).5,8%` bị chấm sai, dù có thể hiểu là `(300-x)*5.8%`.
- `0.06` bị chấm sai khi accepted answer là `3/50`.

Fix đã làm:

- Expression parser accept implicit multiplication:
  - `3x`
  - `x(x+2)`
  - `2(x+1)`
- Expression parser normalize percent notation:
  - `6%` -> `0.06`
- Decimal checker accept equivalent fraction expected answers:
  - `0.06` == `3/50`

Tests đã thêm cho các case này.

### 6. Math Input UI Mitigation

Người dùng nhấn mạnh: open-ended không có nghĩa là để học sinh type raw symbolic expression mọi lúc. Nếu học sinh phải tự gõ syntax, assessment sẽ đo typing/format chứ không đo knowledge.

Đã update Grade 8 assessment page để dùng template input cho một số expression families:

- `x + [ ]`
- `x(x + [ ])`
- `[ ]x + [ ]`
- `[ ] - x`

Covered item families:

- `factor_common_x_from_quadratic`
- `convert_one_over_x_to_common_denominator`
- `difference_of_squares_factor_missing`
- `common_denominator_x_and_x_plus_a`
- `expand_coefficient_parentheses`
- `represent_remaining_amount_total_minus_x`

Những item quá mở vẫn dùng raw input tạm thời, nhưng đã được đưa vào QA report để sửa.

Commit liên quan:

- `058e62d Reduce grade 8 input false negatives`

### 7. Item Input QA Report

Đã tạo:

- `docs/grade8_item_input_qa.md`

Report scan ra:

- Item bank size: 101
- Items with input/typo risk: 52
- Production transcript answers with likely false-wrong or confusing-input risk: multiple clear cases

Risk categories:

- `expression_raw_typo_risk`
- `coordinate_widget_required`
- `too_open_for_pilot`
- `prompt_can_invite_format_variants`
- `accepted_answer_format_sensitive`

Important examples:

- `write_interest_expression` items are too open.
- `build_interest_equation_from_context` items should not be raw expression input.
- coordinate/ordered-pair items need structured coordinate or ordered-pair-list widgets.

## Important Findings

### Item Bank Is Still the Bottleneck

Grade 8 item bank has 101 items but only 17 unique KCs with items.

Many “multiple items” are just parameter variants with the same surface.

Example:

`G6-MATH-BO-DAU-NGOAC` has 5 items:

- `Khai triển biểu thức 3(x - 2)`
- `Khai triển biểu thức 4(x - 3)`
- `Khai triển biểu thức 5(x - 1)`
- etc.

But all share the same `surface_signature`.

This means asking a second one can confirm somewhat, but it is not strong independent evidence. For academic quality, we need genuinely different diagnostic forms.

### Some Prompts Are Too Open

Examples:

- “Viết biểu thức tiền lãi của khoản x triệu với lãi suất 6% một năm.”
- “Viết phương trình theo x.”

These invite many equivalent formats. They are hard to grade deterministically and create false negatives.

Better design:

- Ask for a coefficient only.
- Ask for the missing part in a provided template.
- Split equation construction into structured substeps.
- Use equation-builder widget later.

### Student-Facing Labels Must Stay Conservative

Student UI should not overclaim inferred states.

Suggested language:

- Direct wrong: “skill to review”
- Inferred gap: “possibly affected”
- Unknown: “not enough evidence”
- Ready frontier: “recommended next skills”

Teacher review can show deeper internal evidence:

- `p_mastery`
- direct evidence
- inferred evidence
- source failed item
- selector policy
- reason for next item
- whether same-surface fallback was used

## Current Technical State

### Key Routes

- `/assessment-v2/grade8-path`
- `/assessment-v2/history?scope=grade8_exam_path`

### Key Backend Files

- `backend/app/engines/assessment_v2/diagnostic_engine.py`
- `backend/app/engines/assessment_v2/open_grading.py`
- `backend/app/services/assessment_v2_session_service.py`

### Key Frontend Files

- `frontend/src/app/assessment-v2/grade8-path/page.tsx`
- `frontend/src/app/assessment-v2/history/page.tsx`
- `frontend/src/components/wizzdom/MathWidgets.tsx`

### Key Docs/Data

- `docs/grade8_exam_path_official_item_drafts.json`
- `docs/grade8_item_input_qa.md`
- `docs/grade8_weak_student_simulation_report.json`
- `docs/grade8_exam_path_official_assessment_plan.md`

### Recent Commits

- `0216d97 Improve grade 8 diagnostic follow-up`
- `058e62d Reduce grade 8 input false negatives`

## Verification Done

Backend targeted tests:

- `34 passed`

Frontend:

- `npx tsc --noEmit` passed
- `npm run build` passed when run outside sandbox

Note:

One local build attempt failed because sandbox blocked Turbopack from creating/binding a process. Re-running with proper permissions passed.

## Remaining Considerations

### 1. Build Proper Math Widgets

Current template inputs are a short-term mitigation.

Still needed:

- expression builder
- equation builder
- rational expression widget
- ordered pair list widget
- percent/rate widget
- multi-box “fill missing part” templates driven from item metadata

Goal:

Students should enter mathematical intent, not raw syntax.

### 2. Rewrite High-Risk Items

Use `docs/grade8_item_input_qa.md` as the work queue.

Priority:

1. Replace or rewrite `too_open_for_pilot` items.
2. Add widgets/checkers for coordinate and ordered-pair-list items.
3. Convert expression items into structured templates.
4. Add distinct item surfaces for high-impact KCs.
5. Keep parameter variants only as fallback, not as primary evidence.

### 3. Improve Item Metadata

The algorithm depends heavily on metadata:

- `requires_kcs`
- `diagnoses_kcs`
- `item_role`
- `item_family`
- `surface_signature`
- `target_exam_path`
- `answer_widget`
- `checker_type`

If metadata is weak, adaptive deep-dive will be weak.

### 4. Teacher Review Needs Better Explanations

Teacher review should explain in plain language:

- Why this question was selected.
- Which previous answer triggered it.
- Whether it is a same-KC confirmation.
- Whether it is probing a prerequisite.
- Whether same-surface fallback was used.
- Whether the result is direct evidence or inferred evidence.

Suggested wording:

- “Asked because the previous answer suggested a gap in prerequisite X.”
- “Asked as a second confirmation because the first evidence was not enough.”
- “Same-surface fallback used because no distinct item was available for this KC.”

### 5. Run More Real Student Sessions Carefully

Before broader pilot:

- Run 3-5 real/near-real sessions.
- Audit every wrong answer for false negative risk.
- Check whether follow-up is academically sensible.
- Check final node states against teacher intuition.
- Do not treat current output as psychometrically validated yet.

## Product Principle To Preserve

The product should not present itself as “just an adaptive test”.

The strongest pitch is:

Wizzdom uses open-ended work + Vietnamese math knowledge graph + grading evidence to identify likely prerequisite blockers and route remediation.

The assessment is valuable only if:

- the item actually diagnoses the intended KC,
- the input format does not create false wrongs,
- the graph relationship is academically sound,
- the teacher can audit why each conclusion was made,
- the next learning action is clear.

