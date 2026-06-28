# Assessment V2 G6 Algebra Deterministic Report

No AI persona was used. This run uses the graph snapshot at `/tmp/g6_kc_graph.json` and the V2 review item JSON fixture.

## Scope and Item Readiness

- G6 graph snapshot: 151 nodes, 154 prerequisite edges.
- Proposed algebra scope: 59 nodes.
- Review-required/mixed scope: 46 nodes.
- Geometry deferred: 46 nodes.
- Algebra V2 items: 93 total, 79 ready, 14 blocked.
- Ready item coverage: 59 KCs have at least 1 ready item; 17 KCs have at least 2 ready items.

### Blocked Item Reasons

- needs_widget_checker: 9
- replace_required: 5

### Risk Tags

- binary_disguised: 3
- expression_parser_widget: 7
- fragile_text_grader: 2
- mcq_disguised: 2
- needs_widget_checker: 9
- ordered_list_widget: 2
- reasoning_hard_to_auto_grade: 1

## Simulation Results

| Mode | Cap | Persona | Q | Tested KCs | Tested Mastered | Tested Gap | Inferred Mastered | Inferred Gap | Unknown | Precision | Recall | Duplicate Items |
|---|---:|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| strict_current_review | 30 | mastered_all | 30 | 30 | 30 | 0 | 4 | 0 | 25 | N/A | N/A | 0 |
| strict_current_review | 30 | careless_mastered | 30 | 30 | 20 | 10 | 2 | 12 | 15 | 0.00 | N/A | 0 |
| strict_current_review | 30 | fraction_gap | 30 | 30 | 21 | 9 | 0 | 16 | 13 | 0.72 | 1.00 | 0 |
| strict_current_review | 30 | integer_gap | 30 | 30 | 18 | 9 | 0 | 8 | 24 | 0.35 | 0.67 | 0 |
| strict_current_review | 30 | foundation_gap | 30 | 30 | 20 | 10 | 0 | 14 | 15 | 0.96 | 0.85 | 0 |
| strict_current_review | 30 | random_guesser | 30 | 30 | 1 | 29 | 0 | 27 | 2 | 1.00 | 0.95 | 0 |
| strict_current_review | 35 | mastered_all | 35 | 35 | 35 | 0 | 4 | 0 | 20 | N/A | N/A | 0 |
| strict_current_review | 35 | careless_mastered | 35 | 35 | 27 | 8 | 3 | 9 | 12 | 0.00 | N/A | 0 |
| strict_current_review | 35 | fraction_gap | 35 | 35 | 25 | 10 | 0 | 8 | 16 | 0.94 | 0.94 | 0 |
| strict_current_review | 35 | integer_gap | 35 | 35 | 25 | 10 | 0 | 8 | 16 | 0.39 | 0.78 | 0 |
| strict_current_review | 35 | foundation_gap | 35 | 35 | 21 | 14 | 0 | 10 | 14 | 0.96 | 0.85 | 0 |
| strict_current_review | 35 | random_guesser | 35 | 35 | 0 | 35 | 0 | 24 | 0 | 1.00 | 1.00 | 0 |
| provisional_ready | 30 | mastered_all | 30 | 30 | 30 | 0 | 6 | 0 | 23 | N/A | N/A | 0 |
| provisional_ready | 30 | careless_mastered | 30 | 30 | 24 | 6 | 3 | 10 | 16 | 0.00 | N/A | 0 |
| provisional_ready | 30 | fraction_gap | 30 | 30 | 21 | 8 | 0 | 14 | 16 | 0.73 | 0.89 | 0 |
| provisional_ready | 30 | integer_gap | 30 | 30 | 21 | 9 | 1 | 11 | 17 | 0.40 | 0.89 | 0 |
| provisional_ready | 30 | foundation_gap | 30 | 30 | 19 | 10 | 0 | 14 | 16 | 0.88 | 0.78 | 0 |
| provisional_ready | 30 | random_guesser | 30 | 30 | 1 | 29 | 0 | 28 | 1 | 1.00 | 0.97 | 0 |
| provisional_ready | 35 | mastered_all | 35 | 35 | 35 | 0 | 6 | 0 | 18 | N/A | N/A | 0 |
| provisional_ready | 35 | careless_mastered | 35 | 35 | 26 | 9 | 3 | 11 | 10 | 0.00 | N/A | 0 |
| provisional_ready | 35 | fraction_gap | 35 | 35 | 24 | 10 | 0 | 11 | 14 | 0.81 | 0.94 | 0 |
| provisional_ready | 35 | integer_gap | 35 | 35 | 25 | 10 | 0 | 13 | 11 | 0.30 | 0.78 | 0 |
| provisional_ready | 35 | foundation_gap | 35 | 35 | 19 | 16 | 0 | 18 | 6 | 0.74 | 0.93 | 0 |
| provisional_ready | 35 | random_guesser | 35 | 35 | 3 | 31 | 0 | 24 | 1 | 1.00 | 0.93 | 0 |

