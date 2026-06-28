"use client";
// ─── Math Input Widgets ────────────────────────────────────────────────────────
// Student-facing answer input — visual math notation, no syntax required
// All widgets: keyboard navigable, Tab/Enter friendly, mobile-ready (inputMode)

import { useRef, useState } from "react";
import { X } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { B, NUNITO, INTER, MONO } from "@/components/wizzdom/design-tokens";

// ─── Shared input style helper ───────────────────────────────────────────────
function inputStyle(filled: boolean, w: number, fontSize: string): React.CSSProperties {
  return {
    width: w,
    textAlign: "center",
    backgroundColor: "transparent",
    border: "none",
    borderBottom: `3px solid ${filled ? B.blue : "#E5E7EB"}`,
    outline: "none",
    fontSize,
    fontFamily: NUNITO,
    fontWeight: 800,
    color: filled ? B.text : "#CCCCCC",
    padding: "4px 0",
    transition: "border-color 0.18s",
  };
}

// ─── W1: Integer Widget ───────────────────────────────────────────────────────
export interface IntegerWidgetState { val: string }
export function IntegerWidget({
  val, onChange, onSubmit, disabled, autoFocus,
}: {
  val: string; onChange: (v: string) => void; onSubmit?: () => void;
  disabled?: boolean; autoFocus?: boolean;
}) {
  return (
    <input
      type="text"
      inputMode="numeric"
      value={val}
      onChange={(e) => onChange(e.target.value.replace(/[^0-9-]/g, ""))}
      onKeyDown={(e) => { if (e.key === "Enter") onSubmit?.(); }}
      disabled={disabled}
      autoFocus={autoFocus}
      placeholder="?"
      style={{ ...inputStyle(!!val, 120, "2rem"), padding: "6px 8px" }}
    />
  );
}
export function serializeInteger(s: IntegerWidgetState) { return s.val; }

// ─── W2: Decimal Widget ───────────────────────────────────────────────────────
export interface DecimalWidgetState { val: string }
export function DecimalWidget({
  val, onChange, onSubmit, disabled, autoFocus,
}: {
  val: string; onChange: (v: string) => void; onSubmit?: () => void;
  disabled?: boolean; autoFocus?: boolean;
}) {
  return (
    <input
      type="text"
      inputMode="decimal"
      value={val}
      onChange={(e) => {
        const v = e.target.value.replace(",", ".").replace(/[^0-9.]/g, "");
        onChange(v);
      }}
      onKeyDown={(e) => { if (e.key === "Enter") onSubmit?.(); }}
      disabled={disabled}
      autoFocus={autoFocus}
      placeholder="0,00"
      style={{ ...inputStyle(!!val, 120, "2rem"), padding: "6px 8px" }}
    />
  );
}
export function serializeDecimal(s: DecimalWidgetState) { return s.val; }

