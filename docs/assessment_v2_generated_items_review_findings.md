# Assessment V2 Generated Items — Review Findings

Source: `/Users/admin/Downloads/assessment_v2_generated_items_academic_review.md` plus Codex supplemental local fixtures.

## Executive Summary

- Draft items available in UI: **60**
- Original AI draft items: **29**
- Codex self-added supplemental items: **31**
- Gap records parsed: **2**
- Runtime assessment cap remains **30-35 questions per student**, but the item bank fixture now has 60 items so algorithm tests can avoid immediate exhaustion.
- Academic reviewed: **0/60**
- Inference strength: all **weak**, intentionally conservative.
- Short-text items needing structured rubric or redesign: **16**
- Items with empty `requires_kcs`: **6**
- Items carrying explicit flags/concerns: **36**

## Codex Actions Taken

- Imported the 29 AI draft items into local V2 review data.
- Added action notes to every original item: `codex_imported_from_academic_review_file`.
- Added **31 supplemental items** to reach a 60-item pilot fixture.
- Marked supplemental items as `codex_review_status=provisionally_accepted_for_algorithm_test_only`.
- Kept `academic_reviewed=false` and `inference_strength=weak` for all items.
- Added concern notes on generated items where structured input/rubric is still needed.

## Distribution

### By Cluster

- Fractions Equivalence và Operations: **15** items
- Decimals, Percent, Ratio: **11** items
- Expressions & Order of Operations: **11** items
- Integers & Order: **8** items
- Number Foundations & Divisibility: **9** items
- Data / Statistics / Probability, Non-Visual: **6** items

### By Answer Type

- `short_text`: **16**
- `fraction`: **14**
- `set`: **8**
- `decimal`: **5**
- `integer`: **17**

### By Difficulty

- `anchor`: **30**
- `medium`: **26**
- `hard`: **4**

### By Codex Review Status

- `needs_academic_review`: **29**
- `provisionally_accepted_for_algorithm_test_only`: **31**

## What Academic Team Still Needs To Do

1. Mark each item as `accept`, `revise`, or `reject` for academic purposes.
2. Confirm primary KC and algebra/non-geometry scope.
3. Fill or verify `requires_kcs` and `diagnoses_kcs`.
4. Redesign `short_text` items into structured inputs where possible.
5. Decide whether any reviewed item can move from weak to medium/strong inference.
6. Reject or revise any Codex-added item that is pedagogically weak, too repetitive, or misaligned.

## Algorithm-Test Readiness

Current status: **ready for deterministic heuristic smoke tests only**, not ready for student-facing usage.

Can test now:

- item exhaustion behavior with a 60-item fixture;
- duplicate avoidance;
- frontier behavior when some KCs have 2+ items;
- weak-inference conservative baseline;
- grading normalization for fraction/decimal/integer/set answers.

Do not test yet as final performance:

- strong inference precision/recall;
- production readiness;
- student UX timing;
- short_text grading reliability.

## Items Requiring Specific Review

- `v2-001` (Fractions Equivalence và Operations) missing `requires_kcs`: Trong các cách viết sau: 3/4, 5/0, -2/7, 0/9. Cách viết nào KHÔNG phải là phân số hợp lệ? Nêu lí do ngắn gọn.
- `v2-017` (Expressions & Order of Operations) missing `requires_kcs`: Bỏ dấu ngoặc trong biểu thức M = 12 + (8 - 5 + 3). Viết biểu thức sau khi bỏ ngoặc, chưa cần tính giá trị.
- `v2-019` (Integers & Order) missing `requires_kcs`: Trên trục số nằm ngang, điểm A cách gốc O 5 đơn vị về bên trái. A biểu diễn số nguyên nào?
- `v2-022` (Number Foundations & Divisibility) missing `requires_kcs`: Viết 3 bội đầu tiên của 6 lớn hơn 0. Viết theo dạng {số thứ nhất; số thứ hai; số thứ ba}.
- `v2-023` (Number Foundations & Divisibility) missing `requires_kcs`: Biết 109 = 15 × 7 + 4. Khi chia 109 cho 15, thương và số dư lần lượt là gì? Viết theo dạng {thương; số dư}.
- `v2-027` (Data / Statistics / Probability, Non-Visual) missing `requires_kcs`: Trong một biểu đồ tranh, mỗi biểu tượng ʘ đại diện cho 10 học sinh và mỗi nửa biểu tượng ʘ đại diện cho 5 học sinh. Dòng "Lớp 6A" có 3 biểu tượng ʘ và 1 nửa biểu tượng ʘ. Lớp 6A có tất cả bao nhiêu học sinh?

## Short Text Items To Redesign Or Rubric-Review

