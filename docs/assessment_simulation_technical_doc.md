# Assessment Simulation Harness — Tài Liệu Kỹ Thuật Chi Tiết

> Giải thích đầy đủ: (1) Nền tảng academic, KST hoạt động thế nào, tại sao cần sửa (2) Chúng ta build algorithm và prompt agent ra sao, tại sao lại thiết kế như vậy

---

## Phần 1: Nền Tảng Academic — Knowledge Space Theory (KST)

### 1.1 KST Là Gì?

**Knowledge Space Theory** (Doignon & Falmagne, 1999) là lý thuyết toán học về cấu trúc kiến thức. Ý tưởng cốt lõi:

> Kiến thức không phải "nhiều hay ít" — mà có **cấu trúc phụ thuộc**. Bạn không thể hiểu phương trình bậc 2 nếu chưa biết giải phương trình bậc 1.

KST mô hình hóa điều này bằng **Directed Acyclic Graph (DAG):**
- Mỗi **node** = 1 Knowledge Component (KC) — 1 đơn vị kiến thức nhỏ nhất
- Mỗi **edge** A → B = "phải biết A trước khi học B" (A là prerequisite của B)
- **Root nodes** = kiến thức nền tảng nhất (không cần prerequisite nào)
- **Leaf nodes** = kiến thức nâng cao nhất (không unlock thêm gì)

**Ví dụ nhỏ cho Toán lớp 6:**
```
Đếm phần tử tập hợp ← Số tự nhiên ← Chia hết ← Số nguyên tố ← UCLN
                                                                 ← BCNN
```
→ Nếu em không biết "chia hết", CHẮC CHẮN em không biết "UCLN" hay "BCNN".

### 1.2 KST Dùng Trong Assessment Thế Nào?

KST cho phép **adaptive assessment** — kiểm tra thông minh, không hỏi hết 200 câu:

**Nguyên tắc chính:**
1. **Bắt đầu từ giữa graph** (middle node) — vì nếu hỏi root thì ai cũng đúng, hỏi leaf thì ai cũng sai
2. **Nếu đúng → đi lên** (test successor = kiến thức khó hơn)
3. **Nếu sai → đi xuống** (test prerequisite = kiến thức dễ hơn)
4. **Khi sai ở root → "fundamental gap"** = lỗ hổng nền tảng, không cần test thêm

**Tính chất toán học quan trọng — Downward Closure:**
> Nếu học sinh biết KC ở level 5, KST **suy luận** rằng em biết tất cả các KC ở level 1-4 (prerequisite chain). → KHÔNG CẦN HỎI lại level 1-4.

Đây là lý do KST hiệu quả: thay vì hỏi 200 KC, chỉ cần hỏi ~20-30 KC ở "biên giới" kiến thức (frontier).

### 1.3 Code KST Của Chúng Ta — knowledge_graph.py

#### `find_starting_kc(known_kcs)` — Chọn KC bắt đầu

```python
# Eligible KCs = KCs mà TẤT CẢ prerequisite đã nằm trong known_kcs
# Score = fulfilled_ancestors + unmastered_descendants
# → Maximize: chọn node ở "giữa" graph
```

**Đối với student mới (known_kcs = ∅):**
- Chỉ root nodes eligible (vì chỉ root không có prerequisite nào)
- Chọn root có nhiều descendants nhất (ảnh hưởng lớn nhất)

**Vấn đề phát hiện:** Nếu student mới, hệ thống BẮT BUỘC bắt đầu ở root. Nếu student fail root → KST không biết đi đâu tiếp.

#### `navigate(current_kc, passed, known_kcs)` — Đi tiếp

```python
if passed:
    # Tìm successor mà TẤT CẢ prerequisite đã fulfilled
    candidates = [s for s in successors(current_kc)
                  if all(prereq in known_kcs for prereq in predecessors(s))]
else:
    # Tìm prerequisite chưa mastered
    candidates = [p for p in predecessors(current_kc)
                  if p not in known_kcs]
```

