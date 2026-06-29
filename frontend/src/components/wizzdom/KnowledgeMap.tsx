"use client";
// ─── Knowledge Map SVG Component ──────────────────────────────────────────────
// 47-node skill graph with prerequisite edges
// Skill positions are fixed (curriculum layout), colors driven by props
// Supports: animateIn, showTarget (pulse), outcome (green flash)

import { useEffect, useState } from "react";
import { B, MONO, type SkillStrength } from "@/components/wizzdom/design-tokens";
import type { Skill } from "@/lib/map-data";
import { SKILLS as DEFAULT_SKILLS, EDGES as DEFAULT_EDGES } from "@/lib/map-data";

// ─── Color helpers ────────────────────────────────────────────────────────────
function nodeColor(s: SkillStrength, updated = false): string {
  if (updated) return B.green;
  return { strong: B.blue, medium: B.blueMid, weak: B.orange, inferred: "#CBD5E1" }[s];
}
function nodeStroke(s: SkillStrength, updated = false): string {
  if (updated) return B.green;
  return { strong: B.blue, medium: B.blueMid, weak: B.orange, inferred: "#94A3B8" }[s];
}
function nodeR(s: SkillStrength): number {
  return { strong: 1.5, medium: 1.3, weak: 1.5, inferred: 0.85 }[s];
}
function edgeStroke(s1: SkillStrength, s2: SkillStrength): string {
  if (s1 === "inferred" || s2 === "inferred") return "rgba(0,0,0,0.04)";
  if (s1 === "weak" || s2 === "weak") return "rgba(245,158,11,0.22)";
  return "rgba(61,114,248,0.12)";
}

// ─── KnowledgeMap ─────────────────────────────────────────────────────────────
interface KnowledgeMapProps {
  skills?: Skill[];          // defaults to SKILLS (pitch mode)
  edges?: [number, number][];
  targetNodeId?: number;     // node to pulse (default 15)
  outcomeNodeIds?: Set<number>; // nodes to flash green
  animateIn?: boolean;
  showTarget?: boolean;
  outcome?: boolean;
}

