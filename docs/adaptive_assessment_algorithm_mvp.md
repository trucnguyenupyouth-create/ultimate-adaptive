# Adaptive Assessment Node Selection Algorithm — MVP v1 + Roadmap

**Audience:** software engineers, product, curriculum/assessment designers  
**Product context:** adaptive assessment over a KC graph for middle-school math, with MCQ item pools per KC  
**Version:** v1 MVP functional spec  
**Core goal:** choose the next KC/item that most reduces uncertainty about the student's knowledge state, while keeping the implementation simple enough to ship.

---

## 0. Executive summary

The MVP should **not** select the next node by raw graph coverage such as:

```text
closure_gain = 1 + unknown_ancestors + unknown_descendants
```

That creates a root-node bias: root KCs with many descendants look valuable even when asking them now is likely to produce little new information.

Instead, the MVP should keep a **per-student, per-KC mastery probability**:

```text
p_mastery[student_id, kc_id] ∈ [0, 1]
```

Then for each candidate KC and candidate item, estimate:

```text
P(correct | current student, current KC state, item)
```

and score candidates by a simple expected gain:

```text
expected_gain = P(correct) · gain_if_correct + P(wrong) · gain_if_wrong
```

Where:

- `gain_if_correct` estimates how much uncertainty is reduced if the student answers correctly.
- `gain_if_wrong` estimates how much uncertainty is reduced if the student answers incorrectly.
- Gains are weighted by current uncertainty, not raw ancestor/descendant count.

For MVP, we do **not** need fully calibrated BKT/IRT. We use **expert priors** and **difficulty-tag priors** first, then log real response data so future versions can learn better parameters.

---

## 1. Concepts and definitions

### 1.1 Knowledge Component — KC

A **KC** is one small skill/concept that can be independently assessed.

Examples:

```text
G6-MATH-NHAN-BIET-HAI       = Kiểm tra hai phân số bằng nhau bằng nhân chéo
G6-MATH-QUY-DONG-MAU        = Quy đồng mẫu nhiều phân số
G6-MATH-CONG-PHAN-SO-KHAC   = Cộng hai phân số khác mẫu
```

Each KC is a node in a directed prerequisite graph.

---

### 1.2 KC graph

A directed edge means one KC is a prerequisite for another.

```text
A → B
```

means:

```text
A is a prerequisite of B.
```

Example:

```text
A = Nhận biết phân số
B = Hai phân số bằng nhau
C = Quy đồng mẫu
D = Cộng hai phân số khác mẫu

A → B → C → D
```

Terminology:

```text
ancestor of C   = prerequisite below C, e.g. A and B
parent of C     = direct prerequisite, e.g. B
descendant of B = successor above B, e.g. C and D
child of B      = direct successor, e.g. C
```

---

### 1.3 Student KC state

For every student and every KC in the assessment scope, the system records a probability:

```text
p_mastery = P(student has mastered this KC | responses so far)
```

This is not a final label. It is the system's current belief.

Example:

```text
KC                                  p_mastery     status
Nhận biết phân số                   0.88          mastered
Hai phân số bằng nhau               0.62          unknown
Quy đồng mẫu                        0.44          unknown
Cộng hai phân số khác mẫu           0.20          not_mastered
```

Recommended MVP status thresholds:

```text
MASTERED_THRESHOLD      = 0.80
NOT_MASTERED_THRESHOLD  = 0.30
MIN_DIRECT_EVIDENCE     = 2
```

Status rules:

```text
mastered      if p_mastery ≥ 0.80 and direct_evidence_count ≥ 2
not_mastered  if p_mastery ≤ 0.30 and direct_evidence_count ≥ 2
unknown       otherwise
```

Why require `direct_evidence_count ≥ 2`?  
Because one MCQ response may be affected by guessing, slipping, misclicks, wording noise, or a bad item.

---

### 1.4 Item

An **item** is one MCQ question attached to a KC.

Each item should have:

```text
item_id
kc_id
difficulty_tag        ∈ {easy, anchor, medium, hard}
is_diagnostic_anchor  boolean
is_active             boolean
```

MVP interpretation:

```text
easy      = prerequisite check / vocabulary / boundary case
anchor    = clean representative diagnostic item for the KC
medium    = normal KC-level item; may also act as anchor if tagged
hard      = more abstract / multi-variable / error-analysis, but still inside the KC + valid prerequisites
```

Important: **hard item must not require non-prerequisite KC knowledge**.

---

## 2. Theoretical interpretation in product terms

This product combines three ideas.

### 2.1 KST-like graph reasoning

Knowledge Space Theory thinks of a student as having a knowledge state: a set of topics/problems they can solve. In our product, the graph helps us reason that:

```text
Correct on a harder KC may provide weak evidence that prerequisites are likely known.
Wrong on a prerequisite KC may provide weak evidence that successors are not ready.
```

But the inference must be **soft**, not hard.

Bad hard rule:

```text
pass C ⇒ definitely mastered A and B
fail A ⇒ definitely not ready for B, C, D
```

MVP rule:

```text
pass C ⇒ increase p_mastery of A and B slightly
fail A ⇒ decrease p_mastery of B, C, D slightly
```

