"use client";
// ─── OutcomeStep ──────────────────────────────────────────────────────────────
// Updated knowledge map with animated green flashes on upgraded skills
// Shows change list: skill → old state → new state

import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { ArrowRight, RotateCcw, Zap } from "lucide-react";
import { B, NUNITO, INTER, MONO } from "@/components/wizzdom/design-tokens";
import { KnowledgeMap } from "@/components/wizzdom/KnowledgeMap";
import { adaptSummaryToSkills, findTargetNodeId, findOutcomeNodeIds } from "@/lib/map-adapter";
import type { AssessmentV2Result } from "@/lib/assessment-v2-api";

interface OutcomeStepProps {
  preResult: AssessmentV2Result;   // Before mastery
  postResult: AssessmentV2Result;  // After mastery (map has changed)
  onRestart: () => void;
  onNext: () => void;
}

export function OutcomeStep({ preResult, postResult, onRestart, onNext }: OutcomeStepProps) {
  const [show, setShow] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setShow(true), 300);
    return () => clearTimeout(t);
  }, []);

  const preSkills  = adaptSummaryToSkills(preResult.summary);
  const postSkills = adaptSummaryToSkills(postResult.summary);
  const outcomeNodeIds = findOutcomeNodeIds(preSkills, postSkills);
  const targetNodeId   = findTargetNodeId(postResult.learning_loop?.recommendation?.kc_id);

  // Build change list
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
      changes.push({
        label: post.label,
        from: stateLabel[pre.strength],
        to: stateLabel[post.strength],
      });
    }
  });

  // Pitch fallback only when real diff is empty AND mastery passed
  const pitchFallback = [
    { label: "Tính đẳng trị", from: "Khoảng trống", to: "Đang phát triển" },
    { label: "Rút gọn",       from: "Khoảng trống", to: "Có thể tiếp cận" },
    { label: "Cộng/trừ p.s.", from: "Khoảng trống", to: "Có thể tiếp cận" },
  ];
  const displayChanges = changes.length > 0 ? changes : pitchFallback;

  const upgradedCount = outcomeNodeIds.size || displayChanges.length;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.5 }}
      className="grid grid-cols-1 lg:grid-cols-[1fr_360px]"
      style={{ minHeight: "calc(100vh - 72px)" }}
    >
      {/* Left: Updated map */}
      <div className="p-4 sm:p-8 flex items-center justify-center">
        <div className="w-full max-w-[580px] aspect-square">
          <KnowledgeMap
            skills={postSkills}
            targetNodeId={targetNodeId}
            outcomeNodeIds={outcomeNodeIds}
            showTarget
            outcome
          />
        </div>
      </div>

      {/* Right: Panel */}
      <motion.div
        initial={{ opacity: 0, x: 24 }}
        animate={show ? { opacity: 1, x: 0 } : {}}
        transition={{ duration: 0.55 }}
        className="border-t lg:border-t-0 lg:border-l flex flex-col justify-center gap-6 p-7 lg:p-8"
        style={{ borderColor: B.grayBorder, backgroundColor: B.white }}
      >
        <div>
          <p className="text-xs font-semibold mb-1" style={{ fontFamily: MONO, color: B.textMuted }}>
            Buổi học hoàn tất
          </p>
          <h2 className="text-2xl font-extrabold" style={{ fontFamily: NUNITO, color: B.text }}>
            Bản đồ của bạn đã cập nhật
          </h2>
        </div>

        {/* Change list */}
        <div className="space-y-0">
          {displayChanges.map((c, i) => (
            <div key={i}
              className="flex items-center justify-between py-3.5 border-b last:border-0"
              style={{ borderColor: B.grayBorder }}>
              <span className="text-sm font-semibold" style={{ fontFamily: NUNITO, color: B.text }}>
                {c.label}
              </span>
              <div className="flex items-center gap-1.5 text-xs font-medium" style={{ fontFamily: MONO }}>
                <span style={{ color: B.orange }}>{c.from}</span>
                <span style={{ color: B.textLight }}>→</span>
                <span style={{ color: B.green }}>{c.to}</span>
              </div>
            </div>
          ))}
        </div>

        {/* Upgrade summary card */}
        <div className="rounded-2xl p-4 border" style={{ backgroundColor: B.blueLight, borderColor: "rgba(61,114,248,0.2)" }}>
          <div className="flex items-center gap-2 mb-2">
            <Zap size={14} style={{ color: B.blue }} />
            <span className="text-xs font-bold" style={{ fontFamily: NUNITO, color: B.blue }}>
              {upgradedCount} kỹ năng được nâng cấp
            </span>
          </div>
          <p className="text-sm leading-relaxed" style={{ color: B.textMid, fontFamily: INTER }}>
            Các kỹ năng liên kết đang dần gần tầm với. Wizzdom đã cập nhật bản đồ cá nhân của bạn.
          </p>
        </div>

        {/* Actions */}
        <div className="flex gap-3">
          <button
            onClick={onRestart}
            className="flex-1 rounded-full py-3.5 border-2 font-bold text-sm transition-all hover:opacity-80 flex items-center justify-center gap-2"
            style={{ borderColor: B.grayBorder, color: B.textMuted, fontFamily: NUNITO }}
          >
            <RotateCcw size={14} /> Xem lại demo
          </button>
          <button
            onClick={onNext}
            className="flex-1 rounded-full py-3.5 font-bold text-sm transition-all hover:opacity-90 flex items-center justify-center gap-2 shadow-sm"
            style={{ backgroundColor: B.blue, color: B.white, fontFamily: NUNITO }}
          >
            Kỹ năng tiếp theo <ArrowRight size={14} />
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}