- `v2-001` (Fractions Equivalence và Operations): Trong các cách viết sau: 3/4, 5/0, -2/7, 0/9. Cách viết nào KHÔNG phải là phân số hợp lệ? Nêu lí do ngắn gọn.
- `v2-002` (Fractions Equivalence và Operations): Hai phân số 6/8 và 9/12 có bằng nhau không? Trả lời "có" hoặc "không".
- `v2-015` (Expressions & Order of Operations): Viết kết quả dưới dạng một lũy thừa: 5⁴ · 5
- `v2-016` (Expressions & Order of Operations): Viết kết quả dưới dạng một lũy thừa: 8⁶ : 8²
- `v2-017` (Expressions & Order of Operations): Bỏ dấu ngoặc trong biểu thức M = 12 + (8 - 5 + 3). Viết biểu thức sau khi bỏ ngoặc, chưa cần tính giá trị.
- `v2-018` (Integers & Order): Sắp xếp các số -5, 3, -8, 0 theo thứ tự tăng dần. Viết theo dạng: số thứ nhất < số thứ hai < số thứ ba < số thứ tư.
- `v2-025` (Number Foundations & Divisibility): 37 là số nguyên tố hay hợp số? Trả lời kèm lí do ngắn gọn.
- `v2-026` (Number Foundations & Divisibility): Vì sao để tìm tất cả ước chung của 18 và 24, ta chỉ cần tìm ước của ƯCLN(18, 24) mà không cần liệt kê hết ước của từng số rồi so sánh?
- `v2-029` (Data / Statistics / Probability, Non-Visual): Lan gieo một đồng xu 20 lần, mặt ngửa xuất hiện 8 lần. Minh gieo cùng loại đồng xu 50 lần, mặt ngửa xuất hiện 20 lần. Xác suất thực nghiệm xuất hiện mặt ngửa của hai bạn có bằng nhau không? Trả lời "có" hoặc "không".
- `v2-036` (Fractions Equivalence và Operations): Hai phân số 14/21 và 2/3 có bằng nhau không? Trả lời có hoặc không.
- `v2-037` (Fractions Equivalence và Operations): Trong các cách viết sau: -6/11, 4/0, 0/5. Cách viết nào không phải phân số hợp lệ?
- `v2-046` (Expressions & Order of Operations): Viết kết quả dưới dạng một lũy thừa: 7³ · 7²
- `v2-047` (Expressions & Order of Operations): Viết kết quả dưới dạng một lũy thừa: 10⁷ : 10³
- `v2-048` (Expressions & Order of Operations): Bỏ dấu ngoặc: 20 + (x - 7 + y). Viết biểu thức sau khi bỏ ngoặc.
- `v2-049` (Expressions & Order of Operations): Bỏ dấu ngoặc: 15 - (a - 4 + b). Viết biểu thức sau khi bỏ ngoặc.
- `v2-050` (Integers & Order): Sắp xếp các số -2, -9, 4, 0 theo thứ tự tăng dần. Viết dạng a < b < c < d.

## Codex-Added Items

