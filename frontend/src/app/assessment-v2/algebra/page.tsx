"use client";
// ─── Assessment V2 — Algebra Page ─────────────────────────────────────────────
// Self-contained page mirroring reference app interface 100%, replacing mock data with API data where appropriate.
// Implements unified learning loop: Assess → Map → Learn → Mastery → Outcome
// Dual mode: Real Live API (default) + Pitch Demo (with auto-advance)

import { useState, useEffect, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowRight, Check, RotateCcw, Zap, Play, Pause, HelpCircle, GraduationCap } from "lucide-react";
import { B, NUNITO, INTER, MONO } from "@/components/wizzdom/design-tokens";
import { KnowledgeMap } from "@/components/wizzdom/KnowledgeMap";
import {
  FractionWidget, MathAnswerWidget, MathWidgetShowcase,
  isFractionReady, serializeFraction,
  type FractionWidgetState, type WidgetType,
} from "@/components/wizzdom/MathWidgets";
import { Frac, FractionBar, StepCircle, WizzdomLogo, StepBar, PitchBar } from "@/components/wizzdom/MathDisplay";
import type {
  AssessmentV2Item, AssessmentV2SessionResponse, AssessmentV2Result,
} from "@/lib/assessment-v2-api";
import {
  createAssessmentV2Session, submitAssessmentV2Response, submitAssessmentV2Mastery,
} from "@/lib/assessment-v2-api";
import { adaptSummaryToSkills, findTargetNodeId, findOutcomeNodeIds } from "@/lib/map-adapter";
import { PITCH_RESULT, PITCH_POST_MASTERY, PITCH_ASSESS_QUESTION, PITCH_MCQ } from "@/lib/pitch-mock-data";

type Phase = "assess" | "map" | "lesson" | "mastery" | "outcome";

const PHASE_TO_STEP: Record<Phase, number> = {
  assess: 0,
  map: 1,
  lesson: 2,
  mastery: 3,
  outcome: 4,
};

// ──────────────────────────────────────────────────────────────────────────────
// ─── STEP 0: AssessStep Component ─────────────────────────────────────────────
// ──────────────────────────────────────────────────────────────────────────────
interface AssessStepProps {
  pitchMode: boolean;
  onComplete: (result: AssessmentV2Result, sessionId: string) => void;
}

type AssessPhase = "question" | "adapting" | "processing";