// ─── W3: Fraction Widget ──────────────────────────────────────────────────────
export interface FractionWidgetState { num: string; den: string }
export function FractionWidget({
  num, den, onNumChange, onDenChange, onSubmit, disabled, autoFocus = true, size = "lg",
}: {
  num: string; den: string;
  onNumChange: (v: string) => void; onDenChange: (v: string) => void;
  onSubmit?: () => void; disabled?: boolean; autoFocus?: boolean;
  size?: "sm" | "lg";
}) {
  const numRef = useRef<HTMLInputElement>(null);
  const denRef = useRef<HTMLInputElement>(null);
  const fs = size === "lg" ? "2.2rem" : "1.5rem";
  const w = size === "lg" ? 84 : 60;

  const iStyle = (filled: boolean): React.CSSProperties => ({
    width: w, textAlign: "center", backgroundColor: "transparent",
    border: "none", borderBottom: `3px solid ${filled ? B.blue : "#E5E7EB"}`,
    outline: "none", fontSize: fs, fontFamily: NUNITO, fontWeight: 800,
    color: filled ? B.text : "#CCCCCC", padding: "4px 0", transition: "border-color 0.18s",
  });

  return (
    <div className="flex flex-col items-center" style={{ gap: 5 }}>
      <input
        ref={numRef} type="text" inputMode="numeric" value={num} disabled={disabled}
        onChange={(e) => onNumChange(e.target.value.replace(/[^0-9-]/g, ""))}
        onKeyDown={(e) => {
          if (e.key === "Tab" || e.key === "ArrowDown") { e.preventDefault(); denRef.current?.focus(); }
        }}
        placeholder="?" style={iStyle(!!num)} autoFocus={autoFocus}
      />
      <div style={{ width: w + 10, height: 4, backgroundColor: (num || den) ? B.text : "#D1D5DB", borderRadius: 2 }} />
      <input
        ref={denRef} type="text" inputMode="numeric" value={den} disabled={disabled}
        onChange={(e) => onDenChange(e.target.value.replace(/[^0-9]/g, ""))}
        onKeyDown={(e) => {
          if ((e.key === "Tab" && !e.shiftKey) || e.key === "Enter") { e.preventDefault(); if (e.key === "Enter") onSubmit?.(); else onSubmit?.(); }
          if (e.key === "ArrowUp" || (e.key === "Tab" && e.shiftKey)) { e.preventDefault(); numRef.current?.focus(); }
        }}
        placeholder="?" style={iStyle(!!den)}
      />
      {den === "0" && (
        <p style={{ fontSize: "0.7rem", color: B.orange, marginTop: 2, fontFamily: NUNITO }}>Mẫu số ≠ 0</p>
      )}
    </div>
  );
}
export function serializeFraction(s: FractionWidgetState) {
  return `${s.num}/${s.den}`;
}
export function isFractionReady(s: FractionWidgetState) {
  return s.num.trim() !== "" && s.den.trim() !== "" && s.den !== "0";
}

// ─── W4: Mixed Number Widget ──────────────────────────────────────────────────
export interface MixedNumberWidgetState { whole: string; num: string; den: string }
export function MixedNumberWidget({
  whole, num, den, onWholeChange, onNumChange, onDenChange, onSubmit, disabled, autoFocus = true,
}: {
  whole: string; num: string; den: string;
  onWholeChange: (v: string) => void; onNumChange: (v: string) => void; onDenChange: (v: string) => void;
  onSubmit?: () => void; disabled?: boolean; autoFocus?: boolean;
}) {
  const numRef = useRef<HTMLInputElement>(null);
  const denRef = useRef<HTMLInputElement>(null);
  const iStyle = (filled: boolean, w: number): React.CSSProperties => ({
    width: w, textAlign: "center", backgroundColor: "transparent",
    border: "none", borderBottom: `2.5px solid ${filled ? B.blue : "#E5E7EB"}`,
    outline: "none", fontSize: "1.4rem", fontFamily: NUNITO, fontWeight: 800,
    color: filled ? B.text : "#CCCCCC", padding: "2px 0", transition: "border-color 0.18s",
  });

  return (
    <div className="flex items-center gap-2">
      <input type="text" inputMode="numeric" value={whole} disabled={disabled} autoFocus={autoFocus}
        onChange={(e) => onWholeChange(e.target.value.replace(/[^0-9-]/g, ""))}
        onKeyDown={(e) => { if (e.key === "Tab") { e.preventDefault(); numRef.current?.focus(); } }}
        placeholder="?" style={iStyle(!!whole, 40)} />
      <div className="flex flex-col items-center" style={{ gap: 3 }}>
        <input ref={numRef} type="text" inputMode="numeric" value={num} disabled={disabled}
          onChange={(e) => onNumChange(e.target.value.replace(/[^0-9-]/g, ""))}
          onKeyDown={(e) => {
            if (e.key === "Tab" || e.key === "ArrowDown") { e.preventDefault(); denRef.current?.focus(); }
          }}
          placeholder="?" style={iStyle(!!num, 36)} />
        <div style={{ width: 44, height: 3, backgroundColor: (num || den) ? B.text : "#D1D5DB", borderRadius: 2 }} />
        <input ref={denRef} type="text" inputMode="numeric" value={den} disabled={disabled}
          onChange={(e) => onDenChange(e.target.value.replace(/[^0-9]/g, ""))}
          onKeyDown={(e) => {
            if (e.key === "ArrowUp") { e.preventDefault(); numRef.current?.focus(); }
            if (e.key === "Enter") onSubmit?.();
          }}
          placeholder="?" style={iStyle(!!den, 36)} />
      </div>
    </div>
  );
}
export function serializeMixed(s: MixedNumberWidgetState) {
  return `${s.whole} ${s.num}/${s.den}`;
}