---

### 2.2 BKT-like mastery update

Bayesian Knowledge Tracing models the probability that a student knows a skill and updates that belief after correct/wrong responses.

MVP version:

```text
Each KC has p_mastery.
After every item response, update p_mastery for the item's KC.
Then propagate softly through graph edges.
```

---

### 2.3 IRT/CAT-like item selection

Computerized adaptive testing selects items that are expected to provide useful information about the current student state.

MVP version:

```text
For each candidate KC, choose a usable unseen item.
Predict P(correct) on that item.
Estimate how much uncertainty would reduce if correct vs wrong.
Pick the item with highest score.
```

---

## 3. Key distinction: difficulty vs P(correct)

Do not confuse these.

### 3.1 Item difficulty

Item difficulty is a property of the item.

Example:

```text
Q1: “Phân số a/b có tử là gì?”                  easy
Q2: “Quy đồng 3 phân số có mẫu âm...”           hard
```

---

### 3.2 p_mastery

`p_mastery` is a property of the student-KC pair.

```text
p_mastery(student_1, G6-MATH-QUY-DONG-MAU) = 0.45
```

Meaning:

```text
The system currently believes there is a 45% chance this student has mastered this KC.
```

---

### 3.3 P(correct)

`P(correct)` is a property of this student on this item at this time.

```text
P(correct | student, item, current_state)
```

It depends on:

```text
p_mastery of the KC
item difficulty/quality
slip probability
guess probability
```

Same item, different students ⇒ different P(correct).  
Same student, different items ⇒ different P(correct).

---

## 4. MVP data model

### 4.1 Table: knowledge_components

```text
id                      string primary key
name                    string
chapter_info            string
is_active               boolean
```

Example:

```text
id = G6-MATH-QUY-DONG-MAU
name = Quy đồng mẫu nhiều phân số
chapter_info = B24K2
is_active = true
```

---

### 4.2 Table: kc_edges

Each row represents a prerequisite relation.

```text
prerequisite_kc_id       string
successor_kc_id          string
edge_confidence          float default 1.0
```

Meaning:

```text
prerequisite_kc_id → successor_kc_id
```

`edge_confidence` means how much we trust this prerequisite edge.

MVP default:

```text
edge_confidence = 1.0
```

Future:

```text
learn edge_confidence from real response data
```

---

### 4.3 Table: items

```text
id                       string primary key
kc_id                    string
difficulty_tag           enum: easy | anchor | medium | hard
is_diagnostic_anchor     boolean
is_active                boolean
question_text            text
answers_json             json
```

MVP constraints:

```text
Only active items are usable.
Avoid repeated items in one session.
Prefer unseen items.
```

---

### 4.4 Table: assessment_sessions

```text
id                       string primary key
student_id               string
assessment_target        nullable string
status                   enum: active | completed | abandoned
started_at               timestamp
completed_at             nullable timestamp
max_questions            int default 20
```

`assessment_target` may be:

```text
chapter_id
kc_id
unit_id
full_grade_assessment
```

MVP can start with `assessment_target = topic/chapter`.

---

### 4.5 Table: student_kc_states

One row per session-KC pair.

```text
session_id               string
student_id               string
kc_id                    string
p_mastery                float
status                   enum: mastered | not_mastered | unknown
direct_evidence_count    int
correct_count            int
wrong_count              int
inferred_update_count    int
last_updated_at          timestamp
```

Definitions:

```text
p_mastery
  Current belief that the student has mastered this KC.

status
  Label derived from p_mastery and evidence count.

direct_evidence_count
  Number of items directly answered from this KC.

correct_count / wrong_count
  Direct response counts for this KC.

inferred_update_count
  Number of times this KC was changed through graph propagation.
```

---

### 4.6 Table: response_events

One row per item answer.

```text
id                       string primary key
session_id               string
student_id               string
item_id                  string
kc_id                    string
selected_answer_label    string
is_correct               boolean
p_mastery_before         float
p_mastery_after_direct   float
p_mastery_after_graph    float
p_correct_predicted      float
score_debug_json         json
created_at               timestamp
```

This table is important for future calibration.

---

### 4.7 Table: candidate_score_logs

Optional but strongly recommended for debugging.

Each time the system selects a next item, store the top candidates.

```text
session_id
step_index
candidate_kc_id
candidate_item_id
p_mastery
p_correct
uncertainty
pass_gain
fail_gain
expected_gain
frontier_score
split_prior
item_quality_score
penalty
final_score
selected_boolean
created_at
```

If the adaptive sequence looks weird, this log explains why.

---

## 5. MVP constants

Put all constants in a config file, not hard-coded.

### 5.1 Classification thresholds

```text
MASTERED_THRESHOLD = 0.80
NOT_MASTERED_THRESHOLD = 0.30
MIN_DIRECT_EVIDENCE_FOR_STATUS = 2
```

Reason:

```text
Do not classify after only one MCQ response.
```

---

### 5.2 Initial p_mastery priors

If we know nothing about the student:

```text
DEFAULT_UNKNOWN_PRIOR = 0.50
```

If we know curriculum context:

