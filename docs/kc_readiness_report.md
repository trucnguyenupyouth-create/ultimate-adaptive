# Báo cáo Chi tiết Trạng thái KCs — Toán Lớp 6

> Generated: 2026-06-20 | Total: 148 KCs

## Tổng quan

| Trạng thái | Số lượng | % |
|-----------|---------|---|
| ✅ Ready (đủ điều kiện) | 63 | 42% |
| ⚠️ Partial (có items nhưng thiếu) | 52 | 35% |
| 🔴 No Items (chưa có câu hỏi) | 33 | 22% |
| 🟣 Isolated (không có edge) | 13 | 8% |

## Tiêu chí tối thiểu (Minimum Acceptance)

Mỗi KC cần đạt **TẤT CẢ** các điều kiện sau:

| # | Tiêu chí | Lý do |
|---|---------|-------|
| 1 | ≥ 3 items tổng | IRT cần ≥3 data points để ZPD selection có ý nghĩa |
| 2 | ≥ 1 easy (irt_b < -0.5) | Weak student cần câu dễ để build confidence |
| 3 | ≥ 1 medium (-0.5 ≤ irt_b ≤ 0.5) | Entry point cho Cold Start assessment |
| 4 | ≥ 1 hard (irt_b > 0.5) | Strong student cần câu khó để confirm mastery |
| 5 | ≥ 1 diagnostic anchor | CAT Cold Start cần anchor item (medium + high discrimination) |
| 6 | ≥ 1 edge trong graph | KC phải được kết nối trong KST graph |

## Tổng hợp vấn đề

| Vấn đề | Số KCs bị ảnh hưởng | Mức độ |
|--------|-------------------|--------|
| 🔴 Không có items nào | 33 | CRITICAL — assessment crash nếu traverse qua |
| 🟠 Items < 3 | 11 | HIGH — IRT ZPD không đủ pool |
| 🟡 Thiếu Easy items | 26 | MEDIUM — weak student frustration |
| 🟡 Thiếu Medium items | 1 | MEDIUM — Cold Start fallback |
| 🟡 Thiếu Hard items | 46 | MEDIUM — strong student ceiling |
| 🟡 Thiếu Anchor items | 21 | MEDIUM — Cold Start dùng ZPD thay vì anchor |
| ⚪ Isolated (no edges) | 13 | LOW — không ảnh hưởng assessment nhưng unreachable |

---

## Chi tiết từng KC

> **Cách đọc bảng:**
> - Cột `E/M/H/A`: số lượng items Easy / Medium / Hard / Anchor
> - Cột `In/Out`: số edges đến / đi (prerequisite graph)
> - Cột `Thiếu`: liệt kê cụ thể cần bổ sung gì
> - Sắp xếp theo chapter_info (B1K1, B2K1, ... B43K2)


### Block 16 (16K1)

| Code | Name | Total | E/M/H/A | In/Out | Status | Thiếu |
|------|------|-------|---------|--------|--------|-------|
| G6-MATH-TINH-CHAT-PHEP | Tính chất phép nhân | 0 | 0/0/0/0 | 0/0 | 🔴 | **TẠO 6 ITEMS** (2E+2M+2H), ⚠️ isolated |

### Block B10 (B10K1)

| Code | Name | Total | E/M/H/A | In/Out | Status | Thiếu |
|------|------|-------|---------|--------|--------|-------|
| G6-MATH-NHAN-BIET-SO | Nhận biết số nguyên tố và hợp số | 6 | 2/1/3/2 | 1/1 | ✅ | — |
| G6-MATH-PHAN-TICH-RA | Phân tích ra thừa số nguyên tố | 4 | 1/1/2/1 | 2/3 | ✅ | — |

### Block B11 (B11K1)

| Code | Name | Total | E/M/H/A | In/Out | Status | Thiếu |
|------|------|-------|---------|--------|--------|-------|
| G6-MATH-RUT-GON-VE | Rút gọn về phân số tối giản | 4 | 2/2/0/2 | 1/0 | ⚠️ | +1 hard (b>0.5) |
| G6-MATH-TIM-UCLN | Tìm ƯCLN | 4 | 1/3/0/3 | 2/1 | ⚠️ | +1 hard (b>0.5) |
| G9-MATH-NHAN-BIET-UOC | Nhận Biết ước chung và ƯCLN | 3 | 2/1/0/1 | 1/2 | ⚠️ | +1 hard (b>0.5) |

### Block B12 (B12K1)

| Code | Name | Total | E/M/H/A | In/Out | Status | Thiếu |
|------|------|-------|---------|--------|--------|-------|
| G6-MATH-NHAN-BIET-BOI | Nhận biết bội chung và BCNN | 5 | 1/2/2/2 | 1/1 | ✅ | — |
| G6-MATH-QUY-DONG-PHAN | Quy đồng mẫu các phân số | 1 | 0/1/0/1 | 2/0 | ⚠️ | +2 items, +1 easy (b<-0.5), +1 hard (b>0.5) |
| G6-MATH-TIM-BCNN | Tìm BCNN | 2 | 0/2/0/2 | 2/2 | ⚠️ | +1 items, +1 easy (b<-0.5), +1 hard (b>0.5) |

### Block B13 (B13K1)

| Code | Name | Total | E/M/H/A | In/Out | Status | Thiếu |
|------|------|-------|---------|--------|--------|-------|
| G6-MATH-NHAN-BIET-DOC | Nhận biết, đọc và viết số nguyên âm | 6 | 2/2/2/2 | 0/9 | ✅ | — |
| G9-MATH-SO-SANH-HAI-1 | Biểu diễn số nguyên trên trục số và so s | 0 | 0/0/0/0 | 1/3 | 🔴 | **TẠO 6 ITEMS** (2E+2M+2H) |

### Block B14 (B14K1)

| Code | Name | Total | E/M/H/A | In/Out | Status | Thiếu |
|------|------|-------|---------|--------|--------|-------|
| G6-MATH-CONG-HAI-SO | Cộng hai số nguyên âm | 6 | 2/2/2/2 | 1/1 | ✅ | — |
| G6-MATH-NHAN-BIET-SO-1 | Xác định số đối của một số nguyên | 7 | 2/2/3/2 | 1/3 | ✅ | — |
| G6-MATH-TU-CHO-SO | Trừ hai số nguyên | 0 | 0/0/0/0 | 1/1 | 🔴 | **TẠO 6 ITEMS** (2E+2M+2H) |
| G9-MATH-CONG-HAI-SO | Cộng hai số nguyên khác dấu  | 0 | 0/0/0/0 | 1/2 | 🔴 | **TẠO 6 ITEMS** (2E+2M+2H) |

### Block B15 (B15K1)

| Code | Name | Total | E/M/H/A | In/Out | Status | Thiếu |
|------|------|-------|---------|--------|--------|-------|
| G6-MATH-BO-DAU-NGOAC | Bỏ dấu ngoặc có dấu + đằng trước  | 9 | 3/2/4/2 | 0/1 | ✅ | — |
| G6-MATH-BO-NGOAC-LONG | Bỏ ngoặc lồng nhau  | 8 | 3/1/4/1 | 3/0 | ✅ | — |
| G9-MATH-BO-DAU-NGOAC | Bỏ dấu ngoặc có dấu - đằng trước | 0 | 0/0/0/0 | 1/2 | 🔴 | **TẠO 6 ITEMS** (2E+2M+2H) |

### Block B16 (B16K1)

| Code | Name | Total | E/M/H/A | In/Out | Status | Thiếu |
|------|------|-------|---------|--------|--------|-------|
| G6-MATH-NHAN-HAI-SO | Nhân hai số nguyên khác dấu  | 2 | 1/1/0/1 | 1/4 | ⚠️ | +1 items, +1 hard (b>0.5) |
| G6-MATH-NHAN-HAI-SO-1 | Nhân hai số nguyên cùng dấu | 3 | 1/2/0/2 | 1/4 | ⚠️ | +1 hard (b>0.5) |