// ─── W5: Power Widget ─────────────────────────────────────────────────────────
export interface PowerWidgetState { base: string; exp: string }
export function PowerWidget({
  base, exp, onBaseChange, onExpChange, onSubmit, disabled, autoFocus = true,
}: {
  base: string; exp: string;
  onBaseChange: (v: string) => void; onExpChange: (v: string) => void;
  onSubmit?: () => void; disabled?: boolean; autoFocus?: boolean;
}) {
  const expRef = useRef<HTMLInputElement>(null);
  return (
    <div style={{ display: "flex", alignItems: "flex-end", gap: 4 }}>
      <input type="text" inputMode="numeric" value={base} disabled={disabled} autoFocus={autoFocus}
        onChange={(e) => onBaseChange(e.target.value.replace(/[^0-9-]/g, ""))}
        onKeyDown={(e) => {
          if (e.key === "Tab" || e.key === "ArrowRight") { e.preventDefault(); expRef.current?.focus(); }
        }}
        placeholder="?"
        style={{ width: 48, textAlign: "center", fontSize: "2rem", fontFamily: NUNITO, fontWeight: 800,
          border: "none", borderBottom: `3px solid ${base ? B.blue : "#E5E7EB"}`,
          backgroundColor: "transparent", outline: "none", color: base ? B.text : "#CCCCCC", padding: "4px 0" }} />
      <input ref={expRef} type="text" inputMode="numeric" value={exp} disabled={disabled}
        onChange={(e) => onExpChange(e.target.value.replace(/[^0-9]/g, ""))}
        onKeyDown={(e) => { if (e.key === "Enter") onSubmit?.(); }}
        placeholder="?"
        style={{ width: 28, textAlign: "center", fontSize: "1rem", fontFamily: NUNITO, fontWeight: 800,
          border: "none", borderBottom: `2px solid ${exp ? B.blue : "#E5E7EB"}`,
          backgroundColor: "transparent", outline: "none", color: exp ? B.text : "#CCCCCC",
          marginBottom: 14 }} />
    </div>
  );
}
export function serializePower(s: PowerWidgetState) { return `${s.base}^${s.exp}`; }

// ─── W6: Square Root Widget ───────────────────────────────────────────────────
export interface SqrtWidgetState { val: string }
export function SqrtWidget({
  val, onChange, onSubmit, disabled, autoFocus = true,
}: {
  val: string; onChange: (v: string) => void; onSubmit?: () => void;
  disabled?: boolean; autoFocus?: boolean;
}) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 2 }}>
      <span style={{ fontSize: "2.8rem", fontFamily: NUNITO, color: B.text, lineHeight: 0.85, fontWeight: 800 }}>√</span>
      <div style={{ borderTop: `3.5px solid ${val ? B.text : "#D1D5DB"}`, borderRight: `3.5px solid ${val ? B.text : "#D1D5DB"}`, paddingLeft: 6, paddingTop: 3, paddingRight: 4 }}>
        <input type="text" inputMode="numeric" value={val} disabled={disabled} autoFocus={autoFocus}
          onChange={(e) => onChange(e.target.value.replace(/[^0-9-]/g, ""))}
          onKeyDown={(e) => { if (e.key === "Enter") onSubmit?.(); }}
          placeholder="?"
          style={{ width: 52, textAlign: "center", fontSize: "1.5rem", fontFamily: NUNITO, fontWeight: 800,
            border: "none", outline: "none", backgroundColor: "transparent", color: val ? B.text : "#CCCCCC" }} />
      </div>
    </div>
  );
}
export function serializeSqrt(s: SqrtWidgetState) { return `sqrt(${s.val})`; }

