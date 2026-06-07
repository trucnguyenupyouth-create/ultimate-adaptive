"use client";

import { memo } from "react";
import { Handle, Position, NodeProps } from "@xyflow/react";
import { AlertTriangle, CheckCircle, BookOpen } from "lucide-react";

export interface KCNodeData {
  id: string;
  code: string;
  name: string;
  grade: number;
  subject: string;
  itemCounts?: { total: number; easy: number; medium: number; hard: number };
  isRoot?: boolean;
  isLeaf?: boolean;
  isLowItems?: boolean;
  isSelected?: boolean;
}

const GRADE_COLOR: Record<number, { bg: string; border: string; label: string }> = {
  6: { bg: "var(--node-root)",  border: "var(--node-root-border)",  label: "Lớp 6" },
  7: { bg: "var(--node-mid)",   border: "var(--node-mid-border)",   label: "Lớp 7" },
  8: { bg: "var(--node-leaf)",  border: "var(--node-leaf-border)",  label: "Lớp 8" },
  9: { bg: "#2d1f1f",           border: "#e05252",                  label: "Lớp 9" },
};

function KCNodeComponent({ data, selected }: NodeProps) {
  const d = data as unknown as KCNodeData;
  const colors = GRADE_COLOR[d.grade as keyof typeof GRADE_COLOR] ?? GRADE_COLOR[7];
  const isWarning = d.isLowItems;
  const borderColor = selected
    ? "var(--node-selected-border)"
    : isWarning
    ? "var(--node-warning-border)"
    : colors.border;
  const bgColor = selected
    ? "var(--node-selected)"
    : isWarning
    ? "var(--node-warning)"
    : colors.bg;

  return (
    <div
      style={{
        background: bgColor,
        border: `2px solid ${borderColor}`,
        borderRadius: 10,
        padding: "10px 14px",
        minWidth: 180,
        maxWidth: 220,
        boxShadow: selected
          ? `0 0 0 3px rgba(88,166,255,0.25)`
          : "0 2px 8px rgba(0,0,0,0.4)",
        transition: "all 0.15s ease",
        cursor: "grab",
        animation: "fadeIn 0.2s ease",
      }}
    >
      {/* Top handle — incoming edges (this KC is a successor of something) */}
      <Handle
        type="target"
        position={Position.Top}
        style={{ background: borderColor, border: "none", width: 8, height: 8 }}
      />

      {/* Header row */}
      <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 6 }}>
        <span
          className="badge"
          style={{
            background: `${borderColor}22`,
            color: borderColor,
            border: `1px solid ${borderColor}44`,
            fontSize: 10,
          }}
        >
          {colors.label}
        </span>
        {d.isRoot && (
          <span className="badge badge-green" style={{ fontSize: 10 }}>
            Root
          </span>
        )}
        {d.isLeaf && (
          <span className="badge badge-purple" style={{ fontSize: 10 }}>
            Leaf
          </span>
        )}
      </div>

      {/* Code */}
      <div
        style={{
          fontSize: 10,
          color: "var(--text-muted)",
          fontFamily: "monospace",
          marginBottom: 3,
        }}
      >
        {d.code}
      </div>

      {/* Name */}
      <div
        style={{
          fontSize: 13,
          fontWeight: 600,
          color: "var(--text-primary)",
          lineHeight: 1.3,
          marginBottom: 8,
        }}
      >
        {d.name}
      </div>

      {/* Item count health bar */}
      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
        <BookOpen size={11} color="var(--text-muted)" />
        {d.itemCounts ? (
          <>
            <div style={{ display: "flex", gap: 3, flex: 1 }}>
              <HealthPill count={d.itemCounts.easy}   color="#3fb950" label="D" />
              <HealthPill count={d.itemCounts.medium} color="#388bfd" label="TB" />
              <HealthPill count={d.itemCounts.hard}   color="#a371f7" label="K" />
            </div>
            {isWarning ? (
              <AlertTriangle size={12} color="var(--accent-yellow)" />
            ) : d.itemCounts.total >= 15 ? (
              <CheckCircle size={12} color="var(--accent-green)" />
            ) : null}
          </>
        ) : (
          <span style={{ fontSize: 11, color: "var(--text-muted)" }}>
            Chưa có câu hỏi
          </span>
        )}
      </div>

      {/* Bottom handle — outgoing edges (this KC is a prerequisite of something) */}
      <Handle
        type="source"
        position={Position.Bottom}
        style={{ background: borderColor, border: "none", width: 8, height: 8 }}
      />
    </div>
  );
}

function HealthPill({
  count,
  color,
  label,
}: {
  count: number;
  color: string;
  label: string;
}) {
  return (
    <div
      title={`${label}: ${count} câu`}
      style={{
        display: "flex",
        alignItems: "center",
        gap: 2,
        padding: "1px 5px",
        borderRadius: 4,
        background: `${color}18`,
        border: `1px solid ${color}30`,
        fontSize: 10,
        color,
        fontWeight: 600,
      }}
    >
      <span>{label}</span>
      <span style={{ opacity: 0.8 }}>{count}</span>
    </div>
  );
}

export default memo(KCNodeComponent);
