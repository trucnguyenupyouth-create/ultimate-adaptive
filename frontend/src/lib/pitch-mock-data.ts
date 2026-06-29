// Real-backed pitch demo data.
//
// This is intentionally hardcoded for a stable investor/student demo, but the
// KC ids, KC codes, KC names, questions, answers, and grading story are drawn
// from the current Assessment V2 item bank and the latest production run audit.

import type {
  AssessmentV2Result,
  AssessmentV2LearningLoop,
  AssessmentV2TranscriptStep,
  AssessmentV2SummaryRow,
} from "@/lib/assessment-v2-api";

const rows = {
  integerRead: {
    kc_id: "3bf438fd-b505-41f5-9864-ce1c914cde8c",
    code: "G6-MATH-NHAN-BIET-DOC",
    name: "Nhận biết, đọc và viết số nguyên âm",
  },
  fractionMeaning: {
    kc_id: "b68ce985-f530-48eb-9151-e880cf5a61fb",
    code: "G6-MATH-NHAN-BIET-PHAN-1",
    name: "Nhận biết phân số có tử và mẫu là số nguyên, mẫu khác 0",
  },
  integerMultiplySameSign: {
    kc_id: "4138513c-6cc2-41fe-bed2-2b2d4641fc28",
    code: "G6-MATH-NHAN-HAI-SO-1",
    name: "Nhân hai số nguyên cùng dấu",
  },
  integerMultiplyDifferentSign: {
    kc_id: "ab3650f9-b9db-458f-be79-83840d990c0a",
    code: "G6-MATH-NHAN-HAI-SO",
    name: "Nhân hai số nguyên khác dấu",
  },
  fractionMultiply: {
    kc_id: "6c18010c-1818-45cb-9c06-7c4adde88e07",
    code: "G6-MATH-NHAN-HAI-PHAN",
    name: "Nhân hai phân số",
  },
  fractionAddUnlike: {
    kc_id: "cdb87133-898d-431e-9155-b17dacb8d6dd",
    code: "G6-MATH-CONG-HAI-PHAN-1",
    name: "Cộng hai phân số khác mẫu bằng cách quy đồng mẫu",
  },
  commonDenominator: {
    kc_id: "93a0e693-56a1-4140-bbb5-6f27cd2c155b",
    code: "G6-MATH-QUY-DONG-MAU",
    name: "Quy đồng mẫu các phân số có tử/mẫu nguyên",
  },
  powerStructure: {
    kc_id: "2ceee5b6-021d-46db-b5df-08030916bf4b",
    code: "G6-MATH-NHAN-BIET-CAU",
    name: "Nhận biết cấu trúc lũy thừa",
  },
  fractionDivide: {
    kc_id: "d0d94d7e-8b74-4648-a31e-a722b86957d3",
    code: "G6-MATH-CHIA-HAI-PHAN",
    name: "Chia hai phân số",
  },
  sameDenominatorAdd: {
    kc_id: "4a8a5463-5958-48b7-8e90-f536aa889645",
    code: "G6-MATH-CONG-HAI-PHAN",
    name: "Cộng hai phân số cùng mẫu",
  },
  fractionProperty: {
    kc_id: "959461db-e6ce-44b6-8c5f-25c65ac467e8",
    code: "G6-MATH-TINH-CHAT-CO",
    name: "Áp dụng tính chất cơ bản của phân số",
  },
};

function summaryRow(
  row: { kc_id: string; code: string; name: string },
  state: string,
  p_mastery: number,
  probability_band = p_mastery >= 0.85 ? "high" : p_mastery <= 0.35 ? "low" : "medium",
): AssessmentV2SummaryRow {
  return {
    kc_id: row.kc_id,
    code: row.code,
    name: row.name,
    state,
    probability_band,
    p_mastery,
  };
}