### Block B17 (B17K1)

| Code | Name | Total | E/M/H/A | In/Out | Status | Thiếu |
|------|------|-------|---------|--------|--------|-------|
| G6-MATH-NHAN-BIET-MO | Nhận biết - Mở rộng ước và bội sang số n | 5 | 2/1/2/1 | 1/1 | ✅ | — |
| G6-MATH-TIM-UOC-VA | Tìm ước và bội số  | 0 | 0/0/0/0 | 3/1 | 🔴 | **TẠO 6 ITEMS** (2E+2M+2H) |
| G9-MATH-NHAN-BIET-MO | Nhận biết mở rộng mối quan hệ chia hết s | 0 | 0/0/0/0 | 3/1 | 🔴 | **TẠO 6 ITEMS** (2E+2M+2H) |
| G9-MATH-THUC-HIEN-PHEP | Thực hiện phép chia hết hai số nguyên -  | 0 | 0/0/0/0 | 2/3 | 🔴 | **TẠO 6 ITEMS** (2E+2M+2H) |

### Block B18 (B18K1)

| Code | Name | Total | E/M/H/A | In/Out | Status | Thiếu |
|------|------|-------|---------|--------|--------|-------|
| G6-MATH-MO-TA-CAC | Mô tả các tính chất của tam giác đều | 5 | 2/2/1/2 | 0/1 | ✅ | — |
| G6-MATH-MO-TA-CAC-1 | Mô tả các tính chất của hình vuông | 9 | 3/2/4/2 | 0/1 | ✅ | — |
| G6-MATH-MO-TA-CAC-2 | Mô tả các tính chất của lục giác đều  | 4 | 1/1/2/1 | 0/1 | ✅ | — |
| G6-MATH-NHAN-BIET-HINH | Nhận biết hình vuông  | 7 | 3/2/2/2 | 1/1 | ✅ | — |
| G6-MATH-NHAN-BIET-TAM | Nhận biết tam giác đều  | 5 | 2/2/1/2 | 1/1 | ✅ | — |
| G6-MATH-VE-HINH-TAM | Vẽ hình tam giác đều  | 1 | 0/1/0/1 | 1/0 | ⚠️ | +2 items, +1 easy (b<-0.5), +1 hard (b>0.5) |
| G6-MATH-VE-HINH-VUONG | Vẽ Hình vuông | 0 | 0/0/0/0 | 1/0 | 🔴 | **TẠO 6 ITEMS** (2E+2M+2H) |

### Block B19 (B19K1)

| Code | Name | Total | E/M/H/A | In/Out | Status | Thiếu |
|------|------|-------|---------|--------|--------|-------|
| G6-MATH-MO-TA-CAC-3 | Mô tả các yếu tố cơ bản , góc (độ), độ d | 5 | 2/2/1/2 | 0/3 | ✅ | — |
| G6-MATH-VE-HINH-BINH | Vẽ hình bình hành | 0 | 0/0/0/0 | 1/0 | 🔴 | **TẠO 6 ITEMS** (2E+2M+2H) |
| G6-MATH-VE-HINH-CHU | Vẽ hình chữ nhật  | 0 | 0/0/0/0 | 1/0 | 🔴 | **TẠO 6 ITEMS** (2E+2M+2H) |
| G6-MATH-VE-HINH-THOI | Vẽ hình thoi | 0 | 0/0/0/0 | 1/0 | 🔴 | **TẠO 6 ITEMS** (2E+2M+2H) |
| G9-MATH-MO-TA-CAC | Mô tả các yếu tố cơ bản , góc (độ), độ d | 3 | 1/2/0/2 | 0/1 | ⚠️ | +1 hard (b>0.5) |

### Block B1 (B1K1)

| Code | Name | Total | E/M/H/A | In/Out | Status | Thiếu |
|------|------|-------|---------|--------|--------|-------|
| G6-MATH-BIEU-DIEN-TAP | Biểu diễn tập hợp - Chỉ ra tính chất đặc | 6 | 0/6/0/0 | 1/0 | ⚠️ | +1 easy (b<-0.5), +1 hard (b>0.5), +1 anchor |
| G6-MATH-CLAUDE-SUGGEST-TAP | Nhận biết tập hợp rỗng và sử dụng ký hiệ | 6 | 0/6/0/0 | 1/0 | ⚠️ | +1 easy (b<-0.5), +1 hard (b>0.5), +1 anchor |
| G6-MATH-NHAN-BIET-PHAN | Nhận biết phần tử thuộc hoặc không thuộc | 6 | 0/6/0/0 | 1/2 | ⚠️ | +1 easy (b<-0.5), +1 hard (b>0.5), +1 anchor |
| G6-MATH-NHAN-BIET-TAP | Nhận biết tập hợp và liệt kê tập hợp | 7 | 0/7/0/0 | 0/2 | ⚠️ | +1 easy (b<-0.5), +1 hard (b>0.5), +1 anchor |

### Block B20 (B20)

| Code | Name | Total | E/M/H/A | In/Out | Status | Thiếu |
|------|------|-------|---------|--------|--------|-------|
| G6-MATH-DIEN-TICH-HINH-1 | Diện tích hình bình hành | 5 | 2/1/2/1 | 1/0 | ✅ | — |
| G6-MATH-DIEN-TICH-HINH | Diện tích hình thoi | 5 | 2/1/2/1 | 1/0 | ✅ | — |
| G6-MATH-TINH-CHU-VI | Tính chu vi hình bình hành | 5 | 1/4/0/4 | 1/0 | ⚠️ | +1 hard (b>0.5) |
| G6-MATH-TINH-CHU-VI-1 | Tính chu vi hình thoi | 5 | 1/4/0/4 | 1/0 | ⚠️ | +1 hard (b>0.5) |

### Block B21 (B21K1)

| Code | Name | Total | E/M/H/A | In/Out | Status | Thiếu |
|------|------|-------|---------|--------|--------|-------|
| G6-MATH-NHAN-BIET-HINH-1 | Nhận biết hình có trục đối xứng | 4 | 1/2/1/2 | 1/1 | ✅ | — |
| G6-MATH-TIM-VA-XAC | Tìm và xác định trục đối xứng của hình p | 7 | 2/4/1/4 | 0/1 | ✅ | — |
| G9-MATH-TIM-VA-XAC | Tìm và xác định trục đối xứng của vật th | 0 | 0/0/0/0 | 1/0 | 🔴 | **TẠO 6 ITEMS** (2E+2M+2H) |

### Block B22 (B22K1)

| Code | Name | Total | E/M/H/A | In/Out | Status | Thiếu |
|------|------|-------|---------|--------|--------|-------|
| G6-MATH-NHAN-BIET-HINH-2 | Nhận biết hình có tâm đối xứng | 0 | 0/0/0/0 | 0/2 | 🔴 | **TẠO 6 ITEMS** (2E+2M+2H) |
| G6-MATH-XAC-DINH-VI | Xác định vị trí tâm đối xứng của hình ph | 0 | 0/0/0/0 | 1/0 | 🔴 | **TẠO 6 ITEMS** (2E+2M+2H) |
| G6-MATH-XAC-DINH-VI-1 | Xác định vị trí tâm đối xứng của các hìn | 0 | 0/0/0/0 | 1/0 | 🔴 | **TẠO 6 ITEMS** (2E+2M+2H) |

### Block B23 (B23K1)

