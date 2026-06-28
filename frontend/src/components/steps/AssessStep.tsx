"use client";
// ─── AssessStep ───────────────────────────────────────────────────────────────
// Handles diagnostic assessment: real API + pitch mode
// State machine: question → adapting (0.95s) → processing (1.8s) → onComplete

import { useState, useEffect, useCallback, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowRight, HelpCircle, Zap } from "lucide-react";
import { B, NUNITO, INTER, MONO } from "@/components/wizzdom/design-tokens";
import {
  FractionWidget, MathAnswerWidget, MathWidgetShowcase,
  isFractionReady, serializeFraction,
  type FractionWidgetState, type WidgetType,
} from "@/components/wizzdom/MathWidgets";
import { Frac } from "@/components/wizzdom/MathDisplay";
import type {
  AssessmentV2Item, AssessmentV2SessionResponse, AssessmentV2Result,
} from "@/lib/assessment-v2-api";
import {
  createAssessmentV2Session, submitAssessmentV2Response,
} from "@/lib/assessment-v2-api";
import { PITCH_ASSESS_QUESTION } from "@/lib/pitch-mock-data";

type AssessPhase = "question" | "adapting" | "processing";

interface AssessStepProps {
  pitchMode: boolean;
  onComplete: (result: AssessmentV2Result, sessionId: string) => void;
}

