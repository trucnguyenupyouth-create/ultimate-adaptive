"use client";
// ─── Assessment V2 — Algebra Page ─────────────────────────────────────────────
// Production learning loop: Assess → Map → Learn → Mastery → Outcome
// Dual mode: real API (Live) + pitch demo (auto-advance)

import { useState, useCallback } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Pause, Play, RotateCcw } from "lucide-react";
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
    // Reset to assess for next skill — keeping session context
    setPhase("assess");
    setResult(null);
    setPostResult(null);
  }, []);

  const togglePitch = () => {
    const next = !pitchMode;
    setPitchMode(next);
    if (next) {
      // Reset to beginning when enabling pitch mode
      setPhase("assess");
      setResult(null);
      setPostResult(null);
    }
  };

  const currentStep = PHASE_TO_STEP[phase];

  return (
    <div className="min-h-screen" style={{ backgroundColor: B.bg, fontFamily: INTER }}>
      {/* ─── Header ───────────────────────────────────────────────────────── */}
      <header
        className="h-[72px] border-b flex items-center px-5 sm:px-8 gap-4 sticky top-0 z-40"
        style={{ backgroundColor: B.white, borderColor: B.grayBorder }}
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

      {/* ─── Step content ─────────────────────────────────────────────────── */}
      <AnimatePresence mode="wait">
        {phase === "assess" && (
          <motion.div key="assess">
            <AssessStep
              pitchMode={pitchMode}
              onComplete={handleAssessComplete}
            />
          </motion.div>
        )}

        {phase === "map" && result && (
          <motion.div key="map">
            <MapStep
              result={result}
              pitchMode={pitchMode}
              onComplete={handleMapComplete}
            />
          </motion.div>
        )}

        {phase === "lesson" && result && (
          <motion.div key="lesson">
            <LearnStep
              result={result}
              pitchMode={pitchMode}
              onComplete={handleLearnComplete}
            />
          </motion.div>
        )}

        {phase === "mastery" && result && (
          <motion.div key="mastery">
            <MasteryStep
              result={result}
              pitchMode={pitchMode}
              onComplete={handleMasteryComplete}
            />
          </motion.div>
        )}

        {phase === "outcome" && result && postResult && (
          <motion.div key="outcome">
            <OutcomeStep
              preResult={result}
              postResult={postResult}
              onRestart={handleRestart}
              onNext={handleNext}
            />
          </motion.div>
        )}

        {/* Fallback: if outcome but postResult missing */}
        {phase === "outcome" && result && !postResult && (
          <motion.div
            key="outcome-fallback"
            className="flex items-center justify-center"
            style={{ minHeight: "calc(100vh - 72px)" }}
          >
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
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
