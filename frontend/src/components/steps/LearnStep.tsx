"use client";
// ─── LearnStep ────────────────────────────────────────────────────────────────
// Single-column centered layout matching reference layout:
//   Category Badges → Title & Concept → Visual Card (worked example or fraction bars) → Practice Card → CTA Button
// Styled with Tailwind classes exactly matching reference proportions

import { motion } from "framer-motion";
import { ArrowRight, Check, Target, Zap } from "lucide-react";
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
      
      <div className="flex flex-col items-center justify-center px-4 py-12" style={{ minHeight: "calc(100vh - 78px)" }}>
        <div className="w-full max-w-xl space-y-6">
          
          {/* Subtitle / Category Badges */}
          <div className="flex items-center gap-3 flex-wrap">
            <span
              className="text-xs font-bold px-3 py-1.5 rounded-full"
              style={{ fontFamily: NUNITO, backgroundColor: B.orangeLight, color: B.orange }}
            >
              {subtitle}
            </span>
            <span className="text-xs" style={{ color: B.textMuted, fontFamily: INTER }}>
              Mở khóa 6 kỹ năng liên kết
            </span>
          </div>

          {/* Title & Concept */}
          <div>
            <div className="flex items-center gap-2 mb-2">
              <StepCircle n={1} done />
              <h2 className="text-2xl font-extrabold" style={{ fontFamily: NUNITO, color: B.text }}>
                {title}
              </h2>
            </div>
            {concept && (
              <p className="pl-9 text-base leading-relaxed" style={{ color: B.textMid, fontFamily: INTER }}>
                {concept}
              </p>
            )}
          </div>

          {/* Main Visual or Worked Example Card */}
          <div
            className="rounded-2xl p-6 space-y-4 border shadow-sm"
            style={{ backgroundColor: B.white, borderColor: B.grayBorder }}
          >
            {workedExample.length > 0 ? (
              <>
                <p className="text-xs font-semibold" style={{ fontFamily: NUNITO, color: B.textMuted }}>
                  Ví dụ minh họa:
                </p>
                <div className="space-y-3">
                  {workedExample.map((step, i) => (
                    <div key={i} className="flex items-start gap-2.5">
                      <div
                        className="w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold shrink-0"
                        style={{ backgroundColor: B.blueLight, color: B.blue, fontFamily: NUNITO }}
                      >
                        {i + 1}
                      </div>
                      <p className="text-sm leading-relaxed" style={{ color: B.textMid, fontFamily: INTER }}>
                        {step}
                      </p>
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <>
                <p className="text-xs font-semibold" style={{ fontFamily: NUNITO, color: B.textMuted }}>
                  Tất cả đều biểu diễn cùng một giá trị:
                </p>
                <div className="space-y-3">
                  <FractionBar n={1} d={2} color={B.blue} label="1/2" />
                  <FractionBar n={2} d={4} color={B.blue} label="2/4" />
                  <FractionBar n={3} d={6} color={B.blue} label="3/6" />
                </div>
                <div className="pt-3 border-t flex items-start gap-2.5" style={{ borderColor: B.grayBorder }}>
                  <Check size={15} className="shrink-0 mt-0.5" style={{ color: B.green }} />
                  <p className="text-sm leading-relaxed" style={{ color: B.textMid, fontFamily: INTER }}>
                    Nhân (hoặc chia) cả tử số và mẫu số cho cùng một số → phân số vẫn đẳng trị.
                  </p>
                </div>
              </>
            )}
          </div>

          {/* Practice card */}
          {practicePrompt && (
            <div
              className="rounded-2xl p-5 border shadow-sm"
              style={{ backgroundColor: B.blueLight, borderColor: "rgba(61,114,248,0.15)" }}
            >
              <p className="text-xs font-bold mb-3" style={{ fontFamily: NUNITO, color: B.blue }}>
                Tại sao cần cho bài toán {pitchMode ? "3/4 + 1/2" : (rec?.code ?? "kỹ năng mục tiêu")}
              </p>
              <div className="flex items-center gap-3 flex-wrap text-sm" style={{ fontFamily: INTER, color: B.textMid }}>
                <span>{practicePrompt}</span>
                {isFractionLesson && (
                  <div className="flex items-center gap-2">
                    <Frac n={1} d={2} className="text-base" />
                    <span style={{ color: B.textLight }}>=</span>
                    <Frac n={2} d={4} className="text-base" />
                    <span className="text-xs ml-1" style={{ fontFamily: MONO, color: B.textMuted }}>(×2)</span>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Action Button */}
          <button
            onClick={onComplete}
            className="w-full rounded-full py-4 font-bold transition-all hover:opacity-90 active:scale-[0.98] flex items-center justify-center gap-2 shadow-sm"
            style={{ backgroundColor: B.blue, color: B.white, fontFamily: NUNITO, fontSize: "1rem" }}
          >
            Kiểm tra hiểu bài <ArrowRight size={18} />
          </button>

        </div>
      </div>
    </motion.div>
  );
}
