# Assessment V2 — Phân Loại MCQ Hiện Tại & Worklist Tạo Item Mới

Tài liệu này là output của Giai đoạn 0 (Stage 0) trong
`assessment_v2_item_authoring_playbook.md`: danh sách KC + role cần viết.
Dựa trên việc đọc trực tiếp toàn bộ 64 KC / 126 MCQ, không phải sample.

---

## 0. Lỗi data phát hiện được trong lúc đọc — cần biết trước khi dùng export này

- **KC `G6-MATH-QUY-DONG-MAU`** (quy đồng mẫu phân số): Item 1 trong export là
  một câu hỏi về **biểu đồ cột kép** (số sách 2 lớp đọc theo tháng) — hoàn toàn
  không liên quan tới quy đồng mẫu. Item bị gắn nhầm KC trong production DB.
- **KC `G6-MATH-TIM-UOC-VA`** (tên KC: "Tìm ước và bội số"): cả 2 item thực chất
  test **quy tắc dấu khi nhân hai số nguyên** — nội dung thuộc cluster Integers,
  không phải Number foundations như tên KC gợi ý. Nghi vấn mislabel tương tự.
- **KC `G6-MATH-SO-SANH-HAI-2`** Item 1, **KC `G6-MATH-CONG-HAI-SO-1`** Item 2,
  **KC `G6-MATH-SO-SANH-HAI-5`** Item 1: option bị cắt cụt giữa câu (ví dụ
  "C. Chi" rồi hết), thiếu option D. `G6-MATH-SO-SANH-HAI-5` chỉ có 1 item total
  và item đó cũng bị lỗi này — **KC này coi như không có item nền nào dùng được**.
- **KC `G6-MATH-SO-LIEN-TRUOC`**: chapter/block = `TIỂU HỌC` — khả năng đây là
  KC ở dưới mức Grade 6, nên hỏi Huy có thuộc scope pilot không trước khi viết item.

Nên báo lại cho người vận hành export script để kiểm tra tag KC trong production DB,
không chỉ coi đây là vấn đề của riêng việc viết item V2.

---

## 1. Phân loại toàn bộ 64 KC theo 3 loại

Quy ước: **A** = nhận diện công thức/quy tắc trừu tượng (cần "cụ thể hoá" lại
hoàn toàn). **B** = đã có tính toán cụ thể, convert trực tiếp được. **C** =
định nghĩa/từ vựng thuần (nên loại hoặc redesign sâu). **A→B-dễ** = về bản chất
là A nhưng số liệu đã cụ thể, chỉ cần đổi câu hỏi "công thức nào đúng" thành
"tính kết quả", không cần nghĩ số mới.

### Number foundations & divisibility

| KC | Loại | Ghi chú |
| --- | --- | --- |
| BIEU-DIEN-MOI | B | 234 → tổng giá trị chữ số, convert thẳng |
| BIEU-DIEN-SO | B | Số La Mã <30, convert thẳng (cân nhắc có còn scope Grade 6) |
| SO-LIEN-TRUOC | B | Quá dễ, khả năng dưới scope (xem mục 0) |
| NHAN-BIET-BOI | A | Định nghĩa BC/BCNN trừu tượng |
| NHAN-BIET-SO (prime/composite) | C | Định nghĩa thuần, không có item tính toán |
| NHAN-BIET-SO-3 (số chính phương) | A/B hỗn hợp | Item2 có list số cụ thể, convert được phần đó |
| NHAN-BIET-UOC (ước chung/ƯCLN) | A | Toàn bộ là quan hệ trừu tượng m, n |
| PHAN-TICH-RA (phân tích thừa số nguyên tố) | C | Định nghĩa, không có ví dụ số cụ thể |
| PHAN-BIET-PHEP (chia có dư) | A→B-dễ | a=15×7+4 đã cụ thể, chỉ đổi cách hỏi |
| TIM-BCNN | A→B-dễ | Input đã cụ thể (lũy thừa), đổi cách hỏi |
| TIM-BOI-CUA | A→B-dễ | "bội của 6" đã cụ thể |
| TIM-UCLN | A→B-dễ | Input đã cụ thể (lũy thừa) |
| TIM-UOC-CUA | A/C hỗn hợp | Item2 là liệt kê Ư(15), thuần từ vựng |
| TIM-UOC-VA | A + **lỗi mislabel**, xem mục 0 | |

