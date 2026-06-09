"use client";

import { useCallback, useRef, useState } from "react";
import { NodeResizer, type NodeProps } from "@xyflow/react";
import { graphApi } from "@/lib/api";

export interface NoteNodeData {
  content: string;
  color: string;
  onDelete?: (id: string) => void;
  onContentSave?: (id: string, content: string) => void;
}

export default function NoteNode({ id, data, selected }: NodeProps) {
  const nodeData = data as unknown as NoteNodeData;
  const [content, setContent] = useState(nodeData.content ?? "");
  const [saving, setSaving] = useState(false);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Auto-save with 600ms debounce
  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      const val = e.target.value;
      setContent(val);
      if (saveTimer.current) clearTimeout(saveTimer.current);
      saveTimer.current = setTimeout(async () => {
        setSaving(true);
        try {
          await graphApi.updateNote(id, { content: val });
          nodeData.onContentSave?.(id, val);
        } catch (err) {
          console.error("Note save failed:", err);
        } finally {
          setSaving(false);
        }
      }, 600);
    },
    [id, nodeData]
  );

  const handleDelete = useCallback(() => {
    nodeData.onDelete?.(id);
  }, [id, nodeData]);

  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        background: "linear-gradient(145deg, #fffde7 0%, #fff9c4 100%)",
        border: selected
          ? "2px solid #f0c040"
          : "1.5px solid #e8d44d",
        borderRadius: "6px",
        boxShadow: selected
          ? "0 4px 20px rgba(240,192,64,0.35), 0 2px 8px rgba(0,0,0,0.25)"
          : "3px 4px 12px rgba(0,0,0,0.22), 1px 1px 0 rgba(255,255,255,0.6) inset",
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
        transition: "box-shadow 0.15s, border-color 0.15s",
        fontFamily: "'Segoe UI', system-ui, sans-serif",
      }}
    >
      {/* NodeResizer for resize handle */}
      <NodeResizer
        minWidth={120}
        minHeight={80}
        isVisible={selected}
        lineStyle={{ border: "1.5px solid #f0c040" }}
        handleStyle={{ width: 8, height: 8, background: "#f0c040", border: "none", borderRadius: 2 }}
      />

      {/* Header bar */}
      <div
        style={{
          background: "linear-gradient(90deg, #ffe082, #ffd54f)",
          padding: "4px 8px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          borderBottom: "1px solid #e8d44d",
          flexShrink: 0,
          cursor: "grab",
        }}
        className="nodrag-header"
      >
        <span style={{ fontSize: "11px", fontWeight: 700, color: "#795548", letterSpacing: "0.04em", userSelect: "none" }}>
          📝 Ghi chú
        </span>
        <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
          {saving && (
            <span style={{ fontSize: "9px", color: "#9e8620", fontStyle: "italic" }}>đang lưu…</span>
          )}
          <button
            onClick={handleDelete}
            title="Xoá ghi chú"
            className="nodrag"
            style={{
              background: "none",
              border: "none",
              cursor: "pointer",
              padding: "1px 3px",
              borderRadius: "3px",
              color: "#a0522d",
              fontSize: "13px",
              lineHeight: 1,
              transition: "background 0.12s",
            }}
            onMouseEnter={(e) => (e.currentTarget.style.background = "rgba(0,0,0,0.12)")}
            onMouseLeave={(e) => (e.currentTarget.style.background = "none")}
          >
            ×
          </button>
        </div>
      </div>

      {/* Text area */}
      <textarea
        value={content}
        onChange={handleChange}
        placeholder="Nhập ghi chú tại đây…"
        className="nodrag"
        style={{
          flex: 1,
          resize: "none",
          border: "none",
          outline: "none",
          background: "transparent",
          padding: "8px 10px",
          fontSize: "12.5px",
          lineHeight: 1.55,
          color: "#3e2723",
          fontFamily: "inherit",
          overflowY: "auto",
        }}
      />
    </div>
  );
}