const responses: AssessmentV2TranscriptStep[] = [
  {
    step: 1,
    item: {
      item_id: "v2-prod-001",
      kc_id: rows.integerRead.kc_id,
      kc_code: rows.integerRead.code,
      kc_name: rows.integerRead.name,
      question: "Trên trục số nằm ngang, điểm A cách gốc O 5 đơn vị về bên trái. A biểu diễn số nguyên nào?",
      answer_widget: "number",
      checker_type: "numeric_equal",
      difficulty_label: "anchor",
      is_diagnostic_anchor: true,
    },
    answer: "-5",
    response_type: "answer",
    grading: { is_correct: true, matched_rule: "numeric_equal" },
  },
  {
    step: 2,
    item: {
      item_id: "v2-001-replacement",
      kc_id: rows.fractionMeaning.kc_id,
      kc_code: rows.fractionMeaning.code,
      kc_name: rows.fractionMeaning.name,
      question: "Với biểu thức 7/(n - 3), giá trị nào của n làm biểu thức không phải là phân số hợp lệ?",
      answer_widget: "number",
      checker_type: "numeric_equal",
      difficulty_label: "anchor",
      is_diagnostic_anchor: true,
    },
    answer: "3",
    response_type: "answer",
    grading: { is_correct: true, matched_rule: "numeric_equal" },
  },
  {
    step: 3,
    item: {
      item_id: "v2-prod-003",
      kc_id: rows.integerMultiplySameSign.kc_id,
      kc_code: rows.integerMultiplySameSign.code,
      kc_name: rows.integerMultiplySameSign.name,
      question: "Tính: (-6) × (-7)",
      answer_widget: "number",
      checker_type: "numeric_equal",
      difficulty_label: "anchor",
      is_diagnostic_anchor: true,
    },
    answer: "-42",
    response_type: "answer",
    grading: {
      is_correct: false,
      matched_rule: "common_wrong_pattern",
      diagnosed_misconception: "Nhân hai số nguyên cùng dấu nhưng vẫn giữ dấu âm.",
    },
  },
  {
    step: 4,
    item: {
      item_id: "v2-064",
      kc_id: rows.integerMultiplyDifferentSign.kc_id,
      kc_code: rows.integerMultiplyDifferentSign.code,
      kc_name: rows.integerMultiplyDifferentSign.name,
      question: "Tính: (-8) × 5",
      answer_widget: "number",
      checker_type: "numeric_equal",
      difficulty_label: "anchor",
      is_diagnostic_anchor: true,
    },
    answer: "-40",
    response_type: "answer",
    grading: { is_correct: true, matched_rule: "numeric_equal" },
  },
  {
    step: 5,
    item: {
      item_id: "v2-098",
      kc_id: rows.fractionMultiply.kc_id,
      kc_code: rows.fractionMultiply.code,
      kc_name: rows.fractionMultiply.name,
      question: "Tính: 2/3 × 9/10",
      answer_widget: "fraction",
      checker_type: "fraction_equal",
      difficulty_label: "medium",
      is_diagnostic_anchor: false,
    },
    answer: "18/30",
    response_type: "answer",
    grading: {
      is_correct: false,
      matched_rule: "common_wrong_pattern",
      diagnosed_misconception: "Trả lời tương đương nhưng chưa rút gọn; item cần yêu cầu rõ dạng tối giản.",
    },
  },
  {
    step: 6,
    item: {
      item_id: "v2-005",
      kc_id: rows.fractionAddUnlike.kc_id,
      kc_code: rows.fractionAddUnlike.code,
      kc_name: rows.fractionAddUnlike.name,
      question: "Tính: 1/2 + 1/3",
      answer_widget: "fraction",
      checker_type: "fraction_equal",
      difficulty_label: "anchor",
      is_diagnostic_anchor: true,
    },
    answer: "2/5",
    response_type: "answer",
    grading: {
      is_correct: false,
      matched_rule: "common_wrong_pattern",
      diagnosed_misconception: "Cộng tử số với tử số và mẫu số với mẫu số trực tiếp; chưa quy đồng mẫu.",
    },
  },
];

