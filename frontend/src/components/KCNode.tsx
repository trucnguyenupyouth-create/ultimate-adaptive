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
  chapter_info?: string;
  itemCounts?: { total: number; easy: number; medium: number; hard: number };
  isRoot?: boolean;
  isLeaf?: boolean;
  isLowItems?: boolean;
  isSelected?: boolean;
  block_id?: string | null;
  blockName?: string | null;
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
        minWidth: 180,
        maxWidth: 220,
        boxShadow: selected
          ? `0 0 0 3px rgba(88,166,255,0.25)`
          : "0 2px 8px rgba(0,0,0,0.4)",
        transition: "all 0.15s ease",
        animation: "fadeIn 0.2s ease",
        userSelect: "none",
      }}
    >
      {/* Top handle — target (incoming edges) */}
      <Handle
        type="target"
        position={Position.Top}
        style={{
          background: borderColor,
          border: "2px solid #0d1117",
          width: 12,
          height: 12,
          top: -6,
        }}
        isConnectable={true}
      />

      {/* Drag handle area — ONLY this region moves the node */}
      <div
        className="node-drag-handle"
        style={{
          cursor: "grab",
          padding: "10px 14px 6px",
        }}
      >
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
          {d.blockName && (
            <span
              className="badge"
              style={{
                background: "rgba(56, 139, 253, 0.15)",
                color: "var(--accent-blue)",
                border: "1px solid rgba(56, 139, 253, 0.3)",
                fontSize: 10,
                maxWidth: 80,
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}
              title={`Block: ${d.blockName}`}
            >
              {d.blockName}
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
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <span>{d.code}</span>
          {d.chapter_info && (
            <span style={{ color: "var(--accent-blue)", fontWeight: 600, fontSize: 9 }}>
              {d.chapter_info}
            </span>
          )}
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
      </div>

      {/* Item count health bar — NOT a drag handle so clicks work */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 6,
          padding: "0 14px 10px",
          cursor: "default",
        }}
      >
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

      {/* Bottom handle — source (outgoing edges) */}
      <Handle
        type="source"
        position={Position.Bottom}
        style={{
          background: borderColor,
          border: "2px solid #0d1117",
          width: 12,
          height: 12,
          bottom: -6,
        }}
        isConnectable={true}
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
