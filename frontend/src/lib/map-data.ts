// ─── Knowledge Map Data ───────────────────────────────────────────────────────
// 47-node skill graph for Grade 6–9 Vietnamese math curriculum
// x,y positions are fixed (curriculum-based layout, not force-directed)
// Colors are dynamic — driven by API states via map-adapter

import type { SkillStrength } from "@/components/wizzdom/design-tokens";

export interface Skill {
  id: number;
  x: number;
  y: number;
  label: string;
  strength: SkillStrength;
  code?: string;
  fullName?: string;
}

export const SKILLS: Skill[] = [
  { id: 1,  x: 12, y: 16, label: "Addition",       strength: "strong" },
  { id: 2,  x: 21, y: 9,  label: "Subtraction",    strength: "strong" },
  { id: 3,  x: 7,  y: 28, label: "Multiplication", strength: "strong" },
  { id: 4,  x: 18, y: 36, label: "Division",       strength: "medium" },
  { id: 5,  x: 27, y: 20, label: "Estimation",     strength: "strong" },
  { id: 6,  x: 5,  y: 44, label: "Order of Ops",   strength: "medium" },
  { id: 7,  x: 24, y: 44, label: "Mental Math",    strength: "strong" },
  { id: 8,  x: 74, y: 8,  label: "Place Value",    strength: "strong" },
  { id: 9,  x: 85, y: 16, label: "Number Line",    strength: "strong" },
  { id: 10, x: 66, y: 18, label: "Rounding",       strength: "strong" },
  { id: 11, x: 80, y: 28, label: "Comparing",      strength: "strong" },
  { id: 12, x: 91, y: 38, label: "Negative Nums",  strength: "medium" },
  { id: 13, x: 68, y: 34, label: "Prime Nums",     strength: "medium" },
  { id: 14, x: 38, y: 46, label: "Fractions",      strength: "weak"   },
  { id: 15, x: 49, y: 40, label: "Equivalence",    strength: "weak"   },
  { id: 16, x: 58, y: 48, label: "Simplifying",    strength: "weak"   },
  { id: 17, x: 43, y: 57, label: "Mixed Numbers",  strength: "weak"   },
  { id: 18, x: 54, y: 60, label: "Fraction +/−",   strength: "weak"   },
  { id: 19, x: 33, y: 58, label: "Part / Whole",   strength: "weak"   },
  { id: 20, x: 64, y: 56, label: "Decimals",       strength: "medium" },
  { id: 21, x: 47, y: 70, label: "Percentages",    strength: "medium" },
  { id: 22, x: 83, y: 50, label: "Variables",      strength: "inferred" },
  { id: 23, x: 92, y: 60, label: "Equations",      strength: "inferred" },
  { id: 24, x: 80, y: 66, label: "Expressions",    strength: "inferred" },
  { id: 25, x: 90, y: 76, label: "Inequalities",   strength: "inferred" },
  { id: 26, x: 74, y: 76, label: "Patterns",       strength: "inferred" },
  { id: 27, x: 11, y: 62, label: "Shapes",         strength: "strong" },
  { id: 28, x: 19, y: 72, label: "Perimeter",      strength: "strong" },
  { id: 29, x: 7,  y: 80, label: "Area",           strength: "medium" },
  { id: 30, x: 26, y: 82, label: "Volume",         strength: "inferred" },
  { id: 31, x: 15, y: 90, label: "Angles",         strength: "inferred" },
  { id: 32, x: 36, y: 84, label: "Units",          strength: "strong" },
  { id: 33, x: 44, y: 90, label: "Time",           strength: "strong" },
  { id: 34, x: 54, y: 88, label: "Money",          strength: "strong" },
  { id: 35, x: 64, y: 80, label: "Temperature",    strength: "medium" },
  { id: 36, x: 82, y: 84, label: "Graphs",         strength: "inferred" },
  { id: 37, x: 91, y: 90, label: "Mean/Median",    strength: "inferred" },
  { id: 38, x: 72, y: 90, label: "Probability",    strength: "inferred" },
  { id: 39, x: 32, y: 28, label: "Factors",        strength: "medium" },
  { id: 40, x: 41, y: 22, label: "Multiples",      strength: "medium" },
  { id: 41, x: 52, y: 26, label: "GCD / LCM",      strength: "weak"   },
  { id: 42, x: 60, y: 36, label: "Divisibility",   strength: "medium" },
  { id: 43, x: 30, y: 12, label: "Word Problems",  strength: "medium" },
  { id: 44, x: 48, y: 12, label: "Problem Solving",strength: "medium" },
  { id: 45, x: 64, y: 7,  label: "Logic",          strength: "strong" },
  { id: 46, x: 37, y: 7,  label: "Num. Patterns",  strength: "strong" },
  { id: 47, x: 74, y: 46, label: "Ratio",          strength: "inferred" },
];