```text
PRIOR_ALREADY_STUDIED = 0.65
PRIOR_CURRENT_TOPIC   = 0.50
PRIOR_NOT_STUDIED     = 0.25
```

If using graph depth and target node:

```text
ROOT_PRIOR        = 0.65
MIDDLE_PRIOR      = 0.50
ADVANCED_PRIOR    = 0.35
FUTURE_PRIOR      = 0.25
```

MVP recommendation:

```text
If assessment target is known, initialize only relevant subgraph.
Use curriculum prior if available.
Fallback to 0.50.
```

---

### 5.3 Slip and guess priors by difficulty

`slip` means:

```text
Probability student gets the item wrong even if they know the KC.
```

`guess` means:

```text
Probability student gets the item correct even if they do not know the KC.
```

MVP default:

```text
difficulty_tag    slip     guess
easy              0.08     0.30
anchor            0.12     0.25
medium            0.12     0.25
hard              0.20     0.18
```

Why guess is around 0.25:

```text
Most MCQ items have 4 answer choices.
Random guess baseline is 1/4 = 0.25.
```

But use lower guess for hard items because distractors should be more diagnostic.

---

### 5.4 Graph propagation constants

```text
ANCESTOR_BOOST_ON_CORRECT = 0.12
DESCENDANT_DECAY_ON_WRONG = 0.12
DISTANCE_DECAY_BASE       = 0.60
MAX_GRAPH_DELTA_PER_KC    = 0.08
```

Meaning:

```text
Correct on harder KC gives weak positive evidence to ancestors.
Wrong on prerequisite gives weak negative evidence to descendants.
Effect decays with graph distance.
```

Distance decay:

```text
distance = 1  => weight = 0.60¹ = 0.60
distance = 2  => weight = 0.60² = 0.36
distance = 3  => weight = 0.60³ = 0.216
```

---

### 5.5 Score weights

MVP default:

```text
WEIGHT_EXPECTED_GAIN   = 100
WEIGHT_RESPONSE_BALANCE = 30
WEIGHT_FRONTIER         = 30
WEIGHT_SPLIT_PRIOR      = 10
WEIGHT_ITEM_QUALITY     = 10
REPEAT_ITEM_PENALTY     = 10000
NO_ITEM_PENALTY         = 10000
```

The absolute numbers do not matter as much as relative ordering. Start with these, then tune from logs.

---

## 6. Initialize session state

### 6.1 Select assessment scope

The scope is the set of KCs the assessment may reason about.

Examples:

```text
Target = Bài 25 Cộng/trừ phân số
Scope = KCs in Bài 25 + prerequisite ancestors + direct successors if needed
```

MVP rule:

```text
scope_kcs = target_kcs + all_ancestors(target_kcs) + direct_successors(target_kcs)
```

If full diagnostic:

```text
scope_kcs = all active KCs in grade/chapter
```

---

### 6.2 Initialize p_mastery for each KC

Pseudo-code:

```python
def initialize_p_mastery(kc, assessment_context):
    if assessment_context.has_curriculum_position:
        if kc.is_already_studied:
            return 0.65
        if kc.is_current_topic:
            return 0.50
        if kc.is_future_topic:
            return 0.25

    if assessment_context.has_target_kc:
        relative = graph_relation_to_target(kc, target_kc)
        if relative == "root_prerequisite":
            return 0.65
        if relative == "near_target":
            return 0.50
        if relative == "advanced_successor":
            return 0.35

    return 0.50
```

Create one `student_kc_states` row per KC in scope.

---

## 7. Predict P(correct) for an item

### 7.1 Formula

For an item belonging to KC `k`:

```text
p = p_mastery[k]
slip = slip_by_difficulty[item.difficulty_tag]
guess = guess_by_difficulty[item.difficulty_tag]

P(correct) = p · (1 − slip) + (1 − p) · guess
```

Clamp output:

```text
P(correct) = min(max(P(correct), 0.05), 0.95)
```

Reason for clamp:

```text
MVP priors are not calibrated. Do not allow 0% or 100% certainty.
```

---

### 7.2 Example

Student state:

```text
p_mastery[Quy đồng mẫu] = 0.50
```

Candidate item:

```text
difficulty_tag = anchor
slip = 0.12
guess = 0.25
```

Then:

```text
P(correct) = 0.50 · 0.88 + 0.50 · 0.25
           = 0.44 + 0.125
           = 0.565
```

Meaning:

```text
The system predicts this student has a 56.5% chance of answering this item correctly.
```

---

## 8. Uncertainty function

The system needs to know which KC states are uncertain.

Use:

```text
uncertainty(p) = 4p(1 − p)
```

Examples:

```text
p = 0.50 → uncertainty = 1.00
p = 0.80 → uncertainty = 0.64
p = 0.95 → uncertainty = 0.19
p = 0.05 → uncertainty = 0.19
```

Interpretation:

```text
p around 0.5  = system is very unsure
p near 0 or 1 = system is more sure
```

This is not formal entropy, but it is easy and good enough for MVP.

---

## 9. Candidate generation

### 9.1 Candidate KC filter

A KC can be considered if:

