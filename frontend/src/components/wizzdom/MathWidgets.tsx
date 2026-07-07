"use client";
// ─── Math Input Widgets ────────────────────────────────────────────────────────
// Student-facing answer input — visual math notation, no syntax required
// All widgets: keyboard navigable, Tab/Enter friendly, mobile-ready (inputMode)

import { useRef, useState } from "react";
import { X } from "lucide-react";
import { motion } from "framer-motion";
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
        <p style={{ fontSize: "0.7rem", color: B.orange, marginTop: 2, fontFamily: NUNITO }}>Mẫu số không được bằng 0</p>
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

// ─── W8: Two-Point Widget ─────────────────────────────────────────────────────
// Structured input for ordered_pair_list when exactly 2 points are needed.
// Shows: Điểm 1: ( x₁ , y₁ )   Điểm 2: ( x₂ , y₂ )
export interface TwoPointWidgetState { x1: string; y1: string; x2: string; y2: string }

const COORD_INPUT: React.CSSProperties = {
  width: 52,
  border: "none",
  borderBottom: "2.5px solid #3d72f8",
  outline: "none",
  textAlign: "center",
  fontSize: "1.3rem",
  fontWeight: 700,
  padding: "4px 2px",
  background: "transparent",
  fontFamily: "ui-monospace, monospace",
};
const COORD_PAREN: React.CSSProperties = {
  fontSize: "1.9rem",
  color: "#64748b",
  fontWeight: 400,
  lineHeight: 1,
};
const COORD_COMMA: React.CSSProperties = {
  fontSize: "1.3rem",
  color: "#334155",
  fontWeight: 700,
  padding: "0 2px",
};

export function TwoPointWidget({
  state, onChange, onSubmit, disabled,
}: {
  state: TwoPointWidgetState;
  onChange: (s: TwoPointWidgetState) => void;
  onSubmit?: () => void;
  disabled?: boolean;
}) {
  const refs = [
    useRef<HTMLInputElement>(null),
    useRef<HTMLInputElement>(null),
    useRef<HTMLInputElement>(null),
    useRef<HTMLInputElement>(null),
  ];
  const fields: Array<keyof TwoPointWidgetState> = ["x1", "y1", "x2", "y2"];

  const handleKey = (idx: number) => (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") { onSubmit?.(); return; }
    if (e.key === "Tab" || e.key === "ArrowRight") {
      e.preventDefault();
      refs[(idx + 1) % 4].current?.focus();
    }
    if (e.key === "ArrowLeft") {
      e.preventDefault();
      refs[(idx + 3) % 4].current?.focus();
    }
  };

  const PointInput = (label: string, xKey: keyof TwoPointWidgetState, yKey: keyof TwoPointWidgetState, xIdx: number, yIdx: number) => (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6 }}>
      <span style={{ fontSize: 11, fontWeight: 800, color: "#94a3b8", letterSpacing: 0.5, textTransform: "uppercase" }}>{label}</span>
      <div style={{ display: "flex", alignItems: "center", gap: 2 }}>
        <span style={COORD_PAREN}>(</span>
        <input
          ref={refs[xIdx]}
          type="text"
          inputMode="numeric"
          value={state[xKey]}
          onChange={(e) => onChange({ ...state, [xKey]: e.target.value.replace(/[^0-9.\-]/g, "") })}
          onKeyDown={handleKey(xIdx)}
          disabled={disabled}
          placeholder="x"
          autoFocus={xIdx === 0}
          style={{ ...COORD_INPUT, borderBottomColor: state[xKey] ? "#3d72f8" : "#cbd5e1" }}
          aria-label={`${label} tọa độ x`}
        />
        <span style={COORD_COMMA}>,</span>
        <input
          ref={refs[yIdx]}
          type="text"
          inputMode="numeric"
          value={state[yKey]}
          onChange={(e) => onChange({ ...state, [yKey]: e.target.value.replace(/[^0-9.\-]/g, "") })}
          onKeyDown={handleKey(yIdx)}
          disabled={disabled}
          placeholder="y"
          style={{ ...COORD_INPUT, borderBottomColor: state[yKey] ? "#3d72f8" : "#cbd5e1" }}
          aria-label={`${label} tọa độ y`}
        />
        <span style={COORD_PAREN}>)</span>
      </div>
    </div>
  );

  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 16 }}>
      <div style={{ display: "flex", alignItems: "flex-end", gap: 24 }}>
        {PointInput("Điểm 1", "x1", "y1", 0, 1)}
        <span style={{ fontSize: "1.4rem", color: "#cbd5e1", paddingBottom: 4 }}>·</span>
        {PointInput("Điểm 2", "x2", "y2", 2, 3)}
      </div>
      <p style={{ margin: 0, fontSize: 12, color: "#94a3b8" }}>Tab hoặc → để chuyển ô · Enter để nộp</p>
    </div>
  );
}
export function serializeTwoPoint(s: TwoPointWidgetState) {
  return `(${s.x1},${s.y1});(${s.x2},${s.y2})`;
}
export function isTwoPointReady(s: TwoPointWidgetState) {
  return s.x1.trim() !== "" && s.y1.trim() !== "" && s.x2.trim() !== "" && s.y2.trim() !== "";
}