export const EDGES: [number, number][] = [
  [1,2],[1,3],[2,3],[3,4],[1,5],[3,6],[4,6],[6,7],
  [8,9],[8,10],[9,11],[10,11],[11,12],[10,13],[13,42],
  [14,15],[14,16],[14,17],[14,18],[14,19],[15,16],[16,18],[17,18],[16,20],[18,21],[20,21],
  [22,23],[22,24],[23,25],[24,26],[22,26],
  [27,28],[27,29],[28,29],[29,30],[27,31],
  [32,33],[32,34],[33,34],[32,35],
  [36,37],[36,38],[37,38],
  [3,39],[39,40],[40,41],[41,14],[42,40],[41,16],
  [1,43],[2,43],[44,43],[44,45],[45,46],[46,40],[46,8],
  [21,47],[14,47],[47,22],
  [7,14],[39,14],[40,44],[12,22],[21,34],[19,14],[6,39],
];

// Map from backend kc_id to SKILLS array node id
// IMPORTANT: Update this map to match actual backend KC codes
// Fallback: unmatched kc_ids will display as "inferred" (gray)
export const KC_CODE_MAP: Record<string, number> = {
  // Basic Operations
  "addition":          1,
  "subtraction":       2,
  "multiplication":    3,
  "division":          4,
  "estimation":        5,
  "order-of-operations": 6,
  "mental-math":       7,
  "4138513c-6cc2-41fe-bed2-2b2d4641fc28": 3,
  "G6-MATH-NHAN-HAI-SO-1": 3,
  "ab3650f9-b9db-458f-be79-83840d990c0a": 3,
  "G6-MATH-NHAN-HAI-SO": 3,
  "2ceee5b6-021d-46db-b5df-08030916bf4b": 6,
  "G6-MATH-NHAN-BIET-CAU": 6,
  "095f17d0-9860-4c78-9ad7-d93b1702af55": 6,
  "G6-MATH-NHAN-LUY-THUA": 6,
  // Number Sense
  "place-value":       8,
  "number-line":       9,
  "rounding":          10,
  "comparing":         11,
  "negative-numbers":  12,
  "prime-numbers":     13,
  "3bf438fd-b505-41f5-9864-ce1c914cde8c": 12,
  "G6-MATH-NHAN-BIET-DOC": 12,
  "57767f23-fa58-4d24-a2c3-e2bc436786da": 12,
  "G6-MATH-SO-SANH-HAI-5": 12,
  // Fractions (the focus cluster)
  "fractions":         14,
  "fraction-equivalence": 15,
  "simplifying":       16,
  "mixed-numbers":     17,
  "fraction-addition": 18,
  "part-whole":        19,
  "b68ce985-f530-48eb-9151-e880cf5a61fb": 14,
  "G6-MATH-NHAN-BIET-PHAN-1": 14,
  "0164cf7c-e080-4ca0-909b-e292f65af633": 15,
  "G6-MATH-NHAN-BIET-HAI": 15,
  "93a0e693-56a1-4140-bbb5-6f27cd2c155b": 15,
  "G6-MATH-QUY-DONG-MAU": 15,
  "959461db-e6ce-44b6-8c5f-25c65ac467e8": 16,
  "G6-MATH-TINH-CHAT-CO": 16,
  "33b1d60d-acfc-4736-a239-6d12646115a8": 17,
  "G6-MATH-NHAN-BIET-HON": 17,
  "4a8a5463-5958-48b7-8e90-f536aa889645": 18,
  "G6-MATH-CONG-HAI-PHAN": 18,
  "cdb87133-898d-431e-9155-b17dacb8d6dd": 18,
  "G6-MATH-CONG-HAI-PHAN-1": 18,
  "d0d94d7e-8b74-4648-a31e-a722b86957d3": 18,
  "G6-MATH-CHIA-HAI-PHAN": 18,
  "6c18010c-1818-45cb-9c06-7c4adde88e07": 18,
  "G6-MATH-NHAN-HAI-PHAN": 18,
  // Decimals & Percentages
  "decimals":          20,
  "percentages":       21,
  // Algebra
  "variables":         22,
  "equations":         23,
  "expressions":       24,
  "inequalities":      25,
  "patterns":          26,
  // Geometry
  "shapes":            27,
  "perimeter":         28,
  "area":              29,
  "volume":            30,
  "angles":            31,
  // Measurement
  "units":             32,
  "time":              33,
  "money":             34,
  "temperature":       35,
  // Data
  "graphs":            36,
  "mean-median":       37,
  "probability":       38,
  // Number Theory
  "factors":           39,
  "multiples":         40,
  "gcd-lcm":           41,
  "divisibility":      42,
  // Problem Solving
  "word-problems":     43,
  "problem-solving":   44,
  "logic":             45,
  "number-patterns":   46,
  // Ratios
  "ratio":             47,
};
