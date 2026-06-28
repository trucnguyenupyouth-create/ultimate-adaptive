# Wizzdom — Frontend Product Requirements
**Audience:** UI/UX Design Team  
**Purpose:** Brainstorm và thiết kế high-fidelity mockup  
**Scope:** Toàn bộ demo flow — Grade 6–9 Adaptive Math

---

## 1. Bối cảnh sản phẩm

Wizzdom là hệ thống học thích ứng cho toán trung học. Thay vì bài thi truyền thống, hệ thống:
- Hỏi ít câu hỏi được chọn thông minh để **chẩn đoán toàn bộ cấu trúc kiến thức** của học sinh
- Xây dựng **bản đồ kiến thức cá nhân** — hiện thị mạnh/yếu/bị ảnh hưởng
- Dạy **đúng một kỹ năng** bị thiếu theo logic ưu tiên
- Xác nhận học sinh đã thực sự tiến bộ trước khi cập nhật bản đồ

**Điểm khác biệt cốt lõi:** Từ 12 câu hỏi, hệ thống suy ra được trạng thái của 47 kỹ năng — không chỉ những kỹ năng được hỏi trực tiếp. Đây là giá trị cần được visualize rõ ràng.

---

## 2. Người dùng

### Người xem demo (Priority 1)
**Nhà đầu tư, giáo viên, school admin** xem demo trong các buổi pitch hoặc trải nghiệm thử.

- Họ đang hoài nghi — đã thấy quá nhiều "AI education" tool trông giống quiz app
- Thời gian chú ý ngắn — có thể rời đi nếu không hiểu value trong 30 giây đầu
- Không biết code, không đọc số liệu kỹ thuật
- Câu hỏi trong đầu: *"Cái này thực sự khác gì một bài test bình thường?"*
- Mục tiêu thành công: họ hỏi *"cái này deploy chưa, học sinh của tôi có thể dùng không?"*

### Học sinh (Priority 2 — người dùng thực)
**Học sinh lớp 6–9, 11–15 tuổi**, luyện toán.

- Đang ở nhà hoặc trường, dùng laptop hoặc điện thoại
- Có thể lo lắng về việc bị đánh giá — tâm lý "thi cử"
- Không quen với giao diện học toán kỹ thuật số (quen ghi tay)
- Khó khăn lớn nhất: **nhập ký hiệu toán học** — gõ "5/6" thay vì nhìn thấy phân số thực sự

### Giáo viên (Priority 3 — người xem kết quả)
**Giáo viên toán THCS**, muốn hiểu học sinh của mình.

- Cần thấy bằng chứng rõ ràng — không chỉ điểm số
- Muốn biết học sinh mạnh/yếu ở đâu để lập kế hoạch dạy
- Không có thời gian để đọc báo cáo dài

---

## 3. Vòng lặp học tập (The Learning Loop)

Đây là flow tuyến tính, 5 bước, mỗi bước dẫn vào bước tiếp theo. UI phải truyền tải được sự liên kết — người xem cảm nhận một hệ thống hoàn chỉnh, không phải 5 màn hình rời rạc.

```
ASSESS → MAP → LEARN → MASTERY → OUTCOME
```

Người dùng luôn biết mình đang ở đâu trong vòng lặp và cần đến đâu tiếp theo.

---

## 4. Nguyên tắc thiết kế tổng thể

**Clarity beats cleverness** — mỗi màn hình có một điều duy nhất cần truyền đạt. Nếu cần giải thích bằng lời, design chưa xong.

**Proof, not promise** — không nói "hệ thống thông minh". Show nó: số liệu thực, bản đồ thay đổi thật, skill được unlock thật.

**Không phải bài thi** — tone của toàn bộ sản phẩm: bình tĩnh, chính xác, khuyến khích. Tránh mọi yếu tố gây cảm giác thi cử, phán xét, áp lực.

**Demo tự kể câu chuyện** — trong pitch meeting, presenter có thể im lặng. Design phải tự dẫn dắt người xem qua 5 bước và tự thuyết phục.

**Toán học cần trông như toán học** — phân số cần trông như phân số, không phải "3/4" trong text box.

---

## 5. Màn hình ASSESS — Chẩn đoán

