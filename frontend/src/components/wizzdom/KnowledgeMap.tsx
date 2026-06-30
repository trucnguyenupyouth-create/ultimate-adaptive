"use client";
// ─── Knowledge Map SVG Component ──────────────────────────────────────────────
// 47-node skill graph with prerequisite edges
// Skill positions are fixed (curriculum layout), colors driven by props
// Supports: animateIn, showTarget (pulse), outcome (green flash)

import { useEffect, useState } from "react";
import { B, INTER, MONO, NUNITO, type SkillStrength } from "@/components/wizzdom/design-tokens";
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
        const labelLines = skill.label.split("\n");
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
              fontSize={labelLines.length > 1 ? (isInferred ? "1" : "1.15") : (isInferred ? "1.1" : "1.3")}
              fill={isInferred ? "#94A3B8" : col}
              fontFamily={MONO}
              style={{
                opacity: revealed ? (isInferred ? 0.45 : 0.7) : 0,
                transition: `opacity ${delay} ease`,
                pointerEvents: "none",
              }}
            >
              {labelLines.map((line, lineIndex) => (
                <tspan
                  key={line}
                  x={skill.x}
                  dy={lineIndex === 0 ? 0 : 1.35}
                >
                  {line}
                </tspan>
              ))}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

type ProofEdgeTone = "default" | "blocker" | "affected" | "updated";

interface PitchProofMapProps {
  skills: Skill[];
  edges: [number, number][];
  targetNodeId: number;
  outcomeNodeIds?: Set<number>;
  outcome?: boolean;
}

const PROOF_NODE_SIZE = {
  height: 70,
};

function proofEdgeId(a: number, b: number) {
  return `${a}-${b}`;
}

function proofY(y: number) {
  return 16 + y * 0.72;
}

function proofEdgeTone(a: number, b: number, outcome: boolean, outcomeNodeIds: Set<number>): ProofEdgeTone {
  const id = proofEdgeId(a, b);
  if (outcome && (outcomeNodeIds.has(a) || outcomeNodeIds.has(b))) return "updated";
  if (["102-103", "103-105"].includes(id)) return "blocker";
  if (["103-106", "103-107", "105-107", "105-108"].includes(id)) return "affected";
  return "default";
}

function proofNodeTheme(skill: Skill, isTarget: boolean, isUpdated: boolean) {
  if (isUpdated) {
    return {
      chip: "ĐÃ CẬP NHẬT",
      background: B.greenLight,
      border: B.green,
      color: B.green,
      shadow: "0 14px 28px rgba(16,185,129,0.18)",
    };
  }
  if (isTarget) {
    return {
      chip: "SẴN SÀNG HỌC",
      background: B.orangeLight,
      border: B.orange,
      color: B.orange,
      shadow: "0 14px 28px rgba(245,158,11,0.18)",
    };
  }
  if (skill.strength === "strong") {
    return {
      chip: "ĐÃ XÁC NHẬN",
      background: B.blueLight,
      border: B.blue,
      color: B.blue,
      shadow: "0 12px 24px rgba(61,114,248,0.12)",
    };
  }
  if (skill.strength === "weak") {
    return {
      chip: "CÓ LỖ HỔNG",
      background: B.orangeLight,
      border: B.orange,
      color: B.orange,
      shadow: "0 14px 28px rgba(245,158,11,0.16)",
    };
  }
  if (skill.strength === "medium") {
    return {
      chip: "ĐANG PHÁT TRIỂN",
      background: B.white,
      border: B.blueMid,
      color: B.blueDark,
      shadow: "0 10px 22px rgba(61,114,248,0.1)",
    };
  }
  return {
    chip: "BỊ ẢNH HƯỞNG",
    background: "#F8FAFC",
    border: "#CBD5E1",
    color: "#64748B",
    shadow: "none",
  };
}

function proofEdgeStyle(tone: ProofEdgeTone) {
  if (tone === "updated") return { stroke: B.green, width: 0.55, dash: "", opacity: 0.8 };
  if (tone === "blocker") return { stroke: B.orange, width: 0.55, dash: "", opacity: 0.86 };
  if (tone === "affected") return { stroke: "#94A3B8", width: 0.35, dash: "1.2 1", opacity: 0.42 };
  return { stroke: "#CBD5E1", width: 0.28, dash: "", opacity: 0.34 };
}

function proofNodeLabel(skill: Skill) {
  return skill.label.replace(/\n/g, " ");
}

