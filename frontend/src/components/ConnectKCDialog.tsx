"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { Search, ArrowRight, Loader2, X, Link2, ChevronLeft } from "lucide-react";
import { graphApi, EdgeType } from "@/lib/api";
import type { Node } from "@xyflow/react";
import type { KCNodeData } from "@/components/KCNode";

interface Props {
  nodes: Node[];
  onClose: () => void;
  onEdgeCreated: (
    prereqId: string,
    kcId: string,
    edgeType: EdgeType,
    label: string | null
  ) => void;
}

type Step = "pick-source" | "pick-target" | "confirm";

const EDGE_TYPE_OPTIONS: { type: EdgeType; label: string; icon: string; color: string; dash?: string }[] = [
  { type: "prerequisite", label: "Prerequisite", icon: "→", color: "var(--accent-blue)" },
  { type: "inference",    label: "Inference",    icon: "⚡", color: "#8b949e", dash: "8px 5px" },
  { type: "unsure",       label: "Unsure?",      icon: "❓", color: "#d29922" },
];

function NodeList({
  nodes,
  query,
  excludeId,
  highlightedIndex,
  onSelect,
  onHighlight,
}: {
  nodes: Node[];
  query: string;
  excludeId?: string;
  highlightedIndex: number;
  onSelect: (n: Node) => void;
  onHighlight: (i: number) => void;
}) {
  const listRef = useRef<HTMLDivElement>(null);
  const q = query.toLowerCase();
  const filtered = nodes
    .filter((n) => n.type === "kcNode" && n.id !== excludeId)
    .filter((n) => {
      const d = n.data as unknown as KCNodeData;
      return (
        (d.name?.toLowerCase().includes(q) ?? false) ||
        (d.code?.toLowerCase().includes(q) ?? false)
      );
    });

  // Scroll highlighted item into view
  useEffect(() => {
    const list = listRef.current;
    if (!list) return;
    const item = list.children[highlightedIndex] as HTMLElement | undefined;
    item?.scrollIntoView({ block: "nearest" });
  }, [highlightedIndex]);

  if (filtered.length === 0) {
    return (
      <div style={{ padding: "16px 0", textAlign: "center", fontSize: 12, color: "var(--text-muted)", fontStyle: "italic" }}>
        Không tìm thấy KC nào
      </div>
    );
  }

  return (
    <div ref={listRef} style={{ display: "flex", flexDirection: "column", gap: 2 }}>
      {filtered.map((n, i) => {
        const d = n.data as unknown as KCNodeData;
        const gradeColors: Record<number, string> = { 6: "#3fb950", 7: "#388bfd", 8: "#a371f7", 9: "#e05252" };
        const gradeColor = gradeColors[d.grade as number] ?? "#8b949e";
        const isHighlighted = i === highlightedIndex;
        return (
          <div
            key={n.id}
            onClick={() => onSelect(n)}
            onMouseEnter={() => onHighlight(i)}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
              padding: "8px 12px",
              borderRadius: 6,
              cursor: "pointer",
              background: isHighlighted ? "rgba(56,139,253,0.12)" : "transparent",
              border: isHighlighted ? "1px solid rgba(56,139,253,0.3)" : "1px solid transparent",
              transition: "all 0.1s ease",
            }}
          >
            {/* Grade dot */}
            <div style={{ width: 8, height: 8, borderRadius: "50%", background: gradeColor, flexShrink: 0 }} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <span style={{ fontSize: 10, fontFamily: "monospace", color: "var(--text-muted)", flexShrink: 0 }}>
                  {d.code}
                </span>
                {d.chapter_info && (
                  <span style={{ fontSize: 9, color: gradeColor, fontWeight: 600, flexShrink: 0 }}>
                    {d.chapter_info}
                  </span>
                )}
              </div>
              <div style={{ fontSize: 12, fontWeight: 600, color: "var(--text-primary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {d.name}
              </div>
            </div>
            {isHighlighted && (
              <span style={{ fontSize: 10, color: "var(--text-muted)", flexShrink: 0 }}>Enter ↵</span>
            )}
          </div>
        );
      })}
    </div>
  );
}