```text
1. KC is active.
2. KC is in assessment scope.
3. KC status is unknown, or it needs confirmation.
4. KC has at least one active unseen item.
5. KC is not blocked by a definitely not-mastered direct prerequisite, unless we are intentionally diagnosing that prerequisite area.
```

MVP pseudo-code:

```python
def is_candidate_kc(kc, session):
    state = get_state(kc)

    if not kc.is_active:
        return False

    if state.status in ["mastered", "not_mastered"] and state.direct_evidence_count >= 2:
        return False

    if count_unseen_active_items(kc, session) == 0:
        return False

    # Avoid testing far successors if prerequisite is clearly not mastered
    for parent in direct_prerequisites(kc):
        parent_state = get_state(parent)
        if parent_state.status == "not_mastered":
            return False

    return True
```

Important exception:

```text
If the assessment goal is to verify a suspected gap boundary, the system may test a direct prerequisite of a not-mastered node.
```

---

### 9.2 Candidate item selection inside each KC

For each candidate KC, choose one best candidate item for scoring.

MVP rule:

```text
If direct_evidence_count == 0:
  prefer diagnostic anchor item.

If p_mastery is around 0.4–0.7:
  prefer anchor/medium item.

If p_mastery is high but not confirmed:
  prefer medium/hard item to confirm.

If p_mastery is low but not confirmed:
  prefer easy/anchor item to check prerequisite understanding.
```

Pseudo-code:

```python
def choose_representative_item(kc, state, session):
    items = unseen_active_items(kc, session)

    if state.direct_evidence_count == 0:
        return first_by_priority(items, ["anchor", "medium", "easy", "hard"])

    if 0.40 <= state.p_mastery <= 0.70:
        return first_by_priority(items, ["anchor", "medium", "easy", "hard"])

    if state.p_mastery > 0.70:
        return first_by_priority(items, ["medium", "hard", "anchor", "easy"])

    if state.p_mastery < 0.40:
        return first_by_priority(items, ["easy", "anchor", "medium", "hard"])
```

---

## 10. Compute gain_if_correct and gain_if_wrong

### 10.1 Correct response gain

If the student answers correctly on KC `k`, this provides evidence for:

```text
1. KC k itself
2. ancestors/prerequisites of k, because doing k may imply some prerequisites
```

MVP formula:

```text
gain_if_correct = uncertainty(k) + ancestor_gain
```

Where:

```text
ancestor_gain = Σ over unknown ancestors a:
  uncertainty(a)
  · edge_confidence_path(a → k)
  · distance_decay(distance(a, k))
```

Use:

```text
distance_decay(distance) = DISTANCE_DECAY_BASE ^ distance
```

Example:

```text
A → B → C
```

If testing C:

```text
ancestor A distance = 2
ancestor B distance = 1
```

---

### 10.2 Wrong response gain

If the student answers wrongly on KC `k`, this provides evidence for:

```text
1. KC k itself
2. descendants/successors of k, because successors may not be ready
```

MVP formula:

```text
gain_if_wrong = uncertainty(k) + descendant_gain
```

Where:

```text
descendant_gain = Σ over unknown descendants d:
  uncertainty(d)
  · edge_confidence_path(k → d)
  · distance_decay(distance(k, d))
```

---

### 10.3 Why use uncertainty, not raw count?

Suppose a descendant already has:

```text
p_mastery = 0.05
```

The system already strongly believes the student has not mastered it. Reducing it more gives little value.

Suppose another descendant has:

```text
p_mastery = 0.50
```

The system is very unsure. Evidence about it is valuable.

So gain should be weighted by uncertainty, not just number of nodes.

---

## 11. Expected gain

For candidate item `i` in KC `k`:

```text
p_correct = P(correct | student, item i)
p_wrong = 1 − p_correct

expected_gain = p_correct · gain_if_correct + p_wrong · gain_if_wrong
```

Example:

```text
p_correct = 0.60
gain_if_correct = 5
gain_if_wrong = 8

expected_gain = 0.60·5 + 0.40·8
              = 3 + 3.2
              = 6.2
```

---

## 12. Response balance

A candidate is usually more informative when both correct and wrong are plausible.

Use:

```text
response_balance = 4 · p_correct · (1 − p_correct)
```

Examples:

```text
p_correct = 0.50 → response_balance = 1.00
p_correct = 0.90 → response_balance = 0.36
p_correct = 0.10 → response_balance = 0.36
p_correct = 0.98 → response_balance = 0.0784
```

Interpretation:

```text
A question that is almost certainly correct or almost certainly wrong often provides less information.
```

This is not always true, but it is a good MVP heuristic.

---

## 13. Frontier score

### 13.1 Why frontier matters

Do not ask random uncertain KCs anywhere in graph.

The best KCs are usually near the boundary between:

```text
known prerequisites | uncertain current skills | not-ready successors
```

---

### 13.2 MVP frontier definitions

For KC `k`:

```text
all_direct_prerequisites_mastered:
  every direct parent of k has status mastered

has_unknown_parent:
  at least one direct parent is unknown

has_not_mastered_child:
  at least one direct child has status not_mastered

has_mastered_parent:
  at least one direct parent has status mastered

has_unknown_child:
  at least one direct child is unknown
```

