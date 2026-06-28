"use client";
// ─── MapStep ──────────────────────────────────────────────────────────────────
// Knowledge map reveal — the WOW screen
// Animated counter 0→N, breakdown reveal, focus callout, CTA

import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { ArrowRight, Zap } from "lucide-react";
import { B, NUNITO, INTER, MONO } from "@/components/wizzdom/design-tokens";
import { KnowledgeMap } from "@/components/wizzdom/KnowledgeMap";
import { PitchBar } from "@/components/wizzdom/MathDisplay";
import { adaptSummaryToSkills, findTargetNodeId } from "@/lib/map-adapter";
import type { AssessmentV2Result } from "@/lib/assessment-v2-api";

interface MapStepProps {
  result: AssessmentV2Result;
  pitchMode: boolean;
  onComplete: () => void;
}

export function MapStep({ result, pitchMode, onComplete }: MapStepProps) {
  const [skillCount, setSkillCount] = useState(0);
  const [panelIn, setPanelIn] = useState(false);

  const vm = result.summary.value_metrics;
  const totalSkills = vm.skills_directly_tested + vm.skills_inferred;
  const adaptedSkills = adaptSummaryToSkills(result.summary);
  const targetNodeId = findTargetNodeId(result.learning_loop?.recommendation?.kc_id);
  const recommendationName = result.learning_loop?.recommendation?.name ?? "Kỹ năng trọng tâm";

  // Build breakdown from summary
  const breakdown = [
    { color: B.blue,    label: "Thành thạo",           value: String(result.summary.strong_areas.length) },
    { color: B.blueMid, label: "Đang phát triển",      value: String(result.summary.possibly_affected.length) },
    { color: B.orange,  label: "Khoảng trống",         value: String(result.summary.skills_to_review.length), accent: true },
    { color: "#94A3B8", label: "Suy luận từ dữ liệu",  value: "—", dim: true },
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
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.5 }}
    >
      <PitchBar active={pitchMode} duration={6500} onComplete={onComplete} />

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_360px]"
        style={{ minHeight: "calc(100vh - 78px)" }}>

        {/* Left: Map */}
        <div className="p-4 sm:p-8 flex items-center justify-center">
          <div className="w-full max-w-[580px] aspect-square">
            <KnowledgeMap
              skills={adaptedSkills}
              targetNodeId={targetNodeId}
              animateIn
              showTarget
            />
          </div>
        </div>

        {/* Right: Panel */}
        <motion.div
          initial={{ opacity: 0, x: 24 }}
          animate={panelIn ? { opacity: 1, x: 0 } : {}}
          transition={{ duration: 0.55, ease: "easeOut" }}
          className="border-t lg:border-t-0 lg:border-l flex flex-col justify-center gap-6 p-7 lg:p-8"
          style={{ borderColor: B.grayBorder, backgroundColor: B.white }}
        >
          {/* Big counter */}
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="text-xs font-medium" style={{ fontFamily: MONO, color: B.textMuted }}>
                {vm.questions_asked} câu hỏi
              </span>
              <span style={{ color: "#D1D5DB" }}>→</span>
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-6xl font-extrabold tabular-nums"
                style={{ fontFamily: NUNITO, color: B.text }}>
                {skillCount}
              </span>
              <span className="text-lg font-semibold"
                style={{ fontFamily: NUNITO, color: B.textMuted }}>
                kỹ năng được vẽ
              </span>
            </div>
          </div>

          {/* Breakdown (appears at 60% progress) */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={skillCount >= Math.floor(totalSkills * 0.6) ? { opacity: 1 } : {}}
            transition={{ duration: 0.5 }}
            className="space-y-3"
          >
            {breakdown.map((row) => (
              <div
                key={row.label}
                className={`flex justify-between items-center text-sm ${row.dim ? "pt-2 border-t" : ""}`}
                style={row.dim ? { borderColor: B.grayBorder } : undefined}
              >
                <div className="flex items-center gap-2.5">
                  <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: row.color }} />
                  <span style={{ fontFamily: INTER, color: B.textMid }}>{row.label}</span>
                </div>
                <span className="font-semibold"
                  style={{ fontFamily: MONO, color: row.accent ? B.orange : row.dim ? B.textLight : B.text }}>
                  {row.value}
                </span>
              </div>
            ))}
          </motion.div>

          {/* Focus callout (appears at 100%) */}
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={skillCount >= totalSkills ? { opacity: 1, y: 0 } : {}}
            transition={{ duration: 0.5 }}
            className="rounded-2xl p-4 space-y-2"
            style={{ backgroundColor: B.orangeLight, border: `1.5px solid rgba(245,158,11,0.25)` }}
          >
            <div className="flex items-center gap-2">
              <Zap size={14} style={{ color: B.orange }} />
              <span className="text-xs font-bold" style={{ fontFamily: NUNITO, color: B.orange }}>
                Điểm tập trung được xác định
              </span>
            </div>
            <p className="font-bold" style={{ fontFamily: NUNITO, color: B.text }}>
              {recommendationName}
            </p>
            <p className="text-xs leading-relaxed" style={{ color: B.textMid, fontFamily: INTER }}>
              {result.learning_loop?.recommendation
                ? "Giải quyết nó sẽ mở khóa các kỹ năng liên kết"
                : "Kỹ năng nền tảng cần được củng cố"}
            </p>
          </motion.div>

          {/* CTA */}
          <motion.button
            initial={{ opacity: 0 }}
            animate={skillCount >= totalSkills ? { opacity: 1 } : {}}
            transition={{ duration: 0.4, delay: 0.3 }}
            onClick={onComplete}
            className="w-full rounded-full py-4 font-bold transition-all hover:opacity-90 active:scale-[0.98] flex items-center justify-center gap-2 shadow-sm"
            style={{ backgroundColor: B.blue, color: B.white, fontFamily: NUNITO, fontSize: "1rem" }}
          >
            Bắt đầu bài học mục tiêu <ArrowRight size={18} />
          </motion.button>
        </motion.div>
      </div>
    </motion.div>
  );
}
