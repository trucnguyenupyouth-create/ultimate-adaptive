// ─── Pitch Demo Mock Data ─────────────────────────────────────────────────────
// Full mock AssessmentV2Result in API format — used when pitchMode=true
// Mirrors the visual story from the design reference

import type {
  AssessmentV2Result,
  AssessmentV2LearningLoop,
} from "@/lib/assessment-v2-api";

export const PITCH_RESULT: AssessmentV2Result = {
  session_id: "pitch-demo-001",
  session_code: "PITCH",
  status: "completed",
  max_questions: 12,
  run: {},
  responses: Array.from({ length: 12 }, (_, i) => ({
    step: i + 1,
    item: {
      item_id: `pitch-item-${i + 1}`,
      kc_id: "fractions",
      question: "Rút gọn biểu thức: 3/4 + 1/2 = ?",
      answer_widget: "fraction",
    },
    answer: "5/4",
    response_type: "answer",
    grading: { is_correct: i < 9 },
  })),
  summary: {
    strong_areas: [
      { kc_id: "addition",         code: "addition",         name: "Addition",        state: "strong", probability_band: "high",   p_mastery: 0.95 },
      { kc_id: "subtraction",      code: "subtraction",      name: "Subtraction",     state: "strong", probability_band: "high",   p_mastery: 0.93 },
      { kc_id: "multiplication",   code: "multiplication",   name: "Multiplication",  state: "strong", probability_band: "high",   p_mastery: 0.91 },
      { kc_id: "estimation",       code: "estimation",       name: "Estimation",      state: "strong", probability_band: "high",   p_mastery: 0.88 },
      { kc_id: "mental-math",      code: "mental-math",      name: "Mental Math",     state: "strong", probability_band: "high",   p_mastery: 0.90 },
      { kc_id: "place-value",      code: "place-value",      name: "Place Value",     state: "strong", probability_band: "high",   p_mastery: 0.94 },
      { kc_id: "number-line",      code: "number-line",      name: "Number Line",     state: "strong", probability_band: "high",   p_mastery: 0.89 },
      { kc_id: "rounding",         code: "rounding",         name: "Rounding",        state: "strong", probability_band: "high",   p_mastery: 0.87 },
      { kc_id: "comparing",        code: "comparing",        name: "Comparing",       state: "strong", probability_band: "high",   p_mastery: 0.92 },
      { kc_id: "shapes",           code: "shapes",           name: "Shapes",          state: "strong", probability_band: "high",   p_mastery: 0.88 },
      { kc_id: "perimeter",        code: "perimeter",        name: "Perimeter",       state: "strong", probability_band: "high",   p_mastery: 0.86 },
      { kc_id: "units",            code: "units",            name: "Units",           state: "strong", probability_band: "high",   p_mastery: 0.91 },
      { kc_id: "time",             code: "time",             name: "Time",            state: "strong", probability_band: "high",   p_mastery: 0.90 },
      { kc_id: "money",            code: "money",            name: "Money",           state: "strong", probability_band: "high",   p_mastery: 0.89 },
      { kc_id: "logic",            code: "logic",            name: "Logic",           state: "strong", probability_band: "high",   p_mastery: 0.85 },
      { kc_id: "number-patterns",  code: "number-patterns",  name: "Num. Patterns",   state: "strong", probability_band: "high",   p_mastery: 0.88 },
    ],
    skills_to_review: [
      { kc_id: "fractions",           code: "fractions",           name: "Fractions",      state: "weak", probability_band: "low", p_mastery: 0.28 },
      { kc_id: "fraction-equivalence",code: "fraction-equivalence",name: "Equivalence",    state: "weak", probability_band: "low", p_mastery: 0.22 },
      { kc_id: "simplifying",         code: "simplifying",         name: "Simplifying",    state: "weak", probability_band: "low", p_mastery: 0.25 },
      { kc_id: "mixed-numbers",       code: "mixed-numbers",       name: "Mixed Numbers",  state: "weak", probability_band: "low", p_mastery: 0.20 },
      { kc_id: "fraction-addition",   code: "fraction-addition",   name: "Fraction +/−",   state: "weak", probability_band: "low", p_mastery: 0.18 },
      { kc_id: "part-whole",          code: "part-whole",          name: "Part / Whole",   state: "weak", probability_band: "low", p_mastery: 0.30 },
      { kc_id: "gcd-lcm",             code: "gcd-lcm",             name: "GCD / LCM",      state: "weak", probability_band: "low", p_mastery: 0.24 },
      { kc_id: "word-problems",       code: "word-problems",       name: "Word Problems",  state: "weak", probability_band: "low", p_mastery: 0.35 },
    ],
    possibly_affected: [
      { kc_id: "division",        code: "division",        name: "Division",        state: "medium", probability_band: "medium", p_mastery: 0.62 },
      { kc_id: "order-of-operations", code: "order-of-operations", name: "Order of Ops", state: "medium", probability_band: "medium", p_mastery: 0.58 },
      { kc_id: "negative-numbers",code: "negative-numbers",name: "Negative Nums",   state: "medium", probability_band: "medium", p_mastery: 0.55 },
      { kc_id: "prime-numbers",   code: "prime-numbers",   name: "Prime Nums",      state: "medium", probability_band: "medium", p_mastery: 0.60 },
      { kc_id: "decimals",        code: "decimals",        name: "Decimals",        state: "medium", probability_band: "medium", p_mastery: 0.52 },
      { kc_id: "percentages",     code: "percentages",     name: "Percentages",     state: "medium", probability_band: "medium", p_mastery: 0.48 },
      { kc_id: "area",            code: "area",            name: "Area",            state: "medium", probability_band: "medium", p_mastery: 0.65 },
      { kc_id: "temperature",     code: "temperature",     name: "Temperature",     state: "medium", probability_band: "medium", p_mastery: 0.58 },
    ],
    not_enough_evidence: [],
    ready_to_learn: [],
    value_metrics: {
      questions_asked: 12,
      skills_directly_tested: 12,
      skills_inferred: 35,
      skills_not_directly_asked: 35,
    },
  },
  learning_loop: {
    recommendation: {
      kc_id: "fraction-equivalence",
      code: "fraction-equivalence",
      name: "Tính đẳng trị phân số",
      state: "weak",
      probability_band: "low",
      p_mastery: 0.22,
      source_bucket: "skills_to_review",
    },
    lesson: {
      lesson_id: "pitch-lesson-001",
      title: "Tính đẳng trị của phân số",
      subtitle: "Cụm Phân số · Gốc rễ",
      concept:
        "Hai phân số đẳng trị khi chúng biểu diễn cùng một giá trị — chỉ được viết khác đi.",
      worked_example: [
        "1/2 = 2/4 = 3/6 — tất cả cùng một giá trị",
        "Nhân cả tử và mẫu với 2: 1/2 × 2/2 = 2/4",
        "Nhân cả tử và mẫu với 3: 1/2 × 3/3 = 3/6",
      ],
      practice_prompt:
        "Để tính 3/4 + 1/2, cần quy đồng mẫu số trước: 1/2 = 2/4 (nhân với 2)",
      mastery: {
        prompt: "Phân số nào đẳng trị với 2/3?",
        answer_widget: "mcq",
        accepted_answers: ["4/6"],
        hint: "Nhân cả tử và mẫu với 2: 2/3 × 2/2 = ?",
      },
    },
    mastery_status: "not_started",
    mastery_checks: [],
  } as AssessmentV2LearningLoop,
};

