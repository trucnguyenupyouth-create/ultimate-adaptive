# Assessment V2 Item Generation Guide

Audience: academic team, AI/content operators, and engineers who are new to Wizzdom.

Purpose: explain how to generate high-quality diagnostic items for knowledge graph nodes, especially open-ended adaptive assessment items that can support root-cause diagnosis.

This guide is intentionally detailed. A bad item can make the adaptive algorithm confidently wrong. The goal is not to “make many questions”; the goal is to create reliable measurement evidence for each knowledge component.

---

## 0. Core Philosophy

Wizzdom Assessment V2 is not a normal quiz.

A normal quiz asks:

> Did the student get this question right?

Wizzdom asks:

> What knowledge state best explains the student's answer, and what prerequisite blocker should we remediate next?

Therefore each item must do more than have a correct answer. It must:

- measure a specific knowledge component (KC),
- avoid hidden skills unless explicitly listed,
- support deterministic grading,
- reduce guessing,
- work with a math input widget,
- provide useful evidence for graph inference,
- be explainable to a teacher.

If an item is confusing, over-broad, or impossible to grade reliably, it will poison the assessment result.

---

## 1. Vocabulary

### Knowledge Component (KC)

A KC is a node in the knowledge graph.

Each KC usually has:

- `id`: database UUID.
- `code`: stable human-readable code, e.g. `G8-MATH-GIAI-PHUONG-TRINH`.
- `name`: short title.
- `description`: fuller explanation of the skill, when available.
- `grade`: curriculum grade.
- prerequisite edges to other KCs.

An item must target one primary KC.

### Prerequisite Edge

An edge `A -> B` means KC A is a prerequisite for KC B.

For assessment:

- If a student masters B, they probably know A.
- If a student has a gap in A, B may be affected.

But this inference only works when item metadata is correct.

### Item

An item is one diagnostic question.

An item is not just text. It includes:

- question stem,
- accepted answers,
- widget/checker,
- item role,
- surface signature,
- prerequisite metadata,
- misconception metadata,
- review state.

### Item Family

`item_family` is a stable template category.

Example:

```text
expand_coefficient_parentheses
```

The following are the same family:

- `Khai triển 3(x - 2)`
- `Khai triển 4(x - 3)`
- `Khai triển 5(x - 1)`

They are parameter variants, not independent item surfaces.

### Surface Signature

`surface_signature` is the normalized structure of the item.

It prevents us from pretending that several number-swapped items are different diagnostic evidence.

Bad:

```text
3(x - 2)
4(x - 3)
5(x - 1)
```

These are all the same surface.

Better surface diversity:

1. Expand `3(x - 2)`.
2. Fill missing term: `3(x - 2) = 3x + ___`.
3. Identify/correct first wrong step: `3(x - 2) = 3x - 2`.
4. Apply distribution inside an equation.

### Widget

The input interface the student uses.

Examples:

- number input,
- fraction boxes,
- coordinate pair boxes,
- expression template,
- equation builder.

Important principle:

> Open-ended does not mean raw text.

If the student has to type symbolic syntax manually, the assessment may measure typing/formatting rather than math.

### Checker

The deterministic grading method.

Examples:

- `numeric_equal`
- `fraction_equal`
- `decimal_equal`
- `expression_equivalent`
- `coordinate_pair_equal`

If no reliable checker exists, either build a widget/checker first or do not use the item in auto-scored assessment.

---

## 2. The Item Authoring Workflow

Every item should go through this pipeline.

```text
1. Select assessment scope
2. Select target KC
3. Read KC title + description + graph context
4. Decide item role
5. Design the mathematical task
6. Design the input widget
7. Choose checker
8. Fill metadata
9. Generate 2-3 surface-diverse variants
10. Review hidden prerequisites
11. Run deterministic QA
12. Academic review
13. Only then allow pilot use
```

Never skip steps 3, 6, 8, or 10.

---

## 3. Step 1 — Select Assessment Scope

Before writing any item, define the assessment goal.

Bad goal:

```text
Generate questions for all Grade 8 algebra nodes.
```

Good goal:

```text
Grade 8 official exam path: diagnose blockers for rational expressions, linear equations, word-problem modeling, and linear functions for students entering Grade 9.
```

