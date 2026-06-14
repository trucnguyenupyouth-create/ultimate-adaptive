![][image1]

### **Tuần 1: Foundation (Day 1–7)**

#### **Day 1–2: DB Schema**

6 bảng cốt lõi:

\-- Knowledge Components  
CREATE TABLE knowledge\_components (  
  id UUID PRIMARY KEY, code VARCHAR UNIQUE, name TEXT, grade INT, metadata JSONB  
);

\-- KST graph edges (A → B \= A là prerequisite của B)  
CREATE TABLE kc\_prerequisites (  
  kc\_id UUID REFERENCES knowledge\_components, prereq\_id UUID REFERENCES knowledge\_components,  
  PRIMARY KEY (kc\_id, prereq\_id)  
);

\-- Items với IRT parameters  
CREATE TABLE items (  
  id UUID PRIMARY KEY, kc\_id UUID REFERENCES knowledge\_components,  
  content JSONB,  
  irt\_a FLOAT DEFAULT 1.0,   \-- discrimination  
  irt\_b FLOAT DEFAULT 0.0,   \-- difficulty (b=0 là medium)  
  irt\_c FLOAT DEFAULT 0.25   \-- guessing (MCQ 4 options)  
);

\-- Student IRT profile (ability θ)  
CREATE TABLE student\_irt (  
  student\_id UUID PRIMARY KEY, theta FLOAT DEFAULT 0.0, theta\_se FLOAT DEFAULT 1.0  
);

\-- BKT state per student per KC  
CREATE TABLE student\_kc (  
  student\_id UUID, kc\_id UUID,  
  p\_mastery FLOAT DEFAULT 0.1,   \-- P(L\_n) — cập nhật sau mỗi response  
  p\_know0   FLOAT DEFAULT 0.1,   \-- P(L\_0)  
  p\_transit FLOAT DEFAULT 0.30,  \-- P(T)  
  p\_guess   FLOAT DEFAULT 0.25,  \-- P(G)  
  p\_slip    FLOAT DEFAULT 0.10,  \-- P(S)  
  is\_mastered BOOLEAN DEFAULT FALSE,  
  stability FLOAT DEFAULT 1.0,   \-- cho forgetting curve  
  last\_practiced TIMESTAMP,  
  PRIMARY KEY (student\_id, kc\_id)  
);

\-- Response history  
CREATE TABLE responses (  
  id UUID PRIMARY KEY, student\_id UUID, item\_id UUID, kc\_id UUID,  
  correct BOOLEAN, context VARCHAR(20), \-- 'assessment' | 'practice' | 'review'  
  created\_at TIMESTAMP DEFAULT NOW()  
);

Day 3–4: Knowledge Graph (KST)  
import networkx as nx

class KnowledgeGraph:  
    def \_\_init\_\_(self):  
        self.G \= nx.DiGraph()   \# edge A→B \= A là prerequisite của B

    def load\_from\_db(self, db):  
        for kc in db.all\_kcs():  
            self.G.add\_node(kc\['id'\], \*\*kc)  
        for edge in db.all\_prerequisites():  
            self.G.add\_edge(edge\['prereq\_id'\], edge\['kc\_id'\])

    def find\_starting\_kc(self, known\_kcs: set) \-\> str | None:  
        """  
        KST: Tìm KC 'trung tâm' nhất để bắt đầu assessment.

        Eligible KCs \= KCs mà TẤT CẢ direct prerequisites đã trong known\_kcs.  
        Score \= len(fulfilled ancestors) \+ len(unmastered descendants)  
        → Maximize: chọn KC nằm ở vị trí giữa nhất của graph.  
          
        New student (known\_kcs \= ∅): chỉ root KCs eligible,  
        score \= 0 \+ len(descendants) → chọn KC quan trọng nhất (nhiều block nhất).  
        """  
        best\_kc, best\_score \= None, \-1  
        for kc in self.G.nodes():  
            if kc in known\_kcs:  
                continue  
            direct\_prereqs \= list(self.G.predecessors(kc))  
            if not all(p in known\_kcs for p in direct\_prereqs):  
                continue   \# Chưa đủ prerequisites → bỏ qua  
              
            all\_ancestors \= nx.ancestors(self.G, kc)  
            all\_descendants \= nx.descendants(self.G, kc)  
            score \= (sum(1 for a in all\_ancestors if a in known\_kcs) \+  
                     sum(1 for d in all\_descendants if d not in known\_kcs))  
            if score \> best\_score:  
                best\_score, best\_kc \= score, kc  
        return best\_kc

    def navigate(self, current\_kc: str, correct: bool,  
                 known\_kcs: set) \-\> str | None:  
        """  
        KST navigation sau mỗi KC decision:  
        \- Pass (correct) → tìm successor mà tất cả prereqs đã fulfilled  
        \- Fail (wrong) → tìm prerequisite chưa master, ưu tiên quan trọng nhất  
        """  
        if correct:  
            updated \= known\_kcs | {current\_kc}  
            candidates \= \[  
                s for s in self.G.successors(current\_kc)  
                if s not in updated  
                and all(p in updated for p in self.G.predecessors(s))  
            \]  
        else:  
            candidates \= \[p for p in self.G.predecessors(current\_kc)  
                         if p not in known\_kcs\]  
          
        if not candidates:  
            return None  
        \# Ưu tiên KC có nhiều descendants nhất (quan trọng nhất)  
        return max(candidates, key=lambda k: len(nx.descendants(self.G, k)))