// ─── W11: Inequality Sign Widget ──────────────────────────────────────────────
export interface InequalityWidgetState { sign: string }
export function InequalityWidget({
  sign, leftLabel, rightLabel, onChange,
}: {
  sign: string; leftLabel?: string; rightLabel?: string; onChange: (v: string) => void;
}) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
      {leftLabel && <span style={{ fontSize: "1.4rem", fontFamily: NUNITO, fontWeight: 700, color: B.textMid }}>{leftLabel}</span>}
      <div style={{ display: "flex", gap: 6 }}>
        {["<", "=", ">"].map((o) => (
          <button key={o} onClick={() => onChange(o)}
            style={{ width: 42, height: 42, borderRadius: 10,
              border: `2px solid ${sign === o ? B.blue : "#E5E7EB"}`,
              backgroundColor: sign === o ? B.blueLight : "transparent",
              fontSize: "1.2rem", fontWeight: 800, fontFamily: NUNITO,
              color: sign === o ? B.blue : B.textMuted, cursor: "pointer", transition: "all 0.15s" }}>
            {o}
          </button>
        ))}
      </div>
      {rightLabel && <span style={{ fontSize: "1.4rem", fontFamily: NUNITO, fontWeight: 700, color: B.textMid }}>{rightLabel}</span>}
    </div>
  );
}
export function serializeInequality(s: InequalityWidgetState) { return s.sign; }

// ─── W8: Coordinate Widget ────────────────────────────────────────────────────
export interface CoordinateWidgetState { x: string; y: string }
export function CoordinateWidget({
  x, y, onXChange, onYChange, onSubmit, disabled, autoFocus = true,
}: {
  x: string; y: string; onXChange: (v: string) => void; onYChange: (v: string) => void;
  onSubmit?: () => void; disabled?: boolean; autoFocus?: boolean;
}) {
  const yRef = useRef<HTMLInputElement>(null);
  const iStyle = (filled: boolean): React.CSSProperties => ({
    width: 44, textAlign: "center", border: "none",
    borderBottom: `2.5px solid ${filled ? B.blue : "#E5E7EB"}`,
    backgroundColor: "transparent", outline: "none",
    fontSize: "1.5rem", fontFamily: NUNITO, fontWeight: 800,
    color: filled ? B.text : "#CCCCCC", transition: "border-color 0.18s",
  });
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 4, fontSize: "1.5rem", fontFamily: NUNITO, fontWeight: 800, color: B.textMid }}>
      <span>(</span>
      <input type="text" inputMode="numeric" value={x} disabled={disabled} autoFocus={autoFocus}
        onChange={(e) => onXChange(e.target.value.replace(/[^0-9-]/g, ""))}
        onKeyDown={(e) => { if (e.key === "Tab") { e.preventDefault(); yRef.current?.focus(); } }}
        placeholder="x" style={iStyle(!!x)} />
      <span>,</span>
      <input ref={yRef} type="text" inputMode="numeric" value={y} disabled={disabled}
        onChange={(e) => onYChange(e.target.value.replace(/[^0-9-]/g, ""))}
        onKeyDown={(e) => { if (e.key === "Enter") onSubmit?.(); }}
        placeholder="y" style={iStyle(!!y)} />
      <span>)</span>
    </div>
  );
}
export function serializeCoordinate(s: CoordinateWidgetState) { return `(${s.x},${s.y})`; }

// ─── Unified MathAnswerWidget ─────────────────────────────────────────────────
// Dispatches to correct widget based on `widgetType` from API

type WidgetType = "integer" | "decimal" | "fraction" | "mixed_number" | "power" | "sqrt" | "inequality_sign" | "coordinate" | "mcq" | "raw";

interface MathAnswerWidgetProps {
  widgetType: WidgetType;
  disabled?: boolean;
  onSubmit?: () => void;
  // Fraction
  fractionState?: FractionWidgetState;
  onFractionChange?: (s: FractionWidgetState) => void;
  // Integer / decimal / raw
  textState?: string;
  onTextChange?: (v: string) => void;
  // Power
  powerState?: PowerWidgetState;
  onPowerChange?: (s: PowerWidgetState) => void;
  // Sqrt
  sqrtState?: SqrtWidgetState;
  onSqrtChange?: (s: SqrtWidgetState) => void;
  // Inequality
  inequalityState?: InequalityWidgetState;
  onInequalityChange?: (s: InequalityWidgetState) => void;
  // Coordinate
  coordinateState?: CoordinateWidgetState;
  onCoordinateChange?: (s: CoordinateWidgetState) => void;
  // Mixed number
  mixedState?: MixedNumberWidgetState;
  onMixedChange?: (s: MixedNumberWidgetState) => void;
}