Assessment scope determines:

- which KCs are eligible,
- which prerequisite grades are included,
- what `target_exam_path` values exist,
- how many items are needed,
- what depth of diagnosis matters.

Example Grade 8 paths:

- `rational_expression`
- `linear_equation`
- `word_problem_modeling`
- `linear_function`

---

## 4. Step 2 — Select Target KC

Each item has exactly one primary KC.

The primary KC is the skill the item is meant to measure most directly.

Bad:

```text
This item tests equations and percentages and word problems and algebraic expression.
```

Good:

```text
Primary KC: G7-MATH-VIET-BIEU-THUC
The item asks the student to represent the remaining amount as 300 - x.
```

The item may require other KCs, but those must be listed in `requires_kcs`.

---

## 5. Step 3 — Read The Node Properly

Do not rely only on the KC code.

You must read:

1. KC code.
2. KC title/name.
3. KC description.
4. Grade.
5. Incoming prerequisite edges.
6. Outgoing dependent edges.
7. Neighbor nodes in the same path.
8. Relevant textbook/source context if the title is ambiguous.

### How To Interpret Code

Example:

```text
G8-MATH-GIAI-PHUONG-TRINH
```

Likely meaning:

- Grade 8.
- Math.
- Solve first-degree equation.

But code alone is not enough.

You still need the node name:

```text
Giải phương trình bậc nhất một ẩn dạng ax+b=0
```

This means item should measure solving linear equations, not general equation modeling, not rational equations, not graphing.

### How To Use Description

If description says:

```text
Xác định mẫu thức chung và nhân tử phụ
```

Do not write an item that requires full rational expression simplification unless the primary KC is simplification. For this node, a better item asks for:

- common denominator,
- missing numerator multiplier,
- auxiliary factor.

### How To Use Graph Edges

Suppose graph has:

```text
G6-MATH-BO-DAU-NGOAC -> G8-MATH-GIAI-PHUONG-TRINH
```

This means when writing a Grade 8 equation item involving parentheses, you must list `G6-MATH-BO-DAU-NGOAC` in `requires_kcs` if expanding parentheses is necessary.

If the student fails the Grade 8 equation item, the drill-down algorithm may ask a Grade 6 expansion item to find the root cause.

### Common Mistake

Writing an item for a node based only on a broad title.

Example:

Node:

```text
G8-MATH-XAC-DINH-DIEU
Xác định điều kiện xác định của phân thức
```

Bad item:

```text
Rút gọn phân thức (x^2 - 4)/(x + 2).
```

This tests factoring and simplification, not just domain condition.

Better item:

```text
Với phân thức 5/(x + 2), giá trị nào của x làm phân thức không xác định?
```

---

## 6. Step 4 — Decide Item Role

Each KC should have multiple item roles.

### Anchor

Basic direct evidence for the KC.

Example:

```text
Với phân thức 5/(x + 2), giá trị nào của x làm phân thức không xác định?
```

Use when:

- establishing baseline,
- confirming the student can perform the core skill.

### Misconception

Targets a common wrong idea.

Example:

```text
Khai triển biểu thức 3(x - 2).
```

Common wrong answer:

```text
3x - 2
```

Diagnosis:

Student distributed 3 to `x` but not to `-2`.

### Prerequisite Probe

Tests a prerequisite root skill after a higher-level item fails.

Example:

Grade 8 equation fails:

```text
3(x - 2) + 5 = 2x
```

Prerequisite probe:

```text
3(x - 2) = [ ]x + [ ]
```

### Bridge

Connects prerequisite to target skill.

Example:

```text
Tính giá trị vế trái trừ vế phải của phương trình khi x = 1.
```

### Confirmation

Second evidence item for a KC after wrong/unknown.

Should ideally be a different surface.

Bad confirmation:

```text
3(x - 2)
4(x - 3)
```

This is only parameter variation.

Better confirmation:

```text
3(x - 2) = 3x + [ ]
```

### Transfer

Applies the KC inside a more complex or exam-like context.

Use carefully. Transfer items often have hidden prerequisites.

### Readiness

Tests whether the student is ready to learn the next KC.

---