---

### 13.3 Frontier score formula

```text
frontier_score = 0

if all_direct_prerequisites_mastered and status(k) == unknown:
    frontier_score = max(frontier_score, 1.0)

if has_mastered_parent and status(k) == unknown:
    frontier_score = max(frontier_score, 0.7)

if has_not_mastered_child and status(k) == unknown:
    frontier_score = max(frontier_score, 0.7)

if has_unknown_parent and has_unknown_child:
    frontier_score = max(frontier_score, 0.5)
```

Interpretation:

```text
1.0 = natural next KC after mastered prerequisites
0.7 = near boundary
0.5 = structurally useful but less clearly positioned
0.0 = not near current boundary
```

---

## 14. Split prior

Split prior gives a small structural preference to nodes in the middle of the graph.

Do **not** use raw split score as the main objective.

MVP formula:

```text
unknown_ancestor_count = number of unknown ancestors of k
unknown_descendant_count = number of unknown descendants of k

split_prior = log(1 + min(unknown_ancestor_count + 1, unknown_descendant_count + 1))
```

Why `min`?

```text
A good split node has useful information on both pass and wrong outcomes.
Root has many descendants but no ancestors.
Leaf has many ancestors but no descendants.
```

Why `log`?

```text
Avoid giving huge advantage to large graph branches.
```

---

## 15. Item quality score

MVP formula:

```text
item_quality_score = 0

if item.is_diagnostic_anchor:
    item_quality_score += 1.0

if item.difficulty_tag == "anchor":
    item_quality_score += 0.8
elif item.difficulty_tag == "medium":
    item_quality_score += 0.6
elif item.difficulty_tag == "easy":
    item_quality_score += 0.4
elif item.difficulty_tag == "hard":
    item_quality_score += 0.4
```

Important:

```text
Item quality should not dominate node selection.
It is a tie-breaker / reliability adjustment.
```

---

## 16. Final MVP score

For candidate `(kc, item)`:

```text
score =
  WEIGHT_EXPECTED_GAIN    · expected_gain
  + WEIGHT_RESPONSE_BALANCE · response_balance
  + WEIGHT_FRONTIER       · frontier_score
  + WEIGHT_SPLIT_PRIOR    · split_prior
  + WEIGHT_ITEM_QUALITY   · item_quality_score
  − penalties
```

Default weights:

```text
WEIGHT_EXPECTED_GAIN      = 100
WEIGHT_RESPONSE_BALANCE   = 30
WEIGHT_FRONTIER           = 30
WEIGHT_SPLIT_PRIOR        = 10
WEIGHT_ITEM_QUALITY       = 10
```

Penalties:

```text
if no usable unseen item:
    penalty += 10000

if item already seen in session:
    penalty += 10000

if KC has been tested too many times in session:
    penalty += 20 · times_tested_for_kc
```

Select:

```text
candidate with highest score
```

---

## 17. Full selection pseudo-code

```python
def select_next_item(session_id):
    session = get_session(session_id)
    states = get_student_kc_states(session_id)
    scope_kcs = get_scope_kcs(session)

    candidates = []

    for kc in scope_kcs:
        if not is_candidate_kc(kc, session):
            continue

        state = states[kc.id]
        item = choose_representative_item(kc, state, session)

        if item is None:
            continue

        p_correct = predict_p_correct(state.p_mastery, item.difficulty_tag)
        p_wrong = 1 - p_correct

        gain_correct = compute_gain_if_correct(kc, states)
        gain_wrong = compute_gain_if_wrong(kc, states)

        expected_gain = p_correct * gain_correct + p_wrong * gain_wrong
        response_balance = 4 * p_correct * p_wrong
        frontier = compute_frontier_score(kc, states)
        split = compute_split_prior(kc, states)
        item_quality = compute_item_quality_score(item)
        penalty = compute_penalties(kc, item, session)

        score = (
            100 * expected_gain
            + 30 * response_balance
            + 30 * frontier
            + 10 * split
            + 10 * item_quality
            - penalty
        )

        candidates.append({
            "kc": kc,
            "item": item,
            "score": score,
            "p_correct": p_correct,
            "gain_correct": gain_correct,
            "gain_wrong": gain_wrong,
            "expected_gain": expected_gain,
            "response_balance": response_balance,
            "frontier": frontier,
            "split": split,
            "item_quality": item_quality,
            "penalty": penalty,
        })

    log_candidate_scores(session_id, candidates)

    if len(candidates) == 0:
        return finish_or_fallback(session_id)

    selected = max(candidates, key=lambda c: c["score"])
    return selected["item"]
```

---

## 18. Update after response

### 18.1 Direct update for answered KC

Let:

```text
p = p_mastery before response
slip = slip_by_difficulty[item.difficulty_tag]
guess = guess_by_difficulty[item.difficulty_tag]
p_correct = p · (1 − slip) + (1 − p) · guess
```

If response is correct:

```text
posterior = p · (1 − slip) / p_correct
```

If response is wrong:

```text
p_wrong = 1 − p_correct
posterior = p · slip / p_wrong
```

Because MVP item parameters are not calibrated, cap the update.

