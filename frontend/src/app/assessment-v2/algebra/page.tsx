"use client";

import React, { useMemo, useState } from "react";
import {
  AssessmentV2Item,
  AssessmentV2Result,
  AssessmentV2SessionResponse,
  AssessmentV2SummaryRow,
  createAssessmentV2Session,
  submitAssessmentV2Response,
} from "@/lib/assessment-v2-api";

type AnswerState = {
  raw: string;
  numerator: string;
  denominator: string;
  base: string;
  exponent: string;
  parts: string[];
};

const emptyAnswer: AnswerState = {
  raw: "",
  numerator: "",
  denominator: "",
  base: "",
  exponent: "",
  parts: ["", "", "", ""],
};

function answerPayload(answer: AnswerState, widget?: string) {
  if (widget === "fraction") return { numerator: answer.numerator, denominator: answer.denominator };
  if (widget === "power") return { base: answer.base, exponent: answer.exponent };
  if (widget === "ordered_list") return { parts: answer.parts.filter(Boolean) };
  return { raw: answer.raw };
}

function MathInput({
  item,
  answer,
  setAnswer,
}: {
  item: AssessmentV2Item;
  answer: AnswerState;
  setAnswer: React.Dispatch<React.SetStateAction<AnswerState>>;
}) {
  const widget = item.answer_widget || "number";
  if (widget === "fraction") {
    return (
      <div className="fraction-input" aria-label="Fraction answer">
        <input value={answer.numerator} onChange={(event) => setAnswer((prev) => ({ ...prev, numerator: event.target.value }))} placeholder="tu so" />
        <div className="fraction-line" />
        <input value={answer.denominator} onChange={(event) => setAnswer((prev) => ({ ...prev, denominator: event.target.value }))} placeholder="mau so" />
      </div>
    );
  }
  if (widget === "power") {
    return (
      <div className="power-input">
        <input value={answer.base} onChange={(event) => setAnswer((prev) => ({ ...prev, base: event.target.value }))} placeholder="co so" />
        <span>^</span>
        <input value={answer.exponent} onChange={(event) => setAnswer((prev) => ({ ...prev, exponent: event.target.value }))} placeholder="so mu" />
      </div>
    );
  }
  if (widget === "ordered_list") {
    return (
      <div className="ordered-input">
        {answer.parts.map((part, index) => (
          <React.Fragment key={index}>
            <input
              value={part}
              onChange={(event) => setAnswer((prev) => {
                const parts = [...prev.parts];
                parts[index] = event.target.value;
                return { ...prev, parts };
              })}
              placeholder={`#${index + 1}`}
            />
            {index < answer.parts.length - 1 && <span>&lt;</span>}
          </React.Fragment>
        ))}
      </div>
    );
  }
  const placeholder = widget === "probability"
    ? "Nhap dang phan so, thap phan, hoac phan tram"
    : widget === "expression"
      ? "Nhap bieu thuc, vi du: 2*x + 3"
      : "Nhap dap an";
  return (
    <input
      className="answer-input"
      value={answer.raw}
      onChange={(event) => setAnswer((prev) => ({ ...prev, raw: event.target.value }))}
      placeholder={placeholder}
      onKeyDown={(event) => {
        if (event.key === "Enter") {
          event.currentTarget.form?.requestSubmit();
        }
      }}
    />
  );
}

