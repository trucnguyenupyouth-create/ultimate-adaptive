import { EdgeLabelRenderer, getSmoothStepPath, type EdgeProps } from "@xyflow/react";

export type EdgeType = "prerequisite" | "inference" | "unsure";

export default function CustomEdge({
  id,
  sourceX,
  sourceY,
  sourcePosition,
  targetX,
  targetY,
  targetPosition,
  style = {},
  markerEnd,
  selected,
  data,
}: EdgeProps) {
  const [edgePath, labelX, labelY] = getSmoothStepPath({
    sourceX,
    sourceY,
    sourcePosition,
    targetX,
    targetY,
    targetPosition,
  });

  const edgeData = data as { label?: string | null; isCycle?: boolean; edge_type?: EdgeType } | undefined;
  const isCycle = edgeData?.isCycle;
  const label = edgeData?.label;
  const edgeType: EdgeType = edgeData?.edge_type ?? "prerequisite";

  // ── Visual style by edge type ──────────────────────────────────
  let edgeColor: string;
  let strokeDasharray: string | undefined;

  if (isCycle) {
    edgeColor = "var(--accent-red)";
    strokeDasharray = "6 3";
  } else if (edgeType === "inference") {
    edgeColor = selected ? "#79c0ff" : "#8b949e";
    strokeDasharray = "8 5";
  } else if (edgeType === "unsure") {
    edgeColor = selected ? "#f0c040" : "#d29922";
    strokeDasharray = undefined;
  } else {
    // "prerequisite" — default solid
    edgeColor = selected ? "var(--accent-blue)" : "var(--edge-default)";
    strokeDasharray = undefined;
  }

  const edgeWidth = selected ? 3 : 2;

  // Badge for non-default types
  const typeBadge =
    edgeType === "inference"
      ? "⚡ Inference"
      : edgeType === "unsure"
      ? "❓ Unsure"
      : null;

  return (
    <>
      {/* Invisible thick hit area */}
      <path
        d={edgePath}
        fill="none"
        stroke="transparent"
        strokeWidth={15}
        style={{ cursor: "pointer" }}
        className="react-flow__edge-interaction"
      />
      {/* Visible line */}
      <path
        id={id}
        d={edgePath}
        fill="none"
        stroke={edgeColor}
        strokeWidth={edgeWidth}
        strokeDasharray={strokeDasharray}
        markerEnd={markerEnd}
        className="react-flow__edge-path"
        style={{
          transition: "stroke 0.15s, stroke-width 0.15s",
          ...style,
        }}
      />
      {/* Labels */}
      {(label || (selected && typeBadge)) && (
        <EdgeLabelRenderer>
          <div
            style={{
              position: "absolute",
              transform: `translate(-50%, -50%) translate(${labelX}px,${labelY}px)`,
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: "3px",
              pointerEvents: "all",
              cursor: "pointer",
            }}
          >
            {/* Type badge — only when selected and non-default type */}
            {selected && typeBadge && (
              <div
                style={{
                  background:
                    edgeType === "inference"
                      ? "rgba(130,180,255,0.15)"
                      : "rgba(210,153,34,0.15)",
                  border: `1px solid ${edgeColor}`,
                  backdropFilter: "blur(6px)",
                  padding: "2px 7px",
                  borderRadius: "8px",
                  fontSize: "9px",
                  fontWeight: 600,
                  color: edgeColor,
                  whiteSpace: "nowrap",
                  letterSpacing: "0.03em",
                }}
              >
                {typeBadge}
              </div>
            )}
            {/* Annotation label chip */}
            {label && (
              <div
                style={{
                  background: "rgba(22, 27, 34, 0.85)",
                  border: selected ? `1px solid ${edgeColor}` : "1px solid var(--border)",
                  backdropFilter: "blur(6px)",
                  padding: "3px 8px",
                  borderRadius: "10px",
                  fontSize: "10px",
                  fontWeight: 500,
                  color: selected ? "var(--text-primary)" : "var(--text-secondary)",
                  whiteSpace: "nowrap",
                  boxShadow: "0 2px 8px rgba(0, 0, 0, 0.5)",
                  display: "flex",
                  alignItems: "center",
                  gap: "4px",
                  maxWidth: "140px",
                  textOverflow: "ellipsis",
                  overflow: "hidden",
                  transition: "border-color 0.15s",
                }}
                title={label}
              >
                <span>💬</span>
                <span style={{ overflow: "hidden", textOverflow: "ellipsis" }}>{label}</span>
              </div>
            )}
          </div>
        </EdgeLabelRenderer>
      )}
    </>
  );
}