#### **Day 5–7: IRT Engine (3PL)**

import numpy as np  
from scipy.optimize import minimize\_scalar  
from typing import List, Tuple

class IRTEngine:  
    """  
    3-Parameter Logistic: P(X=1|θ) \= c \+ (1-c) / \[1 \+ exp(-Da(θ-b))\]  
    D=1.7 là scaling constant chuẩn (logistic ≈ normal ogive)  
    """  
    D \= 1.7

    @classmethod  
    def p\_correct(cls, theta: float, a: float, b: float, c: float) \-\> float:  
        return c \+ (1-c) / (1 \+ np.exp(-cls.D \* a \* (theta \- b)))

    @classmethod  
    def information(cls, theta: float, a: float, b: float, c: float) \-\> float:  
        """Fisher information — đo lượng thông tin item cung cấp về θ"""  
        p \= cls.p\_correct(theta, a, b, c)  
        return (cls.D\*\*2 \* a\*\*2 \* (p-c)\*\*2 \* (1-p)) / ((1-c)\*\*2 \* p \+ 1e-10)

    @classmethod  
    def update\_theta(cls,  
                     responses: List\[Tuple\[bool, float, float, float\]\],  
                     init: float \= 0.0) \-\> Tuple\[float, float\]:  
        """  
        MLE estimate of θ từ toàn bộ response history.  
        responses \= \[(correct, a, b, c), ...\]  
        Trả về: (theta\_hat, standard\_error)  
        SE \= 1/√(ΣI(θ)) — càng nhiều item → SE càng nhỏ → estimate càng chính xác.  
        """  
        def neg\_ll(theta):  
            ll \= 0  
            for correct, a, b, c in responses:  
                p \= np.clip(cls.p\_correct(theta, a, b, c), 1e-9, 1-1e-9)  
                ll \+= correct \* np.log(p) \+ (1-correct) \* np.log(1-p)  
            return \-ll

        res \= minimize\_scalar(neg\_ll, bounds=(-4, 4), method='bounded')  
        theta\_hat \= res.x  
        total\_info \= sum(cls.information(theta\_hat, a, b, c)  
                        for \_, a, b, c in responses)  
        return theta\_hat, 1/np.sqrt(max(total\_info, 0.01))

    @classmethod  
    def select\_zpd(cls, theta: float, items: list,  
                   target\_p: float \= 0.65) \-\> dict:  
        """  
        Zone of Proximal Development: chọn item sao cho P(correct|θ) ≈ target\_p.  
        Default 65%: đủ thách thức nhưng không gây frustration.  
        Item difficulty b ≈ theta \- log((1-c)/(target\_p-c) \- 1\) / (D\*a)  
        """  
        return min(items, key=lambda item:  
            abs(cls.p\_correct(theta, item\['a'\], item\['b'\], item\['c'\]) \- target\_p))

### **Tuần 2: Assessment Engine (Day 8–14)**

