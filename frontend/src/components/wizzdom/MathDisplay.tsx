"use client";
// ─── Math Display Components (read-only) ─────────────────────────────────────
// Frac: inline fraction rendering
// FractionBar: visual bar diagram
// StepCircle: numbered/checked step indicator
// WizzdomLogo, StepBar, PitchBar — app shell pieces

import { Check, ArrowRight } from "lucide-react";
import { motion } from "framer-motion";
import { useEffect, useState } from "react";
import { B, NUNITO, INTER, MONO } from "@/components/wizzdom/design-tokens";

// ─── Frac (inline fraction display) ─────────────────────────────────────────
export function Frac({
  n,
  d,
  className = "",
}: {
  n: number;
  d: number;
  className?: string;
}) {
  return (
    <span
      className={`inline-flex flex-col items-center font-bold leading-none ${className}`}
      style={{ fontFamily: NUNITO, verticalAlign: "middle" }}
    >
      <span>{n}</span>
      <span className="block w-full border-t-[2.5px] border-current my-[3px]" />
      <span>{d}</span>
    </span>
  );
}

// ─── FractionBar (visual equivalence diagram) ────────────────────────────────
export function FractionBar({
  n,
  d,
  color,
  label,
}: {
  n: number;
  d: number;
  color: string;
  label: string;
}) {
  return (
    <div className="flex items-center gap-3">
      <span
        className="text-xs shrink-0 text-right w-8"
        style={{ fontFamily: MONO, color: B.textMuted }}
      >
        {label}
      </span>
      <div className="flex gap-[3px] flex-1 h-7">
        {Array.from({ length: d }, (_, i) => (
          <div
            key={i}
            className="flex-1 rounded-sm"
            style={{
              backgroundColor: i < n ? color : "transparent",
              border: `1.5px solid ${color}`,
              opacity: i < n ? 0.85 : 0.2,
            }}
          />
        ))}
      </div>
    </div>
  );
}

// ─── StepCircle ──────────────────────────────────────────────────────────────
export function StepCircle({ n, done }: { n: number; done?: boolean }) {
  return (
    <div
      className="w-7 h-7 rounded-full flex items-center justify-center text-sm font-bold shrink-0"
      style={{
        backgroundColor: done ? B.greenLight : B.orangeLight,
        color: done ? B.green : B.orange,
        fontFamily: NUNITO,
      }}
    >
      {done ? <Check size={14} /> : n}
    </div>
  );
}

// ─── WizzdomLogo ─────────────────────────────────────────────────────────────
export function WizzdomLogo({ size = "md" }: { size?: "sm" | "md" | "lg" }) {
  const sz =
    size === "lg" ? "text-3xl" : size === "sm" ? "text-base" : "text-xl";
  const star =
    size === "lg" ? "text-2xl" : size === "sm" ? "text-base" : "text-lg";
  return (
    <div className="flex items-center" style={{ fontFamily: NUNITO }}>
      <span className={`font-extrabold ${sz}`} style={{ color: B.blue }}>
        Wizz
      </span>
      <span className={star} style={{ lineHeight: 1 }}>
        ⭐
      </span>
      <span className={`font-extrabold ${sz}`} style={{ color: B.blue }}>
        m
      </span>
    </div>
  );
}

// ─── StepBar ─────────────────────────────────────────────────────────────────
const STEP_LABELS = ["Assess", "Map", "Learn", "Mastery", "Outcome"];

export function StepBar({ current }: { current: number }) {
  return (
    <div className="flex items-center justify-center">
      {STEP_LABELS.map((label, i) => (
        <div key={i} className="flex items-center">
          <div className="flex flex-col items-center gap-1.5">
            <div
              className="rounded-full transition-all duration-500"
              style={{
                width: i === current ? 10 : 8,
                height: i === current ? 10 : 8,
                backgroundColor:
                  i <= current ? B.blue : "#D1D5DB",
                boxShadow:
                  i === current ? `0 0 0 3px ${B.blueLight}` : "none",
              }}
            />
            <span
              className="text-[10px] hidden sm:block transition-colors duration-300"
              style={{
                fontFamily: MONO,
                color:
                  i === current
                    ? B.blue
                    : i < current
                    ? B.blueMid
                    : "#9CA3AF",
                fontWeight: i === current ? 600 : 400,
              }}
            >
              {label}
            </span>
          </div>
          {i < STEP_LABELS.length - 1 && (
            <div
              className="w-10 sm:w-14 h-px mx-2 mb-4 transition-colors duration-500"
              style={{
                backgroundColor: i < current ? B.blue : "#E5E7EB",
              }}
            />
          )}
        </div>
      ))}
    </div>
  );
}

// ─── PitchBar (auto-advance progress indicator) ───────────────────────────────
export function PitchBar({
  active,
  duration,
  onComplete,
}: {
  active: boolean;
  duration: number;
  onComplete: () => void;
}) {
  const [started, setStarted] = useState(false);

  useEffect(() => {
    if (!active) return;
    setStarted(false);
    const t1 = setTimeout(() => setStarted(true), 50);
    const t2 = setTimeout(onComplete, duration);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
    };
  }, [active, duration, onComplete]);

  if (!active) return null;

  return (
    <div style={{ height: 3, backgroundColor: "#E5E7EB", overflow: "hidden" }}>
      <motion.div
        style={{ height: "100%", backgroundColor: B.blue }}
        initial={{ width: "0%" }}
        animate={started ? { width: "100%" } : {}}
        transition={{ duration: duration / 1000 - 0.05, ease: "linear" }}
      />
    </div>
  );
}

// ─── PrimaryButton ────────────────────────────────────────────────────────────
export function PrimaryButton({
  onClick,
  disabled,
  children,
  className = "",
}: {
  onClick?: () => void;
  disabled?: boolean;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`w-full rounded-full py-4 font-bold text-base transition-all hover:opacity-90 active:scale-[0.98] disabled:opacity-25 disabled:cursor-not-allowed flex items-center justify-center gap-2 shadow-sm ${className}`}
      style={{
        backgroundColor: B.blue,
        color: B.white,
        fontFamily: NUNITO,
      }}
    >
      {children}
      <ArrowRight size={18} />
    </button>
  );
}