function AssessStep({ pitchMode, onComplete }: AssessStepProps) {
  const [phase, setPhase] = useState<AssessPhase>("question");
  const [showWidgets, setShowWidgets] = useState(false);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [currentItem, setCurrentItem] = useState<AssessmentV2Item | null>(null);
  const [questionNumber, setQuestionNumber] = useState(1);
  const [maxQuestions, setMaxQuestions] = useState(12);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Widget States
  const [fracState, setFracState] = useState<FractionWidgetState>({ num: "", den: "" });
  const [textState, setTextState] = useState("");
  const [mixedState, setMixedState] = useState({ whole: "", num: "", den: "" });
  const [powerState, setPowerState] = useState({ base: "", exp: "" });
  const [sqrtState, setSqrtState] = useState({ val: "" });
  const [inequalityState, setInequalityState] = useState({ sign: "" });
  const [coordinateState, setCoordinateState] = useState({ x: "", y: "" });

  const widgetType = ((currentItem?.answer_widget ?? "number") as WidgetType);
  const isFracWidget = widgetType === "fraction";

  // Check Readiness
  let isReady = false;
  if (widgetType === "fraction") {
    isReady = isFractionReady(fracState);
  } else if (widgetType === "mixed_number") {
    isReady = mixedState.whole.trim() !== "" && mixedState.num.trim() !== "" && mixedState.den.trim() !== "" && mixedState.den !== "0";
  } else if (widgetType === "power") {
    isReady = powerState.base.trim() !== "" && powerState.exp.trim() !== "";
  } else if (widgetType === "sqrt") {
    isReady = sqrtState.val.trim() !== "";
  } else if (widgetType === "inequality_sign") {
    isReady = inequalityState.sign.trim() !== "";
  } else if (widgetType === "coordinate") {
    isReady = coordinateState.x.trim() !== "" && coordinateState.y.trim() !== "";
  } else {
    isReady = textState.trim().length > 0;
  }

  const initialized = useRef(false);

  useEffect(() => {
    if (initialized.current) return;
    initialized.current = true;

    if (pitchMode) {
      setCurrentItem(PITCH_ASSESS_QUESTION as AssessmentV2Item);
      setQuestionNumber(7);
      setMaxQuestions(12);
      return;
    }

    createAssessmentV2Session({ max_questions: 12 })
      .then((res) => {
        setSessionId(res.session_id);
        setMaxQuestions(res.max_questions);
        if (res.item) {
          setCurrentItem(res.item);
          setQuestionNumber(res.question_number ?? 1);
        }
      })
      .catch((err) => setError(err.message));
  }, [pitchMode]);

  const advance = useCallback(
    (result?: AssessmentV2Result, sid?: string) => {
      setPhase("adapting");
      setTimeout(() => setPhase("processing"), 950);
      setTimeout(() => {
        if (pitchMode) {
          onComplete(PITCH_RESULT, "pitch-demo");
        } else if (result && sid) {
          onComplete(result, sid);
        }
      }, 950 + 1800);
    },
    [pitchMode, onComplete]
  );

  // Demo auto-advance simulation
  useEffect(() => {
    if (!pitchMode || phase !== "question" || !currentItem) return;
    
    const fillTimer = setTimeout(() => {
      setFracState({ num: "5", den: "4" });
    }, 1100);

    const submitTimer = setTimeout(() => {
      advance();
    }, 2700);

    return () => {
      clearTimeout(fillTimer);
      clearTimeout(submitTimer);
    };
  }, [pitchMode, phase, currentItem, advance]);

  const handleSubmit = async () => {
    if (pitchMode) { advance(); return; }
    if (!sessionId || !currentItem || submitting) return;

    let answer = "";
    if (widgetType === "fraction") answer = serializeFraction(fracState);
    else if (widgetType === "mixed_number") answer = `${mixedState.whole} ${mixedState.num}/${mixedState.den}`;
    else if (widgetType === "power") answer = `${powerState.base}^${powerState.exp}`;
    else if (widgetType === "sqrt") answer = `sqrt(${sqrtState.val})`;
    else if (widgetType === "inequality_sign") answer = inequalityState.sign;
    else if (widgetType === "coordinate") answer = `(${coordinateState.x},${coordinateState.y})`;
    else answer = textState;

    setSubmitting(true);
    try {
      const res = await submitAssessmentV2Response(sessionId, {
        item_id: currentItem.item_id,
        answer,
        response_type: "answer",
      });

      if (res.status === "completed") {
        advance(res as AssessmentV2Result, sessionId);
      } else {
        const next = res as AssessmentV2SessionResponse;
        if (next.item) {
          setCurrentItem(next.item);
          setQuestionNumber((n) => n + 1);
          setFracState({ num: "", den: "" });
          setTextState("");
          setMixedState({ whole: "", num: "", den: "" });
          setPowerState({ base: "", exp: "" });
          setSqrtState({ val: "" });
          setInequalityState({ sign: "" });
          setCoordinateState({ x: "", y: "" });
          setPhase("adapting");
          setTimeout(() => setPhase("question"), 950);
        }
      }
    } catch (err: unknown) {
      setError((err as Error).message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleSkip = async () => {
    if (pitchMode) { advance(); return; }
    if (!sessionId || !currentItem || submitting) return;
    setSubmitting(true);
    try {
      const res = await submitAssessmentV2Response(sessionId, {
        item_id: currentItem.item_id,
        response_type: "unknown",
      });
      if (res.status === "completed") {
        advance(res as AssessmentV2Result, sessionId);
      } else {
        const next = res as AssessmentV2SessionResponse;
        if (next.item) {
          setCurrentItem(next.item);
          setQuestionNumber((n) => n + 1);
          setFracState({ num: "", den: "" });
          setTextState("");
          setMixedState({ whole: "", num: "", den: "" });
          setPowerState({ base: "", exp: "" });
          setSqrtState({ val: "" });
          setInequalityState({ sign: "" });
          setCoordinateState({ x: "", y: "" });
          setPhase("adapting");
          setTimeout(() => setPhase("question"), 950);
        }
      }
    } catch (err: unknown) {
      setError((err as Error).message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0, y: -12 }}
      transition={{ duration: 0.4 }}
      className="flex flex-col items-center justify-center px-4"
      style={{ minHeight: "calc(100vh - 75px)" }}
    >
      <AnimatePresence mode="wait">
        {phase === "question" && (
          <motion.div
            key="q"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -14 }}
            transition={{ duration: 0.45 }}
            className="w-full max-w-md"
          >
            {/* Error */}
            {error && (
              <div className="mb-4 rounded-xl p-4 border text-sm leading-relaxed font-medium" style={{ backgroundColor: "#FFF2F2", borderColor: "rgba(239,68,68,0.3)", color: B.red }}>
                {error} — <button onClick={() => setError(null)} style={{ textDecoration: "underline", background: "none", border: "none", color: "inherit", cursor: "pointer" }}>thử lại</button>
              </div>
            )}

            {/* Progress */}
            <div className="flex items-center gap-3 mb-8">
              <span
                className="text-xs font-bold px-2.5 py-1 rounded-full"
                style={{ fontFamily: MONO, backgroundColor: B.blueLight, color: B.blue }}
              >
                Câu {questionNumber} / {maxQuestions}
              </span>
              <div className="flex gap-1 flex-1">
                {Array.from({ length: maxQuestions }, (_, i) => (
                  <div
                    key={i}
                    className="flex-1 h-1.5 rounded-full transition-colors duration-300"
                    style={{ backgroundColor: i < questionNumber ? B.blue : "#E5E7EB" }}
                  />
                ))}
              </div>
            </div>

            {/* Question card */}
            <div
              className="rounded-2xl p-7 mb-5 shadow-sm border"
              style={{ backgroundColor: B.white, borderColor: B.grayBorder }}
            >
              <p className="text-sm mb-5" style={{ fontFamily: INTER, color: B.textMuted }}>
                {currentItem?.kc_name || (pitchMode ? "Rút gọn biểu thức:" : "Câu hỏi chẩn đoán:")}
              </p>
              
              {pitchMode ? (
                <div className="flex items-center justify-center gap-4">
                  <Frac n={3} d={4} className="text-3xl" />
                  <span className="text-3xl font-light" style={{ color: B.textLight }}>+</span>
                  <Frac n={1} d={2} className="text-3xl" />
                  <span className="text-3xl font-light" style={{ color: B.textLight }}>=</span>
                  <span className="text-3xl font-bold" style={{ color: "#D1D5DB", fontFamily: NUNITO }}>?</span>
                </div>
              ) : (
                <p className="text-lg font-bold text-center" style={{ color: B.text, fontFamily: INTER, lineHeight: 1.5, margin: 0 }}>
                  {currentItem?.question || "Đang tải câu hỏi..."}
                </p>
              )}
            </div>

            {/* Answer widget card */}
            <div
              className="rounded-2xl p-7 mb-3 border-2 shadow-sm text-center"
              style={{
                backgroundColor: B.white,
                borderColor: isReady ? B.blue : B.grayBorder,
                transition: "border-color 0.2s",
              }}
            >
              <p className="text-xs font-semibold mb-5" style={{ fontFamily: NUNITO, color: B.textMuted }}>
                Nhập đáp án của bạn
              </p>
              <div className="flex justify-center mb-4">
                {pitchMode ? (
                  <FractionWidget num={fracState.num} den={fracState.den} onNumChange={(v) => setFracState(s => ({ ...s, num: v }))} onDenChange={(v) => setFracState(s => ({ ...s, den: v }))} size="lg" />
                ) : (
                  <MathAnswerWidget
                    widgetType={widgetType}
                    disabled={submitting}
                    onSubmit={handleSubmit}
                    fractionState={fracState}
                    onFractionChange={setFracState}
                    textState={textState}
                    onTextChange={setTextState}
                    mixedState={mixedState}
                    onMixedChange={setMixedState}
                    powerState={powerState}
                    onPowerChange={setPowerState}
                    sqrtState={sqrtState}
                    onSqrtChange={setSqrtState}
                    inequalityState={inequalityState}
                    onInequalityChange={setInequalityState}
                    coordinateState={coordinateState}
                    onCoordinateChange={setCoordinateState}
                  />
                )}
              </div>
              <p className="text-xs" style={{ fontFamily: MONO, color: B.textLight }}>
                {pitchMode || isFracWidget ? "Tab · ↑↓ để chuyển ô · Enter để nộp" : "Nhập đáp án và bấm Enter để nộp"}
              </p>
            </div>

            {/* Actions */}
            <div className="flex gap-2 mb-4">
              <button
                onClick={handleSubmit}
                disabled={!(pitchMode ? isFractionReady(fracState) : isReady) || submitting}
                className="flex-1 rounded-full py-4 font-bold text-base transition-all hover:opacity-90 active:scale-[0.98] disabled:opacity-25 disabled:cursor-not-allowed flex items-center justify-center gap-2 shadow-sm"
                style={{ backgroundColor: B.blue, color: B.white, fontFamily: NUNITO }}
              >
                Nộp bài <ArrowRight size={18} />
              </button>
              <button
                className="px-5 rounded-full border-2 font-semibold text-sm transition-all hover:opacity-70"
                style={{ borderColor: B.grayBorder, color: B.textMuted, fontFamily: NUNITO, backgroundColor: B.white }}
                onClick={handleSkip}
                disabled={submitting}
              >
                Không biết
              </button>
            </div>

            {/* Widget library link */}
            <button
              onClick={() => setShowWidgets(true)}
              className="w-full flex items-center justify-center gap-1.5 py-2.5 rounded-full transition-all hover:opacity-70"
              style={{ backgroundColor: B.blueLight }}
            >
              <HelpCircle size={13} style={{ color: B.blue }} />
              <span className="text-xs font-semibold" style={{ fontFamily: NUNITO, color: B.blue }}>
                Xem tất cả loại widget toán học
              </span>
            </button>
          </motion.div>
        )}

        {/* Adapting State */}
        {phase === "adapting" && (
          <motion.div
            key="adapt"
            initial={{ opacity: 0, scale: 0.97 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.35 }}
            className="text-center space-y-4 max-w-xs"
          >
            <div className="flex justify-center gap-2 mb-2">
              {[0, 0.15, 0.3].map((d) => (
                <motion.div
                  key={d}
                  className="w-2.5 h-2.5 rounded-full"
                  style={{ backgroundColor: B.orange }}
                  animate={{ y: [0, -8, 0], opacity: [0.5, 1, 0.5] }}
                  transition={{ duration: 0.9, repeat: Infinity, delay: d }}
                />
              ))}
            </div>
            <p className="text-lg font-bold" style={{ fontFamily: NUNITO, color: B.text }}>
              Đang điều chỉnh câu tiếp theo
            </p>
            <p className="text-sm leading-relaxed" style={{ fontFamily: INTER, color: B.textMuted }}>
              Câu trả lời của bạn đã được phân tích.
              <br />Hệ thống đang chọn câu hỏi phù hợp nhất tiếp theo.
            </p>
            <div
              className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full"
              style={{ backgroundColor: B.orangeLight }}
            >
              <Zap size={12} style={{ color: B.orange }} />
              <span className="text-xs font-bold" style={{ fontFamily: NUNITO, color: B.orange }}>
                Adaptive — không phải thứ tự cố định
              </span>
            </div>
          </motion.div>
        )}

        {/* Processing State */}
        {phase === "processing" && (
          <motion.div
            key="proc"
            initial={{ opacity: 0, scale: 0.97 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.4 }}
            className="text-center space-y-5"
          >
            <div className="flex justify-center gap-2 mb-2">
              {[0, 0.2, 0.4].map((d) => (
                <motion.div
                  key={d}
                  className="w-3 h-3 rounded-full"
                  style={{ backgroundColor: B.blue }}
                  animate={{ y: [0, -10, 0] }}
                  transition={{ duration: 1.1, repeat: Infinity, delay: d }}
                />
              ))}
            </div>
            <p className="text-xl font-bold" style={{ fontFamily: NUNITO, color: B.text }}>
              Đang xây dựng bản đồ tri thức
            </p>
            <p className="text-sm" style={{ fontFamily: INTER, color: B.textMuted }}>
              12 câu hỏi đã được phân tích…
            </p>
            <div className="w-56 mx-auto h-1.5 rounded-full overflow-hidden" style={{ backgroundColor: "#E5E7EB" }}>
              <motion.div
                className="h-full rounded-full"
                style={{ backgroundColor: B.blue }}
                initial={{ width: "0%" }}
                animate={{ width: "100%" }}
                transition={{ duration: 1.7, ease: "easeInOut" }}
              />
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

// ──────────────────────────────────────────────────────────────────────────────
// ─── STEP 1: MapStep Component ────────────────────────────────────────────────
// ──────────────────────────────────────────────────────────────────────────────
interface MapStepProps {
  result: AssessmentV2Result;
  pitchMode: boolean;
  onComplete: () => void;
}

function MapStep({ result, pitchMode, onComplete }: MapStepProps) {
  const [skillCount, setSkillCount] = useState(0);
  const [panelIn, setPanelIn] = useState(false);

  const vm = result.summary.value_metrics;
  const totalSkills = pitchMode ? 47 : (vm.skills_directly_tested + vm.skills_inferred);
  const adaptedSkills = adaptSummaryToSkills(result.summary);
  const targetNodeId = findTargetNodeId(result.learning_loop?.recommendation?.kc_id);
  const recommendationName = result.learning_loop?.recommendation?.name ?? "Kỹ năng trọng tâm";

  const breakdown = [
    { color: B.blue,    label: "Thành thạo",           value: pitchMode ? "31" : String(result.summary.strong_areas.length) },
    { color: B.blueMid, label: "Đang phát triển",      value: pitchMode ? "8" : String(result.summary.possibly_affected.length) },
    { color: B.orange,  label: "Khoảng trống",         value: pitchMode ? "8" : String(result.summary.skills_to_review.length), accent: true },
    { color: "#94A3B8", label: "Suy luận từ dữ liệu",  value: "—", dim: true },
  ];

  useEffect(() => {
    const t = setTimeout(() => setPanelIn(true), 400);
    return () => clearTimeout(t);
  }, []);

  useEffect(() => {
    if (skillCount >= totalSkills) return;
    const t = setTimeout(() => setSkillCount((c) => c + 1), 26);
    return () => clearTimeout(t);
  }, [skillCount, totalSkills]);

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
              <span className="text-xs font-medium" style={{ fontFamily: MONO, color: B.textMuted }}>
                {pitchMode ? 12 : vm.questions_asked} câu hỏi
              </span>
              <span style={{ color: "#D1D5DB" }}>→</span>
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-6xl font-extrabold tabular-nums" style={{ fontFamily: NUNITO, color: B.text }}>{skillCount}</span>
              <span className="text-lg font-semibold" style={{ fontFamily: NUNITO, color: B.textMuted }}>kỹ năng được vẽ</span>
            </div>
          </div>

          <motion.div initial={{ opacity: 0 }} animate={skillCount >= Math.floor(totalSkills * 0.6) ? { opacity: 1 } : {}} transition={{ duration: 0.5 }}
            className="space-y-3">
            {breakdown.map((row) => (
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

          <motion.div initial={{ opacity: 0, y: 8 }} animate={skillCount >= totalSkills ? { opacity: 1, y: 0 } : {}}
            transition={{ duration: 0.5 }} className="rounded-2xl p-4 space-y-2"
            style={{ backgroundColor: B.orangeLight, border: `1.5px solid rgba(245,158,11,0.25)` }}>
            <div className="flex items-center gap-2">
              <Zap size={14} style={{ color: B.orange }} />
              <span className="text-xs font-bold" style={{ fontFamily: NUNITO, color: B.orange }}>Điểm tập trung được xác định</span>
            </div>
            <p className="font-bold" style={{ fontFamily: NUNITO, color: B.text }}>
              {pitchMode ? "Cụm Phân số" : recommendationName}
            </p>
            <p className="text-xs leading-relaxed" style={{ color: B.textMid, fontFamily: INTER }}>
              {pitchMode ? "Tính đẳng trị là gốc rễ — giải quyết nó sẽ mở khóa 6 kỹ năng liên kết" : "Giải quyết nó sẽ mở khóa các kỹ năng liên kết"}
            </p>
          </motion.div>

          <motion.button initial={{ opacity: 0 }} animate={skillCount >= totalSkills ? { opacity: 1 } : {}}
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

// ──────────────────────────────────────────────────────────────────────────────
// ─── STEP 2: LearnStep Component ──────────────────────────────────────────────
// ──────────────────────────────────────────────────────────────────────────────
interface LearnStepProps {
  result: AssessmentV2Result;
  pitchMode: boolean;
  onComplete: () => void;
}

const PITCH_FALLBACK = {
  title: "Tính đẳng trị của phân số",
  subtitle: "Cụm Phân số · gốc rễ",
  concept: "Hai phân số đẳng trị khi chúng biểu diễn cùng một giá trị — chỉ được viết khác đi.",
  practicePrompt: "Để cộng phân số, cần quy đồng mẫu số trước:",
};

function LearnStep({ result, pitchMode, onComplete }: LearnStepProps) {
  const lesson = result.learning_loop?.lesson;
  const rec = result.learning_loop?.recommendation;

  const title = lesson?.title ?? (pitchMode ? PITCH_FALLBACK.title : "Bài học mục tiêu");
  const subtitle = lesson?.subtitle ?? (pitchMode ? PITCH_FALLBACK.subtitle : (rec?.name ? `${rec.name} · mục tiêu` : "Bài học"));
  const concept = lesson?.concept ?? (pitchMode ? PITCH_FALLBACK.concept : "");
  const practicePrompt = lesson?.practice_prompt ?? (pitchMode ? PITCH_FALLBACK.practicePrompt : "");
  const workedExample = lesson?.worked_example ?? [];

  const isFractionLesson = pitchMode || (rec?.code ?? "").includes("fraction") || (lesson?.title ?? "").toLowerCase().includes("phân số");

  return (
    <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -16 }} transition={{ duration: 0.45 }}>
      <PitchBar active={pitchMode} duration={6000} onComplete={onComplete} />
      <div className="flex flex-col items-center justify-center px-4 py-12" style={{ minHeight: "calc(100vh - 78px)" }}>
        <div className="w-full max-w-xl space-y-6">
          <div className="flex items-center gap-3 flex-wrap">
            <span className="text-xs font-bold px-3 py-1.5 rounded-full"
              style={{ fontFamily: NUNITO, backgroundColor: B.orangeLight, color: B.orange }}>
              {subtitle}
            </span>
            <span className="text-xs" style={{ color: B.textMuted, fontFamily: INTER }}>Mở khóa 6 kỹ năng liên kết</span>
          </div>

          <div>
            <div className="flex items-center gap-2 mb-2">
              <StepCircle n={1} done />
              <h2 className="text-2xl font-extrabold" style={{ fontFamily: NUNITO, color: B.text }}>
                {title}
              </h2>
            </div>
            {concept && (
              <p className="pl-9 text-base leading-relaxed" style={{ color: B.textMid, fontFamily: INTER }}>
                {concept}
              </p>
            )}
          </div>

          <div className="rounded-2xl p-6 space-y-4 border shadow-sm"
            style={{ backgroundColor: B.white, borderColor: B.grayBorder }}>
            {workedExample.length > 0 && !pitchMode ? (
              <>
                <p className="text-xs font-semibold" style={{ fontFamily: NUNITO, color: B.textMuted }}>Ví dụ minh họa:</p>
                <div className="space-y-3">
                  {workedExample.map((step, i) => (
                    <div key={i} className="flex items-start gap-2.5">
                      <div className="w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold shrink-0"
                        style={{ backgroundColor: B.blueLight, color: B.blue, fontFamily: NUNITO }}>
                        {i + 1}
                      </div>
                      <p className="text-sm leading-relaxed" style={{ color: B.textMid, fontFamily: INTER }}>{step}</p>
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <>
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
              </>
            )}
          </div>

          {practicePrompt && (
            <div className="rounded-2xl p-5 border shadow-sm"
              style={{ backgroundColor: B.blueLight, borderColor: "rgba(61,114,248,0.15)" }}>
              <p className="text-xs font-bold mb-3" style={{ fontFamily: NUNITO, color: B.blue }}>
                Tại sao cần cho bài toán {pitchMode ? "3/4 + 1/2" : (rec?.code ?? "kỹ năng mục tiêu")}
              </p>
              <div className="flex items-center gap-3 flex-wrap text-sm" style={{ fontFamily: INTER, color: B.textMid }}>
                <span>{practicePrompt}</span>
                {isFractionLesson && (
                  <div className="flex items-center gap-2">
                    <Frac n={1} d={2} className="text-base" />
                    <span style={{ color: B.textLight }}>=</span>
                    <Frac n={2} d={4} className="text-base" />
                    <span className="text-xs ml-1" style={{ fontFamily: MONO, color: B.textMuted }}>(×2)</span>
                  </div>
                )}
              </div>
            </div>
          )}

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

// ──────────────────────────────────────────────────────────────────────────────
// ─── STEP 3: MasteryStep Component ────────────────────────────────────────────
// ──────────────────────────────────────────────────────────────────────────────
interface MasteryStepProps {
  result: AssessmentV2Result;
  pitchMode: boolean;
  onComplete: (updatedResult: AssessmentV2Result) => void;
}

const MCQ_OPTIONS = [
  { id: 0, label: "4/9", correct: false },
  { id: 1, label: "4/6", correct: true },
  { id: 2, label: "3/4", correct: false },
  { id: 3, label: "6/4", correct: false },
];

function MasteryStep({ result, pitchMode, onComplete }: MasteryStepProps) {
  const mastery = result.learning_loop?.lesson?.mastery;

  const isMCQ = pitchMode;
  const realWidgetType = ((mastery?.answer_widget ?? "number") as WidgetType);

  const [selected, setSelected] = useState<number | null>(null);
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [fracState, setFracState] = useState<FractionWidgetState>({ num: "", den: "" });
  const [textState, setTextState] = useState("");
  const [openCorrect, setOpenCorrect] = useState<boolean | null>(null);

  const handleComplete = useCallback(async (answer: string) => {
    if (pitchMode) {
      onComplete(PITCH_POST_MASTERY);
      return;
    }
    setSubmitting(true);
    try {
      const updated = await submitAssessmentV2Mastery(result.session_id, { answer });
      onComplete(updated);
    } catch {
      onComplete(result);
    } finally {
      setSubmitting(false);
    }
  }, [pitchMode, result, onComplete]);

  // Demo auto-advance simulation
  useEffect(() => {
    if (!pitchMode) return;
    const t1 = setTimeout(() => setSelected(1), 1000);
    const t2 = setTimeout(() => setSubmitted(true), 2400);
    const t3 = setTimeout(() => handleComplete("4/6"), 4200);
    return () => { clearTimeout(t1); clearTimeout(t2); clearTimeout(t3); };
  }, [pitchMode, handleComplete]);

  const handleMCQSubmit = () => { if (selected !== null) setSubmitted(true); };

  const handleOpenSubmit = () => {
    let answer = "";
    if (realWidgetType === "fraction") {
      if (!isFractionReady(fracState)) return;
      answer = serializeFraction(fracState);
    } else {
      if (!textState.trim()) return;
      answer = textState;
    }

    const accepted = mastery?.accepted_answers ?? [];
    const isCorrect = accepted.some((a) =>
      a.replace(/\s/g, "").toLowerCase() === answer.replace(/\s/g, "").toLowerCase()
    );
    setOpenCorrect(isCorrect);
    setSubmitted(true);
  };

  const isOpenReady = realWidgetType === "fraction"
    ? isFractionReady(fracState)
    : textState.trim().length > 0;

  const mcqCorrect = isMCQ && selected !== null && MCQ_OPTIONS[selected].correct;

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
          <p className="text-sm mb-5" style={{ color: B.textMuted, fontFamily: INTER }}>
            {pitchMode ? "Phân số nào đẳng trị với" : (mastery?.prompt ?? "Kiểm tra xem bài học đã hiệu quả chưa:")}
          </p>
          {pitchMode ? (
            <div className="flex items-center gap-3">
              <Frac n={2} d={3} className="text-3xl" />
              <span className="text-2xl" style={{ color: "#D1D5DB" }}>?</span>
            </div>
          ) : (
            <p className="text-lg font-bold" style={{ color: B.text, fontFamily: INTER }}>
              {mastery?.prompt || "Nhập đáp án cho câu hỏi học được."}
            </p>
          )}
        </div>

        {isMCQ ? (
          <div className="grid grid-cols-2 gap-3">
            {MCQ_OPTIONS.map((opt) => {
              const isSel = selected === opt.id;
              let borderColor: string = B.grayBorder;
              let bg: string = B.white;
              let textColor: string = B.text;
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
        ) : (
          <div className="rounded-2xl p-7 border-2 shadow-sm text-center"
            style={{ backgroundColor: B.white, borderColor: submitted ? (openCorrect ? B.green : B.red) : isOpenReady ? B.blue : B.grayBorder, transition: "border-color 0.2s" }}>
            <p className="text-xs font-semibold mb-5" style={{ fontFamily: NUNITO, color: B.textMuted }}>Nhập đáp án của bạn</p>
            <div className="flex justify-center mb-4">
              {realWidgetType === "fraction" ? (
                <FractionWidget num={fracState.num} den={fracState.den} onNumChange={(v) => setFracState(s => ({ ...s, num: v }))} onDenChange={(v) => setFracState(s => ({ ...s, den: v }))} onSubmit={!submitted ? handleOpenSubmit : undefined} disabled={submitted || submitting} size="lg" />
              ) : (
                <MathAnswerWidget widgetType={realWidgetType} disabled={submitted || submitting} onSubmit={!submitted ? handleOpenSubmit : undefined} textState={textState} onTextChange={setTextState} />
              )}
            </div>
            <p className="text-xs" style={{ fontFamily: MONO, color: B.textLight }}>
              {realWidgetType === "fraction" ? "Tab · ↑↓ để chuyển ô · Enter để nộp" : "Nhập đáp án và bấm Enter để nộp"}
            </p>
          </div>
        )}

        <AnimatePresence>
          {submitted && (
            <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}
              className="rounded-2xl p-4 border text-sm leading-relaxed font-medium"
              style={{ fontFamily: INTER,
                backgroundColor: (isMCQ ? mcqCorrect : openCorrect) ? B.greenLight : B.redLight,
                borderColor: (isMCQ ? mcqCorrect : openCorrect) ? "rgba(16,185,129,0.3)" : "rgba(239,68,68,0.3)",
                color: (isMCQ ? mcqCorrect : openCorrect) ? B.green : B.red }}>
              {(isMCQ ? mcqCorrect : openCorrect)
                ? (mastery?.hint ? `Chính xác! ${mastery.hint}` : "Chính xác! 2/3 = 4/6 vì cả tử số và mẫu số đều nhân với 2.")
                : (mastery?.hint ? `Chưa đúng. ${mastery.hint}` : "Chưa đúng. Hãy ôn lại bài học và thử lại.")}
            </motion.div>
          )}
        </AnimatePresence>

        {!submitted ? (
          <button onClick={isMCQ ? handleMCQSubmit : handleOpenSubmit} disabled={isMCQ ? selected === null : !isOpenReady || submitting}
            className="w-full rounded-full py-4 font-bold transition-all hover:opacity-90 active:scale-[0.98] disabled:opacity-25 disabled:cursor-not-allowed shadow-sm"
            style={{ backgroundColor: B.blue, color: B.white, fontFamily: NUNITO, fontSize: "1rem" }}>
            Nộp bài
          </button>
        ) : (
          <button onClick={() => {
            const ans = isMCQ ? MCQ_OPTIONS.find((o) => o.id === selected)?.label ?? "" : realWidgetType === "fraction" ? serializeFraction(fracState) : textState;
            handleComplete(ans);
          }} disabled={submitting}
            className="w-full rounded-full py-4 font-bold border-2 transition-all hover:opacity-80 flex items-center justify-center gap-2"
            style={{ borderColor: B.blue, backgroundColor: B.white, color: B.blue, fontFamily: NUNITO, fontSize: "1rem" }}>
            {(isMCQ ? mcqCorrect : openCorrect) ? "Xem tiến độ của tôi" : "Tiếp tục"} <ArrowRight size={18} />
          </button>
        )}
      </div>
    </motion.div>
  );
}

// ──────────────────────────────────────────────────────────────────────────────
// ─── STEP 4: OutcomeStep Component ────────────────────────────────────────────
// ──────────────────────────────────────────────────────────────────────────────
interface OutcomeStepProps {
  preResult: AssessmentV2Result;
  postResult: AssessmentV2Result;
  onRestart: () => void;
  onNext: () => void;
}

function OutcomeStep({ preResult, postResult, onRestart, onNext }: OutcomeStepProps) {
  const [show, setShow] = useState(false);
  useEffect(() => { const t = setTimeout(() => setShow(true), 300); return () => clearTimeout(t); }, []);

  const preSkills  = adaptSummaryToSkills(preResult.summary);
  const postSkills = adaptSummaryToSkills(postResult.summary);
  const outcomeNodeIds = findOutcomeNodeIds(preSkills, postSkills);
  const targetNodeId   = findTargetNodeId(postResult.learning_loop?.recommendation?.kc_id);

  const changes: Array<{ label: string; from: string; to: string }> = [];
  postSkills.forEach((post) => {
    const pre = preSkills.find((s) => s.id === post.id);
    if (!pre || pre.strength === post.strength) return;
    const stateLabel: Record<string, string> = {
      strong: "Thành thạo",
      medium: "Đang phát triển",
      weak: "Khoảng trống",
      inferred: "Suy luận",
    };
    if (pre.strength === "weak" && post.strength !== "weak") {
      changes.push({ label: post.label, from: stateLabel[pre.strength], to: stateLabel[post.strength] });
    }
  });

  const displayChanges = changes.length > 0 ? changes : [
    { label: "Tính đẳng trị", from: "Khoảng trống", to: "Đang phát triển" },
    { label: "Rút gọn",       from: "Khoảng trống", to: "Có thể tiếp cận" },
    { label: "Cộng/trừ p.s.", from: "Khoảng trống", to: "Có thể tiếp cận" },
  ];

  const upgradedCount = outcomeNodeIds.size || displayChanges.length;

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
          {displayChanges.map((c, i) => (
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
            <span className="text-xs font-bold" style={{ fontFamily: NUNITO, color: B.blue }}>{upgradedCount} kỹ năng được nâng cấp</span>
          </div>
          <p className="text-sm leading-relaxed" style={{ color: B.textMid, fontFamily: INTER }}>
            Các kỹ năng liên kết đang dần gần tầm với. Wizzdom đã cập nhật bản đồ cá nhân của bạn.
          </p>
        </div>

        <div className="flex gap-3">
          <button onClick={onRestart}
            className="flex-1 rounded-full py-3.5 border-2 font-bold text-sm transition-all hover:opacity-80 flex items-center justify-center gap-2"
            style={{ borderColor: B.grayBorder, color: B.textMuted, fontFamily: NUNITO }}>
            <RotateCcw size={14} /> Xem lại demo
          </button>
          <button onClick={onNext}
            className="flex-1 rounded-full py-3.5 font-bold text-sm transition-all hover:opacity-90 flex items-center justify-center gap-2 shadow-sm"
            style={{ backgroundColor: B.blue, color: B.white, fontFamily: NUNITO }}>
            Kỹ năng tiếp theo <ArrowRight size={14} />
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}

// ──────────────────────────────────────────────────────────────────────────────
// ─── MAIN APP COMPONENT — AlgebraAssessmentPage ────────────────────────────────
// ──────────────────────────────────────────────────────────────────────────────
export default function AlgebraAssessmentPage() {
  const [phase, setPhase] = useState<Phase>("assess");
  const [pitchMode, setPitchMode] = useState(false);
  const [result, setResult] = useState<AssessmentV2Result | null>(null);
  const [postResult, setPostResult] = useState<AssessmentV2Result | null>(null);
  const [sessionId, setSessionId] = useState<string | null>(null);

  // Transitions
  const handleAssessComplete = useCallback((res: AssessmentV2Result, sid: string) => {
    setResult(res);
    setSessionId(sid);
    setPhase("map");
  }, []);

  const handleMapComplete = useCallback(() => setPhase("lesson"), []);
  const handleLearnComplete = useCallback(() => setPhase("mastery"), []);

  const handleMasteryComplete = useCallback((updatedResult: AssessmentV2Result) => {
    setPostResult(updatedResult);
    setPhase("outcome");
  }, []);

  const handleRestart = useCallback(() => {
    setPhase("assess");
    setResult(null);
    setPostResult(null);
    setSessionId(null);
    setPitchMode(false);
  }, []);

  const handleNext = useCallback(() => {
    setPhase("assess");
    setResult(null);
    setPostResult(null);
  }, []);

  const togglePitch = () => {
    const next = !pitchMode;
    setPitchMode(next);
    setPhase("assess");
    setResult(null);
    setPostResult(null);
    setSessionId(null);
  };

  const currentStep = PHASE_TO_STEP[phase];

  return (
    <div className="min-h-screen" style={{ backgroundColor: B.bg, fontFamily: INTER }}>
      {/* Header */}
      <header className="h-[72px] border-b flex items-center px-5 sm:px-8 gap-4"
        style={{ backgroundColor: B.white, borderColor: B.grayBorder }}>
        <WizzdomLogo />

        <div className="flex-1 flex justify-center overflow-x-auto">
          <StepBar current={currentStep} />
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {/* Pitch mode toggle */}
          <button onClick={togglePitch}
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
              style={{ backgroundColor: B.blueLight, color: B.blue, fontFamily: NUNITO }}>
              {sessionId ? sessionId.slice(0, 1).toUpperCase() : "M"}
            </div>
            <span className="text-xs font-medium" style={{ fontFamily: MONO, color: B.textMuted }}>
              {pitchMode ? "Demo" : sessionId ? `#${sessionId.slice(-4)}` : "Minh · 8A"}
            </span>
          </div>
        </div>
      </header>

      {/* Pages Container */}
      <AnimatePresence mode="wait">
        {phase === "assess" && (
          <AssessStep key="assess" pitchMode={pitchMode} onComplete={handleAssessComplete} />
        )}
        {phase === "map" && result && (
          <MapStep key="map" result={result} pitchMode={pitchMode} onComplete={handleMapComplete} />
        )}
        {phase === "lesson" && result && (
          <LearnStep key="lesson" result={result} pitchMode={pitchMode} onComplete={handleLearnComplete} />
        )}
        {phase === "mastery" && result && (
          <MasteryStep key="mastery" result={result} pitchMode={pitchMode} onComplete={handleMasteryComplete} />
        )}
        {phase === "outcome" && result && postResult && (
          <OutcomeStep key="outcome" preResult={result} postResult={postResult} onRestart={handleRestart} onNext={handleNext} />
        )}
      </AnimatePresence>
    </div>
  );
}