**Khi candidates rỗng:**
- Pass + no successor → student đã lên đỉnh graph → **done**
- Fail + no prerequisite → student fail ở root → **fundamental_gap** → **DONE**

### 1.4 Vấn Đề Academic Của KST — Tại Sao Test Minh Dừng Sớm

**Chuyện xảy ra trong test Minh:**

```
Bước 1: find_starting_kc(∅)
  → Eligible: chỉ root nodes (vì known_kcs rỗng)
  → Chọn root: G6-MATH-NHAN-BIET-DOC ("Nhận biết số nguyên âm")
  → Lý do: root này có nhiều descendants nhất

Bước 2-7: Minh fail KC này (streak sai = 3)
  → _fail_kc() gọi navigate(current_kc, passed=False)
  → predecessors(G6-MATH-NHAN-BIET-DOC) = ∅ (nó LÀ root)
  → candidates rỗng → return None
  → _fail_kc() → kc_results["..."] = "fundamental_gap"
  → _finalize() → DỪNG

Kết quả: Chỉ test 1 KC / 247 KCs
```

**Đây không phải bug — đây là giới hạn thiết kế KST thuần túy (pure KST):**

| Tính chất KST | Ưu điểm | Nhược điểm |
|----------------|---------|------------|
| Downward Closure | Nếu biết node cao → infer biết hết dưới | Nếu fail root → assume hổng HẾT bên dưới |
| Single path traversal | Hiệu quả (ít câu hỏi) | Chỉ khám phá 1 nhánh của graph |
| Prerequisite-only navigation | Logic chặt chẽ | Không có lateral movement (sang nhánh khác) |

### 1.5 Cần Sửa KST Thế Nào — Đề Xuất Academic

#### Vấn đề 1: "Root Trap" — Fail Root → Dừng

**Giải pháp: Multi-root traversal**

Thay vì dừng khi fail root, hệ thống nên:
1. Đánh dấu root hiện tại = `fundamental_gap`
2. Tìm root KHÁC chưa test → bắt đầu nhánh mới
3. Lặp lại cho đến khi hết root hoặc đủ items

```
Ví dụ graph có 3 roots:
  Root A (Tập hợp) ────→ ...
  Root B (Số nguyên) ───→ ...  ← Minh fail ở đây
  Root C (Hình học) ────→ ...

KST hiện tại: fail Root B → DỪNG
KST cải tiến:  fail Root B → mark gap → test Root A → test Root C
```

**Cơ sở academic:** Thật ra KST gốc KHÔNG nói phải dừng khi fail root. Doignon & Falmagne mô tả **Knowledge State** = tập hợp các KC student biết. Assessment nên xác định state ĐÚNG bằng cách test đủ nodes, không phải dừng sớm.

#### Vấn đề 2: "Tunnel Vision" — Chỉ Test 1 Nhánh

**Giải pháp: Frontier-based assessment**

Thay vì đi dọc 1 prerequisite chain, hệ thống nên maintain **frontier** = set các KC ở "biên giới" giữa known và unknown:

```python
frontier = {kc for kc in graph
            if all(prereq in known for prereq in predecessors(kc))
            and kc not in known}

# Chọn next KC từ frontier (không chỉ successors/predecessors của current)
# → Explore NHIỀU nhánh, không bị mắc kẹt ở 1 nhánh
```

**Cơ sở academic:** Đây là thuật toán ALEKS (Assessment and LEarning in Knowledge Spaces) — commercial implementation của KST bởi chính Falmagne. ALEKS dùng **probabilistic assessment** trên toàn frontier, không chỉ 1 path.

#### Vấn đề 3: Item Pool Quá Ít

Mỗi KC cần tối thiểu **6 unique items** với phân bố:
- 2 easy (irt_b ≈ -1.0) — cho student yếu vẫn có cơ hội đúng
- 2 medium (irt_b ≈ 0.0) — phân biệt student trung bình
- 2 hard (irt_b ≈ +1.5) — challenge student giỏi

