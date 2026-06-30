"use client";
// ─── Assessment V2 — Algebra Page ─────────────────────────────────────────────
// Self-contained page mirroring reference app interface 100%, replacing mock data with API data where appropriate.
// Implements unified learning loop: Assess → Map → Learn → Mastery → Outcome
// Dual mode: Real Live API (default) + Pitch Demo (with auto-advance)
// Styled using local CSS definitions for 100% reliable layout execution in production.

import { useState, useEffect, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowRight, Check, RotateCcw, Zap, Play, Pause, HelpCircle } from "lucide-react";
import { B, NUNITO, INTER, MONO } from "@/components/wizzdom/design-tokens";
import { KnowledgeMap, PitchProofMap } from "@/components/wizzdom/KnowledgeMap";
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
import { PITCH_RESULT, PITCH_POST_MASTERY, PITCH_ASSESS_QUESTION, PITCH_GRAPH_PROOF } from "@/lib/pitch-mock-data";
import {
  DEMO_FRACTION_EDGES,
  DEMO_FRACTION_MAP_POST,
  DEMO_FRACTION_MAP_PRE,
  DEMO_OUTCOME_NODE_IDS,
  DEMO_TARGET_NODE_ID,
} from "@/lib/demo-map-data";

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

function DiagnosticReasoningTrace({ stage, onContinue }: { stage: "pattern" | "graph"; onContinue: () => void }) {
  const isGraphStage = stage === "graph";
  const proof = PITCH_GRAPH_PROOF.evidence;
  const steps = [
    { label: "Đã chấm đáp án", active: true },
    { label: "Nhận diện lỗi sai", active: true },
    { label: "Gắn vào kỹ năng", active: isGraphStage },
    { label: "Truy vết tiên quyết", active: isGraphStage },
    { label: "Chọn bài luyện", active: isGraphStage },
  ];

  return (
    <motion.div
      key={`diagnostic-${stage}`}
      initial={{ opacity: 0, y: 18 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      transition={{ duration: 0.35 }}
      style={{
        width: "100%",
        maxWidth: 860,
        display: "grid",
        gridTemplateColumns: "minmax(0, 1fr)",
        gap: 18,
      }}
    >
      <div
        style={{
          borderRadius: 24,
          border: `1px solid ${B.grayBorder}`,
          backgroundColor: B.white,
          boxShadow: "0 18px 45px rgba(15, 23, 42, 0.08)",
          padding: 24,
          display: "grid",
          gridTemplateColumns: "minmax(0, 0.95fr) minmax(0, 1.1fr)",
          gap: 20,
          alignItems: "stretch",
        }}
      >
        <div
          style={{
            borderRadius: 20,
            backgroundColor: "#F8FAFF",
            border: `1px solid ${B.grayBorder}`,
            padding: 20,
            display: "flex",
            flexDirection: "column",
            justifyContent: "space-between",
            gap: 18,
          }}
        >
          <div>
            <p style={{ margin: "0 0 8px", fontFamily: MONO, fontSize: 11, fontWeight: 900, color: B.blue, textTransform: "uppercase", letterSpacing: 0 }}>
              Bằng chứng từ câu tự luận
            </p>
            <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
              <Frac n={1} d={2} className="text-xl" />
              <span style={{ color: B.textLight, fontSize: 20 }}>+</span>
              <Frac n={1} d={3} className="text-xl" />
              <span style={{ color: B.textLight, fontSize: 20 }}>=</span>
              <span style={{ color: B.orange }}>
                <Frac n={2} d={5} className="text-xl" />
              </span>
            </div>
          </div>

          <motion.div
            initial={{ opacity: 0.2 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.4 }}
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              gap: 10,
            }}
          >
            {[
              ["Tử số", "1 + 1 → 2"],
              ["Mẫu số", "2 + 3 → 5"],
            ].map(([label, value]) => (
              <div key={label} style={{ borderRadius: 16, padding: "12px 14px", backgroundColor: B.orangeLight, border: "1px solid rgba(245,158,11,0.28)" }}>
                <p style={{ margin: "0 0 4px", fontFamily: MONO, fontSize: 10, fontWeight: 900, color: B.orange, textTransform: "uppercase", letterSpacing: 0 }}>{label}</p>
                <p style={{ margin: 0, fontFamily: NUNITO, fontSize: 18, fontWeight: 900, color: B.text }}>{value}</p>
              </div>
            ))}
          </motion.div>

          <p style={{ margin: 0, fontFamily: INTER, fontSize: 13, lineHeight: 1.5, color: B.textMid }}>
            Lỗi sai được nhận diện: <strong style={{ color: B.text }}>{proof.detected_pattern}</strong>
          </p>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <div
            style={{
              borderRadius: 20,
              padding: 18,
              border: `1.5px solid ${isGraphStage ? "rgba(245,158,11,0.4)" : B.grayBorder}`,
              backgroundColor: isGraphStage ? B.orangeLight : B.white,
            }}
          >
            <p style={{ margin: "0 0 8px", fontFamily: MONO, fontSize: 11, fontWeight: 900, color: isGraphStage ? B.orange : B.textMuted, textTransform: "uppercase", letterSpacing: 0 }}>
              Lỗi sai → nút kiến thức
            </p>
            <p style={{ margin: "0 0 12px", fontFamily: NUNITO, fontSize: 22, lineHeight: 1.1, fontWeight: 950, color: B.text }}>
              Cần quy đồng mẫu trước khi cộng phân số khác mẫu
            </p>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
              {["G6-MATH-QUY-DONG-MAU", "Lỗ hổng khả nghi", "Truy vết tiên quyết"].map((chip, index) => (
                <span key={chip} style={{ padding: "6px 10px", borderRadius: 9999, backgroundColor: index === 1 ? B.orange : B.white, color: index === 1 ? B.white : B.textMid, border: index === 1 ? "none" : `1px solid ${B.grayBorder}`, fontFamily: index === 0 ? MONO : NUNITO, fontSize: 11, fontWeight: 900 }}>
                  {chip}
                </span>
              ))}
            </div>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: 10 }}>
            {proof.affected_skills.map((skill, index) => (
              <motion.div
                key={skill}
                initial={{ opacity: 0.3, y: 8 }}
                animate={{ opacity: isGraphStage ? 1 : 0.38, y: isGraphStage ? 0 : 8 }}
                transition={{ duration: 0.35, delay: isGraphStage ? index * 0.08 : 0 }}
                style={{
                  minHeight: 86,
                  borderRadius: 16,
                  padding: 12,
                  border: `1px solid ${B.grayBorder}`,
                  backgroundColor: isGraphStage ? "#F8FAFC" : B.white,
                  display: "flex",
                  flexDirection: "column",
                  justifyContent: "space-between",
                }}
              >
                <p style={{ margin: 0, fontFamily: NUNITO, fontSize: 13, lineHeight: 1.18, fontWeight: 900, color: B.text }}>
                  {skill}
                </p>
                <span style={{ alignSelf: "flex-start", padding: "4px 7px", borderRadius: 9999, backgroundColor: B.white, border: `1px solid ${B.grayBorder}`, fontFamily: MONO, fontSize: 9, fontWeight: 900, color: B.textMuted }}>
                  CÓ THỂ BỊ ẢNH HƯỞNG
                </span>
              </motion.div>
            ))}
          </div>
        </div>
      </div>

      <div style={{ display: "flex", justifyContent: "center", gap: 8, flexWrap: "wrap" }}>
        {steps.map((step, index) => (
          <motion.div
            key={step.label}
            initial={{ opacity: 0.35 }}
            animate={{ opacity: step.active ? 1 : 0.38 }}
            transition={{ duration: 0.25, delay: index * 0.04 }}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 7,
              padding: "8px 10px",
              borderRadius: 9999,
              backgroundColor: step.active ? B.blueLight : B.white,
              border: `1px solid ${step.active ? "rgba(61,114,248,0.22)" : B.grayBorder}`,
              color: step.active ? B.blue : B.textLight,
              fontFamily: NUNITO,
              fontSize: 12,
              fontWeight: 850,
            }}
          >
            <span style={{ width: 18, height: 18, borderRadius: 9999, display: "inline-flex", alignItems: "center", justifyContent: "center", backgroundColor: step.active ? B.blue : "#E5E7EB", color: B.white, fontFamily: MONO, fontSize: 9, fontWeight: 900 }}>
              {step.active ? <Check size={11} /> : index + 1}
            </span>
            {step.label}
          </motion.div>
        ))}
      </div>

      <button
        onClick={onContinue}
        style={{
          justifySelf: "center",
          minWidth: 240,
          borderRadius: 9999,
          padding: "14px 24px",
          fontWeight: 850,
          fontSize: 15,
          backgroundColor: B.blue,
          color: B.white,
          fontFamily: NUNITO,
          border: "none",
          cursor: "pointer",
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          gap: 8,
          boxShadow: "0 8px 20px rgba(61,114,248,0.18)",
        }}
      >
        {isGraphStage ? "Xem bản đồ kiến thức" : "Truy vết vào bản đồ kiến thức"} <ArrowRight size={17} />
      </button>
    </motion.div>
  );
}

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
    let active = true;
    const applyMockFallback = () => {
      console.warn("API failed or pitch mode enabled with backend offline. Using mock demo data.");
      if (!active) return;
      setCurrentItem(PITCH_ASSESS_QUESTION as AssessmentV2Item);
      setQuestionNumber(6);
      setMaxQuestions(12);
      setError(null);
    };

    if (pitchMode) {
      applyMockFallback();
      initialized.current = true;
      return;
    }

    if (initialized.current) return;
    initialized.current = true;

    createAssessmentV2Session({ max_questions: 12 })
      .then((res) => {
        if (!active) return;
        setSessionId(res.session_id);
        setMaxQuestions(res.max_questions);
        if (res.item) {
          setCurrentItem(res.item);
          setQuestionNumber(res.question_number ?? 1);
        }
      })
      .catch((err) => {
        if (active) setError(err.message);
      });

    return () => {
      active = false;
    };
  }, [pitchMode]);

  const advance = useCallback(
    (result?: AssessmentV2Result, sid?: string) => {
      if (pitchMode) {
        setPhase("adapting");
        return;
      }
      const adaptDelay = pitchMode ? 2300 : 950;
      const completeDelay = pitchMode ? 5200 : 950 + 1800;
      setPhase("adapting");
      setTimeout(() => setPhase("processing"), adaptDelay);
      setTimeout(() => {
        if (pitchMode) {
          onComplete(PITCH_RESULT, "pitch-demo");
        } else if (result && sid) {
          onComplete(result, sid);
        }
      }, completeDelay);
    },
    [pitchMode, onComplete]
  );

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
      className="assess-wrapper"
    >
      <AnimatePresence mode="wait">
        {phase === "question" && (
          <motion.div
            key="q"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -14 }}
            transition={{ duration: 0.45 }}
            className="assess-content"
          >
            {/* Error */}
            {error && (
              <div style={{ marginBottom: 16, borderRadius: 12, padding: 16, border: `1px solid rgba(239,68,68,0.3)`, backgroundColor: "#FFF2F2", fontSize: 14, color: B.red, fontFamily: INTER, fontWeight: 500 }}>
                {error} — <button onClick={() => setError(null)} style={{ textDecoration: "underline", background: "none", border: "none", color: "inherit", cursor: "pointer" }}>thử lại</button>
              </div>
            )}

            {/* Progress */}
            <div className="progress-bar-wrapper">
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
            <div className="question-card">
              <p style={{ fontFamily: INTER, color: B.textMuted, fontSize: 14, marginBottom: 20, margin: "0 0 20px" }}>
                {pitchMode ? `${currentItem?.kc_code ?? "G6 Đại số"} · ${currentItem?.kc_name ?? "Câu hỏi chẩn đoán"}` : (currentItem?.kc_name || "Câu hỏi chẩn đoán:")}
              </p>
              
              {pitchMode ? (
                <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 14 }}>
                  <p style={{ color: B.text, fontFamily: INTER, fontSize: 18, fontWeight: 700, textAlign: "center", lineHeight: 1.5, margin: 0 }}>
                    Tính:
                  </p>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 16 }}>
                    <Frac n={1} d={2} className="text-3xl" />
                    <span style={{ fontSize: 24, fontWeight: 300, color: B.textLight }}>+</span>
                    <Frac n={1} d={3} className="text-3xl" />
                    <span style={{ fontSize: 24, fontWeight: 300, color: B.textLight }}>=</span>
                    <span style={{ fontSize: 32, fontWeight: 700, color: "#D1D5DB", fontFamily: NUNITO }}>?</span>
                  </div>
                </div>
              ) : (
                <p style={{ color: B.text, fontFamily: INTER, fontSize: 18, fontWeight: 700, textAlign: "center", lineHeight: 1.5, margin: 0 }}>
                  {currentItem?.question || "Đang tải câu hỏi..."}
                </p>
              )}
            </div>

            {/* Answer widget card */}
            <div
              className="answer-widget-card"
              style={{
                borderColor: (pitchMode ? isFractionReady(fracState) : isReady) ? B.blue : B.grayBorder,
                borderWidth: 2,
                borderStyle: "solid",
              }}
            >
              <p style={{ fontFamily: NUNITO, color: B.textMuted, fontSize: 12, fontWeight: 600, marginBottom: 20, margin: "0 0 20px" }}>
                Nhập đáp án của bạn
              </p>
              <div style={{ display: "flex", justifyContent: "center", marginBottom: 16 }}>
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
              <p style={{ fontFamily: MONO, color: B.textLight, fontSize: 12, margin: 0 }}>
                {isFracWidget ? "Tab · ↑↓ để chuyển ô · Enter để nộp" : "Nhập đáp án và bấm Enter để nộp"}
              </p>
            </div>

            {/* Actions */}
            <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
              <button
                onClick={handleSubmit}
                disabled={!(pitchMode ? isFractionReady(fracState) : isReady) || submitting}
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
                  cursor: (pitchMode ? isFractionReady(fracState) : isReady) && !submitting ? "pointer" : "not-allowed",
                  opacity: (pitchMode ? isFractionReady(fracState) : isReady) && !submitting ? 1 : 0.25,
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
                onClick={handleSkip}
                disabled={submitting}
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
          pitchMode ? (
            <DiagnosticReasoningTrace stage="pattern" onContinue={() => setPhase("processing")} />
          ) : (
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
          )
        )}

        {/* Processing State */}
        {phase === "processing" && (
          pitchMode ? (
            <DiagnosticReasoningTrace stage="graph" onContinue={() => onComplete(PITCH_RESULT, "pitch-demo")} />
          ) : (
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
          )
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
  const adaptedSkills = pitchMode ? DEMO_FRACTION_MAP_PRE : adaptSummaryToSkills(result.summary);
  const totalSkills = pitchMode ? DEMO_FRACTION_MAP_PRE.length : (vm.skills_directly_tested + vm.skills_inferred);
  const targetNodeId = pitchMode ? DEMO_TARGET_NODE_ID : findTargetNodeId(result.learning_loop?.recommendation?.kc_id);
  const recommendationName = result.learning_loop?.recommendation?.name ?? "Kỹ năng trọng tâm";

  const breakdown = [
    { color: B.blue,    label: "Đã vững",           value: String(result.summary.strong_areas.length) },
    { color: B.blueMid, label: "Đang phát triển",  value: String(result.summary.possibly_affected.length) },
    { color: B.orange,  label: "Lỗ hổng kỹ năng",     value: String(result.summary.skills_to_review.length), accent: true },
    { color: "#94A3B8", label: "Suy luận từ dữ liệu", value: "—", dim: true },
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
      <PitchBar active={false} duration={pitchMode ? 9500 : 6500} onComplete={onComplete} />
      <div className={`map-step-container ${pitchMode ? "pitch-proof-grid" : ""}`}>
        <div style={{ padding: pitchMode ? 22 : 16, display: "flex", alignItems: pitchMode ? "flex-start" : "center", justifyContent: "center" }}>
          <div style={{ width: "100%", maxWidth: pitchMode ? 980 : 580, aspectRatio: pitchMode ? undefined : "1/1" }}>
            {pitchMode ? (
              <PitchProofMap
                skills={DEMO_FRACTION_MAP_PRE}
                edges={DEMO_FRACTION_EDGES}
                targetNodeId={DEMO_TARGET_NODE_ID}
              />
            ) : (
              <KnowledgeMap
                skills={adaptedSkills}
                edges={undefined}
                targetNodeId={targetNodeId}
                animateIn
                showTarget
              />
            )}
          </div>
        </div>

        <motion.div initial={pitchMode ? { opacity: 1, x: 0 } : { opacity: 0, x: 24 }} animate={pitchMode ? { opacity: 1, x: 0 } : panelIn ? { opacity: 1, x: 0 } : {}}
          transition={{ duration: 0.55, ease: "easeOut" }}
          className="right-panel">

          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
              <span style={{ fontFamily: MONO, fontSize: 12, fontWeight: 500, color: B.textMuted }}>
                {vm.questions_asked} câu hỏi
              </span>
              <span style={{ color: "#D1D5DB" }}>→</span>
            </div>
            <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
              <span style={{ fontSize: 56, fontWeight: 800, fontFamily: NUNITO, color: B.text }}>{skillCount}</span>
              <span style={{ fontSize: 18, fontWeight: 600, fontFamily: NUNITO, color: B.textMuted }}>kỹ năng được vẽ</span>
            </div>
          </div>

          <motion.div initial={{ opacity: 0 }} animate={skillCount >= Math.floor(totalSkills * 0.6) ? { opacity: 1 } : {}} transition={{ duration: 0.5 }}
            style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {breakdown.map((row) => (
              <div key={row.label}
                style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 14, borderTop: row.dim ? `1px solid ${B.grayBorder}` : undefined, paddingTop: row.dim ? 8 : undefined }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <div style={{ width: 10, height: 10, borderRadius: "50%", backgroundColor: row.color }} />
                  <span style={{ fontFamily: INTER, color: B.textMid }}>{row.label}</span>
                </div>
                <span style={{ fontWeight: 600, fontFamily: MONO, color: row.accent ? B.orange : row.dim ? B.textLight : B.text }}>
                  {row.value}
                </span>
              </div>
            ))}
          </motion.div>

          {pitchMode && (
            <>
              <motion.div initial={{ opacity: 0 }} animate={skillCount >= Math.floor(totalSkills * 0.85) ? { opacity: 1 } : {}} transition={{ duration: 0.5 }}
                style={{ borderRadius: 18, padding: 16, border: `1px solid rgba(245,158,11,0.25)`, backgroundColor: B.orangeLight, display: "flex", flexDirection: "column", gap: 10 }}>
                <p style={{ fontFamily: MONO, fontSize: 10, fontWeight: 900, color: B.orange, margin: 0, textTransform: "uppercase", letterSpacing: 0 }}>
                  Dấu vết chẩn đoán
                </p>
                <div style={{ display: "grid", gridTemplateColumns: "88px 1fr", gap: "7px 10px", alignItems: "start" }}>
                  {[
                    ["Câu hỏi", PITCH_GRAPH_PROOF.evidence.item],
                    ["Đáp án", PITCH_GRAPH_PROOF.evidence.student_answer],
                    ["Mẫu lỗi", PITCH_GRAPH_PROOF.evidence.detected_pattern],
                    ["Lỗ hổng", PITCH_GRAPH_PROOF.evidence.inferred_blocker],
                  ].map(([label, value]) => (
                    <div key={label} style={{ display: "contents" }}>
                      <span style={{ fontFamily: MONO, fontSize: 10, fontWeight: 900, color: B.textMuted }}>{label}</span>
                      <span style={{ fontFamily: INTER, fontSize: 12, lineHeight: 1.35, color: B.text, fontWeight: label === "Đáp án" ? 850 : 600 }}>{value}</span>
                    </div>
                  ))}
                </div>
              </motion.div>
            </>
          )}

          <motion.div initial={{ opacity: 0, y: 8 }} animate={skillCount >= totalSkills ? { opacity: 1, y: 0 } : {}}
            transition={{ duration: 0.5 }} style={{ borderRadius: 16, padding: 16, display: "flex", flexDirection: "column", gap: 8, backgroundColor: B.orangeLight, border: `1.5px solid rgba(245,158,11,0.25)` }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <Zap size={14} style={{ color: B.orange }} />
              <span style={{ fontSize: 12, fontWeight: 700, fontFamily: NUNITO, color: B.orange }}>Kỹ năng trọng tâm đã xác định</span>
            </div>
            <p style={{ fontWeight: 700, fontFamily: NUNITO, color: B.text, fontSize: 16, margin: 0 }}>
              {recommendationName}
            </p>
            <p style={{ fontSize: 12, lineHeight: 1.5, color: B.textMid, fontFamily: INTER, margin: 0 }}>
              Câu sai chỉ ra một kiến thức tiên quyết: cần quy đồng mẫu trước khi cộng phân số khác mẫu.
            </p>
            {pitchMode && (
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 2 }}>
                {PITCH_GRAPH_PROOF.evidence.affected_skills.map((skill) => (
                  <span key={skill} style={{ padding: "5px 8px", borderRadius: 9999, backgroundColor: B.white, border: `1px solid ${B.grayBorder}`, fontFamily: INTER, fontSize: 11, fontWeight: 700, color: B.textMid }}>
                    {skill}
                  </span>
                ))}
              </div>
            )}
          </motion.div>

          <motion.button initial={{ opacity: 0 }} animate={skillCount >= totalSkills ? { opacity: 1 } : {}}
            transition={{ duration: 0.4, delay: 0.3 }} onClick={onComplete}
            style={{
              width: "100%",
              borderRadius: 9999,
              padding: "16px 0",
              fontWeight: 700,
              fontSize: 16,
              backgroundColor: B.blue,
              color: B.white,
              fontFamily: NUNITO,
              border: "none",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 8,
              boxShadow: "0 4px 12px rgba(61,114,248,0.15)",
              transition: "all 0.2s",
            }}
          >
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
  title: "Phân số bằng nhau",
  subtitle: "Nhánh phân số · kiến thức nền",
  concept: "Các phân số bằng nhau biểu diễn cùng một giá trị dưới nhiều dạng khác nhau.",
  practicePrompt: "Trước khi cộng phân số, cần quy đồng mẫu:",
};

