"use client";

import { GraphHealth } from "@/lib/api";
import {
  CheckCircle2,
  AlertTriangle,
  XCircle,
  GitBranch,
  Layers,
  Link2,
  BookOpen,
} from "lucide-react";

interface Props {
  health: GraphHealth | null;
  loading: boolean;
}

export default function HealthPanel({ health, loading }: Props) {
  if (loading) {
    return (
      <div className="glass" style={{ padding: "12px 16px", borderRadius: 10, minWidth: 200 }}>
        <div style={{ fontSize: 12, color: "var(--text-muted)" }}>Đang tải health...</div>
      </div>
    );
  }
  if (!health) return null;

  const hasIssues = !health.is_dag || health.isolated_kcs.length > 0 || health.low_item_kcs.length > 0;

  return (
    <div
      className="glass slide-in"
      style={{ padding: "12px 16px", borderRadius: 10, minWidth: 240, maxWidth: 280 }}
    >
      {/* Status row */}
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
        {health.is_dag ? (
          <CheckCircle2 size={16} color="var(--accent-green)" />
        ) : (
          <XCircle size={16} color="var(--accent-red)" />
        )}
        <span style={{ fontSize: 13, fontWeight: 600, color: health.is_dag ? "var(--accent-green)" : "var(--accent-red)" }}>
          {health.is_dag ? "Graph hợp lệ" : "⚠ CÓ VÒNG LẶP!"}
        </span>
      </div>

      {/* Stats */}
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        <StatRow icon={<Layers size={13} />} label="Tổng KCs" value={health.total_kcs} />
        <StatRow icon={<Link2 size={13} />} label="Connections" value={health.total_edges} />
        <StatRow icon={<GitBranch size={13} />} label="Root KCs" value={health.root_kcs.length} color="var(--accent-green)" />
        <StatRow icon={<GitBranch size={13} style={{ transform: "rotate(180deg)" }} />} label="Leaf KCs" value={health.leaf_kcs.length} color="var(--accent-purple)" />
      </div>

      {/* Warnings */}
      {hasIssues && <div className="divider" />}

      {health.isolated_kcs.length > 0 && (
        <Warning
          icon={<AlertTriangle size={12} color="var(--accent-yellow)" />}
          text={`${health.isolated_kcs.length} KC chưa có connection`}
          color="var(--accent-yellow)"
        />
      )}

      {health.low_item_kcs.length > 0 && (
        <Warning
          icon={<BookOpen size={12} color="var(--accent-yellow)" />}
          text={`${health.low_item_kcs.length} KC có ít hơn 10 câu hỏi`}
          color="var(--accent-yellow)"
        />
      )}

      {!health.is_dag && (
        <Warning
          icon={<XCircle size={12} color="var(--accent-red)" />}
          text="Graph có vòng lặp — KST navigation sẽ bị kẹt!"
          color="var(--accent-red)"
        />
      )}
    </div>
  );
}

function StatRow({
  icon,
  label,
  value,
  color = "var(--text-primary)",
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
  color?: string;
}) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
      <span style={{ color: "var(--text-muted)" }}>{icon}</span>
      <span style={{ fontSize: 12, color: "var(--text-secondary)", flex: 1 }}>{label}</span>
      <span style={{ fontSize: 13, fontWeight: 600, color }}>{value}</span>
    </div>
  );
}

function Warning({ icon, text, color }: { icon: React.ReactNode; text: string; color: string }) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "flex-start",
        gap: 6,
        padding: "6px 8px",
        background: `${color}12`,
        border: `1px solid ${color}30`,
        borderRadius: 6,
        marginBottom: 4,
        fontSize: 11,
        color,
        lineHeight: 1.4,
      }}
    >
      <span style={{ marginTop: 1, flexShrink: 0 }}>{icon}</span>
      <span>{text}</span>
    </div>
  );
}