## 7. Step 5 — Design The Mathematical Task

The item must be:

- short,
- focused,
- auto-gradable,
- open-ended,
- not multiple choice,
- not yes/no,
- not copied from visible options,
- not overly verbose,
- not dependent on unsupported input.

### Good Open-Ended Item

```text
Điền số còn thiếu: 3(x - 2) = 3x + [ ].
```

Answer:

```text
-6
```

Why good:

- no guessing from options,
- answer is a number,
- widget can be number input,
- directly diagnoses distribution,
- low false-negative risk.

### Bad Open-Ended Item

```text
Khai triển biểu thức 3(x - 2).
```

Answer:

```text
3x - 6
```

Why risky:

- requires expression parser,
- many equivalent formats,
- typo risk,
- could mark correct math wrong if checker is weak.

This item can still be used if expression widget/checker is strong, but the template version is better for pilot.

---

## 8. Step 6 — Widget-First Authoring

Before finalizing a question, ask:

> How will the student input the answer?

If the answer cannot be entered safely, redesign the item.

### Supported Widget Types

Current / intended widget types:

```text
number
integer
decimal
fraction
power
coordinate_pair
ordered_pair_list
expression
equation_template
set
ordered_list
probability
```

### Widget Selection Rules

| If answer is... | Prefer widget | Checker |
|---|---|---|
| one integer | `number` / `integer` | `numeric_equal` |
| decimal | `decimal` | `decimal_equal` |
| fraction | numerator/denominator boxes | `fraction_equal` |
| percent probability | structured percent/decimal/fraction | `probability_equal` |
| coordinate | x/y boxes | `coordinate_pair_equal` |
| two points | ordered coordinate pair list widget | `ordered_pair_list_equal` |
| expression with fixed form | expression template | `expression_equivalent` or template checker |
| full equation | equation builder, not raw text | equation equivalence checker |
| set/list | multi-box set/list widget | `set_equal` / `ordered_list_equal` |

### Rule

If the item requires raw free-form expression input and no widget supports it, mark it:

```json
"flags": ["needs_widget"]
```

Do not mark it pilot-ready.

### Examples Of Redesigning For Widgets

Bad:

```text
Viết biểu thức tiền lãi của khoản x triệu với lãi suất 6% một năm.
```

Problems:

- Student may write `6%.x`, `0.06x`, `x*6/100`, `6x/100`.
- Many equivalent forms.
- Parser risk.

Better:

```text
Tiền lãi của khoản x triệu với lãi suất 6% là [ ]x triệu. Điền hệ số còn thiếu.
```

Answer:

```text
0.06
```

Widget:

```text
decimal
```

Bad:

```text
Viết phương trình theo x.
```

Better:

```text
Tổng lãi là 17.72 triệu. Điền hệ số còn thiếu trong phương trình:
[ ]x + 0.058(300 - x) = 17.72
```

Answer:

```text
0.06
```

Widget:

```text
decimal
```

---

## 9. Step 7 — Choose Checker

Every item must have a deterministic checker.

### Checker Types

```text
numeric_equal
decimal_equal
fraction_equal
probability_equal
power_tuple
expression_equivalent
coordinate_pair_equal
ordered_pair_list_equal
ordered_list_equal
set_equal
rubric_manual
```

### Auto-Scored Pilot Rule

Do not use `rubric_manual` for student pilot scoring.

Manual rubric can exist for research or teacher review, but it should not drive adaptive state updates.

### Expression Checker Caution

Expression equivalence is useful but dangerous.

It must handle:

- implicit multiplication: `3x`, `x(x+2)`,
- percent notation: `6%`,
- comma decimal: `5,8%`,
- parentheses,
- variable equivalence.

Even then, prefer template widgets when possible.

---

## 10. Step 8 — Fill Metadata

Every official item should include:

