# Assessment V2 — Quy Trình Làm Item: Academic Team × AI

Tài liệu này là playbook thực thi cho `assessment_v2_g6_algebra_open_diagnostic_requirements.md`.
Mục tiêu: chỉ cần làm theo đúng quy trình + checklist dưới đây, item sẽ tự động
thoả mãn toàn bộ requirements gốc (Item Quality Rubric, Hard Constraints,
Inference Strength Rules).

---

## 1. Đánh giá reuse từ 126 MCQ hiện tại (64 KC) — đọc thật, không suy đoán

Sau khi đọc trực tiếp `g6_algebra_current_mcq_items.md`, MCQ hiện tại rơi vào
**3 loại khác nhau**, và mỗi loại cần một cách xử lý khác nhau — quy trình
"remove answer choices, ask for final answer" trong doc gốc **chỉ đúng cho 1
trong 3 loại**. Đây là điểm quan trọng nhất cần academic team nắm trước khi bắt
tay viết item.

### Loại A — Nhận diện công thức/quy tắc trừu tượng (chiếm phần lớn pool)

Ví dụ thật từ file (KC `G6-MATH-CHIA-HAI-PHAN`, id `d0d94d7e-8b74-4648-a31e-a722b86957d3`):

> "Cho hai phân số a/b và c/d... kết quả của (a/b) ÷ (c/d) là biểu thức nào?"
> A. (a·c)/(b·d) B. (a·d)/(b·c) ✓ C. (b·c)/(a·d) D. (b·d)/(a·c)