// ─── W9: Set Widget ───────────────────────────────────────────────────────────
// For set_equal checker: { -2; 3 }
export interface SetWidgetState { val: string }
export function SetWidget({
  val, onChange, onSubmit, disabled, placeholder = "-2; 3",
}: {
  val: string; onChange: (v: string) => void; onSubmit?: () => void;
  disabled?: boolean; placeholder?: string;
}) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
      <span style={{ fontSize: "1.8rem", fontFamily: "serif", fontWeight: 700, color: "#64748b" }}>{`{`}</span>
      <input
        type="text"
        value={val}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => { if (e.key === "Enter") onSubmit?.(); }}
        disabled={disabled}
        placeholder={placeholder}
        autoFocus
        style={{
          minWidth: 140,
          border: "none",
          borderBottom: `3px solid ${val ? "#3d72f8" : "#E5E7EB"}`,
          outline: "none",
          textAlign: "center",
          fontSize: "1.4rem",
          fontFamily: "ui-monospace, monospace",
          fontWeight: 700,
          padding: "4px 4px",
          background: "transparent",
          color: val ? "#111827" : "#CCCCCC",
        }}
      />
      <span style={{ fontSize: "1.8rem", fontFamily: "serif", fontWeight: 700, color: "#64748b" }}>{`}`}</span>
    </div>
  );
}
export function serializeSet(s: SetWidgetState) { return `{${s.val}}`; }

// ─── W10: Ordered Pair List Widget ────────────────────────────────────────────
// For ordered_pair_list_equal: (0,-4); (2,0)
export interface OrderedPairListWidgetState { val: string }
export function OrderedPairListWidget({
  val, onChange, onSubmit, disabled,
}: {
  val: string; onChange: (v: string) => void; onSubmit?: () => void; disabled?: boolean;
}) {
  return (
    <div style={{ display: "grid", gap: 10, justifyItems: "center" }}>
      <input
        type="text"
        value={val}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => { if (e.key === "Enter") onSubmit?.(); }}
        disabled={disabled}
        placeholder="(0, -4); (2, 0)"
        autoFocus
        style={{
          width: "min(420px, 100%)",
          border: "none",
          borderBottom: `3px solid ${val ? "#3d72f8" : "#E5E7EB"}`,
          outline: "none",
          textAlign: "center",
          fontSize: "1.4rem",
          fontFamily: "ui-monospace, monospace",
          fontWeight: 700,
          padding: "6px 8px",
          background: "transparent",
          color: val ? "#111827" : "#CCCCCC",
        }}
      />
      <p style={{ margin: 0, fontSize: 12, color: "#94a3b8", fontFamily: "sans-serif" }}>
        Nhập từng điểm dạng <strong>(x, y)</strong>, cách nhau bằng dấu chấm phẩy
      </p>
    </div>
  );
}
export function serializeOrderedPairList(s: OrderedPairListWidgetState) { return s.val; }

// ─── Unified MathAnswerWidget ─────────────────────────────────────────────────
// Dispatches to correct widget based on `widgetType` from API