```json
{
  "review_id": "stable-item-id",
  "official_assessment_scope": "grade8_exam_path",
  "target_exam_path": "rational_expression",
  "item_role": "anchor",
  "item_family": "domain_single_linear_denominator",
  "surface_signature": "voi phan thuc <num>/(x + <num>), gia tri nao lam khong xac dinh",
  "parameter_set": "x_plus_2",
  "kc_id": "...",
  "kc_code": "G8-MATH-XAC-DINH-DIEU",
  "kc_name": "Xác định điều kiện xác định của phân thức",
  "question": "...",
  "answer_type": "number",
  "answer_widget": "number",
  "checker_type": "numeric_equal",
  "accepted_answers": ["-2"],
  "tolerance": null,
  "difficulty_label": "anchor",
  "is_diagnostic_anchor": true,
  "requires_kcs": [],
  "requires_kc_codes": [],
  "diagnoses_kcs": ["..."],
  "diagnoses_kc_codes": ["G8-MATH-XAC-DINH-DIEU"],
  "inference_strength": "weak",
  "academic_reviewed": false,
  "common_wrong_patterns": [],
  "flags": [],
  "review_notes": "Draft generated. Academic review required."
}
```

### Field Explanations

#### `official_assessment_scope`

Assessment scope this item belongs to.

Example:

```text
grade8_exam_path
```

#### `target_exam_path`

The path/strand inside the assessment.

Examples:

```text
rational_expression
linear_equation
word_problem_modeling
linear_function
```

This keeps drill-down inside a coherent topic before returning to global EIG.

#### `item_role`

Purpose of item:

```text
anchor
misconception
prerequisite_probe
bridge
confirmation
transfer
readiness
```

#### `item_family`

Stable template family.

Bad:

```text
question_1
```

Good:

```text
expand_coefficient_parentheses
```

#### `surface_signature`

Normalized structure with numbers abstracted.

Example:

```text
khai trien bieu thuc <num>(x - <num>)
```

Use this to prevent repeated near-identical items.

#### `parameter_set`

Specific parameter variant.

Example:

```text
3_x_minus_2
```

#### `requires_kcs`

All non-primary KCs required to solve the item.

If solving the item needs expanding parentheses, list the expansion KC.

If solving it needs percent-to-decimal conversion, list that KC.

Rule:

> If a student could fail because of another skill, and that skill is not the primary KC, include it in `requires_kcs`.

#### `diagnoses_kcs`

KCs that a wrong answer can diagnose.

Usually includes the primary KC.

Can include prerequisite KCs if wrong patterns strongly indicate them.

#### `common_wrong_patterns`

Known wrong answers and what they mean.

Example:

```json
{
  "pattern": "3x-2",
  "mode": "exact",
  "diagnosis": "Distributed 3 to x but not to -2",
  "diagnoses_kcs": ["G6-MATH-BO-DAU-NGOAC"]
}
```

#### `academic_reviewed`

AI-generated items must always start with:

```json
"academic_reviewed": false
```

Only academic reviewers can set:

```json
"academic_reviewed": true
```

#### `inference_strength`

AI-generated items must start:

```json
"inference_strength": "weak"
```

Strong inference requires:

- academic review,
- deterministic checker,
- no hidden prerequisites,
- low ambiguity,
- supported widget.

---

## 11. Step 9 — Generate Enough Item Variants

Do not generate exactly one item per node.

For adaptive assessment, each important KC needs:

- 1 anchor item,
- 1 misconception/prerequisite probe,
- 1 confirmation item,
- optionally 1 bridge or transfer item.

Minimum for high-impact KC:

```text
2 distinct surfaces
```

Better:

```text
3 distinct surfaces
```

Bad bank:

```text
3(x - 2)
4(x - 3)
5(x - 1)
```

This is many parameter variants but one surface.

Better bank:

```text
1. 3(x - 2) = [ ]x + [ ]
2. 3(x - 2) = 3x + [ ]
3. A student wrote 3(x - 2)=3x-2. Fill the corrected constant term.
```

---

## 12. Step 10 — Hidden Prerequisite Audit

Before accepting an item, ask:

> Could the student fail this because of a different skill?

If yes, either:

1. Add that skill to `requires_kcs`, or
2. Redesign the item to remove the hidden skill.

### Example

Question:

```text
Giải phương trình: 3(x - 2) + 5 = 2x.
```

Primary KC:

```text
G8-MATH-GIAI-PHUONG-TRINH
```

Hidden prerequisites:

- distribute parentheses,
- integer arithmetic,
- move terms,
- combine like terms.