export default function ConnectKCDialog({ nodes, onClose, onEdgeCreated }: Props) {
  const [step, setStep] = useState<Step>("pick-source");
  const [sourceNode, setSourceNode] = useState<Node | null>(null);
  const [targetNode, setTargetNode] = useState<Node | null>(null);
  const [query, setQuery] = useState("");
  const [highlightedIndex, setHighlightedIndex] = useState(0);
  const [edgeType, setEdgeType] = useState<EdgeType>("prerequisite");
  const [label, setLabel] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const inputRef = useRef<HTMLInputElement>(null);

  // Focus search input on mount and on step change
  useEffect(() => {
    inputRef.current?.focus();
  }, [step]);

  // Reset highlighted when query changes
  useEffect(() => {
    setHighlightedIndex(0);
  }, [query]);

  // Get filtered list for keyboard navigation
  const getFilteredList = useCallback(() => {
    const q = query.toLowerCase();
    const excludeId = step === "pick-target" ? sourceNode?.id : undefined;
    return nodes
      .filter((n) => n.type === "kcNode" && n.id !== excludeId)
      .filter((n) => {
        const d = n.data as unknown as KCNodeData;
        return (
          (d.name?.toLowerCase().includes(q) ?? false) ||
          (d.code?.toLowerCase().includes(q) ?? false)
        );
      });
  }, [nodes, query, step, sourceNode]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (step === "confirm") return;
      const list = getFilteredList();
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setHighlightedIndex((i) => Math.min(i + 1, list.length - 1));
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setHighlightedIndex((i) => Math.max(i - 1, 0));
      } else if (e.key === "Enter") {
        e.preventDefault();
        const selected = list[highlightedIndex];
        if (selected) {
          if (step === "pick-source") {
            setSourceNode(selected);
            setQuery("");
            setHighlightedIndex(0);
            setStep("pick-target");
          } else if (step === "pick-target") {
            setTargetNode(selected);
            setQuery("");
            setStep("confirm");
          }
        }
      }
    },
    [step, getFilteredList, highlightedIndex]
  );

  const handleSelectSource = (n: Node) => {
    setSourceNode(n);
    setQuery("");
    setHighlightedIndex(0);
    setStep("pick-target");
  };

  const handleSelectTarget = (n: Node) => {
    setTargetNode(n);
    setQuery("");
    setStep("confirm");
  };

  const handleConnect = async () => {
    if (!sourceNode || !targetNode) return;
    setLoading(true);
    setError(null);
    try {
      const result = await graphApi.addPrerequisite(
        targetNode.id,
        sourceNode.id,
        label.trim() || null,
        1.0,
        edgeType
      );
      if (!result.ok) {
        setError(`⚠ ${result.detail ?? "Không thể tạo kết nối (có thể tạo vòng lặp)"}`);
        return;
      }
      onEdgeCreated(sourceNode.id, targetNode.id, edgeType, label.trim() || null);
      onClose();
    } catch (err: any) {
      setError(err.message || "Lỗi kết nối tới server.");
    } finally {
      setLoading(false);
    }
  };

  // Global Esc handler
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose]);

  const sourceData = sourceNode?.data as unknown as KCNodeData | undefined;
  const targetData = targetNode?.data as unknown as KCNodeData | undefined;

  const stepLabels: Record<Step, string> = {
    "pick-source": "Bước 1/3: Chọn KC Nguồn (Prerequisite)",
    "pick-target": "Bước 2/3: Chọn KC Đích (Successor)",
    "confirm": "Bước 3/3: Xác nhận kết nối",
  };

  return (
    <>
      {/* Backdrop */}
      <div
        onClick={onClose}
        style={{
          position: "fixed",
          inset: 0,
          background: "rgba(0,0,0,0.55)",
          backdropFilter: "blur(3px)",
          zIndex: 900,
        }}
      />

      {/* Dialog */}
      <div
        className="fade-in"
        style={{
          position: "fixed",
          top: "50%",
          left: "50%",
          transform: "translate(-50%, -50%)",
          zIndex: 901,
          width: 520,
          maxWidth: "calc(100vw - 32px)",
          background: "rgba(22,27,34,0.98)",
          border: "1px solid var(--border)",
          borderRadius: 12,
          boxShadow: "0 24px 80px rgba(0,0,0,0.7), 0 0 0 1px rgba(255,255,255,0.04)",
          display: "flex",
          flexDirection: "column",
          maxHeight: "85vh",
          overflow: "hidden",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* ── Header ── */}
        <div style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "14px 16px 12px",
          borderBottom: "1px solid var(--border)",
          flexShrink: 0,
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <div style={{
              width: 26, height: 26, borderRadius: 6,
              background: "linear-gradient(135deg, #388bfd, #a371f7)",
              display: "flex", alignItems: "center", justifyContent: "center",
            }}>
              <Link2 size={13} color="#fff" />
            </div>
            <div>
              <div style={{ fontSize: 13, fontWeight: 700, color: "var(--text-primary)", lineHeight: 1 }}>
                Kết nối KC
              </div>
              <div style={{ fontSize: 10, color: "var(--text-muted)", lineHeight: 1, marginTop: 2 }}>
                {stepLabels[step]}
              </div>
            </div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ fontSize: 10, color: "var(--text-muted)", background: "var(--bg-elevated)", padding: "2px 6px", borderRadius: 4, border: "1px solid var(--border)" }}>
              Esc
            </span>
            <button className="btn btn-ghost" onClick={onClose} style={{ padding: "3px 5px" }}>
              <X size={14} />
            </button>
          </div>
        </div>

        {/* ── Progress bar ── */}
        <div style={{ height: 2, background: "var(--border)", flexShrink: 0 }}>
          <div style={{
            height: "100%",
            background: "linear-gradient(90deg, #388bfd, #a371f7)",
            width: step === "pick-source" ? "33%" : step === "pick-target" ? "66%" : "100%",
            transition: "width 0.3s ease",
          }} />
        </div>

        {/* ── Source breadcrumb (steps 2 & 3) ── */}
        {sourceNode && step !== "pick-source" && (
          <div style={{
            padding: "8px 16px",
            borderBottom: "1px solid var(--border-subtle)",
            display: "flex",
            alignItems: "center",
            gap: 6,
            flexShrink: 0,
            background: "rgba(56,139,253,0.06)",
          }}>
            <div style={{ width: 6, height: 6, borderRadius: "50%", background: "var(--accent-blue)" }} />
            <span style={{ fontSize: 11, color: "var(--text-muted)" }}>Nguồn:</span>
            <span style={{ fontSize: 11, fontFamily: "monospace", color: "var(--accent-blue)", fontWeight: 700 }}>
              {sourceData?.code}
            </span>
            <span style={{ fontSize: 11, color: "var(--text-secondary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {sourceData?.name}
            </span>
            {step === "pick-target" && (
              <button
                onClick={() => { setSourceNode(null); setQuery(""); setStep("pick-source"); }}
                style={{ marginLeft: "auto", background: "none", border: "none", cursor: "pointer", color: "var(--text-muted)", fontSize: 10, display: "flex", alignItems: "center", gap: 3 }}
              >
                <ChevronLeft size={11} /> Đổi
              </button>
            )}
          </div>
        )}

        {/* ── Step content ── */}
        <div style={{ flex: 1, overflow: "hidden", display: "flex", flexDirection: "column" }}>

          {/* STEP 1 & 2: pick nodes */}
          {(step === "pick-source" || step === "pick-target") && (
            <>
              {/* Search input */}
              <div style={{ padding: "10px 12px", borderBottom: "1px solid var(--border-subtle)", flexShrink: 0 }}>
                <div style={{ position: "relative" }}>
                  <Search size={13} color="var(--text-muted)" style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", pointerEvents: "none" }} />
                  <input
                    ref={inputRef}
                    className="input"
                    placeholder={step === "pick-source" ? "Tìm KC Nguồn (tên hoặc mã)..." : "Tìm KC Đích (tên hoặc mã)..."}
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    onKeyDown={handleKeyDown}
                    style={{ paddingLeft: 32, background: "var(--bg-base)", fontSize: 13 }}
                    autoComplete="off"
                  />
                </div>
              </div>

              {/* Node list */}
              <div style={{ flex: 1, overflowY: "auto", padding: "6px 8px" }}>
                <NodeList
                  nodes={nodes}
                  query={query}
                  excludeId={step === "pick-target" ? sourceNode?.id : undefined}
                  highlightedIndex={highlightedIndex}
                  onSelect={step === "pick-source" ? handleSelectSource : handleSelectTarget}
                  onHighlight={setHighlightedIndex}
                />
              </div>
            </>
          )}

          {/* STEP 3: confirm */}
          {step === "confirm" && sourceNode && targetNode && (
            <div style={{ padding: 20, display: "flex", flexDirection: "column", gap: 20, overflowY: "auto" }}>

              {/* Arrow diagram */}
              <div style={{
                background: "rgba(255,255,255,0.02)",
                border: "1px solid var(--border)",
                borderRadius: 10,
                padding: "16px",
                display: "flex",
                alignItems: "center",
                gap: 12,
              }}>
                {/* Source */}
                <div style={{ flex: 1, minWidth: 0, textAlign: "center" }}>
                  <div style={{ fontSize: 11, fontFamily: "monospace", color: "var(--accent-blue)", fontWeight: 700, background: "rgba(56,139,253,0.1)", padding: "3px 8px", borderRadius: 4, display: "inline-block", marginBottom: 4 }}>
                    {sourceData?.code}
                  </div>
                  <div style={{ fontSize: 11, color: "var(--text-secondary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={sourceData?.name}>
                    {sourceData?.name}
                  </div>
                </div>

                {/* Arrow */}
                <div style={{ flexShrink: 0, display: "flex", flexDirection: "column", alignItems: "center", gap: 2 }}>
                  <ArrowRight size={20} color={EDGE_TYPE_OPTIONS.find(o => o.type === edgeType)?.color ?? "var(--accent-blue)"} />
                  <span style={{ fontSize: 8, color: "var(--text-muted)" }}>prerequisite of</span>
                </div>

                {/* Target */}
                <div style={{ flex: 1, minWidth: 0, textAlign: "center" }}>
                  <div style={{ fontSize: 11, fontFamily: "monospace", color: "var(--accent-green)", fontWeight: 700, background: "rgba(63,185,80,0.1)", padding: "3px 8px", borderRadius: 4, display: "inline-block", marginBottom: 4 }}>
                    {targetData?.code}
                  </div>
                  <div style={{ fontSize: 11, color: "var(--text-secondary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={targetData?.name}>
                    {targetData?.name}
                  </div>
                </div>
              </div>

              {/* Edge type selector */}
              <div>
                <div style={{ fontSize: 11, fontWeight: 600, color: "var(--text-muted)", marginBottom: 8, textTransform: "uppercase", letterSpacing: "0.06em" }}>
                  Loại kết nối
                </div>
                <div style={{ display: "flex", gap: 8 }}>
                  {EDGE_TYPE_OPTIONS.map((opt) => {
                    const isActive = edgeType === opt.type;
                    return (
                      <button
                        key={opt.type}
                        onClick={() => setEdgeType(opt.type)}
                        style={{
                          flex: 1,
                          padding: "8px 10px",
                          borderRadius: 8,
                          border: `1.5px solid ${isActive ? opt.color : "var(--border)"}`,
                          background: isActive ? `${opt.color}18` : "var(--bg-elevated)",
                          color: isActive ? opt.color : "var(--text-secondary)",
                          cursor: "pointer",
                          fontSize: 11,
                          fontWeight: isActive ? 700 : 400,
                          display: "flex",
                          flexDirection: "column",
                          alignItems: "center",
                          gap: 4,
                          transition: "all 0.15s",
                        }}
                      >
                        {/* Mini line preview */}
                        <svg width={32} height={10}>
                          <line
                            x1={0} y1={5} x2={32} y2={5}
                            stroke={isActive ? opt.color : "var(--text-muted)"}
                            strokeWidth={2}
                            strokeDasharray={opt.dash}
                          />
                          <polygon
                            points="28,2 32,5 28,8"
                            fill={isActive ? opt.color : "var(--text-muted)"}
                          />
                        </svg>
                        <span>{opt.icon} {opt.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Label input */}
              <div>
                <div style={{ fontSize: 11, fontWeight: 600, color: "var(--text-muted)", marginBottom: 6, textTransform: "uppercase", letterSpacing: "0.06em" }}>
                  Chú thích <span style={{ fontWeight: 400, textTransform: "none" }}>(tuỳ chọn)</span>
                </div>
                <input
                  className="input"
                  placeholder="Ví dụ: Chỉ áp dụng cho lớp nâng cao..."
                  value={label}
                  onChange={(e) => setLabel(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter" && !loading) handleConnect(); }}
                  style={{ background: "rgba(0,0,0,0.2)" }}
                />
              </div>

              {/* Error */}
              {error && (
                <div style={{
                  background: "rgba(248,81,73,0.1)",
                  border: "1px solid rgba(248,81,73,0.3)",
                  color: "var(--accent-red)",
                  padding: "10px 14px",
                  borderRadius: 6,
                  fontSize: 12,
                }}>
                  {error}
                </div>
              )}

              {/* Actions */}
              <div style={{ display: "flex", gap: 10 }}>
                <button
                  className="btn btn-secondary"
                  onClick={() => { setTargetNode(null); setStep("pick-target"); setError(null); }}
                  style={{ gap: 6 }}
                >
                  <ChevronLeft size={14} /> Quay lại
                </button>
                <button
                  className="btn btn-primary"
                  onClick={handleConnect}
                  disabled={loading}
                  style={{ flex: 1, justifyContent: "center", gap: 6, fontWeight: 700 }}
                >
                  {loading ? (
                    <Loader2 size={14} className="animate-spin" />
                  ) : (
                    <Link2 size={14} />
                  )}
                  {loading ? "Đang kết nối..." : "Kết nối"}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