### Mục tiêu của màn hình
Học sinh trả lời câu hỏi toán. Hệ thống quan sát và lựa chọn câu tiếp theo thông minh dựa trên câu trả lời trước. Người xem demo cần cảm nhận được sự khác biệt — đây không phải quiz ngẫu nhiên.

### Người dùng và nhu cầu
- **Học sinh:** Cần tập trung vào bài toán, không bị phân tâm bởi interface
- **Người xem demo:** Cần thấy rằng đây là hệ thống thông minh (adaptive), không phải list câu hỏi cố định

### Điều cần đạt được
- Học sinh hiểu mình đang làm gì mà không cần đọc hướng dẫn
- Không có cảm giác áp lực thi cử — không hiện đúng/sai ngay sau mỗi câu
- Rõ tiến độ (đang ở câu mấy, còn bao nhiêu) mà không gây cảm giác "còn lâu mới xong"
- Sau khi submit đáp án cuối, có transition ý nghĩa sang Map — không đột ngột

### Thách thức UX cần giải quyết

**Thách thức 1: Nhập toán học**  
Học sinh lớp 6 quen viết phân số trên giấy — tử trên, mẫu dưới, gạch ngang giữa. Khi giao diện chỉ cho một text box, họ không biết gõ "3/4" hay "3 phần 4" hay "3 trên 4". Gõ sai format → câu trả lời đúng bị chấm sai.

*Điều UI/UX cần giải quyết: Làm sao để việc nhập phân số trên màn hình cảm giác giống viết phân số trên giấy?*

**Thách thức 2: Adaptive — không giải thích được bằng text**  
Người xem demo cần hiểu "câu hỏi được chọn theo câu trả lời trước" — nhưng không thể viết paragraph giải thích dài ở giữa màn hình.

*Điều UI/UX cần giải quyết: Cue visual nào cho thấy hệ thống đang "suy nghĩ" sau mỗi câu trả lời?*

**Thách thức 3: Transition sang Map**  
Sau câu hỏi cuối, hệ thống xử lý và tạo knowledge map. Không thể chỉ blank screen. Cần cho người dùng cảm giác "đang có chuyện quan trọng đang xảy ra".

### Các states cần có
1. **Question input** — câu hỏi + widget nhập + submit
2. **Processing** — đang tạo knowledge map, transition sang Map screen

### Thông tin cần hiển thị
- Tiến độ: đang ở câu mấy / tổng số câu tối đa
- Nội dung câu hỏi
- Widget nhập đáp án (visual, phù hợp với loại câu hỏi)
- Hành động: submit + "không biết"

### Mock data tham khảo
```
Học sinh: Minh · Lớp 8A
Câu hiện tại: 7 / 12
Nội dung: "Rút gọn biểu thức: 3/4 + 1/2 = ?"
Loại widget: fraction (phân số)
```

---

## 6. Màn hình MAP — Bản đồ tri thức

### Mục tiêu của màn hình
**Đây là màn hình quan trọng nhất trong toàn bộ demo.** Reveal kết quả của quá trình chẩn đoán dưới dạng bản đồ trực quan. Người xem phải hiểu trong 3 giây: hệ thống vừa tìm ra điều gì, tại sao điều đó có giá trị, và bước tiếp theo là gì.

### Người dùng và nhu cầu
- **Nhà đầu tư/giáo viên:** Cần thấy scale của inference — 12 câu → 47 kỹ năng được vẽ — và hiểu tại sao điều đó ấn tượng
- **Học sinh:** Cần thấy "đây là mình" — bản đồ này nói về kiến thức của cá nhân em, không phải số liệu chung chung

### Điều cần đạt được
- WOW moment khi bản đồ hiện ra — cảm giác "à, đây là toàn bộ kiến thức của học sinh này"
- Con số "12 câu → 47 kỹ năng" phải là highlight — người xem nhìn vào đó đầu tiên
- Bản đồ phải phân biệt được rõ ràng: mạnh / cần ôn / bị ảnh hưởng / chưa đủ bằng chứng
- Có một điểm tập trung rõ ràng — "đây là kỹ năng cần học tiếp theo, đây là lý do"
- CTA tự nhiên: người dùng muốn bấm "bắt đầu học" mà không cần nhìn nút

### Thách thức UX cần giải quyết

**Thách thức 1: Complexity vs Clarity**  
47 kỹ năng với mối quan hệ prerequisite phức tạp — nếu hiện hết đều nhau sẽ thành mớ hỗn độn. Nhưng nếu đơn giản hóa quá sẽ mất giá trị "wow".