Therefore `requires_kcs` must include relevant prerequisite KCs.

If you only want to measure equation solving, reduce hidden load:

```text
Giải phương trình: x + 5 = 2x.
```

---

## 13. Step 11 — Guess Resistance

A good open-ended diagnostic should be hard to guess.

Bad:

```text
3/4, 5/0, -2/7, 0/9. Cách viết nào không phải phân số hợp lệ?
```

Why bad:

- disguised multiple choice,
- answer is visible in prompt,
- guessing chance still high,
- not truly open-ended.

Better:

```text
Với biểu thức 7/(n - 3), giá trị nào của n làm biểu thức không hợp lệ?
```

Answer:

```text
3
```

Widget:

```text
number
```

---

## 14. Step 12 — Common Anti-Patterns

### Anti-Pattern 1: Disguised MCQ

Bad:

```text
Trong các số sau..., số nào...
```

If the answer is selected from a visible list, it is not true open-ended.

### Anti-Pattern 2: Yes/No

Bad:

```text
37 có phải số nguyên tố không?
```

Guessing chance is 50%.

Better:

```text
Số 37 có bao nhiêu ước dương?
```

Answer:

```text
2
```

### Anti-Pattern 3: Long Explanation Auto-Graded By Text

Bad:

```text
Hãy giải thích vì sao...
```

Unless this is manual review, do not use for auto-scored adaptive state.

### Anti-Pattern 4: Too Many Skills In One Item

Bad:

```text
Đọc đề văn, lập phương trình, giải phương trình, tính tiền lãi, kết luận.
```

This is useful as a transfer task, but not as a root-cause diagnostic item unless broken into subitems.

### Anti-Pattern 5: Raw Expression Without Widget

Bad:

```text
Viết phương trình theo x.
```

Better:

```text
Điền hệ số còn thiếu trong template.
```

### Anti-Pattern 6: Parameter Variants Treated As Independent Items

Bad:

```text
2(x - 1)
3(x - 2)
4(x - 3)
```

These are not enough surface diversity.

---

## 15. Widget Development Requirements

If item authoring repeatedly needs a new answer format, create a widget/checker requirement.

### Required Widget Spec

For every new widget, define:

```json
{
  "widget_name": "equation_template",
  "student_input_fields": ["left_coefficient", "right_constant"],
  "serialized_answer_format": "...",
  "checker_type": "...",
  "valid_examples": ["..."],
  "invalid_examples": ["..."],
  "mobile_behavior": "...",
  "keyboard_behavior": "...",
  "accessibility_notes": "..."
}
```

### Do Not Use Item Until Widget Exists If

- answer requires full equation,
- answer requires multi-term expression,
- answer requires ordered coordinate pairs,
- answer requires multiple fractions,
- answer requires drawing/graphing,
- answer requires explanation text.

### Current High-Priority Widgets

1. Equation builder.
2. Expression template widget.
3. Ordered pair list widget.
4. Rational expression widget.
5. Percent/rate widget.
6. Multi-step fill-in template.

---

## 16. How Many Items Per Node?

For important nodes:

```text
minimum: 2 usable items
recommended: 3-4 usable items
```

But “usable” means:

- deterministic checker,
- supported widget,
- not duplicate surface,
- metadata complete,
- academic reviewed.

For high-impact prerequisite/root nodes:

```text
3 distinct surfaces preferred
```

Reason:

The adaptive algorithm may need:

- first evidence,
- confirmation after wrong/unknown,
- alternate probe if first item had input ambiguity.

---

## 17. Item Bank Design For Drill-Down

The Grade 8 drill-down algorithm works like:

```text
Grade 8 fail
-> same KC or diagnosed prerequisite
-> Grade 7/6 root probe
-> same-KC confirmation if wrong/unknown
-> return to broader EIG
```

Therefore the item bank must include:

- Grade 8 transfer items,
- Grade 8 bridge items,
- Grade 7 prerequisite probes,
- Grade 6 root probes,
- confirmation items for each root KC.

If a Grade 8 item lists a Grade 6 KC in `requires_kcs`, that Grade 6 KC must have usable items.

Otherwise the algorithm knows where to drill but has no drill bit.