KC `G6-MATH-NHAN-BIET-DOC` chỉ có 2 items → lặp lại 4 lần → assessment không valid.

---

## Phần 2: Algorithm & Prompt Agent — Build Thế Nào và Tại Sao

### 2.1 Bài Toán Chúng Ta Muốn Giải

> **Đầu vào:** 1 học sinh ảo (biết gì, hổng gì) + hệ thống assessment thật
> **Quá trình:** Cho học sinh ảo làm bài trên hệ thống → hệ thống chẩn đoán
> **Đầu ra:** So sánh — chẩn đoán có đúng với sự thật không?

Đây là **validation loop** cho adaptive learning — tương tự unit test cho phần mềm, nhưng test cho assessment engine.

### 2.2 Tại Sao Cần AI Agent (Không Dùng Random/Math)?

**Cách 1: Random/Math Simulation** (nhanh, miễn phí)
```python
# Biết KC → đúng (90%), sai (10% slip)
# Không biết → đúng (25% guess), sai (75%)
if knows_kc:
    correct = random() < 0.9
else:
    correct = random() < 0.25
```

**Vấn đề:** Cách này test ALGORITHM (IRT + KST), nhưng KHÔNG test:
- Chất lượng câu hỏi (câu hỏi có rõ ràng không?)
- Wording (ngôn ngữ có phù hợp lớp 6?)
- Distractors (đáp án sai có hấp dẫn không?)
- Answer bias (học sinh hay chọn A khi không biết?)

**Cách 2: AI Agent** (chậm, có cost)
```
Input:  "Em Minh, lớp 6, biết tập hợp nhưng không biết lũy thừa"
Output: Agent ĐỌC câu hỏi thật → SUY NGHĨ như trẻ → chọn đáp án
```

**Ưu điểm:** Test end-to-end — bao gồm cả content quality. Nếu câu hỏi viết tệ (đáp án sai quá dễ loại trừ → student đoán đúng) → agent sẽ phát hiện.

**→ Chúng ta cần CẢ HAI:** Math mode cho batch statistics, Agent mode cho content validation.

### 2.3 Kiến Trúc Hệ Thống — 3 Layers

```
┌─────────────────────────────────────────────────────────────┐
│                    Layer 3: API Endpoints                    │
│  sandbox_assess.py                                          │
│  POST /sandbox/assess    POST /sandbox/assess/validate      │
└───────────────────────────┬─────────────────────────────────┘
                            │
┌───────────────────────────▼─────────────────────────────────┐
│                  Layer 2: Simulation Runner                  │
│  assessment_sim.py                                          │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────┐  │
│  │ run_agent_   │  │ run_math_    │  │ compare_         │  │
│  │ assessment() │  │ assessment() │  │ diagnosis()      │  │
│  └──────┬───────┘  └──────┬───────┘  └──────────────────┘  │
│         │                 │                                  │
│  ┌──────▼───────┐  ┌──────▼───────┐                        │
│  │ AgentSession │  │ IRT formula  │                        │
│  │ (Gemini)     │  │ P(θ,a,b,c)  │                        │
│  └──────────────┘  └──────────────┘                        │
└───────────────────────────┬─────────────────────────────────┘
                            │
┌───────────────────────────▼─────────────────────────────────┐
│              Layer 1: Assessment Engine (Production)         │
│  assessment.py + knowledge_graph.py + irt.py                │
│  CATController ← KHÔNG SỬA — chạy y production             │
└─────────────────────────────────────────────────────────────┘
```

**Nguyên tắc thiết kế quan trọng:** Simulation layer KHÔNG sửa assessment engine. Nó chạy ĐÚNG engine production — chỉ thay input (agent vs real student). Nếu sửa engine cho simulation thì kết quả không phản ánh production.