// MCQ options for pitch mastery
export const PITCH_MCQ = [
  { id: 0, label: "4/9",  correct: false },
  { id: 1, label: "4/6",  correct: true  },
  { id: 2, label: "3/4",  correct: false },
  { id: 3, label: "6/4",  correct: false },
];

// Mock question for assess step
export const PITCH_ASSESS_QUESTION = {
  item_id: "pitch-assess-q7",
  kc_id: "fraction-equivalence",
  kc_name: "Fraction Equivalence",
  question: "Rút gọn biểu thức:",
  answer_widget: "fraction",
  difficulty_label: "medium",
  is_diagnostic_anchor: false,
  progress_hint: "Câu 7 / 12",
};

// Post-mastery result (map updated — outcome screen)
export const PITCH_POST_MASTERY: AssessmentV2Result = {
  ...PITCH_RESULT,
  summary: {
    ...PITCH_RESULT.summary,
    strong_areas: [
      ...PITCH_RESULT.summary.strong_areas,
    ],
    possibly_affected: [
      ...PITCH_RESULT.summary.possibly_affected,
      { kc_id: "fraction-equivalence", code: "fraction-equivalence", name: "Equivalence",   state: "medium", probability_band: "medium", p_mastery: 0.65 },
      { kc_id: "simplifying",          code: "simplifying",          name: "Simplifying",   state: "medium", probability_band: "medium", p_mastery: 0.55 },
      { kc_id: "fraction-addition",    code: "fraction-addition",    name: "Fraction +/−",  state: "medium", probability_band: "medium", p_mastery: 0.48 },
    ],
    skills_to_review: PITCH_RESULT.summary.skills_to_review.filter(
      (s) => !["fraction-equivalence", "simplifying", "fraction-addition"].includes(s.kc_id)
    ),
  },
  learning_loop: {
    ...PITCH_RESULT.learning_loop!,
    mastery_status: "passed",
    mastery_checks: [{
      step: 1,
      submitted_at: new Date().toISOString(),
      answer: "4/6",
      accepted_answers: ["4/6"],
      correct: true,
    }],
  },
};