### Integers & order

| KC | Loại | Ghi chú |
| --- | --- | --- |
| NHAN-BIET-DOC (đọc/viết số nguyên âm) | A | Định nghĩa + tình huống trừu tượng |
| CONG-HAI-SO (cộng 2 số âm) | A | |
| CONG-HAI-SO-1 (cộng khác dấu) | A + lỗi cắt cụt Item2 | |
| NHAN-BIET-SO-1 (số đối) | A→B-dễ | Số đã cụ thể (-12), chỉ cần đổi câu hỏi |
| NHAN-BIET-MO / MO-1 (mở rộng ước/chia hết sang âm) | A | |
| NHAN-HAI-SO / NHAN-HAI-SO-1 (nhân số nguyên) | A | |
| TU-CHO-SO (trừ số nguyên) | A | |
| THUC-HIEN-PHEP (dấu thương) | A | |
| SO-SANH-HAI-4 (so sánh số tự nhiên) | B | Có distractor lý luận sai sẵn — nguồn misconception tốt |
| SO-SANH-HAI-5 (so sánh số nguyên, trục số) | **Không có item nền dùng được** | Xem mục 0 |

### Fractions equivalence và operations

| KC | Loại | Ghi chú |
| --- | --- | --- |
| NHAN-BIET-PHAN-1 (định nghĩa phân số) | C | |
| NHAN-BIET-HAI (phân số bằng nhau, nhân chéo) | A | |
| NHAN-BIET-HON (hỗn số) | C | |
| TINH-CHAT-CO (tính chất cơ bản phân số) | A | |
| QUY-DONG-MAU | A + **lỗi mislabel Item1**, xem mục 0 | |
| QUY-DONG-PHAN | A | |
| CONG-HAI-PHAN | A→B-dễ | Số đã cụ thể (-5/13, 8/13) |
| CONG-HAI-PHAN-1 | A | **Đây chính là ví dụ canonical 1/2+1/3 — đã có sẵn trong playbook, không cần viết lại** |
| TRU-HAI-PHAN | A | |
| NHAN-HAI-PHAN | A | |
| CHIA-HAI-PHAN | A→B-dễ | Item2 đã cụ thể (3/5 : 3) |
| PHAN-SO-NGHICH | A | |
| SO-DOI-CUA (số đối phân số) | A | |
| SO-SANH-HAI (so sánh cùng mẫu) | A→B-dễ | Số đã cụ thể (3/-7, -4/7) |
| SO-SANH-HAI-1 (so sánh khác mẫu) | A | |
| TIM-GIA-TRI (giá trị phân số của 1 số) | A | |

### Decimals, percent, ratio

| KC | Loại | Ghi chú |
| --- | --- | --- |
| NHAN-BIET-VA (đọc/viết số TP âm) | B | Convert thẳng |
| SO-SANH-HAI-2 (so sánh số TP) | A/B hỗn hợp + lỗi cắt cụt Item1 | Item2 đã cụ thể, dùng được |
| CONG-TRU-SO (cộng trừ TP có dấu) | A | |
| NHAN-SO-THAP | A→B-dễ | x=-4,5; y=-2,1 đã cụ thể |
| CHIA-SO-THAP | A | |
| UOC-LUONG-KET (ước lượng) | B | Cả 2 item đã cụ thể, convert thẳng |
| B31K2 (tỉ số/%) | A→B-dễ | 2kg/800g đã cụ thể |
| TIM-GIA-TRI-1 (giá trị % của 1 số) | A | |
| TIM-MOT-SO (tìm số biết %) | A | |

### Expressions và order of operations