### 2.4 Agent Student — Thiết Kế Prompt

#### Tại sao dùng System Prompt (không phải User Prompt)?

```python
chat = client.chats.create(
    model="gemini-3-flash-preview",
    config=GenerateContentConfig(
        system_instruction=persona_prompt,  # ← persona = system instruction
        ...
    ),
)
```

**Lý do:**
- System instruction = identity, luôn active → agent nhớ mình là ai suốt conversation
- User prompt = câu hỏi, thay đổi mỗi turn
- Nếu đặt persona trong user prompt → context bị pha loãng sau 10+ câu hỏi

#### Cấu trúc Persona Prompt — 5 Phần

```
1. THÔNG TIN HỌC SINH     ← tên, lớp, mô tả chung
2. KIẾN THỨC (GROUND TRUTH) ← phần QUAN TRỌNG NHẤT
3. TÍNH CÁCH KHI LÀM BÀI  ← cẩn thận/bất cẩn, nhanh/chậm
4. QUY TẮC BẮT BUỘC       ← format output, ví dụ
5. CONSTRAINTS             ← "không được thông minh hơn persona"
```

**Phần 2 (GROUND TRUTH) là quan trọng nhất** vì nó quyết định agent trả lời đúng/sai. Prompt phải:
- Liệt kê RÕ RÀNG biết gì / không biết gì
- Mô tả CỤ THỂ cách nhầm (vd: "2³ = 2×3 = 6" thay vì chỉ nói "không biết lũy thừa")
- Dùng ngôn ngữ trẻ con ("em tưởng", "em nhớ mang máng") để agent nhập vai

#### Tại sao cần Few-shot Examples trong Prompt?

```
## Ví dụ khi em BIẾT:
THINKING: Câu này hỏi tập hợp A = {1, 2, 3} có bao nhiêu phần tử.
Em đếm: 1, 2, 3 là 3 phần tử. Em chắc chắn rồi.
ANSWER: B

## Ví dụ khi em KHÔNG BIẾT:
THINKING: Lũy thừa hả... em nhớ mang máng 2 mũ 3 là 2 nhân 3 bằng 6.
Chắc là đáp án A quá.
ANSWER: A
```

**Lý do:**
1. **Format compliance:** Nếu không có ví dụ, Gemini hay trả lời free-form → parse khó
2. **Tone calibration:** Ví dụ set tone "trẻ con" → output nhất quán
3. **Behavioral anchoring:** Ví dụ "KHÔNG BIẾT" cho thấy suy nghĩ SAI cụ thể → agent follow

#### Tại sao dùng Multi-turn Chat (không phải Single Call)?

```python
# Multi-turn: 1 session, nhiều messages
chat = client.chats.create(...)       # session tạo 1 lần
chat.send_message(question_1)         # câu 1
chat.send_message(question_2)         # câu 2 — Gemini nhớ câu 1
chat.send_message(question_3)         # câu 3 — nhớ cả 1 & 2
```

**Lý do:**
1. Persona **nhất quán** — agent nhớ mình đang đóng vai ai
2. **Context accumulation** — nếu câu 1 sai lũy thừa, câu 5 cũng phải sai lũy thừa theo cùng kiểu nhầm
3. **Cost hiệu quả** — system prompt chỉ gửi 1 lần, prompt caching tiết kiệm input tokens

#### Tại sao Temperature = 0.5?

```python
temperature=0.5  # không quá thấp, không quá cao
```

- **T=0:** Deterministic → agent luôn trả lời GIỐNG NHAU cho cùng câu hỏi → không realistic (trẻ con không máy móc)
- **T=1:** Quá random → agent có thể "quên" persona, trả lời inconsistent
- **T=0.5:** Vừa đủ biến thiên → đôi khi cẩn thận đúng, đôi khi bất cẩn sai — giống trẻ thật

#### Tại sao max_output_tokens = 500?