| Code | Name | Total | E/M/H/A | In/Out | Status | Thiếu |
|------|------|-------|---------|--------|--------|-------|
| G6-MATH-NHAN-BIET-HAI | Kiểm tra hai phân số bằng nhau bằng điều | 8 | 2/2/4/2 | 3/0 | ✅ | — |
| G6-MATH-TINH-CHAT-CO | Áp dụng tính chất cơ bản của phân số bằn | 0 | 0/0/0/0 | 5/1 | 🔴 | **TẠO 6 ITEMS** (2E+2M+2H) |
| G9-MATH-NHAN-BIET-PHAN | Nhận biết phân số có tử và mẫu là số ngu | 1 | 0/1/0/1 | 1/11 | ⚠️ | +2 items, +1 easy (b<-0.5), +1 hard (b>0.5) |

### Block B24 (B24K2)

| Code | Name | Total | E/M/H/A | In/Out | Status | Thiếu |
|------|------|-------|---------|--------|--------|-------|
| G6-MATH-NHAN-BIET-HON | Nhận biết hỗn số dương | 6 | 2/2/2/2 | 1/0 | ✅ | — |
| G6-MATH-QUY-DONG-MAU | Quy đồng mẫu các phân số có tử/mẫu nguyê | 4 | 0/4/0/2 | 4/4 | ⚠️ | +1 easy (b<-0.5), +1 hard (b>0.5) |
| G6-MATH-SO-SANH-HAI | So sánh hai phân số cùng mẫu  | 7 | 4/3/0/3 | 2/1 | ⚠️ | +1 hard (b>0.5) |
| G6-MATH-SO-SANH-HAI-1 | So sánh hai phân số khác mẫu bằng cách q | 3 | 1/2/0/2 | 2/0 | ⚠️ | +1 hard (b>0.5) |

### Block B25 (B25K2)

| Code | Name | Total | E/M/H/A | In/Out | Status | Thiếu |
|------|------|-------|---------|--------|--------|-------|
| G6-MAMATMATHMAT | Trừ hai phân số khác mẫu | 0 | 0/0/0/0 | 2/0 | 🔴 | **TẠO 6 ITEMS** (2E+2M+2H) |
| G6-MATH-CONG-HAI-PHAN | Cộng hai phân số cùng mẫu  | 6 | 2/2/2/2 | 3/1 | ✅ | — |
| G6-MATH-CONG-HAI-PHAN-1 | Cộng hai phân số khác mẫu bằng cách quy  | 6 | 1/3/2/3 | 2/0 | ✅ | — |
| G6-MATH-SO-DOI-CUA | Xác định số đối của phân số | 2 | 1/1/0/1 | 2/0 | ⚠️ | +1 items, +1 hard (b>0.5) |
| G6-MATH-TRU-HAI-PHAN | Trừ hai phân số cùng mẫu | 1 | 0/1/0/1 | 2/1 | ⚠️ | +2 items, +1 easy (b<-0.5), +1 hard (b>0.5) |

### Block B26 (B26K2)

| Code | Name | Total | E/M/H/A | In/Out | Status | Thiếu |
|------|------|-------|---------|--------|--------|-------|
| G6-MATH-CHIA-HAI-PHAN | Chia hai phân số  | 8 | 2/3/3/1 | 2/2 | ✅ | — |
| G6-MATH-NHAN-HAI-PHAN | Nhân hai phân số  | 10 | 4/2/4/2 | 3/2 | ✅ | — |
| G6-MATH-PHAN-SO-NGHICH | Phân số nghịch đảo  | 8 | 3/4/1/4 | 1/1 | ✅ | — |

### Block B27 (B27K2)

| Code | Name | Total | E/M/H/A | In/Out | Status | Thiếu |
|------|------|-------|---------|--------|--------|-------|
| G6-MATH-TIM-GIA-TRI | Tìm giá trị phân số của một số | 5 | 2/3/0/3 | 2/0 | ⚠️ | +1 hard (b>0.5) |
| G9-MATH-TIM-MOT-SO | Tìm một số biết giá trị phân số của nó | 0 | 0/0/0/0 | 2/0 | 🔴 | **TẠO 6 ITEMS** (2E+2M+2H) |

### Block B28 (B28K2)

| Code | Name | Total | E/M/H/A | In/Out | Status | Thiếu |
|------|------|-------|---------|--------|--------|-------|
| G6-MATH-NHAN-BIET-VA | Nhận biết và đọc/viết số thập phân âm | 8 | 2/2/4/2 | 1/6 | ✅ | — |
| G6-MATH-SO-SANH-HAI-2 | So sánh hai số thập phân | 4 | 1/3/0/3 | 2/0 | ⚠️ | +1 hard (b>0.5) |

### Block B29 (B29K2)

| Code | Name | Total | E/M/H/A | In/Out | Status | Thiếu |
|------|------|-------|---------|--------|--------|-------|
| G6-MATH-CHIA-SO-THAP | Chia số thập phân có dấu | 9 | 2/4/3/4 | 2/0 | ✅ | — |
| G6-MATH-CONG-TRU-SO | Cộng trừ số thập phân có dấu  | 6 | 2/2/2/2 | 2/0 | ✅ | — |
| G6-MATH-NHAN-SO-THAP | Nhân số thập phân có dấu | 11 | 4/5/2/5 | 1/0 | ✅ | — |

### Block B2 (B2K1)

| Code | Name | Total | E/M/H/A | In/Out | Status | Thiếu |
|------|------|-------|---------|--------|--------|-------|
| G9-MATH-BIEU-DIEN-MOI | Biểu diễn mỗi số tự nhiên thành tổng giá | 6 | 0/6/0/0 | 1/0 | ⚠️ | +1 easy (b<-0.5), +1 hard (b>0.5), +1 anchor |
| G9-MATH-BIEU-DIEN-SO | Biểu diễn số tự nhiên nhỏ hơn <30 thành  | 6 | 0/6/0/0 | 0/0 | ⚠️ | +1 easy (b<-0.5), +1 hard (b>0.5), +1 anchor, ⚠️ isolated |
| G9-MATH-DOC-VA-VIET | Đọc và viết chữ số | 0 | 0/0/0/0 | 0/0 | 🔴 | **TẠO 6 ITEMS** (2E+2M+2H), ⚠️ isolated |
| G9-MATH-NHAN-BIET-GIA | Nhận biết giá trị các chữ số của một số  | 6 | 0/6/0/0 | 0/2 | ⚠️ | +1 easy (b<-0.5), +1 hard (b>0.5), +1 anchor |

### Block B30 (B30K2)

| Code | Name | Total | E/M/H/A | In/Out | Status | Thiếu |
|------|------|-------|---------|--------|--------|-------|
| G6-MATH-LAM-TRON-SO | Làm tròn số thập phân có dấu đến hàng ch | 4 | 2/1/1/1 | 2/2 | ✅ | — |
| G6-MATH-UOC-LUONG-KET | Ước lượng kết quả phép tính với số thập  | 0 | 0/0/0/0 | 1/0 | 🔴 | **TẠO 6 ITEMS** (2E+2M+2H) |

### Block B31 (B31K2)

| Code | Name | Total | E/M/H/A | In/Out | Status | Thiếu |
|------|------|-------|---------|--------|--------|-------|
| G6-MATH-B31K2 | Tính tỉ số của hai số và viết dưới dạng  | 6 | 2/2/2/2 | 1/3 | ✅ | — |
| G6-MATH-TIM-GIA-TRI-1 | Tìm giá trị phần trăm của một số | 12 | 6/6/0/6 | 1/1 | ⚠️ | +1 hard (b>0.5) |
| G6-MATH-TIM-MOT-SO | Tìm một số biết giá trị phần trăm | 2 | 0/2/0/2 | 1/1 | ⚠️ | +1 items, +1 easy (b<-0.5), +1 hard (b>0.5) |

### Block B32 (B32K2)

