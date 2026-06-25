# Assessment V2: Grade 6 Algebra Open Diagnostic Requirements

## Research Grounding

Assessment V2 follows a Knowledge Space / Learning Space direction rather than
a conventional test-score direction.

The important product implication is:

- The assessment should not primarily return "student got X/Y correct".
- It should infer a knowledge state: what the student likely knows, likely does
  not know, and is ready to learn next.
- A small number of well-chosen diagnostic questions can be more useful than a
  broad set of shallow questions, if those questions are valid projections of
  the underlying knowledge graph.

This is aligned with the ALEKS/KST tradition:

- Doignon and Falmagne describe Knowledge Space Theory as a combinatorial
  approach to assessing knowledge, different from standardized score-based
  testing, and focused on adaptive questioning plus richer knowledge-state
  output.
- Falmagne's work on projections of learning spaces supports the idea that a
  large curriculum can be assessed through a smaller, carefully selected subset
  of items, as long as the subset is consistent with the larger learning space.
- ALEKS-style knowledge checks are used to determine both what a student does
  or does not understand and what the student is ready to learn next.

References:

- Doignon & Falmagne, "Knowledge Spaces and Learning Spaces":
  https://arxiv.org/abs/1511.06757
- Falmagne, "Projections of a Learning Space":
  https://arxiv.org/abs/0803.0575
- ALEKS overview:
  https://en.wikipedia.org/wiki/ALEKS

## Scope

V1 of Assessment V2 focuses on Grade 6 algebra/non-geometry only.

Included first:
- number foundations, factors, multiples, divisibility, GCD/LCM
- integers, order, absolute value / opposite number
- fractions, equivalent fractions, common denominator, fraction operations
- decimals, percent, ratio / proportional reasoning
- expressions, powers, order of operations
- non-visual data/statistics/probability items when they belong to the algebra scan

Deferred:
- geometry items that require drawing, measuring, reading complex figures, or visual construction
- mixed algebra/geometry bridge nodes until academic review approves their strand

## How Assessment V2 Differs From V1

V1 is useful as a guarded MCQ adaptive assessment, but it is limited by item
format and evidence quality.

| Dimension | Assessment V1 | Assessment V2 target |
| --- | --- | --- |
| Primary question type | MCQ | Open-ended diagnostic item |
| Guessing probability | High, usually around 25% for 4-option MCQ | Low, often 2-5% for numeric/fraction/short answer |
| Evidence unit | Correct/wrong on one KC item | Correct/wrong plus answer form, misconception, prerequisite evidence |
| Graph inference | Mostly soft probability propagation | Strong inference allowed only for reviewed prerequisite-rich items |
| Output goal | Tested/inferred KC states from adaptive run | Auditable knowledge state + likely gap cause + next learnable frontier |
| Item design | KC-level coverage | Discriminating projection items over a strand |
| Risk | False pass from guessing, false gap from careless slip | Lower guessing; higher authoring burden; stricter review needed |

V2 should not replace V1 until it passes deterministic simulations and academic
review. V2 is a stricter diagnostic layer, not merely a new UI for the same MCQs.

## Assessment Goal And Constraints

Goal for Grade 6 algebra pilot:

- scan the algebra/non-geometry strand in about 30-35 questions;
- identify high-confidence gaps and mastered regions;
- produce a useful next-learning frontier;
- avoid overclaiming when evidence is weak.

Hard constraints:

- no strong inference from unreviewed questions;
- no geometry/visual construction in the algebra pilot;
- no hidden skills: every non-primary skill required by an item must appear in
  `requires_kcs`;
- no "hard" item that actually tests an unrelated future KC;
- no item should be used as a strand projection item unless academic team agrees
  its correctness/wrongness has interpretable graph meaning.

Good diagnostic behavior:

- Correct on a strong item can support mastery of listed prerequisites.
- Wrong on a strong item can diagnose a specific missing prerequisite only when
  the wrong answer pattern or task structure justifies it.
- If a wrong answer could be caused by multiple unrelated reasons, mark the
  item as weak/medium inference, not strong.

## Runtime Cap Vs Item Bank Size

Assessment length and item bank size are different quantities.

Runtime target per student: 30-35 open-ended diagnostic questions.

Minimum local algorithm-test fixture: 60 reviewed-or-reviewable items.

Good V2 pilot bank: 90-120 reviewed open-ended items.