*Điều UI/UX cần giải quyết: Làm sao visualize 47 nodes theo cách người xem hiểu ngay cấu trúc, không phải phải dò từng nút?*

**Thách thức 2: Inference là invisible**  
Điểm độc đáo nhất của hệ thống — kỹ năng được "suy luận" từ graph mà không được hỏi trực tiếp — là vô hình với người xem. Nếu không visualize được điều này, họ sẽ nghĩ đây chỉ là quiz bình thường.

*Điều UI/UX cần giải quyết: Cách nào cho thấy sự khác biệt giữa "được test" và "được suy luận"?*

**Thách thức 3: Priority signal**  
Từ 47 kỹ năng, hệ thống chọn 1 kỹ năng để dạy tiếp theo. Người xem cần thấy logic của lựa chọn này — không phải ngẫu nhiên, có lý do cụ thể.

*Điều UI/UX cần giải quyết: Làm sao highlight "kỹ năng được chọn" và lý do chọn mà không làm rối phần còn lại của map?*

### Thông tin cần hiển thị
- Bản đồ trực quan 47 kỹ năng với trạng thái (strong / developing / gap / inferred)
- Thống kê: tổng số kỹ năng được vẽ, breakdown theo loại
- Focus area được xác định: tên cụm kỹ năng + lý do (unlock bao nhiêu kỹ năng liên kết)
- CTA để bắt đầu bài học mục tiêu

### Mock data tham khảo
```
Tổng câu hỏi: 12
Kỹ năng được vẽ: 47
  - Thành thạo (tested): 31
  - Đang phát triển: 8
  - Khoảng trống (gap): 8
  - Suy luận từ dữ liệu: không hiện số, chỉ visual

Focus area: Cụm Phân số
Target skill: Tính đẳng trị phân số
Lý do: "Giải quyết nó sẽ mở khóa 6 kỹ năng liên kết"

Trạng thái các skill mẫu (xem SKILLS array trong frontend_ref):
  - Addition, Subtraction, Multiplication: strong (blue)
  - Fractions, Equivalence, Simplifying: weak (orange) ← focus cluster
  - Variables, Equations, Expressions: inferred (gray, dim)
  - ... (47 skills total, with x/y positions for map layout)
```

### Yêu cầu visual cho bản đồ
Bản đồ phải là **scatter plot node graph**, không phải danh sách hay grid:
- Mỗi node = 1 kỹ năng, có vị trí (x,y) cố định trong không gian 2D
- Màu node = trạng thái skill
- Kích thước node = mức độ confidence (weak nodes nổi bật hơn để kéo attention)
- Edges = quan hệ prerequisite giữa các kỹ năng
- Inferred skills: dim, dashed border — cho thấy "hệ thống biết về chúng nhưng chưa test"
- Skill được chọn: pulse animation, highlight rõ ràng
- Animate reveal: nodes xuất hiện dần, không phải pop up tất cả cùng lúc

---

## 7. Màn hình LEARN — Bài học mục tiêu

### Mục tiêu của màn hình
Dạy đúng một kỹ năng bị thiếu. Ngắn, tập trung, có ví dụ minh họa thực tế. Không phải textbook — phải cảm giác như có một gia sư thông minh đang giải thích riêng cho mình.

### Người dùng và nhu cầu
- **Học sinh:** Cần hiểu concept ngay lần đọc đầu — không đọc lại
- **Người xem demo:** Cần thấy bài học được cá nhân hóa, không phải nội dung chung

### Điều cần đạt được
- Học sinh hiểu "tại sao kỹ năng này quan trọng với mình ngay lúc này"
- Concept được giải thích qua ví dụ trực quan, không phải định nghĩa
- Rõ kết nối giữa bài học và câu hỏi mà học sinh vừa làm
- Học sinh sẵn sàng thử kiểm tra sau khi đọc xong

### Thách thức UX cần giải quyết

**Thách thức 1: Ngắn nhưng đủ**  
Bài học phải đủ ngắn để không overwhelming, nhưng phải đủ để học sinh thực sự hiểu. Không phải copy-paste từ SGK.

*Điều UI/UX cần giải quyết: Hierarchy nội dung như thế nào để học sinh đọc đúng thứ tự và giữ được trọng tâm?*