### Probability Bands At 35 Questions

| Mode | Persona | Strong Gap | Likely Gap | Uncertain | Likely Mastered | Strong Mastered |
|---|---|---:|---:|---:|---:|---:|
| strict_current_review | mastered_all | 0 | 0 | 16 | 4 | 39 |
| strict_current_review | careless_mastered | 9 | 8 | 9 | 4 | 29 |
| strict_current_review | fraction_gap | 13 | 5 | 16 | 0 | 25 |
| strict_current_review | integer_gap | 11 | 7 | 16 | 0 | 25 |
| strict_current_review | foundation_gap | 18 | 6 | 14 | 0 | 21 |
| strict_current_review | random_guesser | 49 | 10 | 0 | 0 | 0 |
| provisional_ready | mastered_all | 0 | 0 | 14 | 4 | 41 |
| provisional_ready | careless_mastered | 10 | 10 | 10 | 0 | 29 |
| provisional_ready | fraction_gap | 14 | 8 | 12 | 1 | 24 |
| provisional_ready | integer_gap | 19 | 4 | 11 | 0 | 25 |
| provisional_ready | foundation_gap | 22 | 12 | 6 | 0 | 19 |
| provisional_ready | random_guesser | 44 | 12 | 0 | 0 | 3 |

## Interpretation

- The supplemental fixture now gives every proposed algebra KC at least one ready, auto-gradable V2 item, so the assessment can use the full 30-35 question breadth without repeating KCs early.
- Assessment-mode direct evidence now uses a BKT-style posterior with item slip/guess parameters. Open-ended wrong answers are strong evidence from a cold prior because guessing probability is low; MCQ answers remain less discriminating because guessing probability is higher.
- Graph propagation uses the actual posterior delta and decays by graph distance. This improves gap recall substantially, but it also creates false-gap risk when a mastered student makes careless mistakes early in the assessment.
- The `mastered_all` persona is a clean no-slip baseline. The `careless_mastered` persona is the stress test for tolerance and should be used to tune slip, thresholds, and confirmation policy.
- Provisional-ready mode shows possible graph closure after academic approval of selected strong items, but it is not production approval.

## Recommended Next Step

1. Academic team should review the 40 Codex supplemental items and either approve, revise, or reject them.
2. Add a student-facing `I don't know` control; that response remains a strong gap signal distinct from a normal wrong answer.
3. Add second-family confirmation items for high-closure KCs where false gaps from careless mistakes are costly.

## Example Trace: Provisional Ready, 35 Questions, Fraction Gap

