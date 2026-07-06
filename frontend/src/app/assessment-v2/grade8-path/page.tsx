"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowRight, CheckCircle2, History, Loader2, RotateCcw } from "lucide-react";
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
  isFractionReady,
  serializeFraction,
  type FractionWidgetState,
  type WidgetType,
} from "@/components/wizzdom/MathWidgets";
import { WizzdomLogo } from "@/components/wizzdom/MathDisplay";

const MAX_QUESTIONS = 35;

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

function normalizeWidget(raw?: string | null, checker?: string | null): WidgetType | "expression_raw" {
  const value = String(raw || checker || "number").toLowerCase().replace(/[\s-]/g, "_");
  if (["fraction", "fraction_equal"].includes(value)) return "fraction";
  if (["decimal", "decimal_equal", "probability", "probability_equal"].includes(value)) return "decimal";
  if (["coordinate", "coordinate_pair", "coordinate_pair_equal"].includes(value)) return "coordinate";
  if (["power", "power_tuple"].includes(value)) return "power";
  if (["expression", "expression_equivalent", "ordered_pair_list", "ordered_pair_list_equal", "set", "set_equal", "raw"].includes(value)) return "expression_raw";
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
  if (family === "write_interest_expression") return "percent_times_amount";
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
  const blank = (
    key: "first" | "second",
    placeholder = "?",
    mode: "number" | "math" = "number",
    label?: string,
  ) => (
    <span className={`template-blank ${mode === "math" ? "wide" : ""}`}>
      {label && <span className="blank-label">{label}</span>}
      <input
        className="template-input"
        value={parts[key]}
        inputMode={mode === "number" ? "decimal" : "text"}
        onChange={(event) => onChange({ ...parts, [key]: mode === "number" ? sanitizeNumber(event.target.value) : sanitizeMath(event.target.value) })}
        onKeyDown={(event) => {
          if (event.key === "Enter") onSubmit();
        }}
        placeholder={placeholder}
        autoFocus={key === "first"}
        aria-label={label ?? "Ô điền đáp án"}
      />
    </span>
  );

  if (template === "x_times_x_plus_number") {
    return <div className="template-expression"><span>x(x +</span>{blank("first")}<span>)</span></div>;
  }
  if (template === "linear_expression") {
    return <div className="template-expression">{blank("first")}<span>x +</span>{blank("second", "-?")}</div>;
  }
  if (template === "number_minus_x") {
    return <div className="template-expression">{blank("first")}<span>- x</span></div>;
  }
  if (template === "rational_fraction") {
    return (
      <div className="structured-answer">
        <div className="fraction-template" aria-label="Nhập phân thức">
          {blank("first", "tử", "math", "Tử số")}
          <div className="fraction-line" />
          {blank("second", "mẫu", "math", "Mẫu số")}
        </div>
        <p className="template-hint">Nhập phân thức đã rút gọn. Ví dụ ký hiệu nhân có thể gõ bằng dấu *.</p>
      </div>
    );
  }
  if (template === "two_factor_product") {
    return (
      <div className="structured-answer">
        <div className="template-expression product-template">
          {blank("first", "thừa số", "math", "Thừa số 1")}
          <span>·</span>
          {blank("second", "thừa số", "math", "Thừa số 2")}
        </div>
        <p className="template-hint">Chỉ nhập tích được hỏi, không cần viết dấu bằng.</p>
      </div>
    );
  }
  if (template === "percent_times_amount") {
    return (
      <div className="structured-answer">
        <div className="template-expression">
          <span>{amountFromQuestion(item)} ×</span>
          {blank("first", "?", "number", "Tỷ lệ")}
          <span>%</span>
        </div>
        <p className="template-hint">Nhập số phần trăm, hệ thống sẽ tự đổi sang dạng thập phân khi chấm.</p>
      </div>
    );
  }
  return <div className="template-expression"><span>x +</span>{blank("first")}</div>;
}

