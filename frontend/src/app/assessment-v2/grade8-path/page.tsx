"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowRight, CheckCircle2, HelpCircle, History, Loader2 } from "lucide-react";
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

const MAX_QUESTIONS = 35;

type Phase = "loading" | "question" | "adapting" | "completed";
type ExpressionTemplate = "x_plus_number" | "x_times_x_plus_number" | "linear_expression" | "number_minus_x" | null;

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
  if (family === "common_denominator_x_and_x_plus_a") return "x_times_x_plus_number";
  if (family === "expand_coefficient_parentheses") return "linear_expression";
  if (family === "represent_remaining_amount_total_minus_x") return "number_minus_x";
  return null;
}

function serializeExpressionTemplate(template: ExpressionTemplate, parts: { first: string; second: string }) {
  if (template === "x_plus_number") return `x+${parts.first}`;
  if (template === "x_times_x_plus_number") return `x*(x+${parts.first})`;
  if (template === "linear_expression") {
    const second = parts.second.trim();
    return `${parts.first}*x${second.startsWith("-") ? second : `+${second}`}`;
  }
  if (template === "number_minus_x") return `${parts.first}-x`;
  return "";
}

function ExpressionTemplateInput({
  template,
  parts,
  onChange,
  onSubmit,
}: {
  template: Exclude<ExpressionTemplate, null>;
  parts: { first: string; second: string };
  onChange: (value: { first: string; second: string }) => void;
  onSubmit: () => void;
}) {
  const sanitize = (value: string) => value.replace(/[^0-9-]/g, "");
  const input = (key: "first" | "second", placeholder = "?") => (
    <input
      className="template-input"
      value={parts[key]}
      inputMode="numeric"
      onChange={(event) => onChange({ ...parts, [key]: sanitize(event.target.value) })}
      onKeyDown={(event) => {
        if (event.key === "Enter") onSubmit();
      }}
      placeholder={placeholder}
      autoFocus={key === "first"}
    />
  );

  if (template === "x_times_x_plus_number") {
    return <div className="template-expression"><span>x(x +</span>{input("first")}<span>)</span></div>;
  }
  if (template === "linear_expression") {
    return <div className="template-expression">{input("first")}<span>x +</span>{input("second", "-?")}</div>;
  }
  if (template === "number_minus_x") {
    return <div className="template-expression">{input("first")}<span>- x</span></div>;
  }
  return <div className="template-expression"><span>x +</span>{input("first")}</div>;
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
    if (expressionTemplate) return expressionParts.first.trim() !== "";
    return text.trim().length > 0;
  }, [coordinate, expressionParts, expressionTemplate, fraction, power, text, widget]);

  useEffect(() => {
    if (initialized.current) return;
    initialized.current = true;
    createAssessmentV2Session({
      max_questions: MAX_QUESTIONS,
      assessment_scope: "grade8_exam_path",
      student_label: "Grade 8 official-path standalone test",
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
    if (expressionTemplate) return serializeExpressionTemplate(expressionTemplate, expressionParts);
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
      setError((err as Error).message);
      setPhase("question");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <main className="grade8-shell">
      <aside className="side">
        <p className="eyebrow">Assessment V2</p>
        <h1>Grade 8 Algebra Diagnostic</h1>
        <p>
          Standalone official-path test for rational expressions, equations, word-problem modeling, and linear functions.
        </p>
        <div className="side-card">
          <strong>{MAX_QUESTIONS}</strong>
          <span>maximum questions</span>
        </div>
        <div className="side-card">
          <strong>Open-ended</strong>
          <span>no multiple-choice guessing</span>
        </div>
        <Link className="history-link" href="/assessment-v2/history?scope=grade8_exam_path">
          <History size={16} /> Teacher review history
        </Link>
      </aside>

      <section className="content">
        {phase === "loading" && (
          <div className="card center">
            <Loader2 className="spin" size={30} />
            <h2>Preparing adaptive test</h2>
          </div>
        )}

        {phase === "adapting" && (
          <div className="card center">
            <Loader2 className="spin" size={30} />
            <h2>Choosing the next diagnostic question</h2>
            <p>The engine is updating the knowledge-state frontier from the previous answer.</p>
          </div>
        )}

        {phase === "question" && (
          <div className="card">
            <div className="top-row">
              <span>Question {questionNumber} of up to {maxQuestions}</span>
              <Link href="/assessment-v2/history?scope=grade8_exam_path">Review runs</Link>
            </div>
            <div className="progress">
              <div style={{ width: `${Math.min(100, (questionNumber / maxQuestions) * 100)}%` }} />
            </div>

            {error && <div className="error">{error}</div>}

            {item ? (
              <>
                <p className="kc">{item.kc_code} · {item.kc_name}</p>
                <div className="meta">
                  {item.target_exam_path && <span>{item.target_exam_path}</span>}
                  {item.item_role && <span>{item.item_role}</span>}
                  {item.item_family && <span>{item.item_family}</span>}
                </div>
                <h2>{item.question}</h2>

                <div className="answer-box">
                  <p>Enter your answer</p>
                  {widget === "expression_raw" ? (
                    expressionTemplate ? (
                      <ExpressionTemplateInput
                        template={expressionTemplate}
                        parts={expressionParts}
                        onChange={setExpressionParts}
                        onSubmit={() => isReady && handleResponse("answer")}
                      />
                    ) : (
                      <input
                        className="raw-input"
                        value={text}
                        onChange={(event) => setText(event.target.value)}
                        onKeyDown={(event) => {
                          if (event.key === "Enter" && isReady) handleResponse("answer");
                        }}
                        placeholder="Example: x*(x+2)"
                        autoFocus
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
                    Submit answer <ArrowRight size={18} />
                  </button>
                  <button className="secondary" disabled={submitting} onClick={() => handleResponse("unknown")}>
                    I don't know
                  </button>
                </div>
              </>
            ) : (
              <div className="empty">No active item is available.</div>
            )}
          </div>
        )}

        {phase === "completed" && result && (
          <div className="card">
            <div className="complete-icon"><CheckCircle2 size={28} /></div>
            <h2>Diagnostic complete</h2>
            <p className="muted">
              This is diagnostic, not a score. Inferred gaps are shown as possibly affected by prerequisite chains.
            </p>
            <div className="metrics">
              <div><strong>{result.summary.value_metrics.questions_asked}</strong><span>questions asked</span></div>
              <div><strong>{result.summary.value_metrics.skills_directly_tested}</strong><span>skills tested</span></div>
              <div><strong>{result.summary.value_metrics.skills_inferred}</strong><span>skills inferred</span></div>
            </div>
            <div className="summary-grid">
              <section>
                <h3>Skills to review</h3>
                {(result.summary.skills_to_review.length ? result.summary.skills_to_review : result.summary.possibly_affected).slice(0, 8).map((row) => (
                  <p key={row.kc_id}><strong>{row.code}</strong><br />{row.name} · {Math.round(row.p_mastery * 100)}%</p>
                ))}
              </section>
              <section>
                <h3>Ready to inspect</h3>
                <p>Teachers can review every question, answer, node state, and why the engine selected each item.</p>
                <Link className="review-button" href={`/assessment-v2/history?scope=grade8_exam_path&session=${result.session_id}`}>
                  Open teacher review
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
          grid-template-columns: 360px minmax(0, 1fr);
          background: #f5f7ff;
          color: #111827;
        }
        .side {
          min-height: 100vh;
          padding: 34px 28px;
          background: #0f172a;
          color: white;
          display: flex;
          flex-direction: column;
          gap: 20px;
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
        h1 { font-size: 42px; line-height: 1; margin: 0; }
        h2 { font-size: 30px; line-height: 1.18; margin: 18px 0; }
        h3 { margin: 0 0 14px; }
        .side p { color: #cbd5e1; line-height: 1.55; font-size: 18px; }
        .side-card {
          border: 1px solid rgba(255,255,255,0.12);
          border-radius: 16px;
          background: rgba(255,255,255,0.06);
          padding: 18px;
        }
        .side-card strong { display: block; font-size: 26px; }
        .side-card span { color: #cbd5e1; }
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
        .content { padding: 42px; display: flex; align-items: center; justify-content: center; }
        .card {
          width: min(960px, 100%);
          border-radius: 24px;
          background: white;
          border: 1px solid rgba(15,23,42,0.1);
          box-shadow: 0 18px 55px rgba(15,23,42,0.08);
          padding: 34px;
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
        .template-expression {
          display: flex;
          align-items: center;
          justify-content: center;
          flex-wrap: wrap;
          gap: 10px;
          color: #111827;
          font-size: 34px;
          font-weight: 900;
        }
        .template-input {
          width: 86px;
          border: none;
          border-bottom: 3px solid #3d72f8;
          outline: none;
          text-align: center;
          font-size: 34px;
          font-weight: 900;
          color: #111827;
          background: transparent;
          padding: 4px 6px;
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
