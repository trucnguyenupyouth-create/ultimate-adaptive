"use client";
// ─── Assessment V2 — Algebra Page ─────────────────────────────────────────────
// Production learning loop: Assess → Map → Learn → Mastery → Outcome
// Dual mode: real API (Live) + pitch demo (auto-advance)

import { useState, useCallback } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Pause, Play, RotateCcw, Brain, Target, Zap, BookOpen } from "lucide-react";
import { B, NUNITO, INTER, MONO } from "@/components/wizzdom/design-tokens";
import { WizzdomLogo, StepBar } from "@/components/wizzdom/MathDisplay";
import { AssessStep } from "@/components/steps/AssessStep";
import { MapStep }    from "@/components/steps/MapStep";
import { LearnStep }  from "@/components/steps/LearnStep";
import { MasteryStep } from "@/components/steps/MasteryStep";
import { OutcomeStep } from "@/components/steps/OutcomeStep";
import type { AssessmentV2Result } from "@/lib/assessment-v2-api";

type Phase = "assess" | "map" | "lesson" | "mastery" | "outcome";

const PHASE_TO_STEP: Record<Phase, number> = {
  assess: 0,
  map: 1,
  lesson: 2,
  mastery: 3,
  outcome: 4,
};

// ─── Sidebar content per phase ───────────────────────────────────────────────
function SidePanel({
  phase,
  result,
  pitchMode,
  sessionId,
}: {
  phase: Phase;
  result: AssessmentV2Result | null;
  pitchMode: boolean;
  sessionId: string | null;
}) {
  const stats = [
    { icon: <Brain size={16} />, label: "Kỹ năng được vẽ", value: result ? String((result.summary?.value_metrics?.skills_directly_tested ?? 0) + (result.summary?.value_metrics?.skills_inferred ?? 0)) : "—" },
    { icon: <Target size={16} />, label: "Khoảng trống", value: result ? String(result.summary?.skills_to_review?.length ?? 0) : "—" },
    { icon: <Zap size={16} />, label: "Câu hỏi", value: result ? String(result.summary?.value_metrics?.questions_asked ?? 0) : "12" },
  ];

  return (
    <div
      className="h-full flex flex-col gap-6 p-8"
      style={{ backgroundColor: B.white, borderRight: `1px solid ${B.grayBorder}` }}
    >
      {/* Brand */}
      <div>
        <WizzdomLogo size="lg" />
        <p className="mt-2 text-sm leading-relaxed" style={{ color: B.textMuted, fontFamily: INTER }}>
          Hệ thống học thích ứng cá nhân hoá — xây dựng bản đồ tri thức của bạn.
        </p>
      </div>

      {/* Tagline pill */}
      <div
        className="inline-flex w-fit items-center gap-2 px-4 py-2.5 rounded-full text-sm font-bold"
        style={{ backgroundColor: "#FFF8DF", border: "1px solid #FFE4A3", color: "#92600A", fontFamily: NUNITO }}
      >
        <Zap size={13} />
        Cam kết kết quả trước khi thanh toán
      </div>

      {/* Phase-specific copy */}
      <div className="space-y-2">
        {phase === "assess" && (
          <>
            <h2 className="text-2xl font-extrabold leading-tight" style={{ fontFamily: NUNITO, color: B.text }}>
              Chẩn đoán khoảng trống của bạn
            </h2>
            <p className="text-sm leading-relaxed" style={{ color: B.textMuted, fontFamily: INTER }}>
              Hệ thống thích ứng sẽ phân tích câu trả lời theo thời gian thực và điều chỉnh câu hỏi tiếp theo — không theo thứ tự cố định.
            </p>
          </>
        )}
        {phase === "map" && (
          <>
            <h2 className="text-2xl font-extrabold leading-tight" style={{ fontFamily: NUNITO, color: B.text }}>
              Bản đồ tri thức của bạn
            </h2>
            <p className="text-sm leading-relaxed" style={{ color: B.textMuted, fontFamily: INTER }}>
              Từ {result?.summary?.value_metrics?.questions_asked ?? 12} câu hỏi, hệ thống suy ra toàn bộ bức tranh kỹ năng toán học của bạn.
            </p>
          </>
        )}
        {phase === "lesson" && (
          <>
            <h2 className="text-2xl font-extrabold leading-tight" style={{ fontFamily: NUNITO, color: B.text }}>
              Bài học mục tiêu
            </h2>
            <p className="text-sm leading-relaxed" style={{ color: B.textMuted, fontFamily: INTER }}>
              Chúng tôi chọn chính xác kỹ năng gốc rễ sẽ mở khóa nhiều nhất các kỹ năng liên kết.
            </p>
          </>
        )}
        {phase === "mastery" && (
          <>
            <h2 className="text-2xl font-extrabold leading-tight" style={{ fontFamily: NUNITO, color: B.text }}>
              Kiểm tra thành thạo
            </h2>
            <p className="text-sm leading-relaxed" style={{ color: B.textMuted, fontFamily: INTER }}>
              Một câu hỏi để xác nhận bạn đã thực sự hiểu — không chỉ đoán.
            </p>
          </>
        )}
        {phase === "outcome" && (
          <>
            <h2 className="text-2xl font-extrabold leading-tight" style={{ fontFamily: NUNITO, color: B.text }}>
              Kết quả học tập
            </h2>
            <p className="text-sm leading-relaxed" style={{ color: B.textMuted, fontFamily: INTER }}>
              Bản đồ tri thức của bạn đã được cập nhật với kỹ năng vừa thành thạo.
            </p>
          </>
        )}
      </div>

      {/* Stats (visible after assessment) */}
      {result && (
        <div className="space-y-3">
          {stats.map((s) => (
            <div
              key={s.label}
              className="flex items-center gap-3 rounded-2xl p-4 border"
              style={{ backgroundColor: B.bg, borderColor: B.grayBorder }}
            >
              <div
                className="w-8 h-8 rounded-full flex items-center justify-center shrink-0"
                style={{ backgroundColor: B.blueLight, color: B.blue }}
              >
                {s.icon}
              </div>
              <div>
                <div className="text-xl font-extrabold" style={{ fontFamily: NUNITO, color: B.text }}>
                  {s.value}
                </div>
                <div className="text-xs" style={{ fontFamily: INTER, color: B.textMuted }}>
                  {s.label}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Session badge */}
      {!result && (
        <div className="space-y-3">
          {[
            { icon: <Brain size={14} />, text: "1,000+ đơn vị tri thức được lập bản đồ" },
            { icon: <Target size={14} />, text: "Chẩn đoán thích ứng — không cố định" },
            { icon: <BookOpen size={14} />, text: "Bài học cá nhân hoá từ khoảng trống của bạn" },
          ].map((f) => (
            <div key={f.text} className="flex items-start gap-2.5">
              <div
                className="w-6 h-6 rounded-full flex items-center justify-center shrink-0 mt-0.5"
                style={{ backgroundColor: B.blueLight, color: B.blue }}
              >
                {f.icon}
              </div>
              <p className="text-sm leading-relaxed" style={{ fontFamily: INTER, color: B.textMuted }}>
                {f.text}
              </p>
            </div>
          ))}
        </div>
      )}

      {/* Session ID */}
      <div className="mt-auto pt-4 border-t" style={{ borderColor: B.grayBorder }}>
        <p className="text-xs" style={{ fontFamily: MONO, color: B.textLight }}>
          {pitchMode ? "Chế độ Demo" : sessionId ? `Phiên #${sessionId.slice(-6).toUpperCase()}` : "Học sinh · 8A"}
        </p>
      </div>
    </div>
  );
}

export default function AlgebraAssessmentPage() {
  const [phase, setPhase] = useState<Phase>("assess");
  const [pitchMode, setPitchMode] = useState(false);
  const [result, setResult] = useState<AssessmentV2Result | null>(null);
  const [postResult, setPostResult] = useState<AssessmentV2Result | null>(null);
  const [sessionId, setSessionId] = useState<string | null>(null);

  // ─── Phase transitions ──────────────────────────────────────────────────
  const handleAssessComplete = useCallback(
    (res: AssessmentV2Result, sid: string) => {
      setResult(res);
      setSessionId(sid);
      setPhase("map");
    },
    []
  );

  const handleMapComplete = useCallback(() => setPhase("lesson"), []);
  const handleLearnComplete = useCallback(() => setPhase("mastery"), []);

  const handleMasteryComplete = useCallback(
    (updatedResult: AssessmentV2Result) => {
      setPostResult(updatedResult);
      setPhase("outcome");
    },
    []
  );

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
    if (next) {
      setPhase("assess");
      setResult(null);
      setPostResult(null);
    }
  };

  const currentStep = PHASE_TO_STEP[phase];

  // Map and Outcome use their own full-width layout
  const useFullWidth = phase === "map" || phase === "outcome";

  return (
    <div
      className="min-h-screen flex flex-col"
      style={{
        background: "radial-gradient(circle at 16% 12%, rgba(61,114,248,0.07), transparent 30%), linear-gradient(180deg, #ffffff 0%, #F5F7FF 60%, #EEF4FF 100%)",
        fontFamily: INTER,
      }}
    >
      {/* ─── Header ───────────────────────────────────────────────────────── */}
      <header
        className="h-[68px] border-b flex items-center px-5 sm:px-8 gap-4 sticky top-0 z-40 shrink-0"
        style={{ backgroundColor: "rgba(255,255,255,0.92)", backdropFilter: "blur(12px)", borderColor: B.grayBorder }}
      >
        <WizzdomLogo />

        <div className="flex-1 flex justify-center overflow-x-auto">
          <StepBar current={currentStep} />
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {/* Pitch mode toggle */}
          <button
            onClick={togglePitch}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-full text-xs font-bold transition-all hover:opacity-80"
            style={{
              backgroundColor: pitchMode ? B.blue : B.blueLight,
              color: pitchMode ? B.white : B.blue,
              fontFamily: NUNITO,
            }}
            title={pitchMode ? "Tắt chế độ demo" : "Bật chế độ demo tự động"}
          >
            {pitchMode ? <Pause size={12} /> : <Play size={12} />}
            <span className="hidden sm:inline">Demo</span>
          </button>

          {/* Reset button */}
          {(result || phase !== "assess") && (
            <button
              onClick={handleRestart}
              className="flex items-center gap-1 px-3 py-2 rounded-full text-xs font-semibold transition-all hover:opacity-80"
              style={{
                backgroundColor: B.gray,
                color: B.textMuted,
                fontFamily: NUNITO,
              }}
              title="Bắt đầu lại"
            >
              <RotateCcw size={12} />
              <span className="hidden sm:inline">Reset</span>
            </button>
          )}

          {/* Student chip */}
          <div className="hidden sm:flex items-center gap-2">
            <div
              className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold"
              style={{ backgroundColor: B.blueLight, color: B.blue, fontFamily: NUNITO }}
            >
              {sessionId ? sessionId.slice(0, 1).toUpperCase() : "M"}
            </div>
            <span className="text-xs font-medium" style={{ fontFamily: MONO, color: B.textMuted }}>
              {pitchMode ? "Pitch · Demo" : sessionId ? `#${sessionId.slice(-4)}` : "Học sinh · 8A"}
            </span>
          </div>
        </div>
      </header>

      {/* ─── Main content ─────────────────────────────────────────────────── */}
      <div className="flex-1 flex overflow-hidden" style={{ minHeight: "calc(100vh - 68px)" }}>
        <AnimatePresence mode="wait">
          {/* Full-width phases: Map + Outcome */}
          {useFullWidth && (
            <motion.div key={phase} className="flex-1 overflow-auto" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.4 }}>
              {phase === "map" && result && (
                <MapStep result={result} pitchMode={pitchMode} onComplete={handleMapComplete} />
              )}
              {phase === "outcome" && result && postResult && (
                <OutcomeStep preResult={result} postResult={postResult} onRestart={handleRestart} onNext={handleNext} />
              )}
              {phase === "outcome" && result && !postResult && (
                <div className="flex items-center justify-center" style={{ minHeight: "calc(100vh - 68px)" }}>
                  <div className="text-center space-y-4">
                    <p style={{ fontFamily: NUNITO, color: B.textMuted }}>Đang cập nhật bản đồ...</p>
                    <button
                      onClick={handleRestart}
                      className="px-6 py-3 rounded-full font-bold text-sm"
                      style={{ backgroundColor: B.blue, color: B.white, fontFamily: NUNITO }}
                    >
                      Bắt đầu lại
                    </button>
                  </div>
                </div>
              )}
            </motion.div>
          )}

          {/* Two-column layout: Assess / Learn / Mastery */}
          {!useFullWidth && (
            <motion.div
              key={phase + "-twocol"}
              className="flex-1 grid overflow-hidden"
              style={{ gridTemplateColumns: "minmax(280px, 340px) 1fr" }}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.4 }}
            >
              {/* Left: sticky sidebar */}
              <div className="overflow-y-auto sticky top-0 h-[calc(100vh-68px)]">
                <SidePanel phase={phase} result={result} pitchMode={pitchMode} sessionId={sessionId} />
              </div>

              {/* Right: step content */}
              <div className="overflow-y-auto">
                {phase === "assess" && (
                  <AssessStep pitchMode={pitchMode} onComplete={handleAssessComplete} />
                )}
                {phase === "lesson" && result && (
                  <LearnStep result={result} pitchMode={pitchMode} onComplete={handleLearnComplete} />
                )}
                {phase === "mastery" && result && (
                  <MasteryStep result={result} pitchMode={pitchMode} onComplete={handleMasteryComplete} />
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
