import type { Skill } from "@/lib/map-data";

export const DEMO_TARGET_NODE_ID = 103;
export const DEMO_OUTCOME_NODE_IDS = new Set([103, 105]);

export const DEMO_FRACTION_MAP_PRE: Skill[] = [
  {
    id: 101,
    x: 14,
    y: 24,
    label: "Phân số\nhợp lệ",
    strength: "strong",
    code: "G6-MATH-NHAN-BIET-PHAN-1",
    fullName: "Nhận biết phân số có tử và mẫu là số nguyên, mẫu khác 0",
  },
  {
    id: 102,
    x: 34,
    y: 24,
    label: "Tính chất\nphân số",
    strength: "medium",
    code: "G6-MATH-TINH-CHAT-CO",
    fullName: "Áp dụng tính chất cơ bản của phân số",
  },
  {
    id: 103,
    x: 54,
    y: 24,
    label: "Quy đồng\nmẫu",
    strength: "weak",
    code: "G6-MATH-QUY-DONG-MAU",
    fullName: "Quy đồng mẫu các phân số",
  },
  {
    id: 104,
    x: 36,
    y: 53,
    label: "Cộng phân số\ncùng mẫu",
    strength: "strong",
    code: "G6-MATH-CONG-HAI-PHAN",
    fullName: "Cộng hai phân số cùng mẫu",
  },
  {
    id: 105,
    x: 73,
    y: 44,
    label: "Cộng phân số\nkhác mẫu",
    strength: "weak",
    code: "G6-MATH-CONG-HAI-PHAN-1",
    fullName: "Cộng hai phân số khác mẫu bằng cách quy đồng mẫu",
  },
  {
    id: 106,
    x: 86,
    y: 26,
    label: "So sánh phân số\nkhác mẫu",
    strength: "inferred",
    code: "G6-MATH-SO-SANH-HAI-1",
    fullName: "So sánh phân số khác mẫu bằng cách quy đồng mẫu",
  },
  {
    id: 107,
    x: 57,
    y: 66,
    label: "Trừ phân số\nkhác mẫu",
    strength: "inferred",
    code: "G6-MATH-TRU-HAI-PHAN",
    fullName: "Trừ hai phân số khác mẫu",
  },
  {
    id: 108,
    x: 86,
    y: 66,
    label: "Chia\nphân số",
    strength: "inferred",
    code: "G6-MATH-CHIA-HAI-PHAN",
    fullName: "Chia hai phân số",
  },
  {
    id: 109,
    x: 15,
    y: 64,
    label: "Số nguyên\nâm",
    strength: "medium",
    code: "G6-MATH-NHAN-BIET-DOC",
    fullName: "Đọc và viết số nguyên âm",
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