| Code | Name | Total | E/M/H/A | In/Out | Status | Thiếu |
|------|------|-------|---------|--------|--------|-------|
| G6-MATH-BA-DIEM-THANG | Ba điểm thẳng hàng | 6 | 2/2/2/2 | 1/1 | ✅ | — |
| G6-MATH-DO-DAI-DOAN | Đo độ dài đoạn thẳng | 0 | 0/0/0/0 | 1/0 | 🔴 | **TẠO 6 ITEMS** (2E+2M+2H) |
| G6-MATH-DUONG-THANG-DI | Đường thẳng đi qua hai điểm phân biệt -  | 1 | 0/1/0/1 | 1/0 | ⚠️ | +2 items, +1 easy (b<-0.5), +1 hard (b>0.5) |
| G6-MATH-HAI-DUONG-THANG | Hai đường thẳng song song, cắt nhau, trù | 5 | 1/2/2/2 | 1/4 | ✅ | — |
| G6-MATH-NHAN-BIET-DIEM | Nhận biết điểm thuộc/không thuộc đường t | 4 | 1/2/1/2 | 1/2 | ✅ | — |
| G6-MATH-TIA | Tia | 1 | 0/1/0/1 | 0/3 | ⚠️ | +2 items, +1 easy (b<-0.5), +1 hard (b>0.5) |
| G6-MATH-TIA-DOI-NHAU | Tia đối nhau | 4 | 0/4/0/4 | 2/3 | ⚠️ | +1 easy (b<-0.5), +1 hard (b>0.5) |

### Block B33 (B33K2)

| Code | Name | Total | E/M/H/A | In/Out | Status | Thiếu |
|------|------|-------|---------|--------|--------|-------|
| G6-MATH-DIEM-NAM-GIUA | Điểm nằm giữa hai điểm  | 5 | 2/1/2/1 | 1/3 | ✅ | — |

### Block B34 (B34K2)

| Code | Name | Total | E/M/H/A | In/Out | Status | Thiếu |
|------|------|-------|---------|--------|--------|-------|
| G6-MATH-CONG-DO-DAI | Cộng độ dài đoạn thẳng  | 5 | 1/2/2/2 | 2/1 | ✅ | — |
| G6-MATH-NHAN-BIET-DOAN | Nhận biết đoạn thẳng | 4 | 1/2/1/2 | 0/3 | ✅ | — |
| G6-MATH-SO-SANH-DO | So sánh độ dài đoạn thẳng | 5 | 1/4/0/4 | 1/2 | ⚠️ | +1 hard (b>0.5) |

### Block B35 (B35K2)

| Code | Name | Total | E/M/H/A | In/Out | Status | Thiếu |
|------|------|-------|---------|--------|--------|-------|
| G6-MATH-NHAN-BIET-TRUNG | Nhận biết trung điểm của đoạn thẳng  | 5 | 0/4/1/2 | 1/3 | ⚠️ | +1 easy (b<-0.5) |
| G6-MATH-TINH-DO-DAI | Tính độ dài qua trung điểm  | 8 | 4/3/1/3 | 3/0 | ✅ | — |

### Block B36 (B36K2)

| Code | Name | Total | E/M/H/A | In/Out | Status | Thiếu |
|------|------|-------|---------|--------|--------|-------|
| G6-MATH-DIEM-TRONG-CUA | Điểm trong của một góc  | 5 | 2/1/2/1 | 1/0 | ✅ | — |
| G6-MATH-GOC-BET | Góc bẹt | 6 | 2/2/2/2 | 3/0 | ✅ | — |
| G9-MATH-NHAN-BIET-GOC | Nhận biết góc - đỉnh, cạnh, ký hiệu | 3 | 1/2/0/2 | 1/4 | ⚠️ | +1 hard (b>0.5) |

### Block B37 (B37K2)

| Code | Name | Total | E/M/H/A | In/Out | Status | Thiếu |
|------|------|-------|---------|--------|--------|-------|
| G6-MATH-B37K2 | Nhận biết góc đặc biệt  | 7 | 2/2/3/2 | 1/4 | ✅ | — |
| G6-MATH-DO-GOC-BANG | Đo góc bằng thước đo góc | 0 | 0/0/0/0 | 0/1 | 🔴 | **TẠO 6 ITEMS** (2E+2M+2H) |
| G6-MATH-SO-SANH-HAI-3 | So sánh hai góc  | 0 | 0/0/0/0 | 0/0 | 🔴 | **TẠO 6 ITEMS** (2E+2M+2H), ⚠️ isolated |

### Block B38 (B38K2)

| Code | Name | Total | E/M/H/A | In/Out | Status | Thiếu |
|------|------|-------|---------|--------|--------|-------|
| G6-MATH-CHON-PHUONG-PHAP | Chọn phương pháp thu thập dữ liệu  | 0 | 0/0/0/0 | 0/0 | 🔴 | **TẠO 6 ITEMS** (2E+2M+2H), ⚠️ isolated |
| G6-MATH-NHAN-BIET-DU | Nhận biết dữ liệu, phân biệt số liệu và  | 6 | 2/2/2/2 | 0/2 | ✅ | — |

### Block B39 (B39K2)

| Code | Name | Total | E/M/H/A | In/Out | Status | Thiếu |
|------|------|-------|---------|--------|--------|-------|
| G6-MATH-DOC-VA-PHAN | Đọc và phân tích dữ liệu từ bảng thống k | 5 | 2/2/1/2 | 0/3 | ✅ | — |
| G6-MATH-LAP-BANG-THONG | Lập bảng thống kê từ dữ liệu thô | 3 | 1/1/1/1 | 1/0 | ✅ | — |
| G6-MATH-LAP-BIEU-DO | Lập biểu đồ tranh từ bảng thống kê | 6 | 2/2/2/2 | 1/1 | ✅ | — |
| G6-MATH-DOC-VA-PHAN-1 | Đọc và phân tích dữ liệu từ biểu đồ tran | 6 | 2/2/2/2 | 0/1 | ✅ | — |

### Block B3 (B3K1)

| Code | Name | Total | E/M/H/A | In/Out | Status | Thiếu |
|------|------|-------|---------|--------|--------|-------|
| G6-MATH-KI-HIEU-NHO | Nhận biết và sử dụng đúng ký hiệu ≤ và ≥ | 6 | 0/6/0/0 | 1/1 | ⚠️ | +1 easy (b<-0.5), +1 hard (b>0.5), +1 anchor |
| G9-MATH-SO-SANH-HAI | So sánh hai số tự nhiên và biểu diễn trê | 6 | 0/6/0/0 | 2/2 | ⚠️ | +1 easy (b<-0.5), +1 hard (b>0.5), +1 anchor |

### Block B40 (B40K2)

| Code | Name | Total | E/M/H/A | In/Out | Status | Thiếu |
|------|------|-------|---------|--------|--------|-------|
| G6-MATH-DOC-VA-PHAN-2 | Đọc và phân tích dữ liệu từ biểu đồ cột  | 9 | 3/2/4/2 | 1/2 | ✅ | — |
| G6-MATH-NHAN-RA-VAN | Nhận ra vấn đề, quy luật từ biểu đồ cột  | 5 | 1/4/0/4 | 1/0 | ⚠️ | +1 hard (b>0.5) |
| G6-MATH-VE-BIEU-DO | Vẽ biểu đồ cột từ bảng thống kê | 4 | 2/2/0/2 | 3/1 | ⚠️ | +1 hard (b>0.5) |

### Block B41 (B41K2)

| Code | Name | Total | E/M/H/A | In/Out | Status | Thiếu |
|------|------|-------|---------|--------|--------|-------|
| G6-MATH-DOC-VA-PHAN-3 | Đọc và phân tích dữ liệu từ biểu đồ cột  | 6 | 2/2/2/2 | 2/1 | ✅ | — |
| G6-MATH-NHAN-RA-QUY | Nhận ra quy luật từ biểu đồ cột kép  | 4 | 2/1/1/1 | 1/0 | ✅ | — |
| G6-MATH-VE-BIEU-DO-1 | Vẽ biểu đồ cột kép từ bảng thống kê | 0 | 0/0/0/0 | 1/2 | 🔴 | **TẠO 6 ITEMS** (2E+2M+2H) |

