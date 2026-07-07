# Grade 8 Exam Root-Cause Scope, Re-derived

Updated: 2026-07-06T14:12:00.939828+00:00

## Why This File Exists

The older mapping document said the Grade 8 exam touched 72 related nodes, but it did not save that exact list. This file makes the scope explicit and auditable.

Grounding:

- Source mapping: `docs/grade8_exam_question_node_mapping.md`.
- Student signal: the student solved only I.1, direct substitution into `A = x/(x+5)` at `x = 3`; all other tasks were not solved.
- Scope intent: diagnose root causes from Grade 8 tasks down into Grade 7 and Grade 6 foundations, especially fractions, signs/parentheses, algebraic expressions, equations, percent modeling, and linear functions.

## Counts

- Full related scope: **75 nodes**.
- Core diagnostic scope: **37 nodes**.
- Foundation priority scope, Grade 6-7: **47 nodes**.
- Direct item coverage today: **75 nodes**.
- Inference-only until more items are generated: **0 nodes**.
- Internal prerequisite edges inside this scope: **88 edges**.

## Interpretation

This is not a promise that one 30-35 question assessment can directly test all nodes. The assessment should use the full scope as the reportable/inference graph, while direct questions prioritize the core and Grade 6-7 foundation nodes most likely to explain the student's failure on I.2, II.1, II.2, III.1, and III.2.

## Exam Question To Node Map

### I.1

- Student signal: `student_correct`
- Task: Compute A = x/(x+5) at x = 3.
- Primary nodes: `G8-MATH-TINH-GIA-TRI`

### I.2

- Student signal: `student_unknown`
- Task: Prove B = (x - 2)/x from a rational-expression identity.
- Primary nodes: `G8-MATH-NHAN-BIET-PHAN`, `G8-MATH-XAC-DINH-DIEU`, `G8-MATH-XAC-DINH-MAU`, `G8-MATH-QUY-DONG-MAU`, `G8-MATH-RUT-GON-PHAN`, `G8-MATH-NHAN-DANG-A`, `G8-MATH-PHAN-TICH-DA`

### II.1a

- Student signal: `student_unknown`
- Task: Solve 3(x - 2) + 5 = 2x.
- Primary nodes: `G8-MATH-GIAI-PHUONG-TRINH`, `G7-MATH-QUY-TAC-CHUYEN`, `G6-MATH-BO-DAU-NGOAC`

### II.1b

- Student signal: `student_unknown`
- Task: Solve (x - 2)/3 + (2x - 3)/6 = 1.
- Primary nodes: `G8-MATH-GIAI-PHUONG-TRINH`, `G6-MATH-QUY-DONG-MAU`, `G6-MATH-CONG-HAI-PHAN-1`, `G7-MATH-QUY-TAC-CHUYEN`

### II.2

- Student signal: `student_unknown`
- Task: Set up and solve a savings-interest word problem.
- Primary nodes: `G7-MATH-VIET-BIEU-THUC`, `G7-MATH-NHAN-BIET-BIEU`, `G6-MATH-B31K2`, `G6-MATH-TIM-GIA-TRI-1`, `G8-MATH-GIAI-PHUONG-TRINH`

### III.1

- Student signal: `student_unknown`
- Task: Draw the graph of y = 2x - 4.
- Primary nodes: `G8-MATH-NHAN-BIET-HAM`, `G8-MATH-TINH-HOAC-XAC`, `G8-MATH-BIEU-DIEN-DIEM`, `G8-MATH-BIEU-DIEN-DO`, `G8-MATH-VE-DO-THI`

### III.2

- Student signal: `student_unknown`
- Task: Find m so y = 2x - 4 is parallel to y = (m^2 + 1)x + m - 3.
- Primary nodes: `G8-MATH-NHAN-BIET-HAM`, `G8-MATH-XAC-DINH-QUAN`, `G8-MATH-NHAN-BIET-HUONG`

## Strand Scope

### fraction_percent_foundations_g6

- `G6-MATH-NHAN-BIET-PHAN-1` · G6 · Nhận biết phân số có tử và mẫu là số nguyên, mẫu khác 0 · core, direct item
- `G6-MATH-NHAN-BIET-HAI` · G6 · Kiểm tra hai phân số bằng nhau bằng điều kiện nhân chéo -  a·d = b·c · core, direct item
- `G6-MATH-TINH-CHAT-CO` · G6 · Áp dụng tính chất cơ bản của phân số bằng cách nhân hoặc chia cả tử và mẫu với cùng một số nguyên khác 0 · core, direct item
- `G6-MATH-RUT-GON-VE` · G6 · Rút gọn về phân số tối giản · context, direct item
- `G6-MATH-QUY-DONG-MAU` · G6 · Quy đồng mẫu các phân số có tử/mẫu nguyên bằng cách đưa về các phân số bằng nhau cùng mẫu dương · core, direct item
- `G6-MATH-CONG-HAI-PHAN` · G6 · Cộng hai phân số cùng mẫu  · context, direct item
- `G6-MATH-CONG-HAI-PHAN-1` · G6 · Cộng hai phân số khác mẫu bằng cách quy đồng mẫu · core, direct item
- `G6-MATH-TRU-HAI-PHAN` · G6 · Trừ hai phân số cùng mẫu · context, direct item
- `G6-MAMATMATHMAT` · G6 · Trừ hai phân số khác mẫu · core, direct item
- `G6-MATH-NHAN-HAI-PHAN` · G6 · Nhân hai phân số  · context, direct item
- `G6-MATH-CHIA-HAI-PHAN` · G6 · Chia hai phân số  · context, direct item
- `G6-MATH-PHAN-SO-NGHICH` · G6 · Phân số nghịch đảo  · context, direct item
- `G6-MATH-SO-DOI-CUA` · G6 · Xác định số đối của phân số · context, direct item
- `G6-MATH-B31K2` · G6 · Tính tỉ số của hai số và viết dưới dạng tỉ số phần trăm · core, direct item
- `G6-MATH-TIM-GIA-TRI-1` · G6 · Tìm giá trị phần trăm của một số · core, direct item
- `G6-MATH-TIM-MOT-SO` · G6 · Tìm một số biết giá trị phần trăm · core, direct item
- `G6-MATH-TIM-GIA-TRI` · G6 · Tìm giá trị phân số của một số · context, direct item
- `G6-MATH-TIM-MOT-SO-1` · G6 · Tìm một số biết giá trị phân số của nó · context, direct item

### integer_parentheses_foundations_g6

- `G6-MATH-NHAN-BIET-DOC` · G6 · Nhận biết, đọc và viết số nguyên âm · context, direct item
- `G6-MATH-NHAN-BIET-SO-1` · G6 · Xác định số đối của một số nguyên · context, direct item
- `G6-MATH-CONG-HAI-SO` · G6 · Cộng hai số nguyên âm · context, direct item
- `G6-MATH-CONG-HAI-SO-1` · G6 · Cộng hai số nguyên khác dấu  · context, direct item
- `G6-MATH-TU-CHO-SO` · G6 · Trừ hai số nguyên · context, direct item
- `G6-MATH-NHAN-HAI-SO` · G6 · Nhân hai số nguyên khác dấu  · context, direct item
- `G6-MATH-NHAN-HAI-SO-1` · G6 · Nhân hai số nguyên cùng dấu · context, direct item
- `G6-MATH-THUC-HIEN-PHEP` · G6 · Thực hiện phép chia hết hai số nguyên - xác định đúng dấu của thương · context, direct item
- `G6-MATH-BO-DAU-NGOAC` · G6 · Bỏ dấu ngoặc có dấu + đằng trước  · core, direct item
- `G6-MATH-BO-DAU-NGOAC-1` · G6 · Bỏ dấu ngoặc có dấu - đằng trước · core, direct item
- `G6-MATH-BO-NGOAC-LONG` · G6 · Bỏ ngoặc lồng nhau  · context, direct item
- `G6-MATH-PHAN-PHOI-NHAN` · G6 · Nhận biết và áp dụng tính chất phân phối: a×(b+c) = a×b + a×c · context, direct item
- `G6-MATH-AP-DUNG-DUNG` · G6 · Áp dụng đúng thứ tự phép tính KHÔNG có ngoặc Thứ tự: lũy thừa → nhân chia → cộng trừ (trái sang phải khi cùng cấp) · context, direct item
- `G6-MATH-AP-DUNG-DUNG-1` · G6 · Áp dụng đúng thứ tự phép tính CÓ ngoặc (bao gồm ngoặc lồng nhiều cấp) Thứ tự ngoặc: {} → [] → () · context, direct item