**Thách thức 2: Toán học cần visual**  
"Phân số đẳng trị" khó hiểu nếu chỉ là text. Cần visual minh họa — nhưng không được quá phức tạp.

*Điều UI/UX cần giải quyết: Visual minh họa nào đơn giản nhất mà vẫn đủ rõ ý?*

**Thách thức 3: "Tại sao học cái này"**  
Học sinh cần hiểu kết nối — kỹ năng này liên quan đến câu hỏi vừa làm thế nào, và sẽ mở khóa gì tiếp theo.

### Thông tin cần hiển thị
- Tên kỹ năng đang học + lý do được chọn
- Core concept: giải thích ngắn
- Visual minh họa: ví dụ cụ thể, trực quan
- Kết nối thực tế: tại sao kỹ năng này cần cho bài toán học sinh vừa gặp
- CTA: chuyển sang kiểm tra

### Mock data tham khảo
```
Kỹ năng mục tiêu: Tính đẳng trị của phân số
Lý do chọn: "Cụm Phân số · Gốc rễ — Mở khóa 6 kỹ năng liên kết"

Core concept: 
  "Hai phân số đẳng trị khi chúng biểu diễn cùng một giá trị — chỉ được viết khác đi."

Visual minh họa (fraction bar):
  1/2 = [■□] 
  2/4 = [■■□□]
  3/6 = [■■■□□□]
  → tất cả đều cùng 1 giá trị

Kết nối thực tế:
  "Để tính 3/4 + 1/2, cần quy đồng mẫu số. 
   1/2 = 2/4 (nhân cả tử và mẫu với 2)"
```

---

## 8. Màn hình MASTERY — Kiểm tra thành thạo

### Mục tiêu của màn hình
Một câu hỏi xác nhận học sinh đã hiểu bài. Không phải bài thi — là checkpoint nhanh. Kết quả ngay lập tức. Nếu đúng → map cập nhật. Nếu sai → khuyến khích thử lại.

### Người dùng và nhu cầu
- **Học sinh:** Cần cảm giác "tôi có thể làm được cái này" — không sợ sai
- **Người xem demo:** Cần thấy rằng hệ thống xác nhận kiến thức thực, không phải chỉ nhớ vẹt

### Điều cần đạt được
- Kết quả tức thì và rõ ràng: đúng hay sai
- Nếu đúng: cảm giác thành tựu (dù nhỏ) — mình đã tiến bộ
- Nếu sai: không thất bại — chỉ là "chưa đủ, hãy thử lại" — giải thích ngắn tại sao sai
- Kết nối trực quan: người xem thấy bước tiếp theo sẽ là bản đồ thay đổi

### Thách thức UX cần giải quyết

**Thách thức 1: Tone khi sai**  
Khi học sinh trả lời sai, phần lớn app giáo dục hiện đỏ, dấu X, hoặc âm thanh fail. Điều này tạo lo lắng và tắt động lực.

*Điều UI/UX cần giải quyết: Feedback "sai" trông như thế nào mà vẫn đủ rõ ràng nhưng không gây nản?*

**Thách thức 2: 1 câu — quá ít?**  
Người xem có thể thắc mắc "chỉ 1 câu mà sao đủ?" — cần communicate rõ đây là checkpoint tập trung, không phải bài thi.

### Thông tin cần hiển thị
- Badge/label: rõ ràng đây là "kiểm tra thành thạo · 1 câu" — không phải test bình thường
- Câu hỏi (liên quan trực tiếp đến kỹ năng vừa học)
- Lựa chọn đáp án
- Feedback ngay sau khi submit: đúng (giải thích tại sao đúng) / sai (chỉ ra đáp án và lý do)
- CTA để chuyển sang kết quả

### Mock data tham khảo
```
Câu hỏi: "Phân số nào đẳng trị với 2/3?"
Loại: MCQ 4 lựa chọn

Lựa chọn:
  A: 4/9   — sai
  B: 4/6   — ĐÚNG
  C: 3/4   — sai
  D: 6/4   — sai

Feedback đúng: "Chính xác! 2/3 = 4/6 vì cả tử số và mẫu số đều nhân với 2."
Feedback sai (ví dụ chọn A): "Chưa đúng. Đáp án là 4/6 — nhân cả 2 và 3 với 2 ta được 4/6."
```

---

## 9. Màn hình OUTCOME — Bản đồ cập nhật