### Block B42 (B42K2)

| Code | Name | Total | E/M/H/A | In/Out | Status | Thiếu |
|------|------|-------|---------|--------|--------|-------|
| G6-MATH-LIET-KE-KET | Liệt kê kết quả có thể của thí nghiệm gh | 6 | 2/2/2/2 | 1/1 | ✅ | — |
| G6-MATH-LIET-KE-TAT | Liệt kê tất cả kết quả có thể của trò ch | 6 | 2/2/2/2 | 0/3 | ✅ | — |
| G6-MATH-NHAN-BIET-SU | Nhận biết sự kiện xảy ra hay không dựa t | 6 | 2/2/2/2 | 2/2 | ✅ | — |
| G6-MATH-NHAN-BIET-TINH | Nhận biết tính không đoán trước của kết  | 0 | 0/0/0/0 | 0/0 | 🔴 | **TẠO 6 ITEMS** (2E+2M+2H), ⚠️ isolated |

### Block B43 (B43K2)

| Code | Name | Total | E/M/H/A | In/Out | Status | Thiếu |
|------|------|-------|---------|--------|--------|-------|
| G6-MATH-NHAN-XET-XAC | Nhận xét xác suất thực nghiệm  | 6 | 2/3/1/3 | 1/0 | ✅ | — |
| G6-MATH-TINH-XAC-SUAT | Tính xác suất thực nghiệm k/n từ bảng số | 6 | 2/4/0/4 | 1/1 | ⚠️ | +1 hard (b>0.5) |

### Block B4 (B4K1)

| Code | Name | Total | E/M/H/A | In/Out | Status | Thiếu |
|------|------|-------|---------|--------|--------|-------|
| G6-MATH-AP-DUNG-TINH | Nhận biết và xác định tính chất giao hoá | 0 | 0/0/0/0 | 0/0 | 🔴 | **TẠO 6 ITEMS** (2E+2M+2H), ⚠️ isolated |
| G6-MATH-NHAN-BIET-DIEU | Nhận biết điều kiện phép trừ thực hiện đ | 6 | 1/5/0/0 | 1/0 | ⚠️ | +1 hard (b>0.5), +1 anchor |

### Block B5 (B5K1)

| Code | Name | Total | E/M/H/A | In/Out | Status | Thiếu |
|------|------|-------|---------|--------|--------|-------|
| G6-MATH-AP-DUNG-TINH-1 | Nhận biết và áp dụng tính chất phân phối | 0 | 0/0/0/0 | 0/0 | 🔴 | **TẠO 6 ITEMS** (2E+2M+2H), ⚠️ isolated |
| G6-MATH-PHAN-BIET-PHEP | Phân biệt phép chia hết và phép chia có  | 6 | 2/2/2/0 | 0/8 | ⚠️ | +1 anchor |
| G9-MATH-1AP-DUNG-TINH | Nhận biết và xác định tính chất giao hoá | 0 | 0/0/0/0 | 0/0 | 🔴 | **TẠO 6 ITEMS** (2E+2M+2H), ⚠️ isolated |
| G9-MATH-PHAN-PHOI-NHAN | Nhận biết và áp dụng tính chất phân phối | 5 | 1/3/1/0 | 0/1 | ⚠️ | +1 anchor |

### Block B6 (B6K1)

