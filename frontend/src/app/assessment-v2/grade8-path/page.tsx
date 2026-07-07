"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ArrowRight, CheckCircle2, Loader2, Zap, Lock, TrendingUp, BookOpen, Star } from "lucide-react";
import { motion } from "framer-motion";
import { B, NUNITO, INTER, MONO } from "@/components/wizzdom/design-tokens";
import {
  createAssessmentV2Session,
  submitAssessmentV2Response,
  type AssessmentV2Item,
  type AssessmentV2Result,
  type AssessmentV2SessionResponse,
} from "@/lib/assessment-v2-api";
import {
  FractionWidget,
  MathAnswerWidget,
  SetWidget,
  TwoPointWidget,
  OrderedPairListWidget,
  isFractionReady,
  isTwoPointReady,
  serializeFraction,
  serializeTwoPoint,
  type FractionWidgetState,
  type SetWidgetState,
  type TwoPointWidgetState,
  type OrderedPairListWidgetState,
  type WidgetType,
} from "@/components/wizzdom/MathWidgets";
import { WizzdomLogo } from "@/components/wizzdom/MathDisplay";

const MAX_QUESTIONS = 35;

// ─── Unicode math rendering ────────────────────────────────────────────────────
// Converts raw notation (x^2, x^2y, xy) → readable Unicode for display in
// question text. Does NOT affect the answer input or backend serialization.
const SUPERSCRIPTS: Record<string, string> = {
  "0": "⁰", "1": "¹", "2": "²", "3": "³", "4": "⁴",
  "5": "⁵", "6": "⁶", "7": "⁷", "8": "⁸", "9": "⁹",
};
function toSuperscript(exp: string): string {
  return exp.split("").map((c) => SUPERSCRIPTS[c] ?? c).join("");
}
function renderMath(text: string): string {
  // x^2y → x²y, x^2 → x², m^2 → m² etc.
  return text
    .replace(/\(([^)]+)\)\^(\d+)/g, "($1)$2".replace(/\d+/, (n) => toSuperscript(n)))
    .replace(/([a-zA-Z])\^(\d+)/g, (_m, v, n) => `${v}${toSuperscript(n)}`);
}

type Phase = "loading" | "question" | "adapting" | "completed";

type ExpressionTemplate =
  | "x_plus_number"
  | "x_times_x_plus_number"
  | "linear_expression"
  | "number_minus_x"
  | "rational_fraction"
  | "two_factor_product"
  | "percent_times_amount"
  | null;

// ─── Token sets per item_family for AlgebraExpressionWidget ──────────────────
// Each entry lists chips to show. Compound tokens like "x²" display nicely
// but insert their ASCII equivalent (x^2) into the text field.
const FAMILY_TOKENS: Record<string, Array<{ label: string; insert: string }>> = {
  // Polynomial families — need x² and xy compound chips
  subtract_multivariable_polynomials:         [{label:"x²",insert:"x^2"},{label:"xy",insert:"xy"},{label:"x",insert:"x"},{label:"y",insert:"y"},{label:"+",insert:"+"},{label:"-",insert:"-"}],
  add_multivariable_polynomials:              [{label:"x²",insert:"x^2"},{label:"xy",insert:"xy"},{label:"x",insert:"x"},{label:"y",insert:"y"},{label:"+",insert:"+"},{label:"-",insert:"-"}],
  combine_like_terms_polynomial:              [{label:"x²",insert:"x^2"},{label:"xy",insert:"xy"},{label:"x",insert:"x"},{label:"y",insert:"y"},{label:"+",insert:"+"},{label:"-",insert:"-"}],
  sum_linear_multivariable_polynomials:       [{label:"a",insert:"a"},{label:"b",insert:"b"},{label:"c",insert:"c"},{label:"+",insert:"+"},{label:"-",insert:"-"}],
  // Bỏ ngoặc — chỉ cần biến đơn và dấu
  remove_parentheses_minus_before:            [{label:"x",insert:"x"},{label:"y",insert:"y"},{label:"a",insert:"a"},{label:"b",insert:"b"},{label:"+",insert:"+"},{label:"-",insert:"-"}],
  remove_nested_parentheses_minus_inside:     [{label:"a",insert:"a"},{label:"b",insert:"b"},{label:"c",insert:"c"},{label:"+",insert:"+"},{label:"-",insert:"-"}],
  // Nhận biết
  identify_polynomial_terms:                 [{label:"x²",insert:"x^2"},{label:"x",insert:"x"},{label:"y",insert:"y"},{label:"+",insert:"+"},{label:"-",insert:"-"}],
  identify_rational_expression_part:         [{label:"x",insert:"x"},{label:"a",insert:"a"},{label:"b",insert:"b"},{label:"+",insert:"+"},{label:"-",insert:"-"},{label:"/",insert:"/"}],
  identify_variable_in_algebraic_expression: [{label:"x",insert:"x"},{label:"a",insert:"a"},{label:"b",insert:"b"},{label:"+",insert:"+"},{label:"-",insert:"-"}],
  // Chia đơn thức
  divide_two_monomials_g7:                   [{label:"x",insert:"x"},{label:"y",insert:"y"},{label:"a",insert:"a"},{label:"b",insert:"b"},{label:"^",insert:"^"},{label:"/",insert:"/"}],
  // Lãi suất — cần x, %, số thập phân
  write_interest_expression:                 [{label:"x",insert:"x"},{label:"%",insert:"%"},{label:"×",insert:"*"},{label:"+",insert:"+"},{label:"-",insert:"-"}],
};

const DEFAULT_EXPRESSION_TOKENS: Array<{ label: string; insert: string }> = [
  {label:"x",insert:"x"},{label:"a",insert:"a"},{label:"b",insert:"b"},
  {label:"+",insert:"+"},{label:"-",insert:"-"},{label:"×",insert:"*"},
  {label:"/",insert:"/"},{label:"^",insert:"^"},{label:"(",insert:"("},{label:")",insert:")"},
];

function getTokensForFamily(family?: string | null): Array<{ label: string; insert: string }> {
  if (!family) return DEFAULT_EXPRESSION_TOKENS;
  return FAMILY_TOKENS[family] ?? DEFAULT_EXPRESSION_TOKENS;
}

