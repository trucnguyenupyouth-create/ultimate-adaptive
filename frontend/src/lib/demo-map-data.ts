import type { Skill } from "@/lib/map-data";

export const DEMO_TARGET_NODE_ID = 103;
export const DEMO_OUTCOME_NODE_IDS = new Set([103, 105]);

export const DEMO_FRACTION_MAP_PRE: Skill[] = [
  { id: 101, x: 16, y: 38, label: "Phân số hợp lệ", strength: "strong" },
  { id: 102, x: 36, y: 28, label: "Tính chất phân số", strength: "medium" },
  { id: 103, x: 56, y: 38, label: "Quy đồng mẫu", strength: "weak" },
  { id: 104, x: 34, y: 62, label: "Cộng cùng mẫu", strength: "strong" },
  { id: 105, x: 72, y: 58, label: "Cộng khác mẫu", strength: "weak" },
  { id: 106, x: 84, y: 32, label: "So sánh khác mẫu", strength: "inferred" },
  { id: 107, x: 70, y: 78, label: "Trừ khác mẫu", strength: "inferred" },
  { id: 108, x: 88, y: 72, label: "Chia phân số", strength: "inferred" },
  { id: 109, x: 18, y: 70, label: "Số nguyên âm", strength: "medium" },
];

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