function ResultList({ title, rows, tone }: { title: string; rows: AssessmentV2SummaryRow[]; tone: string }) {
  return (
    <section className="result-section">
      <h3>{title}</h3>
      {rows.length === 0 ? (
        <p className="muted">Chua co muc nao trong nhom nay.</p>
      ) : (
        <div className="result-list">
          {rows.map((row) => (
            <div className="result-row" key={row.kc_id}>
              <span className={`dot ${tone}`} />
              <div>
                <strong>{row.code}</strong>
                <p>{row.name}</p>
              </div>
              <span className="prob">{Math.round(row.p_mastery * 100)}%</span>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

export default function AssessmentV2AlgebraPage() {
  const [session, setSession] = useState<AssessmentV2SessionResponse | null>(null);
  const [result, setResult] = useState<AssessmentV2Result | null>(null);
  const [answer, setAnswer] = useState<AnswerState>(emptyAnswer);
  const [studentLabel, setStudentLabel] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const item = session?.item ?? null;
  const progress = useMemo(() => {
    if (!session) return "";
    return `Question ${session.question_number ?? 1} of up to ${session.max_questions}`;
  }, [session]);

  async function start() {
    setLoading(true);
    setError(null);
    try {
      const created = await createAssessmentV2Session({ max_questions: 35, student_label: studentLabel || undefined });
      setSession(created);
      setResult(null);
      setAnswer(emptyAnswer);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not start assessment");
    } finally {
      setLoading(false);
    }
  }

  async function submit(responseType: "answer" | "unknown" = "answer") {
    if (!session?.session_id || !item) return;
    setLoading(true);
    setError(null);
    try {
      const response = await submitAssessmentV2Response(session.session_id, {
        item_id: item.item_id,
        answer: responseType === "unknown" ? { raw: "I don't know" } : answerPayload(answer, item.answer_widget),
        response_type: responseType,
      });
      if (response.status === "completed" && "summary" in response) {
        setResult(response as AssessmentV2Result);
        setSession(null);
      } else {
        setSession(response as AssessmentV2SessionResponse);
      }
      setAnswer(emptyAnswer);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not submit answer");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="assessment-v2">
      <style jsx>{`
        .assessment-v2 { min-height: 100vh; background: #f6f7fb; color: #172033; display: grid; grid-template-columns: minmax(220px, 320px) 1fr; }
        .side { background: #101827; color: #edf4ff; padding: 28px; display: flex; flex-direction: column; gap: 18px; }
        .side h1 { font-size: 28px; line-height: 1.1; margin: 0; letter-spacing: 0; }
        .side p { color: #b8c4d6; line-height: 1.55; margin: 0; }
        .metric { border: 1px solid #28364d; border-radius: 8px; padding: 14px; background: #162238; }
        .metric strong { display: block; font-size: 22px; }
        .content { padding: 32px; display: flex; align-items: center; justify-content: center; }
        .panel { width: min(880px, 100%); background: white; border: 1px solid #dde3ef; border-radius: 8px; padding: 28px; box-shadow: 0 18px 40px rgba(16,24,39,0.08); }
        .intro { display: grid; gap: 18px; }
        .intro h2, .question h2 { margin: 0; font-size: 26px; letter-spacing: 0; }
        .intro p, .muted { color: #667085; line-height: 1.55; }
        .label-input, .answer-input { width: 100%; border: 1px solid #cfd7e6; border-radius: 8px; padding: 14px 16px; font-size: 18px; color: #172033; }
        .topline { display: flex; justify-content: space-between; gap: 12px; align-items: center; margin-bottom: 22px; color: #667085; }
        .chip { border: 1px solid #ccd6e8; border-radius: 999px; padding: 6px 10px; font-size: 13px; color: #475467; background: #f8fafc; }
        .question { display: grid; gap: 24px; }
        .question-text { font-size: 24px; line-height: 1.35; color: #172033; margin: 0; }
        .fraction-input { width: 220px; display: grid; gap: 8px; }
        .fraction-input input, .power-input input, .ordered-input input { border: 1px solid #cfd7e6; border-radius: 8px; padding: 12px; font-size: 20px; text-align: center; }
        .fraction-line { height: 2px; background: #172033; }
        .power-input, .ordered-input { display: flex; gap: 10px; align-items: center; flex-wrap: wrap; }
        .power-input span, .ordered-input span { font-size: 22px; color: #475467; }
        .actions { display: flex; gap: 12px; flex-wrap: wrap; }
        button { border: 0; border-radius: 8px; padding: 12px 16px; font-size: 15px; font-weight: 700; cursor: pointer; }
        button.primary { background: #1769e0; color: white; }
        button.secondary { background: #e9eef8; color: #172033; }
        button:disabled { opacity: .55; cursor: not-allowed; }
        .error { color: #b42318; background: #fff1f0; border: 1px solid #ffd2cc; padding: 10px 12px; border-radius: 8px; }
        .results { display: grid; gap: 18px; }
        .value-grid { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 12px; }
        .result-section { border-top: 1px solid #e5eaf3; padding-top: 18px; }
        .result-section h3 { margin: 0 0 12px; }
        .result-list { display: grid; gap: 8px; }
        .result-row { display: grid; grid-template-columns: auto 1fr auto; gap: 10px; align-items: center; border: 1px solid #e5eaf3; border-radius: 8px; padding: 10px; }
        .result-row p { margin: 2px 0 0; color: #667085; }
        .dot { width: 12px; height: 12px; border-radius: 999px; display: inline-block; }
        .green { background: #16a34a; }
        .red { background: #dc2626; }
        .orange { background: #f59e0b; }
        .gray { background: #98a2b3; }
        .blue { background: #1769e0; }
        .prob { color: #475467; font-weight: 700; }
        @media (max-width: 820px) {
          .assessment-v2 { grid-template-columns: 1fr; }
          .side { padding: 22px; }
          .content { padding: 18px; }
          .value-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
        }
      `}</style>
      <aside className="side">
        <h1>Algebra Knowledge Check</h1>
        <p>Open-ended adaptive diagnostic for Grade 6 algebra. The goal is to map what is strong, what needs review, and what may be ready to learn next.</p>
        <div className="metric"><strong>35</strong><span>maximum questions</span></div>
        <div className="metric"><strong>Open</strong><span>no multiple-choice guessing</span></div>
        <div className="metric"><strong>Adaptive</strong><span>questions selected from the knowledge graph</span></div>
      </aside>

      <section className="content">
        {!session && !result && (
          <div className="panel intro">
            <h2>Start the diagnostic</h2>
            <p>This is a calm knowledge check. It will not show correctness after each answer. If you are not sure, use “I don’t know” so the system can choose a better next question.</p>
            <input className="label-input" value={studentLabel} onChange={(event) => setStudentLabel(event.target.value)} placeholder="Student name or label (optional)" />
            {error && <div className="error">{error}</div>}
            <div className="actions">
              <button className="primary" onClick={start} disabled={loading}>{loading ? "Starting..." : "Start"}</button>
            </div>
          </div>
        )}

        {session && item && (
          <form className="panel question" onSubmit={(event) => { event.preventDefault(); void submit("answer"); }}>
            <div className="topline">
              <span>{progress}</span>
              <span className="chip">{item.kc_code}</span>
            </div>
            <h2>{item.kc_name}</h2>
            <p className="question-text">{item.question}</p>
            <MathInput item={item} answer={answer} setAnswer={setAnswer} />
            {error && <div className="error">{error}</div>}
            <div className="actions">
              <button className="primary" type="submit" disabled={loading}>{loading ? "Submitting..." : "Submit answer"}</button>
              <button className="secondary" type="button" disabled={loading} onClick={() => void submit("unknown")}>I don't know</button>
            </div>
          </form>
        )}

        {result && (
          <div className="panel results">
            <h2>Knowledge check result</h2>
            <p className="muted">This result is diagnostic, not a score. Inferred gaps are shown as possibly affected by prerequisite chains.</p>
            <div className="value-grid">
              <div className="metric"><strong>{result.summary.value_metrics.questions_asked}</strong><span>questions asked</span></div>
              <div className="metric"><strong>{result.summary.value_metrics.skills_directly_tested}</strong><span>skills tested</span></div>
              <div className="metric"><strong>{result.summary.value_metrics.skills_inferred}</strong><span>skills inferred</span></div>
              <div className="metric"><strong>{result.summary.value_metrics.skills_not_directly_asked}</strong><span>not directly asked</span></div>
            </div>
            <ResultList title="Strong areas" rows={result.summary.strong_areas} tone="green" />
            <ResultList title="Skills to review" rows={result.summary.skills_to_review} tone="red" />
            <ResultList title="Possibly affected by prerequisites" rows={result.summary.possibly_affected} tone="orange" />
            <ResultList title="Ready to learn next" rows={result.summary.ready_to_learn} tone="blue" />
            <ResultList title="Not enough evidence yet" rows={result.summary.not_enough_evidence} tone="gray" />
            <div className="actions">
              <button className="secondary" onClick={() => { setResult(null); setSession(null); setAnswer(emptyAnswer); }}>Start another</button>
            </div>
          </div>
        )}
      </section>
    </main>
  );
}