Production-quality algebra bank: 150+ reviewed items, depending on the final
number of Grade 6 algebra KCs and bridge/cut-point density.

The student should not answer every item in the bank. The algorithm needs a
larger bank so it can choose frontier-appropriate questions, avoid repeats, use
confirmation items after slips/guesses, and still have alternatives when a KC has
already consumed one item.

The original 30-35 number is the per-student run budget, not the total number of
items we need to author.

Recommended minimum 60-item algorithm-test fixture distribution:

| Topic cluster | Target items |
| --- | ---: |
| Number foundations and divisibility | 9-10 |
| Integers and order | 8-9 |
| Fractions equivalence and operations | 14-16 |
| Decimals, percent, ratio | 11-13 |
| Expressions and order of operations | 11-13 |
| Data/statistics/probability, non-visual | 6-8 |

Rule of thumb:

- high-impact/root/bridge KC: 3-5 usable items;
- ordinary KC: 2-3 usable items;
- any KC used for strong inference: at least 1 strong diagnostic item and 1
  confirmation item;
- high-traffic clusters such as fractions, ratio, and expressions need denser
  pools than isolated low-traffic nodes.

## Topic-Level Design Targets

Each topic cluster needs a small set of item roles, not just a count.

### Number Foundations And Divisibility

Required item roles:

- one anchor item for factor/multiple recognition;
- one divisibility test item;
- one GCD/LCM bridge item;
- one prime/composite misconception item;
- one transfer item where the answer reveals whether the student understands
  why the rule works, not only the final computation.

Strong inference examples:

- Correct GCD/LCM bridge item may support mastery of factors, multiples, common
  factors/common multiples, and divisibility if the item requires all of them.
- Wrong answer can diagnose the specific prerequisite only if the distractor or
  open response maps cleanly to the misconception.

### Integers And Order

Required item roles:

- compare/order integers;
- interpret negative numbers on a number line;
- absolute value/opposite number;
- signed operation or sign-reasoning misconception.

Do not overclaim from one arithmetic error. A sign slip is common; strong gap
requires either repeated evidence or a wrong pattern showing conceptual error.

### Fractions Equivalence And Operations

Required item roles:

- fraction meaning and valid fraction form;
- equivalent fractions;
- simplification;
- common denominator;
- add/subtract unlike denominators;
- multiply/divide fraction bridge;
- misconception item for adding numerator and denominator directly.

This is likely the highest-value cluster for V2 because many advanced Grade 6
skills depend on it and open-ended answers can sharply reveal misconceptions.

### Decimals, Percent, Ratio

Required item roles:

- decimal place value;
- decimal operations;
- fraction-decimal-percent conversion;
- ratio interpretation;
- proportional reasoning bridge;
- percent misconception item.

These items should be written carefully: a correct calculation does not always
prove ratio reasoning. Strong inference requires the item to force the ratio
interpretation, not merely arithmetic.

### Expressions And Order Of Operations

Required item roles:

- order of operations;
- parentheses;
- powers;
- expression evaluation;
- removing parentheses / sign distribution;
- misconception around precedence or sign before parentheses.

Strong inference is appropriate only when the expression is designed so the
student cannot get the answer through a shortcut unrelated to the target KC.

### Data, Statistics, Probability, Non-Visual

Required item roles:

- read a simple table;
- compute/interpret a basic statistic if it is in graph scope;
- simple probability;
- distinguish impossible/certain/possible events;
- interpret data without requiring a complex chart.

Visual chart items are deferred unless academic team explicitly approves them
as non-geometry visual-data items for the algebra pilot.

## Required Metadata Per Item

Every open-ended diagnostic item should include:

```json
{
  "kc_id": "uuid of primary KC",
  "question": "student-facing prompt",
  "answer_type": "integer | decimal | fraction | number | set | short_text",
  "accepted_answers": ["all accepted canonical answers"],
  "tolerance": 0.000001,
  "difficulty_label": "easy | anchor | medium | hard",
  "is_diagnostic_anchor": true,
  "requires_kcs": ["prerequisite KC ids that a correct answer strongly demonstrates"],
  "diagnoses_kcs": ["KC ids likely missing when this item is wrong"],
  "inference_strength": "weak | medium | strong",
  "academic_reviewed": true,
  "common_wrong_patterns": [
    {
      "pattern": "2/5",
      "mode": "exact",
      "diagnosis": "adds numerators and denominators directly",
      "diagnoses_kcs": ["kc-common-denominator"]
    }
  ]
}
```

