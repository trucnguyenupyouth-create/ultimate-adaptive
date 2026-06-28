// ─── Wizzdom Design Tokens ────────────────────────────────────────────────────
// Adopted from Wizzdom Product Design Requirements (2)
// Light mode only — white surfaces, #F5F7FF page bg

export const B = {
  blue: "#3D72F8",
  blueDark: "#2A5BE4",
  blueLight: "#EEF2FF",
  blueMid: "#7FA0FB",
  orange: "#F59E0B",
  orangeLight: "#FFF8EC",
  green: "#10B981",
  greenLight: "#ECFDF5",
  red: "#EF4444",
  redLight: "#FEF2F2",
  gray: "#F3F4F6",
  grayBorder: "rgba(0,0,0,0.08)",
  text: "#111827",
  textMid: "#374151",
  textMuted: "#6B7280",
  textLight: "#9CA3AF",
  white: "#FFFFFF",
  bg: "#F5F7FF",
} as const;

export const NUNITO = "'Nunito', sans-serif";
export const INTER = "'Inter', sans-serif";
export const MONO = "'JetBrains Mono', monospace";

export type SkillStrength = "strong" | "medium" | "weak" | "inferred";