// ─── AlgebraExpressionWidget ──────────────────────────────────────────────────
// Smart expression input: shows only tokens relevant to the item_family.
function AlgebraExpressionWidget({
  value,
  onChange,
  onSubmit,
  disabled,
  item,
}: {
  value: string;
  onChange: (v: string) => void;
  onSubmit: () => void;
  disabled?: boolean;
  item?: AssessmentV2Item | null;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const tokens = getTokensForFamily(item?.item_family);

  const insert = (raw: string) => {
    const input = inputRef.current;
    if (!input) { onChange(value + raw); return; }
    const start = input.selectionStart ?? value.length;
    const end = input.selectionEnd ?? value.length;
    const next = `${value.slice(0, start)}${raw}${value.slice(end)}`;
    onChange(next);
    requestAnimationFrame(() => {
      input.focus();
      input.setSelectionRange(start + raw.length, start + raw.length);
    });
  };

  return (
    <div style={{ display: "grid", justifyItems: "center", gap: 16, width: "min(640px, 100%)" }}>
      {/* Main input */}
      <input
        ref={inputRef}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => { if (e.key === "Enter" && value.trim()) onSubmit(); }}
        disabled={disabled}
        placeholder="Nhập đáp án..."
        autoFocus
        style={{
          width: "100%",
          border: "none",
          borderBottom: `3px solid ${value ? "#3d72f8" : "#cbd5e1"}`,
          outline: "none",
          textAlign: "center",
          fontSize: 28,
          fontWeight: 850,
          padding: "10px 8px",
          background: "transparent",
          fontFamily: "ui-monospace, monospace",
          color: value ? "#111827" : "#94a3b8",
          transition: "border-color 0.18s",
        }}
      />

      {/* Contextual token chips */}
      <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "center", gap: 8 }}>
        {tokens.map(({ label, insert: raw }) => (
          <button
            key={label}
            type="button"
            onClick={() => insert(raw)}
            disabled={disabled}
            style={{
              minWidth: 40,
              height: 36,
              borderRadius: 10,
              padding: "0 10px",
              background: "#eef4ff",
              color: "#2563eb",
              border: "1.5px solid #bfdbfe",
              fontSize: 16,
              fontWeight: 700,
              cursor: "pointer",
              fontFamily: "ui-monospace, monospace",
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              transition: "background 0.12s",
            }}
          >
            {label}
          </button>
        ))}
        {value && (
          <button
            type="button"
            onClick={() => onChange("")}
            disabled={disabled}
            style={{
              height: 36,
              borderRadius: 10,
              padding: "0 12px",
              background: "#fff1f2",
              color: "#dc2626",
              border: "1.5px solid #fecaca",
              fontSize: 12,
              fontWeight: 700,
              cursor: "pointer",
              fontFamily: "sans-serif",
              display: "inline-flex",
              alignItems: "center",
              gap: 5,
            }}
          >
            ✕ Xóa
          </button>
        )}
      </div>

      <p style={{ margin: 0, fontSize: 12, color: "#94a3b8", textAlign: "center" }}>
        Bấm chip hoặc gõ trực tiếp · Enter để nộp
      </p>
    </div>
  );
}

const PATH_LABELS: Record<string, string> = {
  rational_expression: "Phân thức đại số",
  linear_equation: "Phương trình",
  word_problem_modeling: "Bài toán thực tế",
  linear_function: "Hàm số bậc nhất",
  fraction_foundation: "Nền tảng phân số",
  integer_foundation: "Nền tảng số nguyên",
  algebra_foundation: "Nền tảng đại số",
};

const ROLE_LABELS: Record<string, string> = {
  anchor: "Câu neo",
  misconception: "Dò lỗi sai thường gặp",
  prerequisite_probe: "Dò kiến thức nền",
  confirmation: "Câu xác nhận",
  bridge: "Câu nối",
  transfer: "Câu vận dụng",
  readiness: "Sẵn sàng học tiếp",
};

const FAMILY_LABELS: Record<string, string> = {
  identify_rational_expression_part: "Nhận biết phân thức",
  identify_variable_in_algebraic_expression: "Nhận biết biến",
  equivalent_fraction_missing_part: "Phân số bằng nhau",
  recognize_valid_fraction_parts: "Nhận biết phân số",
  write_negative_integer_context: "Số nguyên âm",
  remove_parentheses_minus_before: "Bỏ ngoặc dấu trừ",
  opposite_negative_integer: "Số đối",
  divide_negative_by_positive_integer: "Chia số nguyên",
  expand_coefficient_parentheses: "Khai triển ngoặc",
  reciprocal_positive_fraction: "Nghịch đảo phân số",
  opposite_positive_fraction: "Số đối của phân số",
  order_operations_parentheses_first: "Thứ tự phép tính",
  simplify_fraction_by_gcd: "Rút gọn phân số",
  multiply_two_negative_integers: "Nhân số nguyên",
  percent_to_decimal: "Đổi phần trăm",
};

function labelFor(map: Record<string, string>, value?: string | null) {
  if (!value) return null;
  return map[value] ?? value.replace(/_/g, " ");
}

function familyLabel(value?: string | null) {
  if (!value) return null;
  return FAMILY_LABELS[value] ?? "Dạng câu chẩn đoán";
}

function friendlyError(message?: string | null) {
  if (!message) return "Có lỗi khi xử lý câu trả lời. Em thử lại giúp hệ thống nhé.";
  if (message.includes("float()") || message.includes("NoneType")) {
    return "Đáp án chưa đúng định dạng để hệ thống chấm. Em thử nhập lại bằng số hoặc dùng nút Em chưa biết.";
  }
  if (message.includes("network") || message.includes("fetch")) {
    return "Kết nối đang không ổn định. Em thử nộp lại sau vài giây.";
  }
  return "Có lỗi khi xử lý câu trả lời. Em thử lại hoặc báo giáo viên giúp hệ thống kiểm tra.";
}

type ResolvedWidget = WidgetType | "expression_raw" | "expression_template" | "set_input" | "ordered_pair_list_input";

function normalizeWidget(raw?: string | null, checker?: string | null): ResolvedWidget {
  const value = String(raw || checker || "number").toLowerCase().replace(/[\s-]/g, "_");
  if (["fraction", "fraction_equal"].includes(value)) return "fraction";
  if (["decimal", "decimal_equal", "probability", "probability_equal"].includes(value)) return "decimal";
  if (["coordinate", "coordinate_pair", "coordinate_pair_equal"].includes(value)) return "coordinate";
  if (["power", "power_tuple"].includes(value)) return "power";
  if (["set", "set_equal"].includes(value)) return "set_input";
  if (["ordered_pair_list", "ordered_pair_list_equal"].includes(value)) return "ordered_pair_list_input";
  if (["expression", "expression_equivalent", "raw"].includes(value)) return "expression_raw";
  return "number";
}

function resetAnswer(setters: {
  setText: (value: string) => void;
  setFraction: (value: FractionWidgetState) => void;
  setCoordinate: (value: { x: string; y: string }) => void;
  setPower: (value: { base: string; exp: string }) => void;
  setExpressionParts: (value: { first: string; second: string }) => void;
}) {
  setters.setText("");
  setters.setFraction({ num: "", den: "" });
  setters.setCoordinate({ x: "", y: "" });
  setters.setPower({ base: "", exp: "" });
  setters.setExpressionParts({ first: "", second: "" });
}