`inference_strength=strong` must only be used when `academic_reviewed=true`.
The V2 lab engine will not apply strong inference for unreviewed items.

## Item Quality Rubric

Academic team should rate every candidate item on these dimensions.

| Criterion | Pass condition | Reject / revise if |
| --- | --- | --- |
| KC alignment | The primary KC is clearly the main skill tested | The question mostly tests another KC |
| Prerequisite transparency | All required prerequisite KCs are listed | Hidden skills are needed but unlisted |
| Answer determinism | Correct answer can be graded deterministically | Many valid answers are hard to enumerate |
| Misconception signal | Wrong patterns map to plausible misconceptions | Wrong answer is too ambiguous |
| Guess resistance | Student cannot easily guess the answer | Item is basically MCQ in disguise |
| Cognitive load | Reading/context load is appropriate for Grade 6 | Word problem complexity hides math signal |
| Inference validity | Correct/wrong evidence justifies claimed graph inference | Inference is based on intuition only |
| Strand purity | Item belongs to algebra/non-geometry pilot | Geometry/visual construction is required |

Recommended scoring:

- 0 = reject
- 1 = usable only as weak evidence
- 2 = medium inference after revision
- 3 = strong diagnostic item

Only items averaging at least 2.5 and with no zero in KC alignment,
prerequisite transparency, or inference validity should be eligible for
`inference_strength=strong`.

## Authoring Rules

Strong diagnostic items should be open-ended, not MCQ, because guessing
probability is much lower and reasoning is easier to inspect.

Each strong item should:
- target one primary KC
- require only approved prerequisite KCs, not unrelated hidden skills
- have one clear expected answer or a deterministic equivalence rule
- include 1-3 common wrong patterns that identify likely misconception
- include whether a wrong answer diagnoses the primary KC or a prerequisite KC
- avoid geometry visuals in the algebra pilot unless explicitly reviewed as a data/table item

Do not mark a multi-skill word problem as strong diagnostic unless every required
skill is listed in `requires_kcs` and academic review agrees the inference is valid.

## Open-Ended Item Templates

### Numeric / Fraction Answer

Use when the target is computation, equivalence, conversion, or simple data.

```json
{
  "question": "Tính: 1/2 + 1/3",
  "answer_type": "fraction",
  "accepted_answers": ["5/6"],
  "common_wrong_patterns": [
    {
      "pattern": "2/5",
      "mode": "exact",
      "diagnosis": "Cộng tử số với tử số và mẫu số với mẫu số",
      "diagnoses_kcs": ["KC_QUY_DONG_MAU"]
    }
  ],
  "requires_kcs": ["KC_NHAN_BIET_PHAN_SO", "KC_QUY_DONG_MAU"],
  "diagnoses_kcs": ["KC_QUY_DONG_MAU"],
  "inference_strength": "strong",
  "academic_reviewed": true
}
```

### Short Explanation Answer

Use sparingly. It is useful when the learning goal is conceptual reasoning, but
requires a stricter rubric.

```json
{
  "question": "Vì sao 2/4 và 1/2 là hai phân số bằng nhau?",
  "answer_type": "short_text",
  "accepted_answers": [
    "vì 2/4 rút gọn bằng 1/2",
    "vì nhân chéo 2 x 2 = 4 x 1"
  ],
  "rubric": {
    "must_mention_any": ["rút gọn", "nhân chéo", "cùng giá trị"],
    "reject_if_mentions": ["vì tử số bằng nhau", "vì mẫu số bằng nhau"]
  },
  "requires_kcs": ["KC_PHAN_SO_BANG_NHAU"],
  "diagnoses_kcs": ["KC_PHAN_SO_BANG_NHAU"],
  "inference_strength": "medium",
  "academic_reviewed": true
}
```

Short-text items should usually be medium inference until we have reliable
grading/rubric validation.

## Converting Current MCQs Into V2 Items

Current MCQs are valuable as source material, but most should not become strong
diagnostic items without redesign.

Conversion process:

1. Keep the same target KC only if the stem truly tests that KC.
2. Remove answer choices and ask for the final answer directly.
3. Use the old distractors as `common_wrong_patterns`.
4. Add `requires_kcs` based on the graph prerequisites actually needed.
5. Add `diagnoses_kcs` only when a wrong pattern clearly identifies a gap.
6. Mark `inference_strength=weak` by default.
7. Upgrade to `medium` or `strong` only after academic review.