### algebra_foundations_g7

- `G9-MATH-NHAN-BIET-SO-1` · G7 · Nhận biết số hữu tỉ và viết dưới dạng phân số a/b (a,b∈ℤ, b≠0) · context, direct item
- `G7-MATH-KHAI-NIEM-DANG` · G7 · Khái niệm đẳng thức và tính chất · core, direct item
- `G7-MATH-QUY-TAC-CHUYEN` · G7 · Quy tắc chuyển vế — tìm x trong đẳng thức · core, direct item
- `G7-MATH-NHAN-BIET-BIEU` · G7 · Nhận biết biểu thức đại số · core, direct item
- `G7-MATH-TINH-GIA-TRI-1` · G7 · Tính giá trị biểu thức đại số · core, direct item
- `G7-MATH-VIET-BIEU-THUC` · G7 · Viết biểu thức đại số biểu thị quan hệ từ ngữ cảnh thực tế hoặc bài toán hình học · core, direct item
- `G7-MATH-NHAN-BIET-DON` · G7 · Nhận biết đơn thức một biến - xác định hệ số và bậc · context, direct item
- `G7-MATH-NHAN-BIET-DA` · G7 · Nhận biết đa thức của một biến, xác định hạng tử · context, direct item
- `G7-MATH-THU-GON-DA` · G7 · Thu gọn đa thức · context, direct item
- `G7-MATH-CONG-HAI-DA` · G7 · Cộng hai đa thức: bỏ ngoặc, nhóm hạng tử cùng bậc từ cả hai đa thức, thu gọn · context, direct item
- `G7-MATH-TRU-HAI-DA` · G7 · Trừ hai đa thức: bỏ ngoặc đổi dấu tất cả hạng tử của đa thức trừ, nhóm, thu gọn · context, direct item
- `G7-MATH-NHAN-DON-THUC` · G7 · Nhân đơn thức với đa thức · context, direct item
- `G7-MATH-NHAN-DA-THUC` · G7 · Nhân đa thức với đa thức · context, direct item
- `G7-MATH-CHIA-HAI-DON` · G7 · Chia hai đơn thức: tách hệ số chia hệ số, lũy thừa chia lũy thừa, ghép kết quả · context, direct item
- `G7-MATH-SAP-XEP-DA` · G7 · Sắp xếp đa thức theo lũy thừa giảm: · context, direct item

### rational_expression_g8

- `G8-MATH-TINH-GIA-TRI` · G8 · Tính giá trị của phân thức · context, direct item
- `G8-MATH-NHAN-BIET-PHAN` · G8 · Nhận biết phân thức đại số, xác định tử thức, mẫu thức · core, direct item
- `G8-MATH-XAC-DINH-DIEU` · G8 · Xác định điều kiện xác định của phân thức · core, direct item
- `G8-MATH-KIEM-TRA-HAI` · G8 · Kiểm tra hai phân thức bằng nhau bằng điều kiện tích chéo · core, direct item
- `G8-MATH-XAC-DINH-MAU` · G8 · Xác định mẫu thức chung và nhân tử phụ · core, direct item
- `G8-MATH-QUY-DONG-MAU` · G8 · Quy đồng mẫu thức nhiều phân thức · core, direct item
- `G8-MATH-RUT-GON-PHAN` · G8 · Rút gọn phân thức bằng nhân tử chung · core, direct item
- `G8-MATH-NHAN-BIET-DA` · G8 · Nhận biết đa thức nhiều biến và xác định các hạng tử · core, direct item
- `G8-MATH-THU-GON-DA` · G8 · Thu gọn đa thức nhiều biến bằng cách nhóm hạng tử đồng dạng · core, direct item
- `G8-MATH-PHAN-TICH-DA` · G8 · Phân tích đa thức thành nhân tử bằng cách đặt nhân tử chung · core, direct item
- `G8-MATH-NHAN-DANG-A` · G8 · Nhận dạng A² - B² và viết thành (A - B)(A + B) · core, direct item
- `G8-MATH-BIEN-DOI-TICH` · G8 · Biến đổi tích (A - B)(A + B) thành A² - B² · context, direct item

### equation_modeling_g8

- `G8-MATH-NHAN-BIET-PHUONG` · G8 · Nhận biết phương trình 1 ẩn · core, direct item
- `G8-MATH-NHAN-BIET-PHUONG-1` · G8 · Nhận biết phương trình bậc nhất một ẩn · core, direct item
- `G8-MATH-KIEM-TRA-GIA` · G8 · Kiểm tra giá trị là nghiệm của phương trình 1 ẩn · core, direct item
- `G8-MATH-GIAI-PHUONG-TRINH` · G8 · Giải phương trình bậc nhất một ẩn dạng ax+b=0 · core, direct item

### linear_function_graph_g8

- `G8-MATH-NHAN-BIET-HAM` · G8 · Nhận biết hàm số bậc nhất và xác định hệ số a,b. · core, direct item
- `G8-MATH-TINH-HOAC-XAC` · G8 · Tính hoặc xác định giá trị hàm số tại một giá trị của biến · core, direct item
- `G8-MATH-BIEU-DIEN-DIEM` · G8 · Biểu diễn điểm trên mặt phẳng tọa độ khi biết tọa độ · core, direct item
- `G8-MATH-BIEU-DIEN-DO` · G8 · Biểu diễn đồ thị hàm số từ bảng giá trị · core, direct item
- `G8-MATH-VE-DO-THI` · G8 · Vẽ đồ thị hàm số bậc nhất bằng đường thẳng đi qua hai điểm thuộc đồ thị. · core, direct item
- `G8-MATH-XAC-DINH-QUAN` · G8 · Xác định quan hệ song song, cắt nhau hoặc trùng nhau của hai đường thẳng từ hệ số trong phương trình. · core, direct item
- `G8-MATH-NHAN-BIET-HUONG` · G8 · Nhận biết hướng của đường thẳng từ dấu của hệ số góc. · core, direct item

### polynomial_support_g8

- `G8-MATH-NHAN-BIET-DON` · G8 · Nhận biết đơn thức nhiều biến và phân biệt với biểu thức không phải đơn thức · context, direct item
- `G8-MATH-NHAN-BIET-CAC` · G8 · Nhận biết các đơn thức đồng dạng  · context, direct item
- `G8-MATH-CONG-HAI-DA` · G8 · Cộng hai đa thức nhiều biến · context, direct item
- `G8-MATH-TRU-HAI-DA` · G8 · Trừ hai đa thức nhiều biến · context, direct item
- `G8-MATH-NHAN-DON-THUC` · G8 · Nhân đơn thức với đa thức nhiều biến bằng cách phân phối vào từng hạng tử · context, direct item

## Full Node Audit

### Grade 6