#### **Day 8–11: CAT Controller**

class CATController:  
    """  
    KST role: điều hướng DỌC GRAPH — KC nào hỏi tiếp  
    IRT role: điều chỉnh ĐỘ KHÓ — câu nào hỏi trong KC đó  
    """  
    PASS\_STREAK \= 3     \# 3 đúng liên tiếp → pass KC  
    FAIL\_STREAK \= 3     \# 3 sai liên tiếp → fail KC  
    SE\_STOP \= 0.30      \# θ ổn định đủ → có thể dừng  
    MAX\_ITEMS \= 40

    def start(self, student\_id: str) \-\> dict:  
        known \= db.get\_known\_kcs(student\_id)  
        start\_kc \= kg.find\_starting\_kc(known)  
        theta \= db.get\_theta(student\_id) or 0.0   \# ω=0 cho new student

        items \= db.get\_items(start\_kc)  
        first\_item \= irt.select\_zpd(theta, items, target\_p=0.65)

        session \= {  
            'kc': start\_kc, 'theta': theta, 'se': 1.0,  
            'responses': \[\],      \# list of (correct, a, b, c)  
            'kc\_results': {},     \# {kc\_id: 'pass'|'fail'|'gap'}  
            'known': set(known),  
            'streak\_c': 0, 'streak\_w': 0, 'n': 0  
        }  
        return {'session': session, 'item': first\_item}

    def respond(self, session: dict, item: dict, correct: bool) \-\> dict:  
        s \= session  
        s\['responses'\].append((correct, item\['a'\], item\['b'\], item\['c'\]))  
        s\['n'\] \+= 1  
        s\['streak\_c'\] \= (s\['streak\_c'\] \+ 1\) if correct else 0  
        s\['streak\_w'\] \= (s\['streak\_w'\] \+ 1\) if not correct else 0

        \# Update θ (MLE) — cần ít nhất 2 data points  
        if len(s\['responses'\]) \>= 2:  
            s\['theta'\], s\['se'\] \= irt.update\_theta(s\['responses'\], s\['theta'\])

        \# Pass/fail decision  
        if s\['streak\_c'\] \>= self.PASS\_STREAK:  
            return self.\_pass(s)  
        if s\['streak\_w'\] \>= self.FAIL\_STREAK:  
            return self.\_fail(s)  
          
        \# Early stop: θ đủ chính xác VÀ đủ số câu  
        if s\['se'\] \< self.SE\_STOP and s\['n'\] \>= 10:  
            avg\_b \= np.mean(\[i\['b'\] for i in db.get\_items(s\['kc'\])\])  
            return self.\_pass(s) if s\['theta'\] \> avg\_b else self.\_fail(s)

        if s\['n'\] \>= self.MAX\_ITEMS:  
            return self.\_finalize(s)

        items \= db.get\_items(s\['kc'\], exclude\_seen=True)  
        return {'status': 'continue', 'item': irt.select\_zpd(s\['theta'\], items), 'session': s}

    def \_pass(self, s):  
        s\['kc\_results'\]\[s\['kc'\]\] \= 'pass'  
        s\['known'\].add(s\['kc'\])  
        s\['streak\_c'\] \= s\['streak\_w'\] \= 0  
        next\_kc \= kg.navigate(s\['kc'\], True, s\['known'\])  
        if next\_kc:  
            s\['kc'\] \= next\_kc  
            return {'status': 'continue',  
                    'item': irt.select\_zpd(s\['theta'\], db.get\_items(next\_kc)), 'session': s}  
        return self.\_finalize(s)

    def \_fail(self, s):  
        s\['kc\_results'\]\[s\['kc'\]\] \= 'fail'  
        s\['streak\_c'\] \= s\['streak\_w'\] \= 0  
        next\_kc \= kg.navigate(s\['kc'\], False, s\['known'\])  
        if next\_kc:  
            s\['kc'\] \= next\_kc  
            return {'status': 'continue',  
                    'item': irt.select\_zpd(s\['theta'\], db.get\_items(next\_kc)), 'session': s}  
        s\['kc\_results'\]\[s\['kc'\]\] \= 'fundamental\_gap'  
        return self.\_finalize(s)

    def \_finalize(self, s):  
        gaps \= \[k for k, v in s\['kc\_results'\].items() if v \!= 'pass'\]  
        return {  
            'status': 'done', 'theta': s\['theta'\], 'theta\_se': s\['se'\],  
            'gaps': gaps,  
            'mastered': \[k for k, v in s\['kc\_results'\].items() if v \== 'pass'\],  
            'first\_learning\_kc': gaps\[0\] if gaps else None  
        }