| Step | Item | KC | Cluster | Correct |
|---:|---|---|---|---|
| 1 | v2-019 | G6-MATH-NHAN-BIET-DOC | Integers & Order | True |
| 2 | v2-086 | G6-MATH-NHAN-BIET-PHAN-1 | Fractions Equivalence và Operations | False |
| 3 | v2-064 | G6-MATH-NHAN-HAI-SO | Integers & Order | True |
| 4 | v2-077 | G6-MATH-NHAN-HAI-SO-1 | Integers & Order | True |
| 5 | v2-005 | G6-MATH-CONG-HAI-PHAN-1 | Fractions Equivalence và Operations | False |
| 6 | v2-099 | G6-MATH-NHAN-BIET-MO-1 | Number Foundations & Divisibility | True |
| 7 | v2-010 | G6-MATH-B31K2 | Decimals, Percent, Ratio | True |
| 8 | v2-085 | G6-MATH-NHAN-BIET-CAU | Expressions & Order of Operations | True |
| 9 | v2-098 | G6-MATH-NHAN-HAI-PHAN | Fractions Equivalence và Operations | False |
| 10 | v2-089 | G6-MAMATMATHMAT | Fractions Equivalence và Operations | False |
| 11 | v2-006 | G6-MATH-PHAN-SO-NGHICH | Fractions Equivalence và Operations | False |
| 12 | v2-008 | G6-MATH-NHAN-BIET-VA | Decimals, Percent, Ratio | True |
| 13 | v2-072 | G6-MATH-SO-SANH-HAI-1 | Fractions Equivalence và Operations | False |
| 14 | v2-097 | G6-MATH-NHAN-BIET-DU | Data / Statistics / Probability, Non-Visual | True |
| 15 | v2-028 | G6-MATH-TINH-XAC-SUAT | Data / Statistics / Probability, Non-Visual | True |
| 16 | v2-020 | G6-MATH-NHAN-BIET-SO-1 | Integers & Order | True |
| 17 | v2-003 | G6-MATH-TINH-CHAT-CO | Fractions Equivalence và Operations | False |
| 18 | v2-007 | G6-MATH-CHIA-HAI-PHAN | Fractions Equivalence và Operations | False |
| 19 | v2-079 | G6-MATH-THUC-HIEN-PHEP | Integers & Order | True |
| 20 | v2-013 | G6-MATH-AP-DUNG-DUNG | Expressions & Order of Operations | True |
| 21 | v2-100 | G6-MATH-TIM-UOC-VA | Number Foundations & Divisibility | True |
| 22 | v2-021 | G6-MATH-CONG-HAI-SO-1 | Integers & Order | True |
| 23 | v2-065 | G6-MATH-SO-SANH-HAI-5 | Integers & Order | True |
| 24 | v2-061 | G6-MATH-PHAN-TICH-RA | Number Foundations & Divisibility | True |
| 25 | v2-027 | G6-MATH-DOC-VA-PHAN | Data / Statistics / Probability, Non-Visual | True |
| 26 | v2-024 | G6-MATH-TIM-BCNN | Number Foundations & Divisibility | True |
| 27 | v2-076 | G6-MATH-TU-CHO-SO | Integers & Order | False |
| 28 | v2-070 | G6-MATH-CONG-HAI-SO | Integers & Order | True |
| 29 | v2-093 | G6-MATH-CHIA-SO-THAP | Decimals, Percent, Ratio | False |
| 30 | v2-092 | G6-MATH-SO-SANH-HAI-2 | Decimals, Percent, Ratio | True |
| 31 | v2-009 | G6-MATH-NHAN-SO-THAP | Decimals, Percent, Ratio | True |
| 32 | v2-082 | G6-MATH-CHON-PHUONG-PHAP | Data / Statistics / Probability, Non-Visual | True |
| 33 | v2-090 | G6-MATH-CONG-TRU-SO | Decimals, Percent, Ratio | True |
| 34 | v2-084 | G6-MATH-QUY-DONG-PHAN | Fractions Equivalence và Operations | False |
| 35 | v2-014 | G6-MATH-AP-DUNG-DUNG-1 | Expressions & Order of Operations | True |