---

## 18. Review Checklist Before Marking Pilot-Ready

An item is pilot-ready only if all are true:

- [ ] Primary KC is correct.
- [ ] Node title and description were read.
- [ ] Graph prerequisites were checked.
- [ ] No hidden prerequisite is omitted.
- [ ] Item is not MCQ disguised as open-ended.
- [ ] Item is not yes/no.
- [ ] Item is not long free-text unless manual only.
- [ ] Answer is deterministic.
- [ ] Widget exists and is appropriate.
- [ ] Checker exists and is tested.
- [ ] Accepted answers cover equivalent forms.
- [ ] `item_family` is correct.
- [ ] `surface_signature` is correct.
- [ ] Parameter variants are not counted as independent surfaces.
- [ ] `requires_kcs` is complete.
- [ ] `diagnoses_kcs` is complete.
- [ ] `common_wrong_patterns` are meaningful.
- [ ] `academic_reviewed` is only true after academic approval.
- [ ] `inference_strength` is not strong unless justified.

---

## 19. Example: Full Good Item

```json
{
  "review_id": "g8-path-example-001",
  "official_assessment_scope": "grade8_exam_path",
  "target_exam_path": "linear_equation",
  "item_role": "prerequisite_probe",
  "item_family": "expand_coefficient_parentheses_constant_fill",
  "surface_signature": "a(x - b) = ax + blank",
  "parameter_set": "3_x_minus_2",
  "kc_id": "7c147ca4-23b5-4563-be98-cd0b07af6f6e",
  "kc_code": "G6-MATH-BO-DAU-NGOAC",
  "kc_name": "Bỏ dấu ngoặc có dấu + đằng trước",
  "question": "Điền số còn thiếu: 3(x - 2) = 3x + [ ].",
  "answer_type": "number",
  "answer_widget": "number",
  "checker_type": "numeric_equal",
  "accepted_answers": ["-6"],
  "tolerance": null,
  "difficulty_label": "anchor",
  "is_diagnostic_anchor": true,
  "requires_kcs": [],
  "requires_kc_codes": [],
  "diagnoses_kcs": ["7c147ca4-23b5-4563-be98-cd0b07af6f6e"],
  "diagnoses_kc_codes": ["G6-MATH-BO-DAU-NGOAC"],
  "inference_strength": "weak",
  "academic_reviewed": false,
  "common_wrong_patterns": [
    {
      "pattern": "-2",
      "mode": "exact",
      "diagnosis": "Student did not distribute 3 to the constant term.",
      "diagnoses_kcs": ["7c147ca4-23b5-4563-be98-cd0b07af6f6e"]
    },
    {
      "pattern": "6",
      "mode": "exact",
      "diagnosis": "Student distributed but lost the negative sign.",
      "diagnoses_kcs": ["7c147ca4-23b5-4563-be98-cd0b07af6f6e"]
    }
  ],
  "flags": [],
  "review_notes": "Good prerequisite probe. Uses numeric widget to avoid expression syntax false negatives."
}
```

Why this is good:

- target KC is clear,
- answer is one number,
- widget is simple,
- checker is reliable,
- common wrong answers diagnose misconception,
- no hidden prerequisite,
- useful after Grade 8 equation failure.

---

## 20. Example: Bad Item And Fix

Bad:

```json
{
  "question": "Viết biểu thức tiền lãi của khoản x triệu với lãi suất 6% một năm.",
  "answer_widget": "expression",
  "checker_type": "expression_equivalent",
  "accepted_answers": ["0.06*x"]
}
```

Problems:

- student can write many equivalent forms,
- percent syntax ambiguity,
- raw expression typing risk,
- does not isolate whether the student knows percent conversion or expression writing.

Better:

```json
{
  "question": "Tiền lãi của khoản x triệu với lãi suất 6% là [ ]x triệu. Điền hệ số còn thiếu.",
  "answer_widget": "decimal",
  "checker_type": "decimal_equal",
  "accepted_answers": ["0.06", "3/50"]
}
```

Why better:

- focuses on percent-to-decimal coefficient,
- deterministic,
- lower typo risk,
- widget supported.

---

## 21. AI Generation Prompt For New Items