#### **Day 12–14: Edge case testing**

\# 4 test cases bắt buộc phải pass:

def test\_new\_student\_goes\_to\_foundation():  
    \# Student không biết gì → phải xuống roots  
    session \= cat.start('new\_student')  
    for \_ in range(9):  \# 3 sai liên tiếp × nhiều KC  
        session \= cat.respond(session\['session'\], session\['item'\], correct=False)  
    assert 'fundamental\_gap' in session\['session'\]\['kc\_results'\].values()

def test\_expert\_student\_reaches\_top():  
    \# Student biết tất cả → phải đi lên đến leaf nodes  
    ...

def test\_theta\_converges():  
    \# Sau 20 responses, SE phải \< 0.5  
    responses \= \[(True, 1.0, 0.0, 0.25)\] \* 10 \+ \[(False, 1.0, 0.0, 0.25)\] \* 10  
    theta, se \= IRTEngine.update\_theta(responses)  
    assert se \< 0.5

def test\_no\_graph\_cycles():  
    \# KST graph phải là DAG  
    assert nx.is\_directed\_acyclic\_graph(kg.G)  
---

### **Tuần 3: Learning Loop (Day 15–21)**

#### **Day 15–17: BKT Engine**

from dataclasses import dataclass

@dataclass  
class BKTState:  
    p\_mastery: float       \# P(L\_n) — updated sau mỗi observation  
    p\_know0:   float \= 0.10  
    p\_transit: float \= 0.30  
    p\_guess:   float \= 0.25  
    p\_slip:    float \= 0.10

class BKTEngine:  
    THRESHOLD \= 0.95   \# Tunable per KC

    def update\_observation(self, s: BKTState, correct: bool) \-\> BKTState:  
        """  
        Corbett & Anderson (1994) standard BKT:  
          
        P(correct)   \= P(L)·(1-P(S)) \+ (1-P(L))·P(G)  
        P(L|correct) \= P(L)·(1-P(S)) / P(correct)          ← Bayesian update  
        P(L|wrong)   \= P(L)·P(S)     / P(wrong)  
        P(L\_{n+1})   \= P(L\_n|obs) \+ (1 \- P(L\_n|obs))·P(T)  ← Transition  
        """  
        p \= s.p\_mastery  
        p\_c \= p \* (1-s.p\_slip) \+ (1-p) \* s.p\_guess  
        p\_w \= p \* s.p\_slip    \+ (1-p) \* (1-s.p\_guess)

        p\_post \= (p\*(1-s.p\_slip)/p\_c) if correct else (p\*s.p\_slip/p\_w)  
        p\_next \= p\_post \+ (1-p\_post) \* s.p\_transit

        return BKTState(np.clip(p\_next, 0.01, 0.999), s.p\_know0,  
                        s.p\_transit, s.p\_guess, s.p\_slip)

    def update\_learning\_event(self, s: BKTState,  
                               p\_transit\_content: float \= 0.70) \-\> BKTState:  
        """  
        Sau khi xem video/bài giảng:  
        P\_new \= P\_old \+ (1 \- P\_old) × P(T\_content)  
          
        Ví dụ từ spec:  
        P\_old \= 0.05, P(T\_video) \= 0.85  
        → P\_new \= 0.05 \+ 0.95 × 0.85 \= 0.8575 ≈ 85% ✓  
          
        Các content type có P(T) khác nhau:  
        \- Video giải chi tiết: 0.75–0.85  
        \- Bài đọc ngắn: 0.50–0.65  
        \- Worked example: 0.60–0.75  
        """  
        p\_new \= s.p\_mastery \+ (1-s.p\_mastery) \* p\_transit\_content  
        return BKTState(np.clip(p\_new, 0.01, 0.999), s.p\_know0,  
                        s.p\_transit, s.p\_guess, s.p\_slip)

    def is\_mastered(self, s: BKTState) \-\> bool:  
        return s.p\_mastery \>= self.THRESHOLD