Example:

- MCQ stem: "Tính 1/2 + 1/3"
- Old distractor: "2/5"
- V2 use: open answer `5/6`; wrong pattern `2/5` diagnoses failure to quy đồng mẫu.

Do not convert an MCQ by simply hiding the options if:

- the original item is recognition-only;
- all distractors are superficial;
- the item tests vocabulary rather than skill;
- the item relies on a diagram not available in text;
- the correct answer can be guessed from wording.

## Inference Strength Rules

### Weak

Use for:

- ordinary practice-style item;
- answer only confirms the primary KC;
- wrong answer is ambiguous;
- item has no reviewed prerequisite mapping.

Effect:

- updates primary KC only;
- graph propagation should be soft and conservative.

### Medium

Use for:

- item has a clear primary KC and clear prerequisite list;
- correct answer gives useful but not conclusive prerequisite evidence;
- wrong answer narrows down likely gap but not uniquely.

Effect:

- updates primary KC;
- may softly increase/decrease listed prerequisites or descendants;
- should usually require confirmation before final label.

### Strong

Use only when:

- item is open-ended;
- academic review completed;
- required prerequisite KCs are listed;
- common wrong patterns are reviewed;
- answer cannot be solved without the claimed prerequisites;
- a wrong answer has interpretable diagnostic meaning.

Effect:

- correct response may infer listed prerequisites as likely mastered;
- wrong response may infer listed `diagnoses_kcs` as likely gaps;
- tested evidence still overrides inferred evidence.

## Review Workflow

Recommended academic workflow:

1. Choose algebra strand nodes from graph.
2. Identify cut-points / bridge KCs in the strand.
3. Draft open-ended items for those cut-points first.
4. Fill topic-cluster coverage gaps second.
5. For each item, complete metadata and rubric.
6. Academic reviewer approves or downgrades `inference_strength`.
7. Run deterministic simulations before any AI/student-facing smoke test.
8. Inspect run visualization for each simulated persona.
9. Only then connect to sandbox API.

Required reviewer decisions:

- Is this item in algebra scope?
- What exact KC does it primarily test?
- Which prerequisites are truly required?
- What wrong answers reveal which misconception?
- Is strong inference justified, or should it be medium/weak?

## Safe Test Plan For The Pilot

Phase 1: no AI, no production write.

- Use reviewed item JSON fixtures.
- Simulate deterministic personas:
  - mastered all algebra foundations;
  - specific fraction gap;
  - integer/sign gap;
  - random guesser;
  - sloppy mastered student.
- Cap at 30-35 questions.
- Measure:
  - number of questions;
  - number of directly tested KCs;
  - number of inferred KCs;
  - precision/recall for gap detection;
  - false strong inference count;
  - duplicate item count.

Phase 2: small AI smoke only after deterministic tests pass.

- 1 strong student persona;
- 1 specific-gap persona;
- cap at 12-18 questions first, then 30-35;
- require full reasoning transcript.

Do not use AI student tests to debug basic algorithm design.

## Production Database MCQ Export

A read-only export script has been prepared for the next session:

- `backend/scratch/export_g6_algebra_mcq_items.py`

It will export:

- active Grade 6 math MCQ items from production DB;
- conservative algebra/non-geometry scope only;
- up to 2 items per KC;
- diagnostic anchors first;
- full question, options, correct answer, difficulty, anchor flag, and IRT metadata.

Expected output:

- `docs/g6_algebra_current_mcq_items.md`

Current session note: production DB network access was blocked at DNS/network
resolution, so the actual DB export should be run in a session where production
network access is enabled.

## Current Implementation Boundary

The current V2 code is independent from the existing assessment engine:
- `backend/app/engines/assessment_v2/open_grading.py`
- `backend/app/engines/assessment_v2/strand_scope.py`
- `backend/app/engines/assessment_v2/item_requirements.py`
- `backend/app/engines/assessment_v2/diagnostic_engine.py`

It does not change production API behavior, existing MCQ assessment behavior, or
the current graph editor.

Next integration step, after item authoring:
- export reviewed Grade 6 algebra strand nodes
- attach pilot open-ended diagnostic items to those nodes
- run deterministic V2 simulations with 30-35 item cap
- only then decide whether to connect V2 to sandbox API/UI
