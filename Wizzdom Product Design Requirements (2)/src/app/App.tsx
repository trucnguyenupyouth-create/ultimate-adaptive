import { useState, useEffect, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "motion/react";
import { ArrowRight, Check, RotateCcw, Zap, X, Play, Pause, HelpCircle } from "lucide-react";

// ─── Brand ────────────────────────────────────────────────────────────────────

const B = {
  blue: "#3D72F8",
  blueDark: "#2A5BE4",
  blueLight: "#EEF2FF",
  blueMid: "#7FA0FB",
  orange: "#F59E0B",
  orangeLight: "#FFF8EC",
  green: "#10B981",
  greenLight: "#ECFDF5",
  red: "#EF4444",
  redLight: "#FEF2F2",
  gray: "#F3F4F6",
  grayBorder: "rgba(0,0,0,0.08)",
  text: "#111827",
  textMid: "#374151",
  textMuted: "#6B7280",
  textLight: "#9CA3AF",
  white: "#FFFFFF",
  bg: "#F5F7FF",
};

const NUNITO = "'Nunito', sans-serif";
const INTER = "'Inter', sans-serif";
const MONO = "'JetBrains Mono', monospace";

// ─── Data ─────────────────────────────────────────────────────────────────────

type Strength = "strong" | "medium" | "weak" | "inferred";

interface Skill {
  id: number;
  x: number;
  y: number;
  label: string;
  strength: Strength;
}

const SKILLS: Skill[] = [
  { id: 1, x: 12, y: 16, label: "Addition", strength: "strong" },
  { id: 2, x: 21, y: 9, label: "Subtraction", strength: "strong" },
  { id: 3, x: 7, y: 28, label: "Multiplication", strength: "strong" },
  { id: 4, x: 18, y: 36, label: "Division", strength: "medium" },
  { id: 5, x: 27, y: 20, label: "Estimation", strength: "strong" },
  { id: 6, x: 5, y: 44, label: "Order of Ops", strength: "medium" },
  { id: 7, x: 24, y: 44, label: "Mental Math", strength: "strong" },
  { id: 8, x: 74, y: 8, label: "Place Value", strength: "strong" },
  { id: 9, x: 85, y: 16, label: "Number Line", strength: "strong" },
  { id: 10, x: 66, y: 18, label: "Rounding", strength: "strong" },
  { id: 11, x: 80, y: 28, label: "Comparing", strength: "strong" },
  { id: 12, x: 91, y: 38, label: "Negative Nums", strength: "medium" },
  { id: 13, x: 68, y: 34, label: "Prime Nums", strength: "medium" },
  { id: 14, x: 38, y: 46, label: "Fractions", strength: "weak" },
  { id: 15, x: 49, y: 40, label: "Equivalence", strength: "weak" },
  { id: 16, x: 58, y: 48, label: "Simplifying", strength: "weak" },
  { id: 17, x: 43, y: 57, label: "Mixed Numbers", strength: "weak" },
  { id: 18, x: 54, y: 60, label: "Fraction +/−", strength: "weak" },
  { id: 19, x: 33, y: 58, label: "Part / Whole", strength: "weak" },
  { id: 20, x: 64, y: 56, label: "Decimals", strength: "medium" },
  { id: 21, x: 47, y: 70, label: "Percentages", strength: "medium" },
  { id: 22, x: 83, y: 50, label: "Variables", strength: "inferred" },
  { id: 23, x: 92, y: 60, label: "Equations", strength: "inferred" },
  { id: 24, x: 80, y: 66, label: "Expressions", strength: "inferred" },
  { id: 25, x: 90, y: 76, label: "Inequalities", strength: "inferred" },
  { id: 26, x: 74, y: 76, label: "Patterns", strength: "inferred" },
  { id: 27, x: 11, y: 62, label: "Shapes", strength: "strong" },
  { id: 28, x: 19, y: 72, label: "Perimeter", strength: "strong" },
  { id: 29, x: 7, y: 80, label: "Area", strength: "medium" },
  { id: 30, x: 26, y: 82, label: "Volume", strength: "inferred" },
  { id: 31, x: 15, y: 90, label: "Angles", strength: "inferred" },
  { id: 32, x: 36, y: 84, label: "Units", strength: "strong" },
  { id: 33, x: 44, y: 90, label: "Time", strength: "strong" },
  { id: 34, x: 54, y: 88, label: "Money", strength: "strong" },
  { id: 35, x: 64, y: 80, label: "Temperature", strength: "medium" },
  { id: 36, x: 82, y: 84, label: "Graphs", strength: "inferred" },
  { id: 37, x: 91, y: 90, label: "Mean/Median", strength: "inferred" },
  { id: 38, x: 72, y: 90, label: "Probability", strength: "inferred" },
  { id: 39, x: 32, y: 28, label: "Factors", strength: "medium" },
  { id: 40, x: 41, y: 22, label: "Multiples", strength: "medium" },
  { id: 41, x: 52, y: 26, label: "GCD / LCM", strength: "weak" },
  { id: 42, x: 60, y: 36, label: "Divisibility", strength: "medium" },
  { id: 43, x: 30, y: 12, label: "Word Problems", strength: "medium" },
  { id: 44, x: 48, y: 12, label: "Problem Solving", strength: "medium" },
  { id: 45, x: 64, y: 7, label: "Logic", strength: "strong" },
  { id: 46, x: 37, y: 7, label: "Num. Patterns", strength: "strong" },
  { id: 47, x: 74, y: 46, label: "Ratio", strength: "inferred" },
];

const EDGES: [number, number][] = [
  [1,2],[1,3],[2,3],[3,4],[1,5],[3,6],[4,6],[6,7],
  [8,9],[8,10],[9,11],[10,11],[11,12],[10,13],[13,42],
  [14,15],[14,16],[14,17],[14,18],[14,19],[15,16],[16,18],[17,18],[16,20],[18,21],[20,21],
  [22,23],[22,24],[23,25],[24,26],[22,26],
  [27,28],[27,29],[28,29],[29,30],[27,31],
  [32,33],[32,34],[33,34],[32,35],
  [36,37],[36,38],[37,38],
  [3,39],[39,40],[40,41],[41,14],[42,40],[41,16],
  [1,43],[2,43],[44,43],[44,45],[45,46],[46,40],[46,8],
  [21,47],[14,47],[47,22],
  [7,14],[39,14],[40,44],[12,22],[21,34],[19,14],[6,39],
];

const TARGET_ID = 15;
const OUTCOME_IDS = new Set([15, 16, 18]);

// ─── Map utilities ────────────────────────────────────────────────────────────

function nodeColor(s: Strength, updated = false): string {
  if (updated) return B.green;
  return { strong: B.blue, medium: B.blueMid, weak: B.orange, inferred: "#CBD5E1" }[s];
}

function nodeStroke(s: Strength, updated = false): string {
  if (updated) return B.green;
  return { strong: B.blue, medium: B.blueMid, weak: B.orange, inferred: "#94A3B8" }[s];
}

function nodeR(s: Strength): number {
  return { strong: 1.5, medium: 1.3, weak: 1.5, inferred: 0.85 }[s];
}

function edgeStroke(s1: Strength, s2: Strength): string {
  if (s1 === "inferred" || s2 === "inferred") return "rgba(0,0,0,0.04)";
  if (s1 === "weak" || s2 === "weak") return "rgba(245,158,11,0.22)";
  return "rgba(61,114,248,0.12)";
}

// ─── Math Input Widgets ───────────────────────────────────────────────────────

interface FractionWidgetProps {
  num: string;
  den: string;
  onNumChange: (v: string) => void;
  onDenChange: (v: string) => void;
  size?: "sm" | "lg";
  autoFocusNum?: boolean;
}

function FractionWidget({ num, den, onNumChange, onDenChange, size = "lg", autoFocusNum = true }: FractionWidgetProps) {
  const numRef = useRef<HTMLInputElement>(null);
  const denRef = useRef<HTMLInputElement>(null);
  const fs = size === "lg" ? "2.2rem" : "1.5rem";
  const w = size === "lg" ? 84 : 60;

  const iStyle = (filled: boolean): React.CSSProperties => ({
    width: w,
    textAlign: "center",
    backgroundColor: "transparent",
    border: "none",
    borderBottom: `3px solid ${filled ? B.blue : "#E5E7EB"}`,
    outline: "none",
    fontSize: fs,
    fontFamily: NUNITO,
    fontWeight: 800,
    color: filled ? B.text : "#CCCCCC",
    padding: "4px 0",
    transition: "border-color 0.18s",
  });

  return (
    <div className="flex flex-col items-center" style={{ gap: 5 }}>
      <input
        ref={numRef}
        type="text"
        inputMode="numeric"
        value={num}
        onChange={(e) => onNumChange(e.target.value.replace(/[^0-9-]/g, ""))}
        onKeyDown={(e) => {
          if (e.key === "Tab" || e.key === "ArrowDown") { e.preventDefault(); denRef.current?.focus(); }
        }}
        placeholder="?"
        style={iStyle(!!num)}
        autoFocus={autoFocusNum}
      />
      <div style={{ width: w + 10, height: 4, backgroundColor: (num || den) ? B.text : "#D1D5DB", borderRadius: 2, flexShrink: 0 }} />
      <input
        ref={denRef}
        type="text"
        inputMode="numeric"
        value={den}
        onChange={(e) => onDenChange(e.target.value.replace(/[^0-9]/g, ""))}
        onKeyDown={(e) => {
          if ((e.key === "Tab" && e.shiftKey) || e.key === "ArrowUp") { e.preventDefault(); numRef.current?.focus(); }
        }}
        placeholder="?"
        style={iStyle(!!den)}
      />
      {den === "0" && (
        <p style={{ fontSize: "0.7rem", color: B.orange, marginTop: 2, fontFamily: NUNITO }}>Mẫu số ≠ 0</p>
      )}
    </div>
  );
}

// Self-contained showcase variants
function FractionWidgetSC() {
  const [num, setNum] = useState(""); const [den, setDen] = useState("");
  return <FractionWidget num={num} den={den} onNumChange={setNum} onDenChange={setDen} size="sm" autoFocusNum={false} />;
}

function MixedNumberWidgetSC() {
  const [whole, setWhole] = useState(""); const [num, setNum] = useState(""); const [den, setDen] = useState("");
  const numRef = useRef<HTMLInputElement>(null);
  const denRef = useRef<HTMLInputElement>(null);
  const iStyle = (filled: boolean, w: number): React.CSSProperties => ({
    width: w, textAlign: "center", backgroundColor: "transparent", border: "none",
    borderBottom: `2.5px solid ${filled ? B.blue : "#E5E7EB"}`, outline: "none",
    fontSize: "1.4rem", fontFamily: NUNITO, fontWeight: 800,
    color: filled ? B.text : "#CCCCCC", padding: "2px 0", transition: "border-color 0.18s",
  });
  return (
    <div className="flex items-center gap-2">
      <input type="text" inputMode="numeric" value={whole}
        onChange={(e) => setWhole(e.target.value.replace(/[^0-9-]/g, ""))}
        onKeyDown={(e) => { if (e.key === "Tab") { e.preventDefault(); numRef.current?.focus(); } }}
        placeholder="?" style={iStyle(!!whole, 40)} />
      <div className="flex flex-col items-center" style={{ gap: 3 }}>
        <input ref={numRef} type="text" inputMode="numeric" value={num}
          onChange={(e) => setNum(e.target.value.replace(/[^0-9-]/g, ""))}
          onKeyDown={(e) => {
            if (e.key === "Tab" || e.key === "ArrowDown") { e.preventDefault(); denRef.current?.focus(); }
          }}
          placeholder="?" style={iStyle(!!num, 36)} />
        <div style={{ width: 44, height: 3, backgroundColor: (num || den) ? B.text : "#D1D5DB", borderRadius: 2 }} />
        <input ref={denRef} type="text" inputMode="numeric" value={den}
          onChange={(e) => setDen(e.target.value.replace(/[^0-9]/g, ""))}
          onKeyDown={(e) => {
            if (e.key === "ArrowUp") { e.preventDefault(); numRef.current?.focus(); }
          }}
          placeholder="?" style={iStyle(!!den, 36)} />
      </div>
    </div>
  );
}

function PowerWidgetSC() {
  const [base, setBase] = useState(""); const [exp, setExp] = useState("");
  const expRef = useRef<HTMLInputElement>(null);
  return (
    <div style={{ display: "flex", alignItems: "flex-end", gap: 4 }}>
      <input type="text" inputMode="numeric" value={base}
        onChange={(e) => setBase(e.target.value.replace(/[^0-9-]/g, ""))}
        onKeyDown={(e) => { if (e.key === "Tab" || e.key === "ArrowRight") { e.preventDefault(); expRef.current?.focus(); } }}
        placeholder="?"
        style={{ width: 48, textAlign: "center", fontSize: "2rem", fontFamily: NUNITO, fontWeight: 800,
          border: "none", borderBottom: `3px solid ${base ? B.blue : "#E5E7EB"}`,
          backgroundColor: "transparent", outline: "none", color: base ? B.text : "#CCCCCC", padding: "4px 0" }} />
      <input ref={expRef} type="text" inputMode="numeric" value={exp}
        onChange={(e) => setExp(e.target.value.replace(/[^0-9]/g, ""))}
        placeholder="?"
        style={{ width: 28, textAlign: "center", fontSize: "1rem", fontFamily: NUNITO, fontWeight: 800,
          border: "none", borderBottom: `2px solid ${exp ? B.blue : "#E5E7EB"}`,
          backgroundColor: "transparent", outline: "none", color: exp ? B.text : "#CCCCCC",
          marginBottom: 14 }} />
    </div>
  );
}

function SqrtWidgetSC() {
  const [val, setVal] = useState("");
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 2 }}>
      <span style={{ fontSize: "2.8rem", fontFamily: NUNITO, color: B.text, lineHeight: 0.85, fontWeight: 800 }}>√</span>
      <div style={{ borderTop: `3.5px solid ${val ? B.text : "#D1D5DB"}`, borderRight: `3.5px solid ${val ? B.text : "#D1D5DB"}`, paddingLeft: 6, paddingTop: 3, paddingRight: 4 }}>
        <input type="text" inputMode="numeric" value={val}
          onChange={(e) => setVal(e.target.value.replace(/[^0-9-]/g, ""))}
          placeholder="?"
          style={{ width: 52, textAlign: "center", fontSize: "1.5rem", fontFamily: NUNITO, fontWeight: 800,
            border: "none", outline: "none", backgroundColor: "transparent", color: val ? B.text : "#CCCCCC" }} />
      </div>
    </div>
  );
}