| KC | Loại | Ghi chú |
| --- | --- | --- |
| AP-DUNG-DUNG (thứ tự không ngoặc) | A→B-dễ | M=100-2·3²+5 đã cụ thể |
| AP-DUNG-DUNG-1 (thứ tự có ngoặc) | A | |
| BO-DAU-NGOAC (+ trước ngoặc) | A | |
| BO-DAU-NGOAC-1 (− trước ngoặc) | A | |
| BO-NGOAC-LONG (ngoặc lồng) | A | |
| NHAN-BIET-CAU (cấu trúc lũy thừa) | A/B hỗn hợp | Item1 cụ thể (5·5·5·5), Item2 là từ vựng |
| NHAN-LUY-THUA | B | Convert thẳng |
| CHIA-LUY-THUA | B | Convert thẳng |

### Data, statistics, probability, non-visual

| KC | Loại | Ghi chú |
| --- | --- | --- |
| DOC-VA-PHAN (đọc bảng) | A/B hỗn hợp | Item2 (biểu đồ tranh) đã cụ thể, dùng được |
| LAP-BANG-THONG (lập bảng) | C | Mục đích/khái niệm thuần |
| NHAN-BIET-DU (phân biệt loại dữ liệu) | C | |
| TINH-XAC-SUAT (xác suất k/n) | A | |
| NHAN-XET-XAC (nhận xét xác suất) | A | |

### Tổng số liệu

- **Type A (cần viết lại gần như từ đầu):** 31 KC
- **Type A→B-dễ (số đã cụ thể, chỉ cần đổi cách hỏi):** 12 KC
- **Type B (convert thẳng được):** 8 KC
- **Type C (định nghĩa/từ vựng, nên loại hoặc redesign sâu):** 9 KC
- **Hỗn hợp A/B hoặc A/C trong cùng KC:** 4 KC (đã ghi chú riêng)
- **Không có item nền dùng được (lỗi data):** 1 KC (`SO-SANH-HAI-5`)

Kết luận số liệu: **chỉ ~20/64 KC (31%)** có ít nhất 1 item đủ cụ thể để giảm
effort viết V2; phần lớn pool (Type A, 31 KC) cần viết lại hoàn toàn về nội
dung câu hỏi, chỉ giữ được cấu trúc misconception từ distractor làm gợi ý.

---

## 2. Worklist tạo item mới cho pilot (32 item, theo đúng role yêu cầu của doc gốc)

Cột "Trạng thái" dùng để James/Huy biết item nào rẻ (review nhanh) và item nào
cần đầu tư viết từ đầu.

### Number foundations & divisibility (5 item)

| Role | KC mục tiêu (id) | Trạng thái | Yêu cầu item mới |
| --- | --- | --- | --- |
| Anchor factor/multiple | TIM-BOI-CUA (`e354d061-199b-46b6-85c5-29d02b710520`) | A→B-dễ | "3 bội đầu tiên của 6 lớn hơn 0 là?" — answer_type=set |
| Divisibility test | PHAN-BIET-PHEP (`f13f2f58-b3d6-4806-9a21-2f5a59622246`) | A→B-dễ | Giữ nguyên số liệu a=15×7+4, hỏi trực tiếp thương/dư |
| GCD/LCM bridge | TIM-UCLN + TIM-BCNN (`be2c9aad...` + `60307175...`) | Viết mới hoàn toàn | "Tính ƯCLN(18,24) rồi dùng nó tính BCNN(18,24)"; requires_kcs cả 2 KC; inference_strength có thể strong nếu academic duyệt vì bắt buộc dùng cả 2 bước |
| Prime/composite misconception | NHAN-BIET-SO (`9e7337f2-bf2d-42ed-b07c-cdad95b0dd14`) | Viết mới hoàn toàn (Type C) | Không hỏi định nghĩa — bắt áp dụng: "37 là số nguyên tố hay hợp số? Vì sao?" buộc học sinh thử chia thực tế |
| Transfer item (vì sao rule hoạt động) | TIM-UCLN/NHAN-BIET-UOC (`be2c9aad...`) | **Đã viết trong playbook trước (§4)** | Không cần viết thêm, chỉ cần academic review |

### Integers & order (4 item)

