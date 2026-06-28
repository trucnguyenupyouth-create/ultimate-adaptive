"use client";
// ─── AssessStep ───────────────────────────────────────────────────────────────
// Full-width two-column layout: question copy (left) · answer widget (right)
// Mirrors the old .shell.hero-grid pattern

import { useState, useEffect, useCallback, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowRight, HelpCircle, Zap, GraduationCap } from "lucide-react";
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

  const [fracState, setFracState] = useState<FractionWidgetState>({ num: "", den: "" });
  const [textState, setTextState] = useState("");

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
      style={{ minHeight: "calc(100vh - 68px)", padding: "36px" }}
    >
      <AnimatePresence mode="wait">
        {phase === "question" && (
          <motion.div
            key="q"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -14 }}
            transition={{ duration: 0.45 }}
            style={{
              maxWidth: 1100,
              width: "100%",
              margin: "0 auto",
              background: "rgba(255,255,255,0.92)",
              border: `1px solid ${B.grayBorder}`,
              borderRadius: 28,
              boxShadow: "0 24px 70px rgba(38,82,181,0.10)",
              padding: 32,
              display: "grid",
              gridTemplateColumns: "minmax(0,1.05fr) minmax(320px,0.95fr)",
              gap: 36,
              alignItems: "center",
              minHeight: 480,
            }}
          >
            {/* Left: question copy */}
            <div style={{ display: "grid", gap: 24, alignContent: "center" }}>
              {/* Error */}
              {error && (
                <div className="rounded-xl p-3 text-sm" style={{ backgroundColor: B.redLight, color: B.red, fontFamily: INTER }}>
                  {error} — <button onClick={() => setError(null)} style={{ textDecoration: "underline" }}>thử lại</button>
                </div>
              )}

              {/* Eyebrow */}
              <div style={{ display: "inline-flex", alignItems: "center", gap: 7, width: "fit-content", color: B.blue, background: B.blueLight, border: `1px solid rgba(61,114,248,0.2)`, borderRadius: 999, padding: "7px 13px", fontWeight: 800, fontSize: 13, fontFamily: NUNITO }}>
                <GraduationCap size={15} /> Câu hỏi chẩn đoán
              </div>

              {/* Progress bar */}
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <span style={{ fontFamily: MONO, fontSize: 12, fontWeight: 700, background: B.blueLight, color: B.blue, borderRadius: 999, padding: "4px 10px" }}>
                  Câu {questionNumber} / {maxQuestions}
                </span>
                <div style={{ display: "flex", gap: 4, flex: 1 }}>
                  {Array.from({ length: maxQuestions }, (_, i) => (
                    <div key={i} style={{ flex: 1, height: 5, borderRadius: 999, backgroundColor: i < questionNumber ? B.blue : "#E5E7EB", transition: "background 0.3s" }} />
                  ))}
                </div>
              </div>

              {/* Question text */}
              <p style={{ fontFamily: INTER, color: B.text, fontSize: 26, lineHeight: 1.4, fontWeight: 600, margin: 0 }}>
                {pitchMode ? "Rút gọn biểu thức:" : (currentItem?.question ?? "Đang tải câu hỏi...")}
              </p>

              {/* Pitch mode fraction visual */}
              {pitchMode && (
                <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
                  <Frac n={3} d={4} className="text-4xl" />
                  <span style={{ fontSize: 32, fontWeight: 300, color: B.textLight }}>+</span>
                  <Frac n={1} d={2} className="text-4xl" />
                  <span style={{ fontSize: 32, fontWeight: 300, color: B.textLight }}>=</span>
                  <span style={{ fontSize: 36, fontWeight: 700, color: "#D1D5DB", fontFamily: NUNITO }}>?</span>
                </div>
              )}

              {/* Adaptive badge */}
              <div style={{ display: "inline-flex", alignItems: "center", gap: 6, width: "fit-content", background: B.orangeLight, border: `1px solid rgba(245,158,11,0.25)`, borderRadius: 999, padding: "6px 12px" }}>
                <Zap size={12} style={{ color: B.orange }} />
                <span style={{ fontSize: 12, fontWeight: 700, fontFamily: NUNITO, color: B.orange }}>
                  Adaptive — không phải thứ tự cố định
                </span>
              </div>
            </div>

            {/* Right: answer widget */}
            <div style={{ display: "grid", gap: 16 }}>
              <div
                style={{
                  background: B.white,
                  border: `2px solid ${isReady ? B.blue : B.grayBorder}`,
                  borderRadius: 24,
                  padding: 28,
                  textAlign: "center",
                  transition: "border-color 0.2s",
                  boxShadow: isReady ? `0 0 0 4px ${B.blueLight}` : "none",
                }}
              >
                <p style={{ fontFamily: NUNITO, color: B.textMuted, fontSize: 12, fontWeight: 600, marginBottom: 20 }}>
                  Nhập đáp án của bạn
                </p>
                <div style={{ display: "flex", justifyContent: "center", marginBottom: 16 }}>
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
                <p style={{ fontFamily: MONO, color: B.textLight, fontSize: 11 }}>
                  Tab · ↑↓ để chuyển ô · Enter để nộp
                </p>
              </div>

              {/* Actions */}
              <div style={{ display: "flex", gap: 10 }}>
                <button
                  onClick={handleSubmit}
                  disabled={!isReady || submitting}
                  style={{
                    flex: 1, borderRadius: 999, padding: "16px 0", fontWeight: 700, fontSize: 16,
                    backgroundColor: B.blue, color: B.white, fontFamily: NUNITO,
                    border: "none", cursor: isReady && !submitting ? "pointer" : "not-allowed",
                    opacity: isReady && !submitting ? 1 : 0.3,
                    display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
                    transition: "opacity 0.2s",
                    boxShadow: "0 4px 16px rgba(61,114,248,0.25)",
                  }}
                >
                  Nộp bài <ArrowRight size={18} />
                </button>
                <button
                  onClick={handleSkip}
                  disabled={submitting}
                  style={{
                    padding: "16px 22px", borderRadius: 999, border: `2px solid ${B.grayBorder}`,
                    color: B.textMuted, fontFamily: NUNITO, fontWeight: 600, fontSize: 14,
                    backgroundColor: B.white, cursor: "pointer",
                  }}
                >
                  Không biết
                </button>
              </div>

              {/* Widget showcase link */}
              <button
                onClick={() => setShowWidgets(true)}
                style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 6, padding: "10px 0", borderRadius: 999, backgroundColor: B.blueLight, border: "none", cursor: "pointer" }}
              >
                <HelpCircle size={13} style={{ color: B.blue }} />
                <span style={{ fontSize: 12, fontWeight: 600, fontFamily: NUNITO, color: B.blue }}>
                  Xem tất cả loại widget toán học
                </span>
              </button>
            </div>
          </motion.div>
        )}

        {/* Adapting state */}
        {phase === "adapting" && (
          <motion.div
            key="adapt"
            initial={{ opacity: 0, scale: 0.97 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.35 }}
            style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: "calc(100vh - 180px)" }}
          >
            <div style={{ textAlign: "center", maxWidth: 340 }}>
              <div style={{ display: "flex", justifyContent: "center", gap: 8, marginBottom: 16 }}>
                {[0, 0.15, 0.3].map((d) => (
                  <motion.div key={d} style={{ width: 10, height: 10, borderRadius: "50%", backgroundColor: B.orange }}
                    animate={{ y: [0, -8, 0], opacity: [0.5, 1, 0.5] }}
                    transition={{ duration: 0.9, repeat: Infinity, delay: d }} />
                ))}
              </div>
              <p style={{ fontFamily: NUNITO, color: B.text, fontWeight: 700, fontSize: 18, marginBottom: 8 }}>
                Đang điều chỉnh câu tiếp theo
              </p>
              <p style={{ fontFamily: INTER, color: B.textMuted, fontSize: 14, lineHeight: 1.6 }}>
                Câu trả lời của bạn đã được phân tích.<br />
                Hệ thống đang chọn câu hỏi phù hợp nhất tiếp theo.
              </p>
            </div>
          </motion.div>
        )}

        {/* Processing state */}
        {phase === "processing" && (
          <motion.div
            key="proc"
            initial={{ opacity: 0, scale: 0.97 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.4 }}
            style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: "calc(100vh - 180px)" }}
          >
            <div style={{ textAlign: "center" }}>
              <div style={{ display: "flex", justifyContent: "center", gap: 8, marginBottom: 16 }}>
                {[0, 0.2, 0.4].map((d) => (
                  <motion.div key={d} style={{ width: 12, height: 12, borderRadius: "50%", backgroundColor: B.blue }}
                    animate={{ y: [0, -10, 0] }}
                    transition={{ duration: 1.1, repeat: Infinity, delay: d }} />
                ))}
              </div>
              <p style={{ fontFamily: NUNITO, color: B.text, fontWeight: 700, fontSize: 22, marginBottom: 8 }}>
                Đang xây dựng bản đồ tri thức
              </p>
              <p style={{ fontFamily: INTER, color: B.textMuted, fontSize: 14, marginBottom: 20 }}>
                {maxQuestions} câu trả lời được phân tích…
              </p>
              <div style={{ width: 220, margin: "0 auto", height: 6, borderRadius: 999, overflow: "hidden", backgroundColor: "#E5E7EB" }}>
                <motion.div style={{ height: "100%", borderRadius: 999, backgroundColor: B.blue }}
                  initial={{ width: "0%" }} animate={{ width: "100%" }}
                  transition={{ duration: 1.7, ease: "easeInOut" }} />
              </div>
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