function InequalityWidgetSC() {
  const [selected, setSelected] = useState<string | null>(null);
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
      <span style={{ fontSize: "1.4rem", fontFamily: NUNITO, fontWeight: 700, color: B.textMid }}>3/4</span>
      <div style={{ display: "flex", gap: 6 }}>
        {["<", "=", ">"].map((o) => (
          <button key={o} onClick={() => setSelected(o)}
            style={{ width: 42, height: 42, borderRadius: 10,
              border: `2px solid ${selected === o ? B.blue : "#E5E7EB"}`,
              backgroundColor: selected === o ? B.blueLight : "transparent",
              fontSize: "1.2rem", fontWeight: 800, fontFamily: NUNITO,
              color: selected === o ? B.blue : B.textMuted, cursor: "pointer", transition: "all 0.15s" }}>
            {o}
          </button>
        ))}
      </div>
      <span style={{ fontSize: "1.4rem", fontFamily: NUNITO, fontWeight: 700, color: B.textMid }}>0.8</span>
    </div>
  );
}

function CoordinateWidgetSC() {
  const [x, setX] = useState(""); const [y, setY] = useState("");
  const yRef = useRef<HTMLInputElement>(null);
  const iStyle = (filled: boolean): React.CSSProperties => ({
    width: 44, textAlign: "center",
    border: "none", borderBottom: `2.5px solid ${filled ? B.blue : "#E5E7EB"}`,
    backgroundColor: "transparent", outline: "none",
    fontSize: "1.5rem", fontFamily: NUNITO, fontWeight: 800,
    color: filled ? B.text : "#CCCCCC", transition: "border-color 0.18s",
  });
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 4, fontSize: "1.5rem", fontFamily: NUNITO, fontWeight: 800, color: B.textMid }}>
      <span>(</span>
      <input type="text" inputMode="numeric" value={x}
        onChange={(e) => setX(e.target.value.replace(/[^0-9-]/g, ""))}
        onKeyDown={(e) => { if (e.key === "Tab") { e.preventDefault(); yRef.current?.focus(); } }}
        placeholder="x" style={iStyle(!!x)} />
      <span>,</span>
      <input ref={yRef} type="text" inputMode="numeric" value={y}
        onChange={(e) => setY(e.target.value.replace(/[^0-9-]/g, ""))}
        placeholder="y" style={iStyle(!!y)} />
      <span>)</span>
    </div>
  );
}