export function AssessStep({ pitchMode, onComplete }: AssessStepProps) {
  const [phase, setPhase] = useState<AssessPhase>("question");
  const [showWidgets, setShowWidgets] = useState(false);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [currentItem, setCurrentItem] = useState<AssessmentV2Item | null>(null);
  const [questionNumber, setQuestionNumber] = useState(1);
  const [maxQuestions, setMaxQuestions] = useState(12);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Widget states
  const [fracState, setFracState] = useState<FractionWidgetState>({ num: "", den: "" });
  const [textState, setTextState] = useState("");

  const initialized = useRef(false);

  // ─── Initialize session ───────────────────────────────────────────────────
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

  // ─── Pitch mode auto-fill + advance ──────────────────────────────────────
  const advance = useCallback(
    (result?: AssessmentV2Result, sid?: string) => {
      setPhase("adapting");
      setTimeout(() => setPhase("processing"), 950);
      setTimeout(() => {
        if (pitchMode) {
          // Import lazily to avoid circular
          import("@/lib/pitch-mock-data").then(({ PITCH_RESULT }) => {
            onComplete(PITCH_RESULT, "pitch-demo");
          });
        } else if (result && sid) {
          onComplete(result, sid);
        }
      }, 950 + 1800);
    },
    [pitchMode, onComplete]
  );

  useEffect(() => {
    if (!pitchMode || phase !== "question") return;
    const t1 = setTimeout(() => setFracState({ num: "5", den: "4" }), 1100);
    const t2 = setTimeout(() => advance(), 2700);
    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, [pitchMode, phase, advance]);

  // ─── Submit answer ────────────────────────────────────────────────────────
  const handleSubmit = async () => {
    if (pitchMode) { advance(); return; }
    if (!sessionId || !currentItem || submitting) return;

    const widgetType = (currentItem.answer_widget ?? "raw") as WidgetType;
    let answer: string;
    if (widgetType === "fraction") {
      if (!isFractionReady(fracState)) return;
      answer = serializeFraction(fracState);
    } else {
      if (!textState.trim()) return;
      answer = textState;
    }

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
        // Next question
        const next = res as AssessmentV2SessionResponse;
        if (next.item) {
          setCurrentItem(next.item);
          setQuestionNumber((n) => n + 1);
          setFracState({ num: "", den: "" });
          setTextState("");
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

  const widgetType = ((currentItem?.answer_widget ?? "fraction") as WidgetType);
  const isFracWidget = widgetType === "fraction";
  const isReady = isFracWidget
    ? isFractionReady(fracState)
    : textState.trim().length > 0;

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
            {/* Error state */}
            {error && (
              <div className="mb-4 rounded-xl p-3 text-sm" style={{ backgroundColor: B.redLight, color: B.red, fontFamily: INTER }}>
                {error} — <button onClick={() => setError(null)} style={{ textDecoration: "underline" }}>thử lại</button>
              </div>
            )}

            {/* Progress bar */}
            <div className="flex items-center gap-3 mb-8">
              <span className="text-xs font-bold px-2.5 py-1 rounded-full"
                style={{ fontFamily: MONO, backgroundColor: B.blueLight, color: B.blue }}>
                Câu {questionNumber} / {maxQuestions}
              </span>
              <div className="flex gap-1 flex-1">
                {Array.from({ length: maxQuestions }, (_, i) => (
                  <div key={i} className="flex-1 h-1.5 rounded-full"
                    style={{ backgroundColor: i < questionNumber ? B.blue : "#E5E7EB" }} />
                ))}
              </div>
            </div>

            {/* Question card */}
            <div className="rounded-2xl p-7 mb-5 shadow-sm border"
              style={{ backgroundColor: B.white, borderColor: B.grayBorder }}>
              <p className="text-sm mb-5" style={{ fontFamily: INTER, color: B.textMuted }}>
                {pitchMode ? "Rút gọn biểu thức:" : (currentItem?.question ?? "Đang tải câu hỏi...")}
              </p>
              {/* Pitch mode: show visual fraction expression */}
              {pitchMode && (
                <div className="flex items-center justify-center gap-4">
                  <Frac n={3} d={4} className="text-3xl" />
                  <span className="text-3xl font-light" style={{ color: B.textLight }}>+</span>
                  <Frac n={1} d={2} className="text-3xl" />
                  <span className="text-3xl font-light" style={{ color: B.textLight }}>=</span>
                  <span className="text-3xl font-bold" style={{ color: "#D1D5DB", fontFamily: NUNITO }}>?</span>
                </div>
              )}
            </div>

            {/* Answer widget card */}
            <div className="rounded-2xl p-7 mb-3 border-2 shadow-sm text-center"
              style={{ backgroundColor: B.white, borderColor: isReady ? B.blue : B.grayBorder, transition: "border-color 0.2s" }}>
              <p className="text-xs font-semibold mb-5" style={{ fontFamily: NUNITO, color: B.textMuted }}>
                Nhập đáp án của bạn
              </p>
              <div className="flex justify-center mb-4">
                {isFracWidget ? (
                  <FractionWidget
                    num={fracState.num} den={fracState.den}
                    onNumChange={(v) => setFracState((s) => ({ ...s, num: v }))}
                    onDenChange={(v) => setFracState((s) => ({ ...s, den: v }))}
                    onSubmit={handleSubmit}
                    disabled={submitting}
                    size="lg"
                  />
                ) : (
                  <MathAnswerWidget
                    widgetType={widgetType}
                    textState={textState}
                    onTextChange={setTextState}
                    onSubmit={handleSubmit}
                    disabled={submitting}
                  />
                )}
              </div>
              <p className="text-xs" style={{ fontFamily: MONO, color: B.textLight }}>
                Tab · ↑↓ để chuyển ô · Enter để nộp
              </p>
            </div>

            {/* Actions */}
            <div className="flex gap-2 mb-4">
              <button
                onClick={handleSubmit}
                disabled={!isReady || submitting}
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
              className="w-full flex items-center justify-center gap-1.5 py-2 rounded-full transition-all hover:opacity-70"
              style={{ backgroundColor: B.blueLight }}
            >
              <HelpCircle size={13} style={{ color: B.blue }} />
              <span className="text-xs font-semibold" style={{ fontFamily: NUNITO, color: B.blue }}>
                Xem tất cả loại widget toán học
              </span>
            </button>
          </motion.div>
        )}

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
              Câu trả lời của bạn đã được phân tích.<br />
              Hệ thống đang chọn câu hỏi phù hợp nhất tiếp theo.
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
                <motion.div key={d} className="w-3 h-3 rounded-full" style={{ backgroundColor: B.blue }}
                  animate={{ y: [0, -10, 0] }}
                  transition={{ duration: 1.1, repeat: Infinity, delay: d }} />
              ))}
            </div>
            <p className="text-xl font-bold" style={{ fontFamily: NUNITO, color: B.text }}>
              Đang xây dựng bản đồ tri thức
            </p>
            <p className="text-sm" style={{ fontFamily: INTER, color: B.textMuted }}>
              {maxQuestions} câu trả lời được phân tích…
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