### Mục tiêu của màn hình
Vòng lặp hoàn chỉnh. Bản đồ kiến thức thay đổi thực sự sau khi học. Đây là proof point cuối cùng: hệ thống không chỉ dạy, nó cập nhật model của học sinh.

### Người dùng và nhu cầu
- **Nhà đầu tư:** Cần thấy "à, đây là một hệ thống sống, không phải nội dung tĩnh"
- **Học sinh:** Cần cảm nhận tiến bộ thực sự — cụ thể, không mơ hồ
- **Giáo viên:** Cần thấy bằng chứng có thể trình bày với phụ huynh

### Điều cần đạt được
- Sự thay đổi trên bản đồ phải **nhìn thấy và có ý nghĩa** — không chỉ text thông báo
- Học sinh thấy chính xác những gì đã thay đổi: skill nào từ trạng thái gì sang trạng thái gì
- Cảm giác "hoàn thành" — vòng lặp kép lại thoả mãn
- Rõ bước tiếp theo: học kỹ năng tiếp theo, hoặc xem lại demo

### Thách thức UX cần giải quyết

**Thách thức 1: Thay đổi phải "sống"**  
Nếu chỉ là text "3 kỹ năng được nâng cấp", người xem không cảm nhận được. Phải animation/visual change trên bản đồ.

*Điều UI/UX cần giải quyết: Bản đồ thay đổi như thế nào để người xem ngay lập tức thấy sự khác biệt?*

**Thách thức 2: Không over-celebrate**  
Chỉ học xong 1 kỹ năng — không phải tốt nghiệp. Celebration cần vừa phải, ý nghĩa, không kệch cỡm.

### Thông tin cần hiển thị
- Bản đồ tri thức (cùng layout với MAP screen) — nodes đã được cập nhật màu
- Danh sách skills thay đổi: from → to
- Impact summary: bao nhiêu kỹ năng liên kết đang dần gần tầm với
- 2 CTA: "kỹ năng tiếp theo" và "xem lại demo"

### Mock data tham khảo
```
Skills được nâng cấp:
  Tính đẳng trị:   Khoảng trống → Đang phát triển
  Rút gọn:         Khoảng trống → Có thể tiếp cận
  Cộng/trừ phân số: Khoảng trống → Có thể tiếp cận

Impact: "3 kỹ năng được nâng cấp · 6 kỹ năng liên kết đang gần tầm với"
```

---

## 10. Math Input — Nhập ký hiệu toán học

### Vấn đề cốt lõi
Học sinh lớp 6–9 viết toán bằng tay. Khi chuyển sang màn hình, họ mất đi ngôn ngữ tự nhiên của mình. "Gõ 3/4 vào text box" là yêu cầu mà học sinh phải học cách diễn đạt toán học theo format của máy tính — điều này tạo ra barrier không cần thiết và gây sai số (học sinh đúng nhưng format sai → bị chấm sai).

### Nguyên tắc
- **Input trông như toán học** — phân số trông như phân số, lũy thừa trông như lũy thừa
- **Không syntax** — học sinh không cần biết gõ "3/4" hay "3^2" hay LaTeX
- **Structured fields** — mỗi phần của biểu thức có ô riêng
- **Keyboard-friendly** — Tab giữa các ô, Enter để submit — không cần chuột
- **Tham chiếu: ALEKS** — tiêu chuẩn cao nhất về math input UX

### Các loại widget cần có

**Theo tần suất xuất hiện trong chương trình Grade 6–9:**

---

#### Phân số (Fraction Widget) — Cao nhất

**Vấn đề người dùng:** Học sinh gõ "3 phần 4" hoặc "3/4" tất cả thành text, không rõ định dạng.

**Điều cần đạt được:** Giao diện hiển thị khung phân số thực sự — ô trên cho tử số, gạch ngang, ô dưới cho mẫu số. Học sinh chỉ gõ số vào từng ô.

**Cách navigate:** Tab từ tử số sang mẫu số. Arrow keys ↑↓ để chuyển giữa 2 ô.

**Edge cases cần xử lý:**
- Mẫu số = 0 → warning nhẹ, không crash
- Phân số âm → cần cơ chế chọn dấu âm
- Phân số chưa rút gọn → valid, backend xử lý

---

#### Hỗn số (Mixed Number Widget)