function LearnStep({ result, pitchMode, onComplete }: LearnStepProps) {
  const lesson = result.learning_loop?.lesson;
  const rec = result.learning_loop?.recommendation;

  const title = lesson?.title ?? PITCH_FALLBACK.title;
  const subtitle = lesson?.subtitle ?? (rec?.name ? `${rec.name} · mục tiêu` : PITCH_FALLBACK.subtitle);
  const concept = lesson?.concept ?? PITCH_FALLBACK.concept;
  const practicePrompt = lesson?.practice_prompt ?? PITCH_FALLBACK.practicePrompt;
  const workedExample = lesson?.worked_example ?? [];

  const isFractionLesson = pitchMode || (rec?.code ?? "").includes("fraction") || (lesson?.title ?? "").toLowerCase().includes("phân số");

  return (
    <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -16 }} transition={{ duration: 0.45 }}>
      <PitchBar active={false} duration={6000} onComplete={onComplete} />
      <div className="learn-container">
        <div className="learn-wrapper">
          <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
            <span style={{ fontFamily: NUNITO, fontSize: 12, fontWeight: 700, padding: "6px 12px", borderRadius: 9999, backgroundColor: B.orangeLight, color: B.orange }}>
              {subtitle}
            </span>
            <span style={{ fontSize: 12, color: B.textMuted, fontFamily: INTER }}>Mở khóa các kỹ năng liên kết</span>
          </div>

          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
              <StepCircle n={1} done />
              <h2 style={{ fontSize: 24, fontWeight: 800, fontFamily: NUNITO, color: B.text, margin: 0 }}>
                {title}
              </h2>
            </div>
            {concept && (
              <p style={{ paddingLeft: 36, fontSize: 16, lineHeight: 1.5, color: B.textMid, fontFamily: INTER, margin: 0 }}>
                {concept}
              </p>
            )}
          </div>

          <div className="learn-visual-card">
            {workedExample.length > 0 ? (
              <>
                <p style={{ fontFamily: NUNITO, color: B.textMuted, fontSize: 12, fontWeight: 600, margin: 0 }}>Ví dụ minh họa:</p>
                <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                  {workedExample.map((step, i) => (
                    <div key={i} style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
                      <div style={{ width: 20, height: 20, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", backgroundColor: B.blueLight, color: B.blue, fontSize: 11, fontWeight: 700, fontFamily: NUNITO, flexShrink: 0 }}>
                        {i + 1}
                      </div>
                      <p style={{ fontSize: 14, lineHeight: 1.45, color: B.textMid, fontFamily: INTER, margin: 0 }}>{step}</p>
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <>
                <p style={{ fontFamily: NUNITO, color: B.textMuted, fontSize: 12, fontWeight: 600, margin: 0 }}>
                  Tất cả đều biểu diễn cùng một giá trị:
                </p>
                <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                  <FractionBar n={1} d={2} color={B.blue} label="1/2" />
                  <FractionBar n={2} d={4} color={B.blue} label="2/4" />
                  <FractionBar n={3} d={6} color={B.blue} label="3/6" />
                </div>
                <div style={{ borderTop: `1px solid ${B.grayBorder}`, paddingTop: 12, display: "flex", alignItems: "flex-start", gap: 10 }}>
                  <Check size={15} style={{ color: B.green, flexShrink: 0, marginTop: 2 }} />
                  <p style={{ fontSize: 14, lineHeight: 1.5, color: B.textMid, fontFamily: INTER, margin: 0 }}>
                    Nhân hoặc chia cả tử số và mẫu số cho cùng một số khác 0 thì giá trị phân số không đổi.
                  </p>
                </div>
              </>
            )}
          </div>

          {practicePrompt && (
            <div style={{ borderRadius: 16, padding: 20, backgroundColor: B.blueLight, borderWidth: 1, borderStyle: "solid", borderColor: "rgba(61,114,248,0.15)", display: "flex", flexDirection: "column", gap: 12 }}>
              <p style={{ fontSize: 12, fontWeight: 700, fontFamily: NUNITO, color: B.blue, margin: 0 }}>
                Vì sao chọn bài học này
              </p>
              <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", fontSize: 14, fontFamily: INTER, color: B.textMid }}>
                <span>{practicePrompt}</span>
                {isFractionLesson && (
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <Frac n={1} d={2} className="text-base" />
                    <span style={{ color: B.textLight }}>=</span>
                    <Frac n={2} d={4} className="text-base" />
                    <span style={{ fontSize: 11, fontFamily: MONO, color: B.textMuted }}>(×2)</span>
                  </div>
                )}
              </div>
            </div>
          )}

          <button onClick={onComplete}
            style={{
              width: "100%",
              borderRadius: 9999,
              padding: "16px 0",
              fontWeight: 700,
              fontSize: 16,
              backgroundColor: B.blue,
              color: B.white,
              fontFamily: NUNITO,
              border: "none",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 8,
              boxShadow: "0 4px 12px rgba(61,114,248,0.15)",
              transition: "all 0.2s",
            }}
          >
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

  const isMCQ = false;
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
      className="mastery-container">
      <div className="mastery-wrapper">
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <StepCircle n={1} />
          <span className="text-xs font-bold px-3 py-1.5 rounded-full"
            style={{ fontFamily: NUNITO, backgroundColor: B.blueLight, color: B.blue }}>
            Kiểm tra thành thạo · 1 câu
          </span>
        </div>

        <div className="question-card" style={{ padding: 28, marginBottom: 0 }}>
          <p style={{ fontSize: 14, color: B.textMuted, fontFamily: INTER, margin: "0 0 20px" }}>
            Câu tự luận kiểm tra sau học
          </p>
          <p style={{ fontSize: 18, fontWeight: 700, color: B.text, fontFamily: INTER, margin: 0, lineHeight: 1.5 }}>
            {mastery?.prompt || "Nhập đáp án cho câu hỏi học được."}
          </p>
        </div>

        {isMCQ ? (
          <div className="mcq-grid">
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
                  style={{
                    borderRadius: 16,
                    padding: 20,
                    textAlign: "center",
                    borderWidth: 2,
                    borderStyle: "solid",
                    borderColor,
                    backgroundColor: bg,
                    cursor: submitted ? "default" : "pointer",
                    boxShadow: !submitted && isSel ? `0 0 0 3px ${B.blueLight}` : undefined,
                    transition: "all 0.15s",
                  }}
                >
                  <span style={{ fontSize: 24, fontWeight: 850, fontFamily: NUNITO, color: textColor }}>{opt.label}</span>
                  {submitted && opt.correct && <div style={{ display: "flex", justifyContent: "center", marginTop: 8 }}><Check size={16} style={{ color: B.green }} /></div>}
                </button>
              );
            })}
          </div>
        ) : (
          <div className="answer-widget-card"
            style={{ borderColor: submitted ? (openCorrect ? B.green : B.red) : isOpenReady ? B.blue : B.grayBorder, borderWidth: 2, borderStyle: "solid", margin: 0 }}>
            <p style={{ fontFamily: NUNITO, color: B.textMuted, fontSize: 12, fontWeight: 600, marginBottom: 20, margin: "0 0 20px" }}>Nhập đáp án của bạn</p>
            <div style={{ display: "flex", justifyContent: "center", marginBottom: 16 }}>
              {realWidgetType === "fraction" ? (
                <FractionWidget num={fracState.num} den={fracState.den} onNumChange={(v) => setFracState(s => ({ ...s, num: v }))} onDenChange={(v) => setFracState(s => ({ ...s, den: v }))} onSubmit={!submitted ? handleOpenSubmit : undefined} disabled={submitted || submitting} size="lg" />
              ) : (
                <MathAnswerWidget widgetType={realWidgetType} disabled={submitted || submitting} onSubmit={!submitted ? handleOpenSubmit : undefined} textState={textState} onTextChange={setTextState} />
              )}
            </div>
            <p style={{ fontFamily: MONO, color: B.textLight, fontSize: 12, margin: 0 }}>
              {realWidgetType === "fraction" ? "Tab · ↑↓ để chuyển ô · Enter để nộp" : "Nhập đáp án và bấm Enter để nộp"}
            </p>
          </div>
        )}

        <AnimatePresence>
          {submitted && (
            <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}
              style={{
                borderRadius: 16,
                padding: 16,
                borderWidth: 1,
                borderStyle: "solid",
                fontSize: 14,
                lineHeight: 1.5,
                fontWeight: 500,
                fontFamily: INTER,
                backgroundColor: (isMCQ ? mcqCorrect : openCorrect) ? B.greenLight : B.redLight,
                borderColor: (isMCQ ? mcqCorrect : openCorrect) ? "rgba(16,185,129,0.3)" : "rgba(239,68,68,0.3)",
                color: (isMCQ ? mcqCorrect : openCorrect) ? B.green : B.red
              }}
            >
              {(isMCQ ? mcqCorrect : openCorrect)
                ? (mastery?.hint ? `Chính xác! ${mastery.hint}` : "Chính xác.")
                : (mastery?.hint ? `Chưa đúng. ${mastery.hint}` : "Chưa đúng. Hãy ôn lại bài học và thử lại.")}
            </motion.div>
          )}
        </AnimatePresence>

        {!submitted ? (
          <button onClick={isMCQ ? handleMCQSubmit : handleOpenSubmit} disabled={isMCQ ? selected === null : !isOpenReady || submitting}
            style={{
              width: "100%",
              borderRadius: 9999,
              padding: "16px 0",
              fontWeight: 700,
              fontSize: 16,
              backgroundColor: B.blue,
              color: B.white,
              fontFamily: NUNITO,
              border: "none",
              cursor: (isMCQ ? selected !== null : isOpenReady) && !submitting ? "pointer" : "not-allowed",
              opacity: (isMCQ ? selected !== null : isOpenReady) && !submitting ? 1 : 0.25,
              boxShadow: "0 4px 12px rgba(61,114,248,0.15)",
              transition: "all 0.2s",
            }}
          >
            Nộp bài
          </button>
        ) : (
          <button onClick={() => {
            const ans = isMCQ ? MCQ_OPTIONS.find((o) => o.id === selected)?.label ?? "" : realWidgetType === "fraction" ? serializeFraction(fracState) : textState;
            handleComplete(ans);
          }} disabled={submitting}
            style={{
              width: "100%",
              borderRadius: 9999,
              padding: "16px 0",
              fontWeight: 700,
              fontSize: 16,
              backgroundColor: B.white,
              color: B.blue,
              fontFamily: NUNITO,
              border: `2px solid ${B.blue}`,
              cursor: submitting ? "not-allowed" : "pointer",
              opacity: submitting ? 0.5 : 1,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 8,
              transition: "all 0.2s",
            }}
          >
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

  const isPitchResult = postResult.session_id === "pitch-real-g6-algebra";
  const preSkills  = isPitchResult ? DEMO_FRACTION_MAP_PRE : adaptSummaryToSkills(preResult.summary);
  const postSkills = isPitchResult ? DEMO_FRACTION_MAP_POST : adaptSummaryToSkills(postResult.summary);
  const outcomeNodeIds = isPitchResult ? DEMO_OUTCOME_NODE_IDS : findOutcomeNodeIds(preSkills, postSkills);
  const targetNodeId   = isPitchResult ? DEMO_TARGET_NODE_ID : findTargetNodeId(postResult.learning_loop?.recommendation?.kc_id);

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
      changes.push({ label: post.label.replace(/\n/g, " "), from: stateLabel[pre.strength], to: stateLabel[post.strength] });
    }
  });

  const displayChanges = changes.length > 0 ? changes : isPitchResult ? [
    { label: "Quy đồng mẫu", from: "Khoảng trống", to: "Đang phát triển" },
    { label: "Cộng phân số khác mẫu", from: "Khoảng trống", to: "Sẵn sàng luyện tập" },
    { label: "So sánh phân số khác mẫu", from: "Suy luận", to: "Đang phát triển" },
  ] : [
    { label: "Tính đẳng trị", from: "Khoảng trống", to: "Đang phát triển" },
    { label: "Rút gọn",       from: "Khoảng trống", to: "Có thể tiếp cận" },
    { label: "Cộng/trừ phân số", from: "Khoảng trống", to: "Có thể tiếp cận" },
  ];

  const upgradedCount = outcomeNodeIds.size || displayChanges.length;

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.5 }}
      className={`outcome-container ${isPitchResult ? "pitch-proof-grid" : ""}`}>
      <div style={{ padding: isPitchResult ? 22 : 16, display: "flex", alignItems: isPitchResult ? "flex-start" : "center", justifyContent: "center" }}>
        <div style={{ width: "100%", maxWidth: isPitchResult ? 980 : 580, aspectRatio: isPitchResult ? undefined : "1/1" }}>
          {isPitchResult ? (
            <PitchProofMap
              skills={DEMO_FRACTION_MAP_POST}
              edges={DEMO_FRACTION_EDGES}
              targetNodeId={DEMO_TARGET_NODE_ID}
              outcomeNodeIds={DEMO_OUTCOME_NODE_IDS}
              outcome
            />
          ) : (
            <KnowledgeMap
              skills={postSkills}
              edges={undefined}
              targetNodeId={targetNodeId}
              outcomeNodeIds={outcomeNodeIds}
              showTarget
              outcome
            />
          )}
        </div>
      </div>

      <motion.div initial={{ opacity: 0, x: 24 }} animate={show ? { opacity: 1, x: 0 } : {}} transition={{ duration: 0.55 }}
        className="right-panel">
        <div>
          <p style={{ fontFamily: MONO, fontSize: 11, fontWeight: 700, color: B.textMuted, margin: "0 0 4px" }}>Hoàn tất learning loop</p>
          <h2 style={{ fontFamily: NUNITO, fontSize: 24, fontWeight: 800, color: B.text, margin: 0 }}>Bản đồ kiến thức đã cập nhật</h2>
        </div>

        <div style={{ display: "flex", flexDirection: "column" }}>
          {displayChanges.map((c, i) => (
            <div key={i} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "14px 0", borderBottom: i < displayChanges.length - 1 ? `1px solid ${B.grayBorder}` : undefined }}>
              <span style={{ fontSize: 14, fontWeight: 700, fontFamily: NUNITO, color: B.text }}>{c.label}</span>
              <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11, fontWeight: 650, fontFamily: MONO }}>
                <span style={{ color: B.orange }}>{c.from}</span>
                <span style={{ color: B.textLight }}>→</span>
                <span style={{ color: B.green }}>{c.to}</span>
              </div>
            </div>
          ))}
        </div>

        <div style={{ borderRadius: 16, padding: 16, border: `1px solid rgba(61,114,248,0.2)`, backgroundColor: B.blueLight }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
            <Zap size={14} style={{ color: B.blue }} />
            <span style={{ fontSize: 12, fontWeight: 700, fontFamily: NUNITO, color: B.blue }}>{upgradedCount} kỹ năng được cập nhật</span>
          </div>
          <p style={{ fontSize: 14, lineHeight: 1.5, color: B.textMid, fontFamily: INTER, margin: 0 }}>
            Bài học tiên quyết giúp các kỹ năng liên kết tiến gần hơn tới tầm với. Wizzdom đã cập nhật bản đồ cá nhân của học sinh.
          </p>
        </div>

        {isPitchResult && (
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {[
              ["Hành động cho giáo viên", PITCH_GRAPH_PROOF.coach_action],
              ["Diễn giải cho phụ huynh", PITCH_GRAPH_PROOF.parent_translation],
            ].map(([label, value]) => (
              <div key={label} style={{ borderRadius: 16, padding: 15, border: `1px solid ${B.grayBorder}`, backgroundColor: B.white }}>
                <p style={{ margin: "0 0 6px", fontFamily: MONO, fontSize: 10, fontWeight: 900, color: label === "Hành động cho giáo viên" ? B.blue : B.orange, textTransform: "uppercase", letterSpacing: 0 }}>
                  {label}
                </p>
                <p style={{ margin: 0, fontFamily: INTER, fontSize: 13, lineHeight: 1.45, fontWeight: 650, color: B.textMid }}>
                  {value}
                </p>
              </div>
            ))}
          </div>
        )}

        <div style={{ display: "flex", gap: 12 }}>
          <button onClick={onRestart}
            style={{
              flex: 1,
              borderRadius: 9999,
              padding: "14px 0",
              fontWeight: 700,
              fontSize: 14,
              backgroundColor: B.white,
              color: B.textMuted,
              border: `2px solid ${B.grayBorder}`,
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 8,
              transition: "all 0.2s",
            }}
          >
            <RotateCcw size={14} /> Xem lại demo
          </button>
          <button onClick={onNext}
            style={{
              flex: 1,
              borderRadius: 9999,
              padding: "14px 0",
              fontWeight: 700,
              fontSize: 14,
              backgroundColor: B.blue,
              color: B.white,
              fontFamily: NUNITO,
              border: "none",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 8,
              boxShadow: "0 4px 12px rgba(61,114,248,0.15)",
              transition: "all 0.2s",
            }}
          >
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
    <div className="loop-container">
      {/* CSS Layout style tag injection */}
      <style>{`
        .loop-container {
          min-height: 100vh;
          background-color: #F5F7FF;
          font-family: 'Inter', sans-serif;
          display: flex;
          flex-direction: column;
          overflow-x: hidden;
        }
        .header-wrapper {
          height: 72px;
          border-bottom: 1px solid rgba(0, 0, 0, 0.08);
          display: flex;
          align-items: center;
          padding: 0 20px;
          gap: 16px;
          background-color: #FFFFFF;
        }
        @media (min-width: 640px) {
          .header-wrapper {
            padding: 0 32px;
          }
        }
        .step-bar-container {
          flex: 1;
          display: flex;
          justify-content: center;
          overflow-x: auto;
        }
        .student-chip {
          display: none;
        }
        @media (min-width: 640px) {
          .student-chip {
            display: flex;
            align-items: center;
            gap: 8px;
          }
        }

        /* AssessStep */
        .assess-wrapper {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          padding: 0 16px;
          min-height: calc(100vh - 75px);
        }
        .assess-content {
          width: 100%;
          max-width: 448px;
        }
        .progress-bar-wrapper {
          display: flex;
          align-items: center;
          gap: 12px;
          margin-bottom: 32px;
          width: 100%;
        }
        .question-card {
          background-color: #FFFFFF;
          border: 1px solid rgba(0, 0, 0, 0.08);
          border-radius: 16px;
          padding: 28px;
          margin-bottom: 20px;
          box-shadow: 0 1px 3px rgba(0, 0, 0, 0.05);
        }
        .answer-widget-card {
          background-color: #FFFFFF;
          border-radius: 16px;
          padding: 28px;
          margin-bottom: 12px;
          box-shadow: 0 1px 3px rgba(0, 0, 0, 0.05);
          text-align: center;
          transition: border-color 0.2s;
        }

        /* MapStep & OutcomeStep */
        .map-step-container {
          display: grid;
          grid-template-columns: 1fr;
          min-height: calc(100vh - 78px);
        }
        @media (min-width: 1024px) {
          .map-step-container {
            grid-template-columns: 1fr 360px;
          }
          .map-step-container.pitch-proof-grid,
          .outcome-container.pitch-proof-grid {
            grid-template-columns: minmax(0, 1fr) 390px;
          }
        }
        .right-panel {
          border-top: 1px solid rgba(0, 0, 0, 0.08);
          display: flex;
          flex-direction: column;
          justify-content: center;
          gap: 24px;
          padding: 28px;
          background-color: #FFFFFF;
        }
        @media (min-width: 1024px) {
          .right-panel {
            border-top: 0;
            border-left: 1px solid rgba(0, 0, 0, 0.08);
            padding: 32px;
          }
          .pitch-proof-grid .right-panel {
            padding: 28px;
            gap: 18px;
          }
        }

        /* LearnStep */
        .learn-container {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          padding: 48px 16px;
          min-height: calc(100vh - 78px);
        }
        .learn-wrapper {
          width: 100%;
          max-width: 576px;
          display: flex;
          flex-direction: column;
          gap: 24px;
        }
        .learn-visual-card {
          background-color: #FFFFFF;
          border: 1px solid rgba(0, 0, 0, 0.08);
          border-radius: 16px;
          padding: 24px;
          display: flex;
          flex-direction: column;
          gap: 16px;
          box-shadow: 0 1px 3px rgba(0, 0, 0, 0.05);
        }

        /* MasteryStep */
        .mastery-container {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          padding: 48px 16px;
          min-height: calc(100vh - 72px);
        }
        .mastery-wrapper {
          width: 100%;
          max-width: 448px;
          display: flex;
          flex-direction: column;
          gap: 20px;
        }
        .mcq-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 12px;
        }

        /* OutcomeStep */
        .outcome-container {
          display: grid;
          grid-template-columns: 1fr;
          min-height: calc(100vh - 72px);
        }
        @media (min-width: 1024px) {
          .outcome-container {
            grid-template-columns: 1fr 360px;
          }
          .outcome-container.pitch-proof-grid {
            grid-template-columns: minmax(0, 1fr) 390px;
          }
        }
      `}</style>

      {/* Header */}
      <header className="header-wrapper">
        <WizzdomLogo />

        <div className="step-bar-container">
          <StepBar current={currentStep} />
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
          {/* Pitch mode toggle */}
          <button onClick={togglePitch}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 6,
              padding: "8px 14px",
              borderRadius: 9999,
              fontSize: 12,
              fontWeight: 700,
              border: "none",
              cursor: "pointer",
              backgroundColor: pitchMode ? B.blue : B.blueLight,
              color: pitchMode ? B.white : B.blue,
              fontFamily: NUNITO,
              transition: "all 0.2s",
            }}
            title={pitchMode ? "Tắt chế độ demo" : "Bật chế độ demo trình bày"}>
            {pitchMode ? <Pause size={12} /> : <Play size={12} />}
            <span>Trình bày</span>
          </button>

          {/* Student chip */}
          <div className="student-chip">
            <div className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold"
              style={{ backgroundColor: B.blueLight, color: B.blue, fontFamily: NUNITO, width: 28, height: 28, borderRadius: "50%" }}>
              {sessionId ? sessionId.slice(0, 1).toUpperCase() : "M"}
            </div>
            <span style={{ fontSize: 12, fontWeight: 500, fontFamily: MONO, color: B.textMuted }}>
              {pitchMode ? "Trình bày" : sessionId ? `#${sessionId.slice(-4)}` : "Minh · 8A"}
            </span>
          </div>
        </div>
      </header>

      {/* Pages Container */}
      <div style={{ flex: 1 }}>
        <AnimatePresence mode="wait">
          {phase === "assess" && (
            <AssessStep key={pitchMode ? "assess-pitch" : "assess-live"} pitchMode={pitchMode} onComplete={handleAssessComplete} />
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
    </div>
  );
}