Tiếng Việt tokenize nhiều hơn tiếng Anh (~1.5x). Thinking 3-4 câu + ANSWER cần:
- Tiếng Anh: ~150 tokens
- Tiếng Việt: ~250-400 tokens

Ban đầu set 300 → thinking bị cắt trước ANSWER → parser fallback A → kết quả sai.

### 2.5 Response Parser — Tại Sao Cần Robust Parsing

```python
def parse_agent_response(raw_text):
    # Bước 1: Tìm THINKING: ... (tất cả text cho đến ANSWER:)
    thinking_match = re.search(r"THINKING:\s*(.*?)(?=\nANSWER:|\Z)", raw, re.DOTALL)

    # Bước 2: Tìm ANSWER: [A-D]
    answer_match = re.search(r"ANSWER:\s*([A-Da-d])", raw)

    # Bước 3: Fallback — tìm A/B/C/D cuối cùng trong text
    fallback = re.search(r"\b([A-D])\s*\.?\s*$", raw)

    # Bước 4: Ultimate fallback → A
    answer = "A"
```

**Tại sao 4 bước?**
- Gemini không luôn tuân thủ format 100%
- Đôi khi viết "Đáp án: B" thay vì "ANSWER: B"
- Token truncation → ANSWER bị cắt → fallback cần thiết
- "A" là ultimate fallback vì tốt hơn crash

### 2.6 Diagnostic Comparator — Confusion Matrix

#### Tại sao dùng Gap-centric (không phải Mastery-centric)?

Trong adaptive learning, **bỏ sót lỗ hổng NGUY HIỂM HƠN tạo false alarm:**

| Lỗi | Hệ quả | Mức độ |
|------|--------|--------|
| False Negative (bỏ sót gap) | Học sinh tưởng mình ổn → không học → failure | **NGHIÊM TRỌNG** |
| False Positive (false alarm) | Học sinh ôn lại cái đã biết → mất thời gian | Nhẹ |

→ **Gap Recall** (tìm được bao nhiêu % lỗ hổng thật) là metric quan trọng nhất. Target: ≥ 70%.

#### Cách tính Confusion Matrix

```
Cho mỗi KC trong graph:

  Persona nói BIẾT + Hệ thống nói PASS  → True Negative  (đúng ✓)
  Persona nói GAP  + Hệ thống nói FAIL  → True Positive  (đúng ✓)
  Persona nói BIẾT + Hệ thống nói FAIL  → False Positive (báo nhầm)
  Persona nói GAP  + Hệ thống nói PASS  → False Negative (BỎ SÓT ⚠️)
  Persona nói GAP  + Hệ thống KHÔNG TEST → False Negative (cũng bỏ sót!)
```

**Lưu ý:** KC không được test cũng bị tính. Nếu hệ thống dừng sớm → nhiều gaps không test → FN cao → recall thấp. Đây chính xác là blindspot #1 đã phát hiện.

### 2.7 Dual Mode — Tại Sao Cần 2 Modes?

| Aspect | Agent Mode | Math Mode |
|--------|-----------|-----------|
| Engine | Gemini 3 Flash Preview | IRT formula `P(θ,a,b,c)` |
| Speed | ~3-5s/câu | Instant (< 1ms/câu) |
| Cost | ~$0.0006/câu | $0 |
| Test gì | Content quality + Algorithm | Algorithm only |
| Dùng khi | Validate câu hỏi mới | Batch analysis (100+ trials) |

**Math mode quan trọng vì:** Agent mode chạy 1 lần có thể do may rủi. Math mode chạy 1000 lần → thống kê gap_recall trung bình → kết luận tin cậy hơn.

### 2.8 Simulation Runner — Tại Sao Không Sửa CATController?

```python
async def run_agent_assessment(persona, kg, available_items):
    cat = CATController(kg, use_irt=True)  # ĐÚNG engine production

    result = cat.start(student_id="agent_Minh", known_kcs=set(), theta=0.0)

    while result["status"] != "done":
        item = result["item"]
        agent_response = await agent.answer_question(item)
        result = cat.respond(result["session"], item, agent_response.correct)
```