// ─── MathWidgetShowcase ───────────────────────────────────────────────────────

const WIDGETS = [
  { id: "fraction", label: "Phân số", context: "Rút gọn: 6/8 = ?", Component: FractionWidgetSC },
  { id: "mixed", label: "Hỗn số", context: "Viết dưới dạng hỗn số: 7/3 = ?", Component: MixedNumberWidgetSC },
  { id: "power", label: "Lũy thừa", context: "Điền số mũ: 2ⁿ = 8", Component: PowerWidgetSC },
  { id: "sqrt", label: "Căn bậc hai", context: "Tính: √? = 4", Component: SqrtWidgetSC },
  { id: "inequality", label: "Dấu so sánh", context: "So sánh 3/4 và 0.8:", Component: InequalityWidgetSC },
  { id: "coordinate", label: "Tọa độ điểm", context: "Điểm A có tọa độ:", Component: CoordinateWidgetSC },
];

function MathWidgetShowcase({ onClose }: { onClose: () => void }) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center"
      style={{ backgroundColor: "rgba(17,24,39,0.35)", backdropFilter: "blur(6px)", padding: "0 0 0 0" }}
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <motion.div
        initial={{ opacity: 0, y: 48 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 48 }}
        transition={{ duration: 0.35, ease: [0.32, 0.72, 0, 1] }}
        className="w-full sm:max-w-2xl rounded-t-3xl sm:rounded-3xl overflow-y-auto"
        style={{ backgroundColor: B.white, maxHeight: "92vh" }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-5 border-b" style={{ borderColor: B.grayBorder }}>
          <div>
            <p className="text-xs font-bold mb-0.5" style={{ fontFamily: MONO, color: B.blue }}>Math Input System</p>
            <h3 className="text-xl font-extrabold" style={{ fontFamily: NUNITO, color: B.text }}>
              Bộ widget nhập toán học
            </h3>
          </div>
          <button onClick={onClose}
            className="w-9 h-9 rounded-full flex items-center justify-center transition-colors hover:opacity-70"
            style={{ backgroundColor: B.gray }}>
            <X size={16} style={{ color: B.textMuted }} />
          </button>
        </div>

        {/* Tagline */}
        <div className="px-6 py-3.5" style={{ backgroundColor: B.blueLight }}>
          <p className="text-sm leading-relaxed" style={{ fontFamily: INTER, color: B.textMid }}>
            Học sinh nhập toán như viết trên vở — không cần học cú pháp máy tính.
            Mỗi loại biểu thức có widget riêng, keyboard-friendly và touch-friendly.
          </p>
        </div>

        {/* Grid */}
        <div className="p-5 grid grid-cols-1 sm:grid-cols-2 gap-4">
          {WIDGETS.map(({ id, label, context, Component }) => (
            <div key={id} className="rounded-2xl p-5 border"
              style={{ backgroundColor: B.bg, borderColor: B.grayBorder }}>
              <div className="flex items-center gap-2 mb-2">
                <span className="text-xs font-bold px-2.5 py-1 rounded-full"
                  style={{ fontFamily: NUNITO, backgroundColor: B.blueLight, color: B.blue }}>
                  {label}
                </span>
              </div>
              <p className="text-xs mb-4" style={{ fontFamily: INTER, color: B.textMuted }}>{context}</p>
              <div className="flex justify-center py-1">
                <Component />
              </div>
            </div>
          ))}
        </div>

        <div className="px-6 pb-6 text-center">
          <p className="text-xs" style={{ fontFamily: INTER, color: B.textLight }}>
            Tab · Shift+Tab · ↑↓ → để điều hướng · Enter để nộp · inputmode=numeric trên mobile
          </p>
        </div>
      </motion.div>
    </motion.div>
  );
}

// ─── Small components ─────────────────────────────────────────────────────────

function Frac({ n, d, className = "" }: { n: number; d: number; className?: string }) {
  return (
    <span className={`inline-flex flex-col items-center font-bold leading-none ${className}`}
      style={{ fontFamily: NUNITO, verticalAlign: "middle" }}>
      <span>{n}</span>
      <span className="block w-full border-t-[2.5px] border-current my-[3px]" />
      <span>{d}</span>
    </span>
  );
}