| Code | Node name | Diagnostic role | Direct item? | Description excerpt |
|---|---|---|---|---|
| `G6-MATH-NHAN-BIET-PHAN-1` | Nhận biết phân số có tử và mẫu là số nguyên, mẫu khác 0 | core | yes | Học sinh có thể nhận biết đúng một biểu thức dạng  b a 	​   là phân số khi a,b là số nguyên và b  =0, đồng thời xác định đúng tử số, mẫu số và các trường hợp không phải phân số do... |
| `G6-MATH-NHAN-BIET-HAI` | Kiểm tra hai phân số bằng nhau bằng điều kiện nhân chéo -  a·d = b·c | core | yes | Học sinh có thể xác định đúng hai phân số a/b và c/d có bằng nhau hay không bằng cách kiểm tra điều kiện nhân chéo a⋅d=b⋅c, với b,d khác 0.  Học sinh được dậy:  Nếu b và d khác 0 t... |
| `G6-MATH-TINH-CHAT-CO` | Áp dụng tính chất cơ bản của phân số bằng cách nhân hoặc chia cả tử và mẫu với cùng một số nguyên khác 0 | core | yes | Học sinh có thể tạo phân số bằng phân số đã cho bằng cách nhân hoặc chia cả tử và mẫu với cùng một số nguyên khác 0, đồng thời xử lý đúng dấu trong trường hợp số nhân hoặc số chia ... |
| `G6-MATH-RUT-GON-VE` | Rút gọn về phân số tối giản | context/root-cause | yes | Kỹ năng: Học sinh có thể rút gọn một phân số về phân số tối giản bằng cách chia cả tử và mẫu cho ƯCLN của chúng, và xác định đúng một phân số đã là tối giản hay chưa. Học sinh được... |
| `G6-MATH-QUY-DONG-MAU` | Quy đồng mẫu các phân số có tử/mẫu nguyên bằng cách đưa về các phân số bằng nhau cùng mẫu dương | core | yes | Quy đồng mẫu các phân số có tử/mẫu nguyên bằng cách đưa về các phân số bằng nhau cùng mẫu dương Sau khi chọn mẫu chung, nhân cả tử và mẫu của mỗi phân số với cùng một số nguyên khá... |
| `G6-MATH-CONG-HAI-PHAN` | Cộng hai phân số cùng mẫu  | context/root-cause | yes | Kỹ năng: Học sinh có thể cộng đúng hai phân số cùng mẫu bằng cách giữ nguyên mẫu số và cộng hai tử số, sau đó rút gọn kết quả nếu cần.  Học sinh được dạy:  Muốn cộng hai phân số cù... |
| `G6-MATH-CONG-HAI-PHAN-1` | Cộng hai phân số khác mẫu bằng cách quy đồng mẫu | core | yes | Kỹ năng: Học sinh có thể cộng đúng hai phân số khác mẫu bằng cách quy đồng mẫu hai phân số, cộng hai phân số cùng mẫu sau quy đồng, và rút gọn kết quả nếu cần.  Học sinh được dạy: ... |
| `G6-MATH-TRU-HAI-PHAN` | Trừ hai phân số cùng mẫu | context/root-cause | yes | Kỹ năng: Học sinh có thể trừ đúng hai phân số cùng mẫu bằng cách giữ nguyên mẫu số và trừ hai tử số, hoặc chuyển phép trừ thành phép cộng với phân số đối rồi cộng hai phân số cùng ... |
| `G6-MAMATMATHMAT` | Trừ hai phân số khác mẫu | core | yes | Học sinh có thể trừ đúng hai phân số khác mẫu bằng cách quy đồng mẫu hai phân số, sau đó trừ hai phân số cùng mẫu, xử lý đúng dấu của phân số trừ và rút gọn kết quả nếu cần.  Học s... |
| `G6-MATH-NHAN-HAI-PHAN` | Nhân hai phân số  | context/root-cause | yes | Tên hiện tại “Nhân hai phân số” ổn, nhưng nếu muốn chuẩn hơn theo rule tên KC thì nên dùng tên trên.  Kỹ năng: Học sinh có thể nhân đúng hai phân số bằng cách nhân tử số với tử số,... |
| `G6-MATH-CHIA-HAI-PHAN` | Chia hai phân số  | context/root-cause | yes | Kỹ năng: Học sinh có thể chia đúng hai phân số bằng cách giữ nguyên phân số bị chia, đổi phép chia thành phép nhân với phân số nghịch đảo của phân số chia, rồi thực hiện phép nhân ... |
| `G6-MATH-PHAN-SO-NGHICH` | Phân số nghịch đảo  | context/root-cause | yes | Học sinh có thể xác định đúng phân số nghịch đảo của một phân số khác 0 bằng cách đổi chỗ tử số và mẫu số, đồng thời nhận biết điều kiện chỉ phân số khác 0 mới có phân số nghịch đả... |
| `G6-MATH-SO-DOI-CUA` | Xác định số đối của phân số | context/root-cause | yes | Kỹ năng: Học sinh có thể xác định đúng số đối của một phân số, nhận biết hai phân số đối nhau có tổng bằng 0, và viết đúng các dạng tương đương của số đối.  Học sinh được dạy:  Hai... |
| `G6-MATH-B31K2` | Tính tỉ số của hai số và viết dưới dạng tỉ số phần trăm | core | yes | Kỹ năng: Học sinh có thể tính tỉ số của hai số bằng phép chia, sau đó viết tỉ số đó dưới dạng tỉ số phần trăm khi cần.  Học sinh được dạy:  Tỉ số của hai số a và b, với b khác 0, l... |
| `G6-MATH-TIM-GIA-TRI-1` | Tìm giá trị phần trăm của một số | core | yes | Kỹ năng: Học sinh có thể tìm đúng p% của một số m bằng cách đổi p% thành p/100 hoặc số thập phân rồi nhân với m.  Học sinh được dạy:  p% nghĩa là p/100. Muốn tìm p% của m, ta tính:... |
| `G6-MATH-TIM-MOT-SO` | Tìm một số biết giá trị phần trăm | core | yes | Kỹ năng: Học sinh có thể tìm đúng số ban đầu khi biết p% của số đó bằng m, bằng cách lấy m chia cho p/100.  Học sinh được dạy:  Nếu p% của một số là m, thì số đó bằng: m : p/100 Vì... |
| `G6-MATH-TIM-GIA-TRI` | Tìm giá trị phân số của một số | context/root-cause | yes | Học sinh có thể tìm đúng giá trị a/b của một số m bằng cách nhân số đó với phân số a/b, trong đó b khác 0.  Học sinh được dạy:  “Tìm a/b của m” nghĩa là lấy m nhân với a/b. Công th... |
| `G6-MATH-TIM-MOT-SO-1` | Tìm một số biết giá trị phân số của nó | context/root-cause | yes | Kỹ năng: Học sinh có thể tìm đúng số ban đầu khi biết a/b của số đó bằng m, bằng cách lấy m chia cho a/b, trong đó a/b khác 0.  Học sinh được dạy:  Nếu a/b của một số là m, thì số ... |
| `G6-MATH-NHAN-BIET-DOC` | Nhận biết, đọc và viết số nguyên âm | context/root-cause | yes | Kỹ năng: Học sinh có thể nhận biết số nguyên âm qua ngữ cảnh thực tế, đọc đúng tên (âm một, âm hai...) và viết đúng ký hiệu (-1, -2, -3...), phân biệt được số nguyên âm với số tự n... |
| `G6-MATH-NHAN-BIET-SO-1` | Xác định số đối của một số nguyên | context/root-cause | yes | Kỹ năng: Học sinh có thể xác định đúng số đối của một số nguyên, nhận ra hai số đối nhau nằm cách đều 0 trên trục số và có tổng bằng 0. Học sinh được dạy: Số đối của a là số mà cộn... |
| `G6-MATH-CONG-HAI-SO` | Cộng hai số nguyên âm | context/root-cause | yes | Kỹ năng: Học sinh có thể thực hiện đúng phép cộng hai số nguyên âm bằng cách cộng hai giá trị tuyệt đối của chúng rồi đặt dấu âm trước kết quả. Học sinh được dạy: Khi cộng hai số n... |
| `G6-MATH-CONG-HAI-SO-1` | Cộng hai số nguyên khác dấu  | context/root-cause | yes | Học sinh có thể thực hiện đúng phép cộng hai số nguyên khác dấu bằng cách lấy hiệu hai giá trị tuyệt đối rồi gắn dấu của số có giá trị tuyệt đối lớn hơn. Học sinh được dạy: Khi cộn... |
| `G6-MATH-TU-CHO-SO` | Trừ hai số nguyên | context/root-cause | yes | Kỹ năng: Học sinh có thể thực hiện đúng phép trừ hai số nguyên bằng cách viết phép trừ thành phép cộng với số đối của số trừ - KHÔNG CẦN TÍNH KẾT QỦA, MUỐN TÍNH KẾT QUẢ THÌ PHẢITCẦ... |
| `G6-MATH-NHAN-HAI-SO` | Nhân hai số nguyên khác dấu  | context/root-cause | yes | Kỹ năng: Học sinh có thể thực hiện đúng phép nhân hai số nguyên khác dấu bằng cách nhân hai giá trị tuyệt đối rồi đặt dấu âm cho tích.  Học sinh được dạy:  Khi nhân hai số nguyên k... |
| `G6-MATH-NHAN-HAI-SO-1` | Nhân hai số nguyên cùng dấu | context/root-cause | yes | Kỹ năng: Học sinh có thể thực hiện đúng phép nhân hai số nguyên cùng dấu bằng cách nhân hai giá trị tuyệt đối rồi đặt dấu dương cho tích.  Học sinh được dạy:  Khi nhân hai số nguyê... |
| `G6-MATH-THUC-HIEN-PHEP` | Thực hiện phép chia hết hai số nguyên - xác định đúng dấu của thương | context/root-cause | yes | Kỹ năng: Học sinh có thể thực hiện đúng phép chia hết giữa hai số nguyên, xác định đúng dấu của thương dựa trên dấu của số bị chia và số chia, đồng thời tính đúng phần giá trị tuyệ... |
| `G6-MATH-BO-DAU-NGOAC` | Bỏ dấu ngoặc có dấu + đằng trước  | core | yes | Kỹ năng: Học sinh có thể bỏ đúng dấu ngoặc trong biểu thức có dấu “+” đứng ngay trước ngoặc, giữ nguyên dấu của tất cả các số hạng bên trong ngoặc và viết được biểu thức tương đươn... |
| `G6-MATH-BO-DAU-NGOAC-1` | Bỏ dấu ngoặc có dấu - đằng trước | core | yes | Kỹ năng: Học sinh có thể bỏ đúng dấu ngoặc trong biểu thức có dấu “−” đứng ngay trước ngoặc, đổi dấu tất cả các số hạng bên trong ngoặc và viết được biểu thức tương đương sau khi b... |
| `G6-MATH-BO-NGOAC-LONG` | Bỏ ngoặc lồng nhau  | context/root-cause | yes | Kỹ năng: Học sinh có thể bỏ đúng các lớp ngoặc lồng nhau trong biểu thức chứa phép cộng và phép trừ, bằng cách xử lý lần lượt từng lớp ngoặc, áp dụng đúng quy tắc bỏ ngoặc có dấu “... |
| `G6-MATH-PHAN-PHOI-NHAN` | Nhận biết và áp dụng tính chất phân phối: a×(b+c) = a×b + a×c | context/root-cause | yes | Kỹ năng: Học sinh có thể nhận biết tính chất phân phối của phép nhân đối với phép cộng, và áp dụng đúng theo cả hai chiều: khai triển a×(b+c) thành a×b + a×c, và ngược lại thu gọn ... |
| `G6-MATH-AP-DUNG-DUNG` | Áp dụng đúng thứ tự phép tính KHÔNG có ngoặc Thứ tự: lũy thừa → nhân chia → cộng trừ (trái sang phải khi cùng cấp) | context/root-cause | yes | Kỹ năng: Học sinh có thể tính đúng giá trị biểu thức số không có ngoặc bằng cách áp dụng đúng thứ tự ưu tiên: lũy thừa trước, rồi nhân/chia, cuối cùng cộng/trừ; các phép tính cùng ... |
| `G6-MATH-AP-DUNG-DUNG-1` | Áp dụng đúng thứ tự phép tính CÓ ngoặc (bao gồm ngoặc lồng nhiều cấp) Thứ tự ngoặc: {} → [] → () | context/root-cause | yes | Kỹ năng: Học sinh có thể tính đúng giá trị biểu thức có ngoặc — bao gồm một cấp và nhiều cấp lồng nhau — bằng cách tính từ ngoặc trong cùng ra ngoài, kết hợp đúng với thứ tự ưu tiê... |