```text
MAX_DIRECT_DELTA = 0.25
```

```python
def capped_update(old_p, raw_posterior):
    delta = raw_posterior - old_p
    if delta > MAX_DIRECT_DELTA:
        delta = MAX_DIRECT_DELTA
    if delta < -MAX_DIRECT_DELTA:
        delta = -MAX_DIRECT_DELTA
    return clamp(old_p + delta, 0.02, 0.98)
```

---

### 18.2 Example direct update

Before:

```text
p = 0.50
item = anchor
slip = 0.12
guess = 0.25
```

Predict:

```text
p_correct = 0.50·0.88 + 0.50·0.25 = 0.565
```

If correct:

```text
raw_posterior = 0.50·0.88 / 0.565 = 0.779
```

Without cap:

```text
0.50 → 0.779
```

With cap 0.25:

```text
0.50 → 0.75
```

If wrong:

```text
p_wrong = 0.435
raw_posterior = 0.50·0.12 / 0.435 = 0.138
```

With cap 0.25:

```text
0.50 → 0.25
```

---

### 18.3 Graph propagation after correct response

If student answers KC `k` correctly:

```text
Increase ancestors of k softly.
Do not strongly update descendants.
```

Formula for each ancestor `a`:

```text
boost = ANCESTOR_BOOST_ON_CORRECT
        · edge_confidence_path(a → k)
        · distance_decay(distance(a, k))
        · (1 − p_mastery[a])

boost = min(boost, MAX_GRAPH_DELTA_PER_KC)

p_mastery[a] = p_mastery[a] + boost
```

Reason:

```text
Correct on a harder KC is weak evidence that prerequisites are known.
But because of guess/slip and item noise, do not hard-close ancestors.
```

---

### 18.4 Graph propagation after wrong response

If student answers KC `k` incorrectly:

```text
Decrease descendants of k softly.
Do not strongly decrease ancestors.
```

Formula for each descendant `d`:

```text
decay = DESCENDANT_DECAY_ON_WRONG
        · edge_confidence_path(k → d)
        · distance_decay(distance(k, d))
        · p_mastery[d]

decay = min(decay, MAX_GRAPH_DELTA_PER_KC)

p_mastery[d] = p_mastery[d] − decay
```

Reason:

```text
Wrong on a prerequisite means successors may not be ready.
But a wrong answer on k does not prove all successors are impossible.
```

---

### 18.5 Should wrong on a hard node decrease ancestors?

MVP answer: **no, or only extremely weakly**.

Reason:

```text
If student fails C, the gap could be in C itself.
It does not necessarily mean A or B is unknown.
```

Instead of decreasing ancestors, the next item selector should naturally choose a prerequisite check if needed.

---

### 18.6 Update status

After direct and graph updates, recompute status for all affected KCs.

```python
def recompute_status(state):
    if state.direct_evidence_count >= MIN_DIRECT_EVIDENCE_FOR_STATUS:
        if state.p_mastery >= MASTERED_THRESHOLD:
            return "mastered"
        if state.p_mastery <= NOT_MASTERED_THRESHOLD:
            return "not_mastered"
    return "unknown"
```

Important:

```text
Do not mark status mastered/not_mastered based on inferred graph updates alone.
Require direct evidence for final status, or label as inferred only.
```

Optional extension:

```text
Add status_confidence_source = direct | inferred | mixed
```

---

## 19. Full response update pseudo-code

```python
def record_response(session_id, item_id, selected_answer):
    item = get_item(item_id)
    kc = get_kc(item.kc_id)
    is_correct = check_answer(item, selected_answer)

    state = get_student_kc_state(session_id, kc.id)
    p_before = state.p_mastery

    slip = slip_for(item.difficulty_tag)
    guess = guess_for(item.difficulty_tag)
    p_correct = p_before * (1 - slip) + (1 - p_before) * guess
    p_correct = clamp(p_correct, 0.05, 0.95)

    if is_correct:
        raw_posterior = p_before * (1 - slip) / p_correct
    else:
        p_wrong = 1 - p_correct
        raw_posterior = p_before * slip / p_wrong

    p_after_direct = capped_update(p_before, raw_posterior)

    state.p_mastery = p_after_direct
    state.direct_evidence_count += 1
    if is_correct:
        state.correct_count += 1
    else:
        state.wrong_count += 1

    save_state(state)

    if is_correct:
        propagate_correct_to_ancestors(session_id, kc.id)
    else:
        propagate_wrong_to_descendants(session_id, kc.id)

    recompute_status_for_affected_kcs(session_id)

    create_response_event(
        session_id=session_id,
        item_id=item_id,
        kc_id=kc.id,
        selected_answer_label=selected_answer,
        is_correct=is_correct,
        p_mastery_before=p_before,
        p_mastery_after_direct=p_after_direct,
        p_correct_predicted=p_correct,
    )
```

---

## 20. Cold-start strategy

When no response data exists for the student, do not pretend to know the student. Use priors.

### 20.1 If target is known

Example target:

```text
Cộng hai phân số khác mẫu
```

Path:

```text
Nhận biết phân số → Hai phân số bằng nhau → Quy đồng mẫu → Cộng khác mẫu
```