function FractionBar({ n, d, color, label }: { n: number; d: number; color: string; label: string }) {
  return (
    <div className="flex items-center gap-3">
      <span className="text-xs shrink-0 text-right w-8" style={{ fontFamily: MONO, color: B.textMuted }}>{label}</span>
      <div className="flex gap-[3px] flex-1 h-7">
        {Array.from({ length: d }, (_, i) => (
          <div key={i} className="flex-1 rounded-sm"
            style={{ backgroundColor: i < n ? color : "transparent", border: `1.5px solid ${color}`, opacity: i < n ? 0.85 : 0.2 }} />
        ))}
      </div>
    </div>
  );
}

function StepCircle({ n, done }: { n: number; done?: boolean }) {
  return (
    <div className="w-7 h-7 rounded-full flex items-center justify-center text-sm font-bold shrink-0"
      style={{ backgroundColor: done ? B.greenLight : B.orangeLight, color: done ? B.green : B.orange, fontFamily: NUNITO }}>
      {done ? <Check size={14} /> : n}
    </div>
  );
}

function WizzdomLogo({ size = "md" }: { size?: "sm" | "md" | "lg" }) {
  const sz = size === "lg" ? "text-3xl" : size === "sm" ? "text-base" : "text-xl";
  const star = size === "lg" ? "text-2xl" : size === "sm" ? "text-base" : "text-lg";
  return (
    <div className="flex items-center" style={{ fontFamily: NUNITO }}>
      <span className={`font-extrabold ${sz}`} style={{ color: B.blue }}>Wizz</span>
      <span className={star} style={{ lineHeight: 1 }}>⭐</span>
      <span className={`font-extrabold ${sz}`} style={{ color: B.blue }}>m</span>
    </div>
  );
}

// ─── KnowledgeMap ─────────────────────────────────────────────────────────────