### Grade 7

| Code | Node name | Diagnostic role | Direct item? | Description excerpt |
|---|---|---|---|---|
| `G9-MATH-NHAN-BIET-SO-1` | Nhận biết số hữu tỉ và viết dưới dạng phân số a/b (a,b∈ℤ, b≠0) | context/root-cause | yes | + Tìm số đối |
| `G7-MATH-KHAI-NIEM-DANG` | Khái niệm đẳng thức và tính chất | core | yes | No production description yet. |
| `G7-MATH-QUY-TAC-CHUYEN` | Quy tắc chuyển vế — tìm x trong đẳng thức | core | yes | No production description yet. |
| `G7-MATH-NHAN-BIET-BIEU` | Nhận biết biểu thức đại số | core | yes | Khái niệm biểu thức đại số, biến, cách viết cách biến |
| `G7-MATH-TINH-GIA-TRI-1` | Tính giá trị biểu thức đại số | core | yes | No production description yet. |
| `G7-MATH-VIET-BIEU-THUC` | Viết biểu thức đại số biểu thị quan hệ từ ngữ cảnh thực tế hoặc bài toán hình học | core | yes | No production description yet. |
| `G7-MATH-NHAN-BIET-DON` | Nhận biết đơn thức một biến - xác định hệ số và bậc | context/root-cause | yes | No production description yet. |
| `G7-MATH-NHAN-BIET-DA` | Nhận biết đa thức của một biến, xác định hạng tử | context/root-cause | yes | No production description yet. |
| `G7-MATH-THU-GON-DA` | Thu gọn đa thức | context/root-cause | yes | No production description yet. |
| `G7-MATH-CONG-HAI-DA` | Cộng hai đa thức: bỏ ngoặc, nhóm hạng tử cùng bậc từ cả hai đa thức, thu gọn | context/root-cause | yes | No production description yet. |
| `G7-MATH-TRU-HAI-DA` | Trừ hai đa thức: bỏ ngoặc đổi dấu tất cả hạng tử của đa thức trừ, nhóm, thu gọn | context/root-cause | yes | No production description yet. |
| `G7-MATH-NHAN-DON-THUC` | Nhân đơn thức với đa thức | context/root-cause | yes | No production description yet. |
| `G7-MATH-NHAN-DA-THUC` | Nhân đa thức với đa thức | context/root-cause | yes | No production description yet. |
| `G7-MATH-CHIA-HAI-DON` | Chia hai đơn thức: tách hệ số chia hệ số, lũy thừa chia lũy thừa, ghép kết quả | context/root-cause | yes | No production description yet. |
| `G7-MATH-SAP-XEP-DA` | Sắp xếp đa thức theo lũy thừa giảm: | context/root-cause | yes | No production description yet. |

### Grade 8