Cold-start first item:

```text
Choose a middle/frontier KC on the prerequisite path.
Prefer anchor item.
```

Example:

```text
First ask: Quy đồng mẫu anchor item
```

If correct:

```text
Move upward toward target / confirm target.
```

If wrong:

```text
Move downward to prerequisite.
```

---

### 20.2 If target is unknown/full diagnostic

Use a small seed phase.

MVP seed phase:

```text
Ask 3–5 anchor items spread across important graph regions.
```

Example for fraction unit:

```text
1. Nhận biết phân số
2. Hai phân số bằng nhau
3. Quy đồng mẫu
4. Cộng/trừ phân số
5. Nhân/chia phân số
```

After seed phase, use the adaptive scoring formula.

---

### 20.3 Why not ask root first?

Root nodes often have many descendants, but if they are too easy, a correct answer gives little new information.

Bad:

```text
Always ask root because root has many descendants.
```

Better:

```text
Ask the node whose correct/wrong outcomes are both useful, usually near the current frontier.
```

---

## 21. Session stopping rules

Stop assessment if any condition is met:

```text
1. session.question_count >= max_questions
2. target KCs are resolved with enough evidence
3. no candidate items remain
4. confidence coverage is high enough
```

MVP confidence coverage:

```text
resolved_count = count KCs with status mastered or not_mastered
coverage = resolved_count / total_scope_kcs

Stop if coverage >= 0.80 and question_count >= minimum_questions
```

Recommended:

```text
minimum_questions = 8
max_questions = 20
```

For short diagnostic:

```text
minimum_questions = 5
max_questions = 12
```

---

## 22. Output of assessment

The system should return four lists.

### 22.1 Mastered

```text
KCs with status = mastered
```

Example:

```text
Nhận biết phân số
Hai phân số bằng nhau
```

---

### 22.2 Gaps

```text
KCs with status = not_mastered
```

Example:

```text
Quy đồng mẫu nhiều phân số
```

---

### 22.3 Ready to learn

A KC is ready to learn if:

```text
status(k) == unknown or not_mastered
and all direct prerequisites are mastered
```

Example:

```text
If A and B mastered but C not mastered,
C is ready_to_learn.
```

---

### 22.4 Uncertain / needs more evidence

```text
KCs where status remains unknown
```

The UI should avoid pretending these are known.

---

## 23. Worked example

Graph:

```text
A = Nhận biết phân số
B = Hai phân số bằng nhau
C = Quy đồng mẫu
D = Cộng hai phân số khác mẫu

A → B → C → D
```

Initial state:

```text
A = 0.65
B = 0.50
C = 0.45
D = 0.35
```

### Step 1: select first item

A is probably too easy. D may be too advanced. B/C are around boundary.

System selects C anchor item.

```text
p_mastery[C] = 0.45
item = anchor
slip = 0.12
guess = 0.25

P(correct) = 0.45·0.88 + 0.55·0.25
           = 0.396 + 0.1375
           = 0.5335
```

Both correct and wrong are plausible, so this item is informative.

### Step 2: student answers wrong

Direct update C downward.

Suppose capped posterior:

```text
C: 0.45 → 0.25
```

Graph propagation to descendant D:

```text
D: 0.35 → 0.32
```

Now:

```text
A = 0.65
B = 0.50
C = 0.25
D = 0.32
```

### Step 3: next item

System should not ask D yet because C is weak.  
System should ask B to locate the prerequisite gap.

Student answers B correctly.

```text
B: 0.50 → 0.75
A: 0.65 → 0.70  # small ancestor boost
```

Now:

```text
A = 0.70
B = 0.75
C = 0.25
D = 0.32
```

Interpretation:

```text
Student likely knows A/B.
Main gap likely starts at C = Quy đồng mẫu.
D is not ready because C is prerequisite.
```

This is a good adaptive outcome.

---

## 24. What MVP should not do

Do not do these in v1:

```text
1. Do not hard-close all ancestors/descendants after one response.
2. Do not let raw descendant count dominate scoring.
3. Do not classify mastery from one MCQ.
4. Do not treat P(correct) as item difficulty.
5. Do not assume generated item difficulty tags are perfectly calibrated.
6. Do not ask far successors when prerequisites are already likely missing.
7. Do not use item_count/anchor_count as main utility; use them as constraints/tie-breakers.
```

---

## 25. MVP implementation checklist

### 25.1 Must have

```text
[ ] KC graph table
[ ] item table with difficulty_tag and is_diagnostic_anchor
[ ] assessment session table
[ ] student_kc_states table
[ ] response_events table
[ ] select_next_item function
[ ] predict_p_correct function
[ ] update_after_response function
[ ] graph propagation functions
[ ] candidate score debug logs
[ ] assessment result generation
```

---

### 25.2 Must log for every selected item

```text
selected_kc
selected_item
p_mastery before
p_correct predicted
gain_if_correct
gain_if_wrong
expected_gain
frontier_score
split_prior
item_quality_score
final_score
```

This is required. Without this, the team cannot debug why the algorithm selected a weird item.

---

## 26. Future development roadmap

### 26.1 v1.0 — MVP prior-based adaptive assessment