function KnowledgeMap({ animateIn = false, showTarget = false, outcome = false }: {
  animateIn?: boolean;
  showTarget?: boolean;
  outcome?: boolean;
}) {
  const [revealed, setRevealed] = useState(!animateIn);

  useEffect(() => {
    if (!animateIn) return;
    const t = setTimeout(() => setRevealed(true), 180);
    return () => clearTimeout(t);
  }, [animateIn]);

  const getSkill = (id: number) => SKILLS.find((s) => s.id === id)!;

  return (
    <svg viewBox="0 0 100 100" className="w-full h-full" preserveAspectRatio="xMidYMid meet" style={{ overflow: "visible" }}>
      <defs>
        <filter id="glow-blue" x="-60%" y="-60%" width="220%" height="220%">
          <feGaussianBlur stdDeviation="1.2" result="b" /><feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge>
        </filter>
        <filter id="glow-orange" x="-60%" y="-60%" width="220%" height="220%">
          <feGaussianBlur stdDeviation="1.6" result="b" /><feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge>
        </filter>
        <filter id="glow-green" x="-60%" y="-60%" width="220%" height="220%">
          <feGaussianBlur stdDeviation="1.4" result="b" /><feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge>
        </filter>
        <radialGradient id="bgL" cx="15%" cy="25%" r="28%">
          <stop offset="0%" stopColor={B.blue} stopOpacity="0.07" /><stop offset="100%" stopColor={B.blue} stopOpacity="0" />
        </radialGradient>
        <radialGradient id="bgR" cx="80%" cy="18%" r="25%">
          <stop offset="0%" stopColor={B.blue} stopOpacity="0.06" /><stop offset="100%" stopColor={B.blue} stopOpacity="0" />
        </radialGradient>
        <radialGradient id="bgW" cx="46%" cy="52%" r="22%">
          <stop offset="0%" stopColor={B.orange} stopOpacity="0.1" /><stop offset="100%" stopColor={B.orange} stopOpacity="0" />
        </radialGradient>
        {outcome && (
          <radialGradient id="bgU" cx="52%" cy="48%" r="18%">
            <stop offset="0%" stopColor={B.green} stopOpacity="0.1" /><stop offset="100%" stopColor={B.green} stopOpacity="0" />
          </radialGradient>
        )}
      </defs>
      <rect width="100" height="100" fill="url(#bgL)" />
      <rect width="100" height="100" fill="url(#bgR)" />
      <rect width="100" height="100" fill="url(#bgW)" />
      {outcome && <rect width="100" height="100" fill="url(#bgU)" />}

      {EDGES.map(([a, b], i) => {
        const sa = getSkill(a); const sb = getSkill(b);
        return (
          <line key={`e${i}`} x1={sa.x} y1={sa.y} x2={sb.x} y2={sb.y}
            stroke={edgeStroke(sa.strength, sb.strength)} strokeWidth="0.25"
            style={{ opacity: revealed ? 1 : 0, transition: `opacity ${0.4 + i * 0.004}s ease` }} />
        );
      })}

      {SKILLS.map((skill, i) => {
        const isTarget = skill.id === TARGET_ID && showTarget;
        const isUpdated = outcome && OUTCOME_IDS.has(skill.id);
        const effS: Strength = isUpdated ? "medium" : skill.strength;
        const col = nodeColor(effS, isUpdated);
        const str = nodeStroke(effS, isUpdated);
        const r = nodeR(effS);
        const isInferred = effS === "inferred" && !isUpdated;
        const filterId = isUpdated ? "glow-green" : effS === "strong" ? "glow-blue" : effS === "weak" ? "glow-orange" : effS === "medium" ? "glow-blue" : undefined;
        const delay = `${0.05 + i * 0.024}s`;

        return (
          <g key={skill.id}>
            {isTarget && (
              <circle cx={skill.x} cy={skill.y} r={r + 2} fill="none" stroke={B.orange} strokeWidth="0.4">
                <animate attributeName="r" values={`${r+1.5};${r+3.2};${r+1.5}`} dur="2.2s" repeatCount="indefinite" />
                <animate attributeName="opacity" values="0.7;0.1;0.7" dur="2.2s" repeatCount="indefinite" />
              </circle>
            )}
            {isUpdated && (
              <circle cx={skill.x} cy={skill.y} r={r + 1} fill="none" stroke={B.green} strokeWidth="0.5">
                <animate attributeName="r" values={`${r+1};${r+6}`} dur="1.5s" begin="0.4s" repeatCount="1" fill="freeze" />
                <animate attributeName="opacity" values="0.9;0" dur="1.5s" begin="0.4s" repeatCount="1" fill="freeze" />
              </circle>
            )}
            <circle cx={skill.x} cy={skill.y} r={r}
              fill={isInferred ? "rgba(241,245,249,0.9)" : col}
              stroke={str} strokeWidth={isInferred ? "0.3" : "0"}
              strokeDasharray={isInferred ? "0.7 0.45" : undefined}
              filter={filterId ? `url(#${filterId})` : undefined}
              style={{ opacity: revealed ? (isInferred ? 0.5 : 1) : 0, transition: `opacity ${delay} ease` }} />
            <text x={skill.x} y={skill.y + r + (isInferred ? 1.9 : 2.1)}
              textAnchor="middle" fontSize={isInferred ? "1.1" : "1.3"}
              fill={isInferred ? "#94A3B8" : col} fontFamily={MONO}
              style={{ opacity: revealed ? (isInferred ? 0.45 : 0.7) : 0, transition: `opacity ${delay} ease`, pointerEvents: "none" }}>
              {skill.label}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

// ─── StepBar ──────────────────────────────────────────────────────────────────

const STEP_LABELS = ["Assess", "Map", "Learn", "Mastery", "Outcome"];

function StepBar({ current }: { current: number }) {
  return (
    <div className="flex items-center justify-center">
      {STEP_LABELS.map((label, i) => (
        <div key={i} className="flex items-center">
          <div className="flex flex-col items-center gap-1.5">
            <div className="rounded-full transition-all duration-500"
              style={{
                width: i === current ? 10 : 8, height: i === current ? 10 : 8,
                backgroundColor: i <= current ? B.blue : "#D1D5DB",
                boxShadow: i === current ? `0 0 0 3px ${B.blueLight}` : "none",
              }} />
            <span className="text-[10px] hidden sm:block transition-colors duration-300"
              style={{ fontFamily: MONO, color: i === current ? B.blue : i < current ? B.blueMid : "#9CA3AF", fontWeight: i === current ? 600 : 400 }}>
              {label}
            </span>
          </div>
          {i < STEP_LABELS.length - 1 && (
            <div className="w-10 sm:w-14 h-px mx-2 mb-4 transition-colors duration-500"
              style={{ backgroundColor: i < current ? B.blue : "#E5E7EB" }} />
          )}
        </div>
      ))}
    </div>
  );
}

// ─── PitchBar ─────────────────────────────────────────────────────────────────

function PitchBar({ active, duration, onComplete }: { active: boolean; duration: number; onComplete: () => void }) {
  const [started, setStarted] = useState(false);

  useEffect(() => {
    if (!active) return;
    setStarted(false);
    const t = setTimeout(() => setStarted(true), 50);
    const t2 = setTimeout(onComplete, duration);
    return () => { clearTimeout(t); clearTimeout(t2); };
  }, [active, duration, onComplete]);

  if (!active) return null;

  return (
    <div style={{ height: 3, backgroundColor: "#E5E7EB", overflow: "hidden" }}>
      <motion.div
        style={{ height: "100%", backgroundColor: B.blue }}
        initial={{ width: "0%" }}
        animate={started ? { width: "100%" } : {}}
        transition={{ duration: duration / 1000 - 0.05, ease: "linear" }}
      />
    </div>
  );
}

// ─── AssessStep ───────────────────────────────────────────────────────────────

type AssessPhase = "question" | "adapting" | "processing";

function AssessStep({ onComplete, pitchMode }: { onComplete: () => void; pitchMode: boolean }) {
  const [phase, setPhase] = useState<AssessPhase>("question");
  const [num, setNum] = useState("");
  const [den, setDen] = useState("");
  const [showWidgets, setShowWidgets] = useState(false);

  const isReady = num.trim() !== "" && den.trim() !== "" && den !== "0";

  const advance = useCallback(() => {
    setPhase("adapting");
    setTimeout(() => setPhase("processing"), 950);
    setTimeout(() => onComplete(), 950 + 1800);
  }, [onComplete]);

  useEffect(() => {
    if (!pitchMode || phase !== "question") return;
    const t1 = setTimeout(() => { setNum("5"); setDen("4"); }, 1100);
    const t2 = setTimeout(advance, 2700);
    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, [pitchMode, phase, advance]);

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0, y: -12 }} transition={{ duration: 0.4 }}
      className="flex flex-col items-center justify-center px-4" style={{ minHeight: "calc(100vh - 75px)" }}>

      <AnimatePresence mode="wait">
        {phase === "question" && (
          <motion.div key="q" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -14 }}
            transition={{ duration: 0.45 }} className="w-full max-w-md">

            {/* Progress */}
            <div className="flex items-center gap-3 mb-8">
              <span className="text-xs font-bold px-2.5 py-1 rounded-full"
                style={{ fontFamily: MONO, backgroundColor: B.blueLight, color: B.blue }}>
                Câu 7 / 12
              </span>
              <div className="flex gap-1 flex-1">
                {Array.from({ length: 12 }, (_, i) => (
                  <div key={i} className="flex-1 h-1.5 rounded-full"
                    style={{ backgroundColor: i < 7 ? B.blue : "#E5E7EB" }} />
                ))}
              </div>
            </div>

            {/* Question card */}
            <div className="rounded-2xl p-7 mb-5 shadow-sm border"
              style={{ backgroundColor: B.white, borderColor: B.grayBorder }}>
              <p className="text-sm mb-5" style={{ fontFamily: INTER, color: B.textMuted }}>
                Rút gọn biểu thức:
              </p>
              <div className="flex items-center justify-center gap-4">
                <Frac n={3} d={4} className="text-3xl" />
                <span className="text-3xl font-light" style={{ color: B.textLight }}>+</span>
                <Frac n={1} d={2} className="text-3xl" />
                <span className="text-3xl font-light" style={{ color: B.textLight }}>=</span>
                <span className="text-3xl font-bold" style={{ color: "#D1D5DB", fontFamily: NUNITO }}>?</span>
              </div>
            </div>

            {/* Answer widget card */}
            <div className="rounded-2xl p-7 mb-3 border-2 shadow-sm text-center"
              style={{ backgroundColor: B.white, borderColor: isReady ? B.blue : B.grayBorder, transition: "border-color 0.2s" }}>
              <p className="text-xs font-semibold mb-5" style={{ fontFamily: NUNITO, color: B.textMuted }}>
                Nhập đáp án của bạn
              </p>
              <div className="flex justify-center mb-4">
                <FractionWidget num={num} den={den} onNumChange={setNum} onDenChange={setDen} size="lg" />
              </div>
              <p className="text-xs" style={{ fontFamily: MONO, color: B.textLight }}>
                Tab · ↑↓ để chuyển ô · Enter để nộp
              </p>
            </div>

            {/* Actions */}
            <div className="flex gap-2 mb-4">
              <button onClick={advance} disabled={!isReady}
                className="flex-1 rounded-full py-4 font-bold text-base transition-all hover:opacity-90 active:scale-[0.98] disabled:opacity-25 disabled:cursor-not-allowed flex items-center justify-center gap-2 shadow-sm"
                style={{ backgroundColor: B.blue, color: B.white, fontFamily: NUNITO }}>
                Nộp bài <ArrowRight size={18} />
              </button>
              <button
                className="px-5 rounded-full border-2 font-semibold text-sm transition-all hover:opacity-70"
                style={{ borderColor: B.grayBorder, color: B.textMuted, fontFamily: NUNITO, backgroundColor: B.white }}
                onClick={advance}>
                Không biết
              </button>
            </div>

            {/* Widget library link */}
            <button onClick={() => setShowWidgets(true)}
              className="w-full flex items-center justify-center gap-1.5 py-2 rounded-full transition-all hover:opacity-70"
              style={{ backgroundColor: B.blueLight }}>
              <HelpCircle size={13} style={{ color: B.blue }} />
              <span className="text-xs font-semibold" style={{ fontFamily: NUNITO, color: B.blue }}>
                Xem tất cả loại widget toán học
              </span>
            </button>
          </motion.div>
        )}

        {phase === "adapting" && (
          <motion.div key="adapt" initial={{ opacity: 0, scale: 0.97 }} animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0 }} transition={{ duration: 0.35 }} className="text-center space-y-4 max-w-xs">
            <div className="flex justify-center gap-2 mb-2">
              {[0, 0.15, 0.3].map((d) => (
                <motion.div key={d} className="w-2.5 h-2.5 rounded-full"
                  style={{ backgroundColor: B.orange }}
                  animate={{ y: [0, -8, 0], opacity: [0.5, 1, 0.5] }}
                  transition={{ duration: 0.9, repeat: Infinity, delay: d }} />
              ))}
            </div>
            <p className="text-lg font-bold" style={{ fontFamily: NUNITO, color: B.text }}>
              Đang điều chỉnh câu tiếp theo
            </p>
            <p className="text-sm leading-relaxed" style={{ fontFamily: INTER, color: B.textMuted }}>
              Câu trả lời của bạn đã được phân tích.
              <br />Hệ thống đang chọn câu hỏi phù hợp nhất tiếp theo.
            </p>
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full"
              style={{ backgroundColor: B.orangeLight }}>
              <Zap size={12} style={{ color: B.orange }} />
              <span className="text-xs font-bold" style={{ fontFamily: NUNITO, color: B.orange }}>
                Adaptive — không phải thứ tự cố định
              </span>
            </div>
          </motion.div>
        )}

        {phase === "processing" && (
          <motion.div key="proc" initial={{ opacity: 0, scale: 0.97 }} animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0 }} transition={{ duration: 0.4 }} className="text-center space-y-5">
            <div className="flex justify-center gap-2 mb-2">
              {[0, 0.2, 0.4].map((d) => (
                <motion.div key={d} className="w-3 h-3 rounded-full" style={{ backgroundColor: B.blue }}
                  animate={{ y: [0, -10, 0] }} transition={{ duration: 1.1, repeat: Infinity, delay: d }} />
              ))}
            </div>
            <p className="text-xl font-bold" style={{ fontFamily: NUNITO, color: B.text }}>
              Đang xây dựng bản đồ tri thức
            </p>
            <p className="text-sm" style={{ fontFamily: INTER, color: B.textMuted }}>
              12 câu trả lời được phân tích…
            </p>
            <div className="w-56 mx-auto h-1.5 rounded-full overflow-hidden" style={{ backgroundColor: "#E5E7EB" }}>
              <motion.div className="h-full rounded-full" style={{ backgroundColor: B.blue }}
                initial={{ width: "0%" }} animate={{ width: "100%" }}
                transition={{ duration: 1.7, ease: "easeInOut" }} />
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showWidgets && <MathWidgetShowcase onClose={() => setShowWidgets(false)} />}
      </AnimatePresence>
    </motion.div>
  );
}