export function MathAnswerWidget(props: MathAnswerWidgetProps) {
  const { widgetType, disabled, onSubmit } = props;

  switch (widgetType) {
    case "fraction":
      return (
        <FractionWidget
          num={props.fractionState?.num ?? ""}
          den={props.fractionState?.den ?? ""}
          onNumChange={(v) => props.onFractionChange?.({ ...props.fractionState!, num: v })}
          onDenChange={(v) => props.onFractionChange?.({ ...props.fractionState!, den: v })}
          onSubmit={onSubmit}
          disabled={disabled}
        />
      );
    case "mixed_number":
      return (
        <MixedNumberWidget
          whole={props.mixedState?.whole ?? ""}
          num={props.mixedState?.num ?? ""}
          den={props.mixedState?.den ?? ""}
          onWholeChange={(v) => props.onMixedChange?.({ ...props.mixedState!, whole: v })}
          onNumChange={(v) => props.onMixedChange?.({ ...props.mixedState!, num: v })}
          onDenChange={(v) => props.onMixedChange?.({ ...props.mixedState!, den: v })}
          onSubmit={onSubmit}
          disabled={disabled}
        />
      );
    case "power":
      return (
        <PowerWidget
          base={props.powerState?.base ?? ""}
          exp={props.powerState?.exp ?? ""}
          onBaseChange={(v) => props.onPowerChange?.({ ...props.powerState!, base: v })}
          onExpChange={(v) => props.onPowerChange?.({ ...props.powerState!, exp: v })}
          onSubmit={onSubmit}
          disabled={disabled}
        />
      );
    case "sqrt":
      return (
        <SqrtWidget
          val={props.sqrtState?.val ?? ""}
          onChange={(v) => props.onSqrtChange?.({ val: v })}
          onSubmit={onSubmit}
          disabled={disabled}
        />
      );
    case "inequality_sign":
      return (
        <InequalityWidget
          sign={props.inequalityState?.sign ?? ""}
          onChange={(v) => props.onInequalityChange?.({ sign: v })}
        />
      );
    case "coordinate":
      return (
        <CoordinateWidget
          x={props.coordinateState?.x ?? ""}
          y={props.coordinateState?.y ?? ""}
          onXChange={(v) => props.onCoordinateChange?.({ ...props.coordinateState!, x: v })}
          onYChange={(v) => props.onCoordinateChange?.({ ...props.coordinateState!, y: v })}
          onSubmit={onSubmit}
          disabled={disabled}
        />
      );
    case "decimal":
      return (
        <DecimalWidget
          val={props.textState ?? ""}
          onChange={(v) => props.onTextChange?.(v)}
          onSubmit={onSubmit}
          disabled={disabled}
          autoFocus
        />
      );
    default:
      return (
        <IntegerWidget
          val={props.textState ?? ""}
          onChange={(v) => props.onTextChange?.(v)}
          onSubmit={onSubmit}
          disabled={disabled}
          autoFocus
        />
      );
  }
}

// ─── Math Widget Showcase Modal ───────────────────────────────────────────────
function FractionWidgetSC() {
  const [num, setNum] = useState(""); const [den, setDen] = useState("");
  return <FractionWidget num={num} den={den} onNumChange={setNum} onDenChange={setDen} size="sm" autoFocus={false} />;
}
function MixedWidgetSC() {
  const [w, setW] = useState(""); const [n, setN] = useState(""); const [d, setD] = useState("");
  return <MixedNumberWidget whole={w} num={n} den={d} onWholeChange={setW} onNumChange={setN} onDenChange={setD} autoFocus={false} />;
}
function PowerWidgetSC() {
  const [b, setB] = useState(""); const [e, setE] = useState("");
  return <PowerWidget base={b} exp={e} onBaseChange={setB} onExpChange={setE} autoFocus={false} />;
}
function SqrtWidgetSC() {
  const [v, setV] = useState("");
  return <SqrtWidget val={v} onChange={setV} autoFocus={false} />;
}
function IneqWidgetSC() {
  const [s, setS] = useState("");
  return <InequalityWidget sign={s} onChange={setS} leftLabel="3/4" rightLabel="0.8" />;
}
function CoordWidgetSC() {
  const [x, setX] = useState(""); const [y, setY] = useState("");
  return <CoordinateWidget x={x} y={y} onXChange={setX} onYChange={setY} autoFocus={false} />;
}