- `v2-030` (Fractions Equivalence và Operations, fraction, medium): Rút gọn phân số 45/60 về dạng tối giản.
- `v2-031` (Fractions Equivalence và Operations, set, medium): Quy đồng mẫu hai phân số 5/6 và 7/9 bằng mẫu chung nhỏ nhất. Viết theo dạng {phân số thứ nhất; phân số thứ hai}.
- `v2-032` (Fractions Equivalence và Operations, fraction, medium): Tính: 3/5 + 1/10
- `v2-033` (Fractions Equivalence và Operations, fraction, medium): Tính: 7/8 - 1/4
- `v2-034` (Fractions Equivalence và Operations, fraction, medium): Tính: 5/6 × 3/10 và rút gọn kết quả.
- `v2-035` (Fractions Equivalence và Operations, fraction, hard): Tính: 3/4 ÷ 9/10
- `v2-036` (Fractions Equivalence và Operations, short_text, anchor): Hai phân số 14/21 và 2/3 có bằng nhau không? Trả lời có hoặc không.
- `v2-037` (Fractions Equivalence và Operations, short_text, anchor): Trong các cách viết sau: -6/11, 4/0, 0/5. Cách viết nào không phải phân số hợp lệ?
- `v2-038` (Decimals, Percent, Ratio, decimal, anchor): Viết -35/10 dưới dạng số thập phân.
- `v2-039` (Decimals, Percent, Ratio, decimal, medium): Tính: (-2,4) × 0,5
- `v2-040` (Decimals, Percent, Ratio, decimal, medium): Tính: (-6,3) ÷ (-0,9)
- `v2-041` (Decimals, Percent, Ratio, fraction, medium): Một đoạn dây dài 1,2 m, đoạn dây khác dài 80 cm. Viết tỉ số độ dài đoạn thứ nhất so với đoạn thứ hai dưới dạng phân số tối giản.
- `v2-042` (Decimals, Percent, Ratio, integer, anchor): Tính 25% của 120.
- `v2-043` (Decimals, Percent, Ratio, integer, hard): Một số khi lấy 40% thì được 18. Số đó là bao nhiêu?
- `v2-044` (Expressions & Order of Operations, integer, anchor): Tính: 60 - 4 × 2²
- `v2-045` (Expressions & Order of Operations, integer, medium): Tính: 48 ÷ [2 × (9 - 5)]
- `v2-046` (Expressions & Order of Operations, short_text, medium): Viết kết quả dưới dạng một lũy thừa: 7³ · 7²
- `v2-047` (Expressions & Order of Operations, short_text, medium): Viết kết quả dưới dạng một lũy thừa: 10⁷ : 10³
- `v2-048` (Expressions & Order of Operations, short_text, medium): Bỏ dấu ngoặc: 20 + (x - 7 + y). Viết biểu thức sau khi bỏ ngoặc.
- `v2-049` (Expressions & Order of Operations, short_text, hard): Bỏ dấu ngoặc: 15 - (a - 4 + b). Viết biểu thức sau khi bỏ ngoặc.
- `v2-050` (Integers & Order, short_text, medium): Sắp xếp các số -2, -9, 4, 0 theo thứ tự tăng dần. Viết dạng a < b < c < d.
- `v2-051` (Integers & Order, integer, medium): Nhiệt độ giảm từ 3°C xuống thấp hơn 8°C. Nhiệt độ mới là bao nhiêu °C?
- `v2-052` (Integers & Order, integer, anchor): Số đối của 15 là số nào?
- `v2-053` (Integers & Order, integer, medium): Tính: (-18) + (-7)
- `v2-054` (Number Foundations & Divisibility, set, anchor): Viết 4 ước dương của 18 theo thứ tự tăng dần đầu tiên.
- `v2-055` (Number Foundations & Divisibility, set, anchor): Viết 4 bội dương đầu tiên của 8 theo thứ tự tăng dần.
- `v2-056` (Number Foundations & Divisibility, set, medium): Khi chia 137 cho 12, thương và số dư là bao nhiêu? Viết dạng {thương; số dư}.
- `v2-057` (Number Foundations & Divisibility, integer, medium): Tính ƯCLN(36, 48).
- `v2-058` (Data / Statistics / Probability, Non-Visual, integer, anchor): Bảng ghi số sách đọc trong tuần: An 4, Bình 7, Chi 5, Dũng 4. Tổng số sách cả bốn bạn đọc là bao nhiêu?
- `v2-059` (Data / Statistics / Probability, Non-Visual, fraction, medium): Một túi có 3 bi đỏ và 2 bi xanh. Lấy ngẫu nhiên 1 viên. Xác suất lấy được bi xanh là bao nhiêu? Viết dưới dạng phân số tối giản.
- `v2-060` (Data / Statistics / Probability, Non-Visual, fraction, medium): Gieo một con xúc xắc 40 lần, mặt 1 chấm xuất hiện 6 lần. Xác suất thực nghiệm của mặt 1 chấm là bao nhiêu? Viết dạng phân số tối giản.

## Gap Records

- Data / Statistics / Probability, Non-Visual: `{"role": "Compute/interpret basic statistic", "status": "gap_need_academic_decision", "reason": "Worklist ghi không tìm thấy KC phù hợp cho mean/mode/basic statistic trong 64 KC hiện có. Không nên tự gán vào DOC-VA-PHAN, LAP-BANG-THONG, hoặc TINH-XAC-SUAT vì sẽ sai primary KC và tạo hidden skill.", "suggested_next_action": "Hỏi Huy có muốn thêm KC riêng cho số trung bình/mốt vào graph pilot hay bỏ role này khỏi pilot.", "cluster": "Data / Statistics / Probability, Non-Visual"}`
- Data / Statistics / Probability, Non-Visual: `{"role": "Distinguish impossible/certain/possible", "status": "gap_need_academic_decision", "reason": "Worklist ghi không có KC nào trong 64 KC test riêng phân loại sự kiện không thể/chắc chắn/có thể. Bài 43 có nhắc khả năng 0 và 1, nhưng nếu graph chưa có KC riêng thì không nên viết item và gán tạm vào TINH-XAC-SUAT.", "suggested_next_action": "Hỏi Huy có muốn tạo KC riêng cho phân loại sự kiện hoặc chuyển role này sang visual/probability phase sau.", "cluster": "Data / Statistics / Probability, Non-Visual"}`

## Gate Before Stronger Algorithm Test

- At least 60 items can be used for smoke tests now.
- For meaningful V2 performance tests, academic team should approve/revise enough items so each tested high-impact KC has at least 2-3 usable items.
- For strong inference tests, only include items with `academic_reviewed=true`, deterministic grading, and reviewed prerequisite/diagnosis metadata.