| Code | Name | Total | E/M/H/A | In/Out | Status | Thiếu |
|------|------|-------|---------|--------|--------|-------|
| G6-MATH-TINH-GIA-TRI | Tính giá trị luỹ thừa | 1 | 1/0/0/0 | 2/1 | ⚠️ | +2 items, +1 medium, +1 hard (b>0.5), +1 anchor |
| G9-MATH-CHIA-LUY-THUA | Chia luỹ thừa cùng cơ số áp dụng quy tắc | 6 | 0/3/3/0 | 1/0 | ⚠️ | +1 easy (b<-0.5), +1 anchor |
| G9-MATH-NHAN-BIET-BINH | Nhận biết bình phương, lập phương, | 8 | 2/4/2/4 | 1/2 | ✅ | — |
| G9-MATH-NHAN-BIET-CAU | Nhận biết cấu trúc lũy thừa (cơ số, số m | 6 | 2/2/2/0 | 0/8 | ⚠️ | +1 anchor |
| G9-MATH-NHAN-BIET-SO | Nhận biết số chính phương | 4 | 2/2/0/2 | 2/0 | ⚠️ | +1 hard (b>0.5) |
| G9-MATH-NHAN-LUY-THUA | Nhân luỹ thừa cùng cơ số áp dụng quy tắc | 6 | 1/3/2/0 | 1/0 | ⚠️ | +1 anchor |

### Block B7 (B7K1)

| Code | Name | Total | E/M/H/A | In/Out | Status | Thiếu |
|------|------|-------|---------|--------|--------|-------|
| G6-MATH-AP-DUNG-DUNG | Áp dụng đúng thứ tự phép tính KHÔNG có n | 7 | 2/2/3/2 | 1/0 | ✅ | — |
| G6-MATH-AP-DUNG-DUNG-1 | Áp dụng đúng thứ tự phép tính CÓ ngoặc ( | 7 | 2/3/2/2 | 0/1 | ✅ | — |

### Block B8 (B8K1)

| Code | Name | Total | E/M/H/A | In/Out | Status | Thiếu |
|------|------|-------|---------|--------|--------|-------|
| G6-MATH-NHAN-BIET-KY | Nhận biết ký hiệu chia hết, không chia h | 6 | 2/2/2/2 | 1/0 | ✅ | — |
| G6-MATH-TIM-BOI-CUA | Tìm bội của một số  | 6 | 3/1/2/1 | 1/1 | ✅ | — |
| G6-MATH-TIM-UOC-CUA | Tìm ước của một số  | 6 | 2/2/2/2 | 1/1 | ✅ | — |
| G6-MATH-TINH-CHAT-CHIA | Tính chất chia hết của một tổng TC1, TC2 | 6 | 2/2/2/2 | 1/0 | ✅ | — |
| G6-MATH-XAC-DINH-UOC | Xác định ước và bội trong phép chia hết  | 6 | 1/3/2/2 | 1/5 | ✅ | — |

### Block B9 (B9K1)

| Code | Name | Total | E/M/H/A | In/Out | Status | Thiếu |
|------|------|-------|---------|--------|--------|-------|
| G6-MATH-DAU-HIEU-CHIA | Dấu hiệu chia hết cho 2  | 6 | 0/6/0/0 | 1/0 | ⚠️ | +1 easy (b<-0.5), +1 hard (b>0.5), +1 anchor |
| G6-MATH-DAU-HIEU-CHIA-1 | Dấu hiệu chia hết cho 9  | 6 | 0/6/0/0 | 1/0 | ⚠️ | +1 easy (b<-0.5), +1 hard (b>0.5), +1 anchor |
| G9-MATH-DAU-HIEU-CHIA | Dấu hiệu chia hết cho 5 | 6 | 0/6/0/0 | 1/0 | ⚠️ | +1 easy (b<-0.5), +1 hard (b>0.5), +1 anchor |
| G9-MATH-DAU-HIEU-CHIA-1 | Dấu hiệu chia hết cho 3 | 6 | 0/6/0/0 | 1/0 | ⚠️ | +1 easy (b<-0.5), +1 hard (b>0.5), +1 anchor |

### Block TIỂU HỌC (TIỂU HỌC)

| Code | Name | Total | E/M/H/A | In/Out | Status | Thiếu |
|------|------|-------|---------|--------|--------|-------|
| G6-MATH-CHIA-DAT-TINH | Chia đặt tính  | 0 | 0/0/0/0 | 0/0 | 🔴 | **TẠO 6 ITEMS** (2E+2M+2H), ⚠️ isolated |
| G6-MATH-CONG-TRU-DAT | Cộng Trừ, đặt tính tiểu học  | 0 | 0/0/0/0 | 0/0 | 🔴 | **TẠO 6 ITEMS** (2E+2M+2H), ⚠️ isolated |
| G6-MATH-NHAN-DAT-TINH | Nhân đặt tính  | 0 | 0/0/0/0 | 0/0 | 🔴 | **TẠO 6 ITEMS** (2E+2M+2H), ⚠️ isolated |
| G9-MATH-SO-LIEN-TRUOC | Số liền trước liền sau  | 6 | 0/6/0/0 | 0/0 | ⚠️ | +1 easy (b<-0.5), +1 hard (b>0.5), +1 anchor, ⚠️ isolated |

### Block Tiêu học  (Tiêu học )

| Code | Name | Total | E/M/H/A | In/Out | Status | Thiếu |
|------|------|-------|---------|--------|--------|-------|
| G6-MATH-DIEM-DUONG-THANG | Điểm, đường thẳng  | 10 | 4/2/4/2 | 0/2 | ✅ | — |

---

## Kế hoạch hành động (Action Plan)

### 🔴 Priority 1: KCs có edges nhưng KHÔNG có items (Assessment sẽ CRASH)

Đây là các KC nằm trên đường traverse của KST. Nếu assessment đi qua sẽ trả về `item: null`.

| # | Code | Name | Block | Edges | Action |
|---|------|------|-------|-------|--------|
| 1 | G9-MATH-SO-SANH-HAI-1 | Biểu diễn số nguyên trên trục số và | B13K1 | 4 | Generate 6 MCQs |
| 2 | G6-MATH-TU-CHO-SO | Trừ hai số nguyên | B14K1 | 2 | Generate 6 MCQs |
| 3 | G9-MATH-CONG-HAI-SO | Cộng hai số nguyên khác dấu  | B14K1 | 3 | Generate 6 MCQs |
| 4 | G9-MATH-BO-DAU-NGOAC | Bỏ dấu ngoặc có dấu - đằng trước | B15K1 | 3 | Generate 6 MCQs |
| 5 | G6-MATH-TIM-UOC-VA | Tìm ước và bội số  | B17K1 | 4 | Generate 6 MCQs |
| 6 | G9-MATH-NHAN-BIET-MO | Nhận biết mở rộng mối quan hệ chia  | B17K1 | 4 | Generate 6 MCQs |
| 7 | G9-MATH-THUC-HIEN-PHEP | Thực hiện phép chia hết hai số nguy | B17K1 | 5 | Generate 6 MCQs |
| 8 | G6-MATH-VE-HINH-VUONG | Vẽ Hình vuông | B18K1 | 1 | Generate 6 MCQs |
| 9 | G6-MATH-VE-HINH-BINH | Vẽ hình bình hành | B19K1 | 1 | Generate 6 MCQs |
| 10 | G6-MATH-VE-HINH-CHU | Vẽ hình chữ nhật  | B19K1 | 1 | Generate 6 MCQs |
| 11 | G6-MATH-VE-HINH-THOI | Vẽ hình thoi | B19K1 | 1 | Generate 6 MCQs |
| 12 | G9-MATH-TIM-VA-XAC | Tìm và xác định trục đối xứng của v | B21K1 | 1 | Generate 6 MCQs |
| 13 | G6-MATH-NHAN-BIET-HINH-2 | Nhận biết hình có tâm đối xứng | B22K1 | 2 | Generate 6 MCQs |
| 14 | G6-MATH-XAC-DINH-VI | Xác định vị trí tâm đối xứng của hì | B22K1 | 1 | Generate 6 MCQs |
| 15 | G6-MATH-XAC-DINH-VI-1 | Xác định vị trí tâm đối xứng của cá | B22K1 | 1 | Generate 6 MCQs |
| 16 | G6-MATH-TINH-CHAT-CO | Áp dụng tính chất cơ bản của phân s | B23K2 | 6 | Generate 6 MCQs |
| 17 | G6-MAMATMATHMAT | Trừ hai phân số khác mẫu | B25K2 | 2 | Generate 6 MCQs |
| 18 | G9-MATH-TIM-MOT-SO | Tìm một số biết giá trị phân số của | B27K2 | 2 | Generate 6 MCQs |
| 19 | G6-MATH-UOC-LUONG-KET | Ước lượng kết quả phép tính với số  | B30K2 | 1 | Generate 6 MCQs |
| 20 | G6-MATH-DO-DAI-DOAN | Đo độ dài đoạn thẳng | B32K2 | 1 | Generate 6 MCQs |
| 21 | G6-MATH-DO-GOC-BANG | Đo góc bằng thước đo góc | B37K2 | 1 | Generate 6 MCQs |
| 22 | G6-MATH-VE-BIEU-DO-1 | Vẽ biểu đồ cột kép từ bảng thống kê | B41K2 | 3 | Generate 6 MCQs |

> **Tổng: 22 KCs** — Phải xử lý trước khi chạy assessment.

### 🟠 Priority 2: KCs có items < 3 (IRT ZPD thiếu pool)

| # | Code | Name | Total | Cần thêm |
|---|------|------|-------|---------|
| 1 | G6-MATH-QUY-DONG-PHAN | Quy đồng mẫu các phân số | 1 | +2 items |
| 2 | G6-MATH-TIM-BCNN | Tìm BCNN | 2 | +1 items |
| 3 | G6-MATH-NHAN-HAI-SO | Nhân hai số nguyên khác dấu  | 2 | +1 items |
| 4 | G6-MATH-VE-HINH-TAM | Vẽ hình tam giác đều  | 1 | +2 items |
| 5 | G9-MATH-NHAN-BIET-PHAN | Nhận biết phân số có tử và mẫu là s | 1 | +2 items |
| 6 | G6-MATH-SO-DOI-CUA | Xác định số đối của phân số | 2 | +1 items |
| 7 | G6-MATH-TRU-HAI-PHAN | Trừ hai phân số cùng mẫu | 1 | +2 items |
| 8 | G6-MATH-TIM-MOT-SO | Tìm một số biết giá trị phần trăm | 2 | +1 items |
| 9 | G6-MATH-DUONG-THANG-DI | Đường thẳng đi qua hai điểm phân bi | 1 | +2 items |
| 10 | G6-MATH-TIA | Tia | 1 | +2 items |
| 11 | G6-MATH-TINH-GIA-TRI | Tính giá trị luỹ thừa | 1 | +2 items |

> **Tổng: 11 KCs**

### 🟡 Priority 3: KCs thiếu Hard items (phổ biến nhất)

Không có hard items → IRT không thể estimate θ cao → strong student bị underestimate.

| # | Code | Name | Current E/M/H | Action |
|---|------|------|--------------|--------|
| 1 | G6-MATH-RUT-GON-VE | Rút gọn về phân số tối giản | 2/2/0 | +1 hard (set irt_b=1.5) |
| 2 | G6-MATH-TIM-UCLN | Tìm ƯCLN | 1/3/0 | +1 hard (set irt_b=1.5) |
| 3 | G9-MATH-NHAN-BIET-UOC | Nhận Biết ước chung và ƯCLN | 2/1/0 | +1 hard (set irt_b=1.5) |
| 4 | G6-MATH-NHAN-HAI-SO-1 | Nhân hai số nguyên cùng dấu | 1/2/0 | +1 hard (set irt_b=1.5) |
| 5 | G9-MATH-MO-TA-CAC | Mô tả các yếu tố cơ bản , góc (độ), | 1/2/0 | +1 hard (set irt_b=1.5) |
| 6 | G6-MATH-BIEU-DIEN-TAP | Biểu diễn tập hợp - Chỉ ra tính chấ | 0/6/0 | +1 hard (set irt_b=1.5) |
| 7 | G6-MATH-CLAUDE-SUGGEST-TAP | Nhận biết tập hợp rỗng và sử dụng k | 0/6/0 | +1 hard (set irt_b=1.5) |
| 8 | G6-MATH-NHAN-BIET-PHAN | Nhận biết phần tử thuộc hoặc không  | 0/6/0 | +1 hard (set irt_b=1.5) |
| 9 | G6-MATH-NHAN-BIET-TAP | Nhận biết tập hợp và liệt kê tập hợ | 0/7/0 | +1 hard (set irt_b=1.5) |
| 10 | G6-MATH-TINH-CHU-VI | Tính chu vi hình bình hành | 1/4/0 | +1 hard (set irt_b=1.5) |
| 11 | G6-MATH-TINH-CHU-VI-1 | Tính chu vi hình thoi | 1/4/0 | +1 hard (set irt_b=1.5) |
| 12 | G6-MATH-QUY-DONG-MAU | Quy đồng mẫu các phân số có tử/mẫu  | 0/4/0 | +1 hard (set irt_b=1.5) |
| 13 | G6-MATH-SO-SANH-HAI | So sánh hai phân số cùng mẫu  | 4/3/0 | +1 hard (set irt_b=1.5) |
| 14 | G6-MATH-SO-SANH-HAI-1 | So sánh hai phân số khác mẫu bằng c | 1/2/0 | +1 hard (set irt_b=1.5) |
| 15 | G6-MATH-TIM-GIA-TRI | Tìm giá trị phân số của một số | 2/3/0 | +1 hard (set irt_b=1.5) |
| 16 | G6-MATH-SO-SANH-HAI-2 | So sánh hai số thập phân | 1/3/0 | +1 hard (set irt_b=1.5) |
| 17 | G9-MATH-BIEU-DIEN-MOI | Biểu diễn mỗi số tự nhiên thành tổn | 0/6/0 | +1 hard (set irt_b=1.5) |
| 18 | G9-MATH-BIEU-DIEN-SO | Biểu diễn số tự nhiên nhỏ hơn <30 t | 0/6/0 | +1 hard (set irt_b=1.5) |
| 19 | G9-MATH-NHAN-BIET-GIA | Nhận biết giá trị các chữ số của mộ | 0/6/0 | +1 hard (set irt_b=1.5) |
| 20 | G6-MATH-TIM-GIA-TRI-1 | Tìm giá trị phần trăm của một số | 6/6/0 | +1 hard (set irt_b=1.5) |
| 21 | G6-MATH-TIA-DOI-NHAU | Tia đối nhau | 0/4/0 | +1 hard (set irt_b=1.5) |
| 22 | G6-MATH-SO-SANH-DO | So sánh độ dài đoạn thẳng | 1/4/0 | +1 hard (set irt_b=1.5) |
| 23 | G9-MATH-NHAN-BIET-GOC | Nhận biết góc - đỉnh, cạnh, ký hiệu | 1/2/0 | +1 hard (set irt_b=1.5) |
| 24 | G6-MATH-KI-HIEU-NHO | Nhận biết và sử dụng đúng ký hiệu ≤ | 0/6/0 | +1 hard (set irt_b=1.5) |
| 25 | G9-MATH-SO-SANH-HAI | So sánh hai số tự nhiên và biểu diễ | 0/6/0 | +1 hard (set irt_b=1.5) |
| 26 | G6-MATH-NHAN-RA-VAN | Nhận ra vấn đề, quy luật từ biểu đồ | 1/4/0 | +1 hard (set irt_b=1.5) |
| 27 | G6-MATH-VE-BIEU-DO | Vẽ biểu đồ cột từ bảng thống kê | 2/2/0 | +1 hard (set irt_b=1.5) |
| 28 | G6-MATH-TINH-XAC-SUAT | Tính xác suất thực nghiệm k/n từ bả | 2/4/0 | +1 hard (set irt_b=1.5) |
| 29 | G6-MATH-NHAN-BIET-DIEU | Nhận biết điều kiện phép trừ thực h | 1/5/0 | +1 hard (set irt_b=1.5) |
| 30 | G9-MATH-NHAN-BIET-SO | Nhận biết số chính phương | 2/2/0 | +1 hard (set irt_b=1.5) |
| 31 | G6-MATH-DAU-HIEU-CHIA | Dấu hiệu chia hết cho 2  | 0/6/0 | +1 hard (set irt_b=1.5) |
| 32 | G6-MATH-DAU-HIEU-CHIA-1 | Dấu hiệu chia hết cho 9  | 0/6/0 | +1 hard (set irt_b=1.5) |
| 33 | G9-MATH-DAU-HIEU-CHIA | Dấu hiệu chia hết cho 5 | 0/6/0 | +1 hard (set irt_b=1.5) |
| 34 | G9-MATH-DAU-HIEU-CHIA-1 | Dấu hiệu chia hết cho 3 | 0/6/0 | +1 hard (set irt_b=1.5) |
| 35 | G9-MATH-SO-LIEN-TRUOC | Số liền trước liền sau  | 0/6/0 | +1 hard (set irt_b=1.5) |

> **Tổng: 35 KCs** — Có thể fix bằng cách chuyển 1 medium item thành hard (đổi irt_b=1.5) hoặc generate thêm.

### 🟡 Priority 4: KCs thiếu Easy items

| # | Code | Name | Current E/M/H | Action |
|---|------|------|--------------|--------|
| 1 | G6-MATH-BIEU-DIEN-TAP | Biểu diễn tập hợp - Chỉ ra tính chấ | 0/6/0 | +1 easy (set irt_b=-1.0) |
| 2 | G6-MATH-CLAUDE-SUGGEST-TAP | Nhận biết tập hợp rỗng và sử dụng k | 0/6/0 | +1 easy (set irt_b=-1.0) |
| 3 | G6-MATH-NHAN-BIET-PHAN | Nhận biết phần tử thuộc hoặc không  | 0/6/0 | +1 easy (set irt_b=-1.0) |
| 4 | G6-MATH-NHAN-BIET-TAP | Nhận biết tập hợp và liệt kê tập hợ | 0/7/0 | +1 easy (set irt_b=-1.0) |
| 5 | G6-MATH-QUY-DONG-MAU | Quy đồng mẫu các phân số có tử/mẫu  | 0/4/0 | +1 easy (set irt_b=-1.0) |
| 6 | G9-MATH-BIEU-DIEN-MOI | Biểu diễn mỗi số tự nhiên thành tổn | 0/6/0 | +1 easy (set irt_b=-1.0) |
| 7 | G9-MATH-BIEU-DIEN-SO | Biểu diễn số tự nhiên nhỏ hơn <30 t | 0/6/0 | +1 easy (set irt_b=-1.0) |
| 8 | G9-MATH-NHAN-BIET-GIA | Nhận biết giá trị các chữ số của mộ | 0/6/0 | +1 easy (set irt_b=-1.0) |
| 9 | G6-MATH-TIA-DOI-NHAU | Tia đối nhau | 0/4/0 | +1 easy (set irt_b=-1.0) |
| 10 | G6-MATH-NHAN-BIET-TRUNG | Nhận biết trung điểm của đoạn thẳng | 0/4/1 | +1 easy (set irt_b=-1.0) |
| 11 | G6-MATH-KI-HIEU-NHO | Nhận biết và sử dụng đúng ký hiệu ≤ | 0/6/0 | +1 easy (set irt_b=-1.0) |
| 12 | G9-MATH-SO-SANH-HAI | So sánh hai số tự nhiên và biểu diễ | 0/6/0 | +1 easy (set irt_b=-1.0) |
| 13 | G9-MATH-CHIA-LUY-THUA | Chia luỹ thừa cùng cơ số áp dụng qu | 0/3/3 | +1 easy (set irt_b=-1.0) |
| 14 | G6-MATH-DAU-HIEU-CHIA | Dấu hiệu chia hết cho 2  | 0/6/0 | +1 easy (set irt_b=-1.0) |
| 15 | G6-MATH-DAU-HIEU-CHIA-1 | Dấu hiệu chia hết cho 9  | 0/6/0 | +1 easy (set irt_b=-1.0) |
| 16 | G9-MATH-DAU-HIEU-CHIA | Dấu hiệu chia hết cho 5 | 0/6/0 | +1 easy (set irt_b=-1.0) |
| 17 | G9-MATH-DAU-HIEU-CHIA-1 | Dấu hiệu chia hết cho 3 | 0/6/0 | +1 easy (set irt_b=-1.0) |
| 18 | G9-MATH-SO-LIEN-TRUOC | Số liền trước liền sau  | 0/6/0 | +1 easy (set irt_b=-1.0) |

> **Tổng: 18 KCs**

### 🟡 Priority 5: KCs thiếu Anchor items

Anchor items cần: `is_diagnostic_anchor=TRUE` + `irt_b` trong [-0.4, 0.4].

| # | Code | Name | Total Items | Action |
|---|------|------|------------|--------|
| 1 | G6-MATH-BIEU-DIEN-TAP | Biểu diễn tập hợp - Chỉ ra tính chấ | 6 | Set 1 medium item → is_diagnostic_anchor=TRUE |
| 2 | G6-MATH-CLAUDE-SUGGEST-TAP | Nhận biết tập hợp rỗng và sử dụng k | 6 | Set 1 medium item → is_diagnostic_anchor=TRUE |
| 3 | G6-MATH-NHAN-BIET-PHAN | Nhận biết phần tử thuộc hoặc không  | 6 | Set 1 medium item → is_diagnostic_anchor=TRUE |
| 4 | G6-MATH-NHAN-BIET-TAP | Nhận biết tập hợp và liệt kê tập hợ | 7 | Set 1 medium item → is_diagnostic_anchor=TRUE |
| 5 | G9-MATH-BIEU-DIEN-MOI | Biểu diễn mỗi số tự nhiên thành tổn | 6 | Set 1 medium item → is_diagnostic_anchor=TRUE |
| 6 | G9-MATH-BIEU-DIEN-SO | Biểu diễn số tự nhiên nhỏ hơn <30 t | 6 | Set 1 medium item → is_diagnostic_anchor=TRUE |
| 7 | G9-MATH-NHAN-BIET-GIA | Nhận biết giá trị các chữ số của mộ | 6 | Set 1 medium item → is_diagnostic_anchor=TRUE |
| 8 | G6-MATH-KI-HIEU-NHO | Nhận biết và sử dụng đúng ký hiệu ≤ | 6 | Set 1 medium item → is_diagnostic_anchor=TRUE |
| 9 | G9-MATH-SO-SANH-HAI | So sánh hai số tự nhiên và biểu diễ | 6 | Set 1 medium item → is_diagnostic_anchor=TRUE |
| 10 | G6-MATH-NHAN-BIET-DIEU | Nhận biết điều kiện phép trừ thực h | 6 | Set 1 medium item → is_diagnostic_anchor=TRUE |
| 11 | G6-MATH-PHAN-BIET-PHEP | Phân biệt phép chia hết và phép chi | 6 | Set 1 medium item → is_diagnostic_anchor=TRUE |
| 12 | G9-MATH-PHAN-PHOI-NHAN | Nhận biết và áp dụng tính chất phân | 5 | Set 1 medium item → is_diagnostic_anchor=TRUE |
| 13 | G6-MATH-TINH-GIA-TRI | Tính giá trị luỹ thừa | 1 | Set 1 medium item → is_diagnostic_anchor=TRUE |
| 14 | G9-MATH-CHIA-LUY-THUA | Chia luỹ thừa cùng cơ số áp dụng qu | 6 | Set 1 medium item → is_diagnostic_anchor=TRUE |
| 15 | G9-MATH-NHAN-BIET-CAU | Nhận biết cấu trúc lũy thừa (cơ số, | 6 | Set 1 medium item → is_diagnostic_anchor=TRUE |
| 16 | G9-MATH-NHAN-LUY-THUA | Nhân luỹ thừa cùng cơ số áp dụng qu | 6 | Set 1 medium item → is_diagnostic_anchor=TRUE |
| 17 | G6-MATH-DAU-HIEU-CHIA | Dấu hiệu chia hết cho 2  | 6 | Set 1 medium item → is_diagnostic_anchor=TRUE |
| 18 | G6-MATH-DAU-HIEU-CHIA-1 | Dấu hiệu chia hết cho 9  | 6 | Set 1 medium item → is_diagnostic_anchor=TRUE |
| 19 | G9-MATH-DAU-HIEU-CHIA | Dấu hiệu chia hết cho 5 | 6 | Set 1 medium item → is_diagnostic_anchor=TRUE |
| 20 | G9-MATH-DAU-HIEU-CHIA-1 | Dấu hiệu chia hết cho 3 | 6 | Set 1 medium item → is_diagnostic_anchor=TRUE |
| 21 | G9-MATH-SO-LIEN-TRUOC | Số liền trước liền sau  | 6 | Set 1 medium item → is_diagnostic_anchor=TRUE |

> **Tổng: 21 KCs** — Fix nhanh: chỉ cần UPDATE 1 medium item.

### ⚪ Priority 6: KCs Isolated (không có edges)

Không ảnh hưởng assessment nhưng unreachable — KST không bao giờ navigate tới.

| # | Code | Name | Block | Items | Action |
|---|------|------|-------|-------|--------|
| 1 | G6-MATH-TINH-CHAT-PHEP | Tính chất phép nhân | 16K1 | 0 | Connect to graph hoặc xóa |
| 2 | G9-MATH-BIEU-DIEN-SO | Biểu diễn số tự nhiên nhỏ hơn <30 t | B2K1 | 6 | Connect to graph hoặc xóa |
| 3 | G9-MATH-DOC-VA-VIET | Đọc và viết chữ số | B2K1 | 0 | Connect to graph hoặc xóa |
| 4 | G6-MATH-SO-SANH-HAI-3 | So sánh hai góc  | B37K2 | 0 | Connect to graph hoặc xóa |
| 5 | G6-MATH-CHON-PHUONG-PHAP | Chọn phương pháp thu thập dữ liệu  | B38K2 | 0 | Connect to graph hoặc xóa |
| 6 | G6-MATH-NHAN-BIET-TINH | Nhận biết tính không đoán trước của | B42K2 | 0 | Connect to graph hoặc xóa |
| 7 | G6-MATH-AP-DUNG-TINH | Nhận biết và xác định tính chất gia | B4K1 | 0 | Connect to graph hoặc xóa |
| 8 | G6-MATH-AP-DUNG-TINH-1 | Nhận biết và áp dụng tính chất phân | B5K1 | 0 | Connect to graph hoặc xóa |
| 9 | G9-MATH-1AP-DUNG-TINH | Nhận biết và xác định tính chất gia | B5K1 | 0 | Connect to graph hoặc xóa |
| 10 | G6-MATH-CHIA-DAT-TINH | Chia đặt tính  | TIỂU HỌC | 0 | Connect to graph hoặc xóa |
| 11 | G6-MATH-CONG-TRU-DAT | Cộng Trừ, đặt tính tiểu học  | TIỂU HỌC | 0 | Connect to graph hoặc xóa |
| 12 | G6-MATH-NHAN-DAT-TINH | Nhân đặt tính  | TIỂU HỌC | 0 | Connect to graph hoặc xóa |
| 13 | G9-MATH-SO-LIEN-TRUOC | Số liền trước liền sau  | TIỂU HỌC | 6 | Connect to graph hoặc xóa |

> **Tổng: 13 KCs**