#### **Day 18–19: IRT–BKT Integration (phần lý thuyết quan trọng nhất)**

Như trong mô tả: **θ (IRT ability) và P(L) (BKT mastery) là 2 dimension độc lập.** θ ảnh hưởng BKT theo 3 kênh:

def init\_bkt\_with\_irt(kc\_id: str, theta: float) \-\> BKTState:  
    """  
    IRT theta điều chỉnh BKT params KHI KHỞI TẠO KC mới.  
      
    KÊNH 1: θ → P(L0) cao hơn cho HS giỏi  
       "Dạy A, HS giỏi hiểu ngay A+1 → P(L0) của A+1 tự động cao"  
       sigmoid(θ \- 0.5) scaled \[0.05, 0.45\]  
      
    KÊNH 2: θ → P(S) thấp hơn (ít bất cẩn hơn)  
       HS giỏi ít mắc lỗi careless → P(S) giảm theo θ  
      
    KÊNH 3: θ → P(T) cao hơn (học nhanh hơn)  
       HS giỏi absorb content nhanh hơn  
      
    KHÔNG thay đổi: P(G) — xác suất đoán mò không phụ thuộc vào θ,  
    mà phụ thuộc vào loại câu hỏi (MCQ 4 options → P(G)=0.25 luôn).  
    IRT kiểm soát P(G) bằng cách chọn câu KHÓ hơn cho HS giỏi  
    (câu khó hơn → P(G) hiệu dụng thấp hơn, vì HS khó đoán đúng hơn).  
    """  
    base \= db.get\_kc\_params(kc\_id)   \# default BKT params cho KC này

    \# Kênh 1: P(L0) tăng theo θ  
    p\_know0 \= 0.05 \+ 0.40 / (1 \+ np.exp(-(theta \- 0.5)))

    \# Kênh 2: P(S) giảm theo θ (bounded)  
    p\_slip \= max(0.04, base\['p\_slip'\] \- 0.015 \* np.clip(theta, \-2, 2))

    \# Kênh 3: P(T) tăng nhẹ theo θ  
    p\_transit \= min(0.85, base\['p\_transit'\] \+ 0.04 \* np.clip(theta, \-2, 2))

    return BKTState(  
        p\_mastery=p\_know0,     \# Ban đầu \= P(L0)  
        p\_know0=p\_know0,  
        p\_transit=p\_transit,  
        p\_guess=base\['p\_guess'\],   \# P(G) không đổi — IRT kiểm soát  
        p\_slip=p\_slip  
    )

def pick\_practice\_item(theta: float, p\_mastery: float, items: list) \-\> dict:  
    """  
    Từ spec: "HS có thể master KC với 6 câu dễ" — câu khó KHÔNG giúp BKT  
    tăng P(T) hơn. Câu khó ảnh hưởng qua P(G)/P(S) hiệu dụng.  
      
    → Điều chỉnh ZPD target theo learning stage:  
      \- Early (P(L) \< 0.4): target 75% — build confidence, reduce frustration  
      \- Mid (0.4 ≤ P(L) \< 0.75): target 65% — optimal challenge zone  
      \- Late (P(L) ≥ 0.75): target 55% — harder items để confirm mastery,  
        làm giảm P(G) hiệu dụng (HS không thể đoán được → BKT tin P(L) cao hơn)  
    """  
    if p\_mastery \< 0.40:   target \= 0.75  
    elif p\_mastery \< 0.75: target \= 0.65  
    else:                  target \= 0.55  
    return IRTEngine.select\_zpd(theta, items, target\_p=target)

#### **Day 20–21: Forgetting Curve \+ Learning Controller**