**Không thể convert bằng cách bỏ option.** Nếu bỏ option, câu hỏi trở thành "viết
công thức chia phân số" — vẫn là tái hiện quy tắc bằng lời, không phải tính
toán, đúng dạng bị loại theo Authoring Rules gốc ("the item tests vocabulary
rather than skill").

**Cách xử lý đúng — "cụ thể hoá" (concretize):** thay biến trừu tượng bằng số
thật, hỏi kết quả tính toán. Các distractor trừu tượng (vd. (b·c)/(a·d)) chính
là bản đồ misconception sẵn có — chỉ cần tính ra distractor đó cho ra số gì với
bộ số cụ thể, đó chính là `common_wrong_patterns`.

### Loại B — Tính toán cụ thể với số thật (convert trực tiếp được)

Ví dụ thật (KC `G6-MATH-CHIA-LUY-THUA`, id `cb9cba24-5074-4b1c-8fb6-84ab98c03a4e`):
> "Viết kết quả: 15⁷ : 15" → A. 15⁷ B. 15⁶ ✓ ...

Đây convert được đúng như quy trình gốc: bỏ option, hỏi trực tiếp "15⁷ : 15 = ?",
dùng distractor số (15⁷, 1⁷, 1⁶) làm `common_wrong_patterns`.

### Loại C — Định nghĩa/liệt kê thuần (nên loại, hiếm khi sửa được)

Ví dụ thật (KC `G6-MATH-TIM-UOC-CUA`, id `a44cc514-3d97-4f27-ad2f-0488badff527`):
> "Ư(15) = ?" → liệt kê tập hợp.

Đây test trí nhớ ký hiệu, không test kỹ năng. Theo Authoring Rules gốc, loại
trừ khi "the item tests vocabulary rather than skill" — giữ nguyên kết luận
loại, trừ khi redesign thành tác vụ thật (ví dụ bắt tìm ước trong một điều kiện
cụ thể, không chỉ liệt kê).

### Hệ quả thực dụng cho việc lập kế hoạch

- **Không nên kỳ vọng MCQ bank tiết kiệm nhiều effort viết câu hỏi mới** — ước
  tính từ các block đã đọc, phần lớn rơi vào Loại A (cần viết lại gần như từ đầu,
  chỉ giữ lại cấu trúc misconception).
- **Giá trị thật của MCQ bank không phải là "nguồn câu hỏi"**, mà là:
  1. Bản đồ KC nào đã có item-pool/anchor sẵn (dùng để biết KC nào dễ đạt
     `item_count`/`anchor_count` tối thiểu khi thiết kế item V2 mới cho đúng KC đó).
  2. Nguồn distractor/misconception đã được domain expert nghĩ ra trước —
     dùng làm input để suy ra `common_wrong_patterns` khi viết lại từ đầu.
  3. Một số ít item Loại B dùng trực tiếp được.
- **`irt_a/irt_b/irt_c` của MCQ cũ không mang sang V2 được** — đó là tham số IRT
  ước lượng dưới guessing 25% của MCQ, không phản ánh độ khó/discrimination của
  item open-ended (guessing ~2-5%). Coi như chưa có dữ liệu IRT cho item V2 mới.

---

## 2. Kiến trúc quy trình Academic × AI

Nguyên tắc cốt lõi, không thương lượng: **AI chỉ draft. AI không bao giờ tự đặt
`inference_strength=strong` hoặc `academic_reviewed=true`.** Mọi item AI sinh ra
mặc định `inference_strength="weak"`, `academic_reviewed=false`.

| Giai đoạn | Ai làm | Input | Output |
| --- | --- | --- | --- |
| 0. Chọn strand & cut-point | **Huy (academic)** | Graph + Pilot distribution table | Danh sách KC + role cần viết (worklist) |
| 1. Draft item | **AI**, theo prompt §3 | 1 KC + 1 role + context graph + few-shot | JSON draft, `weak`, `academic_reviewed=false` |
| 2. Review item | **Huy** | JSON draft + Item Quality Rubric | Approve / revise / reject; set `inference_strength` thật; `academic_reviewed=true` |
| 3. Gom & check coverage | **James/Huy** | Toàn bộ item đã approve | Check trùng `requires_kcs`, check đủ phân bố theo cluster |
| 4. Deterministic simulation | **James (code)**, không AI | Item JSON đã approve | Precision/recall, false-strong-inference count |
| 5. AI smoke test | **AI persona**, sau khi (4) pass | 1-2 persona cố định | Reasoning transcript, KHÔNG dùng để debug logic |

Giai đoạn 4-5 đã được thống nhất nguyên tắc trước đó trong context AI giả học
sinh: **tách ground-truth khỏi phần AI generate.** Ở giai đoạn 5, nếu dùng AI
persona, sample đúng/sai trước theo xác suất đã định (không để AI tự quyết định
đúng/sai), AI chỉ generate cách trình bày câu trả lời khớp với kết quả đã định.

---

## 3. Prompt template cho AI draft item

Dùng prompt này cho **mỗi KC + mỗi role** riêng biệt (không generate hàng loạt
nhiều KC trong 1 lần gọi — khó review, khó audit).

```
SYSTEM:
Bạn là AI hỗ trợ academic team soạn item chẩn đoán mở (open-ended diagnostic
item) cho Wizzdom Assessment V2, Toán lớp 6, theo đúng schema và rule sau.

QUY TẮC CỨNG (vi phạm = draft bị từ chối):
1. Không bao giờ tự đặt inference_strength khác "weak". Không tự đặt
   academic_reviewed=true.
2. requires_kcs phải liệt kê ĐẦY ĐỦ mọi kỹ năng không phải primary KC mà câu
   hỏi cần dùng. Không có "hidden skill".
3. Không dùng hình vẽ, biểu đồ, hoặc bất kỳ yếu tố visual/geometry.
4. accepted_answers phải chấm được tự động, không mơ hồ (số/phân số/set rõ
   ràng). Nếu không chấm được tự động, KHÔNG tạo answer_type=short_text trừ
   khi được yêu cầu rõ.
5. Không thiết kế bài toán nhiều bước mà một bước không liên quan tới primary
   KC có thể "che" được tín hiệu (cognitive load phải vừa Grade 6).
6. Nếu không tự tin về độ "guess-resistance" hoặc về requires_kcs đầy đủ, vẫn
   trả JSON nhưng thêm field "flags": ["lý do cần academic xem kỹ"].
7. Ngôn ngữ: tiếng Việt, văn phong phù hợp học sinh lớp 6, không dùng thuật
   ngữ academic (KST, IRT, BKT...) trong nội dung câu hỏi.

OUTPUT: chỉ trả JSON đúng schema, không có text khác.

SCHEMA:
{
  "kc_id": "...",
  "question": "...",
  "answer_type": "integer | decimal | fraction | number | set | short_text",
  "accepted_answers": ["..."],
  "tolerance": null hoặc số,
  "difficulty_label": "easy | anchor | medium | hard",
  "is_diagnostic_anchor": true/false,
  "requires_kcs": ["..."],
  "diagnoses_kcs": ["..."],
  "inference_strength": "weak",
  "academic_reviewed": false,
  "common_wrong_patterns": [
    {"pattern": "...", "mode": "exact", "diagnosis": "...", "diagnoses_kcs": ["..."]}
  ],
  "flags": []
}

FEW-SHOT (2 ví dụ chuẩn từ academic team — đính kèm nguyên văn từ §4 dưới đây).

USER (biến cho mỗi lần gọi):
- KC mục tiêu: {kc_name} (id: {kc_id})
- Vai trò cần viết: {item_role}  (ví dụ: "anchor item", "misconception item",
  "bridge item", "transfer item")
- Prerequisite KC có sẵn trong graph (chỉ chọn trong danh sách này cho
  requires_kcs): {candidate_prerequisite_kc_list}
- Nếu có MCQ cũ liên quan, đính kèm nguyên văn + phân loại (Loại A/B/C) để AI
  tham khảo cách "cụ thể hoá" hoặc tái dùng distractor.
```

---

## 4. Câu hỏi mẫu — đủ field, 1 mẫu / cluster, dùng KC id thật

### Number foundations & divisibility — "transfer item" (chuyển đổi từ MCQ Loại A)

Đây là ví dụ chuyển Loại A → item mới: MCQ cũ hỏi "khẳng định nào đúng về quy
trình tìm ước chung qua ƯCLN" (recognition). Bản V2 bắt học sinh áp dụng và giải
thích, đúng vai trò "transfer item" mà doc yêu cầu.

```json
{
  "kc_id": "be2c9aad-6853-4aab-883b-0893de49b156",
  "question": "Vì sao để tìm tất cả ước chung của 18 và 24, ta chỉ cần tìm ước của ƯCLN(18, 24) mà không cần liệt kê hết ước của từng số rồi so sánh?",
  "answer_type": "short_text",
  "accepted_answers": [
    "vì mọi ước chung đều phải là ước của ưcln",
    "vì ước chung là ước của số lớn nhất cùng chia hết cả hai số"
  ],
  "tolerance": null,
  "difficulty_label": "hard",
  "is_diagnostic_anchor": false,
  "requires_kcs": ["a44cc514-3d97-4f27-ad2f-0488badff527"],
  "diagnoses_kcs": ["be2c9aad-6853-4aab-883b-0893de49b156"],
  "inference_strength": "weak",
  "academic_reviewed": false,
  "common_wrong_patterns": [
    {
      "pattern": "vì ước chung và ưcln không liên quan",
      "mode": "contains",
      "diagnosis": "Chưa hiểu quan hệ tập-con giữa ước chung và ước của ƯCLN",
      "diagnoses_kcs": ["be2c9aad-6853-4aab-883b-0893de49b156"]
    }
  ],
  "flags": ["short_text rubric cần academic duyệt kỹ trước khi dùng cho strong inference"]
}
```

### Integers & order — sign-reasoning, cố ý chỉ "weak" (đúng khuyến nghị gốc)

```json
{
  "kc_id": "c333baa7-07c9-435d-8b03-a664244d0f21",
  "question": "Tính: (-15) + 9",
  "answer_type": "integer",
  "accepted_answers": ["-6"],
  "tolerance": null,
  "difficulty_label": "medium",
  "is_diagnostic_anchor": true,
  "requires_kcs": ["66e748f8-6756-4f7a-8232-b6a4b7d7661f"],
  "diagnoses_kcs": ["c333baa7-07c9-435d-8b03-a664244d0f21"],
  "inference_strength": "weak",
  "academic_reviewed": false,
  "common_wrong_patterns": [
    {
      "pattern": "24",
      "mode": "exact",
      "diagnosis": "Lấy giá trị tuyệt đối của hai số rồi cộng, bỏ qua việc hai số khác dấu cần lấy hiệu",
      "diagnoses_kcs": ["c333baa7-07c9-435d-8b03-a664244d0f21"]
    },
    {
      "pattern": "6",
      "mode": "exact",
      "diagnosis": "Lấy hiệu đúng nhưng quên dấu của số có giá trị tuyệt đối lớn hơn",
      "diagnoses_kcs": ["c333baa7-07c9-435d-8b03-a664244d0f21"]
    }
  ],
  "flags": []
}
```

*Lưu ý:* `inference_strength="weak"` không phải lỗi AI — đây đúng theo cảnh báo
gốc "a sign slip is common, strong gap requires repeated evidence". Academic
không nên nâng item dạng này lên "strong" trừ khi có bằng chứng lặp lại.

### Fractions — misconception item (chính là ví dụ canonical của doc gốc, gắn id thật)

```json
{
  "kc_id": "cdb87133-898d-431e-9155-b17dacb8d6dd",
  "question": "Tính: 1/2 + 1/3",
  "answer_type": "fraction",
  "accepted_answers": ["5/6"],
  "tolerance": null,
  "difficulty_label": "anchor",
  "is_diagnostic_anchor": true,
  "requires_kcs": [
    "b68ce985-f530-48eb-9151-e880cf5a61fb",
    "93a0e693-56a1-4140-bbb5-6f27cd2c155b"
  ],
  "diagnoses_kcs": ["93a0e693-56a1-4140-bbb5-6f27cd2c155b"],
  "inference_strength": "strong",
  "academic_reviewed": true,
  "common_wrong_patterns": [
    {
      "pattern": "2/5",
      "mode": "exact",
      "diagnosis": "Cộng tử số với tử số và mẫu số với mẫu số trực tiếp",
      "diagnoses_kcs": ["93a0e693-56a1-4140-bbb5-6f27cd2c155b"]
    }
  ],
  "flags": []
}
```

### Decimals, percent, ratio — buộc đúng "ratio interpretation", chuyển từ MCQ Loại A

MCQ cũ chỉ hỏi "bước nào bắt buộc trước khi chia" (recognition). Bản V2 bắt
thực hiện đúng bước đó để ra kết quả, loại bỏ khả năng đoán.

```json
{
  "kc_id": "5d32c8a0-841b-47ef-b75e-9cc64f527aaa",
  "question": "Khối lượng vật A là 2 kg, vật B là 800 g. Viết tỉ số khối lượng của A so với B dưới dạng phân số tối giản.",
  "answer_type": "fraction",
  "accepted_answers": ["5/2"],
  "tolerance": null,
  "difficulty_label": "medium",
  "is_diagnostic_anchor": true,
  "requires_kcs": ["959461db-e6ce-44b6-8c5f-25c65ac467e8"],
  "diagnoses_kcs": ["5d32c8a0-841b-47ef-b75e-9cc64f527aaa"],
  "inference_strength": "weak",
  "academic_reviewed": false,
  "common_wrong_patterns": [
    {
      "pattern": "1/400",
      "mode": "exact",
      "diagnosis": "Không quy đổi đơn vị (kg vs g) trước khi lập tỉ số",
      "diagnoses_kcs": ["5d32c8a0-841b-47ef-b75e-9cc64f527aaa"]
    }
  ],
  "flags": []
}
```

### Expressions & order of operations — chuyển trực tiếp từ MCQ Loại B (dễ nhất để convert)

```json
{
  "kc_id": "9c934457-4e43-4486-91da-61636059295c",
  "question": "Tính giá trị của biểu thức: M = 100 - 2 · 3² + 5",
  "answer_type": "integer",
  "accepted_answers": ["87"],
  "tolerance": null,
  "difficulty_label": "anchor",
  "is_diagnostic_anchor": true,
  "requires_kcs": [],
  "diagnoses_kcs": ["9c934457-4e43-4486-91da-61636059295c"],
  "inference_strength": "weak",
  "academic_reviewed": false,
  "common_wrong_patterns": [
    {
      "pattern": "69",
      "mode": "exact",
      "diagnosis": "Tính 2 · 3 = 6 trước rồi mới bình phương (6² = 36), không ưu tiên lũy thừa trước nhân",
      "diagnoses_kcs": ["9c934457-4e43-4486-91da-61636059295c"]
    },
    {
      "pattern": "295",
      "mode": "exact",
      "diagnosis": "Thực hiện từ trái sang phải hoàn toàn, bỏ qua thứ tự phép tính",
      "diagnoses_kcs": ["9c934457-4e43-4486-91da-61636059295c"]
    }
  ],
  "flags": []
}
```

### Data/statistics/probability, non-visual — concretize từ công thức trừu tượng (Loại A)

```json
{
  "kc_id": "67efc576-2aee-4fb8-9620-fb56c374b796",
  "question": "Một học sinh gieo một con xúc xắc 60 lần và thấy mặt 6 chấm xuất hiện 12 lần. Tính xác suất thực nghiệm của sự kiện \"xuất hiện mặt 6 chấm\", viết dưới dạng phân số tối giản.",
  "answer_type": "fraction",
  "accepted_answers": ["1/5"],
  "tolerance": null,
  "difficulty_label": "medium",
  "is_diagnostic_anchor": true,
  "requires_kcs": ["959461db-e6ce-44b6-8c5f-25c65ac467e8"],
  "diagnoses_kcs": ["67efc576-2aee-4fb8-9620-fb56c374b796"],
  "inference_strength": "weak",
  "academic_reviewed": false,
  "common_wrong_patterns": [
    {
      "pattern": "12/48",
      "mode": "exact",
      "diagnosis": "Lấy số lần KHÔNG xảy ra sự kiện (60-12=48) làm mẫu số thay vì tổng số lần thử",
      "diagnoses_kcs": ["67efc576-2aee-4fb8-9620-fb56c374b796"]
    },
    {
      "pattern": "60/12",
      "mode": "exact",
      "diagnosis": "Đảo ngược tử số và mẫu số trong công thức k/n",
      "diagnoses_kcs": ["67efc576-2aee-4fb8-9620-fb56c374b796"]
    }
  ],
  "flags": []
}
```

---

## 5. Checklist "must-pass" trước khi `academic_reviewed=true`

Dùng đúng 1-1 với Item Quality Rubric + Hard Constraints gốc, rút gọn để
Huy chạy nhanh từng item:

- [ ] Primary KC đúng là kỹ năng chính được test (không phải KC khác bị "léo" vào)
- [ ] Mọi kỹ năng phụ cần dùng đã có trong `requires_kcs` — không có hidden skill
- [ ] `accepted_answers` chấm được tự động, không mơ hồ
- [ ] Mỗi `common_wrong_pattern` map tới đúng 1 misconception cụ thể, không mơ hồ
- [ ] Học sinh không thể đoán đúng nhờ cách diễn đạt câu hỏi (không phải MCQ trá hình)
- [ ] Độ phức tạp đọc hiểu phù hợp lớp 6, không che tín hiệu toán bằng văn phong
- [ ] Bằng chứng đúng/sai justify đúng `inference_strength` đã gán (xem §Inference Strength Rules gốc)
- [ ] Không có yếu tố hình học/visual không được duyệt riêng
- [ ] Nếu nâng lên `strong`: đã có đủ điều kiện 5 mục trong "Strong" rules gốc

Nếu một item có bất kỳ ô nào KHÔNG tick được ở 3 dòng đầu → reject hoặc giữ
nguyên `weak`, không sửa số khác để "vá".

---

## 6. Thứ tự ưu tiên cho pilot 30-35 item

Theo đúng Pilot Distribution Table gốc, thứ tự nên làm trước — không phải vì
cluster sau kém quan trọng, mà vì cut-point/bridge của các cluster trước ảnh
hưởng tới việc xác định `requires_kcs` của cluster sau:

1. **Fractions (7 item)** — cluster giá trị cao nhất theo doc gốc, và nhiều KC
   khác (decimals/percent/ratio) phụ thuộc vào nó.
2. **Number foundations & divisibility (5 item)** — nền cho GCD/LCM dùng lại ở fractions.
3. **Decimals, percent, ratio (6 item)** — sau khi fraction-equivalence đã có id ổn định.
4. **Expressions & order of operations (5 item)** — convert nhanh nhất (nhiều Loại B), làm song song được.
5. **Integers & order (4 item)** — giữ `weak` mặc định theo đúng cảnh báo gốc, không cần đầu tư sâu.
6. **Data/statistics/probability (5 item)** — làm cuối, ít phụ thuộc cluster khác.

Sau khi đủ 30-35 item và pass checklist §5 cho từng item → chạy Phase 1 (Safe
Test Plan, deterministic, không AI) trước khi đụng tới AI smoke test.