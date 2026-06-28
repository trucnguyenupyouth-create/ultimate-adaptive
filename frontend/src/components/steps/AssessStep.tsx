"use client";
// ─── AssessStep ───────────────────────────────────────────────────────────────
// Single-column stacked layout matching old .question-panel pattern:
//   topline → question title → question text → answer widget → actions
// NOT a two-column grid — old ref used single column for questions.

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

    const widgetType = (currentItem.answer_widget ?? "number") as WidgetType;
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

  const widgetType = ((currentItem?.answer_widget ?? "number") as WidgetType);
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
      style={{ minHeight: "calc(100vh - 68px)", display: "flex", alignItems: "center", justifyContent: "center", padding: "36px 24px" }}
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
              maxWidth: 900,
              width: "100%",
              background: "rgba(255,255,255,0.92)",
              border: "1px solid #dfe7f7",
              borderRadius: 28,
              boxShadow: "0 24px 70px rgba(38, 82, 181, 0.13)",
              padding: 28,
              display: "grid",
              gap: 24,
            }}
          >
            {/* Error */}
            {error && (
              <div style={{ backgroundColor: "#fff1f0", color: "#b42318", border: "1px solid #ffd2cc", padding: "12px 14px", borderRadius: 16, lineHeight: 1.45, fontFamily: INTER, fontSize: 14 }}>
                {error} — <button onClick={() => setError(null)} style={{ textDecoration: "underline", background: "none", border: "none", color: "inherit", cursor: "pointer" }}>thử lại</button>
              </div>
            )}

            {/* Topline: progress + KC code chip */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <span style={{ fontFamily: MONO, fontSize: 13, fontWeight: 700, color: "#697386" }}>
                  Câu {questionNumber} / {maxQuestions}
                </span>
                <div style={{ display: "flex", gap: 4, flex: 1 }}>
                  {Array.from({ length: maxQuestions }, (_, i) => (
                    <div key={i} style={{ width: 28, height: 5, borderRadius: 999, backgroundColor: i < questionNumber ? B.blue : "#E5E7EB", transition: "background 0.3s" }} />
                  ))}
                </div>
              </div>
              {currentItem?.kc_code && (
                <span style={{ border: "1px solid #cfe0ff", borderRadius: 999, padding: "8px 12px", fontSize: 13, color: "#40506a", background: "#f8fbff", fontFamily: INTER, fontWeight: 600 }}>
                  {currentItem.kc_code}
                </span>
              )}
            </div>

            {/* Question title + context */}
            <div style={{ display: "grid", gap: 12 }}>
              {currentItem?.kc_name && (
                <h2 style={{ margin: 0, color: "#202738", fontSize: 32, lineHeight: 1.06, fontFamily: NUNITO, fontWeight: 800 }}>
                  {currentItem.kc_name}
                </h2>
              )}
              <p style={{ margin: 0, color: "#697386", fontSize: 14, lineHeight: 1.55, fontFamily: INTER }}>
                Không có phản hồi ngay — câu hỏi tiếp theo được chọn thích ứng từ bản đồ tri thức.
              </p>
            </div>

            {/* Question text — large, prominent */}
            <p style={{ fontSize: 30, lineHeight: 1.32, color: "#202738", margin: 0, fontFamily: INTER, fontWeight: 600 }}>
              {pitchMode ? "Rút gọn biểu thức:" : (currentItem?.question ?? "Đang tải câu hỏi...")}
            </p>

            {/* Pitch mode fraction visual */}
            {pitchMode && (
              <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
                <Frac n={3} d={4} className="text-4xl" />
                <span style={{ fontSize: 32, fontWeight: 300, color: "#697386" }}>+</span>
                <Frac n={1} d={2} className="text-4xl" />
                <span style={{ fontSize: 32, fontWeight: 300, color: "#697386" }}>=</span>
                <span style={{ fontSize: 36, fontWeight: 700, color: "#D1D5DB", fontFamily: NUNITO }}>?</span>
              </div>
            )}

            {/* Answer widget — inside a bordered card */}
            <div style={{
              padding: 16,
              borderRadius: 22,
              background: "#f8fbff",
              border: `1px solid ${isReady ? B.blue : "#dfe7f7"}`,
              boxShadow: isReady ? `0 0 0 4px rgba(47, 102, 245, 0.14)` : "none",
              transition: "border-color 0.2s, box-shadow 0.2s",
            }}>
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
                <input
                  type="text"
                  inputMode="numeric"
                  value={textState}
                  onChange={(e) => setTextState(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") handleSubmit(); }}
                  disabled={submitting}
                  autoFocus
                  placeholder="Nhập đáp án..."
                  style={{
                    width: "100%",
                    border: "1px solid #d6def0",
                    borderRadius: 18,
                    padding: "16px 18px",
                    fontSize: 22,
                    color: "#202738",
                    background: "white",
                    outline: "none",
                    fontFamily: NUNITO,
                    fontWeight: 700,
                  }}
                />
              )}
            </div>

            {/* Actions */}
            <div style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "center" }}>
              <button
                onClick={handleSubmit}
                disabled={!isReady || submitting}
                style={{
                  border: 0, borderRadius: 18, padding: "13px 18px", fontSize: 15, fontWeight: 800,
                  background: B.blue, color: "white",
                  boxShadow: "0 16px 34px rgba(47, 102, 245, 0.24)",
                  cursor: isReady && !submitting ? "pointer" : "not-allowed",
                  opacity: isReady && !submitting ? 1 : 0.55,
                  display: "inline-flex", alignItems: "center", gap: 8,
                  fontFamily: NUNITO,
                  transition: "transform 0.16s ease, box-shadow 0.16s ease",
                }}
              >
                Nộp bài <ArrowRight size={17} />
              </button>
              <button
                onClick={handleSkip}
                disabled={submitting}
                style={{
                  border: 0, borderRadius: 18, padding: "13px 18px", fontSize: 15, fontWeight: 800,
                  background: "#edf2fb", color: "#202738",
                  cursor: "pointer", fontFamily: NUNITO,
                  display: "inline-flex", alignItems: "center", gap: 8,
                }}
              >
                <HelpCircle size={17} /> Không biết
              </button>
            </div>

            {/* Adaptive hint */}
            <div style={{ display: "inline-flex", alignItems: "center", gap: 6, width: "fit-content", background: "#FFF8DF", border: "1px solid rgba(245,158,11,0.25)", borderRadius: 999, padding: "6px 12px" }}>
              <Zap size={12} style={{ color: B.orange }} />
              <span style={{ fontSize: 12, fontWeight: 700, fontFamily: NUNITO, color: B.orange }}>
                Adaptive — không phải thứ tự cố định
              </span>
            </div>

            {/* Widget showcase link */}
            <button
              onClick={() => setShowWidgets(true)}
              style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 6, padding: "10px 0", borderRadius: 999, background: "white", border: "1px solid #cfe0ff", cursor: "pointer" }}
            >
              <GraduationCap size={13} style={{ color: B.blue }} />
              <span style={{ fontSize: 12, fontWeight: 600, fontFamily: NUNITO, color: B.blue }}>
                Xem tất cả loại widget toán học
              </span>
            </button>
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
