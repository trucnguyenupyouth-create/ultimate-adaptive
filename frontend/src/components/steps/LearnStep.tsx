"use client";
// ─── LearnStep ────────────────────────────────────────────────────────────────
// Micro lesson: concept + visual + connection to student's question

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

export function LearnStep({ result, pitchMode, onComplete }: LearnStepProps) {
  const lesson = result.learning_loop?.lesson;
  const rec = result.learning_loop?.recommendation;

  // Fallback to pitch content if no lesson data
  const title = lesson?.title ?? "Tính đẳng trị của phân số";
  const subtitle = lesson?.subtitle ?? "Cụm Phân số · Gốc rễ";
  const concept = lesson?.concept ?? "Hai phân số đẳng trị khi chúng biểu diễn cùng một giá trị — chỉ được viết khác đi.";
  const practicePrompt = lesson?.practice_prompt ?? "Để tính 3/4 + 1/2, cần quy đồng mẫu số trước: 1/2 = 2/4 (nhân với 2)";
  const unlockCount = 6; // Could be derived from graph edges

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -16 }}
      transition={{ duration: 0.45 }}
    >
      <PitchBar active={pitchMode} duration={6000} onComplete={onComplete} />
      <div
        className="flex flex-col items-center justify-center px-4 py-12"
        style={{ minHeight: "calc(100vh - 78px)" }}
      >
        <div className="w-full max-w-xl space-y-6">
          {/* Context badge */}
          <div className="flex items-center gap-3 flex-wrap">
            <span
              className="text-xs font-bold px-3 py-1.5 rounded-full"
              style={{ fontFamily: NUNITO, backgroundColor: B.orangeLight, color: B.orange }}
            >
              {subtitle}
            </span>
            <span className="text-xs" style={{ color: B.textMuted, fontFamily: INTER }}>
              Mở khóa {unlockCount} kỹ năng liên kết
            </span>
          </div>

          {/* Title */}
          <div>
            <div className="flex items-center gap-2 mb-2">
              <StepCircle n={1} done />
              <h2 className="text-2xl font-extrabold" style={{ fontFamily: NUNITO, color: B.text }}>
                {title}
              </h2>
            </div>
            <p className="pl-9 text-base leading-relaxed" style={{ color: B.textMid, fontFamily: INTER }}>
              {concept}
            </p>
          </div>

          {/* Visual demonstration card */}
          <div className="rounded-2xl p-6 space-y-4 border shadow-sm"
            style={{ backgroundColor: B.white, borderColor: B.grayBorder }}>
            <p className="text-xs font-semibold" style={{ fontFamily: NUNITO, color: B.textMuted }}>
              Tất cả đều biểu diễn cùng một giá trị:
            </p>
            {lesson?.worked_example && lesson.worked_example.length > 0 ? (
              <div className="space-y-2">
                {lesson.worked_example.map((step, i) => (
                  <div key={i} className="flex items-start gap-2.5">
                    <span className="text-xs font-bold mt-0.5 shrink-0" style={{ fontFamily: MONO, color: B.blue }}>
                      {i + 1}.
                    </span>
                    <p className="text-sm leading-relaxed" style={{ color: B.textMid, fontFamily: INTER }}>{step}</p>
                  </div>
                ))}
              </div>
            ) : (
              // Default visual for fraction equivalence
              <div className="space-y-3">
                <FractionBar n={1} d={2} color={B.blue} label="1/2" />
                <FractionBar n={2} d={4} color={B.blue} label="2/4" />
                <FractionBar n={3} d={6} color={B.blue} label="3/6" />
              </div>
            )}
            <div className="pt-3 border-t flex items-start gap-2.5" style={{ borderColor: B.grayBorder }}>
              <Check size={15} className="shrink-0 mt-0.5" style={{ color: B.green }} />
              <p className="text-sm leading-relaxed" style={{ color: B.textMid, fontFamily: INTER }}>
                Nhân (hoặc chia) cả tử số và mẫu số cho cùng một số → phân số vẫn đẳng trị.
              </p>
            </div>
          </div>

          {/* Connection card: why this matters */}
          <div className="rounded-2xl p-5 border shadow-sm"
            style={{ backgroundColor: B.blueLight, borderColor: "rgba(61,114,248,0.15)" }}>
            <p className="text-xs font-bold mb-3" style={{ fontFamily: NUNITO, color: B.blue }}>
              Tại sao cần cho bài toán này
            </p>
            <div className="flex items-center gap-3 flex-wrap text-sm"
              style={{ fontFamily: INTER, color: B.textMid }}>
              <span>{practicePrompt}</span>
              {!lesson?.practice_prompt && (
                <div className="flex items-center gap-2">
                  <Frac n={1} d={2} className="text-base" />
                  <span style={{ color: B.textLight }}>=</span>
                  <Frac n={2} d={4} className="text-base" />
                  <span className="text-xs ml-1" style={{ fontFamily: MONO, color: B.textMuted }}>(×2)</span>
                </div>
              )}
            </div>
          </div>

          {/* CTA */}
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
