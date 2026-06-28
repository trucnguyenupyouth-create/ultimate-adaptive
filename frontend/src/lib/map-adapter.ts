// ─── Map Adapter ──────────────────────────────────────────────────────────────
// Converts API summary states into visual SKILLS array for KnowledgeMap

import { SKILLS, KC_CODE_MAP, type Skill } from "@/lib/map-data";
import type { AssessmentV2Summary } from "@/lib/assessment-v2-api";
import type { SkillStrength } from "@/components/wizzdom/design-tokens";

export function adaptSummaryToSkills(summary: AssessmentV2Summary): Skill[] {
  const stateMap = new Map<number, SkillStrength>();

  summary.strong_areas.forEach((s) => {
    const id = resolveKcId(s.kc_id, s.code);
    if (id) stateMap.set(id, "strong");
  });

  // possibly_affected = "medium" (developing)
  summary.possibly_affected.forEach((s) => {
    const id = resolveKcId(s.kc_id, s.code);
    if (id && !stateMap.has(id)) stateMap.set(id, "medium");
  });

  summary.skills_to_review.forEach((s) => {
    const id = resolveKcId(s.kc_id, s.code);
    if (id) stateMap.set(id, "weak"); // weak overrides medium
  });

  // not_enough_evidence → "inferred" (already default)

  return SKILLS.map((skill) => ({
    ...skill,
    strength: stateMap.get(skill.id) ?? "inferred",
  }));
}

function resolveKcId(kc_id: string, code?: string): number | undefined {
  // Try direct lookup
  const direct = KC_CODE_MAP[kc_id];
  if (direct) return direct;

  // Try code field
  if (code) {
    const fromCode = KC_CODE_MAP[code];
    if (fromCode) return fromCode;
  }

  // Try normalized: lowercase, replace underscores/spaces with dashes
  const normalized = kc_id.toLowerCase().replace(/[_\s]/g, "-");
  const fromNormalized = KC_CODE_MAP[normalized];
  if (fromNormalized) return fromNormalized;

  // No match — will default to "inferred"
  if (process.env.NODE_ENV === "development") {
    console.warn(`[map-adapter] No node match for kc_id="${kc_id}" code="${code}"`);
  }
  return undefined;
}

export function findTargetNodeId(kcId?: string | null): number {
  if (!kcId) return 15; // default to Equivalence
  return resolveKcId(kcId) ?? 15;
}

export function findOutcomeNodeIds(
  preSkills: Skill[],
  postSkills: Skill[]
): Set<number> {
  const upgraded = new Set<number>();
  postSkills.forEach((post) => {
    const pre = preSkills.find((s) => s.id === post.id);
    if (pre && pre.strength === "weak" && post.strength !== "weak") {
      upgraded.add(post.id);
    }
    if (pre && pre.strength === "inferred" && post.strength === "medium") {
      upgraded.add(post.id);
    }
  });
  return upgraded;
}