Use this prompt for AI drafting. Do not ask AI to generate many unrelated KCs in one call.

```text
You are drafting Wizzdom Assessment V2 diagnostic items.

Hard rules:
1. AI drafts only. Always set academic_reviewed=false and inference_strength="weak".
2. Read the target KC title and description. Do not infer from code alone.
3. The item must have exactly one primary KC.
4. List all hidden prerequisite KCs in requires_kcs.
5. List all KCs a wrong answer can diagnose in diagnoses_kcs.
6. Do not create yes/no questions.
7. Do not create disguised multiple choice.
8. Do not ask students to choose from visible options.
9. Avoid long free-text answers.
10. If the answer requires raw expression/equation input, first propose the required widget. Prefer numeric/template input.
11. Provide at least 2 distinct surface variants for important KCs.
12. Do not count parameter variants as distinct surfaces.
13. Output valid JSON only.

Input:
- Assessment scope:
- Target exam path:
- Target KC id/code/name/description:
- Incoming prerequisite KCs:
- Outgoing dependent KCs:
- Desired item role:
- Supported widgets/checkers:
- Existing item families/surface signatures to avoid:

Output schema:
{
  "review_id": "...",
  "official_assessment_scope": "...",
  "target_exam_path": "...",
  "item_role": "...",
  "item_family": "...",
  "surface_signature": "...",
  "parameter_set": "...",
  "kc_id": "...",
  "kc_code": "...",
  "kc_name": "...",
  "question": "...",
  "answer_type": "...",
  "answer_widget": "...",
  "checker_type": "...",
  "accepted_answers": ["..."],
  "tolerance": null,
  "difficulty_label": "...",
  "is_diagnostic_anchor": false,
  "requires_kcs": ["..."],
  "requires_kc_codes": ["..."],
  "diagnoses_kcs": ["..."],
  "diagnoses_kc_codes": ["..."],
  "inference_strength": "weak",
  "academic_reviewed": false,
  "common_wrong_patterns": [],
  "flags": [],
  "review_notes": "..."
}
```

---

## 22. QC Report Requirements

After generating a bank, produce a QA report.

Report must include:

- total items,
- items per KC,
- unique surfaces per KC,
- items missing `requires_kcs`,
- items missing `diagnoses_kcs`,
- unsupported widget/checker,
- duplicate `item_family + parameter_set`,
- duplicate `surface_signature`,
- raw expression risk,
- disguised MCQ risk,
- yes/no risk,
- long free-text risk,
- KCs with fewer than 2 usable items,
- high-impact KCs with fewer than 3 surfaces.

Do not pilot without this report.

---

## 23. Minimum Readiness For Student Pilot

For a scoped official diagnostic:

- Every target path has enough items.
- Every high-impact KC has at least 2 usable items.
- Root prerequisite KCs have confirmation items.
- No unsupported widget appears in student flow.
- No `replace_required` item appears.
- No raw expression item appears unless parser/widget has been tested.
- No item is `academic_reviewed=true` without human review.
- Teacher review can explain why each item was asked.

---

## 24. Practical Decision Tree

When writing an item, use this decision tree:

```text
Does the item measure one clear KC?
  No -> redesign.
  Yes -> continue.

Can a student answer by guessing from options/list?
  Yes -> reject.
  No -> continue.

Is the answer deterministic?
  No -> redesign or manual-only.
  Yes -> continue.

Is there a supported widget?
  No -> build widget first or rewrite item.
  Yes -> continue.

Does the item require hidden prerequisites?
  Yes -> list them in requires_kcs or simplify item.
  No -> continue.

Does wrong answer diagnose a useful KC?
  No -> mark weak/low diagnostic value.
  Yes -> fill diagnoses_kcs/common_wrong_patterns.

Is it duplicate surface?
  Yes -> keep only as parameterized fallback, not independent evidence.
  No -> pilot candidate after review.
```

---

## 25. Final Rule

Never optimize for number of generated questions.

Optimize for:

- clarity,
- diagnostic precision,
- low false-negative risk,
- widget-supported input,
- complete metadata,
- surface diversity,
- teacher explainability.

One excellent diagnostic item is more valuable than ten ambiguous ones.