| Role | KC mục tiêu (id) | Trạng thái | Yêu cầu item mới |
| --- | --- | --- | --- |
| Compare/order integers | SO-SANH-HAI-5 (`57767f23-fa58-4d24-a2c3-e2bc436786da`) | **Viết mới hoàn toàn, không có nền** (KC này không có item nào dùng được) | "Sắp xếp -5, 3, -8, 0 theo thứ tự tăng dần" |
| Interpret negative trên trục số | NHAN-BIET-DOC (`66e748f8-6756-4f7a-8232-b6a4b7d7661f`) | Viết mới hoàn toàn | "Điểm A cách gốc O 5 đơn vị về bên trái trên trục số. A biểu diễn số nguyên nào?" |
| Absolute value/opposite | NHAN-BIET-SO-1 (`b2dfdb0c-b3ef-47d6-bb61-a76999c50cef`) | A→B-dễ | "Số đối của -12 là?" — đổi thẳng từ Item2 cũ |
| Sign-reasoning misconception | CONG-HAI-SO-1 (`c333baa7-07c9-435d-8b03-a664244d0f21`) | **Đã viết trong playbook trước (§4)** | Không cần viết thêm |

### Fractions equivalence và operations (7 item, thực tế 6 vì 1 item dùng chung 2 role)

| Role | KC mục tiêu (id) | Trạng thái | Yêu cầu item mới |
| --- | --- | --- | --- |
| Fraction meaning/valid form | NHAN-BIET-PHAN-1 (`b68ce985-f530-48eb-9151-e880cf5a61fb`) | Viết mới hoàn toàn (Type C) | "Trong các cách viết: 3/4, 5/0, -2/7, 0/9 — cách nào KHÔNG phải phân số hợp lệ? Vì sao?" |
| Equivalent fractions | NHAN-BIET-HAI (`0164cf7c-e080-4ca0-909b-e292f65af633`) | **Đã viết trong playbook trước (§4)** | Không cần viết thêm |
| Simplification | TINH-CHAT-CO (`959461db-e6ce-44b6-8c5f-25c65ac467e8`) | Viết mới hoàn toàn | "Rút gọn phân số 18/24 về dạng tối giản" |
| Common denominator | QUY-DONG-MAU (`93a0e693-56a1-4140-bbb5-6f27cd2c155b`) | Viết mới hoàn toàn + cần fix lỗi mislabel trước | "Quy đồng mẫu 2/5 và 3/4 (không cần cộng), mẫu chung nhỏ nhất là?" — tách riêng khỏi bước cộng |
| Add/subtract unlike denom + misconception cộng tử-mẫu | CONG-HAI-PHAN-1 (`cdb87133-898d-431e-9155-b17dacb8d6dd`) | **Đã có sẵn (ví dụ canonical 1/2+1/3), 1 item phục vụ cả 2 role** | Không cần viết thêm |
| Multiply/divide fraction bridge | NHAN-HAI-PHAN + PHAN-SO-NGHICH (`6c18010c...` + `1e15deb5...`) | Viết mới hoàn toàn | "Tính: 2/3 ÷ 4/9" — requires_kcs cả nhân phân số và nghịch đảo |

### Decimals, percent, ratio (6 item)

| Role | KC mục tiêu (id) | Trạng thái | Yêu cầu item mới |
| --- | --- | --- | --- |
| Decimal place value | NHAN-BIET-VA (`b40bd888-5268-476f-bdc6-a6116fef1b16`) | A→B-dễ | Giữ số liệu cũ (-2021/100), đổi thành "viết dưới dạng số thập phân" |
| Decimal operations | NHAN-SO-THAP (`cabfac64-e7dd-4074-99fa-aa240ffa4a80`) | A→B-dễ | Giữ x=-4,5; y=-2,1, hỏi trực tiếp x·y |
| Fraction-decimal-percent conversion | **Không tìm thấy KC phù hợp trong 64 KC hiện có** | **Gap — cần hỏi Huy trước** | Có thể graph chưa có KC riêng cho 3-way conversion; xác nhận trước khi viết item |
| Ratio interpretation | B31K2 (`5d32c8a0-841b-47ef-b75e-9cc64f527aaa`) | **Đã viết trong playbook trước (§4)** | Không cần viết thêm |
| Proportional reasoning bridge | TIM-GIA-TRI + TIM-GIA-TRI-1 (`9b541386...` + `9e9c5789...`) | Viết mới hoàn toàn | Bài toán cần cả "giá trị phân số của 1 số" và "giá trị % của 1 số" trong cùng 1 bài |
| Percent misconception | TIM-MOT-SO (`2c3fda5a-55af-42de-b11b-72617bc45836`) | **Đã viết trong playbook trước (§4)** | Không cần viết thêm |

