"use client";
// ─── LearnStep ────────────────────────────────────────────────────────────────
// Full-width two-column: lesson copy (left) · visual + evidence (right)
// Real API data from learning_loop.lesson; pitch fallbacks only in pitchMode

import { motion } from "framer-motion";
import { ArrowRight, Check, BookOpen, Target } from "lucide-react";
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

// Pitch-only fallback content
const PITCH_FALLBACK = {
  title: "Tính đẳng trị của phân số",
  subtitle: "Cụm Phân số · Gốc rễ",
  concept: "Hai phân số đẳng trị khi chúng biểu diễn cùng một giá trị — chỉ được viết khác đi.",
  practicePrompt: "Để tính 3/4 + 1/2, cần quy đồng mẫu số trước: 1/2 = 2/4 (nhân với 2)",
  workedExample: [
    "1/2 = 2/4 = 3/6 — tất cả cùng một giá trị",
    "Nhân cả tử và mẫu với 2: 1/2 × 2/2 = 2/4",
    "Nhân cả tử và mẫu với 3: 1/2 × 3/3 = 3/6",
  ],
};

export function LearnStep({ result, pitchMode, onComplete }: LearnStepProps) {
  const lesson = result.learning_loop?.lesson;
  const rec = result.learning_loop?.recommendation;

  // Use API data; fall back to pitch content only in pitch mode
  const title = lesson?.title ?? (pitchMode ? PITCH_FALLBACK.title : "Bài học");
  const subtitle = lesson?.subtitle ?? (pitchMode ? PITCH_FALLBACK.subtitle : "");
  const concept = lesson?.concept ?? (pitchMode ? PITCH_FALLBACK.concept : "");
  const practicePrompt = lesson?.practice_prompt ?? (pitchMode ? PITCH_FALLBACK.practicePrompt : "");
  const workedExample = lesson?.worked_example ?? (pitchMode ? PITCH_FALLBACK.workedExample : []);
  const isFractionLesson = pitchMode || (rec?.code ?? "").includes("fraction");

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -16 }}
      transition={{ duration: 0.45 }}
      style={{ minHeight: "calc(100vh - 68px)", padding: 36 }}
    >
      <PitchBar active={pitchMode} duration={6000} onComplete={onComplete} />

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
        {/* Left: lesson copy */}
        <div style={{ display: "grid", gap: 24 }}>
          {/* Eyebrow */}
          <div style={{ display: "inline-flex", alignItems: "center", gap: 7, width: "fit-content", color: B.blue, background: B.blueLight, border: `1px solid rgba(61,114,248,0.2)`, borderRadius: 999, padding: "7px 13px", fontWeight: 800, fontSize: 13, fontFamily: NUNITO }}>
            <BookOpen size={15} /> Bài học mục tiêu
          </div>

          {/* Context badge */}
          {subtitle && (
            <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
              <span style={{ fontFamily: NUNITO, backgroundColor: B.orangeLight, color: B.orange, fontSize: 13, fontWeight: 700, padding: "6px 14px", borderRadius: 999 }}>
                {subtitle}
              </span>
            </div>
          )}

          {/* Title */}
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
              <StepCircle n={1} done />
              <h2 style={{ fontFamily: NUNITO, color: B.text, fontSize: 32, fontWeight: 800, margin: 0, lineHeight: 1.1 }}>
                {title}
              </h2>
            </div>
            {concept && (
              <p style={{ color: B.textMuted, fontFamily: INTER, fontSize: 16, lineHeight: 1.6, margin: 0, paddingLeft: 36 }}>
                {concept}
              </p>
            )}
          </div>

          {/* Worked steps */}
          {workedExample.length > 0 && (
            <div style={{ display: "grid", gap: 10 }}>
              {workedExample.map((step, i) => (
                <div key={i} style={{ display: "grid", gridTemplateColumns: "34px 1fr", gap: 10, alignItems: "start", background: B.white, border: `1px solid ${B.grayBorder}`, borderRadius: 18, padding: 14 }}>
                  <span style={{ width: 34, height: 34, display: "grid", placeItems: "center", borderRadius: "50%", background: B.blue, color: B.white, fontWeight: 900, fontFamily: NUNITO, fontSize: 14 }}>
                    {i + 1}
                  </span>
                  <p style={{ color: B.textMid, fontFamily: INTER, fontSize: 14, lineHeight: 1.5, margin: 0 }}>{step}</p>
                </div>
              ))}
            </div>
          )}

          {/* Guided practice card */}
          {practicePrompt && (
            <div style={{ background: B.blueLight, border: `1px solid rgba(61,114,248,0.15)`, borderRadius: 20, padding: 20 }}>
              <p style={{ fontSize: 12, fontWeight: 700, fontFamily: NUNITO, color: B.blue, marginBottom: 10 }}>
                Tại sao cần cho bài toán này
              </p>
              <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", fontSize: 14, fontFamily: INTER, color: B.textMid }}>
                <span>{practicePrompt}</span>
                {pitchMode && !lesson?.practice_prompt && (
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

          {/* CTA */}
          <button
            onClick={onComplete}
            style={{
              borderRadius: 999, padding: "16px 0", fontWeight: 700, fontSize: 16,
              backgroundColor: B.blue, color: B.white, fontFamily: NUNITO,
              border: "none", cursor: "pointer",
              display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
              boxShadow: "0 4px 16px rgba(61,114,248,0.25)",
            }}
          >
            Kiểm tra hiểu bài <ArrowRight size={18} />
          </button>
        </div>

        {/* Right: evidence panel */}
        <div style={{ display: "grid", gap: 20 }}>
          {/* Fraction bar visual — only for fraction lessons or pitch mode */}
          {isFractionLesson && (
            <div style={{ background: B.white, border: `1px solid ${B.grayBorder}`, borderRadius: 24, padding: 24, display: "grid", gap: 14 }}>
              <p style={{ fontSize: 12, fontWeight: 600, fontFamily: NUNITO, color: B.textMuted, margin: 0 }}>
                Tất cả đều biểu diễn cùng một giá trị:
              </p>
              <FractionBar n={1} d={2} color={B.blue} label="1/2" />
              <FractionBar n={2} d={4} color={B.blue} label="2/4" />
              <FractionBar n={3} d={6} color={B.blue} label="3/6" />
              <div style={{ paddingTop: 12, borderTop: `1px solid ${B.grayBorder}`, display: "flex", alignItems: "flex-start", gap: 10 }}>
                <Check size={15} style={{ color: B.green, flexShrink: 0, marginTop: 2 }} />
                <p style={{ fontSize: 13, lineHeight: 1.5, color: B.textMid, fontFamily: INTER, margin: 0 }}>
                  Nhân (hoặc chia) cả tử số và mẫu số cho cùng một số → phân số vẫn đẳng trị.
                </p>
              </div>
            </div>
          )}

          {/* Why this skill card — only when recommendation exists */}
          {rec && (
            <div style={{ background: "#f8fbff", border: `1px solid ${B.grayBorder}`, borderRadius: 24, padding: 20, display: "grid", gap: 12 }}>
              <h3 style={{ display: "flex", alignItems: "center", gap: 8, fontFamily: NUNITO, color: B.text, fontSize: 15, margin: 0 }}>
                <Target size={16} style={{ color: B.blue }} /> Tại sao kỹ năng này
              </h3>
              <p style={{ fontSize: 13, color: B.textMuted, fontFamily: INTER, lineHeight: 1.5, margin: 0 }}>
                Kỹ năng được chọn vì nó là bước nhỏ nhất có thể mở khóa nhiều kỹ năng liên kết nhất trong bản đồ tri thức của bạn.
              </p>
              <div style={{ background: B.white, border: `1px solid ${B.grayBorder}`, borderRadius: 16, padding: 14 }}>
                <span style={{ fontSize: 11, fontWeight: 900, color: B.blue, fontFamily: MONO }}>{rec.code}</span>
                <p style={{ fontWeight: 700, color: B.text, fontFamily: NUNITO, fontSize: 14, margin: "4px 0 0" }}>{rec.name}</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </motion.div>
  );
}