| Code | Node name | Diagnostic role | Direct item? | Description excerpt |
|---|---|---|---|---|
| `G8-MATH-TINH-GIA-TRI` | Tính giá trị của phân thức | context/root-cause | yes | Mô tả: Học sinh thay giá trị của biến vào phân thức, kiểm tra mẫu khác 0, rồi tính giá trị biểu thức số nhận được.  Ví dụ:  (x² - x - 1)/(x² + 3x)  tại x = 2:  (2² - 2 - 1)/(2² + 3... |
| `G8-MATH-NHAN-BIET-PHAN` | Nhận biết phân thức đại số, xác định tử thức, mẫu thức | core | yes | Mô tả: Học sinh nhận biết được biểu thức dạng A/B, trong đó A, B là đa thức và B không phải đa thức 0; xác định được tử thức và mẫu thức. Đồng thời biết mỗi đa thức cũng là một phâ... |
| `G8-MATH-XAC-DINH-DIEU` | Xác định điều kiện xác định của phân thức | core | yes | No production description yet. |
| `G8-MATH-KIEM-TRA-HAI` | Kiểm tra hai phân thức bằng nhau bằng điều kiện tích chéo | core | yes | Mô tả: Học sinh dùng quy tắc:  A/B = C/D nếu AD = BC  để kiểm tra hoặc giải thích hai phân thức bằng nhau.  Ví dụ:  (1 + x)/(1 - x²) = 1/(1 - x)  vì:  (1 + x)(1 - x) = 1 - x² |
| `G8-MATH-XAC-DINH-MAU` | Xác định mẫu thức chung và nhân tử phụ | core | yes | Mới ở đâu so với quy đồng phân số?  Ở phân số, mẫu là số:  6, 8, 12  Mẫu chung là BCNN.  Ở phân thức, mẫu là đa thức đã phân tích thành nhân tử:  5x²(x + 1) 2x(x + 1)²  MTC là:  10... |
| `G8-MATH-QUY-DONG-MAU` | Quy đồng mẫu thức nhiều phân thức | core | yes | Mới ở đâu?  Sau khi tìm được MTC, học sinh phải nhân cả tử và mẫu với nhân tử phụ là một biểu thức đại số.  Ví dụ:  3/[5x²(x + 1)]  với MTC:  10x²(x + 1)²  nhân tử phụ là:  2(x + 1... |
| `G8-MATH-RUT-GON-PHAN` | Rút gọn phân thức bằng nhân tử chung | core | yes | Mới ở đâu so với phân số?  Không phải “rút gọn” nói chung. Cái mới là:  phân tích tử/mẫu thành nhân tử nhận ra nhân tử chung là cả một biểu thức không gạch hạng tử trong tổng xử lý... |
| `G8-MATH-NHAN-BIET-DA` | Nhận biết đa thức nhiều biến và xác định các hạng tử | core | yes | Mô tả: Học sinh nhận biết một biểu thức có phải là đa thức nhiều biến hay không bằng cách xem biểu thức đó có viết được thành tổng của các đơn thức hay không; đồng thời xác định đư... |
| `G8-MATH-NHAN-BIET-DON` | Nhận biết đơn thức nhiều biến và phân biệt với biểu thức không phải đơn thức | context/root-cause | yes | Học sinh nhận biết được biểu thức là đơn thức trong trường hợp có nhiều biến, nhiều thừa số biến, hệ số phân số/thập phân/căn số; đồng thời loại được các biểu thức không phải đơn t... |
| `G8-MATH-NHAN-BIET-CAC` | Nhận biết các đơn thức đồng dạng  | context/root-cause | yes | Mô tả kỹ năng: Học sinh nhận biết các đơn thức đồng dạng bằng cách so sánh phần biến, không chỉ so sánh bậc hoặc tên biến xuất hiện.  Ví dụ:  3x²y³, -0,2x²y³, 3/4 x²y³ đồng dạng. 3... |
| `G8-MATH-THU-GON-DA` | Thu gọn đa thức nhiều biến bằng cách nhóm hạng tử đồng dạng | core | yes | Mô tả: Học sinh thu gọn đa thức nhiều biến bằng cách xác định các hạng tử đồng dạng, nhóm chúng lại, rồi cộng/trừ hệ số và giữ nguyên phần biến.  Ví dụ:  M = x²y - 5xy + 7xy² + 3x²... |
| `G8-MATH-CONG-HAI-DA` | Cộng hai đa thức nhiều biến | context/root-cause | yes | Mô tả: Học sinh tính được tổng của hai đa thức nhiều biến bằng cách nối hai đa thức bằng dấu +, bỏ ngoặc nếu có, sau đó nhóm và cộng các hạng tử đồng dạng.  Ví dụ:  C = 5x²y + 5x -... |
| `G8-MATH-TRU-HAI-DA` | Trừ hai đa thức nhiều biến | context/root-cause | yes | Mô tả: Học sinh tính được hiệu của hai đa thức nhiều biến bằng cách lập hiệu, đổi dấu tất cả hạng tử trong đa thức bị trừ, rồi nhóm và cộng/trừ các hạng tử đồng dạng.  Ví dụ:  C - ... |
| `G8-MATH-NHAN-DON-THUC` | Nhân đơn thức với đa thức nhiều biến bằng cách phân phối vào từng hạng tử | context/root-cause | yes | Mô tả: Học sinh nhân một đơn thức với một đa thức nhiều biến bằng cách nhân đơn thức đó với từng hạng tử của đa thức, sau đó thu gọn các tích đơn thức nhận được.  Ví dụ:  (-4xy)(2x... |
| `G8-MATH-PHAN-TICH-DA` | Phân tích đa thức thành nhân tử bằng cách đặt nhân tử chung | core | yes | Học sinh nhận ra nhân tử xuất hiện chung trong tất cả các hạng tử của đa thức, đưa nhân tử đó ra ngoài ngoặc, và viết phần còn lại trong ngoặc sao cho nhân ngược lại được đa thức b... |
| `G8-MATH-NHAN-DANG-A` | Nhận dạng A² - B² và viết thành (A - B)(A + B) | core | yes | Học sinh nhận ra một biểu thức là hiệu của hai bình phương và viết được dưới dạng tích:  A² - B² = (A - B)(A + B)  Ví dụ:  x² - 4 = x² - 2² = (x - 2)(x + 2) |
| `G8-MATH-BIEN-DOI-TICH` | Biến đổi tích (A - B)(A + B) thành A² - B² | context/root-cause | yes | Học sinh nhận ra hai thừa số có cùng một phần và đối nhau ở phần còn lại, rồi dùng hằng đẳng thức:  (A - B)(A + B) = A² - B²  Ví dụ:  (x - 3y)(x + 3y) = x² - 9y² |
| `G8-MATH-NHAN-BIET-PHUONG` | Nhận biết phương trình 1 ẩn | core | yes | Kỹ năng: Nhận biết một phương trình một ẩn là một hệ thức có dạng A(x)=B(x), trong đó hai vế là biểu thức chứa cùng một ẩn.  Học sinh học gì: Phân biệt được:  2x + 5 = 16      là p... |
| `G8-MATH-NHAN-BIET-PHUONG-1` | Nhận biết phương trình bậc nhất một ẩn | core | yes | Kỹ năng: Nhận biết phương trình bậc nhất một ẩn có dạng ax+b=0, với a  =0.  Học sinh học gì: Phân loại được:  x + 1 = 0        là phương trình bậc nhất một ẩn 2 - x = 0        là ... |
| `G8-MATH-KIEM-TRA-GIA` | Kiểm tra giá trị là nghiệm của phương trình 1 ẩn | core | yes | Học sinh học gì: Với phương trình:  2x−5=4−x  kiểm tra x=3:  2⋅3−5=1,4−3=1  nên x=3 là nghiệm.  Kiểm tra x=−1:  2(−1)−5=−7,4−(−1)=5  nên x=−1 không là nghiệm. |
| `G8-MATH-GIAI-PHUONG-TRINH` | Giải phương trình bậc nhất một ẩn dạng ax+b=0 | core | yes | Kỹ năng: Giải phương trình bậc nhất một ẩn ở dạng trực tiếp ax+b=0, a  =0, bằng cách chuyển hạng tử tự do và chia cho hệ số của x.  Học sinh học gì: Biết biến đổi:  ax+b=0  thành:... |
| `G8-MATH-NHAN-BIET-HAM` | Nhận biết hàm số bậc nhất và xác định hệ số a,b. | core | yes | Nội dung: Học sinh nhận ra được hàm số có dạng y=ax+b, với a  =0, và xác định đúng hệ số a, hằng số b. |
| `G8-MATH-TINH-HOAC-XAC` | Tính hoặc xác định giá trị hàm số tại một giá trị của biến | core | yes | Nội dung: Học sinh hiểu f(a) là giá trị của y khi x = a. Nếu cho công thức thì thay x = a vào tính. Nếu cho bảng thì tìm cột x = a rồi đọc y.  Ví dụ: y = f(x) = 3x thì f(-2) = -6. ... |
| `G8-MATH-BIEU-DIEN-DIEM` | Biểu diễn điểm trên mặt phẳng tọa độ khi biết tọa độ | core | yes | Nội dung: Học sinh đặt được điểm R(2; -2), S(-1; 2), C(0; -2), D(-1; 0) trên hệ trục tọa độ. |
| `G8-MATH-BIEU-DIEN-DO` | Biểu diễn đồ thị hàm số từ bảng giá trị | core | yes | Từ bảng giá trị của hàm số, học sinh lập các cặp (x; y) tương ứng và biểu diễn các điểm đó trên mặt phẳng tọa độ. Ở B27, “vẽ đồ thị” chủ yếu là biểu diễn tập điểm từ bảng, chưa phả... |
| `G8-MATH-VE-DO-THI` | Vẽ đồ thị hàm số bậc nhất bằng đường thẳng đi qua hai điểm thuộc đồ thị. | core | yes | Nội dung: Học sinh biết đồ thị của hàm số bậc nhất là một đường thẳng, nên để vẽ đồ thị chỉ cần xác định hai điểm thuộc đồ thị rồi vẽ đường thẳng đi qua hai điểm đó.  Ví dụ với y=2... |
| `G8-MATH-XAC-DINH-QUAN` | Xác định quan hệ song song, cắt nhau hoặc trùng nhau của hai đường thẳng từ hệ số trong phương trình. | core | yes | Nội dung: Với hai đường thẳng:  y=ax+b  và  y=a ′ x+b ′  học sinh biết:  Nếu a=a ′ , b  =b ′  thì hai đường thẳng song song.  Nếu a=a ′ , b=b ′  thì hai đường thẳng trùng nhau.  N... |
| `G8-MATH-NHAN-BIET-HUONG` | Nhận biết hướng của đường thẳng từ dấu của hệ số góc. | core | yes | Nội dung: Học sinh biết nếu hệ số góc a>0 thì đường thẳng đi lên từ trái sang phải; nếu a<0 thì đường thẳng đi xuống từ trái sang phải. Tương ứng, góc tạo với trục Ox là góc nhọn k... |

## Internal Edges

| Prerequisite | Target | Interpretation |
|---|---|---|
| `G6-MATH-AP-DUNG-DUNG-1` | `G6-MATH-BO-NGOAC-LONG` | If `G6-MATH-BO-NGOAC-LONG` is hard, `G6-MATH-AP-DUNG-DUNG-1` is a plausible prerequisite to probe. |
| `G6-MATH-B31K2` | `G6-MATH-TIM-GIA-TRI-1` | If `G6-MATH-TIM-GIA-TRI-1` is hard, `G6-MATH-B31K2` is a plausible prerequisite to probe. |
| `G6-MATH-B31K2` | `G6-MATH-TIM-MOT-SO` | If `G6-MATH-TIM-MOT-SO` is hard, `G6-MATH-B31K2` is a plausible prerequisite to probe. |
| `G6-MATH-BO-DAU-NGOAC` | `G6-MATH-BO-NGOAC-LONG` | If `G6-MATH-BO-NGOAC-LONG` is hard, `G6-MATH-BO-DAU-NGOAC` is a plausible prerequisite to probe. |
| `G6-MATH-BO-DAU-NGOAC-1` | `G6-MATH-BO-NGOAC-LONG` | If `G6-MATH-BO-NGOAC-LONG` is hard, `G6-MATH-BO-DAU-NGOAC-1` is a plausible prerequisite to probe. |
| `G6-MATH-BO-DAU-NGOAC-1` | `G7-MATH-TRU-HAI-DA` | If `G7-MATH-TRU-HAI-DA` is hard, `G6-MATH-BO-DAU-NGOAC-1` is a plausible prerequisite to probe. |
| `G6-MATH-BO-DAU-NGOAC-1` | `G8-MATH-TRU-HAI-DA` | If `G8-MATH-TRU-HAI-DA` is hard, `G6-MATH-BO-DAU-NGOAC-1` is a plausible prerequisite to probe. |
| `G6-MATH-CHIA-HAI-PHAN` | `G6-MATH-B31K2` | If `G6-MATH-B31K2` is hard, `G6-MATH-CHIA-HAI-PHAN` is a plausible prerequisite to probe. |
| `G6-MATH-CHIA-HAI-PHAN` | `G6-MATH-TIM-MOT-SO-1` | If `G6-MATH-TIM-MOT-SO-1` is hard, `G6-MATH-CHIA-HAI-PHAN` is a plausible prerequisite to probe. |
| `G6-MATH-CONG-HAI-PHAN` | `G6-MATH-CONG-HAI-PHAN-1` | If `G6-MATH-CONG-HAI-PHAN-1` is hard, `G6-MATH-CONG-HAI-PHAN` is a plausible prerequisite to probe. |
| `G6-MATH-CONG-HAI-SO` | `G6-MATH-CONG-HAI-PHAN` | If `G6-MATH-CONG-HAI-PHAN` is hard, `G6-MATH-CONG-HAI-SO` is a plausible prerequisite to probe. |
| `G6-MATH-CONG-HAI-SO-1` | `G6-MATH-CONG-HAI-PHAN` | If `G6-MATH-CONG-HAI-PHAN` is hard, `G6-MATH-CONG-HAI-SO-1` is a plausible prerequisite to probe. |
| `G6-MATH-NHAN-BIET-DOC` | `G6-MATH-CONG-HAI-SO` | If `G6-MATH-CONG-HAI-SO` is hard, `G6-MATH-NHAN-BIET-DOC` is a plausible prerequisite to probe. |
| `G6-MATH-NHAN-BIET-DOC` | `G6-MATH-CONG-HAI-SO-1` | If `G6-MATH-CONG-HAI-SO-1` is hard, `G6-MATH-NHAN-BIET-DOC` is a plausible prerequisite to probe. |
| `G6-MATH-NHAN-BIET-DOC` | `G6-MATH-NHAN-BIET-PHAN-1` | If `G6-MATH-NHAN-BIET-PHAN-1` is hard, `G6-MATH-NHAN-BIET-DOC` is a plausible prerequisite to probe. |
| `G6-MATH-NHAN-BIET-DOC` | `G6-MATH-NHAN-BIET-SO-1` | If `G6-MATH-NHAN-BIET-SO-1` is hard, `G6-MATH-NHAN-BIET-DOC` is a plausible prerequisite to probe. |
| `G6-MATH-NHAN-BIET-DOC` | `G6-MATH-NHAN-HAI-SO` | If `G6-MATH-NHAN-HAI-SO` is hard, `G6-MATH-NHAN-BIET-DOC` is a plausible prerequisite to probe. |
| `G6-MATH-NHAN-BIET-DOC` | `G6-MATH-NHAN-HAI-SO-1` | If `G6-MATH-NHAN-HAI-SO-1` is hard, `G6-MATH-NHAN-BIET-DOC` is a plausible prerequisite to probe. |
| `G6-MATH-NHAN-BIET-DOC` | `G6-MATH-THUC-HIEN-PHEP` | If `G6-MATH-THUC-HIEN-PHEP` is hard, `G6-MATH-NHAN-BIET-DOC` is a plausible prerequisite to probe. |
| `G6-MATH-NHAN-BIET-PHAN-1` | `G6-MATH-CONG-HAI-PHAN` | If `G6-MATH-CONG-HAI-PHAN` is hard, `G6-MATH-NHAN-BIET-PHAN-1` is a plausible prerequisite to probe. |
| `G6-MATH-NHAN-BIET-PHAN-1` | `G6-MATH-NHAN-BIET-HAI` | If `G6-MATH-NHAN-BIET-HAI` is hard, `G6-MATH-NHAN-BIET-PHAN-1` is a plausible prerequisite to probe. |
| `G6-MATH-NHAN-BIET-PHAN-1` | `G6-MATH-NHAN-HAI-PHAN` | If `G6-MATH-NHAN-HAI-PHAN` is hard, `G6-MATH-NHAN-BIET-PHAN-1` is a plausible prerequisite to probe. |
| `G6-MATH-NHAN-BIET-PHAN-1` | `G6-MATH-PHAN-SO-NGHICH` | If `G6-MATH-PHAN-SO-NGHICH` is hard, `G6-MATH-NHAN-BIET-PHAN-1` is a plausible prerequisite to probe. |
| `G6-MATH-NHAN-BIET-PHAN-1` | `G6-MATH-QUY-DONG-MAU` | If `G6-MATH-QUY-DONG-MAU` is hard, `G6-MATH-NHAN-BIET-PHAN-1` is a plausible prerequisite to probe. |
| `G6-MATH-NHAN-BIET-PHAN-1` | `G6-MATH-SO-DOI-CUA` | If `G6-MATH-SO-DOI-CUA` is hard, `G6-MATH-NHAN-BIET-PHAN-1` is a plausible prerequisite to probe. |
| `G6-MATH-NHAN-BIET-PHAN-1` | `G6-MATH-TINH-CHAT-CO` | If `G6-MATH-TINH-CHAT-CO` is hard, `G6-MATH-NHAN-BIET-PHAN-1` is a plausible prerequisite to probe. |
| `G6-MATH-NHAN-BIET-PHAN-1` | `G6-MATH-TRU-HAI-PHAN` | If `G6-MATH-TRU-HAI-PHAN` is hard, `G6-MATH-NHAN-BIET-PHAN-1` is a plausible prerequisite to probe. |
| `G6-MATH-NHAN-BIET-PHAN-1` | `G9-MATH-NHAN-BIET-SO-1` | If `G9-MATH-NHAN-BIET-SO-1` is hard, `G6-MATH-NHAN-BIET-PHAN-1` is a plausible prerequisite to probe. |
| `G6-MATH-NHAN-BIET-SO-1` | `G6-MATH-BO-DAU-NGOAC-1` | If `G6-MATH-BO-DAU-NGOAC-1` is hard, `G6-MATH-NHAN-BIET-SO-1` is a plausible prerequisite to probe. |
| `G6-MATH-NHAN-BIET-SO-1` | `G6-MATH-SO-DOI-CUA` | If `G6-MATH-SO-DOI-CUA` is hard, `G6-MATH-NHAN-BIET-SO-1` is a plausible prerequisite to probe. |
| `G6-MATH-NHAN-BIET-SO-1` | `G6-MATH-TU-CHO-SO` | If `G6-MATH-TU-CHO-SO` is hard, `G6-MATH-NHAN-BIET-SO-1` is a plausible prerequisite to probe. |
| `G6-MATH-NHAN-HAI-PHAN` | `G6-MATH-CHIA-HAI-PHAN` | If `G6-MATH-CHIA-HAI-PHAN` is hard, `G6-MATH-NHAN-HAI-PHAN` is a plausible prerequisite to probe. |
| `G6-MATH-NHAN-HAI-PHAN` | `G6-MATH-TIM-GIA-TRI` | If `G6-MATH-TIM-GIA-TRI` is hard, `G6-MATH-NHAN-HAI-PHAN` is a plausible prerequisite to probe. |
| `G6-MATH-NHAN-HAI-SO` | `G6-MATH-NHAN-BIET-HAI` | If `G6-MATH-NHAN-BIET-HAI` is hard, `G6-MATH-NHAN-HAI-SO` is a plausible prerequisite to probe. |
| `G6-MATH-NHAN-HAI-SO` | `G6-MATH-NHAN-HAI-PHAN` | If `G6-MATH-NHAN-HAI-PHAN` is hard, `G6-MATH-NHAN-HAI-SO` is a plausible prerequisite to probe. |
| `G6-MATH-NHAN-HAI-SO` | `G6-MATH-TINH-CHAT-CO` | If `G6-MATH-TINH-CHAT-CO` is hard, `G6-MATH-NHAN-HAI-SO` is a plausible prerequisite to probe. |
| `G6-MATH-NHAN-HAI-SO-1` | `G6-MATH-NHAN-BIET-HAI` | If `G6-MATH-NHAN-BIET-HAI` is hard, `G6-MATH-NHAN-HAI-SO-1` is a plausible prerequisite to probe. |
| `G6-MATH-NHAN-HAI-SO-1` | `G6-MATH-NHAN-HAI-PHAN` | If `G6-MATH-NHAN-HAI-PHAN` is hard, `G6-MATH-NHAN-HAI-SO-1` is a plausible prerequisite to probe. |
| `G6-MATH-NHAN-HAI-SO-1` | `G6-MATH-TINH-CHAT-CO` | If `G6-MATH-TINH-CHAT-CO` is hard, `G6-MATH-NHAN-HAI-SO-1` is a plausible prerequisite to probe. |
| `G6-MATH-PHAN-PHOI-NHAN` | `G7-MATH-NHAN-DON-THUC` | If `G7-MATH-NHAN-DON-THUC` is hard, `G6-MATH-PHAN-PHOI-NHAN` is a plausible prerequisite to probe. |
| `G6-MATH-PHAN-PHOI-NHAN` | `G8-MATH-NHAN-DON-THUC` | If `G8-MATH-NHAN-DON-THUC` is hard, `G6-MATH-PHAN-PHOI-NHAN` is a plausible prerequisite to probe. |
| `G6-MATH-PHAN-PHOI-NHAN` | `G8-MATH-PHAN-TICH-DA` | If `G8-MATH-PHAN-TICH-DA` is hard, `G6-MATH-PHAN-PHOI-NHAN` is a plausible prerequisite to probe. |
| `G6-MATH-PHAN-SO-NGHICH` | `G6-MATH-CHIA-HAI-PHAN` | If `G6-MATH-CHIA-HAI-PHAN` is hard, `G6-MATH-PHAN-SO-NGHICH` is a plausible prerequisite to probe. |
| `G6-MATH-QUY-DONG-MAU` | `G6-MAMATMATHMAT` | If `G6-MAMATMATHMAT` is hard, `G6-MATH-QUY-DONG-MAU` is a plausible prerequisite to probe. |
| `G6-MATH-QUY-DONG-MAU` | `G6-MATH-CONG-HAI-PHAN-1` | If `G6-MATH-CONG-HAI-PHAN-1` is hard, `G6-MATH-QUY-DONG-MAU` is a plausible prerequisite to probe. |
| `G6-MATH-THUC-HIEN-PHEP` | `G6-MATH-TINH-CHAT-CO` | If `G6-MATH-TINH-CHAT-CO` is hard, `G6-MATH-THUC-HIEN-PHEP` is a plausible prerequisite to probe. |
| `G6-MATH-TINH-CHAT-CO` | `G6-MATH-QUY-DONG-MAU` | If `G6-MATH-QUY-DONG-MAU` is hard, `G6-MATH-TINH-CHAT-CO` is a plausible prerequisite to probe. |
| `G6-MATH-TINH-CHAT-CO` | `G8-MATH-QUY-DONG-MAU` | If `G8-MATH-QUY-DONG-MAU` is hard, `G6-MATH-TINH-CHAT-CO` is a plausible prerequisite to probe. |
| `G6-MATH-TINH-CHAT-CO` | `G8-MATH-RUT-GON-PHAN` | If `G8-MATH-RUT-GON-PHAN` is hard, `G6-MATH-TINH-CHAT-CO` is a plausible prerequisite to probe. |
| `G6-MATH-TRU-HAI-PHAN` | `G6-MAMATMATHMAT` | If `G6-MAMATMATHMAT` is hard, `G6-MATH-TRU-HAI-PHAN` is a plausible prerequisite to probe. |
| `G6-MATH-TU-CHO-SO` | `G6-MATH-TRU-HAI-PHAN` | If `G6-MATH-TRU-HAI-PHAN` is hard, `G6-MATH-TU-CHO-SO` is a plausible prerequisite to probe. |
| `G7-MATH-KHAI-NIEM-DANG` | `G7-MATH-QUY-TAC-CHUYEN` | If `G7-MATH-QUY-TAC-CHUYEN` is hard, `G7-MATH-KHAI-NIEM-DANG` is a plausible prerequisite to probe. |
| `G7-MATH-NHAN-BIET-BIEU` | `G7-MATH-TINH-GIA-TRI-1` | If `G7-MATH-TINH-GIA-TRI-1` is hard, `G7-MATH-NHAN-BIET-BIEU` is a plausible prerequisite to probe. |
| `G7-MATH-NHAN-BIET-BIEU` | `G8-MATH-NHAN-BIET-DON` | If `G8-MATH-NHAN-BIET-DON` is hard, `G7-MATH-NHAN-BIET-BIEU` is a plausible prerequisite to probe. |
| `G7-MATH-NHAN-BIET-BIEU` | `G8-MATH-NHAN-BIET-PHUONG` | If `G8-MATH-NHAN-BIET-PHUONG` is hard, `G7-MATH-NHAN-BIET-BIEU` is a plausible prerequisite to probe. |
| `G7-MATH-NHAN-BIET-DA` | `G7-MATH-NHAN-DON-THUC` | If `G7-MATH-NHAN-DON-THUC` is hard, `G7-MATH-NHAN-BIET-DA` is a plausible prerequisite to probe. |
| `G7-MATH-NHAN-BIET-DA` | `G7-MATH-THU-GON-DA` | If `G7-MATH-THU-GON-DA` is hard, `G7-MATH-NHAN-BIET-DA` is a plausible prerequisite to probe. |
| `G7-MATH-NHAN-BIET-DON` | `G7-MATH-CHIA-HAI-DON` | If `G7-MATH-CHIA-HAI-DON` is hard, `G7-MATH-NHAN-BIET-DON` is a plausible prerequisite to probe. |
| `G7-MATH-NHAN-BIET-DON` | `G7-MATH-NHAN-BIET-DA` | If `G7-MATH-NHAN-BIET-DA` is hard, `G7-MATH-NHAN-BIET-DON` is a plausible prerequisite to probe. |
| `G7-MATH-NHAN-BIET-DON` | `G7-MATH-NHAN-DON-THUC` | If `G7-MATH-NHAN-DON-THUC` is hard, `G7-MATH-NHAN-BIET-DON` is a plausible prerequisite to probe. |
| `G7-MATH-NHAN-BIET-DON` | `G7-MATH-SAP-XEP-DA` | If `G7-MATH-SAP-XEP-DA` is hard, `G7-MATH-NHAN-BIET-DON` is a plausible prerequisite to probe. |
| `G7-MATH-NHAN-DON-THUC` | `G7-MATH-NHAN-DA-THUC` | If `G7-MATH-NHAN-DA-THUC` is hard, `G7-MATH-NHAN-DON-THUC` is a plausible prerequisite to probe. |
| `G7-MATH-QUY-TAC-CHUYEN` | `G8-MATH-GIAI-PHUONG-TRINH` | If `G8-MATH-GIAI-PHUONG-TRINH` is hard, `G7-MATH-QUY-TAC-CHUYEN` is a plausible prerequisite to probe. |
| `G7-MATH-TINH-GIA-TRI-1` | `G8-MATH-KIEM-TRA-GIA` | If `G8-MATH-KIEM-TRA-GIA` is hard, `G7-MATH-TINH-GIA-TRI-1` is a plausible prerequisite to probe. |
| `G7-MATH-TINH-GIA-TRI-1` | `G8-MATH-TINH-HOAC-XAC` | If `G8-MATH-TINH-HOAC-XAC` is hard, `G7-MATH-TINH-GIA-TRI-1` is a plausible prerequisite to probe. |
| `G7-MATH-VIET-BIEU-THUC` | `G7-MATH-NHAN-BIET-BIEU` | If `G7-MATH-NHAN-BIET-BIEU` is hard, `G7-MATH-VIET-BIEU-THUC` is a plausible prerequisite to probe. |
| `G8-MATH-BIEU-DIEN-DIEM` | `G8-MATH-BIEU-DIEN-DO` | If `G8-MATH-BIEU-DIEN-DO` is hard, `G8-MATH-BIEU-DIEN-DIEM` is a plausible prerequisite to probe. |
| `G8-MATH-BIEU-DIEN-DIEM` | `G8-MATH-VE-DO-THI` | If `G8-MATH-VE-DO-THI` is hard, `G8-MATH-BIEU-DIEN-DIEM` is a plausible prerequisite to probe. |
| `G8-MATH-NHAN-BIET-CAC` | `G8-MATH-THU-GON-DA` | If `G8-MATH-THU-GON-DA` is hard, `G8-MATH-NHAN-BIET-CAC` is a plausible prerequisite to probe. |
| `G8-MATH-NHAN-BIET-DA` | `G8-MATH-NHAN-BIET-PHAN` | If `G8-MATH-NHAN-BIET-PHAN` is hard, `G8-MATH-NHAN-BIET-DA` is a plausible prerequisite to probe. |
| `G8-MATH-NHAN-BIET-DA` | `G8-MATH-NHAN-DON-THUC` | If `G8-MATH-NHAN-DON-THUC` is hard, `G8-MATH-NHAN-BIET-DA` is a plausible prerequisite to probe. |
| `G8-MATH-NHAN-BIET-DA` | `G8-MATH-PHAN-TICH-DA` | If `G8-MATH-PHAN-TICH-DA` is hard, `G8-MATH-NHAN-BIET-DA` is a plausible prerequisite to probe. |
| `G8-MATH-NHAN-BIET-DA` | `G8-MATH-THU-GON-DA` | If `G8-MATH-THU-GON-DA` is hard, `G8-MATH-NHAN-BIET-DA` is a plausible prerequisite to probe. |
| `G8-MATH-NHAN-BIET-DON` | `G8-MATH-NHAN-BIET-DA` | If `G8-MATH-NHAN-BIET-DA` is hard, `G8-MATH-NHAN-BIET-DON` is a plausible prerequisite to probe. |
| `G8-MATH-NHAN-BIET-HAM` | `G8-MATH-NHAN-BIET-HUONG` | If `G8-MATH-NHAN-BIET-HUONG` is hard, `G8-MATH-NHAN-BIET-HAM` is a plausible prerequisite to probe. |
| `G8-MATH-NHAN-BIET-HAM` | `G8-MATH-VE-DO-THI` | If `G8-MATH-VE-DO-THI` is hard, `G8-MATH-NHAN-BIET-HAM` is a plausible prerequisite to probe. |
| `G8-MATH-NHAN-BIET-HAM` | `G8-MATH-XAC-DINH-QUAN` | If `G8-MATH-XAC-DINH-QUAN` is hard, `G8-MATH-NHAN-BIET-HAM` is a plausible prerequisite to probe. |
| `G8-MATH-NHAN-BIET-PHAN` | `G8-MATH-KIEM-TRA-HAI` | If `G8-MATH-KIEM-TRA-HAI` is hard, `G8-MATH-NHAN-BIET-PHAN` is a plausible prerequisite to probe. |
| `G8-MATH-NHAN-BIET-PHAN` | `G8-MATH-RUT-GON-PHAN` | If `G8-MATH-RUT-GON-PHAN` is hard, `G8-MATH-NHAN-BIET-PHAN` is a plausible prerequisite to probe. |
| `G8-MATH-NHAN-BIET-PHAN` | `G8-MATH-TINH-GIA-TRI` | If `G8-MATH-TINH-GIA-TRI` is hard, `G8-MATH-NHAN-BIET-PHAN` is a plausible prerequisite to probe. |
| `G8-MATH-NHAN-BIET-PHAN` | `G8-MATH-XAC-DINH-DIEU` | If `G8-MATH-XAC-DINH-DIEU` is hard, `G8-MATH-NHAN-BIET-PHAN` is a plausible prerequisite to probe. |
| `G8-MATH-NHAN-BIET-PHAN` | `G8-MATH-XAC-DINH-MAU` | If `G8-MATH-XAC-DINH-MAU` is hard, `G8-MATH-NHAN-BIET-PHAN` is a plausible prerequisite to probe. |
| `G8-MATH-NHAN-BIET-PHUONG` | `G8-MATH-KIEM-TRA-GIA` | If `G8-MATH-KIEM-TRA-GIA` is hard, `G8-MATH-NHAN-BIET-PHUONG` is a plausible prerequisite to probe. |
| `G8-MATH-NHAN-BIET-PHUONG` | `G8-MATH-NHAN-BIET-PHUONG-1` | If `G8-MATH-NHAN-BIET-PHUONG-1` is hard, `G8-MATH-NHAN-BIET-PHUONG` is a plausible prerequisite to probe. |
| `G8-MATH-THU-GON-DA` | `G8-MATH-CONG-HAI-DA` | If `G8-MATH-CONG-HAI-DA` is hard, `G8-MATH-THU-GON-DA` is a plausible prerequisite to probe. |
| `G8-MATH-THU-GON-DA` | `G8-MATH-TRU-HAI-DA` | If `G8-MATH-TRU-HAI-DA` is hard, `G8-MATH-THU-GON-DA` is a plausible prerequisite to probe. |
| `G8-MATH-TINH-HOAC-XAC` | `G8-MATH-VE-DO-THI` | If `G8-MATH-VE-DO-THI` is hard, `G8-MATH-TINH-HOAC-XAC` is a plausible prerequisite to probe. |
| `G8-MATH-XAC-DINH-MAU` | `G8-MATH-QUY-DONG-MAU` | If `G8-MATH-QUY-DONG-MAU` is hard, `G8-MATH-XAC-DINH-MAU` is a plausible prerequisite to probe. |

## Item Gap Queue

All full-scope nodes currently have at least one direct item.