class ForgettingCurve:  
    """  
    Exponential decay: P(t) \= (P\_mastered \- floor)·exp(-λ/stability·t) \+ floor  
    Khi P(t) \< threshold → trigger review session  
    """  
    λ \= 0.10              \# decay rate per day  
    THRESHOLD \= 0.80      \# trigger review khi xuống 80%  
    FLOOR \= 0.25

    def p\_at\_time(self, p0: float, days: float, stability: float \= 1.0) \-\> float:  
        return (p0 \- self.FLOOR) \* np.exp(-self.λ/stability \* days) \+ self.FLOOR

    def days\_until\_review(self, p0: float, stability: float \= 1.0) \-\> float:  
        if p0 \<= self.THRESHOLD: return 0  
        return \-(stability/self.λ) \* np.log(  
            (self.THRESHOLD \- self.FLOOR) / (p0 \- self.FLOOR)  
        )

    def update\_stability(self, s: float, correct: bool) \-\> float:  
        return s \* 1.5 if correct else max(0.5, s \* 0.5)

class LearningController:  
    def start\_kc(self, student\_id: str, kc\_id: str) \-\> dict:  
        theta \= db.get\_theta(student\_id)  
        state \= init\_bkt\_with\_irt(kc\_id, theta)   \# IRT → BKT injection  
        db.save\_bkt(student\_id, kc\_id, state)  
        return {'content': db.get\_content(kc\_id), 'p': round(state.p\_mastery, 3)}

    def after\_content(self, student\_id: str, kc\_id: str, p\_t: float \= 0.70) \-\> dict:  
        state \= bkt.update\_learning\_event(db.get\_bkt(student\_id, kc\_id), p\_t)  
        db.save\_bkt(student\_id, kc\_id, state)  
        theta \= db.get\_theta(student\_id)  
        item \= pick\_practice\_item(theta, state.p\_mastery, db.get\_items(kc\_id))  
        return {'item': item, 'p': round(state.p\_mastery, 3)}

    def after\_practice(self, student\_id: str, kc\_id: str,  
                        item: dict, correct: bool) \-\> dict:  
        state  \= bkt.update\_observation(db.get\_bkt(student\_id, kc\_id), correct)  
        hist   \= db.get\_responses(student\_id) \+ \[(correct, item\['a'\],item\['b'\],item\['c'\])\]  
        new\_θ, new\_se \= IRTEngine.update\_theta(hist)

        db.save\_bkt(student\_id, kc\_id, state)  
        db.save\_theta(student\_id, new\_θ, new\_se)

        if bkt.is\_mastered(state):  
            days \= fc.days\_until\_review(state.p\_mastery)  
            db.schedule\_review(student\_id, kc\_id, days)  
            db.mark\_mastered(student\_id, kc\_id)  
            known \= db.get\_known\_kcs(student\_id)  
            next\_kc \= kg.navigate(kc\_id, True, known)  
            if next\_kc:  
                db.save\_bkt(student\_id, next\_kc,  
                            init\_bkt\_with\_irt(next\_kc, new\_θ))  \# inject ngay  
            return {'status': 'mastered', 'next\_kc': next\_kc,  
                    'review\_in': round(days), 'p': round(state.p\_mastery, 3)}

        item \= pick\_practice\_item(new\_θ, state.p\_mastery, db.get\_items(kc\_id))  
        return {'status': 'practice', 'item': item, 'p': round(state.p\_mastery, 3)}  
---

### **Tuần 4: Integration (Day 22–30)**

#### **Day 22–24: FastAPI endpoints**

@app.post("/assessment/start/{sid}")  
async def start\_assessment(sid: str):  
    return cat.start(sid)

@app.post("/assessment/respond/{sid}")  
async def respond\_assessment(sid: str, body: ResponseBody):  
    return cat.respond(body.session, body.item, body.correct)

@app.post("/learn/start/{sid}/{kc}")  
async def start\_learning(sid: str, kc: str):  
    return lc.start\_kc(sid, kc)

@app.post("/learn/content/{sid}/{kc}")  
async def content\_viewed(sid: str, kc: str, body: ContentBody):  
    return lc.after\_content(sid, kc, body.p\_transit)

@app.post("/learn/practice/{sid}/{kc}")  
async def submit\_practice(sid: str, kc: str, body: PracticeBody):  
    return lc.after\_practice(sid, kc, body.item, body.correct)