**Vấn đề người dùng:** "2 và 1/3" — học sinh không biết gõ thế nào trong 1 text box.

**Điều cần đạt được:** 3 ô riêng biệt: phần nguyên | tử số | mẫu số. Visual rõ ràng là "số nguyên + phân số".

---

#### Lũy thừa (Power/Exponent Widget)

**Vấn đề người dùng:** "2 mũ 3" — học sinh không biết gõ "2^3" hay "2**3".

**Điều cần đạt được:** Ô lớn cho cơ số, ô nhỏ ở vị trí superscript cho số mũ. Nhìn vào là hiểu ngay đây là lũy thừa.

**Cách navigate:** Tab hoặc Arrow right từ cơ số → số mũ.

---

#### Căn bậc hai (Square Root Widget)

**Vấn đề người dùng:** "√9" — học sinh không có phím này.

**Điều cần đạt được:** Ký hiệu √ hiển thị sẵn, học sinh chỉ gõ số bên dưới dấu căn (radicand).

---

#### Tọa độ (Coordinate Widget)

**Vấn đề người dùng:** "(-3, 5)" — học sinh không biết format nào backend chấp nhận.

**Điều cần đạt được:** Dấu ngoặc `( )` và dấu phẩy `,` hiển thị sẵn. 2 ô input cho x và y. Nhìn vào là tọa độ điểm.

**Edge cases:** Số âm — cần cho phép gõ dấu `-` ở đầu mỗi ô.

---

#### Chọn dấu so sánh (Inequality Sign Widget)

**Vấn đề người dùng:** "3/4 ___ 0.8" — học sinh cần chọn <, > hoặc =.

**Điều cần đạt được:** 3 nút rõ ràng: `<` `>` `=`. Chỉ chọn được 1. Không cần text box.

---

#### Sắp xếp dãy số (Ordered List Widget)

**Vấn đề người dùng:** "Sắp xếp 4 số theo thứ tự tăng dần" — gõ vào 1 text box sẽ rất khó format.

**Điều cần đạt được:** N ô input liên tiếp, ngăn cách bởi dấu `<` hoặc `>` (tùy chiều sắp xếp). Tab di chuyển giữa các ô.

---

#### Biểu thức đại số (Expression Widget) — Grade 7–9

**Vấn đề người dùng:** "Điền vào: 2x + ___ = 7" — học sinh không biết gõ biểu thức.

**Điều cần đạt được:** Template cố định với các ô blank tại đúng chỗ cần điền. Ký tự/biến cố định (x, y, +, −) không gõ được.

---

### Symbol Toolbar (Bộ ký hiệu bổ sung)

Cho các câu hỏi phức tạp hơn, có thanh toolbar ở dưới area nhập — học sinh click để insert ký hiệu:

**Bộ symbols tối thiểu:**
- Phân số (kích hoạt fraction widget)
- Lũy thừa (kích hoạt power widget)
- Căn bậc hai
- Ký hiệu không đều: ≤ ≥ ≠
- Số pi (π), vô cực (∞)
- Xóa (backspace)

**Nguyên tắc:** Toolbar chỉ hiện các symbol liên quan đến loại câu hỏi hiện tại. Không dump tất cả symbols cùng lúc.

---

### Navigation và Accessibility

**Keyboard-first design:**
- Tab: di chuyển thuận chiều giữa các ô trong widget
- Shift+Tab: di chuyển ngược
- Enter từ ô cuối: focus vào nút Submit
- Arrow keys: di chuyển trong widget (↑↓ cho fraction, → cho exponent)

**Mobile (học sinh dùng điện thoại):**
- Touch target tối thiểu đủ lớn để ngón tay chọn được
- Bàn phím số hiện tự động khi focus vào ô số (inputmode=numeric)
- Fraction bar và radical symbol phải đủ lớn để nhìn thấy rõ trên màn hình nhỏ

---

## 11. Shell — App Header (Persistent)

### Mục tiêu
Định hướng người dùng trong suốt flow. Luôn biết mình đang ở đâu trong vòng lặp 5 bước.

### Điều cần đạt được
- Nhìn một lần vào header → biết ngay mình đang ở bước nào (trong 5 bước)
- Không chiếm quá nhiều vertical space — content quan trọng hơn
- Consistent trên mọi màn hình — người xem bám vào header như "bản đồ phụ"

