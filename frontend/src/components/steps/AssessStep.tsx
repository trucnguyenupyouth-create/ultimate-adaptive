"use client";
// ─── AssessStep ───────────────────────────────────────────────────────────────
// Single-column stacked layout matching reference layout:
//   Progress → Question Card → Answer Widget Card → Actions
// Inline-styled for 100% reliable layout execution in production

import { useState, useEffect, useCallback, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowRight, HelpCircle, Zap } from "lucide-react";
import { B, NUNITO, INTER, MONO } from "@/components/wizzdom/design-tokens";
import {
  MathAnswerWidget, MathWidgetShowcase,
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

    const useMockFallback = () => {
      console.warn("API failed or pitch mode enabled with backend offline. Using mock demo data.");
      setCurrentItem(PITCH_ASSESS_QUESTION as AssessmentV2Item);
      setQuestionNumber(7);
      setMaxQuestions(12);
    };

    createAssessmentV2Session({ max_questions: 12 })
      .then((res) => {
        setSessionId(res.session_id);
        setMaxQuestions(res.max_questions);
        if (res.item) {
          setCurrentItem(res.item);
          setQuestionNumber(res.question_number ?? 1);
        }
      })
      .catch((err) => {
        if (pitchMode) {
          useMockFallback();
        } else {
          setError(err.message);
        }
      });
  }, [pitchMode]);

  const advance = useCallback(
    (result?: AssessmentV2Result, sid?: string) => {
      setPhase("adapting");
      setTimeout(() => setPhase("processing"), 950);
      setTimeout(() => {
        if (pitchMode && !sid) {
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

  // Demo auto-advance simulation
  useEffect(() => {
    if (!pitchMode || phase !== "question" || !currentItem) return;
    
    const fillTimer = setTimeout(() => {
      const type = (currentItem.answer_widget ?? "number") as WidgetType;
      if (type === "fraction") setFracState({ num: "5", den: "4" });
      else if (type === "mixed_number") setMixedState({ whole: "1", num: "1", den: "2" });
      else if (type === "power") setPowerState({ base: "2", exp: "3" });
      else if (type === "sqrt") setSqrtState({ val: "16" });
      else if (type === "inequality_sign") setInequalityState({ sign: "=" });
      else if (type === "coordinate") setCoordinateState({ x: "3", y: "4" });
      else setTextState("5");
    }, 1100);

    const submitTimer = setTimeout(() => {
      handleSubmit();
    }, 2700);

    return () => {
      clearTimeout(fillTimer);
      clearTimeout(submitTimer);
    };
  }, [pitchMode, phase, currentItem]);

  const handleSubmit = async () => {
    if (pitchMode && !sessionId) { advance(); return; }
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
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        padding: "0 16px",
        minHeight: "calc(100vh - 75px)",
      }}
    >
      <AnimatePresence mode="wait">
        {phase === "question" && (
          <motion.div
            key="q"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -14 }}
            transition={{ duration: 0.45 }}
            style={{ width: "100%", maxWidth: 448 }}
          >
            {/* Error */}
            {error && (
              <div style={{ marginBottom: 16, borderRadius: 12, padding: 16, border: `1px solid rgba(239,68,68,0.3)`, backgroundColor: "#FFF2F2", fontSize: 14, color: B.red, fontFamily: INTER, fontWeight: 500 }}>
                {error} — <button onClick={() => setError(null)} style={{ textDecoration: "underline", background: "none", border: "none", color: "inherit", cursor: "pointer" }}>thử lại</button>
              </div>
            )}

            {/* Progress */}
            <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 32 }}>
              <span
                style={{
                  fontFamily: MONO,
                  fontSize: 12,
                  fontWeight: 700,
                  padding: "4px 10px",
                  borderRadius: 9999,
                  backgroundColor: B.blueLight,
                  color: B.blue,
                }}
              >
                Câu {questionNumber} / {maxQuestions}
              </span>
              <div style={{ display: "flex", gap: 4, flex: 1 }}>
                {Array.from({ length: maxQuestions }, (_, i) => (
                  <div
                    key={i}
                    style={{
                      flex: 1,
                      height: 6,
                      borderRadius: 9999,
                      backgroundColor: i < questionNumber ? B.blue : "#E5E7EB",
                      transition: "background-color 0.3s",
                    }}
                  />
                ))}
              </div>
            </div>

            {/* Question card */}
            <div
              style={{
                backgroundColor: B.white,
                borderColor: B.grayBorder,
                borderWidth: 1,
                borderStyle: "solid",
                borderRadius: 16,
                padding: 28,
                marginBottom: 20,
                boxShadow: "0 1px 3px rgba(0,0,0,0.05)",
              }}
            >
              <p style={{ fontFamily: INTER, color: B.textMuted, fontSize: 14, marginBottom: 20 }}>
                {currentItem?.kc_name || (pitchMode ? "Rút gọn biểu thức:" : "Câu hỏi chẩn đoán:")}
              </p>
              
              {pitchMode ? (
                <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 16 }}>
                  <Frac n={3} d={4} className="text-3xl" />
                  <span style={{ fontSize: 24, fontWeight: 300, color: B.textLight }}>+</span>
                  <Frac n={1} d={2} className="text-3xl" />
                  <span style={{ fontSize: 24, fontWeight: 300, color: B.textLight }}>=</span>
                  <span style={{ fontSize: 32, fontWeight: 700, color: "#D1D5DB", fontFamily: NUNITO }}>?</span>
                </div>
              ) : (
                <p style={{ color: B.text, fontFamily: INTER, fontSize: 18, fontWeight: 700, textAlign: "center", lineHeight: 1.5 }}>
                  {currentItem?.question || "Đang tải câu hỏi..."}
                </p>
              )}
            </div>

            {/* Answer widget card */}
            <div
              style={{
                backgroundColor: B.white,
                borderColor: isReady ? B.blue : B.grayBorder,
                borderWidth: 2,
                borderStyle: "solid",
                borderRadius: 16,
                padding: 28,
                marginBottom: 12,
                boxShadow: "0 1px 3px rgba(0,0,0,0.05)",
                textAlign: "center",
                transition: "border-color 0.2s",
              }}
            >
              <p style={{ fontFamily: NUNITO, color: B.textMuted, fontSize: 12, fontWeight: 600, marginBottom: 20 }}>
                Nhập đáp án của bạn
              </p>
              <div style={{ display: "flex", justifyContent: "center", marginBottom: 16 }}>
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
              </div>
              <p style={{ fontFamily: MONO, color: B.textLight, fontSize: 12 }}>
                {isFracWidget ? "Tab · ↑↓ để chuyển ô · Enter để nộp" : "Nhập đáp án và bấm Enter để nộp"}
              </p>
            </div>

            {/* Actions */}
            <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
              <button
                onClick={handleSubmit}
                disabled={!isReady || submitting}
                style={{
                  flex: 1,
                  borderRadius: 9999,
                  padding: "16px 0",
                  fontWeight: 700,
                  fontSize: 16,
                  backgroundColor: B.blue,
                  color: B.white,
                  fontFamily: NUNITO,
                  border: "none",
                  cursor: isReady && !submitting ? "pointer" : "not-allowed",
                  opacity: isReady && !submitting ? 1 : 0.25,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 8,
                  boxShadow: "0 4px 12px rgba(61,114,248,0.15)",
                  transition: "all 0.2s",
                }}
              >
                Nộp bài <ArrowRight size={18} />
              </button>
              <button
                onClick={handleSkip}
                disabled={submitting}
                style={{
                  borderRadius: 9999,
                  border: `2px solid ${B.grayBorder}`,
                  padding: "0 24px",
                  fontWeight: 600,
                  fontSize: 14,
                  color: B.textMuted,
                  fontFamily: NUNITO,
                  backgroundColor: B.white,
                  cursor: "pointer",
                  transition: "all 0.2s",
                }}
              >
                Không biết
              </button>
            </div>

            {/* Widget library link */}
            <button
              onClick={() => setShowWidgets(true)}
              style={{
                width: "100%",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 6,
                padding: "10px 0",
                borderRadius: 9999,
                backgroundColor: B.blueLight,
                color: B.blue,
                fontFamily: NUNITO,
                fontSize: 12,
                fontWeight: 600,
                border: "none",
                cursor: "pointer",
                transition: "all 0.2s",
              }}
            >
              <HelpCircle size={13} style={{ color: B.blue }} />
              <span>Xem tất cả loại widget toán học</span>
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
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              textAlign: "center",
              gap: 16,
              maxWidth: 280,
            }}
          >
            <div style={{ display: "flex", justifyContent: "center", gap: 8, marginBottom: 8 }}>
              {[0, 0.15, 0.3].map((d) => (
                <motion.div
                  key={d}
                  style={{ width: 10, height: 10, borderRadius: "50%", backgroundColor: B.orange }}
                  animate={{ y: [0, -8, 0], opacity: [0.5, 1, 0.5] }}
                  transition={{ duration: 0.9, repeat: Infinity, delay: d }}
                />
              ))}
            </div>
            <p style={{ fontFamily: NUNITO, color: B.text, fontWeight: 700, fontSize: 18, margin: 0 }}>
              Đang điều chỉnh câu tiếp theo
            </p>
            <p style={{ fontFamily: INTER, color: B.textMuted, fontSize: 14, lineHeight: 1.6, margin: 0 }}>
              Câu trả lời của bạn đã được phân tích.
              <br />Hệ thống đang chọn câu hỏi phù hợp nhất tiếp theo.
            </p>
            <div
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 8,
                padding: "6px 12px",
                borderRadius: 9999,
                backgroundColor: B.orangeLight,
              }}
            >
              <Zap size={12} style={{ color: B.orange }} />
              <span style={{ fontSize: 12, fontWeight: 700, fontFamily: NUNITO, color: B.orange }}>
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
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              textAlign: "center",
              gap: 20,
            }}
          >
            <div style={{ display: "flex", justifyContent: "center", gap: 8, marginBottom: 8 }}>
              {[0, 0.2, 0.4].map((d) => (
                <motion.div
                  key={d}
                  style={{ width: 12, height: 12, borderRadius: "50%", backgroundColor: B.blue }}
                  animate={{ y: [0, -10, 0] }}
                  transition={{ duration: 1.1, repeat: Infinity, delay: d }}
                />
              ))}
            </div>
            <p style={{ fontFamily: NUNITO, color: B.text, fontWeight: 700, fontSize: 20, margin: 0 }}>
              Đang xây dựng bản đồ tri thức
            </p>
            <p style={{ fontFamily: INTER, color: B.textMuted, fontSize: 14, margin: 0 }}>
              12 câu hỏi đã được phân tích…
            </p>
            <div style={{ width: 220, height: 6, borderRadius: 9999, overflow: "hidden", backgroundColor: "#E5E7EB" }}>
              <motion.div
                style={{ height: "100%", borderRadius: 9999, backgroundColor: B.blue }}
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