@app.get("/review/due/{sid}")  
async def get\_due(sid: str):  
    mastered \= db.get\_mastered\_kcs(sid)  
    due \= \[\]  
    for kc in mastered:  
        days \= (now() \- kc\['last\_practiced'\]).days  
        p\_now \= fc.p\_at\_time(kc\['p\_at\_mastery'\], days, kc\['stability'\])  
        if p\_now \< fc.THRESHOLD:  
            due.append({\*\*kc, 'p\_now': round(p\_now, 3)})  
    return sorted(due, key=lambda x: x\['p\_now'\])   \# urgency order

#### **Day 25–27: React frontend (5 screens)**

| Screen | Key components |
| ----- | ----- |
| Assessment | Câu hỏi \+ θ estimate bar (hiển thị cho admin, ẩn với HS) |
| Learning | Video player \+ BKT progress arc (0→95%) \+ practice item |
| Mastery | Celebration \+ "ôn lại sau X ngày" |
| Dashboard | KST graph (react-force-graph) \+ review queue (due today/this week) |
| Review | Spaced repetition queue, sorted by urgency |

#### **Day 28–30: Calibration và params mặc định**

**IRT khi chưa có data (cold start):**

| Param | Default | Lý do |
| ----- | ----- | ----- |
| `a` | 1.0 | Discrimination trung bình |
| `b` | 0.0 | Medium difficulty (ω=0) |
| `c` | 0.25 | MCQ 4 options: 1/4 |
| `θ₀` | 0.0 | Ability trung bình |

Sau khi có 50+ responses/item → refit `a`, `b`, `c` bằng MML-EM (`py-irt` library).

**BKT khi chưa có data:**

| Param | Default | Adjust range |
| ----- | ----- | ----- |
| P(L₀) | 0.10 | 0.05–0.40 theo KC và θ |
| P(T) | 0.30 | 0.20–0.85 theo KC type \+ θ |
| P(G) | 0.25 | Fixed theo format câu hỏi |
| P(S) | 0.10 | 0.04–0.15 theo θ |

Sau khi có data → dùng EM để fit params per KC:

from scipy.optimize import minimize

def fit\_bkt\_params(responses: list) \-\> dict:  
    """EM-style MLE để fit P(T), P(G), P(S) cho từng KC"""  
    def neg\_ll(params):  
        p\_l0, p\_t, p\_g, p\_s \= np.clip(params, 0.01, 0.99)  
        ll \= 0  
        for student\_responses in responses:  
            p\_l \= p\_l0  
            for correct in student\_responses:  
                p\_obs \= p\_l\*(1-p\_s) \+ (1-p\_l)\*p\_g  
                ll \+= np.log(p\_obs if correct else 1-p\_obs \+ 1e-9)  
                p\_post \= p\_l\*(1-p\_s)/p\_obs if correct else p\_l\*p\_s/(1-p\_obs)  
                p\_l \= p\_post \+ (1-p\_post)\*p\_t  
        return \-ll

    res \= minimize(neg\_ll, x0=\[0.1, 0.3, 0.25, 0.1\],  
                   bounds=\[(0.01,0.5),(0.01,0.99),(0.01,0.5),(0.01,0.3)\])  
    p\_l0, p\_t, p\_g, p\_s \= res.x  
    return {'p\_know0': p\_l0, 'p\_transit': p\_t, 'p\_guess': p\_g, 'p\_slip': p\_s}

### **Notes triển khai quan trọng**

**Tech stack tối giản cho 1 tháng:** Python (FastAPI) \+ PostgreSQL \+ Redis (session cache) \+ React \+ NetworkX \+ NumPy/SciPy. Tránh over-engineer ở giai đoạn này.

**Về KST graph:** cần ít nhất 20–30 KCs cho 1 unit để hệ thống có đủ depth để traverse. Validate bằng `nx.is_directed_acyclic_graph(G)` — nếu có cycle thì KST navigation sẽ bị loop vô hạn.

**Về IRT cold start:** với item chưa calibrate, dùng default `a=1.0, b=0.0, c=0.25`. Kết quả ZPD sẽ không perfect nhưng đủ tốt để demo. Sau khi có data, chạy MML-EM batch calibration qua đêm.

**Về BKT threshold (0.95):** có thể lower xuống 0.90 cho giai đoạn đầu để học sinh cảm giác tiến bộ nhanh hơn. Tune theo domain và age group.

[image1]: <data:image/png;base64,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>