### Thông tin cần hiển thị
- Brand identity (logo)
- Step progress: 5 bước, trạng thái từng bước (đã qua / đang ở / chưa đến)
- Context học sinh (tên, lớp) — optional, chỉ khi có session thực

### Thách thức
- 5 bước trên header bar hẹp — trên mobile có thể không đủ chỗ
- Phải cân bằng giữa "luôn hiện" và "không lấn át content"

---

## 12. Pitch Demo Mode

### Mục tiêu
Cho phép chạy demo mà không cần internet / backend, với data mock sẵn. Dùng trong pitch meetings.

### Điều cần đạt được
- Một nút bấm (luôn visible trên header hoặc landing page) để bắt đầu pitch demo
- Pitch demo chạy qua đầy đủ 5 bước với data cố định
- Transition và animation giống hệt demo thực
- Không có lỗi, không có loading spinner kéo dài

### Cân nhắc
- Có nên có chế độ "auto-advance" (tự chuyển màn sau N giây) cho presenter không cần click?
- Pitch demo nên dùng data "ấn tượng nhất" — số liệu, story, tên học sinh đã được chọn kỹ

---

## 13. Những gì KHÔNG thiết kế

- ❌ Clone Duolingo (gamification, XP bars, streaks vô nghĩa)
- ❌ Clone Kahoot (quiz format, countdown timer, leaderboard)
- ❌ Dark, dense, complex — đây là sản phẩm cho học sinh 11–15 tuổi và giáo viên, không phải dashboard analytics
- ❌ Text-heavy screens — nếu phải đọc nhiều mới hiểu, design chưa xong
- ❌ Static number score (67/100) — Wizzdom không đánh giá bằng điểm số

---

## 14. Định nghĩa thành công

**Demo flow:**
- Người xem hiểu value proposition sau 30 giây, không cần nghe giải thích
- Họ hỏi "cái này dùng thật chưa?" không phải "cái này là gì?"

**Học sinh:**
- Nhập toán học tự nhiên như viết trên vở
- Không hỏi "tôi phải gõ như thế nào?"
- Không cảm thấy bị thi hay bị phán xét

**Giáo viên:**
- Nhìn vào bản đồ tri thức và hiểu ngay học sinh đang ở đâu
- Có thể giải thích cho phụ huynh chỉ bằng cách show map

---

## Appendix: Mock Data tổng hợp

### Student profile
```
Tên: Minh
Lớp: 8A
Session: đang học algebra / phân số
```

### Assessment
```
Tổng câu: 12
Câu mẫu 7: "Rút gọn: 3/4 + 1/2 = ?"
Widget: fraction
```

### Knowledge Map (47 skills)
```
Clusters:
  Operations (Addition, Subtraction, Multiplication, Division, Estimation...): mostly strong
  Number sense (Place Value, Rounding, Comparing, Negative Nums...): strong/medium
  Fractions (Fractions, Equivalence, Simplifying, Mixed Numbers, Fraction +/−...): WEAK → focus
  Algebra (Variables, Equations, Expressions, Inequalities...): inferred (gray)
  Geometry (Shapes, Perimeter, Area, Volume, Angles...): strong/medium
  Measurement (Units, Time, Money, Temperature...): strong
  Data (Graphs, Mean/Median, Probability...): inferred

Target: Equivalence (phân số đẳng trị)
Reason: root skill of Fractions cluster, unlocks 6 connected skills
```

### Learning Loop
```
Skill: Fraction Equivalence
Concept: "Hai phân số đẳng trị khi biểu diễn cùng 1 giá trị"
Example: 1/2 = 2/4 = 3/6
Rule: nhân/chia cả tử và mẫu với cùng 1 số
Connection: cần để tính 3/4 + 1/2

Mastery Q: "Phân số nào đẳng trị với 2/3?"
Correct: 4/6

Outcome:
  Equivalence:   Khoảng trống → Đang phát triển
  Simplifying:   Khoảng trống → Có thể tiếp cận
  Fraction +/−:  Khoảng trống → Có thể tiếp cận
  Impact: 6 connected skills now within reach
```

---

*Version 1.0 — Consolidated PRD for UI/UX Team*  
*Tổng hợp từ: product_requirements.md + wizzdom_prd.md + math_input_widgets.md*  
*Không bao gồm: wireframes, code specs, font sizes, hex colors*