function RawExpressionInput({
  value,
  onChange,
  onSubmit,
  helper,
  placeholder = "Ví dụ: x*(x+2)",
}: {
  value: string;
  onChange: (value: string) => void;
  onSubmit: () => void;
  helper?: string;
  placeholder?: string;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const insert = (token: string) => {
    const input = inputRef.current;
    if (!input) {
      onChange(value + token);
      return;
    }
    const start = input.selectionStart ?? value.length;
    const end = input.selectionEnd ?? value.length;
    const next = `${value.slice(0, start)}${token}${value.slice(end)}`;
    onChange(next);
    requestAnimationFrame(() => {
      input.focus();
      const cursor = start + token.length;
      input.setSelectionRange(cursor, cursor);
    });
  };
  return (
    <div className="raw-expression">
      <input
        ref={inputRef}
        className="raw-input"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === "Enter" && value.trim()) onSubmit();
        }}
        placeholder={placeholder}
        autoFocus
      />
      <div className="math-keypad" aria-label="Phím hỗ trợ nhập biểu thức">
        {["x", "a", "b", "+", "-", "*", "/", "^", "(", ")"].map((token) => (
          <button type="button" key={token} onClick={() => insert(token)}>{token}</button>
        ))}
        <button type="button" onClick={() => onChange("")}><RotateCcw size={14} /> Xóa</button>
      </div>
      <p className="input-note">{helper ?? <>Có thể dùng phím hỗ trợ hoặc gõ trực tiếp. Dấu nhân nhập bằng <strong>*</strong>.</>}</p>
    </div>
  );
}

