"use client";
// ─── LearnStep ────────────────────────────────────────────────────────────────
// Single-column centered layout matching reference layout exactly.
// Inline-styled for 100% reliable layout execution in production.

import { motion } from "framer-motion";
import { ArrowRight, Check } from "lucide-react";
import { B, NUNITO, INTER, MONO } from "@/components/wizzdom/design-tokens";
import {
  Frac, FractionBar, StepCircle, PitchBar,
} from "@/components/wizzdom/MathDisplay";
import type { AssessmentV2Result } from "@/lib/assessment-v2-api";

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

export function LearnStep({ result, pitchMode, onComplete }: LearnStepProps) {
  const lesson = result.learning_loop?.lesson;
  const rec = result.learning_loop?.recommendation;

  const title = lesson?.title ?? (pitchMode ? PITCH_FALLBACK.title : "Bài học mục tiêu");
  const subtitle = lesson?.subtitle ?? (pitchMode ? PITCH_FALLBACK.subtitle : (rec?.name ? `${rec.name} · mục tiêu` : "Bài học"));
  const concept = lesson?.concept ?? (pitchMode ? PITCH_FALLBACK.concept : "");
  const practicePrompt = lesson?.practice_prompt ?? (pitchMode ? PITCH_FALLBACK.practicePrompt : "");
  const workedExample = lesson?.worked_example ?? [];

  const isFractionLesson = pitchMode || (rec?.code ?? "").includes("fraction") || (lesson?.title ?? "").toLowerCase().includes("phân số");

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -16 }}
      transition={{ duration: 0.45 }}
    >
      <PitchBar active={pitchMode} duration={6000} onComplete={onComplete} />
      
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          padding: "48px 16px",
          minHeight: "calc(100vh - 78px)",
        }}
      >
        <div
          style={{
            width: "100%",
            maxWidth: 576,
            display: "flex",
            flexDirection: "column",
            gap: 24,
          }}
        >
          {/* Subtitle / Category Badges */}
          <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
            <span
              style={{
                fontFamily: NUNITO,
                fontSize: 12,
                fontWeight: 700,
                padding: "6px 12px",
                borderRadius: 9999,
                backgroundColor: B.orangeLight,
                color: B.orange,
              }}
            >
              {subtitle}
            </span>
            <span style={{ fontSize: 12, color: B.textMuted, fontFamily: INTER }}>
              Mở khóa 6 kỹ năng liên kết
            </span>
          </div>

          {/* Title & Concept */}
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

          {/* Main Visual or Worked Example Card */}
          <div
            style={{
              backgroundColor: B.white,
              borderColor: B.grayBorder,
              borderWidth: 1,
              borderStyle: "solid",
              borderRadius: 16,
              padding: 24,
              display: "flex",
              flexDirection: "column",
              gap: 16,
              boxShadow: "0 1px 3px rgba(0,0,0,0.05)",
            }}
          >
            {workedExample.length > 0 ? (
              <>
                <p style={{ fontFamily: NUNITO, color: B.textMuted, fontSize: 12, fontWeight: 600, margin: 0 }}>
                  Ví dụ minh họa:
                </p>
                <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                  {workedExample.map((step, i) => (
                    <div key={i} style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
                      <div
                        style={{
                          width: 20,
                          height: 20,
                          borderRadius: "50%",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          backgroundColor: B.blueLight,
                          color: B.blue,
                          fontSize: 11,
                          fontWeight: 700,
                          fontFamily: NUNITO,
                          flexShrink: 0,
                        }}
                      >
                        {i + 1}
                      </div>
                      <p style={{ fontSize: 14, lineHeight: 1.45, color: B.textMid, fontFamily: INTER, margin: 0 }}>
                        {step}
                      </p>
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
                <div
                  style={{
                    borderTop: `1px solid ${B.grayBorder}`,
                    paddingTop: 12,
                    display: "flex",
                    alignItems: "flex-start",
                    gap: 10,
                  }}
                >
                  <Check size={15} style={{ color: B.green, flexShrink: 0, marginTop: 2 }} />
                  <p style={{ fontSize: 14, lineHeight: 1.5, color: B.textMid, fontFamily: INTER, margin: 0 }}>
                    Nhân (hoặc chia) cả tử số và mẫu số cho cùng một số → phân số vẫn đẳng trị.
                  </p>
                </div>
              </>
            )}
          </div>

          {/* Practice card */}
          {practicePrompt && (
            <div
              style={{
                borderRadius: 16,
                padding: 20,
                backgroundColor: B.blueLight,
                borderWidth: 1,
                borderStyle: "solid",
                borderColor: "rgba(61,114,248,0.15)",
                display: "flex",
                flexDirection: "column",
                gap: 12,
              }}
            >
              <p style={{ fontSize: 12, fontWeight: 700, fontFamily: NUNITO, color: B.blue, margin: 0 }}>
                Tại sao cần cho bài toán {pitchMode ? "3/4 + 1/2" : (rec?.code ?? "kỹ năng mục tiêu")}
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

          {/* Action Button */}
          <button
            onClick={onComplete}
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