function expressionTemplateForItem(item?: AssessmentV2Item | null): ExpressionTemplate {
  const family = item?.item_family ?? "";
  if (["factor_common_x_from_quadratic", "convert_one_over_x_to_common_denominator", "difference_of_squares_factor_missing"].includes(family)) {
    return "x_plus_number";
  }
  if (family === "simplify_cancel_common_factor") return "rational_fraction";
  if (family === "rational_expression_cross_product_component") return "two_factor_product";
  // write_interest_expression: removed from template — too scaffolded, use AlgebraExpressionWidget
  if (family === "common_denominator_x_and_x_plus_a") return "x_times_x_plus_number";
  if (family === "expand_coefficient_parentheses") return "linear_expression";
  if (family === "represent_remaining_amount_total_minus_x") return "number_minus_x";
  return null;
}

function amountFromQuestion(item?: AssessmentV2Item | null) {
  const match = item?.question?.match(/khoản\s+(.+?)\s+triệu/i);
  return match?.[1]?.replace(/\s+/g, "") || "x";
}

function serializeExpressionTemplate(template: ExpressionTemplate, parts: { first: string; second: string }, item?: AssessmentV2Item | null) {
  if (template === "x_plus_number") return `x+${parts.first}`;
  if (template === "x_times_x_plus_number") return `x*(x+${parts.first})`;
  if (template === "linear_expression") {
    const second = parts.second.trim();
    return `${parts.first}*x${second.startsWith("-") ? second : `+${second}`}`;
  }
  if (template === "number_minus_x") return `${parts.first}-x`;
  if (template === "rational_fraction") return `(${parts.first})/(${parts.second})`;
  if (template === "two_factor_product") return `(${parts.first})*(${parts.second})`;
  if (template === "percent_times_amount") return `(${parts.first}/100)*(${amountFromQuestion(item)})`;
  return "";
}

function ExpressionTemplateInput({
  template,
  parts,
  onChange,
  onSubmit,
  item,
}: {
  template: Exclude<ExpressionTemplate, null>;
  parts: { first: string; second: string };
  onChange: (value: { first: string; second: string }) => void;
  onSubmit: () => void;
  item?: AssessmentV2Item | null;
}) {
  const sanitizeNumber = (value: string) => value.replace(/[^0-9.,-]/g, "").replace(",", ".");
  const sanitizeMath = (value: string) => value.replace(/[^0-9a-zA-Z+\-*/^().]/g, "");

  // 100% inline styles — styled-jsx from parent does not scope into child components
  const S = {
    row: { display: "flex", flexWrap: "nowrap", alignItems: "center", gap: 8, fontSize: 22, fontWeight: 700, color: "#111827" } as React.CSSProperties,
    blankSpan: (wide = false) => ({ display: "inline-flex", alignItems: "center", borderBottom: "2.5px solid #3d72f8", padding: "2px 4px", minWidth: wide ? 90 : 52 } as React.CSSProperties),
    inputEl: (wide = false) => ({ border: "none", outline: "none", background: "transparent", fontSize: 20, fontWeight: 700, color: "#1d4ed8", width: wide ? 90 : 52, textAlign: "center" as const, fontFamily: "inherit" } as React.CSSProperties),
    label: { fontSize: 10, fontWeight: 800, color: "#94a3b8", textTransform: "uppercase" as const, letterSpacing: 0.5, fontFamily: "ui-monospace, monospace", marginBottom: 2 } as React.CSSProperties,
    hint: { fontSize: 11, color: "#94a3b8", margin: "10px 0 0", textAlign: "center" as const } as React.CSSProperties,
    fractionLine: { width: 90, height: 2.5, background: "#111827", borderRadius: 2, margin: "2px 0" } as React.CSSProperties,
    colBlank: { display: "flex", flexDirection: "column" as const, alignItems: "center", gap: 3 } as React.CSSProperties,
  };

  const blank = (key: "first" | "second", placeholder = "?", mode: "number" | "math" = "number", label?: string) => {
    const wide = mode === "math";
    const inputNode = (
      <span style={S.blankSpan(wide)}>
        <input
          style={S.inputEl(wide)}
          value={parts[key]}
          inputMode={mode === "number" ? "decimal" : "text"}
          onChange={(e) => onChange({ ...parts, [key]: mode === "number" ? sanitizeNumber(e.target.value) : sanitizeMath(e.target.value) })}
          onKeyDown={(e) => { if (e.key === "Enter") onSubmit(); }}
          placeholder={label ? "" : placeholder}
          autoFocus={key === "first"}
          aria-label={label ?? "Ô điền đáp án"}
        />
      </span>
    );
    if (!label) return inputNode;
    return (
      <div style={S.colBlank}>
        <span style={S.label}>{label}</span>
        {inputNode}
      </div>
    );
  };

  if (template === "x_times_x_plus_number") {
    return <div style={S.row}><span>x(x&nbsp;+</span>{blank("first")}<span>)</span></div>;
  }
  if (template === "x_plus_number") {
    return <div style={S.row}><span>x&nbsp;+</span>{blank("first")}</div>;
  }
  if (template === "linear_expression") {
    return (
      <div style={S.row}>
        {blank("first")}
        <span style={{ fontSize: 18, fontWeight: 700, color: "#475569" }}>x</span>
        {blank("second", "±?")}
      </div>
    );
  }
  if (template === "number_minus_x") {
    return <div style={S.row}>{blank("first")}<span>&#8722;&nbsp;x</span></div>;
  }
  if (template === "rational_fraction") {
    return (
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8 }}>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 2 }} aria-label="Nhập phân thức">
          {blank("first", "tử", "math", "Tử số")}
          <div style={S.fractionLine} />
          {blank("second", "mẫu", "math", "Mẫu số")}
        </div>
        <p style={S.hint}>Nhập phân thức đã rút gọn. Ký hiệu nhân dùng dấu *.</p>
      </div>
    );
  }
  if (template === "two_factor_product") {
    return (
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8 }}>
        <div style={{ ...S.row, gap: 16 }}>
          {blank("first", "thừa số", "math", "Thừa số 1")}
          <span style={{ fontSize: 22, color: "#64748b" }}>·</span>
          {blank("second", "thừa số", "math", "Thừa số 2")}
        </div>
        <p style={S.hint}>Chỉ nhập tích được hỏi, không cần viết dấu bằng.</p>
      </div>
    );
  }
  if (template === "percent_times_amount") {
    return (
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8 }}>
        <span style={S.label}>Tỷ lệ phần trăm</span>
        <div style={{ ...S.row, gap: 10 }}>
          <span>{amountFromQuestion(item)}&nbsp;×</span>
          <span style={S.blankSpan()}>
            <input style={S.inputEl()} value={parts.first} inputMode="decimal"
              onChange={(e) => onChange({ ...parts, first: sanitizeNumber(e.target.value) })}
              onKeyDown={(e) => { if (e.key === "Enter") onSubmit(); }}
              placeholder="?" autoFocus aria-label="Nhập số phần trăm" />
          </span>
          <span>%</span>
        </div>
        <p style={S.hint}>Nhập số phần trăm, hệ thống sẽ tự đổi sang dạng thập phân khi chấm.</p>
      </div>
    );
  }
  return <div style={S.row}>{blank("first")}</div>;
}