export type WidgetType = "number" | "integer" | "decimal" | "fraction" | "mixed_number" | "power" | "sqrt" | "inequality_sign" | "coordinate" | "mcq" | "raw" | "set" | "ordered_pair_list";

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
  { id: "fraction",   label: "Phân số",        context: "Rút gọn: 6/8 = ?",        Component: FractionWidgetSC },
  { id: "mixed",      label: "Hỗn số",    context: "Viết dưới dạng hỗn số: 7/3 = ?", Component: MixedWidgetSC },
  { id: "power",      label: "Lũy thừa",           context: "Điền số mũ: 2^n = 8", Component: PowerWidgetSC },
  { id: "sqrt",       label: "Căn bậc hai",     context: "Tính: căn(?) = 4",   Component: SqrtWidgetSC },
  { id: "inequality", label: "Dấu so sánh", context: "So sánh 3/4 và 0,8:",     Component: IneqWidgetSC },
  { id: "coordinate", label: "Tọa độ",      context: "Điểm A có tọa độ:", Component: CoordWidgetSC },
];

export function MathWidgetShowcase({ onClose }: { onClose: () => void }) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 50,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: "rgba(17,24,39,0.35)",
        backdropFilter: "blur(6px)",
        padding: 16,
      }}
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <motion.div
        initial={{ opacity: 0, y: 48 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 48 }}
        transition={{ duration: 0.35, ease: [0.32, 0.72, 0, 1] }}
        style={{
          width: "100%",
          maxWidth: 672,
          backgroundColor: B.white,
          borderRadius: 24,
          overflow: "hidden",
          boxShadow: "0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)",
          display: "flex",
          flexDirection: "column",
          maxHeight: "92vh",
        }}
      >
        {/* Header */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "20px 24px", borderBottom: `1px solid ${B.grayBorder}` }}>
          <div>
            <p style={{ fontFamily: MONO, fontSize: 11, fontWeight: 700, color: B.blue, margin: "0 0 2px" }}>Bộ nhập toán học</p>
            <h3 style={{ fontFamily: NUNITO, fontSize: 20, fontWeight: 800, color: B.text, margin: 0 }}>Ô nhập đáp án</h3>
          </div>
          <button onClick={onClose} style={{ width: 36, height: 36, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", border: "none", backgroundColor: B.gray, cursor: "pointer", transition: "opacity 0.2s" }} className="hover:opacity-70">
            <X size={16} style={{ color: B.textMuted }} />
          </button>
        </div>

        {/* Tagline banner */}
        <div style={{ padding: "14px 24px", backgroundColor: B.blueLight }}>
          <p style={{ fontFamily: INTER, fontSize: 14, lineHeight: 1.5, color: B.textMid, margin: 0 }}>
            Học sinh nhập toán gần giống cách viết trên giấy. Mỗi dạng đáp án có ô nhập riêng để giảm lỗi gõ nhầm.
          </p>
        </div>

        {/* Grid */}
        <div style={{ padding: 20, display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 16, overflowY: "auto" }}>
          {SHOWCASE_WIDGETS.map(({ id, label, context, Component }) => (
            <div key={id} style={{ borderRadius: 16, padding: 20, borderWidth: 1, borderStyle: "solid", borderColor: B.grayBorder, backgroundColor: B.bg, display: "flex", flexDirection: "column", gap: 10 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ fontFamily: NUNITO, fontSize: 11, fontWeight: 700, padding: "4px 10px", borderRadius: 9999, backgroundColor: B.blueLight, color: B.blue }}>
                  {label}
                </span>
              </div>
              <p style={{ fontFamily: INTER, fontSize: 12, color: B.textMuted, margin: 0 }}>{context}</p>
              <div style={{ display: "flex", justifyContent: "center", padding: "4px 0" }}>
                <Component />
              </div>
            </div>
          ))}
        </div>

        {/* Footer */}
        <div style={{ padding: "0 24px 20px", textAlign: "center" }}>
          <p style={{ fontFamily: INTER, fontSize: 11, color: B.textLight, margin: 0 }}>
            Tab · Shift+Tab · ↑↓ để chuyển ô · Enter để nộp · bàn phím số trên điện thoại
          </p>
        </div>
      </motion.div>
    </motion.div>
  );
}