Current document.

Features:

```text
expert priors
simple p_mastery per KC
difficulty-tag slip/guess
expected_gain scoring
soft graph propagation
debug logs
```

Goal:

```text
Functional adaptive assessment that behaves sensibly before real data.
```

---

### 26.2 v1.1 — item quality analytics

After collecting real responses, compute item-level analytics:

```text
attempt_count
correct_rate
option_distribution
high_mastery_wrong_rate
low_mastery_correct_rate
avg_time_spent
skip_rate
```

Use these to flag bad items:

```text
high_mastery_wrong_rate high  ⇒ item may be confusing / too hard / mis-tagged
low_mastery_correct_rate high ⇒ item may be too guessable / too easy
one distractor never chosen    ⇒ distractor weak
```

---

### 26.3 v1.2 — learned item priors

Replace static difficulty priors with learned estimates.

Instead of:

```text
anchor slip = 0.12, guess = 0.25
```

Use:

```text
item_slip[item_id]
item_guess[item_id]
```

Smooth with priors so small data does not overfit:

```text
item_slip = weighted_average(default_slip, observed_slip_estimate, data_weight)
```

---

### 26.4 v2.0 — calibrated BKT per KC

Learn BKT parameters per KC:

```text
prior_mastery[kc]
learn_rate[kc]
slip[kc]
guess[kc]
```

This allows better personalized mastery tracking.

---

### 26.5 v2.1 — IRT-style item calibration

For each item, learn:

```text
difficulty
possibly discrimination
guessing parameter
```

Then:

```text
P(correct | student, item)
```

comes from calibrated item response model, not only heuristic difficulty tags.

---

### 26.6 v2.2 — edge confidence learning

Use data to learn whether graph edges are valid.

Questions:

```text
If student fails A, do they usually fail B?
If student passes B, do they usually pass A?
Does A really predict B?
```

Update:

```text
edge_confidence[A → B]
```

Weak edges should propagate less.

---

### 26.7 v3.0 — full CD-CAT / information-theoretic selection

Replace MVP `uncertainty(p) = 4p(1−p)` and expected_gain approximation with formal expected posterior uncertainty reduction.

Conceptually:

```text
H_before = total uncertainty over all KCs
H_after = P(correct)·H(state_if_correct) + P(wrong)·H(state_if_wrong)
score = H_before − H_after
```

This is more theoretically correct but more complex.

---

### 26.8 v3.1 — knowledge-state posterior

Instead of independent p_mastery per KC, maintain probabilities over possible knowledge states.

Example:

```text
State 1: {A}
State 2: {A, B}
State 3: {A, B, C}
State 4: {A, B, C, D}
```

Select items that best distinguish plausible states.

This is closer to Knowledge Space Theory, but it is much heavier than MVP.

---

## 27. Recommended engineering sequence

Build in this order:

```text
1. Data tables and graph traversal helpers
2. Session initialization and p_mastery priors
3. Item selection without graph propagation
4. Direct p_mastery update after response
5. Soft graph propagation
6. Debug score logs
7. Assessment result output
8. Simulation tests
9. Real student data collection
10. Calibration layer
```

Do not start with full IRT/CD-CAT. It will slow the team down before basic product behavior is validated.

---

## 28. Simulation tests before launch

Create fake student profiles.

### 28.1 Student profile: strong student

```text
True mastered: most KCs
Expected behavior:
- algorithm moves upward quickly
- does not waste many questions on roots
- final result mostly mastered
```

### 28.2 Student profile: weak prerequisite gap

```text
True mastered: A only
True not mastered: B, C, D
Expected behavior:
- algorithm finds B/C gap
- stops asking advanced descendants after detecting prerequisite gap
```

### 28.3 Student profile: uneven mastery

```text
True mastered: A, B, D but not C
Expected behavior:
- algorithm should notice inconsistency
- requires more evidence
- should not hard-close based on graph only
```

### 28.4 Noisy response profile

```text
Student sometimes guesses/slips.
Expected behavior:
- algorithm does not overreact to one response
- requires repeated evidence before final classification
```

---

## 29. Final product principle

The adaptive system should behave like this:

```text
Start with imperfect priors.
Ask a question near the likely boundary.
Update belief after the response.
Propagate softly through the graph.
Ask the next question that reduces uncertainty most.
Stop when enough important KCs are resolved.
```

The MVP does not need to be psychometrically perfect. It needs to be:

```text
reasonable
stable
debuggable
not biased toward root nodes
not overconfident after one MCQ
able to improve as real data arrives
```

---

## 30. Source notes for theory

This design is inspired by:

```text
- Corbett & Anderson — Bayesian Knowledge Tracing / cognitive tutor student modeling.
- Knowledge Space Theory / ALEKS — knowledge states and adaptive assessment over prerequisite-like structures.
- IRT/CAT literature — selecting items based on expected information about the current learner state.
- Cognitive Diagnostic CAT literature — diagnosing mastery profiles over multiple attributes/KCs instead of only one ability score.
```

The MVP intentionally simplifies these theories into a practical engineering algorithm. Future versions can replace priors and heuristics with learned/calibrated parameters.