export default function Grade8PathAssessmentPage() {
  const initialized = useRef(false);
  const [phase, setPhase] = useState<Phase>("loading");
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [item, setItem] = useState<AssessmentV2Item | null>(null);
  const [questionNumber, setQuestionNumber] = useState(1);
  const [maxQuestions, setMaxQuestions] = useState(MAX_QUESTIONS);
  const [result, setResult] = useState<AssessmentV2Result | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [text, setText] = useState("");
  const [fraction, setFraction] = useState<FractionWidgetState>({ num: "", den: "" });
  const [coordinate, setCoordinate] = useState({ x: "", y: "" });
  const [power, setPower] = useState({ base: "", exp: "" });
  const [expressionParts, setExpressionParts] = useState({ first: "", second: "" });
  const [setInput, setSetInput] = useState<SetWidgetState>({ val: "" });
  const [twoPoint, setTwoPoint] = useState<TwoPointWidgetState>({ x1: "", y1: "", x2: "", y2: "" });

  const widget = normalizeWidget(item?.answer_widget, item?.checker_type);
  const expressionTemplate = widget === "expression_raw" ? expressionTemplateForItem(item) : null;

  const isReady = useMemo(() => {
    if (widget === "fraction") return isFractionReady(fraction);
    if (widget === "coordinate") return coordinate.x.trim() !== "" && coordinate.y.trim() !== "";
    if (widget === "power") return power.base.trim() !== "" && power.exp.trim() !== "";
    if (widget === "set_input") return setInput.val.trim().length > 0;
    if (widget === "ordered_pair_list_input") return isTwoPointReady(twoPoint);
    if (expressionTemplate === "linear_expression") return expressionParts.first.trim() !== "" && expressionParts.second.trim() !== "";
    if (expressionTemplate === "rational_fraction" || expressionTemplate === "two_factor_product") return expressionParts.first.trim() !== "" && expressionParts.second.trim() !== "";
    if (expressionTemplate) return expressionParts.first.trim() !== "";
    return text.trim().length > 0;
  }, [coordinate, expressionParts, expressionTemplate, fraction, twoPoint, power, setInput.val, text, widget]);

  useEffect(() => {
    if (initialized.current) return;
    initialized.current = true;
    createAssessmentV2Session({
      max_questions: MAX_QUESTIONS,
      assessment_scope: "grade8_exam_path",
      student_label: "Bài kiểm tra gốc đại số lớp 8",
    })
      .then((res) => {
        setSessionId(res.session_id);
        setMaxQuestions(res.max_questions);
        setItem(res.item ?? null);
        setQuestionNumber(res.question_number ?? 1);
        setPhase("question");
      })
      .catch((err) => {
        setError((err as Error).message);
        setPhase("question");
      });
  }, []);

  const serializeAnswer = () => {
    if (widget === "fraction") return serializeFraction(fraction);
    if (widget === "coordinate") return `(${coordinate.x},${coordinate.y})`;
    if (widget === "power") return `${power.base}^${power.exp}`;
    if (widget === "set_input") return `{${setInput.val}}`;
    if (widget === "ordered_pair_list_input") return serializeTwoPoint(twoPoint);
    if (expressionTemplate) return serializeExpressionTemplate(expressionTemplate, expressionParts, item);
    return text;
  };

  const handleResponse = async (responseType: "answer" | "unknown") => {
    if (!sessionId || !item || submitting) return;
    setSubmitting(true);
    setError(null);
    try {
      const response = await submitAssessmentV2Response(sessionId, {
        item_id: item.item_id,
        answer: responseType === "unknown" ? "" : serializeAnswer(),
        response_type: responseType,
      });
      if (response.status === "completed") {
        setResult(response as AssessmentV2Result);
        setPhase("completed");
        return;
      }
      const next = response as AssessmentV2SessionResponse;
      setPhase("adapting");
      setTimeout(() => {
        setItem(next.item ?? null);
        setQuestionNumber(next.question_number ?? questionNumber + 1);
        resetAnswer({ setText, setFraction, setCoordinate, setPower, setExpressionParts });
        setSetInput({ val: "" });
        setTwoPoint({ x1: "", y1: "", x2: "", y2: "" });
        setPhase("question");
      }, 500);
    } catch (err) {
      setError(friendlyError((err as Error).message));
      setPhase("question");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <main className="grade8-shell">
      <aside className="side">
        <div className="brand-row">
          <WizzdomLogo />
          <span>Kiểm tra đầu vào</span>
        </div>
        <div className="student-intro">
          <p className="eyebrow">Đại số lớp 8</p>
          <h1>Làm thật như con biết</h1>
          <p>
            Bài này giúp thầy cô biết con đang vững phần nào và đang cần học lại từ đâu.
            Không tính điểm thi, nên con không cần đoán.
          </p>
        </div>
        <div className="guidance-list">
          <div className="guidance-card primary">
            <strong>{MAX_QUESTIONS}</strong>
            <span>câu tối đa, có thể kết thúc sớm nếu đủ dữ liệu</span>
          </div>
          <div className="guidance-card">
            <strong>Tập trung làm từng câu</strong>
            <span>Con hãy nhập đáp án như khi làm nháp trên giấy.</span>
          </div>
          <div className="guidance-card">
            <strong>Đừng ngại chọn “Em chưa biết”</strong>
            <span>Nút này giúp kết quả sát với thực tế hơn là đoán mò.</span>
          </div>
        </div>
      </aside>

      <section className="content">
        {phase === "loading" && (
          <div className="card center">
            <Loader2 className="spin" size={30} />
            <h2>Đang chuẩn bị bài kiểm tra</h2>
            <p>Hệ thống đang tải bản đồ kiến thức và ngân hàng câu hỏi.</p>
          </div>
        )}

        {phase === "adapting" && (
          <div className="card center">
            <Loader2 className="spin" size={30} />
            <h2>Đang chọn câu hỏi tiếp theo</h2>
            <p>Hệ thống đang cập nhật vùng kiến thức cần kiểm tra dựa trên câu trả lời vừa rồi.</p>
          </div>
        )}

        {phase === "question" && (
          <div className="card">
            <div className="top-row">
              <span>Câu {questionNumber} / tối đa {maxQuestions}</span>
            </div>
            <div className="progress">
              <div style={{ width: `${Math.min(100, (questionNumber / maxQuestions) * 100)}%` }} />
            </div>

            {error && <div className="error">{error}</div>}

            {item ? (
              <>
                <p className="kc">{item.kc_code} · {item.kc_name}</p>
                <div className="meta">
                  {item.target_exam_path && <span>{labelFor(PATH_LABELS, item.target_exam_path)}</span>}
                  {item.item_role && <span>{labelFor(ROLE_LABELS, item.item_role)}</span>}
                  {item.item_family && <span>{familyLabel(item.item_family)}</span>}
                </div>
                <h2>{renderMath(item.question)}</h2>

                <div className="answer-box">
                  <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8 }}>
                    <p style={{ margin: 0 }}>Nhập đáp án của em</p>
                    <span style={{
                      fontSize: 11, fontWeight: 800, padding: "3px 10px",
                      borderRadius: 999, border: "1px solid #bfdbfe",
                      background: "#eff6ff", color: "#2563eb",
                      fontFamily: "ui-monospace, monospace", letterSpacing: 0.3,
                    }}>
                      {widget === "fraction" ? "PHÂN SỐ"
                        : widget === "decimal" ? "SỐ THẬP PHÂN"
                        : widget === "coordinate" ? "TOẠ ĐỘ  (x ; y)"
                        : widget === "power" ? "LŨY THỪA  aⁿ"
                        : widget === "set_input" ? "TẬP HỢP  { ... }"
                        : widget === "ordered_pair_list_input" ? "HAI ĐIỂM  (x₁;y₁) · (x₂;y₂)"
                        : expressionTemplate ? "BIỂU THỨC CÓ CẤU TRÚC"
                        : "BIỂU THỨC ĐẠI SỐ"}
                    </span>
                  </div>
                  {widget === "expression_raw" && expressionTemplate ? (
                    // Structured template (e.g. x + [?], [coeff]x + [const], etc.)
                    <ExpressionTemplateInput
                      template={expressionTemplate}
                      parts={expressionParts}
                      onChange={setExpressionParts}
                      onSubmit={() => isReady && handleResponse("answer")}
                      item={item}
                    />
                  ) : widget === "expression_raw" ? (
                    // Smart expression input with family-aware token chips
                    <AlgebraExpressionWidget
                      value={text}
                      onChange={setText}
                      onSubmit={() => isReady && handleResponse("answer")}
                      disabled={submitting}
                      item={item}
                    />
                  ) : widget === "set_input" ? (
                    <SetWidget
                      val={setInput.val}
                      onChange={(v) => setSetInput({ val: v })}
                      onSubmit={() => isReady && handleResponse("answer")}
                      disabled={submitting}
                    />
                  ) : widget === "ordered_pair_list_input" ? (
                    <TwoPointWidget
                      state={twoPoint}
                      onChange={setTwoPoint}
                      onSubmit={() => isReady && handleResponse("answer")}
                      disabled={submitting}
                    />
                  ) : widget === "fraction" ? (
                    <FractionWidget
                      num={fraction.num}
                      den={fraction.den}
                      onNumChange={(value) => setFraction((prev) => ({ ...prev, num: value }))}
                      onDenChange={(value) => setFraction((prev) => ({ ...prev, den: value }))}
                      onSubmit={() => isReady && handleResponse("answer")}
                    />
                  ) : (
                    <MathAnswerWidget
                      widgetType={widget as WidgetType}
                      textState={text}
                      onTextChange={setText}
                      coordinateState={coordinate}
                      onCoordinateChange={setCoordinate}
                      powerState={power}
                      onPowerChange={setPower}
                      onSubmit={() => isReady && handleResponse("answer")}
                      disabled={submitting}
                    />
                  )}
                </div>

                <div className="actions">
                  <button disabled={!isReady || submitting} onClick={() => handleResponse("answer")}>
                    Nộp đáp án <ArrowRight size={18} />
                  </button>
                  <button className="secondary" disabled={submitting} onClick={() => handleResponse("unknown")}>
                    Em chưa biết
                  </button>
                </div>
              </>
            ) : (
              <div className="empty">Chưa có câu hỏi khả dụng.</div>
            )}
          </div>
        )}

        {phase === "completed" && result && (
          <StudentReport result={result} />
        )}
      </section>
      <style jsx>{`
        .grade8-shell {
          min-height: 100vh;
          display: grid;
          grid-template-columns: 340px minmax(0, 1fr);
          background:
            radial-gradient(circle at 12% 14%, rgba(61,114,248,0.16), transparent 26%),
            radial-gradient(circle at top right, rgba(16,185,129,0.12), transparent 30%),
            linear-gradient(135deg, #f8fbff 0%, #eef4ff 100%);
          color: #111827;
        }
        .side {
          min-height: 100vh;
          padding: 28px 24px;
          background: rgba(255, 255, 255, 0.72);
          color: #111827;
          display: flex;
          flex-direction: column;
          gap: 22px;
          border-right: 1px solid rgba(15, 23, 42, 0.08);
          box-shadow: 18px 0 60px rgba(15, 23, 42, 0.05);
          backdrop-filter: blur(18px);
        }
        .brand-row {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
        }
        .brand-row span {
          border-radius: 999px;
          padding: 7px 10px;
          background: #eef2ff;
          color: #3d72f8;
          font-size: 12px;
          font-weight: 900;
          white-space: nowrap;
        }
        .student-intro {
          display: grid;
          gap: 12px;
        }
        .eyebrow {
          font-size: 11px;
          font-weight: 800;
          letter-spacing: 0.08em;
          text-transform: uppercase;
          color: #3d72f8;
          margin: 0;
        }
        .kc {
          font-size: 11px;
          color: #6b7280;
          margin: 0 0 6px;
          font-weight: 600;
        }
        h1 {
          font-size: 22px;
          font-weight: 900;
          margin: 0;
          line-height: 1.25;
          color: #111827;
        }
        .side p {
          font-size: 14px;
          line-height: 1.55;
          color: #4b5563;
          margin: 0;
        }
        .guidance-list {
          display: flex;
          flex-direction: column;
          gap: 10px;
          margin-top: 12px;
        }
        .guidance-card {
          border-radius: 14px;
          padding: 14px 16px;
          background: #f8fafc;
          border: 1px solid #e5e7eb;
          font-size: 13px;
          display: flex;
          flex-direction: column;
          gap: 4px;
          color: #374151;
        }
        .guidance-card.primary {
          background: #eff6ff;
          border-color: #bfdbfe;
        }
        .guidance-card strong { font-size: 22px; font-weight: 900; color: #111827; }
        .guidance-card.primary strong { color: #1d4ed8; }
        .content {
          padding: 40px 48px;
          display: flex;
          flex-direction: column;
          align-items: stretch;
          gap: 24px;
          overflow-y: auto;
        }
        .card {
          background: #ffffff;
          border-radius: 24px;
          padding: 32px;
          border: 1px solid rgba(15, 23, 42, 0.08);
          box-shadow: 0 4px 24px rgba(15, 23, 42, 0.06);
        }
        .card.center {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 14px;
          text-align: center;
          padding: 60px 32px;
        }
        .card h2 {
          font-size: 20px;
          font-weight: 800;
          margin: 0;
          color: #111827;
        }
        .card p {
          font-size: 14px;
          color: #6b7280;
          margin: 0;
          line-height: 1.55;
        }
        .spin {
          animation: spin 1s linear infinite;
          color: #3d72f8;
        }
        @keyframes spin { to { transform: rotate(360deg); } }
        .top-row {
          display: flex;
          justify-content: space-between;
          align-items: center;
          font-size: 12px;
          color: #6b7280;
          font-weight: 600;
          margin-bottom: 8px;
        }
        .progress {
          height: 5px;
          background: #e5e7eb;
          border-radius: 999px;
          overflow: hidden;
          margin-bottom: 20px;
        }
        .progress div {
          height: 100%;
          background: linear-gradient(90deg, #3d72f8, #10b981);
          border-radius: 999px;
          transition: width 0.4s ease;
        }
        .meta {
          display: flex;
          gap: 8px;
          flex-wrap: wrap;
          margin-bottom: 10px;
        }
        .meta span {
          font-size: 11px;
          font-weight: 700;
          padding: 3px 10px;
          border-radius: 999px;
          background: #f1f5f9;
          color: #64748b;
        }
        h2 {
          font-size: 18px;
          font-weight: 700;
          line-height: 1.5;
          margin: 0 0 24px;
          color: #111827;
        }
        .answer-box {
          background: #f8fafc;
          border-radius: 16px;
          padding: 24px;
          display: flex;
          flex-direction: column;
          gap: 18px;
          align-items: center;
          border: 1px solid #e5e7eb;
        }
        .answer-box p { font-size: 13px; font-weight: 600; color: #6b7280; }
        .actions {
          display: flex;
          gap: 12px;
          margin-top: 24px;
        }
        button {
          flex: 1;
          padding: 14px 20px;
          border-radius: 999px;
          font-size: 15px;
          font-weight: 700;
          cursor: pointer;
          border: none;
          background: #3d72f8;
          color: #fff;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          transition: all 0.18s;
        }
        button:hover { background: #2563eb; }
        button:disabled { opacity: 0.35; cursor: not-allowed; }
        button.secondary {
          background: transparent;
          color: #6b7280;
          border: 2px solid #e5e7eb;
          flex: 0 0 auto;
          padding: 14px 20px;
        }
        button.secondary:hover { background: #f8fafc; border-color: #d1d5db; }
        .error {
          background: #fef2f2;
          border: 1px solid #fecaca;
          color: #dc2626;
          border-radius: 10px;
          padding: 10px 16px;
          font-size: 13px;
          margin-bottom: 12px;
        }
        .empty {
          text-align: center;
          color: #9ca3af;
          font-size: 14px;
          padding: 40px;
        }
        .complete-icon { color: #10b981; margin-bottom: 8px; }
        .muted { color: #6b7280; font-size: 14px; line-height: 1.55; margin: 8px 0 24px; }
        .metrics {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 16px;
          margin-bottom: 24px;
        }
        .metrics div { border-radius: 16px; background: #f8fafc; padding: 18px; }
        .metrics strong { display: block; font-size: 32px; }
        .metrics span { color: #64748b; font-weight: 800; }
        .summary-grid { display: grid; grid-template-columns: 1fr; gap: 20px; }
        .summary-grid section { border-radius: 18px; border: 1px solid #e5e7eb; padding: 18px; }
        .summary-grid p { line-height: 1.45; color: #334155; }
        /* Template widgets */
        .template-expression {
          display: flex;
          align-items: flex-end;
          gap: 6px;
          font-size: 20px;
          font-weight: 700;
          color: #111827;
          flex-wrap: wrap;
        }
        .template-blank {
          display: inline-flex;
          align-items: center;
          border-bottom: 2.5px solid #3d72f8;
          padding: 2px 0;
          min-width: 44px;
        }
        .template-blank.wide { min-width: 80px; }
        .template-input {
          border: none;
          outline: none;
          background: transparent;
          font-size: 18px;
          font-weight: 700;
          color: #1d4ed8;
          width: 100%;
          min-width: 44px;
          text-align: center;
        }
        .blank-label {
          position: absolute;
          top: 6px;
          left: 10px;
          font-size: 9px;
          font-weight: 800;
          color: #94a3b8;
          text-transform: uppercase;
          pointer-events: none;
          white-space: nowrap;
        }
        .template-hint {
          font-size: 11px;
          color: #94a3b8;
          margin: 10px 0 0;
          text-align: center;
        }
        .structured-answer {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 8px;
        }
        .fraction-template {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 4px;
        }
        .fraction-line {
          width: 80px;
          height: 2.5px;
          background: #111827;
          border-radius: 2px;
        }
        .product-template {
          align-items: flex-end;
          gap: 12px;
        }
        .percent-template {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 8px;
        }
        .percent-label {
          font-size: 10px;
          font-weight: 800;
          color: #94a3b8;
          text-transform: uppercase;
        }
        .percent-expression {
          display: flex;
          align-items: center;
          gap: 8px;
          font-size: 20px;
          font-weight: 700;
        }
        .percent-blank {
          border-bottom: 2.5px solid #3d72f8;
          min-width: 60px;
        }
        .percent-input {
          border: none;
          outline: none;
          background: transparent;
          font-size: 18px;
          font-weight: 700;
          color: #1d4ed8;
          width: 60px;
          text-align: center;
        }
        @media (max-width: 900px) {
          .grade8-shell { grid-template-columns: 1fr; }
          .side { min-height: auto; }
          .content { padding: 20px; }
          .metrics, .summary-grid { grid-template-columns: 1fr; }
          .actions { flex-direction: column; }
        }
      `}</style>
    </main>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// StudentReport — Full student-facing result screen
// Benchmark: assessment-v2/algebra MapStep + OutcomeStep design patterns
// ─────────────────────────────────────────────────────────────────────────────
function SkillBubble({ label, state, size = 52 }: { label: string; state: "strong" | "review" | "developing" | "inferred"; size?: number }) {
  const colors: Record<string, { bg: string; border: string; text: string; glow?: string }> = {
    strong:     { bg: B.greenLight,  border: "rgba(16,185,129,0.4)", text: B.green },
    developing: { bg: B.blueLight,   border: "rgba(61,114,248,0.35)", text: B.blue },
    review:     { bg: B.orangeLight, border: "rgba(245,158,11,0.4)",  text: B.orange },
    inferred:   { bg: "#F8FAFC",     border: B.grayBorder,            text: B.textLight },
  };
  const c = colors[state];
  return (
    <div title={label} style={{
      width: size, height: size, borderRadius: "50%",
      background: c.bg,
      border: `2px solid ${c.border}`,
      display: "flex", alignItems: "center", justifyContent: "center",
      boxShadow: state === "strong" ? `0 0 10px rgba(16,185,129,0.25)` : state === "developing" ? `0 0 10px rgba(61,114,248,0.2)` : undefined,
      cursor: "default",
    }}>
      <span style={{ fontSize: Math.max(8, size * 0.15), fontWeight: 700, color: c.text, fontFamily: NUNITO, textAlign: "center", padding: "0 4px", lineHeight: 1.1, maxWidth: size - 8, overflow: "hidden", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical" }}>
        {label.split(" ").slice(0, 2).join(" ")}
      </span>
    </div>
  );
}

function KnowledgeMapPanel({ result }: { result: AssessmentV2Result }) {
  const vm = result.summary.value_metrics;
  const strong = result.summary.strong_areas.slice(0, 4);
  const review = result.summary.skills_to_review.slice(0, 3);
  const affected = result.summary.possibly_affected.slice(0, 3);
  const inferred = result.summary.not_enough_evidence?.slice(0, 4) ?? [];
  const target = result.summary.ready_to_learn?.[0] ?? result.summary.skills_to_review?.[0];

  const rows: Array<{ label: string; state: "strong" | "review" | "developing" | "inferred"; size?: number }> = [
    // Top: target (larger, glowing blue)
    ...(target ? [{ label: target.name ?? "", state: "developing" as const, size: 72 }] : []),
    ...strong.map((r) => ({ label: r.name ?? "", state: "strong" as const, size: 52 })),
    ...review.map((r) => ({ label: r.name ?? "", state: "review" as const, size: 52 })),
    ...affected.map((r) => ({ label: r.name ?? "", state: "developing" as const, size: 46 })),
    ...inferred.map((r) => ({ label: r.name ?? "", state: "inferred" as const, size: 40 })),
  ];

  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 16, padding: "24px 16px", height: "100%" }}>
      {/* Target badge */}
      {target && (
        <div style={{ display: "flex", alignItems: "center", gap: 6, padding: "6px 14px", borderRadius: 9999, backgroundColor: B.blueLight, border: `1.5px solid rgba(61,114,248,0.3)`, boxShadow: "0 0 16px rgba(61,114,248,0.18)" }}>
          <Zap size={12} style={{ color: B.blue }} />
          <span style={{ fontSize: 11, fontWeight: 800, color: B.blue, fontFamily: NUNITO }}>Mục tiêu tiếp theo</span>
        </div>
      )}

      {/* Bubble grid */}
      <div style={{ flex: 1, display: "flex", flexWrap: "wrap", gap: 10, alignContent: "center", justifyContent: "center", maxWidth: 340 }}>
        {rows.map((r, i) => (
          <motion.div key={i} initial={{ opacity: 0, scale: 0.7 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: i * 0.04, duration: 0.35, ease: "backOut" }}>
            <SkillBubble label={r.label} state={r.state} size={r.size} />
          </motion.div>
        ))}
      </div>

      {/* Legend */}
      <div style={{ display: "flex", flexWrap: "wrap", gap: 10, justifyContent: "center" }}>
        {[
          { color: B.green,     label: "Đã vững" },
          { color: B.blue,      label: "Đang phát triển" },
          { color: B.orange,    label: "Cần ôn" },
          { color: B.textLight, label: "Suy luận" },
        ].map(({ color, label }) => (
          <div key={label} style={{ display: "flex", alignItems: "center", gap: 5 }}>
            <div style={{ width: 8, height: 8, borderRadius: "50%", backgroundColor: color }} />
            <span style={{ fontSize: 11, color: B.textMuted, fontFamily: INTER }}>{label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function StudentReport({ result }: { result: AssessmentV2Result }) {
  const [show, setShow] = useState(false);
  useEffect(() => { const t = setTimeout(() => setShow(true), 200); return () => clearTimeout(t); }, []);

  const vm = result.summary.value_metrics;
  const strongAreas  = result.summary.strong_areas.slice(0, 4);
  const toReview     = (result.summary.skills_to_review.length ? result.summary.skills_to_review : result.summary.possibly_affected).slice(0, 4);
  const target       = result.summary.ready_to_learn?.[0] ?? result.summary.skills_to_review?.[0];

  const UNLOCK_REASONS: Record<string, string> = {
    default: "Nền tảng để tiến lên các kỹ năng đại số nâng cao",
  };

  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.5 }}
      style={{ display: "grid", gridTemplateColumns: "minmax(0, 2fr) minmax(0, 3fr)", gap: 0, minHeight: "calc(100vh - 64px)" }}
    >
      {/* LEFT: Knowledge Map */}
      <div style={{ background: "#F5F7FF", borderRight: `1px solid ${B.grayBorder}`, padding: 24 }}>
        <KnowledgeMapPanel result={result} />
      </div>

      {/* RIGHT: Report Panel */}
      <motion.div
        initial={{ opacity: 0, x: 20 }} animate={show ? { opacity: 1, x: 0 } : {}}
        transition={{ duration: 0.5, ease: "easeOut" }}
        style={{ padding: "32px 36px", display: "flex", flexDirection: "column", gap: 24, overflowY: "auto", maxHeight: "calc(100vh - 64px)" }}
      >
        {/* Eyebrow */}
        <p style={{ margin: 0, fontFamily: MONO, fontSize: 11, fontWeight: 700, color: B.blue, textTransform: "uppercase", letterSpacing: 1 }}>
          Hệ thống đã phân tích xong
        </p>

        {/* Hero headline */}
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <h2 style={{ margin: 0, fontFamily: NUNITO, fontSize: 28, fontWeight: 900, color: B.text, lineHeight: 1.2 }}>
            Em có nền tảng tốt hơn em nghĩ 💡
          </h2>
          <p style={{ margin: 0, fontFamily: INTER, fontSize: 15, color: B.textMid, lineHeight: 1.55 }}>
            Dưới đây là bức tranh kiến thức của em sau {vm.questions_asked} câu hỏi. Hệ thống đã hiểu em — không chỉ những gì em biết, mà còn những gì em sắp biết được.
          </p>
        </div>

        {/* AI Insight card (orange-tinted, like MapStep diagnosis card) */}
        <motion.div
          initial={{ opacity: 0, y: 8 }} animate={show ? { opacity: 1, y: 0 } : {}} transition={{ delay: 0.2, duration: 0.4 }}
          style={{ borderRadius: 16, padding: 18, border: "1px solid rgba(245,158,11,0.25)", backgroundColor: B.orangeLight }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
            <Zap size={13} style={{ color: B.orange }} />
            <span style={{ fontFamily: MONO, fontSize: 10, fontWeight: 900, color: B.orange, textTransform: "uppercase" }}>Nhận xét của hệ thống</span>
          </div>
          <p style={{ margin: 0, fontFamily: INTER, fontSize: 14, lineHeight: 1.6, color: B.textMid }}>
            {strongAreas.length > 0
              ? `Em nắm vững ${strongAreas[0]?.name ?? "các kỹ năng cơ bản"} và nhiều kiến thức nền quan trọng.`
              : "Em đang xây dựng nền tảng toán học tốt."}
            {" "}{target
              ? `Vùng cần mở khóa tiếp theo là "${target.name}" — đây chính là chìa khóa để em tiến xa hơn trong đại số lớp 8.`
              : "Tiếp tục học đúng thứ sẽ unlock khả năng của em rất nhiều."}
          </p>
        </motion.div>

        {/* Stats row */}
        <motion.div
          initial={{ opacity: 0 }} animate={show ? { opacity: 1 } : {}} transition={{ delay: 0.3, duration: 0.4 }}
          style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12 }}
        >
          {[
            { value: String(vm.questions_asked), label: "câu em đã làm" },
            { value: String(vm.skills_directly_tested), label: "kỹ năng quan sát trực tiếp" },
            { value: String(vm.skills_inferred), label: "kỹ năng hệ thống suy luận" },
          ].map(({ value, label }) => (
            <div key={label} style={{ borderRadius: 14, padding: "14px 16px", background: B.white, border: `1px solid ${B.grayBorder}`, boxShadow: "0 1px 3px rgba(0,0,0,0.05)" }}>
              <span style={{ display: "block", fontFamily: NUNITO, fontSize: 30, fontWeight: 900, color: B.text, lineHeight: 1 }}>{value}</span>
              <span style={{ display: "block", fontFamily: INTER, fontSize: 12, color: B.textMuted, marginTop: 4, lineHeight: 1.3 }}>{label}</span>
            </div>
          ))}
        </motion.div>

        {/* Skill groups — 2 columns */}
        <motion.div
          initial={{ opacity: 0, y: 8 }} animate={show ? { opacity: 1, y: 0 } : {}} transition={{ delay: 0.4, duration: 0.4 }}
          style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}
        >
          {/* Strong skills */}
          <div style={{ borderRadius: 16, padding: 18, background: B.white, border: `1px solid ${B.grayBorder}`, boxShadow: "0 1px 3px rgba(0,0,0,0.05)" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 14 }}>
              <TrendingUp size={14} style={{ color: B.green }} />
              <span style={{ fontFamily: NUNITO, fontSize: 13, fontWeight: 800, color: B.green }}>Em đang vững 💪</span>
            </div>
            {strongAreas.length > 0 ? (
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {strongAreas.map((row) => (
                  <div key={row.kc_id} style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 12px", borderRadius: 10, backgroundColor: B.greenLight, border: "1px solid rgba(16,185,129,0.2)" }}>
                    <div style={{ width: 6, height: 6, borderRadius: "50%", backgroundColor: B.green, flexShrink: 0 }} />
                    <span style={{ fontFamily: INTER, fontSize: 13, fontWeight: 600, color: B.textMid, lineHeight: 1.3 }}>{row.name}</span>
                  </div>
                ))}
              </div>
            ) : (
              <p style={{ margin: 0, fontFamily: INTER, fontSize: 13, color: B.textMuted }}>Hệ thống chưa xác nhận được vùng vững — thử làm thêm câu hỏi để rõ hơn.</p>
            )}
          </div>

          {/* Skills to unlock */}
          <div style={{ borderRadius: 16, padding: 18, background: B.white, border: `1px solid ${B.grayBorder}`, boxShadow: "0 1px 3px rgba(0,0,0,0.05)" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 14 }}>
              <Lock size={13} style={{ color: B.blue }} />
              <span style={{ fontFamily: NUNITO, fontSize: 13, fontWeight: 800, color: B.blue }}>Cần mở khóa 🔓</span>
            </div>
            {toReview.length > 0 ? (
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {toReview.map((row, i) => (
                  <div key={row.kc_id} style={{ padding: "10px 12px", borderRadius: 10, background: i === 0 ? B.blueLight : "#FAFBFF", border: `1px solid ${i === 0 ? "rgba(61,114,248,0.25)" : B.grayBorder}` }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                      <Lock size={10} style={{ color: i === 0 ? B.blue : B.textLight, flexShrink: 0 }} />
                      <span style={{ fontFamily: NUNITO, fontSize: 13, fontWeight: 700, color: i === 0 ? B.blue : B.textMid }}>{row.name}</span>
                    </div>
                    <p style={{ margin: "4px 0 0 16px", fontFamily: INTER, fontSize: 11, color: B.textMuted, lineHeight: 1.4 }}>
                      {UNLOCK_REASONS[row.code ?? ""] ?? UNLOCK_REASONS.default}
                    </p>
                  </div>
                ))}
              </div>
            ) : (
              <p style={{ margin: 0, fontFamily: INTER, fontSize: 13, color: B.textMuted }}>Em đã làm rất tốt! Tiếp tục học để đi sâu hơn.</p>
            )}
          </div>
        </motion.div>

        {/* Encouragement strip */}
        <motion.div
          initial={{ opacity: 0 }} animate={show ? { opacity: 1 } : {}} transition={{ delay: 0.5, duration: 0.4 }}
          style={{ borderRadius: 16, padding: 16, background: B.blueLight, border: `1px solid rgba(61,114,248,0.18)`, display: "flex", alignItems: "center", gap: 14 }}
        >
          <Star size={20} style={{ color: B.blue, flexShrink: 0 }} />
          <p style={{ margin: 0, fontFamily: INTER, fontSize: 14, lineHeight: 1.55, color: B.textMid }}>
            <strong style={{ color: B.blue, fontFamily: NUNITO }}>Học đúng thứ là điều quan trọng nhất.</strong>
            {" "}Hệ thống đã xác định chính xác điểm em cần học tiếp — không lãng phí thời gian vào những thứ em đã biết.
          </p>
        </motion.div>

        {/* CTA Buttons */}
        <motion.div
          initial={{ opacity: 0, y: 6 }} animate={show ? { opacity: 1, y: 0 } : {}} transition={{ delay: 0.6, duration: 0.4 }}
          style={{ display: "flex", gap: 12 }}
        >
          <button
            style={{ flex: 1, borderRadius: 9999, padding: "14px 0", fontWeight: 700, fontSize: 14, backgroundColor: B.white, color: B.textMuted, border: `2px solid ${B.grayBorder}`, cursor: "pointer", fontFamily: NUNITO, transition: "all 0.2s" }}
            onClick={() => window.location.reload()}
          >
            Làm lại bài kiểm tra
          </button>
          <button
            style={{ flex: 2, borderRadius: 9999, padding: "14px 0", fontWeight: 700, fontSize: 15, backgroundColor: B.blue, color: B.white, border: "none", cursor: "pointer", fontFamily: NUNITO, display: "flex", alignItems: "center", justifyContent: "center", gap: 8, boxShadow: "0 4px 14px rgba(61,114,248,0.28)", transition: "all 0.2s" }}
          >
            Xem lộ trình học của em <ArrowRight size={16} />
          </button>
        </motion.div>
      </motion.div>
    </motion.div>
  );
}