// ─── MapStep ──────────────────────────────────────────────────────────────────

function MapStep({ onComplete, pitchMode }: { onComplete: () => void; pitchMode: boolean }) {
  const [skillCount, setSkillCount] = useState(0);
  const [panelIn, setPanelIn] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setPanelIn(true), 400);
    return () => clearTimeout(t);
  }, []);

  useEffect(() => {
    if (skillCount >= 47) return;
    const t = setTimeout(() => setSkillCount((c) => c + 1), 26);
    return () => clearTimeout(t);
  }, [skillCount]);

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.5 }}>
      <PitchBar active={pitchMode} duration={6500} onComplete={onComplete} />
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_360px]" style={{ minHeight: "calc(100vh - 78px)" }}>
        <div className="p-4 sm:p-8 flex items-center justify-center">
          <div className="w-full max-w-[580px] aspect-square">
            <KnowledgeMap animateIn showTarget />
          </div>
        </div>

        <motion.div initial={{ opacity: 0, x: 24 }} animate={panelIn ? { opacity: 1, x: 0 } : {}}
          transition={{ duration: 0.55, ease: "easeOut" }}
          className="border-t lg:border-t-0 lg:border-l flex flex-col justify-center gap-6 p-7 lg:p-8"
          style={{ borderColor: B.grayBorder, backgroundColor: B.white }}>

          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="text-xs font-medium" style={{ fontFamily: MONO, color: B.textMuted }}>12 câu hỏi</span>
              <span style={{ color: "#D1D5DB" }}>→</span>
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-6xl font-extrabold tabular-nums" style={{ fontFamily: NUNITO, color: B.text }}>{skillCount}</span>
              <span className="text-lg font-semibold" style={{ fontFamily: NUNITO, color: B.textMuted }}>kỹ năng được vẽ</span>
            </div>
          </div>

          <motion.div initial={{ opacity: 0 }} animate={skillCount >= 28 ? { opacity: 1 } : {}} transition={{ duration: 0.5 }}
            className="space-y-3">
            {[
              { color: B.blue, label: "Thành thạo", value: "31" },
              { color: B.blueMid, label: "Đang phát triển", value: "8" },
              { color: B.orange, label: "Khoảng trống", value: "8", accent: true },
              { color: "#94A3B8", label: "Suy luận từ dữ liệu", value: "—", dim: true },
            ].map((row) => (
              <div key={row.label}
                className={`flex justify-between items-center text-sm ${row.dim ? "pt-2 border-t" : ""}`}
                style={row.dim ? { borderColor: B.grayBorder } : undefined}>
                <div className="flex items-center gap-2.5">
                  <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: row.color }} />
                  <span style={{ fontFamily: INTER, color: B.textMid }}>{row.label}</span>
                </div>
                <span className="font-semibold" style={{ fontFamily: MONO, color: row.accent ? B.orange : row.dim ? B.textLight : B.text }}>
                  {row.value}
                </span>
              </div>
            ))}
          </motion.div>

          <motion.div initial={{ opacity: 0, y: 8 }} animate={skillCount >= 47 ? { opacity: 1, y: 0 } : {}}
            transition={{ duration: 0.5 }} className="rounded-2xl p-4 space-y-2"
            style={{ backgroundColor: B.orangeLight, border: `1.5px solid rgba(245,158,11,0.25)` }}>
            <div className="flex items-center gap-2">
              <Zap size={14} style={{ color: B.orange }} />
              <span className="text-xs font-bold" style={{ fontFamily: NUNITO, color: B.orange }}>Điểm tập trung được xác định</span>
            </div>
            <p className="font-bold" style={{ fontFamily: NUNITO, color: B.text }}>Cụm Phân số</p>
            <p className="text-xs leading-relaxed" style={{ color: B.textMid, fontFamily: INTER }}>
              Tính đẳng trị là gốc rễ — giải quyết nó sẽ mở khóa 6 kỹ năng liên kết
            </p>
          </motion.div>

          <motion.button initial={{ opacity: 0 }} animate={skillCount >= 47 ? { opacity: 1 } : {}}
            transition={{ duration: 0.4, delay: 0.3 }} onClick={onComplete}
            className="w-full rounded-full py-4 font-bold transition-all hover:opacity-90 active:scale-[0.98] flex items-center justify-center gap-2 shadow-sm"
            style={{ backgroundColor: B.blue, color: B.white, fontFamily: NUNITO, fontSize: "1rem" }}>
            Bắt đầu bài học mục tiêu <ArrowRight size={18} />
          </motion.button>
        </motion.div>
      </div>
    </motion.div>
  );
}

// ─── LearnStep ────────────────────────────────────────────────────────────────

