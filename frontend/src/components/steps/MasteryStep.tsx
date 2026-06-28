"use client";
// ─── MasteryStep ──────────────────────────────────────────────────────────────
// Full-width two-column: mastery check (left) · knowledge map preview (right)
// Mirrors old .shell.lesson-grid pattern

import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowRight, Check, BadgeCheck } from "lucide-react";
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

  const [selected, setSelected] = useState<number | null>(null);
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [fracState, setFracState] = useState<FractionWidgetState>({ num: "", den: "" });
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

  useEffect(() => {
    if (!pitchMode) return;
    const t1 = setTimeout(() => setSelected(1), 1000);
    const t2 = setTimeout(() => setSubmitted(true), 2400);
    const t3 = setTimeout(() => handleComplete("4/6"), 4200);
    return () => { clearTimeout(t1); clearTimeout(t2); clearTimeout(t3); };
  }, [pitchMode, handleComplete]);

  const handleMCQSubmit = () => { if (selected !== null) setSubmitted(true); };

  const handleOpenSubmit = () => {
    if (!isFractionReady(fracState)) return;
    const answer = serializeFraction(fracState);
    const accepted = mastery?.accepted_answers ?? [];
    const isCorrect = accepted.some((a) => a.replace(/\s/g, "") === answer.replace(/\s/g, ""));
    setOpenCorrect(isCorrect);
    setSubmitted(true);
  };

  const isOpenReady = isFractionReady(fracState);
  const mcqCorrect = isMCQ && selected !== null && (pitchMode ? PITCH_MCQ[selected].correct : false);

  // Build skill summary rows from result
  const reviewSkills = result.summary?.skills_to_review?.slice(0, 4) ?? [];
  const strongSkills = result.summary?.strong_areas?.slice(0, 3) ?? [];

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -16 }}
      transition={{ duration: 0.45 }}
      style={{ minHeight: "calc(100vh - 68px)", padding: 36 }}
    >
      <div
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
          alignItems: "start",
          minHeight: 480,
        }}
      >
        {/* Left: mastery check */}
        <div style={{ display: "grid", gap: 24 }}>
          {/* Eyebrow */}
          <div style={{ display: "inline-flex", alignItems: "center", gap: 7, width: "fit-content", color: B.blue, background: B.blueLight, border: `1px solid rgba(61,114,248,0.2)`, borderRadius: 999, padding: "7px 13px", fontWeight: 800, fontSize: 13, fontFamily: NUNITO }}>
            <BadgeCheck size={15} /> Kiểm tra thành thạo
          </div>

          {/* Heading */}
          <div>
            <h2 style={{ fontFamily: NUNITO, color: B.text, fontSize: 32, fontWeight: 800, margin: "0 0 10px", lineHeight: 1.1 }}>
              Kiểm tra xem bài học đã hiệu quả chưa.
            </h2>
            <p style={{ color: B.textMuted, fontFamily: INTER, fontSize: 15, lineHeight: 1.6, margin: 0 }}>
              Câu hỏi này hẹp hơn phần chẩn đoán — nó xác nhận kỹ năng mục tiêu trước khi cập nhật bản đồ.
            </p>
          </div>

          {/* Mastery box */}
          <div style={{ background: B.white, border: `1px solid ${B.grayBorder}`, borderRadius: 24, padding: 24, display: "grid", gap: 18 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <StepCircle n={1} />
              <p style={{ fontFamily: INTER, color: B.text, fontSize: 16, fontWeight: 600, margin: 0 }}>
                {mastery?.prompt ?? "Phân số nào đẳng trị với"}
                {!mastery?.prompt && (
                  <span style={{ marginLeft: 8 }}>
                    <Frac n={2} d={3} className="text-xl" />?
                  </span>
                )}
              </p>
            </div>

            {/* MCQ options */}
            {isMCQ && (
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
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
                      style={{
                        borderRadius: 20, padding: "20px 12px", textAlign: "center", border: `2px solid ${borderColor}`,
                        backgroundColor: bg, cursor: submitted ? "default" : "pointer",
                        boxShadow: !submitted && isSel ? `0 0 0 3px ${B.blueLight}` : "none",
                        transition: "all 0.15s",
                      }}
                    >
                      <span style={{ fontSize: 24, fontWeight: 800, fontFamily: NUNITO, color: textColor }}>{opt.label}</span>
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

            {/* Open widget */}
            {!isMCQ && (
              <div style={{
                borderRadius: 20, padding: 24, border: `2px solid ${submitted ? (openCorrect ? B.green : B.red) : isOpenReady ? B.blue : B.grayBorder}`,
                backgroundColor: B.white, textAlign: "center", transition: "border-color 0.2s",
              }}>
                <p style={{ fontFamily: NUNITO, color: B.textMuted, fontSize: 12, fontWeight: 600, marginBottom: 20 }}>Nhập đáp án của bạn</p>
                <div style={{ display: "flex", justifyContent: "center" }}>
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
              {submitted && (
                <motion.div
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  style={{
                    borderRadius: 16, padding: 14, fontSize: 14, lineHeight: 1.5, fontWeight: 500, fontFamily: INTER,
                    backgroundColor: (isMCQ ? mcqCorrect : openCorrect) ? B.greenLight : B.redLight,
                    border: `1px solid ${(isMCQ ? mcqCorrect : openCorrect) ? "rgba(16,185,129,0.3)" : "rgba(239,68,68,0.3)"}`,
                    color: (isMCQ ? mcqCorrect : openCorrect) ? B.green : B.red,
                  }}
                >
                  {(isMCQ ? mcqCorrect : openCorrect)
                    ? (mastery?.hint ? `Chính xác! ${mastery.hint}` : "Chính xác! Nhân cả tử số và mẫu số với 2: 2/3 × 2/2 = 4/6")
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
                style={{
                  borderRadius: 999, padding: "16px 0", fontWeight: 700, fontSize: 16,
                  backgroundColor: B.blue, color: B.white, fontFamily: NUNITO,
                  border: "none", cursor: (isMCQ ? selected !== null : isOpenReady) && !submitting ? "pointer" : "not-allowed",
                  opacity: (isMCQ ? selected !== null : isOpenReady) && !submitting ? 1 : 0.3,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  boxShadow: "0 4px 16px rgba(61,114,248,0.25)",
                }}
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
                style={{
                  borderRadius: 999, padding: "16px 0", fontWeight: 700, fontSize: 16,
                  border: `2px solid ${B.blue}`, backgroundColor: B.white, color: B.blue, fontFamily: NUNITO,
                  cursor: "pointer",
                  display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
                  opacity: submitting ? 0.5 : 1,
                }}
              >
                {(isMCQ ? mcqCorrect : openCorrect) ? "Xem tiến độ của tôi" : "Tiếp tục"} <ArrowRight size={18} />
              </button>
            )}
          </div>
        </div>

        {/* Right: evidence panel */}
        <div style={{ display: "grid", gap: 20 }}>
          {/* Skills to review */}
          {reviewSkills.length > 0 && (
            <div style={{ background: B.white, border: `1px solid ${B.grayBorder}`, borderRadius: 24, padding: 22, display: "grid", gap: 14 }}>
              <h3 style={{ fontFamily: NUNITO, color: B.text, fontSize: 15, margin: 0, display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ width: 10, height: 10, borderRadius: "50%", backgroundColor: B.orange, display: "inline-block" }} />
                Kỹ năng cần ôn tập
              </h3>
              <div style={{ display: "grid", gap: 8 }}>
                {reviewSkills.map((row) => (
                  <div key={row.kc_id} style={{ display: "grid", gridTemplateColumns: "auto 1fr auto", gap: 10, alignItems: "center", border: `1px solid ${B.grayBorder}`, borderRadius: 14, padding: 12, background: "#FFFBF0" }}>
                    <span style={{ width: 10, height: 10, borderRadius: "50%", backgroundColor: B.orange, display: "inline-block" }} />
                    <p style={{ fontFamily: INTER, color: B.text, fontSize: 13, margin: 0, fontWeight: 500 }}>{row.name}</p>
                    <span style={{ fontFamily: MONO, color: B.textMuted, fontSize: 11, fontWeight: 700 }}>{Math.round(row.p_mastery * 100)}%</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Strong areas */}
          {strongSkills.length > 0 && (
            <div style={{ background: B.white, border: `1px solid ${B.grayBorder}`, borderRadius: 24, padding: 22, display: "grid", gap: 14 }}>
              <h3 style={{ fontFamily: NUNITO, color: B.text, fontSize: 15, margin: 0, display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ width: 10, height: 10, borderRadius: "50%", backgroundColor: B.green, display: "inline-block" }} />
                Kỹ năng đã thành thạo
              </h3>
              <div style={{ display: "grid", gap: 8 }}>
                {strongSkills.map((row) => (
                  <div key={row.kc_id} style={{ display: "grid", gridTemplateColumns: "auto 1fr auto", gap: 10, alignItems: "center", border: `1px solid rgba(16,185,129,0.2)`, borderRadius: 14, padding: 12, background: B.greenLight }}>
                    <Check size={13} style={{ color: B.green }} />
                    <p style={{ fontFamily: INTER, color: B.text, fontSize: 13, margin: 0, fontWeight: 500 }}>{row.name}</p>
                    <span style={{ fontFamily: MONO, color: B.green, fontSize: 11, fontWeight: 700 }}>{Math.round(row.p_mastery * 100)}%</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Fallback when no data */}
          {reviewSkills.length === 0 && strongSkills.length === 0 && (
            <div style={{ background: "#f8fbff", border: `1px solid ${B.grayBorder}`, borderRadius: 24, padding: 24 }}>
              <p style={{ fontFamily: INTER, color: B.textMuted, fontSize: 14, lineHeight: 1.6, margin: 0 }}>
                Sau khi nộp, bản đồ tri thức của bạn sẽ được cập nhật với kết quả kiểm tra thành thạo này.
              </p>
            </div>
          )}
        </div>
      </div>
    </motion.div>
  );
}
