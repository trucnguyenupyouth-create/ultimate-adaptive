"use client";

import { useState, useCallback, useEffect } from "react";
import { X, Loader2 } from "lucide-react";
import { graphApi, itemApi, KCDetail, Item } from "@/lib/api";
import DetailsTab from "./panel/DetailsTab";
import QuestionsTab from "./panel/QuestionsTab";
import NotesTab from "./panel/NotesTab";
import { KCNodeData } from "./KCNode";

interface Props {
  nodeId: string | null;
  onClose: () => void;
  onKCUpdated: (id: string, data: Partial<KCNodeData>) => void;
  onKCDeleted: (id: string) => void;
}

type TabId = "details" | "questions" | "notes";

export default function KCDetailPanel({ nodeId, onClose, onKCUpdated, onKCDeleted }: Props) {
  const [detail, setDetail] = useState<KCDetail | null>(null);
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<TabId>("details");

  const loadDetail = useCallback(async (id: string) => {
    setLoading(true);
    try {
      const [d, its] = await Promise.all([
        graphApi.getKCDetail(id),
        itemApi.list(id),
      ]);
      setDetail(d);
      setItems(its);
    } catch {
      // ignore — panel stays loading
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (nodeId) {
      setActiveTab("details");
      setDetail(null);
      setItems([]);
      loadDetail(nodeId);
    }
  }, [nodeId, loadDetail]);

  const refreshItems = useCallback(async () => {
    if (!nodeId) return;
    const its = await itemApi.list(nodeId);
    setItems(its);
  }, [nodeId]);

  const refreshDetail = useCallback(async () => {
    if (!nodeId) return;
    const d = await graphApi.getKCDetail(nodeId);
    setDetail(d);
  }, [nodeId]);

  if (!nodeId) return null;

  const itemCounts = {
    total: items.length,
    easy: items.filter(i => i.difficulty_label === "easy").length,
    medium: items.filter(i => i.difficulty_label === "medium").length,
    hard: items.filter(i => i.difficulty_label === "hard").length,
  };

  const TABS: { id: TabId; label: string }[] = [
    { id: "details", label: "Chi tiết" },
    { id: "questions", label: `Câu hỏi (${itemCounts.total})` },
    { id: "notes", label: "Ghi chú" },
  ];

  return (
    <>
      {/* Backdrop (click to close) */}
      <div
        onClick={onClose}
        style={{
          position: "absolute",
          inset: 0,
          zIndex: 49,
          // no background — transparent so graph is visible
        }}
      />

      {/* Panel */}
      <div
        className="fade-in"
        style={{
          position: "absolute",
          top: 0,
          right: 0,
          bottom: 0,
          width: 420,
          zIndex: 50,
          background: "rgba(22,27,34,0.97)",
          backdropFilter: "blur(16px)",
          borderLeft: "1px solid var(--border)",
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
        }}
      >
        {/* ── Header ── */}
        <div
          style={{
            padding: "16px 20px 0",
            borderBottom: "1px solid var(--border)",
            flexShrink: 0,
          }}
        >
          <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 12 }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              {detail ? (
                <>
                  <div style={{ fontSize: 10, color: "var(--text-muted)", fontFamily: "monospace", marginBottom: 3 }}>
                    {detail.code}
                  </div>
                  <div style={{ fontSize: 15, fontWeight: 700, color: "var(--text-primary)", lineHeight: 1.3 }}>
                    {detail.name}
                  </div>
                </>
              ) : (
                <div style={{ height: 36, display: "flex", alignItems: "center" }}>
                  <Loader2 size={16} className="animate-spin" color="var(--text-muted)" />
                </div>
              )}
            </div>
            <button
              className="btn btn-ghost"
              onClick={onClose}
              style={{ padding: "4px 6px", marginLeft: 8, flexShrink: 0 }}
              title="Đóng"
            >
              <X size={16} />
            </button>
          </div>

          {/* Tab bar */}
          <div style={{ display: "flex", gap: 0 }}>
            {TABS.map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                style={{
                  padding: "8px 14px",
                  fontSize: 13,
                  fontWeight: activeTab === tab.id ? 600 : 400,
                  color: activeTab === tab.id ? "var(--text-primary)" : "var(--text-secondary)",
                  background: "transparent",
                  border: "none",
                  borderBottom: activeTab === tab.id
                    ? "2px solid var(--accent-blue)"
                    : "2px solid transparent",
                  cursor: "pointer",
                  transition: "all 0.15s ease",
                  whiteSpace: "nowrap",
                }}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {/* ── Tab content ── */}
        <div style={{ flex: 1, overflowY: "auto", padding: "20px" }}>
          {loading && !detail ? (
            <div style={{ display: "flex", justifyContent: "center", paddingTop: 40 }}>
              <Loader2 size={24} className="animate-spin" color="var(--text-muted)" />
            </div>
          ) : detail ? (
            <>
              {activeTab === "details" && (
                <DetailsTab
                  detail={detail}
                  onUpdated={(updated) => {
                    setDetail(prev => prev ? { ...prev, ...updated } : prev);
                    onKCUpdated(detail.id, { name: updated.name, grade: updated.grade, chapter_info: updated.chapter_info });
                  }}
                  onDeleted={() => onKCDeleted(detail.id)}
                  onPrereqRemoved={refreshDetail}
                />
              )}
              {activeTab === "questions" && (
                <QuestionsTab
                  kcId={detail.id}
                  items={items}
                  itemCounts={itemCounts}
                  onRefresh={refreshItems}
                />
              )}
              {activeTab === "notes" && (
                <NotesTab
                  kcId={detail.id}
                  initialNotes={detail.notes ?? ""}
                  onSaved={(notes) => setDetail(prev => prev ? { ...prev, notes } : prev)}
                />
              )}
            </>
          ) : null}
        </div>
      </div>
    </>
  );
}