function LearnStep({ onComplete, pitchMode }: { onComplete: () => void; pitchMode: boolean }) {
  return (
    <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -16 }} transition={{ duration: 0.45 }}>
      <PitchBar active={pitchMode} duration={6000} onComplete={onComplete} />
      <div className="flex flex-col items-center justify-center px-4 py-12" style={{ minHeight: "calc(100vh - 78px)" }}>
        <div className="w-full max-w-xl space-y-6">
          <div className="flex items-center gap-3 flex-wrap">
            <span className="text-xs font-bold px-3 py-1.5 rounded-full"
              style={{ fontFamily: NUNITO, backgroundColor: B.orangeLight, color: B.orange }}>
              Cụm Phân số · gốc rễ
            </span>
            <span className="text-xs" style={{ color: B.textMuted, fontFamily: INTER }}>Mở khóa 6 kỹ năng liên kết</span>
          </div>

          <div>
            <div className="flex items-center gap-2 mb-2">
              <StepCircle n={1} done />
              <h2 className="text-2xl font-extrabold" style={{ fontFamily: NUNITO, color: B.text }}>
                Tính đẳng trị của phân số
              </h2>
            </div>
            <p className="pl-9 text-base leading-relaxed" style={{ color: B.textMid, fontFamily: INTER }}>
              Hai phân số đẳng trị khi chúng biểu diễn cùng một giá trị — chỉ được viết khác đi.
            </p>
          </div>

          <div className="rounded-2xl p-6 space-y-4 border shadow-sm"
            style={{ backgroundColor: B.white, borderColor: B.grayBorder }}>
            <p className="text-xs font-semibold" style={{ fontFamily: NUNITO, color: B.textMuted }}>
              Tất cả đều biểu diễn cùng một giá trị:
            </p>
            <div className="space-y-3">
              <FractionBar n={1} d={2} color={B.blue} label="1/2" />
              <FractionBar n={2} d={4} color={B.blue} label="2/4" />
              <FractionBar n={3} d={6} color={B.blue} label="3/6" />
            </div>
            <div className="pt-3 border-t flex items-start gap-2.5" style={{ borderColor: B.grayBorder }}>
              <Check size={15} className="shrink-0 mt-0.5" style={{ color: B.green }} />
              <p className="text-sm leading-relaxed" style={{ color: B.textMid, fontFamily: INTER }}>
                Nhân (hoặc chia) cả tử số và mẫu số cho cùng một số → phân số vẫn đẳng trị.
              </p>
            </div>
          </div>

          <div className="rounded-2xl p-5 border shadow-sm"
            style={{ backgroundColor: B.blueLight, borderColor: "rgba(61,114,248,0.15)" }}>
            <p className="text-xs font-bold mb-3" style={{ fontFamily: NUNITO, color: B.blue }}>
              Tại sao cần cho bài toán 3/4 + 1/2
            </p>
            <div className="flex items-center gap-3 flex-wrap text-sm" style={{ fontFamily: INTER, color: B.textMid }}>
              <span>Để cộng phân số, cần quy đồng mẫu số trước:</span>
              <div className="flex items-center gap-2">
                <Frac n={1} d={2} className="text-base" />
                <span style={{ color: B.textLight }}>=</span>
                <Frac n={2} d={4} className="text-base" />
                <span className="text-xs ml-1" style={{ fontFamily: MONO, color: B.textMuted }}>(×2)</span>
              </div>
            </div>
          </div>

          <button onClick={onComplete}
            className="w-full rounded-full py-4 font-bold transition-all hover:opacity-90 active:scale-[0.98] flex items-center justify-center gap-2 shadow-sm"
            style={{ backgroundColor: B.blue, color: B.white, fontFamily: NUNITO, fontSize: "1rem" }}>
            Kiểm tra hiểu bài <ArrowRight size={18} />
          </button>
        </div>
      </div>
    </motion.div>
  );
}

// ─── MasteryStep ──────────────────────────────────────────────────────────────

const MCQ = [
  { id: 0, label: "4/9", correct: false },
  { id: 1, label: "4/6", correct: true },
  { id: 2, label: "3/4", correct: false },
  { id: 3, label: "6/4", correct: false },
];

function MasteryStep({ onComplete, pitchMode }: { onComplete: () => void; pitchMode: boolean }) {
  const [selected, setSelected] = useState<number | null>(null);
  const [submitted, setSubmitted] = useState(false);
  const correct = selected !== null && MCQ[selected].correct;

  useEffect(() => {
    if (!pitchMode) return;
    const t1 = setTimeout(() => setSelected(1), 1000);
    const t2 = setTimeout(() => setSubmitted(true), 2400);
    const t3 = setTimeout(onComplete, 4200);
    return () => { clearTimeout(t1); clearTimeout(t2); clearTimeout(t3); };
  }, [pitchMode, onComplete]);

  return (
    <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -16 }} transition={{ duration: 0.45 }}
      className="flex flex-col items-center justify-center px-4" style={{ minHeight: "calc(100vh - 72px)" }}>
      <div className="w-full max-w-md space-y-5">
        <div className="flex items-center gap-2">
          <StepCircle n={1} />
          <span className="text-xs font-bold px-3 py-1.5 rounded-full"
            style={{ fontFamily: NUNITO, backgroundColor: B.blueLight, color: B.blue }}>
            Kiểm tra thành thạo · 1 câu
          </span>
        </div>

        <div className="rounded-2xl p-7 border shadow-sm" style={{ backgroundColor: B.white, borderColor: B.grayBorder }}>
          <p className="text-sm mb-5" style={{ color: B.textMuted, fontFamily: INTER }}>Phân số nào đẳng trị với</p>
          <div className="flex items-center gap-3">
            <Frac n={2} d={3} className="text-3xl" />
            <span className="text-2xl" style={{ color: "#D1D5DB" }}>?</span>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          {MCQ.map((opt) => {
            const isSel = selected === opt.id;
            let borderColor = B.grayBorder;
            let bg = B.white;
            let textColor = B.text;
            if (submitted && opt.correct) { borderColor = B.green; bg = B.greenLight; textColor = B.green; }
            else if (submitted && isSel && !opt.correct) { borderColor = B.red; bg = B.redLight; textColor = B.red; }
            else if (!submitted && isSel) { borderColor = B.blue; bg = B.blueLight; textColor = B.blue; }
            return (
              <button key={opt.id} onClick={() => !submitted && setSelected(opt.id)}
                className="rounded-2xl p-5 text-center border-2 transition-all shadow-sm"
                style={{ borderColor, backgroundColor: bg, cursor: submitted ? "default" : "pointer",
                  boxShadow: !submitted && isSel ? `0 0 0 3px ${B.blueLight}` : undefined }}>
                <span className="text-2xl font-extrabold" style={{ fontFamily: NUNITO, color: textColor }}>{opt.label}</span>
                {submitted && opt.correct && <div className="flex justify-center mt-2"><Check size={16} style={{ color: B.green }} /></div>}
              </button>
            );
          })}
        </div>

        <AnimatePresence>
          {submitted && (
            <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}
              className="rounded-2xl p-4 border text-sm leading-relaxed font-medium"
              style={{ fontFamily: INTER,
                backgroundColor: correct ? B.greenLight : B.redLight,
                borderColor: correct ? "rgba(16,185,129,0.3)" : "rgba(239,68,68,0.3)",
                color: correct ? B.green : B.red }}>
              {correct
                ? "Chính xác! 2/3 = 4/6 vì cả tử số và mẫu số đều nhân với 2."
                : "Chưa đúng. Đáp án là 4/6 — nhân cả 2 và 3 với 2 ta được 4/6."}
            </motion.div>
          )}
        </AnimatePresence>

        {!submitted ? (
          <button onClick={() => selected !== null && setSubmitted(true)} disabled={selected === null}
            className="w-full rounded-full py-4 font-bold transition-all hover:opacity-90 active:scale-[0.98] disabled:opacity-25 disabled:cursor-not-allowed shadow-sm"
            style={{ backgroundColor: B.blue, color: B.white, fontFamily: NUNITO, fontSize: "1rem" }}>
            Nộp bài
          </button>
        ) : (
          <button onClick={onComplete}
            className="w-full rounded-full py-4 font-bold border-2 transition-all hover:opacity-80 flex items-center justify-center gap-2"
            style={{ borderColor: B.blue, backgroundColor: B.white, color: B.blue, fontFamily: NUNITO, fontSize: "1rem" }}>
            {correct ? "Xem tiến độ của tôi" : "Tiếp tục"} <ArrowRight size={18} />
          </button>
        )}
      </div>
    </motion.div>
  );
}