const SHOWCASE_WIDGETS = [
  { id: "fraction",   label: "Phân số",      context: "Rút gọn: 6/8 = ?",        Component: FractionWidgetSC },
  { id: "mixed",      label: "Hỗn số",       context: "Viết hỗn số: 7/3 = ?",     Component: MixedWidgetSC },
  { id: "power",      label: "Lũy thừa",     context: "Điền số mũ: 2ⁿ = 8",       Component: PowerWidgetSC },
  { id: "sqrt",       label: "Căn bậc hai",  context: "Tính: √? = 4",             Component: SqrtWidgetSC },
  { id: "inequality", label: "Dấu so sánh",  context: "So sánh 3/4 và 0.8:",      Component: IneqWidgetSC },
  { id: "coordinate", label: "Tọa độ điểm",  context: "Điểm A có tọa độ:",        Component: CoordWidgetSC },
];

export function MathWidgetShowcase({ onClose }: { onClose: () => void }) {
  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center"
      style={{ backgroundColor: "rgba(17,24,39,0.35)", backdropFilter: "blur(6px)" }}
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <motion.div
        initial={{ opacity: 0, y: 48 }} animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 48 }} transition={{ duration: 0.35, ease: [0.32, 0.72, 0, 1] }}
        className="w-full sm:max-w-2xl rounded-t-3xl sm:rounded-3xl overflow-y-auto"
        style={{ backgroundColor: B.white, maxHeight: "92vh" }}
      >
        <div className="flex items-center justify-between px-6 py-5 border-b" style={{ borderColor: B.grayBorder }}>
          <div>
            <p className="text-xs font-bold mb-0.5" style={{ fontFamily: MONO, color: B.blue }}>Math Input System</p>
            <h3 className="text-xl font-extrabold" style={{ fontFamily: NUNITO, color: B.text }}>Bộ widget nhập toán học</h3>
          </div>
          <button onClick={onClose} className="w-9 h-9 rounded-full flex items-center justify-center hover:opacity-70" style={{ backgroundColor: B.gray }}>
            <X size={16} style={{ color: B.textMuted }} />
          </button>
        </div>
        <div className="px-6 py-3.5" style={{ backgroundColor: B.blueLight }}>
          <p className="text-sm leading-relaxed" style={{ fontFamily: INTER, color: B.textMid }}>
            Học sinh nhập toán như viết trên vở — không cần học cú pháp máy tính.
          </p>
        </div>
        <div className="p-5 grid grid-cols-1 sm:grid-cols-2 gap-4">
          {SHOWCASE_WIDGETS.map(({ id, label, context, Component }) => (
            <div key={id} className="rounded-2xl p-5 border" style={{ backgroundColor: B.bg, borderColor: B.grayBorder }}>
              <div className="flex items-center gap-2 mb-2">
                <span className="text-xs font-bold px-2.5 py-1 rounded-full" style={{ fontFamily: NUNITO, backgroundColor: B.blueLight, color: B.blue }}>{label}</span>
              </div>
              <p className="text-xs mb-4" style={{ fontFamily: INTER, color: B.textMuted }}>{context}</p>
              <div className="flex justify-center py-1"><Component /></div>
            </div>
          ))}
        </div>
        <div className="px-6 pb-6 text-center">
          <p className="text-xs" style={{ fontFamily: INTER, color: B.textLight }}>
            Tab · Shift+Tab · ↑↓ → để điều hướng · Enter để nộp · inputMode=numeric trên mobile
          </p>
        </div>
      </motion.div>
    </motion.div>
  );
}

// ─── Export type for use in page ──────────────────────────────────────────────
export type { WidgetType };