**Nguyên tắc:** Simulation wrapper chỉ **thay thế con người bằng agent**. Tất cả logic assessment (KST navigation, IRT theta update, streak counting, item selection) CHẠY Y NGUYÊN production code.

Nếu ta sửa CATController cho simulation → kết quả không phản ánh behavior thật → validation vô nghĩa.

---

## Phần 3: Kết Nối Tất Cả — Flow Hoàn Chỉnh

```
┌─────────────────────────────────────────────────────────────────┐
│ 1. DEFINE PERSONA                                               │
│    name="Minh", biết=[tập hợp, số nguyên], hổng=[lũy thừa]    │
└─────────────────────┬───────────────────────────────────────────┘
                      │
┌─────────────────────▼───────────────────────────────────────────┐
│ 2. CREATE GEMINI SESSION                                         │
│    System prompt = persona → Gemini nhập vai "Minh lớp 6"       │
└─────────────────────┬───────────────────────────────────────────┘
                      │
┌─────────────────────▼───────────────────────────────────────────┐
│ 3. START ASSESSMENT (CATController.start)                        │
│    find_starting_kc(∅) → root node → G6-MATH-NHAN-BIET-DOC     │
│    _pick_item() → diagnostic anchor → câu hỏi đầu tiên         │
└─────────────────────┬───────────────────────────────────────────┘
                      │
                      ▼
        ┌─────────────────────────────┐
        │ LOOP: Cho đến khi done     │
        │                             │
        │  4. Gửi câu hỏi → Gemini   │
        │     "Tập hợp ℤ gồm gì?"    │
        │                             │
        │  5. Gemini trả lời          │
        │     THINKING: "Em nhớ..."   │
        │     ANSWER: A               │
        │                             │
        │  6. Parse → correct=False   │
        │                             │
        │  7. cat.respond()           │
        │     → streak_wrong += 1     │
        │     → theta update (MLE)    │
        │     → streak=3? → fail KC   │
        │       → navigate(fail)      │
        │       → root? → DONE        │
        └─────────────────────────────┘
                      │
┌─────────────────────▼───────────────────────────────────────────┐
│ 8. COMPARE DIAGNOSIS                                             │
│    Ground Truth: 242 gaps                                        │
│    Assessment:   1 gap found, 241 missed                         │
│    → Gap Recall = 0.4% ← BLINDSPOT PHÁT HIỆN                   │
└─────────────────────────────────────────────────────────────────┘
```

---

## Phần 4: Tổng Kết — Cái Gì Hoạt Động, Cái Gì Cần Sửa

### Hoạt Động Tốt ✅

| Component | Bằng chứng |
|-----------|-----------|
| Gemini agent đóng vai đúng persona | Câu 2: đoán đúng bằng common sense. Câu lũy thừa: nhầm 3⁴=3×4=12 đúng kiểu persona |
| IRT theta estimation | θ giảm khi sai liên tục (-0.41 → -0.82 → -1.22 → -1.76) |
| Streak-based pass/fail | 3 sai liên tiếp → fail KC — đúng logic |
| Content quality (câu hỏi) | Agent phân biệt được câu definition (khó) vs câu context (dễ) |
| Cost efficiency | $0.006 cho 7 câu — scalable |

### Cần Sửa 🔴

| Issue | Root Cause | Fix |
|-------|-----------|-----|
| Assessment dừng ở 1 KC | `navigate(fail)` → root → None → finalize | Thêm multi-root traversal |
| Coverage 0.4% | Chỉ test 1 nhánh | Frontier-based navigation |
| Câu hỏi lặp 4 lần | KC chỉ có 2 items | Tăng item pool lên 6+ |
| Thinking bị cắt | max_output_tokens thấp | Tăng lên 700-800 |