function rawInputCopy(item?: AssessmentV2Item | null) {
  const checker = item?.checker_type;
  if (checker === "set_equal") {
    return {
      placeholder: "Ví dụ: {-2; 3}",
      helper: "Nhập các giá trị trong tập nghiệm, cách nhau bằng dấu chấm phẩy.",
    };
  }
  if (checker === "ordered_pair_list_equal") {
    return {
      placeholder: "Ví dụ: (0,-4); (2,0)",
      helper: "Nhập từng điểm theo dạng (x,y), các điểm cách nhau bằng dấu chấm phẩy.",
    };
  }
  return {
    placeholder: "Nhập biểu thức",
    helper: "Có thể dùng phím hỗ trợ hoặc gõ trực tiếp. Dấu nhân nhập bằng *.",
  };
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

  const widget = normalizeWidget(item?.answer_widget, item?.checker_type);
  const expressionTemplate = widget === "expression_raw" ? expressionTemplateForItem(item) : null;
  const isReady = useMemo(() => {
    if (widget === "fraction") return isFractionReady(fraction);
    if (widget === "coordinate") return coordinate.x.trim() !== "" && coordinate.y.trim() !== "";
    if (widget === "power") return power.base.trim() !== "" && power.exp.trim() !== "";
    if (expressionTemplate === "linear_expression") return expressionParts.first.trim() !== "" && expressionParts.second.trim() !== "";
    if (expressionTemplate === "rational_fraction" || expressionTemplate === "two_factor_product") return expressionParts.first.trim() !== "" && expressionParts.second.trim() !== "";
    if (expressionTemplate) return expressionParts.first.trim() !== "";
    return text.trim().length > 0;
  }, [coordinate, expressionParts, expressionTemplate, fraction, power, text, widget]);

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
        <Link className="teacher-link" href="/assessment-v2/history?scope=grade8_exam_path">
          <History size={15} /> Dành cho giáo viên
        </Link>
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
              <Link href="/assessment-v2/history?scope=grade8_exam_path">Giáo viên xem lại</Link>
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
                <h2>{item.question}</h2>

                <div className="answer-box">
                  <p>Nhập đáp án của em</p>
                  {widget === "expression_raw" ? (
                    expressionTemplate ? (
                      <ExpressionTemplateInput
                        template={expressionTemplate}
                        parts={expressionParts}
                        onChange={setExpressionParts}
                        onSubmit={() => isReady && handleResponse("answer")}
                        item={item}
                      />
                    ) : (
                      <RawExpressionInput
                        value={text}
                        onChange={setText}
                        onSubmit={() => isReady && handleResponse("answer")}
                        {...rawInputCopy(item)}
                      />
                    )
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
                      widgetType={widget}
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
          <div className="card">
            <div className="complete-icon"><CheckCircle2 size={28} /></div>
            <h2>Đã hoàn thành bài kiểm tra</h2>
            <p className="muted">
              Đây là kết quả chẩn đoán, không phải điểm số. Các kiến thức suy luận được xem là vùng có thể bị ảnh hưởng bởi chuỗi kiến thức nền.
            </p>
            <div className="metrics">
              <div><strong>{result.summary.value_metrics.questions_asked}</strong><span>câu đã hỏi</span></div>
              <div><strong>{result.summary.value_metrics.skills_directly_tested}</strong><span>kỹ năng kiểm tra trực tiếp</span></div>
              <div><strong>{result.summary.value_metrics.skills_inferred}</strong><span>kỹ năng suy luận</span></div>
            </div>
            <div className="summary-grid">
              <section>
                <h3>Kiến thức cần ôn</h3>
                {(result.summary.skills_to_review.length ? result.summary.skills_to_review : result.summary.possibly_affected).slice(0, 8).map((row) => (
                  <p key={row.kc_id}><strong>{row.code}</strong><br />{row.name} · {Math.round(row.p_mastery * 100)}%</p>
                ))}
              </section>
              <section>
                <h3>Dành cho giáo viên</h3>
                <p>Giáo viên có thể xem từng câu đã hỏi, đáp án học sinh, trạng thái kỹ năng và lý do hệ thống chọn câu tiếp theo.</p>
                <Link className="review-button" href={`/assessment-v2/history?scope=grade8_exam_path&session=${result.session_id}`}>
                  Mở trang phân tích
                </Link>
              </section>
            </div>
          </div>
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
        .eyebrow, .kc {
          margin: 0;
          font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
          font-size: 12px;
          font-weight: 900;
          color: #3d72f8;
          text-transform: uppercase;
          letter-spacing: 0;
        }
        h1 { font-size: 40px; line-height: 1.04; margin: 0; letter-spacing: 0; }
        h2 { font-size: 30px; line-height: 1.22; margin: 18px 0; }
        h3 { margin: 0 0 14px; }
        .side p { color: #475569; line-height: 1.55; font-size: 17px; margin: 0; }
        .guidance-list {
          display: grid;
          gap: 12px;
        }
        .guidance-card {
          border: 1px solid rgba(15,23,42,0.08);
          border-radius: 16px;
          background: rgba(255,255,255,0.86);
          padding: 16px;
          box-shadow: 0 12px 28px rgba(15,23,42,0.05);
        }
        .guidance-card.primary {
          background: #eef2ff;
          border-color: rgba(61,114,248,0.18);
        }
        .guidance-card strong { display: block; font-size: 18px; line-height: 1.25; }
        .guidance-card.primary strong { font-size: 32px; color: #3d72f8; }
        .guidance-card span { display: block; color: #64748b; margin-top: 6px; line-height: 1.45; font-weight: 750; }
        .teacher-link {
          margin-top: auto;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          border-radius: 999px;
          padding: 11px 14px;
          background: rgba(255,255,255,0.76);
          color: #64748b;
          border: 1px solid rgba(15,23,42,0.08);
          font-weight: 850;
          text-decoration: none;
        }
        .history-link, .review-button {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          border-radius: 999px;
          padding: 13px 16px;
          background: white;
          color: #0f172a;
          font-weight: 900;
          text-decoration: none;
        }
        .content { padding: 38px; display: flex; align-items: center; justify-content: center; }
        .card {
          width: min(1000px, 100%);
          border-radius: 22px;
          background: white;
          border: 1px solid rgba(15,23,42,0.1);
          box-shadow: 0 18px 55px rgba(15,23,42,0.08);
          padding: 32px;
        }
        .center { text-align: center; display: grid; justify-items: center; }
        .spin { animation: spin 1s linear infinite; color: #3d72f8; }
        @keyframes spin { to { transform: rotate(360deg); } }
        .top-row { display: flex; justify-content: space-between; gap: 12px; font-weight: 850; color: #64748b; }
        .top-row a { color: #3d72f8; text-decoration: none; }
        .progress { height: 8px; border-radius: 999px; background: #e5e7eb; overflow: hidden; margin: 14px 0 24px; }
        .progress div { height: 100%; background: #3d72f8; border-radius: 999px; transition: width 0.25s; }
        .meta { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 10px; }
        .meta span {
          border-radius: 999px;
          padding: 6px 10px;
          background: #eef2ff;
          color: #3d72f8;
          font-size: 11px;
          font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
          font-weight: 900;
        }
        .answer-box {
          border: 2px solid #dbe3f0;
          border-radius: 22px;
          padding: 28px;
          display: grid;
          justify-items: center;
          gap: 16px;
          margin: 26px 0;
        }
        .answer-box p { margin: 0; color: #64748b; font-weight: 850; }
        .raw-input {
          width: min(620px, 100%);
          border: none;
          border-bottom: 3px solid #3d72f8;
          outline: none;
          text-align: center;
          font-size: 28px;
          font-weight: 850;
          padding: 10px 8px;
        }
        .raw-expression {
          width: min(680px, 100%);
          display: grid;
          justify-items: center;
          gap: 14px;
        }
        .math-keypad {
          display: flex;
          flex-wrap: wrap;
          justify-content: center;
          gap: 8px;
        }
        .math-keypad button {
          min-width: 42px;
          height: 38px;
          border-radius: 12px;
          padding: 0 12px;
          background: #eef4ff;
          color: #1d4ed8;
          border: 1px solid #c7d7fe;
          font-size: 16px;
        }
        .input-note {
          max-width: 560px;
          color: #64748b;
          font-size: 13px;
          line-height: 1.4;
          text-align: center;
        }
        .template-expression {
          display: flex;
          align-items: center;
          justify-content: center;
          flex-wrap: wrap;
          gap: 8px;
          color: #111827;
          font-size: clamp(28px, 4vw, 42px);
          font-weight: 900;
          line-height: 1.15;
          letter-spacing: 0;
          padding: 4px 0 2px;
        }
        .template-expression span {
          display: inline-flex;
          align-items: center;
        }
        .structured-answer {
          display: grid;
          justify-items: center;
          gap: 12px;
          width: min(640px, 100%);
        }
        .fraction-template {
          display: grid;
          justify-items: center;
          gap: 8px;
          min-width: min(420px, 100%);
        }
        .fraction-line {
          width: min(360px, 90%);
          height: 4px;
          border-radius: 999px;
          background: #111827;
        }
        .product-template {
          gap: 14px;
        }
        .template-hint {
          margin: 0;
          max-width: 520px;
          color: #64748b;
          font-size: 13px;
          line-height: 1.45;
          text-align: center;
          font-weight: 750;
        }
        .template-blank {
          position: relative;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          min-width: 74px;
          height: 58px;
          padding: 0 8px;
          border-radius: 14px;
          background: #f8fbff;
          box-shadow: inset 0 -4px 0 #3d72f8;
          transition: background 0.18s ease, box-shadow 0.18s ease, transform 0.18s ease;
        }
        .template-blank.wide {
          min-width: min(320px, 82vw);
          width: min(320px, 82vw);
          height: 64px;
          padding: 0 14px;
        }
        .template-blank:focus-within {
          background: #eef4ff;
          box-shadow: inset 0 -4px 0 #2563eb, 0 0 0 5px rgba(61, 114, 248, 0.12);
          transform: translateY(-1px);
        }
        .blank-label {
          position: absolute;
          top: 6px;
          left: 10px;
          color: #64748b;
          font-size: 10px;
          font-weight: 900;
          text-transform: uppercase;
          letter-spacing: 0;
        }
        .template-input {
          width: 58px;
          max-width: 72px;
          border: none;
          outline: none;
          text-align: center;
          font-size: clamp(28px, 4vw, 40px);
          line-height: 1;
          font-weight: 900;
          color: #111827;
          background: transparent;
          padding: 0;
          appearance: textfield;
        }
        .template-blank.wide .template-input {
          width: 100%;
          max-width: none;
          font-size: clamp(24px, 3vw, 34px);
          padding-top: 12px;
        }
        .template-input::placeholder {
          color: #94a3b8;
          opacity: 0.75;
        }
        .actions { display: flex; gap: 12px; }
        button {
          border: none;
          border-radius: 999px;
          padding: 16px 24px;
          background: #3d72f8;
          color: white;
          font-size: 16px;
          font-weight: 900;
          cursor: pointer;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
        }
        button:disabled { opacity: 0.35; cursor: not-allowed; }
        .secondary { background: #e8edf6; color: #334155; }
        .error { margin: 18px 0; border-radius: 14px; padding: 14px; background: #fef2f2; color: #dc2626; font-weight: 800; }
        .empty, .muted { color: #64748b; line-height: 1.5; }
        .complete-icon {
          width: 58px; height: 58px; border-radius: 18px; background: #ecfdf5; color: #10b981;
          display: flex; align-items: center; justify-content: center;
        }
        .metrics { display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; margin: 22px 0; }
        .metrics div { border-radius: 16px; background: #f8fafc; padding: 18px; }
        .metrics strong { display: block; font-size: 32px; }
        .metrics span { color: #64748b; font-weight: 800; }
        .summary-grid { display: grid; grid-template-columns: 1.2fr 0.8fr; gap: 20px; }
        .summary-grid section { border-radius: 18px; border: 1px solid #e5e7eb; padding: 18px; }
        .summary-grid p { line-height: 1.45; color: #334155; }
        .review-button { background: #0f172a; color: white; margin-top: 10px; }
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
