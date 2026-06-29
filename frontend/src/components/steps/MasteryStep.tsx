"use client";
// ─── MasteryStep ──────────────────────────────────────────────────────────────
// Single-column centered layout matching reference layout exactly.
// Inline-styled for 100% reliable layout execution in production.

import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowRight, Check } from "lucide-react";
import { B, NUNITO, INTER, MONO } from "@/components/wizzdom/design-tokens";
import { StepCircle, Frac } from "@/components/wizzdom/MathDisplay";
import {
  FractionWidget, MathAnswerWidget, isFractionReady, serializeFraction,
  type FractionWidgetState, type WidgetType,
} from "@/components/wizzdom/MathWidgets";
import { submitAssessmentV2Mastery } from "@/lib/assessment-v2-api";
import type { AssessmentV2Result } from "@/lib/assessment-v2-api";

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

export function MasteryStep({ result, pitchMode, onComplete }: MasteryStepProps) {
  const mastery = result.learning_loop?.lesson?.mastery;

  // MCQ is pitch-only; real mode uses the API widget type (fraction/number/etc)
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
      import("@/lib/pitch-mock-data").then(({ PITCH_POST_MASTERY }) => {
        onComplete(PITCH_POST_MASTERY);
      });
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
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -16 }}
      transition={{ duration: 0.45 }}
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        padding: "48px 16px",
        minHeight: "calc(100vh - 72px)",
      }}
    >
      <div style={{ width: "100%", maxWidth: 448, display: "flex", flexDirection: "column", gap: 20 }}>
        
        {/* Step Indicator */}
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <StepCircle n={1} />
          <span
            style={{
              fontFamily: NUNITO,
              fontSize: 12,
              fontWeight: 700,
              padding: "6px 12px",
              borderRadius: 9999,
              backgroundColor: B.blueLight,
              color: B.blue,
            }}
          >
            Kiểm tra thành thạo · 1 câu
          </span>
        </div>

        {/* Question Card */}
        <div
          style={{
            backgroundColor: B.white,
            borderColor: B.grayBorder,
            borderWidth: 1,
            borderStyle: "solid",
            borderRadius: 16,
            padding: 28,
            boxShadow: "0 1px 3px rgba(0,0,0,0.05)",
          }}
        >
          <p style={{ fontSize: 14, color: B.textMuted, fontFamily: INTER, margin: "0 0 20px" }}>
            {pitchMode ? "Phân số nào đẳng trị với" : (mastery?.prompt ?? "Kiểm tra xem bài học đã hiệu quả chưa:")}
          </p>
          
          {pitchMode ? (
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <Frac n={2} d={3} className="text-3xl" />
              <span style={{ fontSize: 24, color: "#D1D5DB" }}>?</span>
            </div>
          ) : (
            <p style={{ fontSize: 18, fontWeight: 700, color: B.text, fontFamily: INTER, margin: 0, lineHeight: 1.5 }}>
              {mastery?.prompt || "Nhập đáp án cho câu hỏi học được."}
            </p>
          )}
        </div>

        {/* MCQ option buttons */}
        {isMCQ && (
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            {MCQ_OPTIONS.map((opt) => {
              const isSel = selected === opt.id;
              let borderColor: string = B.grayBorder;
              let bg: string = B.white;
              let textColor: string = B.text;
              if (submitted && opt.correct) { borderColor = B.green; bg = B.greenLight; textColor = B.green; }
              else if (submitted && isSel && !opt.correct) { borderColor = B.red; bg = B.redLight; textColor = B.red; }
              else if (!submitted && isSel) { borderColor = B.blue; bg = B.blueLight; textColor = B.blue; }
              
              return (
                <button
                  key={opt.id}
                  onClick={() => !submitted && setSelected(opt.id)}
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
                  <span style={{ fontSize: 24, fontWeight: 850, fontFamily: NUNITO, color: textColor }}>
                    {opt.label}
                  </span>
                  {submitted && opt.correct && (
                    <div style={{ display: "flex", justifyContent: "center", marginTop: 8 }}>
                      <Check size={16} style={{ color: B.green }} />
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        )}

        {/* Open widget card (real mode) */}
        {!isMCQ && (
          <div
            style={{
              backgroundColor: B.white,
              borderColor: submitted ? (openCorrect ? B.green : B.red) : isOpenReady ? B.blue : B.grayBorder,
              borderWidth: 2,
              borderStyle: "solid",
              borderRadius: 16,
              padding: 28,
              textAlign: "center",
              boxShadow: "0 1px 3px rgba(0,0,0,0.05)",
              transition: "border-color 0.2s"
            }}
          >
            <p style={{ fontFamily: NUNITO, color: B.textMuted, fontSize: 12, fontWeight: 600, marginBottom: 20 }}>
              Nhập đáp án của bạn
            </p>
            <div style={{ display: "flex", justifyContent: "center", marginBottom: 16 }}>
              {realWidgetType === "fraction" ? (
                <FractionWidget
                  num={fracState.num}
                  den={fracState.den}
                  onNumChange={(v) => setFracState((s) => ({ ...s, num: v }))}
                  onDenChange={(v) => setFracState((s) => ({ ...s, den: v }))}
                  onSubmit={!submitted ? handleOpenSubmit : undefined}
                  disabled={submitted || submitting}
                  size="lg"
                />
              ) : (
                <MathAnswerWidget
                  widgetType={realWidgetType}
                  disabled={submitted || submitting}
                  onSubmit={!submitted ? handleOpenSubmit : undefined}
                  textState={textState}
                  onTextChange={setTextState}
                />
              )}
            </div>
            <p style={{ fontFamily: MONO, color: B.textLight, fontSize: 12 }}>
              {realWidgetType === "fraction" ? "Tab · ↑↓ để chuyển ô · Enter để nộp" : "Nhập đáp án và bấm Enter để nộp"}
            </p>
          </div>
        )}

        {/* Feedback box */}
        <AnimatePresence>
          {submitted && (
            <motion.div
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
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
                ? (mastery?.hint ? `Chính xác! ${mastery.hint}` : "Chính xác! 2/3 = 4/6 vì cả tử số và mẫu số đều nhân với 2.")
                : (mastery?.hint ? `Chưa đúng. ${mastery.hint}` : "Chưa đúng. Hãy ôn lại bài học và thử lại.")
              }
            </motion.div>
          )}
        </AnimatePresence>

        {/* CTA buttons */}
        {!submitted ? (
          <button
            onClick={isMCQ ? handleMCQSubmit : handleOpenSubmit}
            disabled={isMCQ ? selected === null : !isOpenReady || submitting}
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
          <button
            onClick={() => {
              const ans = isMCQ
                ? MCQ_OPTIONS.find((o) => o.id === selected)?.label ?? ""
                : realWidgetType === "fraction" ? serializeFraction(fracState) : textState;
              handleComplete(ans);
            }}
            disabled={submitting}
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