// ─── OutcomeStep ──────────────────────────────────────────────────────────────

function OutcomeStep({ onRestart }: { onRestart: () => void }) {
  const [show, setShow] = useState(false);
  useEffect(() => { const t = setTimeout(() => setShow(true), 300); return () => clearTimeout(t); }, []);

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.5 }}
      className="grid grid-cols-1 lg:grid-cols-[1fr_360px]" style={{ minHeight: "calc(100vh - 72px)" }}>
      <div className="p-4 sm:p-8 flex items-center justify-center">
        <div className="w-full max-w-[580px] aspect-square">
          <KnowledgeMap showTarget outcome />
        </div>
      </div>

      <motion.div initial={{ opacity: 0, x: 24 }} animate={show ? { opacity: 1, x: 0 } : {}} transition={{ duration: 0.55 }}
        className="border-t lg:border-t-0 lg:border-l flex flex-col justify-center gap-6 p-7 lg:p-8"
        style={{ borderColor: B.grayBorder, backgroundColor: B.white }}>
        <div>
          <p className="text-xs font-semibold mb-1" style={{ fontFamily: MONO, color: B.textMuted }}>Buổi học hoàn tất</p>
          <h2 className="text-2xl font-extrabold" style={{ fontFamily: NUNITO, color: B.text }}>Bản đồ của bạn đã cập nhật</h2>
        </div>

        <div className="space-y-0">
          {[
            { label: "Tính đẳng trị", from: "Khoảng trống", to: "Đang phát triển" },
            { label: "Rút gọn", from: "Khoảng trống", to: "Có thể tiếp cận" },
            { label: "Cộng/trừ phân số", from: "Khoảng trống", to: "Có thể tiếp cận" },
          ].map((c, i) => (
            <div key={i} className="flex items-center justify-between py-3.5 border-b last:border-0"
              style={{ borderColor: B.grayBorder }}>
              <span className="text-sm font-semibold" style={{ fontFamily: NUNITO, color: B.text }}>{c.label}</span>
              <div className="flex items-center gap-1.5 text-xs font-medium" style={{ fontFamily: MONO }}>
                <span style={{ color: B.orange }}>{c.from}</span>
                <span style={{ color: B.textLight }}>→</span>
                <span style={{ color: B.green }}>{c.to}</span>
              </div>
            </div>
          ))}
        </div>

        <div className="rounded-2xl p-4 border" style={{ backgroundColor: B.blueLight, borderColor: "rgba(61,114,248,0.2)" }}>
          <div className="flex items-center gap-2 mb-2">
            <Zap size={14} style={{ color: B.blue }} />
            <span className="text-xs font-bold" style={{ fontFamily: NUNITO, color: B.blue }}>3 kỹ năng được nâng cấp</span>
          </div>
          <p className="text-sm leading-relaxed" style={{ color: B.textMid, fontFamily: INTER }}>
            6 kỹ năng liên kết đang dần gần tầm với. Wizzdom đã cập nhật bản đồ cá nhân của bạn.
          </p>
        </div>

        <div className="flex gap-3">
          <button onClick={onRestart}
            className="flex-1 rounded-full py-3.5 border-2 font-bold text-sm transition-all hover:opacity-80 flex items-center justify-center gap-2"
            style={{ borderColor: B.grayBorder, color: B.textMuted, fontFamily: NUNITO }}>
            <RotateCcw size={14} /> Xem lại demo
          </button>
          <button className="flex-1 rounded-full py-3.5 font-bold text-sm transition-all hover:opacity-90 flex items-center justify-center gap-2 shadow-sm"
            style={{ backgroundColor: B.blue, color: B.white, fontFamily: NUNITO }}>
            Kỹ năng tiếp theo <ArrowRight size={14} />
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}

// ─── App ──────────────────────────────────────────────────────────────────────

export default function App() {
  const [step, setStep] = useState(0);
  const [pitchMode, setPitchMode] = useState(false);

  const goTo = (n: number) => setStep(n);

  return (
    <div className="min-h-screen" style={{ backgroundColor: B.bg, fontFamily: INTER }}>
      <header className="h-[72px] border-b flex items-center px-5 sm:px-8 gap-4"
        style={{ backgroundColor: B.white, borderColor: B.grayBorder }}>
        <WizzdomLogo />

        <div className="flex-1 flex justify-center overflow-x-auto">
          <StepBar current={step} />
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {/* Pitch mode toggle */}
          <button onClick={() => setPitchMode((p) => !p)}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-full text-xs font-bold transition-all hover:opacity-80"
            style={{
              backgroundColor: pitchMode ? B.blue : B.blueLight,
              color: pitchMode ? B.white : B.blue,
              fontFamily: NUNITO,
            }}
            title={pitchMode ? "Tắt chế độ demo" : "Bật chế độ demo tự động"}>
            {pitchMode ? <Pause size={12} /> : <Play size={12} />}
            <span className="hidden sm:inline">Demo</span>
          </button>

          {/* Student chip */}
          <div className="hidden sm:flex items-center gap-2">
            <div className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold"
              style={{ backgroundColor: B.blueLight, color: B.blue, fontFamily: NUNITO }}>M</div>
            <span className="text-xs font-medium" style={{ fontFamily: MONO, color: B.textMuted }}>Minh · 8A</span>
          </div>
        </div>
      </header>

      <AnimatePresence mode="wait">
        {step === 0 && <AssessStep key="0" onComplete={() => goTo(1)} pitchMode={pitchMode} />}
        {step === 1 && <MapStep key="1" onComplete={() => goTo(2)} pitchMode={pitchMode} />}
        {step === 2 && <LearnStep key="2" onComplete={() => goTo(3)} pitchMode={pitchMode} />}
        {step === 3 && <MasteryStep key="3" onComplete={() => goTo(4)} pitchMode={pitchMode} />}
        {step === 4 && <OutcomeStep key="4" onRestart={() => { goTo(0); setPitchMode(false); }} />}
      </AnimatePresence>
    </div>
  );
}