export function PitchProofMap({
  skills,
  edges,
  targetNodeId,
  outcomeNodeIds = new Set<number>(),
  outcome = false,
}: PitchProofMapProps) {
  const getSkill = (id: number) => skills.find((skill) => skill.id === id);

  return (
    <div
      style={{
        position: "relative",
        width: "100%",
        minHeight: 520,
        borderRadius: 28,
        border: `1px solid ${B.grayBorder}`,
        background: `linear-gradient(135deg, ${B.white} 0%, #F8FAFF 58%, ${B.blueLight} 100%)`,
        boxShadow: "0 18px 50px rgba(17,24,39,0.08)",
        overflow: "hidden",
      }}
    >
      <div
        style={{
          position: "absolute",
          inset: 18,
          borderRadius: 22,
          backgroundImage:
            "linear-gradient(rgba(148,163,184,0.11) 1px, transparent 1px), linear-gradient(90deg, rgba(148,163,184,0.11) 1px, transparent 1px)",
          backgroundSize: "34px 34px",
        }}
      />

      <div style={{ position: "absolute", top: 22, left: 24, right: 24, display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 16 }}>
        <div>
          <p style={{ margin: "0 0 4px", fontFamily: MONO, fontSize: 11, fontWeight: 800, color: B.blue, letterSpacing: 0, textTransform: "uppercase" }}>
            Bản đồ kiến thức phân số lớp 6
          </p>
          <p style={{ margin: 0, fontFamily: NUNITO, fontSize: 24, fontWeight: 900, color: B.text, lineHeight: 1.05 }}>
            Một lỗi sai truy ra lỗ hổng kiến thức tiên quyết
          </p>
        </div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8, justifyContent: "flex-end", maxWidth: 430 }}>
          {[
            { label: "Đã vững", color: B.blue, bg: B.blueLight },
            { label: "Có lỗ hổng", color: B.orange, bg: B.orangeLight },
            { label: "Có thể bị ảnh hưởng", color: "#64748B", bg: "#F8FAFC" },
            { label: "Sẵn sàng học", color: B.orange, bg: B.orangeLight },
            { label: "Đã cập nhật sau luyện tập", color: B.green, bg: B.greenLight },
          ].map((item) => (
            <span
              key={item.label}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
                padding: "6px 9px",
                borderRadius: 9999,
                backgroundColor: item.bg,
                color: item.color,
                border: `1px solid ${item.color}26`,
                fontFamily: NUNITO,
                fontSize: 11,
                fontWeight: 850,
                whiteSpace: "nowrap",
              }}
            >
              <span style={{ width: 8, height: 8, borderRadius: 9999, backgroundColor: item.color }} />
              {item.label}
            </span>
          ))}
        </div>
      </div>

      <svg
        viewBox="0 0 100 100"
        preserveAspectRatio="none"
        style={{ position: "absolute", inset: 0, width: "100%", height: "100%", overflow: "visible" }}
      >
        {edges.map(([a, b]) => {
          const source = getSkill(a);
          const target = getSkill(b);
          if (!source || !target) return null;
          const tone = proofEdgeTone(a, b, outcome, outcomeNodeIds);
          const style = proofEdgeStyle(tone);
          if (tone === "default" && !["101-102", "104-105"].includes(proofEdgeId(a, b))) return null;
          return (
            <line
              key={proofEdgeId(a, b)}
              x1={source.x}
              y1={proofY(source.y)}
              x2={target.x}
              y2={proofY(target.y)}
              stroke={style.stroke}
              strokeWidth={style.width}
              strokeDasharray={style.dash}
              opacity={style.opacity}
              strokeLinecap="round"
            />
          );
        })}
      </svg>

      {skills.map((skill) => {
        const isTarget = skill.id === targetNodeId && !outcome;
        const isUpdated = outcome && outcomeNodeIds.has(skill.id);
        const theme = proofNodeTheme(skill, isTarget, isUpdated);
        const isMuted = skill.strength === "inferred" && !isUpdated;
        const isCompact = isMuted && !isUpdated;
        return (
          <div
            key={skill.id}
            style={{
              position: "absolute",
              left: `${skill.x}%`,
              top: `${proofY(skill.y)}%`,
              transform: "translate(-50%, -50%)",
              width: isCompact ? "clamp(112px, 12vw, 140px)" : "clamp(122px, 13vw, 158px)",
              minHeight: isCompact ? 56 : PROOF_NODE_SIZE.height,
              padding: isCompact ? "10px 11px" : "11px 12px",
              borderRadius: isCompact ? 16 : 18,
              border: `${isCompact ? 1.5 : 2}px solid ${theme.border}`,
              backgroundColor: theme.background,
              boxShadow: theme.shadow,
              opacity: isMuted ? 0.78 : 1,
              zIndex: isTarget || isUpdated || skill.strength === "weak" ? 3 : 2,
            }}
          >
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, marginBottom: isCompact ? 5 : 7 }}>
              <span style={{ fontFamily: MONO, fontSize: isCompact ? 8 : 8.5, fontWeight: 800, color: theme.color, lineHeight: 1.1 }}>
                {skill.code}
              </span>
            </div>
            <p style={{ margin: isCompact ? "0 0 7px" : "0 0 8px", fontFamily: NUNITO, fontSize: isCompact ? 13 : 14, fontWeight: 900, color: B.text, lineHeight: 1.08 }}>
              {proofNodeLabel(skill)}
            </p>
            <span
              style={{
                display: "inline-flex",
                alignItems: "center",
                padding: isCompact ? "3px 7px" : "4px 8px",
                borderRadius: 9999,
                backgroundColor: B.white,
                color: theme.color,
                border: `1px solid ${theme.border}33`,
                fontFamily: MONO,
                fontSize: 8,
                fontWeight: 900,
                letterSpacing: 0,
              }}
            >
              {theme.chip}
            </span>
          </div>
        );
      })}

      <div
        style={{
          position: "absolute",
          left: 24,
          bottom: 20,
          display: "flex",
          flexWrap: "wrap",
          gap: 8,
          maxWidth: "calc(100% - 48px)",
        }}
      >
        {[
          "Nút theo chương trình thật",
          "Mã kiến thức thật",
          "Ngân hàng câu tự luận",
          "Chấm theo lỗi sai điển hình",
          "Sinh hành động cho giáo viên",
        ].map((signal) => (
          <span
            key={signal}
            style={{
              padding: "7px 10px",
              borderRadius: 9999,
              backgroundColor: "rgba(255,255,255,0.88)",
              border: `1px solid ${B.grayBorder}`,
              color: B.textMid,
              fontFamily: INTER,
              fontSize: 11,
              fontWeight: 750,
              boxShadow: "0 8px 18px rgba(17,24,39,0.05)",
              whiteSpace: "nowrap",
            }}
          >
            {signal}
          </span>
        ))}
      </div>
    </div>
  );
}
