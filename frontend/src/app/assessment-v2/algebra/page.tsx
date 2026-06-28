"use client";

import React, { useEffect, useMemo, useState } from "react";
import {
  ArrowRight,
  BadgeCheck,
  BookOpen,
  Brain,
  CheckCircle2,
  Copy,
  GraduationCap,
  HelpCircle,
  Map,
  RefreshCcw,
  Sparkles,
  Target,
  Trophy,
} from "lucide-react";
import {
  AssessmentV2Item,
  AssessmentV2Result,
  AssessmentV2SessionResponse,
  AssessmentV2SummaryRow,
  createAssessmentV2Session,
  getAssessmentV2Session,
  submitAssessmentV2Mastery,
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

type DemoPhase = "intro" | "assessment" | "map" | "lesson" | "mastery" | "updated";

type LessonPlan = {
  title: string;
  subtitle: string;
  concept: string;
  workedExample: string[];
  practicePrompt: string;
  mastery: {
    prompt: string;
    widget: "number" | "fraction" | "power" | "raw";
    accepted: string[];
    hint: string;
  };
};

const emptyAnswer: AnswerState = {
  raw: "",
  numerator: "",
  denominator: "",
  base: "",
  exponent: "",
  parts: ["", "", "", ""],
};

const MOCK_DEMO_RESULT: AssessmentV2Result = {
  session_id: "pitch-demo",
  session_code: "demo-loop",
  status: "completed",
  max_questions: 35,
  responses: [
    {
      step: 1,
      item: {
        item_id: "demo-1",
        kc_id: "kc-int-neg",
        kc_code: "G6-MATH-NHAN-BIET-DOC",
        kc_name: "Doc va viet so nguyen am",
        question: "Diem A nam ben trai goc O 5 don vi. A bieu dien so nao?",
        answer_widget: "number",
      },
      answer: "-5",
      response_type: "answer",
      grading: { is_correct: true, matched_rule: "numeric_equal", normalized_answer: "-5" },
    },
    {
      step: 2,
      item: {
        item_id: "demo-2",
        kc_id: "kc-frac-simplify",
        kc_code: "G6-MATH-TINH-CHAT-CO",
        kc_name: "Rut gon phan so bang tinh chat co ban",
        question: "Rut gon 18/24 ve dang toi gian.",
        answer_widget: "fraction",
      },
      answer: "6/8",
      response_type: "answer",
      grading: {
        is_correct: false,
        matched_rule: "common_wrong_pattern",
        normalized_answer: "6/8",
        diagnosed_misconception: "Da chia ca tu va mau nhung chua ve dang toi gian.",
      },
    },
    {
      step: 3,
      item: {
        item_id: "demo-3",
        kc_id: "kc-frac-add",
        kc_code: "G6-MATH-CONG-HAI-PHAN-1",
        kc_name: "Cong hai phan so khac mau",
        question: "Tinh 1/2 + 1/3.",
        answer_widget: "fraction",
      },
      answer: "5/6",
      response_type: "answer",
      grading: { is_correct: true, matched_rule: "fraction_equal", normalized_answer: "5/6" },
    },
  ],
  run: {},
  summary: {
    strong_areas: [
      {
        kc_id: "kc-int-neg",
        code: "G6-MATH-NHAN-BIET-DOC",
        name: "Doc va viet so nguyen am",
        state: "tested_mastered",
        probability_band: "strong_mastered",
        p_mastery: 0.96,
      },
      {
        kc_id: "kc-frac-add",
        code: "G6-MATH-CONG-HAI-PHAN-1",
        name: "Cong hai phan so khac mau",
        state: "tested_mastered",
        probability_band: "strong_mastered",
        p_mastery: 0.94,
      },
    ],
    skills_to_review: [
      {
        kc_id: "kc-frac-simplify",
        code: "G6-MATH-TINH-CHAT-CO",
        name: "Rut gon phan so bang tinh chat co ban",
        state: "tested_gap",
        probability_band: "likely_gap",
        p_mastery: 0.24,
      },
    ],
    possibly_affected: [
      {
        kc_id: "kc-frac-multiply",
        code: "G6-MATH-NHAN-HAI-PHAN",
        name: "Nhan hai phan so",
        state: "inferred_gap",
        probability_band: "likely_gap",
        p_mastery: 0.34,
      },
      {
        kc_id: "kc-ratio",
        code: "G6-MATH-B31K2",
        name: "Tinh ti so cua hai so",
        state: "inferred_gap",
        probability_band: "likely_gap",
        p_mastery: 0.36,
      },
    ],
    not_enough_evidence: [
      {
        kc_id: "kc-percent",
        code: "G6-MATH-TIM-GIA-TRI-1",
        name: "Tim gia tri phan tram cua mot so",
        state: "unknown",
        probability_band: "uncertain",
        p_mastery: 0.52,
      },
    ],
    ready_to_learn: [
      {
        kc_id: "kc-frac-multiply",
        code: "G6-MATH-NHAN-HAI-PHAN",
        name: "Nhan hai phan so",
        state: "inferred_gap",
        probability_band: "likely_gap",
        p_mastery: 0.34,
      },
    ],
    value_metrics: {
      questions_asked: 12,
      skills_directly_tested: 12,
      skills_inferred: 18,
      skills_not_directly_asked: 47,
    },
  },
};

function answerPayload(answer: AnswerState, widget?: string) {
  if (widget === "fraction") return { numerator: answer.numerator, denominator: answer.denominator };
  if (widget === "power") return { base: answer.base, exponent: answer.exponent };
  if (widget === "ordered_list") return { parts: answer.parts.filter(Boolean) };
  return { raw: answer.raw };
}

function answerText(answer: AnswerState, widget?: string) {
  if (widget === "fraction") return `${answer.numerator}/${answer.denominator}`;
  if (widget === "power") return `${answer.base}^${answer.exponent}`;
  if (widget === "ordered_list") return answer.parts.filter(Boolean).join(";");
  return answer.raw;
}

function normalizeMath(value: string) {
  return value.trim().toLowerCase().replace(/\s+/g, "").replace(",", ".");
}

function fractionNumber(value: string) {
  const text = normalizeMath(value);
  if (!text) return null;
  if (text.includes("/")) {
    const [rawNumerator, rawDenominator] = text.split("/");
    const numerator = Number(rawNumerator);
    const denominator = Number(rawDenominator);
    if (!Number.isFinite(numerator) || !Number.isFinite(denominator) || denominator === 0) return null;
    return numerator / denominator;
  }
  const number = Number(text);
  return Number.isFinite(number) ? number : null;
}

function answerMatches(answer: string, accepted: string[]) {
  const normalized = normalizeMath(answer);
  const answerFraction = fractionNumber(answer);
  return accepted.some((expected) => {
    const expectedNormalized = normalizeMath(expected);
    if (normalized === expectedNormalized) return true;
    const expectedFraction = fractionNumber(expected);
    return answerFraction !== null && expectedFraction !== null && Math.abs(answerFraction - expectedFraction) < 1e-9;
  });
}

function writeSessionToUrl(sessionId: string | null) {
  if (typeof window === "undefined") return;
  const url = new URL(window.location.href);
  if (sessionId) {
    url.searchParams.set("session", sessionId);
  } else {
    url.searchParams.delete("session");
  }
  window.history.replaceState({}, "", url.toString());
}

function currentSessionUrl(sessionId: string) {
  if (typeof window === "undefined") return "";
  const url = new URL(window.location.href);
  url.searchParams.set("session", sessionId);
  return url.toString();
}

function isAssessmentResult(value: AssessmentV2SessionResponse | AssessmentV2Result): value is AssessmentV2Result {
  return "summary" in value && "run" in value;
}

function MathInput({
  item,
  answer,
  setAnswer,
  large = false,
}: {
  item: Pick<AssessmentV2Item, "answer_widget">;
  answer: AnswerState;
  setAnswer: React.Dispatch<React.SetStateAction<AnswerState>>;
  large?: boolean;
}) {
  const widget = item.answer_widget || "number";
  if (widget === "fraction") {
    return (
      <div className={`fraction-input ${large ? "large" : ""}`} aria-label="Fraction answer">
        <input value={answer.numerator} onChange={(event) => setAnswer((prev) => ({ ...prev, numerator: event.target.value }))} placeholder="tu so" />
        <div className="fraction-line" />
        <input value={answer.denominator} onChange={(event) => setAnswer((prev) => ({ ...prev, denominator: event.target.value }))} placeholder="mau so" />
      </div>
    );
  }
  if (widget === "power") {
    return (
      <div className={`power-input ${large ? "large" : ""}`}>
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
      className={`answer-input ${large ? "large" : ""}`}
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

function pickRecommendation(result: AssessmentV2Result | null) {
  if (!result) return null;
  if (result.learning_loop?.recommendation) return result.learning_loop.recommendation;
  return result.summary.skills_to_review[0]
    || result.summary.ready_to_learn[0]
    || result.summary.possibly_affected[0]
    || result.summary.not_enough_evidence[0]
    || result.summary.strong_areas[0]
    || null;
}

function lessonFor(row: AssessmentV2SummaryRow | null): LessonPlan {
  const code = row?.code || "";
  if (code.includes("PHAN") || code.includes("B31K2") || code.includes("TINH-CHAT-CO")) {
    return {
      title: "Target lesson: rut gon phan so",
      subtitle: row?.name || "Fraction prerequisite",
      concept: "Mot phan so khong doi gia tri neu chia ca tu va mau cho cung mot so khac 0. Muc tieu la dua ve dang khong con uoc chung lon hon 1.",
      workedExample: [
        "18 va 24 cung chia het cho 6.",
        "18/24 = (18 : 6)/(24 : 6).",
        "Ket qua la 3/4, vi 3 va 4 khong con uoc chung lon hon 1.",
      ],
      practicePrompt: "Thu nhanh: 21/28 rut gon thanh phan so nao?",
      mastery: {
        prompt: "Mastery check: rut gon 30/45 ve dang toi gian.",
        widget: "fraction",
        accepted: ["2/3"],
        hint: "Nhap tu so va mau so sau khi da chia cho uoc chung lon nhat.",
      },
    };
  }
  if (code.includes("LUY") || code.includes("CAU") || code.includes("SO-3")) {
    return {
      title: "Target lesson: doc cau truc luy thua",
      subtitle: row?.name || "Power notation",
      concept: "Trong a^n, a la co so va n la so mu. So mu cho biet co so duoc nhan voi chinh no bao nhieu lan.",
      workedExample: ["7^4 co co so la 7.", "So mu la 4.", "Gia tri 7^4 khac voi viec chi ra so mu."],
      practicePrompt: "Trong 5^3, so mu la bao nhieu?",
      mastery: {
        prompt: "Mastery check: trong 9^2, so mu la bao nhieu?",
        widget: "number",
        accepted: ["2"],
        hint: "Chi nhap so mu, khong nhap ca bieu thuc.",
      },
    };
  }
  return {
    title: "Target lesson: rebuild the missing step",
    subtitle: row?.name || "Selected skill",
    concept: "He thong chon ky nang nay vi no nam gan ranh gioi giua vung da chac va vung can on. Hoc ngan, kiem tra lai ngay, roi cap nhat ban do.",
    workedExample: ["Doc yeu cau.", "Lam tung buoc.", "Doi chieu dap an voi dieu kien cua bai."],
    practicePrompt: "Lam lai mot cau cung ky nang voi dap an ngan gon.",
    mastery: {
      prompt: "Mastery check: nhap 1 neu da san sang tiep tuc.",
      widget: "number",
      accepted: ["1"],
      hint: "Demo generic cho ky nang chua co lesson rieng.",
    },
  };
}

function activeLesson(result: AssessmentV2Result | null, recommendation: AssessmentV2SummaryRow | null): LessonPlan {
  const persisted = result?.learning_loop?.lesson;
  if (persisted) {
    return {
      title: persisted.title,
      subtitle: persisted.subtitle,
      concept: persisted.concept,
      workedExample: persisted.worked_example || [],
      practicePrompt: persisted.practice_prompt,
      mastery: {
        prompt: persisted.mastery.prompt,
        widget: (persisted.mastery.answer_widget || "number") as LessonPlan["mastery"]["widget"],
        accepted: persisted.mastery.accepted_answers || [],
        hint: persisted.mastery.hint,
      },
    };
  }
  return lessonFor(recommendation);
}

function stateCopy(row: AssessmentV2SummaryRow, masteryPassed: boolean, recommendationId?: string) {
  if (masteryPassed && row.kc_id === recommendationId) {
    return { label: "mastered after lesson", tone: "green", pct: 92 };
  }
  const pct = Math.round(row.p_mastery * 100);
  if (row.state.includes("mastered")) return { label: "strong", tone: "green", pct };
  if (row.state === "tested_gap") return { label: "review", tone: "red", pct };
  if (row.state === "inferred_gap") return { label: "affected", tone: "orange", pct };
  return { label: "uncertain", tone: "gray", pct };
}

function ResultList({
  title,
  rows,
  tone,
  compact = false,
}: {
  title: string;
  rows: AssessmentV2SummaryRow[];
  tone: string;
  compact?: boolean;
}) {
  return (
    <section className={`result-section ${compact ? "compact" : ""}`}>
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

function KnowledgeMap({
  result,
  recommendation,
  masteryPassed,
}: {
  result: AssessmentV2Result;
  recommendation: AssessmentV2SummaryRow | null;
  masteryPassed: boolean;
}) {
  const rows = [
    ...result.summary.strong_areas.slice(0, 4),
    ...result.summary.skills_to_review.slice(0, 3),
    ...result.summary.possibly_affected.slice(0, 4),
    ...result.summary.not_enough_evidence.slice(0, 2),
  ];
  const uniqueRows = rows.filter((row, index, all) => all.findIndex((candidate) => candidate.kc_id === row.kc_id) === index);

  return (
    <div className="map-board" aria-label="Knowledge map preview">
      {uniqueRows.map((row, index) => {
        const state = stateCopy(row, masteryPassed, recommendation?.kc_id);
        const selected = row.kc_id === recommendation?.kc_id;
        return (
          <div className={`map-node ${state.tone} ${selected ? "selected" : ""}`} key={row.kc_id} style={{ ["--delay" as string]: `${index * 30}ms` }}>
            <span className="node-code">{row.code}</span>
            <strong>{row.name}</strong>
            <span className="node-bottom">
              <span>{state.label}</span>
              <b>{state.pct}%</b>
            </span>
          </div>
        );
      })}
    </div>
  );
}

function StepRail({ phase }: { phase: DemoPhase }) {
  const order: { id: DemoPhase; label: string; icon: React.ReactNode }[] = [
    { id: "assessment", label: "Assess", icon: <Target size={16} /> },
    { id: "map", label: "Map", icon: <Map size={16} /> },
    { id: "lesson", label: "Learn", icon: <BookOpen size={16} /> },
    { id: "mastery", label: "Mastery", icon: <BadgeCheck size={16} /> },
    { id: "updated", label: "Outcome", icon: <Trophy size={16} /> },
  ];
  const activeIndex = Math.max(0, order.findIndex((item) => item.id === phase));
  return (
    <div className="step-rail">
      {order.map((item, index) => (
        <div className={`rail-step ${index <= activeIndex ? "active" : ""}`} key={item.id}>
          <span>{item.icon}</span>
          <b>{item.label}</b>
        </div>
      ))}
    </div>
  );
}

function PitchProof({
  result,
  recommendation,
  masteryPassed,
}: {
  result: AssessmentV2Result;
  recommendation: AssessmentV2SummaryRow | null;
  masteryPassed: boolean;
}) {
  const reviewCount = result.summary.skills_to_review.length;
  const affectedCount = result.summary.possibly_affected.length;
  const targetName = recommendation?.name || "the next highest-impact skill";
  return (
    <div className="pitch-proof">
      <div className="proof-card">
        <span className="proof-icon blue"><Target size={18} /></span>
        <b>Diagnose</b>
        <p>{result.summary.value_metrics.questions_asked} open questions mapped {result.summary.value_metrics.skills_directly_tested} directly tested skills.</p>
      </div>
      <div className="proof-card">
        <span className="proof-icon orange"><Map size={18} /></span>
        <b>Infer</b>
        <p>{affectedCount} skills are marked possibly affected, not overclaimed as hard gaps.</p>
      </div>
      <div className="proof-card">
        <span className="proof-icon red"><BookOpen size={18} /></span>
        <b>Teach</b>
        <p>The system selects {targetName} from {reviewCount || 1} review target{reviewCount === 1 ? "" : "s"}.</p>
      </div>
      <div className="proof-card">
        <span className="proof-icon green"><Trophy size={18} /></span>
        <b>Verify</b>
        <p>{masteryPassed ? "Mastery evidence updates the map and opens the next frontier." : "A short mastery check will decide whether the map should change."}</p>
      </div>
    </div>
  );
}

function OutcomeNarrative({
  result,
  recommendation,
  masteryPassed,
}: {
  result: AssessmentV2Result;
  recommendation: AssessmentV2SummaryRow | null;
  masteryPassed: boolean;
}) {
  const masteredCount = result.summary.strong_areas.length + (masteryPassed ? 1 : 0);
  return (
    <div className="outcome-grid">
      <div className="outcome-card student">
        <span className="eyebrow small"><GraduationCap size={15} /> Student view</span>
        <h3>{masteryPassed ? "You just strengthened a skill." : "Start here, not everywhere."}</h3>
        <p>{masteryPassed ? "The map has changed because the student proved the lesson worked." : `Wizzdom recommends ${recommendation?.name || "one target skill"} before adding more practice.`}</p>
      </div>
      <div className="outcome-card teacher">
        <span className="eyebrow small"><BadgeCheck size={15} /> Teacher evidence</span>
        <h3>{masteredCount} strong signals, {result.summary.skills_to_review.length} review targets</h3>
        <p>Every state can be traced back to direct answers, graph inference, or a mastery check.</p>
      </div>
      <div className="outcome-card pitch">
        <span className="eyebrow small"><Sparkles size={15} /> Pitch value</span>
        <h3>Adaptive learning, not a quiz score</h3>
        <p>The demo shows diagnosis, personalized instruction, verification, and a live knowledge map outcome.</p>
      </div>
    </div>
  );
}

function TeacherEvidenceSummary({
  result,
  recommendation,
}: {
  result: AssessmentV2Result;
  recommendation: AssessmentV2SummaryRow | null;
}) {
  const latestMastery = result.learning_loop?.mastery_checks?.at(-1);
  const reviewItems = result.responses.filter((response) => response.response_type === "unknown" || response.grading.is_correct === false);
  return (
    <div className="teacher-summary">
      <div className="teacher-summary-head">
        <span className="eyebrow small"><BadgeCheck size={15} /> Teacher evidence trail</span>
        <span className="session-code">{result.session_code}</span>
      </div>
      <div className="teacher-facts">
        <div>
          <b>Target skill</b>
          <p>{recommendation?.code || "No target"} · {recommendation?.name || "No recommendation yet"}</p>
        </div>
        <div>
          <b>Assessment evidence</b>
          <p>{result.responses.length} answers, {reviewItems.length} review signal{reviewItems.length === 1 ? "" : "s"}.</p>
        </div>
        <div>
          <b>Mastery evidence</b>
          <p>{latestMastery ? `${latestMastery.correct ? "Passed" : "Needs practice"} with answer ${latestMastery.answer}` : "Not attempted yet."}</p>
        </div>
      </div>
    </div>
  );
}

export default function AssessmentV2AlgebraPage() {
  const [phase, setPhase] = useState<DemoPhase>("intro");
  const [session, setSession] = useState<AssessmentV2SessionResponse | null>(null);
  const [result, setResult] = useState<AssessmentV2Result | null>(null);
  const [answer, setAnswer] = useState<AnswerState>(emptyAnswer);
  const [masteryAnswer, setMasteryAnswer] = useState<AnswerState>(emptyAnswer);
  const [masteryPassed, setMasteryPassed] = useState(false);
  const [masteryFeedback, setMasteryFeedback] = useState<string | null>(null);
  const [studentLabel, setStudentLabel] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [shareMessage, setShareMessage] = useState<string | null>(null);

  const item = session?.item ?? null;
  const activeSessionId = result?.session_id !== "pitch-demo" ? result?.session_id : session?.session_id;
  const recommendation = useMemo(() => pickRecommendation(result), [result]);
  const lesson = useMemo(() => activeLesson(result, recommendation), [result, recommendation]);
  const persistedMasteryPassed = result?.learning_loop?.mastery_status === "passed";
  const displayedMasteryPassed = masteryPassed || persistedMasteryPassed;
  const progress = useMemo(() => {
    if (!session) return "";
    return `Question ${session.question_number ?? 1} of up to ${session.max_questions}`;
  }, [session]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const sessionId = new URL(window.location.href).searchParams.get("session");
    if (!sessionId) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    getAssessmentV2Session(sessionId)
      .then((loaded) => {
        if (cancelled) return;
        if (isAssessmentResult(loaded)) {
          setResult(loaded);
          setSession(null);
          setMasteryPassed(loaded.learning_loop?.mastery_status === "passed");
          setPhase(loaded.learning_loop?.mastery_status === "passed" ? "updated" : "map");
        } else {
          setResult(null);
          setSession(loaded as AssessmentV2SessionResponse);
          setMasteryPassed(false);
          setPhase("assessment");
        }
      })
      .catch((e) => {
        if (cancelled) return;
        setError(e instanceof Error ? e.message : "Could not load saved session");
        writeSessionToUrl(null);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  async function start() {
    setLoading(true);
    setError(null);
    setMasteryPassed(false);
    setMasteryFeedback(null);
    try {
      const created = await createAssessmentV2Session({ max_questions: 35, student_label: studentLabel || undefined });
      setPhase("assessment");
      setSession(created);
      setResult(null);
      setAnswer(emptyAnswer);
      writeSessionToUrl(created.session_id);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not start assessment");
    } finally {
      setLoading(false);
    }
  }

  function launchDemo() {
    setPhase("map");
    setResult(MOCK_DEMO_RESULT);
    setSession(null);
    setAnswer(emptyAnswer);
    setMasteryAnswer(emptyAnswer);
    setMasteryPassed(false);
    setMasteryFeedback(null);
    setError(null);
    writeSessionToUrl(null);
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
        setPhase("map");
        writeSessionToUrl((response as AssessmentV2Result).session_id);
      } else {
        setSession(response as AssessmentV2SessionResponse);
        setPhase("assessment");
        writeSessionToUrl((response as AssessmentV2SessionResponse).session_id);
      }
      setAnswer(emptyAnswer);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not submit answer");
    } finally {
      setLoading(false);
    }
  }

  async function submitMastery() {
    const response = answerText(masteryAnswer, lesson.mastery.widget === "raw" ? undefined : lesson.mastery.widget);
    if (answerMatches(response, lesson.mastery.accepted)) {
      setMasteryPassed(true);
      setMasteryFeedback("Mastery confirmed. The knowledge map can now move this skill into the strong area.");
      if (result && result.session_id !== "pitch-demo") {
        setLoading(true);
        try {
          const updated = await submitAssessmentV2Mastery(result.session_id, {
            answer: answerPayload(masteryAnswer, lesson.mastery.widget === "raw" ? undefined : lesson.mastery.widget),
          });
          setResult(updated);
          writeSessionToUrl(updated.session_id);
        } catch (e) {
          setMasteryFeedback(e instanceof Error ? e.message : "Mastery saved locally, but could not persist to the session.");
        } finally {
          setLoading(false);
        }
      }
      setPhase("updated");
      return;
    }
    setMasteryFeedback("Not yet. The answer is close enough to learn from, so the demo keeps the student in this lesson loop.");
    if (result && result.session_id !== "pitch-demo") {
      setLoading(true);
      try {
        const updated = await submitAssessmentV2Mastery(result.session_id, {
          answer: answerPayload(masteryAnswer, lesson.mastery.widget === "raw" ? undefined : lesson.mastery.widget),
        });
        setResult(updated);
        writeSessionToUrl(updated.session_id);
      } catch {
        // The visible feedback above is the important student-facing state for a wrong answer.
      } finally {
        setLoading(false);
      }
    }
  }

  function resetAll() {
    setPhase("intro");
    setSession(null);
    setResult(null);
    setAnswer(emptyAnswer);
    setMasteryAnswer(emptyAnswer);
    setMasteryPassed(false);
    setMasteryFeedback(null);
    setError(null);
    setShareMessage(null);
    writeSessionToUrl(null);
  }

  async function copySessionLink() {
    if (!activeSessionId) {
      setShareMessage("Start or load a real session first.");
      return;
    }
    const url = currentSessionUrl(activeSessionId);
    try {
      await navigator.clipboard.writeText(url);
      setShareMessage("Session link copied.");
    } catch {
      setShareMessage(url);
    }
  }

  return (
    <main className="assessment-v2-demo">
      <style jsx>{`
        .assessment-v2-demo {
          min-height: 100vh;
          overflow: auto;
          background:
            radial-gradient(circle at 16% 12%, rgba(48, 101, 246, 0.12), transparent 28%),
            linear-gradient(180deg, #ffffff 0%, #f6f8ff 50%, #eef4ff 100%);
          color: #202738;
          display: grid;
          grid-template-columns: minmax(270px, 360px) 1fr;
          letter-spacing: 0;
        }
        .brand-panel {
          position: sticky;
          top: 0;
          height: 100vh;
          background: #ffffff;
          border-right: 1px solid #e3e9f7;
          padding: 32px 28px;
          display: flex;
          flex-direction: column;
          gap: 22px;
        }
        .brand {
          display: flex;
          align-items: center;
          gap: 12px;
          color: #2589ff;
          font-size: 28px;
          font-weight: 800;
        }
        .brand-mark {
          width: 42px;
          height: 42px;
          display: grid;
          place-items: center;
          border-radius: 14px;
          background: #eef5ff;
          border: 1px solid #d8e7ff;
          color: #2f66f5;
        }
        .tagline {
          display: inline-flex;
          width: fit-content;
          align-items: center;
          gap: 6px;
          color: #1d2939;
          background: #fff8df;
          border: 1px solid #ffe4a3;
          border-radius: 999px;
          padding: 8px 12px;
          font-size: 13px;
          font-weight: 800;
        }
        .side-copy h1 {
          margin: 0;
          color: #202738;
          font-size: 34px;
          line-height: 1.08;
        }
        .side-copy p,
        .muted {
          color: #697386;
          line-height: 1.55;
        }
        .side-copy {
          display: grid;
          gap: 14px;
        }
        .side-stat {
          display: grid;
          gap: 12px;
        }
        .stat-pill {
          display: grid;
          gap: 4px;
          border: 1px solid #dfe7f7;
          background: #f8fbff;
          border-radius: 20px;
          padding: 16px;
          box-shadow: 0 14px 34px rgba(47, 102, 245, 0.08);
        }
        .stat-pill strong {
          color: #2f66f5;
          font-size: 26px;
        }
        .stat-pill span {
          color: #697386;
          font-weight: 650;
        }
        .main-stage {
          padding: 36px;
          display: grid;
          gap: 22px;
          align-content: start;
        }
        .topbar {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 18px;
          max-width: 1180px;
          width: 100%;
          margin: 0 auto;
        }
        .share-toast {
          max-width: 1180px;
          width: 100%;
          margin: -8px auto 0;
          border: 1px solid #cfe0ff;
          background: #eef5ff;
          color: #2f66f5;
          border-radius: 18px;
          padding: 12px 14px;
          font-weight: 800;
          overflow-wrap: anywhere;
        }
        .step-rail {
          display: flex;
          gap: 8px;
          flex-wrap: wrap;
        }
        .rail-step {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          padding: 8px 10px;
          border-radius: 999px;
          border: 1px solid #dfe7f7;
          background: rgba(255,255,255,0.72);
          color: #8792a6;
          font-size: 13px;
        }
        .rail-step.active {
          color: #2f66f5;
          background: #eef5ff;
          border-color: #bcd4ff;
        }
        .shell {
          max-width: 1180px;
          width: 100%;
          margin: 0 auto;
          background: rgba(255,255,255,0.92);
          border: 1px solid #dfe7f7;
          border-radius: 28px;
          box-shadow: 0 24px 70px rgba(38, 82, 181, 0.13);
          padding: 28px;
        }
        .hero-grid,
        .result-grid,
        .lesson-grid {
          display: grid;
          grid-template-columns: minmax(0, 1.04fr) minmax(320px, 0.96fr);
          gap: 28px;
          align-items: stretch;
        }
        .hero-copy {
          display: grid;
          align-content: center;
          gap: 18px;
          min-height: 510px;
        }
        .eyebrow {
          display: inline-flex;
          align-items: center;
          gap: 7px;
          width: fit-content;
          color: #2f66f5;
          background: #eef5ff;
          border: 1px solid #cfe0ff;
          border-radius: 999px;
          padding: 8px 12px;
          font-weight: 800;
          font-size: 13px;
        }
        .eyebrow.small {
          padding: 6px 10px;
          font-size: 12px;
        }
        h2 {
          margin: 0;
          color: #202738;
          font-size: 44px;
          line-height: 1.06;
        }
        h3 {
          margin: 0;
          color: #202738;
          font-size: 22px;
        }
        .hero-copy p {
          margin: 0;
          color: #697386;
          font-size: 18px;
          line-height: 1.55;
        }
        .input-card {
          display: grid;
          gap: 12px;
          padding: 16px;
          border-radius: 22px;
          background: #f8fbff;
          border: 1px solid #dfe7f7;
        }
        .label-input,
        .answer-input {
          width: 100%;
          border: 1px solid #d6def0;
          border-radius: 18px;
          padding: 16px 18px;
          font-size: 18px;
          color: #202738;
          background: white;
          outline: none;
        }
        .answer-input.large {
          min-height: 70px;
          font-size: 22px;
        }
        .label-input:focus,
        .answer-input:focus,
        .fraction-input input:focus,
        .power-input input:focus,
        .ordered-input input:focus {
          border-color: #2f66f5;
          box-shadow: 0 0 0 4px rgba(47, 102, 245, 0.14);
        }
        .actions {
          display: flex;
          gap: 12px;
          flex-wrap: wrap;
          align-items: center;
        }
        button {
          border: 0;
          border-radius: 18px;
          padding: 13px 18px;
          font-size: 15px;
          font-weight: 800;
          cursor: pointer;
          display: inline-flex;
          align-items: center;
          gap: 8px;
          transition: transform .16s ease, box-shadow .16s ease, background .16s ease;
        }
        button:hover:not(:disabled) {
          transform: translateY(-1px);
        }
        button.primary {
          background: #2f66f5;
          color: white;
          box-shadow: 0 16px 34px rgba(47, 102, 245, 0.24);
        }
        button.secondary {
          background: #edf2fb;
          color: #202738;
        }
        button.ghost {
          background: white;
          color: #2f66f5;
          border: 1px solid #cfe0ff;
        }
        button:disabled {
          opacity: .55;
          cursor: not-allowed;
          transform: none;
          box-shadow: none;
        }
        .demo-orbit {
          position: relative;
          min-height: 510px;
          border-radius: 26px;
          background:
            linear-gradient(135deg, #eef5ff 0%, #ffffff 48%, #fff8df 100%);
          border: 1px solid #dfe7f7;
          overflow: hidden;
          padding: 24px;
        }
        .demo-orbit::before {
          content: "";
          position: absolute;
          inset: 38px;
          border: 2px dashed rgba(47, 102, 245, 0.18);
          border-radius: 999px;
        }
        .orbit-card {
          position: absolute;
          width: 210px;
          min-height: 118px;
          padding: 16px;
          border-radius: 22px;
          background: rgba(255,255,255,0.92);
          border: 1px solid #dfe7f7;
          box-shadow: 0 18px 44px rgba(38, 82, 181, 0.12);
          display: grid;
          gap: 8px;
        }
        .orbit-card b {
          color: #202738;
        }
        .orbit-card span {
          color: #697386;
          font-size: 13px;
          line-height: 1.4;
        }
        .orbit-card.one { left: 28px; top: 34px; }
        .orbit-card.two { right: 34px; top: 120px; }
        .orbit-card.three { left: 58px; bottom: 56px; }
        .orbit-card.four { right: 60px; bottom: 36px; }
        .center-badge {
          position: absolute;
          left: 50%;
          top: 50%;
          transform: translate(-50%, -50%);
          width: 170px;
          height: 170px;
          border-radius: 50%;
          background: #2f66f5;
          color: white;
          display: grid;
          place-items: center;
          text-align: center;
          padding: 20px;
          box-shadow: 0 24px 60px rgba(47, 102, 245, 0.34);
          font-weight: 900;
        }
        .question-panel {
          display: grid;
          gap: 24px;
          max-width: 900px;
          margin: 0 auto;
        }
        .topline {
          display: flex;
          justify-content: space-between;
          gap: 12px;
          align-items: center;
          color: #697386;
          font-weight: 700;
        }
        .chip {
          border: 1px solid #cfe0ff;
          border-radius: 999px;
          padding: 8px 12px;
          font-size: 13px;
          color: #40506a;
          background: #f8fbff;
        }
        .question-title {
          display: grid;
          gap: 12px;
        }
        .question-title h2 {
          font-size: 32px;
        }
        .question-text {
          font-size: 30px;
          line-height: 1.32;
          color: #202738;
          margin: 0;
        }
        .fraction-input {
          width: 230px;
          display: grid;
          gap: 8px;
        }
        .fraction-input.large {
          width: 280px;
        }
        .fraction-input input,
        .power-input input,
        .ordered-input input {
          border: 1px solid #d6def0;
          border-radius: 16px;
          padding: 14px;
          font-size: 20px;
          text-align: center;
          color: #202738;
          outline: none;
        }
        .fraction-line {
          height: 3px;
          background: #202738;
          border-radius: 999px;
        }
        .power-input,
        .ordered-input {
          display: flex;
          gap: 10px;
          align-items: center;
          flex-wrap: wrap;
        }
        .power-input span,
        .ordered-input span {
          font-size: 22px;
          color: #697386;
        }
        .error,
        .feedback {
          color: #b42318;
          background: #fff1f0;
          border: 1px solid #ffd2cc;
          padding: 12px 14px;
          border-radius: 16px;
          line-height: 1.45;
        }
        .feedback.success {
          color: #087443;
          background: #ecfdf3;
          border-color: #b7f0ce;
        }
        .value-grid {
          display: grid;
          grid-template-columns: repeat(4, minmax(0, 1fr));
          gap: 12px;
        }
        .pitch-proof {
          max-width: 1180px;
          width: 100%;
          margin: 0 auto;
          display: grid;
          grid-template-columns: repeat(4, minmax(0, 1fr));
          gap: 12px;
        }
        .proof-card {
          min-height: 156px;
          border: 1px solid #dfe7f7;
          border-radius: 24px;
          background: rgba(255,255,255,0.92);
          padding: 18px;
          display: grid;
          align-content: start;
          gap: 10px;
          box-shadow: 0 18px 48px rgba(38, 82, 181, 0.08);
        }
        .proof-card b {
          color: #202738;
          font-size: 18px;
        }
        .proof-card p {
          color: #697386;
          line-height: 1.45;
        }
        .proof-icon {
          width: 38px;
          height: 38px;
          display: grid;
          place-items: center;
          border-radius: 14px;
        }
        .proof-icon.blue { color: #2f66f5; background: #eef5ff; }
        .proof-icon.orange { color: #c77700; background: #fff8e6; }
        .proof-icon.red { color: #d92d20; background: #fff3f1; }
        .proof-icon.green { color: #087443; background: #effdf5; }
        .outcome-grid {
          max-width: 1180px;
          width: 100%;
          margin: 0 auto;
          display: grid;
          grid-template-columns: repeat(3, minmax(0, 1fr));
          gap: 12px;
        }
        .outcome-card {
          min-height: 210px;
          border-radius: 26px;
          padding: 22px;
          border: 1px solid #dfe7f7;
          display: grid;
          align-content: start;
          gap: 12px;
          background: #ffffff;
          box-shadow: 0 18px 48px rgba(38, 82, 181, 0.08);
        }
        .outcome-card.student {
          background: linear-gradient(135deg, #eef5ff, #ffffff);
        }
        .outcome-card.teacher {
          background: linear-gradient(135deg, #effdf5, #ffffff);
        }
        .outcome-card.pitch {
          background: linear-gradient(135deg, #fff8df, #ffffff);
        }
        .outcome-card p {
          color: #697386;
          line-height: 1.48;
        }
        .teacher-summary {
          max-width: 1180px;
          width: 100%;
          margin: 0 auto;
          border: 1px solid #dfe7f7;
          border-radius: 26px;
          background: rgba(255,255,255,0.94);
          padding: 20px;
          display: grid;
          gap: 16px;
          box-shadow: 0 18px 48px rgba(38, 82, 181, 0.08);
        }
        .teacher-summary-head {
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 12px;
          flex-wrap: wrap;
        }
        .session-code {
          color: #697386;
          font-weight: 900;
          background: #f8fbff;
          border: 1px solid #dfe7f7;
          border-radius: 999px;
          padding: 7px 10px;
        }
        .teacher-facts {
          display: grid;
          grid-template-columns: repeat(3, minmax(0, 1fr));
          gap: 12px;
        }
        .teacher-facts div {
          border-radius: 20px;
          border: 1px solid #e2e9f7;
          background: #f8fbff;
          padding: 14px;
          display: grid;
          gap: 6px;
        }
        .teacher-facts b {
          color: #202738;
        }
        .teacher-facts p {
          color: #697386;
          line-height: 1.4;
        }
        .metric-card {
          border: 1px solid #dfe7f7;
          border-radius: 22px;
          padding: 18px;
          background: #16233c;
          color: white;
          min-height: 112px;
          display: grid;
          align-content: end;
        }
        .metric-card strong {
          font-size: 38px;
          line-height: 1;
          color: #8fc1ff;
        }
        .metric-card span {
          color: #dce8ff;
          font-weight: 750;
        }
        .map-board {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 12px;
        }
        .map-node {
          min-height: 132px;
          border-radius: 22px;
          padding: 14px;
          border: 2px solid transparent;
          background: #f6f8fc;
          display: grid;
          gap: 8px;
          animation: popIn .24s ease both;
          animation-delay: var(--delay);
        }
        .map-node.green { background: #effdf5; border-color: #b8eecf; }
        .map-node.red { background: #fff3f1; border-color: #ffc9c1; }
        .map-node.orange { background: #fff8e6; border-color: #ffe19a; }
        .map-node.gray { background: #f4f6fa; border-color: #dfe7f7; }
        .map-node.selected {
          box-shadow: 0 0 0 4px rgba(47, 102, 245, .13), 0 18px 40px rgba(47, 102, 245, .16);
          border-color: #2f66f5;
        }
        .node-code {
          color: #2f66f5;
          font-size: 11px;
          font-weight: 900;
        }
        .map-node strong {
          color: #202738;
          line-height: 1.25;
        }
        .node-bottom {
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 8px;
          color: #697386;
          font-size: 13px;
          margin-top: auto;
        }
        .node-bottom b {
          color: #202738;
        }
        .recommend-card,
        .lesson-card,
        .evidence-panel {
          border: 1px solid #dfe7f7;
          background: #f8fbff;
          border-radius: 24px;
          padding: 20px;
          display: grid;
          gap: 14px;
        }
        .recommend-card {
          background: linear-gradient(135deg, #eef5ff, #ffffff);
        }
        .recommend-card h3,
        .lesson-card h3,
        .evidence-panel h3 {
          display: flex;
          align-items: center;
          gap: 8px;
        }
        .recommend-kc {
          display: grid;
          gap: 6px;
          padding: 16px;
          border-radius: 20px;
          background: white;
          border: 1px solid #dfe7f7;
        }
        .recommend-kc strong {
          color: #202738;
          font-size: 18px;
        }
        .result-section {
          border-top: 1px solid #e7edf8;
          padding-top: 18px;
          display: grid;
          gap: 12px;
        }
        .result-section.compact {
          border: 0;
          padding: 0;
        }
        .result-list {
          display: grid;
          gap: 10px;
        }
        .result-row {
          display: grid;
          grid-template-columns: auto 1fr auto;
          gap: 10px;
          align-items: center;
          border: 1px solid #e2e9f7;
          border-radius: 18px;
          padding: 12px;
          background: white;
        }
        .result-row p {
          margin: 2px 0 0;
          color: #697386;
        }
        .dot {
          width: 12px;
          height: 12px;
          border-radius: 999px;
          display: inline-block;
        }
        .dot.green { background: #18b66a; }
        .dot.red { background: #f04438; }
        .dot.orange { background: #f5a524; }
        .dot.gray { background: #98a2b3; }
        .dot.blue { background: #2f66f5; }
        .prob {
          color: #40506a;
          font-weight: 900;
        }
        .lesson-copy {
          display: grid;
          gap: 16px;
        }
        .lesson-copy h2 {
          font-size: 36px;
        }
        .lesson-steps {
          display: grid;
          gap: 10px;
        }
        .lesson-step {
          display: grid;
          grid-template-columns: 34px 1fr;
          gap: 10px;
          align-items: start;
          background: white;
          border: 1px solid #e2e9f7;
          border-radius: 18px;
          padding: 12px;
        }
        .lesson-step span {
          width: 34px;
          height: 34px;
          display: grid;
          place-items: center;
          border-radius: 50%;
          background: #2f66f5;
          color: white;
          font-weight: 900;
        }
        .mastery-box {
          display: grid;
          gap: 16px;
          background: #ffffff;
          border: 1px solid #dfe7f7;
          border-radius: 24px;
          padding: 22px;
        }
        .mini-transcript {
          display: grid;
          gap: 10px;
          max-height: 380px;
          overflow: auto;
          padding-right: 4px;
        }
        .transcript-row {
          border: 1px solid #e2e9f7;
          border-radius: 18px;
          padding: 12px;
          background: white;
          display: grid;
          gap: 8px;
        }
        .transcript-top {
          display: flex;
          justify-content: space-between;
          gap: 10px;
          color: #697386;
          font-size: 13px;
          font-weight: 800;
        }
        .transcript-row p {
          color: #202738;
          line-height: 1.35;
        }
        @keyframes popIn {
          from { opacity: 0; transform: translateY(8px) scale(.98); }
          to { opacity: 1; transform: translateY(0) scale(1); }
        }
        @media (max-width: 980px) {
          .assessment-v2-demo {
            grid-template-columns: 1fr;
          }
          .brand-panel {
            position: relative;
            height: auto;
          }
          .hero-grid,
          .result-grid,
          .lesson-grid {
            grid-template-columns: 1fr;
          }
          .main-stage {
            padding: 18px;
          }
          .shell {
            padding: 20px;
            border-radius: 22px;
          }
          .value-grid,
          .map-board,
          .pitch-proof,
          .outcome-grid,
          .teacher-facts {
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }
          h2 {
            font-size: 34px;
          }
          .question-text {
            font-size: 24px;
          }
        }
        @media (max-width: 620px) {
          .value-grid,
          .map-board,
          .pitch-proof,
          .outcome-grid,
          .teacher-facts {
            grid-template-columns: 1fr;
          }
          .demo-orbit {
            display: none;
          }
          .hero-copy {
            min-height: auto;
          }
          .topbar {
            align-items: flex-start;
            flex-direction: column;
          }
        }
      `}</style>

      <aside className="brand-panel">
        <div className="brand">
          <span className="brand-mark"><Brain size={25} /></span>
          <span>Wizzdom</span>
        </div>
        <div className="tagline"><Sparkles size={15} /> Cham sau - Day tot</div>
        <div className="side-copy">
          <h1>Adaptive algebra learning loop</h1>
          <p>Diagnose, teach, verify, and update the knowledge map in one student flow.</p>
        </div>
        <div className="side-stat">
          <div className="stat-pill"><strong>Open</strong><span>short math answers</span></div>
          <div className="stat-pill"><strong>Graph</strong><span>knowledge state map</span></div>
          <div className="stat-pill"><strong>Loop</strong><span>learn then mastery check</span></div>
        </div>
      </aside>

      <section className="main-stage">
        <div className="topbar">
          <StepRail phase={phase} />
          <div className="actions">
            {activeSessionId && (
              <button className="ghost" onClick={() => void copySessionLink()} type="button"><Copy size={16} /> Copy session link</button>
            )}
            <button className="ghost" onClick={launchDemo} type="button"><Sparkles size={17} /> Pitch demo</button>
            <button className="secondary" onClick={resetAll} type="button"><RefreshCcw size={16} /> Reset</button>
          </div>
        </div>
        {shareMessage && <div className="share-toast">{shareMessage}</div>}

        {phase === "intro" && !session && !result && (
          <div className="shell hero-grid">
            <div className="hero-copy">
              <span className="eyebrow"><GraduationCap size={17} /> Grade 6 algebra pilot</span>
              <h2>From one diagnostic to a living learning map.</h2>
              <p>Students answer open-ended questions. Wizzdom finds the highest-leverage gap, teaches the missing step, checks mastery, then updates the map.</p>
              <div className="input-card">
                <input className="label-input" value={studentLabel} onChange={(event) => setStudentLabel(event.target.value)} placeholder="Student name or label (optional)" />
                {error && <div className="error">{error}</div>}
                <div className="actions">
                  <button className="primary" onClick={start} disabled={loading} type="button">
                    {loading ? "Starting..." : "Start real diagnostic"} <ArrowRight size={17} />
                  </button>
                  <button className="secondary" onClick={launchDemo} type="button"><Sparkles size={17} /> View pitch loop</button>
                </div>
              </div>
            </div>
            <div className="demo-orbit" aria-hidden="true">
              <div className="orbit-card one"><Target size={22} color="#2f66f5" /><b>Assessment</b><span>Ask fewer, smarter open questions.</span></div>
              <div className="orbit-card two"><Map size={22} color="#2f66f5" /><b>Knowledge map</b><span>Strong, review, affected, unknown.</span></div>
              <div className="orbit-card three"><BookOpen size={22} color="#2f66f5" /><b>Micro lesson</b><span>Teach the exact missing step.</span></div>
              <div className="orbit-card four"><Trophy size={22} color="#2f66f5" /><b>Mastery</b><span>Verify and unlock what comes next.</span></div>
              <div className="center-badge">Full learning loop</div>
            </div>
          </div>
        )}

        {session && item && (
          <form className="shell question-panel" onSubmit={(event) => { event.preventDefault(); void submit("answer"); }}>
            <div className="topline">
              <span>{progress}</span>
              <span className="chip">{item.kc_code}</span>
            </div>
            <div className="question-title">
              <h2>{item.kc_name}</h2>
              <p className="muted">No immediate correctness feedback. The next question is selected from the graph after this answer.</p>
            </div>
            <p className="question-text">{item.question}</p>
            <MathInput item={item} answer={answer} setAnswer={setAnswer} large />
            {error && <div className="error">{error}</div>}
            <div className="actions">
              <button className="primary" type="submit" disabled={loading}>{loading ? "Submitting..." : "Submit answer"} <ArrowRight size={17} /></button>
              <button className="secondary" type="button" disabled={loading} onClick={() => void submit("unknown")}><HelpCircle size={17} /> I don't know</button>
            </div>
          </form>
        )}

        {result && (phase === "map" || phase === "updated") && (
          <div className="shell result-grid">
            <div className="lesson-copy">
              <span className="eyebrow"><Map size={17} /> Knowledge map outcome</span>
              <h2>{phase === "updated" ? "Map updated after mastery." : "Here is what the system learned."}</h2>
              <p className="muted">The student result separates direct evidence from graph inference. The demo then chooses one high-impact skill to learn next.</p>
              <div className="value-grid">
                <div className="metric-card"><strong>{result.summary.value_metrics.questions_asked}</strong><span>questions asked</span></div>
                <div className="metric-card"><strong>{result.summary.value_metrics.skills_directly_tested}</strong><span>skills tested</span></div>
                <div className="metric-card"><strong>{result.summary.value_metrics.skills_inferred}</strong><span>skills inferred</span></div>
                <div className="metric-card"><strong>{result.summary.value_metrics.skills_not_directly_asked}</strong><span>not directly asked</span></div>
              </div>
              <div className="recommend-card">
                <h3><Target size={20} /> Recommended next step</h3>
                {recommendation ? (
                  <div className="recommend-kc">
                    <span className="node-code">{recommendation.code}</span>
                    <strong>{displayedMasteryPassed ? `${recommendation.name} is now stronger` : recommendation.name}</strong>
                    <p className="muted">{displayedMasteryPassed ? "Mastery check passed, so the map can open the next frontier." : "Chosen because it is a high-leverage gap near prerequisite chains."}</p>
                  </div>
                ) : <p className="muted">No recommendation available.</p>}
                <div className="actions">
                  {!displayedMasteryPassed && <button className="primary" type="button" onClick={() => setPhase("lesson")}>Start targeted lesson <ArrowRight size={17} /></button>}
                  {displayedMasteryPassed && <button className="secondary" type="button" onClick={resetAll}>Start another student</button>}
                </div>
              </div>
            </div>
            <KnowledgeMap result={result} recommendation={recommendation} masteryPassed={displayedMasteryPassed} />
          </div>
        )}

        {result && (phase === "map" || phase === "updated") && (
          <>
            <PitchProof result={result} recommendation={recommendation} masteryPassed={displayedMasteryPassed} />
            <OutcomeNarrative result={result} recommendation={recommendation} masteryPassed={displayedMasteryPassed} />
            <TeacherEvidenceSummary result={result} recommendation={recommendation} />
          </>
        )}

        {result && phase === "lesson" && (
          <div className="shell lesson-grid">
            <div className="lesson-copy">
              <span className="eyebrow"><BookOpen size={17} /> Targeted micro lesson</span>
              <h2>{lesson.title}</h2>
              <p className="muted">{lesson.subtitle}</p>
              <div className="lesson-card">
                <h3><Brain size={20} /> Core idea</h3>
                <p>{lesson.concept}</p>
              </div>
              <div className="lesson-steps">
                {lesson.workedExample.map((step, index) => (
                  <div className="lesson-step" key={step}>
                    <span>{index + 1}</span>
                    <p>{step}</p>
                  </div>
                ))}
              </div>
              <div className="lesson-card">
                <h3><CheckCircle2 size={20} /> Guided practice</h3>
                <p>{lesson.practicePrompt}</p>
              </div>
              <div className="actions">
                <button className="primary" type="button" onClick={() => setPhase("mastery")}>Go to mastery check <ArrowRight size={17} /></button>
                <button className="secondary" type="button" onClick={() => setPhase("map")}>Back to map</button>
              </div>
            </div>
            <div className="evidence-panel">
              <h3><Target size={20} /> Why this lesson</h3>
              <p className="muted">The selected skill is the smallest useful step that can unblock nearby skills. In the full product, this panel will cite the exact assessment item, graph edge, and misconception.</p>
              <ResultList title="Skills to review" rows={result.summary.skills_to_review.slice(0, 4)} tone="red" compact />
              <ResultList title="Possibly affected" rows={result.summary.possibly_affected.slice(0, 4)} tone="orange" compact />
            </div>
          </div>
        )}

        {result && phase === "lesson" && (
          <PitchProof result={result} recommendation={recommendation} masteryPassed={displayedMasteryPassed} />
        )}

        {result && phase === "mastery" && (
          <div className="shell lesson-grid">
            <div className="lesson-copy">
              <span className="eyebrow"><BadgeCheck size={17} /> Mastery test</span>
              <h2>Check whether the lesson worked.</h2>
              <p className="muted">This is narrower than the diagnostic. It verifies the target skill before updating the map.</p>
              <div className="mastery-box">
                <h3>{lesson.mastery.prompt}</h3>
                <p className="muted">{lesson.mastery.hint}</p>
                <MathInput item={{ answer_widget: lesson.mastery.widget === "raw" ? "number" : lesson.mastery.widget }} answer={masteryAnswer} setAnswer={setMasteryAnswer} large />
                {masteryFeedback && <div className={`feedback ${displayedMasteryPassed ? "success" : ""}`}>{masteryFeedback}</div>}
                <div className="actions">
                  <button className="primary" type="button" onClick={() => void submitMastery()} disabled={loading}>
                    {loading ? "Saving..." : "Submit mastery answer"} <ArrowRight size={17} />
                  </button>
                  <button className="secondary" type="button" onClick={() => setPhase("lesson")}>Review lesson</button>
                </div>
              </div>
            </div>
            <KnowledgeMap result={result} recommendation={recommendation} masteryPassed={displayedMasteryPassed} />
          </div>
        )}

        {result && (
          <div className="shell">
            <div className="evidence-panel">
              <h3><BadgeCheck size={20} /> Assessment transcript</h3>
              <div className="mini-transcript">
                {result.responses.slice(0, 12).map((response) => (
                  <div className="transcript-row" key={`${response.step}-${response.item.item_id}`}>
                    <div className="transcript-top">
                      <span>#{response.step} {response.item.kc_code}</span>
                      <span>{response.response_type === "unknown" ? "I don't know" : response.grading.is_correct ? "correct" : "review"}</span>
                    </div>
                    <p>{response.item.question}</p>
                    <p className="muted">Answer: {response.answer || "empty"} · Rule: {response.grading.matched_rule || "n/a"}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </section>
    </main>
  );
}
