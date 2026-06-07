import { EdgeLabelRenderer, getSmoothStepPath, type EdgeProps } from "@xyflow/react";

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

  const edgeData = data as { label?: string | null; isCycle?: boolean } | undefined;
  const isCycle = edgeData?.isCycle;
  const label = edgeData?.label;

  // Determine edge color and width
  const edgeColor = isCycle
    ? "var(--accent-red)"
    : selected
    ? "var(--accent-blue)"
    : "var(--edge-default)";

  const edgeWidth = selected ? 3 : 2;
  const strokeDasharray = isCycle ? "6 3" : undefined;

  return (
    <>
      {/* Invisible thick line to make clicking the edge easier */}
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
      {/* Render annotation label chip if exists */}
      {label && (
        <EdgeLabelRenderer>
          <div
            style={{
              position: "absolute",
              transform: `translate(-50%, -50%) translate(${labelX}px,${labelY}px)`,
              background: "rgba(22, 27, 34, 0.85)",
              border: selected ? "1px solid var(--accent-blue)" : "1px solid var(--border)",
              backdropFilter: "blur(6px)",
              padding: "3px 8px",
              borderRadius: "10px",
              fontSize: "10px",
              fontWeight: 500,
              color: selected ? "var(--text-primary)" : "var(--text-secondary)",
              pointerEvents: "all",
              cursor: "pointer",
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
        </EdgeLabelRenderer>
      )}
    </>
  );
}
