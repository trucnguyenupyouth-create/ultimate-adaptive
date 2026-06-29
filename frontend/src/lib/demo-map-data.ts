import type { Skill } from "@/lib/map-data";

export const DEMO_TARGET_NODE_ID = 103;
export const DEMO_OUTCOME_NODE_IDS = new Set([103, 105]);

export const DEMO_FRACTION_MAP_PRE: Skill[] = [
  {
    id: 101,
    x: 16,
    y: 38,
    label: "Valid\nfractions",
    strength: "strong",
    code: "G6-MATH-NHAN-BIET-PHAN-1",
    fullName: "Recognize fractions with integer numerator and denominator, denominator not zero",
  },
  {
    id: 102,
    x: 36,
    y: 28,
    label: "Fraction\nproperty",
    strength: "medium",
    code: "G6-MATH-TINH-CHAT-CO",
    fullName: "Use the basic property of fractions",
  },
  {
    id: 103,
    x: 56,
    y: 38,
    label: "Common\ndenominator",
    strength: "weak",
    code: "G6-MATH-QUY-DONG-MAU",
    fullName: "Find a common denominator for fractions",
  },
  {
    id: 104,
    x: 34,
    y: 62,
    label: "Add like\ndenominators",
    strength: "strong",
    code: "G6-MATH-CONG-HAI-PHAN",
    fullName: "Add fractions with like denominators",
  },
  {
    id: 105,
    x: 72,
    y: 58,
    label: "Add unlike\ndenominators",
    strength: "weak",
    code: "G6-MATH-CONG-HAI-PHAN-1",
    fullName: "Add fractions with unlike denominators by finding a common denominator",
  },
  {
    id: 106,
    x: 84,
    y: 32,
    label: "Compare unlike\nfractions",
    strength: "inferred",
    code: "G6-MATH-SO-SANH-HAI-1",
    fullName: "Compare fractions with unlike denominators by finding a common denominator",
  },
  {
    id: 107,
    x: 70,
    y: 78,
    label: "Subtract unlike\nfractions",
    strength: "inferred",
    code: "G6-MAMATMATHMAT",
    fullName: "Subtract fractions with unlike denominators",
  },
  {
    id: 108,
    x: 88,
    y: 72,
    label: "Divide\nfractions",
    strength: "inferred",
    code: "G6-MATH-CHIA-HAI-PHAN",
    fullName: "Divide fractions",
  },
  {
    id: 109,
    x: 18,
    y: 70,
    label: "Negative\nintegers",
    strength: "medium",
    code: "G6-MATH-NHAN-BIET-DOC",
    fullName: "Read and write negative integers",
  },
];

export const DEMO_PREREQUISITE_FLOW = DEMO_FRACTION_MAP_PRE.filter((skill) =>
  [101, 102, 103, 105].includes(skill.id)
);

export const DEMO_FRACTION_MAP_POST: Skill[] = DEMO_FRACTION_MAP_PRE.map((skill) => {
  if (skill.id === 103) return { ...skill, strength: "medium" };
  if (skill.id === 105) return { ...skill, strength: "medium" };
  if (skill.id === 106) return { ...skill, strength: "medium" };
  return skill;
});

export const DEMO_FRACTION_EDGES: [number, number][] = [
  [101, 102],
  [102, 103],
  [103, 105],
  [104, 105],
  [103, 106],
  [103, 107],
  [105, 107],
  [105, 108],
  [109, 102],
];