export const PITCH_RESULT: AssessmentV2Result = {
  session_id: "pitch-real-g6-algebra",
  session_code: "REAL-DEMO",
  status: "completed",
  max_questions: 12,
  run: {
    source: "Curated from Assessment V2 item bank and latest production audit",
    frontier_reason: "max_expected_information_gain",
  },
  responses,
  summary: {
    strong_areas: [
      summaryRow(rows.integerRead, "tested_mastered", 0.958),
      summaryRow(rows.fractionMeaning, "tested_mastered", 0.958),
      summaryRow(rows.integerMultiplyDifferentSign, "tested_mastered", 0.958),
      summaryRow(rows.sameDenominatorAdd, "inferred_mastered", 0.84, "medium"),
      summaryRow(rows.fractionProperty, "inferred_mastered", 0.82, "medium"),
    ],
    skills_to_review: [
      summaryRow(rows.fractionAddUnlike, "tested_gap", 0.22, "low"),
      summaryRow(rows.integerMultiplySameSign, "tested_gap", 0.28, "low"),
      summaryRow(rows.fractionMultiply, "tested_gap", 0.32, "low"),
    ],
    possibly_affected: [
      summaryRow(rows.fractionDivide, "inferred_gap", 0.31, "low"),
      summaryRow(rows.powerStructure, "inferred_gap", 0.38, "medium"),
    ],
    not_enough_evidence: [
      summaryRow(rows.sameDenominatorAdd, "unknown", 0.64, "medium"),
      summaryRow(rows.fractionProperty, "unknown", 0.62, "medium"),
    ],
    ready_to_learn: [
      summaryRow(rows.commonDenominator, "ready_to_learn", 0.62, "medium"),
      summaryRow(rows.fractionAddUnlike, "ready_to_learn", 0.22, "low"),
    ],
    value_metrics: {
      questions_asked: responses.length,
      skills_directly_tested: 6,
      skills_inferred: 8,
      skills_not_directly_asked: 8,
    },
  },
  learning_loop: {
    recommendation: {
      ...summaryRow(rows.commonDenominator, "ready_to_learn", 0.62, "medium"),
      source_bucket: "ready_to_learn",
    },
    lesson: {
      lesson_id: "real-demo-quy-dong-mau",
      title: "Target lesson: quy đồng mẫu trước khi cộng phân số",
      subtitle: `${rows.commonDenominator.code} · ${rows.commonDenominator.name}`,
      concept:
        "Khi hai phân số khác mẫu, ta chưa cộng trực tiếp được. Cần đổi chúng về hai phân số bằng nhau có cùng mẫu, rồi mới cộng tử số.",
      worked_example: [
        "Mẫu chung nhỏ nhất của 2 và 3 là 6.",
        "1/2 = 3/6 vì nhân cả tử và mẫu với 3.",
        "1/3 = 2/6 vì nhân cả tử và mẫu với 2.",
        "Vậy 1/2 + 1/3 = 3/6 + 2/6 = 5/6.",
      ],
      practice_prompt: "Câu sai trong diagnostic là 1/2 + 1/3. Lỗi 2/5 cho thấy học sinh cộng ngang tử và mẫu, thay vì quy đồng.",
      mastery: {
        prompt: "Mastery check: Tính 2/5 + 1/10.",
        answer_widget: "fraction",
        accepted_answers: ["1/2", "5/10"],
        hint: "Quy đồng về mẫu 10: 2/5 = 4/10, rồi 4/10 + 1/10 = 5/10 = 1/2.",
      },
    },
    mastery_status: "not_started",
    mastery_checks: [],
  } as AssessmentV2LearningLoop,
};

export const PITCH_ASSESS_QUESTION = {
  item_id: "v2-005",
  kc_id: rows.fractionAddUnlike.kc_id,
  kc_code: rows.fractionAddUnlike.code,
  kc_name: rows.fractionAddUnlike.name,
  question: "Tính: 1/2 + 1/3",
  answer_type: "fraction",
  answer_widget: "fraction",
  checker_type: "fraction_equal",
  difficulty_label: "anchor",
  is_diagnostic_anchor: true,
  progress_hint: "Câu thật từ Assessment V2 item bank",
};

export const PITCH_POST_MASTERY: AssessmentV2Result = {
  ...PITCH_RESULT,
  summary: {
    ...PITCH_RESULT.summary,
    strong_areas: [
      ...PITCH_RESULT.summary.strong_areas,
      summaryRow(rows.commonDenominator, "tested_mastered", 0.92),
    ],
    possibly_affected: [
      ...PITCH_RESULT.summary.possibly_affected,
      summaryRow(rows.fractionAddUnlike, "inferred_recovering", 0.58, "medium"),
    ],
    skills_to_review: PITCH_RESULT.summary.skills_to_review.filter(
      (s) => s.kc_id !== rows.fractionAddUnlike.kc_id
    ),
    ready_to_learn: [
      summaryRow(rows.fractionAddUnlike, "ready_to_practice", 0.58, "medium"),
      summaryRow(rows.fractionDivide, "ready_to_learn", 0.50, "medium"),
    ],
  },
  learning_loop: {
    ...PITCH_RESULT.learning_loop!,
    mastery_status: "passed",
    mastery_checks: [{
      step: 1,
      submitted_at: new Date().toISOString(),
      answer: "1/2",
      accepted_answers: ["1/2", "5/10"],
      correct: true,
      lesson_id: "real-demo-quy-dong-mau",
      target_kc_id: rows.commonDenominator.kc_id,
      target_kc_code: rows.commonDenominator.code,
    }],
  },
};