export function KnowledgeMap({
  skills = DEFAULT_SKILLS,
  edges = DEFAULT_EDGES,
  targetNodeId = 15,
  outcomeNodeIds = new Set([15, 16, 18]),
  animateIn = false,
  showTarget = false,
  outcome = false,
}: KnowledgeMapProps) {
  const [revealed, setRevealed] = useState(!animateIn);

  useEffect(() => {
    if (!animateIn) return;
    const t = setTimeout(() => setRevealed(true), 180);
    return () => clearTimeout(t);
  }, [animateIn]);

  const getSkill = (id: number) => skills.find((s) => s.id === id);

  return (
    <svg
      viewBox="0 0 100 100"
      className="w-full h-full"
      preserveAspectRatio="xMidYMid meet"
      style={{ overflow: "visible" }}
    >
      <defs>
        <filter id="glow-blue" x="-60%" y="-60%" width="220%" height="220%">
          <feGaussianBlur stdDeviation="1.2" result="b" />
          <feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge>
        </filter>
        <filter id="glow-orange" x="-60%" y="-60%" width="220%" height="220%">
          <feGaussianBlur stdDeviation="1.6" result="b" />
          <feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge>
        </filter>
        <filter id="glow-green" x="-60%" y="-60%" width="220%" height="220%">
          <feGaussianBlur stdDeviation="1.4" result="b" />
          <feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge>
        </filter>
        <marker id="kg-arrow" markerWidth="5" markerHeight="5" refX="4.3" refY="2.5" orient="auto">
          <path d="M0,0 L5,2.5 L0,5 Z" fill="rgba(30,41,59,0.22)" />
        </marker>

        {/* Cluster background gradients */}
        <radialGradient id="bgL" cx="15%" cy="25%" r="28%">
          <stop offset="0%" stopColor={B.blue} stopOpacity="0.07" />
          <stop offset="100%" stopColor={B.blue} stopOpacity="0" />
        </radialGradient>
        <radialGradient id="bgR" cx="80%" cy="18%" r="25%">
          <stop offset="0%" stopColor={B.blue} stopOpacity="0.06" />
          <stop offset="100%" stopColor={B.blue} stopOpacity="0" />
        </radialGradient>
        <radialGradient id="bgW" cx="46%" cy="52%" r="22%">
          <stop offset="0%" stopColor={B.orange} stopOpacity="0.1" />
          <stop offset="100%" stopColor={B.orange} stopOpacity="0" />
        </radialGradient>
        {outcome && (
          <radialGradient id="bgU" cx="52%" cy="48%" r="18%">
            <stop offset="0%" stopColor={B.green} stopOpacity="0.1" />
            <stop offset="100%" stopColor={B.green} stopOpacity="0" />
          </radialGradient>
        )}
      </defs>

      <rect width="100" height="100" fill="url(#bgL)" />
      <rect width="100" height="100" fill="url(#bgR)" />
      <rect width="100" height="100" fill="url(#bgW)" />
      {outcome && <rect width="100" height="100" fill="url(#bgU)" />}

      {/* Edges */}
      {edges.map(([a, b], i) => {
        const sa = getSkill(a);
        const sb = getSkill(b);
        if (!sa || !sb) return null;
        return (
          <line
            key={`e${i}`}
            x1={sa.x} y1={sa.y} x2={sb.x} y2={sb.y}
            stroke={edgeStroke(sa.strength, sb.strength)}
            strokeWidth="0.25"
            markerEnd="url(#kg-arrow)"
            style={{ opacity: revealed ? 1 : 0, transition: `opacity ${0.4 + i * 0.004}s ease` }}
          />
        );
      })}

      {/* Nodes */}
      {skills.map((skill, i) => {
        const isTarget = skill.id === targetNodeId && showTarget;
        const isUpdated = outcome && outcomeNodeIds.has(skill.id);
        const effS: SkillStrength = isUpdated ? "medium" : skill.strength;
        const col = nodeColor(effS, isUpdated);
        const str = nodeStroke(effS, isUpdated);
        const r = nodeR(effS);
        const isInferred = effS === "inferred" && !isUpdated;
        const filterId = isUpdated ? "glow-green"
          : effS === "strong" || effS === "medium" ? "glow-blue"
          : effS === "weak" ? "glow-orange"
          : undefined;
        const nodeOpacity = revealed ? (isInferred ? 0.5 : 1) : 0;
        const delay = `${0.05 + i * 0.024}s`;

        return (
          <g key={skill.id}>
            {/* Target pulse ring */}
            {isTarget && (
              <circle cx={skill.x} cy={skill.y} r={r + 2} fill="none" stroke={B.orange} strokeWidth="0.4">
                <animate attributeName="r" values={`${r + 1.5};${r + 3.2};${r + 1.5}`} dur="2.2s" repeatCount="indefinite" />
                <animate attributeName="opacity" values="0.7;0.1;0.7" dur="2.2s" repeatCount="indefinite" />
              </circle>
            )}
            {/* Outcome flash ring */}
            {isUpdated && (
              <circle cx={skill.x} cy={skill.y} r={r + 1} fill="none" stroke={B.green} strokeWidth="0.5">
                <animate attributeName="r" values={`${r + 1};${r + 6}`} dur="1.5s" begin="0.4s" repeatCount="1" fill="freeze" />
                <animate attributeName="opacity" values="0.9;0" dur="1.5s" begin="0.4s" repeatCount="1" fill="freeze" />
              </circle>
            )}
            {/* Node circle */}
            <circle
              cx={skill.x} cy={skill.y} r={r}
              fill={isInferred ? "rgba(241,245,249,0.9)" : col}
              stroke={str}
              strokeWidth={isInferred ? "0.3" : "0"}
              strokeDasharray={isInferred ? "0.7 0.45" : undefined}
              filter={filterId ? `url(#${filterId})` : undefined}
              style={{ opacity: nodeOpacity, transition: `opacity ${delay} ease` }}
            />
            {/* Label */}
            <text
              x={skill.x} y={skill.y + r + (isInferred ? 1.9 : 2.1)}
              textAnchor="middle"
              fontSize={isInferred ? "1.1" : "1.3"}
              fill={isInferred ? "#94A3B8" : col}
              fontFamily={MONO}
              style={{
                opacity: revealed ? (isInferred ? 0.45 : 0.7) : 0,
                transition: `opacity ${delay} ease`,
                pointerEvents: "none",
              }}
            >
              {skill.label}
            </text>
          </g>
        );
      })}
    </svg>
  );
}