### Expressions và order of operations (5 item, 6 role gối nhau)

| Role | KC mục tiêu (id) | Trạng thái | Yêu cầu item mới |
| --- | --- | --- | --- |
| Order of operations + expression evaluation | AP-DUNG-DUNG (`9c934457-4e43-4486-91da-61636059295c`) | **Đã viết trong playbook trước (§4)** | Không cần viết thêm, 1 item phục vụ 2 role |
| Parentheses | AP-DUNG-DUNG-1 (`a75e022e-e78b-4020-a20b-45f3b0d995dd`) | Viết mới hoàn toàn | Thay x,y,z,m,n bằng số cụ thể trong A = x+{y÷[z·(m-n)]} |
| Powers | NHAN-LUY-THUA hoặc CHIA-LUY-THUA (`095f17d0...` / `cb9cba24...`) | B | Convert thẳng, ví dụ 5⁴·5 hoặc 8⁶:8² |
| Removing parens + misconception precedence/sign | BO-DAU-NGOAC (`7c147ca4-23b5-4563-be98-cd0b07af6f6e`) | Viết mới hoàn toàn | Thay a,b,c,d bằng số cụ thể trong M=a+(b-c+d); 1 item phục vụ cả 2 role qua wrong_pattern |

### Data, statistics, probability, non-visual (5 item)

| Role | KC mục tiêu (id) | Trạng thái | Yêu cầu item mới |
| --- | --- | --- | --- |
| Read simple table + interpret data | DOC-VA-PHAN (`37f66bcc-182b-4f34-bd00-f2be0a91e83e`) | A→B-dễ | Giữ số liệu biểu đồ tranh cũ, hỏi trực tiếp tổng số học sinh |
| Compute/interpret basic statistic | **Không tìm thấy KC phù hợp** | **Gap — cần hỏi Huy** | Xác nhận mean/mode có trong graph scope Grade 6 không trước khi viết |
| Simple probability | TINH-XAC-SUAT (`67efc576-2aee-4fb8-9620-fb56c374b796`) | **Đã viết trong playbook trước (§4)** | Không cần viết thêm |
| Distinguish impossible/certain/possible | **Không tìm thấy KC phù hợp** | **Gap — cần hỏi Huy** | Không có KC nào trong 64 KC test riêng phân loại loại sự kiện này |

---

## 3. Tổng kết để lập kế hoạch effort

- **Đã có sẵn, chỉ cần academic review (không viết thêm):** 8 item (đã nằm
  trong playbook trước: GCD/UCLN transfer, sign-misconception, equivalent
  fractions, fraction add/sub+misconception, ratio, percent misconception,
  order-of-operations, probability).
- **A→B-dễ — đổi cách hỏi, giữ số liệu cũ, effort thấp:** 7 item (factor/multiple
  anchor, divisibility test, absolute value, decimal place value, decimal
  operations, powers, table read).
- **Viết mới hoàn toàn — cần academic thiết kế misconception từ đầu:** 12 item.
- **Gap thật — chưa rõ có KC tương ứng trong graph hay không, cần hỏi Huy
  trước khi viết:** 3 role (fraction-decimal-percent conversion, basic
  statistic, impossible/certain/possible event).

Tổng: 8 + 7 + 12 + 3(gap, tạm chưa tính vào 32) = 27 item xác định được hướng
xử lý ngay; 3 role còn lại cần quyết định graph-scope trước khi viết, không
nên đoán bừa KC để giữ đúng nguyên tắc "no hidden skill / no item test KC
không liên quan" trong Hard Constraints gốc.