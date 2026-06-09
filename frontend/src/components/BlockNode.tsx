"use client";

import { memo, useState, useEffect } from "react";
import { NodeProps, NodeResizer } from "@xyflow/react";
import { Trash2 } from "lucide-react";

export interface BlockNodeData {
  id: string;
  name: string;
  onRename: (id: string, name: string) => void;
  onDelete: (id: string) => void;
  onResize?: (id: string, x: number, y: number, width: number, height: number) => void;
}

function BlockNodeComponent({ id, data, selected }: NodeProps) {
  const d = data as unknown as BlockNodeData;
  const [name, setName] = useState(d.name || "");

  useEffect(() => {
    setName(d.name || "");
  }, [d.name]);

  const handleBlur = () => {
    if (name.trim() !== d.name) {
      d.onRename(id, name.trim());
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      (e.target as HTMLInputElement).blur();
    }
  };

  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        background: "rgba(255, 255, 255, 0.03)",
        backdropFilter: "blur(6px)",
        WebkitBackdropFilter: "blur(6px)",
        border: selected
          ? "2px solid var(--accent-blue)"
          : "2px dashed rgba(255, 255, 255, 0.15)",
        borderRadius: 12,
        boxShadow: selected
          ? "0 0 0 4px rgba(56, 139, 253, 0.25), inset 0 0 20px rgba(255,255,255,0.02)"
          : "inset 0 0 20px rgba(255,255,255,0.01)",
        display: "flex",
        flexDirection: "column",
        padding: 12,
        boxSizing: "border-box",
        position: "relative",
        pointerEvents: "all",
      }}
    >
      <NodeResizer
        color="var(--accent-blue)"
        minWidth={200}
        minHeight={150}
        isVisible={!!selected}
        onResizeEnd={(event, params) => {
          d.onResize?.(id, params.x, params.y, params.width, params.height);
        }}
      />

      {/* Header with Edit Title & Delete Block */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          gap: 8,
          marginBottom: 8,
        }}
      >
        <input
          className="nodrag"
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          onBlur={handleBlur}
          onKeyDown={handleKeyDown}
          placeholder="Tên Block..."
          style={{
            background: "transparent",
            border: "none",
            outline: "none",
            color: "var(--text-primary)",
            fontSize: 14,
            fontWeight: 700,
            padding: "4px 8px",
            borderRadius: 4,
            width: "100%",
            transition: "background 0.2s",
          }}
          onFocus={(e) => {
            e.target.style.background = "rgba(255, 255, 255, 0.08)";
          }}
          onBlurCapture={(e) => {
            e.target.style.background = "transparent";
          }}
        />

        <button
          className="nodrag"
          onClick={() => d.onDelete(id)}
          title="Xoá Block"
          style={{
            background: "transparent",
            border: "none",
            color: "var(--text-muted)",
            cursor: "pointer",
            padding: 4,
            borderRadius: 4,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            transition: "all 0.2s",
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.color = "var(--accent-red)";
            e.currentTarget.style.background = "rgba(248, 81, 73, 0.1)";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.color = "var(--text-muted)";
            e.currentTarget.style.background = "transparent";
          }}
        >
          <Trash2 size={14} />
        </button>
      </div>

      {/* Inner Label indicating it is a block container */}
      <div
        style={{
          flex: 1,
          display: "flex",
          alignItems: "flex-end",
          justifyContent: "flex-end",
          fontSize: 10,
          color: "var(--text-muted)",
          fontFamily: "monospace",
          opacity: 0.5,
          userSelect: "none",
          pointerEvents: "none",
        }}
      >
        BLOCK CONTAINER
      </div>
    </div>
  );
}

export default memo(BlockNodeComponent);
