"use client";
// ─── MasteryStep ──────────────────────────────────────────────────────────────
// Mastery check: supports MCQ (4 options) + open math widget
// Real API: POST /mastery → updated result
// Pitch mode: auto-select correct + submit

import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowRight, Check } from "lucide-react";
import { B, NUNITO, INTER, MONO } from "@/components/wizzdom/design-tokens";
import { StepCircle, Frac } from "@/components/wizzdom/MathDisplay";
import {
  FractionWidget, isFractionReady, serializeFraction,
  type FractionWidgetState,
} from "@/components/wizzdom/MathWidgets";
import { submitAssessmentV2Mastery } from "@/lib/assessment-v2-api";
import type { AssessmentV2Result } from "@/lib/assessment-v2-api";
import { PITCH_MCQ } from "@/lib/pitch-mock-data";

interface MasteryStepProps {
  result: AssessmentV2Result;
  pitchMode: boolean;
  onComplete: (updatedResult: AssessmentV2Result) => void;
}

export function MasteryStep({ result, pitchMode, onComplete }: MasteryStepProps) {
  const mastery = result.learning_loop?.lesson?.mastery;
  const isMCQ = pitchMode || mastery?.answer_widget === "mcq" || !mastery;

  // MCQ state
  const [selected, setSelected] = useState<number | null>(null);
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Open widget state
  const [fracState, setFracState] = useState<FractionWidgetState>({ num: "", den: "" });

  const correct = isMCQ
    ? selected !== null && (pitchMode ? PITCH_MCQ[selected].correct : false)
    : false; // computed after submit for open widgets

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
      // If API fails, still proceed with current result
      onComplete(result);
    } finally {
      setSubmitting(false);
    }
  }, [pitchMode, result, onComplete]);

  // Pitch mode: auto-select correct + auto-advance
  useEffect(() => {
    if (!pitchMode) return;
    const t1 = setTimeout(() => setSelected(1), 1000);
    const t2 = setTimeout(() => setSubmitted(true), 2400);
    const t3 = setTimeout(() => handleComplete("4/6"), 4200);
    return () => { clearTimeout(t1); clearTimeout(t2); clearTimeout(t3); };
  }, [pitchMode, handleComplete]);

  const handleMCQSubmit = () => {
    if (selected === null) return;
    setSubmitted(true);
  };

  const handleOpenSubmit = () => {
    if (!isFractionReady(fracState)) return;
    const answer = serializeFraction(fracState);
    const accepted = mastery?.accepted_answers ?? [];
    const isCorrect = accepted.some((a) =>
      a.replace(/\s/g, "") === answer.replace(/\s/g, "")
    );
    setOpenCorrect(isCorrect);
    setSubmitted(true);
  };

  const isOpenReady = isFractionReady(fracState);
  const showFeedback = submitted;

  // MCQ correct/wrong for color
  const mcqCorrect = isMCQ && selected !== null && (pitchMode
    ? PITCH_MCQ[selected].correct
    : false);

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -16 }}
      transition={{ duration: 0.45 }}
      className="flex flex-col items-center justify-center px-4"
      style={{ minHeight: "calc(100vh - 72px)" }}
    >
      <div className="w-full max-w-md space-y-5">
        {/* Badge row */}
        <div className="flex items-center gap-2">
          <StepCircle n={1} />
          <span className="text-xs font-bold px-3 py-1.5 rounded-full"
            style={{ fontFamily: NUNITO, backgroundColor: B.blueLight, color: B.blue }}>
            Kiểm tra thành thạo · 1 câu
          </span>
        </div>

        {/* Question card */}
        <div className="rounded-2xl p-7 border shadow-sm"
          style={{ backgroundColor: B.white, borderColor: B.grayBorder }}>
          <p className="text-sm mb-5" style={{ color: B.textMuted, fontFamily: INTER }}>
            {mastery?.prompt ?? "Phân số nào đẳng trị với"}
          </p>
          {!mastery?.prompt && (
            <div className="flex items-center gap-3">
              <Frac n={2} d={3} className="text-3xl" />
              <span className="text-2xl" style={{ color: "#D1D5DB" }}>?</span>
            </div>
          )}
        </div>

        {/* MCQ options */}
        {isMCQ && (
          <div className="grid grid-cols-2 gap-3">
            {PITCH_MCQ.map((opt) => {
              const isSel = selected === opt.id;
              let borderColor: string = B.grayBorder;
              let bg: string = B.white;
              let textColor: string = B.text;

              if (submitted && opt.correct) { borderColor = B.green; bg = B.greenLight; textColor = B.green; }
              else if (submitted && isSel && !opt.correct) { borderColor = B.red; bg = B.redLight; textColor = B.red; }
              else if (!submitted && isSel) { borderColor = B.blue; bg = B.blueLight; textColor = B.blue; }

              return (
                <button key={opt.id}
                  onClick={() => !submitted && setSelected(opt.id)}
                  className="rounded-2xl p-5 text-center border-2 transition-all shadow-sm"
                  style={{
                    borderColor, backgroundColor: bg,
                    cursor: submitted ? "default" : "pointer",
                    boxShadow: !submitted && isSel ? `0 0 0 3px ${B.blueLight}` : undefined,
                  }}>
                  <span className="text-2xl font-extrabold" style={{ fontFamily: NUNITO, color: textColor }}>
                    {opt.label}
                  </span>
                  {submitted && opt.correct && (
                    <div className="flex justify-center mt-2">
                      <Check size={16} style={{ color: B.green }} />
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        )}

        {/* Open fraction widget */}
        {!isMCQ && (
          <div className="rounded-2xl p-7 border-2 shadow-sm text-center"
            style={{
              backgroundColor: B.white,
              borderColor: submitted ? (openCorrect ? B.green : B.red) : isOpenReady ? B.blue : B.grayBorder,
              transition: "border-color 0.2s",
            }}>
            <p className="text-xs font-semibold mb-5" style={{ fontFamily: NUNITO, color: B.textMuted }}>
              Nhập đáp án của bạn
            </p>
            <div className="flex justify-center">
              <FractionWidget
                num={fracState.num} den={fracState.den}
                onNumChange={(v) => setFracState((s) => ({ ...s, num: v }))}
                onDenChange={(v) => setFracState((s) => ({ ...s, den: v }))}
                onSubmit={!submitted ? handleOpenSubmit : undefined}
                disabled={submitted || submitting}
              />
            </div>
          </div>
        )}

        {/* Feedback */}
        <AnimatePresence>
          {showFeedback && (
            <motion.div
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              className="rounded-2xl p-4 border text-sm leading-relaxed font-medium"
              style={{
                fontFamily: INTER,
                backgroundColor: (isMCQ ? mcqCorrect : openCorrect) ? B.greenLight : B.redLight,
                borderColor: (isMCQ ? mcqCorrect : openCorrect)
                  ? "rgba(16,185,129,0.3)" : "rgba(239,68,68,0.3)",
                color: (isMCQ ? mcqCorrect : openCorrect) ? B.green : B.red,
              }}
            >
              {(isMCQ ? mcqCorrect : openCorrect)
                ? (mastery?.hint ? `Chính xác! ${mastery.hint}` : "Chính xác! 2/3 = 4/6 vì cả tử số và mẫu số đều nhân với 2.")
                : `Chưa đúng. ${mastery?.hint ?? "Đáp án là 4/6 — nhân cả 2 và 3 với 2."}`
              }
            </motion.div>
          )}
        </AnimatePresence>

        {/* Actions */}
        {!submitted ? (
          <button
            onClick={isMCQ ? handleMCQSubmit : handleOpenSubmit}
            disabled={isMCQ ? selected === null : !isOpenReady || submitting}
            className="w-full rounded-full py-4 font-bold transition-all hover:opacity-90 active:scale-[0.98] disabled:opacity-25 disabled:cursor-not-allowed shadow-sm"
            style={{ backgroundColor: B.blue, color: B.white, fontFamily: NUNITO, fontSize: "1rem" }}
          >
            Nộp bài
          </button>
        ) : (
          <button
            onClick={() => {
              const ans = isMCQ ? PITCH_MCQ.find((o) => o.id === selected)?.label ?? "" : serializeFraction(fracState);
              handleComplete(ans);
            }}
            disabled={submitting}
            className="w-full rounded-full py-4 font-bold border-2 transition-all hover:opacity-80 flex items-center justify-center gap-2 disabled:opacity-50"
            style={{ borderColor: B.blue, backgroundColor: B.white, color: B.blue, fontFamily: NUNITO, fontSize: "1rem" }}
          >
            {(isMCQ ? mcqCorrect : openCorrect) ? "Xem tiến độ của tôi" : "Tiếp tục"} <ArrowRight size={18} />
          </button>
        )}
      </div>
    </motion.div>
  );
}
