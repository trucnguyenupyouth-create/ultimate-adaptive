"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  approveDraft,
  bulkApprove,
  flagDraft,
  getDrafts,
  getSgkContent,
  getStatus,
  rejectDraft,
  revertDraft,
  runGeneration,
  updateDraft,
} from "@/lib/question-gen-api";
import type {
  CostSummary,
  ItemDraft,
  KCStats,
  MCQAnswer,
  MCQContent,
  SgkResponse,
  StatusResponse,
} from "@/lib/question-gen-api";


// ─────────────────────────────────────────────────────────────────────────────
// Styles (inline CSS-in-JS to keep single file — no Tailwind dependency)
// ─────────────────────────────────────────────────────────────────────────────

const CSS = `
  @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap');

  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

  :root {
    --bg: #0f1117;
    --surface: #1a1d27;
    --surface2: #22263a;
    --surface3: #2a2f47;
    --border: #2e3350;
    --text: #e8eaf6;
    --text-muted: #8892b0;
    --text-dim: #495670;
    --accent: #7c6af7;
    --accent-light: #9d8fff;
    --green: #22c55e;
    --green-bg: #052e16;
    --red: #ef4444;
    --red-bg: #2d0a0a;
    --yellow: #f59e0b;
    --yellow-bg: #1c1200;
    --blue: #3b82f6;
    --blue-bg: #0c1833;
    --easy: #22c55e;
    --medium: #f59e0b;
    --hard: #ef4444;
  }

  html, body { height: 100%; font-family: 'Inter', sans-serif; background: var(--bg); color: var(--text); font-size: 14px; }

  /* Layout */
  .layout { display: grid; grid-template-rows: auto 1fr; height: 100vh; overflow: hidden; }
  .header { background: var(--surface); border-bottom: 1px solid var(--border); padding: 0 24px; display: flex; align-items: center; gap: 16px; height: 56px; flex-shrink: 0; }
  .header h1 { font-size: 16px; font-weight: 700; color: var(--accent-light); white-space: nowrap; }
  .main-area { display: grid; grid-template-columns: 300px 1fr; overflow: hidden; }

  /* Sidebar */
  .sidebar { border-right: 1px solid var(--border); display: flex; flex-direction: column; overflow: hidden; background: var(--surface); }
  .sidebar-header { padding: 16px; border-bottom: 1px solid var(--border); flex-shrink: 0; }
  .sidebar-header h2 { font-size: 12px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.08em; color: var(--text-muted); margin-bottom: 8px; }
  .sidebar-scroll { overflow-y: auto; flex: 1; }
  .kc-item { padding: 10px 16px; cursor: pointer; border-bottom: 1px solid var(--border); transition: background 0.15s; display: flex; align-items: center; gap: 10px; }
  .kc-item:hover { background: var(--surface2); }
  .kc-item.active { background: var(--surface3); border-left: 3px solid var(--accent); padding-left: 13px; }
  .kc-item-info { flex: 1; min-width: 0; }
  .kc-item-name { font-size: 13px; font-weight: 500; color: var(--text); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .kc-item-code { font-size: 11px; color: var(--text-muted); font-family: 'JetBrains Mono', monospace; margin-top: 2px; }
  .kc-badge { display: flex; gap: 4px; flex-shrink: 0; }
  .badge { font-size: 10px; font-weight: 600; border-radius: 4px; padding: 2px 5px; white-space: nowrap; }
  .badge-green { background: var(--green-bg); color: var(--green); }
  .badge-yellow { background: var(--yellow-bg); color: var(--yellow); }
  .badge-red { background: var(--red-bg); color: var(--red); }
  .badge-purple { background: #1a1240; color: var(--accent-light); }
  .badge-blue { background: var(--blue-bg); color: var(--blue); }
  .badge-gray { background: var(--surface3); color: var(--text-muted); }

  /* Content panel */
  .content { display: flex; flex-direction: column; overflow: hidden; }
  .content-header { padding: 16px 24px; border-bottom: 1px solid var(--border); flex-shrink: 0; background: var(--surface); display: flex; align-items: center; gap: 12px; flex-wrap: wrap; }
  .content-scroll { flex: 1; overflow-y: auto; padding: 24px; display: flex; flex-direction: column; gap: 16px; align-items: stretch; }

  /* Stats bar */
  .stats-bar { display: flex; gap: 8px; align-items: center; flex-wrap: wrap; }
  .stat-chip { display: flex; align-items: center; gap: 6px; background: var(--surface2); border: 1px solid var(--border); border-radius: 8px; padding: 6px 12px; font-size: 12px; }
  .stat-chip strong { font-size: 16px; font-weight: 700; }

  /* Control bar */
  .control-bar { display: flex; gap: 8px; align-items: center; margin-left: auto; flex-wrap: wrap; }

  /* Buttons */
  button { cursor: pointer; border: none; font-family: inherit; font-size: 13px; font-weight: 500; border-radius: 8px; padding: 8px 14px; transition: all 0.15s; display: inline-flex; align-items: center; gap: 6px; }
  button:disabled { opacity: 0.45; cursor: not-allowed; }
  .btn-primary { background: var(--accent); color: white; }
  .btn-primary:hover:not(:disabled) { background: var(--accent-light); }
  .btn-success { background: #15803d; color: white; }
  .btn-success:hover:not(:disabled) { background: var(--green); }
  .btn-danger { background: #991b1b; color: white; }
  .btn-danger:hover:not(:disabled) { background: var(--red); }
  .btn-ghost { background: transparent; color: var(--text-muted); border: 1px solid var(--border); }
  .btn-ghost:hover:not(:disabled) { background: var(--surface2); color: var(--text); }
  .btn-sm { padding: 5px 10px; font-size: 12px; border-radius: 6px; }
  .btn-icon { padding: 6px; border-radius: 6px; }

  /* Question Card */
  .q-card { background: var(--surface); border: 1px solid var(--border); border-radius: 12px; overflow: hidden; transition: border-color 0.2s; flex-shrink: 0; }
  .q-card.approved { border-color: #15803d; background: #051209; }
  .q-card.rejected { border-color: #7f1d1d; background: #120505; opacity: 0.7; }
  .q-card.editing { border-color: var(--accent); box-shadow: 0 0 0 2px rgba(124,106,247,0.15); }
  .q-card-header { display: flex; align-items: center; gap: 10px; padding: 12px 16px; border-bottom: 1px solid var(--border); background: var(--surface2); flex-wrap: wrap; }
  .q-card-body { padding: 16px; display: block; min-height: 40px; }
  .q-card-footer { padding: 10px 16px; border-top: 1px solid var(--border); display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }

  /* Question text */
  .q-text { font-size: 14px; line-height: 1.6; color: var(--text); margin-bottom: 14px; }
  .q-text textarea { width: 100%; background: var(--surface3); border: 1px solid var(--accent); border-radius: 6px; color: var(--text); padding: 10px 12px; font-family: inherit; font-size: 14px; line-height: 1.6; resize: vertical; min-height: 80px; outline: none; }

  /* Answer choices */
  .answers { display: flex; flex-direction: column; gap: 8px; }
  .answer-row { display: flex; align-items: flex-start; gap: 10px; padding: 8px 12px; border-radius: 8px; border: 1px solid var(--border); background: var(--surface2); transition: border-color 0.15s; }
  .answer-row.correct { border-color: var(--green); background: var(--green-bg); }
  .answer-row.editing-answer { border-color: var(--accent); background: var(--surface3); }
  .answer-label { font-weight: 700; font-size: 13px; color: var(--accent-light); width: 18px; flex-shrink: 0; padding-top: 1px; }
  .answer-text { flex: 1; font-size: 13px; line-height: 1.5; color: var(--text); }
  .answer-text input { width: 100%; background: transparent; border: none; color: var(--text); font-family: inherit; font-size: 13px; outline: none; }
  .correct-check { width: 16px; height: 16px; border-radius: 50%; background: var(--green); flex-shrink: 0; display: flex; align-items: center; justify-content: center; font-size: 10px; }

  /* KST tag */
  .kst-toggle { cursor: pointer; color: var(--text-muted); font-size: 11px; display: flex; align-items: center; gap: 4px; padding: 4px 0; user-select: none; }
  .kst-toggle:hover { color: var(--text); }
  .kst-box { background: var(--surface3); border: 1px solid var(--border); border-radius: 8px; padding: 10px 12px; font-size: 12px; line-height: 1.6; color: var(--text-muted); margin-top: 8px; font-style: italic; }

  /* Progress bar */
  .progress-outer { height: 4px; background: var(--surface3); border-radius: 2px; overflow: hidden; width: 200px; }
  .progress-inner { height: 100%; background: var(--accent); border-radius: 2px; transition: width 0.3s; }

  /* Empty / loading states */
  .empty { display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 80px 20px; gap: 12px; color: var(--text-muted); text-align: center; }
  .empty-icon { font-size: 48px; }
  .spinner { width: 20px; height: 20px; border: 2px solid var(--border); border-top-color: var(--accent); border-radius: 50%; animation: spin 0.6s linear infinite; }
  @keyframes spin { to { transform: rotate(360deg); } }

  /* Toast */
  .toast-container { position: fixed; bottom: 24px; right: 24px; display: flex; flex-direction: column; gap: 8px; z-index: 9999; pointer-events: none; }
  .toast { background: var(--surface2); border: 1px solid var(--border); border-radius: 10px; padding: 12px 16px; font-size: 13px; max-width: 340px; animation: slideIn 0.2s ease; pointer-events: all; display: flex; align-items: center; gap: 8px; }
  .toast-success { border-color: #15803d; }
  .toast-error { border-color: #991b1b; }
  @keyframes slideIn { from { opacity: 0; transform: translateY(12px); } to { opacity: 1; transform: translateY(0); } }

  /* Filter tabs */
  .filter-tabs { display: flex; gap: 4px; background: var(--surface2); border-radius: 8px; padding: 3px; }
  .filter-tab { padding: 5px 12px; border-radius: 6px; font-size: 12px; font-weight: 500; color: var(--text-muted); cursor: pointer; border: none; background: transparent; transition: all 0.15s; }
  .filter-tab.active { background: var(--surface3); color: var(--text); }

  /* Difficulty pill */
  .diff-pill { font-size: 11px; font-weight: 600; border-radius: 999px; padding: 2px 8px; }
  .diff-easy { background: var(--green-bg); color: var(--easy); }
  .diff-medium { background: var(--yellow-bg); color: var(--medium); }
  .diff-hard { background: var(--red-bg); color: var(--hard); }
  .anchor-pill { background: #150f3a; color: var(--accent-light); font-size: 11px; font-weight: 600; border-radius: 999px; padding: 2px 8px; }

  /* Scrollbar */
  ::-webkit-scrollbar { width: 6px; } ::-webkit-scrollbar-track { background: transparent; } ::-webkit-scrollbar-thumb { background: var(--border); border-radius: 3px; }

  /* SGK Panel */
  .sgk-panel { display: flex; flex-direction: column; border-left: 1px solid var(--border); background: var(--surface); overflow: hidden; }
  .sgk-panel-header { padding: 12px 16px; border-bottom: 1px solid var(--border); display: flex; align-items: center; justify-content: space-between; flex-shrink: 0; background: var(--surface2); }
  .sgk-panel-header h3 { font-size: 12px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.07em; color: var(--accent-light); margin: 0; }
  .sgk-scroll { flex: 1; overflow-y: auto; padding: 20px; }
  .sgk-content { font-size: 13px; line-height: 1.8; color: var(--text); white-space: pre-wrap; font-family: inherit; }
  .sgk-content strong, .sgk-content b { color: var(--accent-light); }
  .sgk-badge { font-size: 11px; font-weight: 600; background: #1a1240; color: var(--accent-light); border-radius: 6px; padding: 2px 8px; }
  .sgk-empty { display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100%; gap: 10px; color: var(--text-muted); font-size: 13px; }

  /* Right panel tab toggle */
  .panel-tabs { display: flex; background: var(--surface2); border-bottom: 1px solid var(--border); flex-shrink: 0; }
  .panel-tab { flex: 1; padding: 10px 16px; font-size: 12px; font-weight: 600; border: none; background: transparent; color: var(--text-muted); cursor: pointer; border-bottom: 2px solid transparent; transition: all 0.15s; }
  .panel-tab.active { color: var(--accent-light); border-bottom-color: var(--accent); background: var(--surface); }
  .panel-tab:hover:not(.active) { color: var(--text); background: var(--surface3); }

  /* Split content area */
  .content-split { display: grid; grid-template-columns: 1fr 380px; overflow: hidden; flex: 1; }
  .content-left { display: flex; flex-direction: column; overflow: hidden; }

  /* Flag */
  .q-card.flagged { border-color: #b45309; background: #1c1007; }
  .flag-btn { background: transparent; border: 1px solid var(--border); color: var(--text-muted); padding: 4px 8px; border-radius: 6px; font-size: 11px; cursor: pointer; transition: all 0.15s; }
  .flag-btn:hover { border-color: #f59e0b; color: #f59e0b; }
  .flag-btn.active { background: #451a03; border-color: #f59e0b; color: #f59e0b; }
  .flag-note-area { margin-top: 8px; padding: 8px 12px; background: #1c1007; border: 1px solid #b45309; border-radius: 8px; }
  .flag-note-input { width: 100%; background: transparent; border: none; color: var(--text); font-size: 12px; font-family: inherit; resize: vertical; min-height: 48px; outline: none; }
  .badge-flag { background: #451a03; color: #f59e0b; }

  /* No KC selected */
  .no-kc { display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100%; gap: 12px; color: var(--text-muted); }
`;

// ─────────────────────────────────────────────────────────────────────────────
// SGK Renderer — formats raw SGK markdown for display
// ─────────────────────────────────────────────────────────────────────────────

function SgkRenderer({ content }: { content: string }) {
  // Simple line-by-line renderer with basic markdown styling
  const lines = content.split("\n");
  return (
    <div className="sgk-content">
      {lines.map((line, i) => {
        const trimmed = line.trim();
        // Chapter heading ##
        if (trimmed.startsWith("## ")) {
          return (
            <div key={i} style={{ fontWeight: 700, fontSize: 15, color: "var(--accent-light)", marginTop: 20, marginBottom: 6, borderBottom: "1px solid var(--border)", paddingBottom: 6 }}>
              {trimmed.slice(3)}
            </div>
          );
        }
        // Sub-heading ###
        if (trimmed.startsWith("### ")) {
          return (
            <div key={i} style={{ fontWeight: 700, fontSize: 13, color: "#c4b5fd", marginTop: 14, marginBottom: 4 }}>
              {trimmed.slice(4)}
            </div>
          );
        }
        // Bold line (e.g. **Quy tắc**)
        if (trimmed.startsWith("**") && trimmed.endsWith("**")) {
          return (
            <div key={i} style={{ fontWeight: 700, color: "#e2e8f0", marginTop: 8, marginBottom: 2 }}>
              {trimmed.slice(2, -2)}
            </div>
          );
        }
        // Horizontal rule
        if (trimmed === "---") {
          return <hr key={i} style={{ border: "none", borderTop: "1px solid var(--border)", margin: "12px 0" }} />;
        }
        // Empty line
        if (!trimmed) {
          return <div key={i} style={{ height: 6 }} />;
        }
        // Normal line — inline bold via ** replacement
        const parts = line.split(/(\*\*[^*]+\*\*)/g);
        return (
          <div key={i} style={{ marginBottom: 2 }}>
            {parts.map((part, j) =>
              part.startsWith("**") && part.endsWith("**") ? (
                <strong key={j} style={{ color: "#c4b5fd" }}>{part.slice(2, -2)}</strong>
              ) : (
                <span key={j}>{part}</span>
              )
            )}
          </div>
        );
      })}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Toast
// ─────────────────────────────────────────────────────────────────────────────

type Toast = { id: number; msg: string; type: "success" | "error" };

function useToast() {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const counter = useRef(0);

  const show = useCallback((msg: string, type: Toast["type"] = "success") => {
    const id = ++counter.current;
    setToasts((t) => [...t, { id, msg, type }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 3500);
  }, []);

  return { toasts, show };
}

// ─────────────────────────────────────────────────────────────────────────────
// Question Card
// ─────────────────────────────────────────────────────────────────────────────

function QuestionCard({
  draft,
  onApprove,
  onReject,
  onUpdate,
  onRevert,
}: {
  draft: ItemDraft;
  onApprove: (id: string) => void;
  onReject: (id: string) => void;
  onRevert: (id: string) => void;
  onUpdate: (id: string, patch: Partial<ItemDraft>) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [kstOpen, setKstOpen] = useState(false);

  // Normalize: content may arrive as string (JSON) or object from API
  const safeContent = React.useMemo<MCQContent>(() => {
    const raw = draft.content as unknown;
    if (typeof raw === "string") {
      try { return JSON.parse(raw) as MCQContent; } catch { return { question: String(raw), answers: [] }; }
    }
    if (raw && typeof raw === "object") {
      const obj = raw as Record<string, unknown>;
      return {
        question: typeof obj.question === "string" ? obj.question : "",
        answers: Array.isArray(obj.answers) ? (obj.answers as MCQAnswer[]) : [],
      };
    }
    return { question: "", answers: [] };
  }, [draft.content]);

  const [localQ, setLocalQ] = useState(() => safeContent.question);
  const [localAnswers, setLocalAnswers] = useState<MCQAnswer[]>(() => safeContent.answers);
  const [localKst, setLocalKst] = useState(draft.kst_irt_tag ?? "");
  const [localDiff, setLocalDiff] = useState(draft.difficulty_label);
  const [saving, setSaving] = useState(false);
  const [flagged, setFlagged] = useState(draft.flagged ?? false);
  const [flagNote, setFlagNote] = useState(draft.flag_note ?? "");
  const [flagSaving, setFlagSaving] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    try {
      await onUpdate(draft.id, {
        content: { question: localQ, answers: localAnswers },
        kst_irt_tag: localKst,
        difficulty_label: localDiff,
      } as Partial<ItemDraft>);
      setEditing(false);
    } finally {
      setSaving(false);
    }
  };

  const handleToggleFlag = async () => {
    const next = !flagged;
    setFlagged(next);
    if (!next) setFlagNote("");
    setFlagSaving(true);
    try {
      await flagDraft(draft.id, next, next ? flagNote : undefined);
    } finally {
      setFlagSaving(false);
    }
  };

  const handleSaveFlagNote = async () => {
    setFlagSaving(true);
    try { await flagDraft(draft.id, true, flagNote); }
    finally { setFlagSaving(false); }
  };

  const handleAnswerToggleCorrect = (label: string) => {
    setLocalAnswers((prev) => prev.map((a) => ({ ...a, is_correct: a.label === label })));
  };

  const isApproved = draft.status === "approved" || draft.status === "edited_approved";
  const isRejected = draft.status === "rejected";
  const diffLabel = { easy: "Dễ", medium: "Trung bình", hard: "Khó" }[draft.difficulty_label] ?? draft.difficulty_label;
  const diffClass = `diff-${draft.difficulty_label}`;

  return (
    <div className={`q-card${editing ? " editing" : ""}${isApproved ? " approved" : ""}${isRejected ? " rejected" : ""}${flagged ? " flagged" : ""}`}>
      {/* Header */}
      <div className="q-card-header">
        <span className={`diff-pill ${diffClass}`}>{diffLabel}</span>
        {draft.is_diagnostic_anchor && (
          <span className="anchor-pill">🔑 Entry Point</span>
        )}
        {isApproved && <span className="badge badge-green">✓ Đã duyệt</span>}
        {draft.status === "edited_approved" && <span className="badge badge-purple">✎ Đã sửa</span>}
        {isRejected && <span className="badge badge-red">✗ Từ chối</span>}
        {draft.status === "pending" && <span className="badge badge-gray">Chờ duyệt</span>}
        {flagged && <span className="badge badge-flag">🚩 Xem xét</span>}

        <div style={{ marginLeft: "auto", display: "flex", gap: 6, alignItems: "center" }}>
          {/* Flag toggle */}
          <button
            className={`flag-btn${flagged ? " active" : ""}`}
            disabled={flagSaving}
            onClick={handleToggleFlag}
            title={flagged ? "Bỏ flag" : "Flag để xem xét sau"}
          >
            {flagged ? "🚩 Flagged" : "🏳️ Flag"}
          </button>
          {/* Always allow editing — approved and rejected cards can be re-edited */}
          {(
            <button
              className="btn-ghost btn-sm"
              onClick={() => setEditing((e) => !e)}
            >
              {editing ? "✕ Hủy" : "✏️ Sửa"}
            </button>
          )}
        </div>
      </div>

      {/* Flag note area */}
      {flagged && (
        <div className="flag-note-area">
          <div style={{ fontSize: 11, color: "#f59e0b", marginBottom: 4, fontWeight: 600 }}>🚩 Ghi chú xem xét</div>
          <textarea
            className="flag-note-input"
            placeholder="Ghi chú lý do xem xét (tùy chọn)..."
            value={flagNote}
            onChange={(e) => setFlagNote(e.target.value)}
            onBlur={handleSaveFlagNote}
          />
        </div>
      )}

      {/* Body */}
      <div className="q-card-body">
        {/* Question text */}
        <div className="q-text">
          {editing ? (
            <textarea
              value={localQ}
              onChange={(e) => setLocalQ(e.target.value)}
              rows={3}
            />
          ) : (
            <span>{safeContent.question}</span>
          )}
        </div>

        {/* Answers */}
        <div className="answers">
          {safeContent.answers.length === 0 && (
            <div style={{ color: "var(--text-muted)", fontSize: 12 }}>Không có đáp án</div>
          )}
          {(editing ? localAnswers : safeContent.answers).map((ans: MCQAnswer) => (
            <div
              key={ans.label}
              className={`answer-row${ans.is_correct ? " correct" : ""}${editing ? " editing-answer" : ""}`}
            >
              <span className="answer-label">{ans.label}.</span>
              <span className="answer-text">
                {editing ? (
                  <input
                    value={ans.text}
                    onChange={(e) => {
                      const newText = e.target.value;
                      setLocalAnswers((prev) =>
                        prev.map((a) => (a.label === ans.label ? { ...a, text: newText } : a))
                      );
                    }}
                  />
                ) : (
                  ans.text
                )}
              </span>
              {ans.is_correct && !editing && (
                <span className="correct-check">✓</span>
              )}
              {editing && (
                <button
                  className="btn-ghost btn-icon btn-sm"
                  title="Đặt làm đáp án đúng"
                  style={{ color: ans.is_correct ? "var(--green)" : "var(--text-muted)" }}
                  onClick={() => handleAnswerToggleCorrect(ans.label)}
                >
                  {ans.is_correct ? "✓" : "○"}
                </button>
              )}
            </div>
          ))}
        </div>

        {/* Difficulty selector when editing */}
        {editing && (
          <div style={{ marginTop: 12, display: "flex", gap: 8, alignItems: "center" }}>
            <span style={{ fontSize: 12, color: "var(--text-muted)" }}>Mức độ:</span>
            {(["easy", "medium", "hard"] as const).map((d) => (
              <button
                key={d}
                className={`btn-ghost btn-sm diff-pill diff-${d}`}
                style={{ border: localDiff === d ? "1px solid currentColor" : undefined }}
                onClick={() => setLocalDiff(d)}
              >
                {d === "easy" ? "Dễ" : d === "medium" ? "Trung bình" : "Khó"}
              </button>
            ))}
          </div>
        )}

        {/* KST/IRT tag */}
        {(draft.kst_irt_tag || editing) && (
          <div style={{ marginTop: 12 }}>
            <div className="kst-toggle" onClick={() => setKstOpen((o) => !o)}>
              <span>{kstOpen ? "▾" : "▸"}</span>
              <span>Phân tích thuật toán KST/IRT</span>
            </div>
            {kstOpen && (
              editing ? (
                <textarea
                  className="kst-box"
                  style={{ width: "100%", background: "var(--surface3)", border: "1px solid var(--accent)", borderRadius: 8, color: "var(--text-muted)", padding: "10px 12px", fontFamily: "inherit", fontSize: 12, lineHeight: 1.6, resize: "vertical", minHeight: 80, outline: "none", marginTop: 8 }}
                  value={localKst}
                  onChange={(e) => setLocalKst(e.target.value)}
                />
              ) : (
                <div className="kst-box">{draft.kst_irt_tag}</div>
              )
            )}
          </div>
        )}
      </div>

        {/* Footer */}
        <div className="q-card-footer">
          {/* Pending: approve / reject */}
          {!isApproved && !isRejected && !editing && (
            <>
              <button className="btn-success btn-sm" onClick={() => onApprove(draft.id)}>
                ✓ Approve
              </button>
              <button className="btn-danger btn-sm" onClick={() => onReject(draft.id)}>
                ✗ Từ chối
              </button>
            </>
          )}

          {/* Editing a pending draft */}
          {editing && !isApproved && (
            <>
              <button className="btn-primary btn-sm" disabled={saving} onClick={handleSave}>
                {saving ? "Đang lưu..." : "💾 Lưu & Tiếp tục"}
              </button>
              <button className="btn-success btn-sm" disabled={saving} onClick={async () => { await handleSave(); onApprove(draft.id); }}>
                💾 Lưu & Approve
              </button>
            </>
          )}

          {/* Editing an already-approved draft → just update, no re-approve needed */}
          {editing && isApproved && (
            <>
              <button className="btn-primary btn-sm" disabled={saving} onClick={handleSave}>
                {saving ? "Đang lưu..." : "💾 Lưu cập nhật"}
              </button>
              <span style={{ fontSize: 11, color: "var(--text-muted)", marginLeft: 4 }}>
                Sẽ sync vào Item Bank
              </span>
            </>
          )}

          {/* Approved & not editing → show Undo (revert) button */}
          {isApproved && !editing && (
            <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
              <span style={{ fontSize: 12, color: "var(--green)" }}>
                ✓ Đã import vào Item Bank
                {draft.imported_item_id && (
                  <span style={{ color: "var(--text-muted)", marginLeft: 8 }}>
                    ID: {draft.imported_item_id.slice(0, 8)}…
                  </span>
                )}
              </span>
              <button
                className="btn-danger btn-sm"
                style={{ fontSize: 11, padding: "2px 10px" }}
                onClick={() => onRevert(draft.id)}
                title="Huỷ approve — xóa item khỏi Item Bank và đưa draft về pending"
              >
                ↩ Huỷ duyệt
              </button>
            </div>
          )}

          {/* Rejected: show approve button to allow undo */}
          {isRejected && !editing && (
            <>
              <span style={{ fontSize: 12, color: "var(--red)", marginRight: 8 }}>✗ Đã từ chối</span>
              <button className="btn-success btn-sm" onClick={() => onApprove(draft.id)}>
                ✓ Approve
              </button>
              <button className="btn-danger btn-sm" style={{ opacity: 0.5 }} disabled>
                ✗ Từ chối
              </button>
            </>
          )}

          {/* Rejected + editing */}
          {isRejected && editing && (
            <>
              <button className="btn-primary btn-sm" disabled={saving} onClick={handleSave}>
                {saving ? "Đang lưu..." : "💾 Lưu & Tiếp tục"}
              </button>
              <button className="btn-success btn-sm" disabled={saving} onClick={async () => { await handleSave(); onApprove(draft.id); }}>
                💾 Lưu & Approve
              </button>
            </>
          )}
        </div>
    </div>
  );
}



// ─────────────────────────────────────────────────────────────────────────────
// Main Page
// ─────────────────────────────────────────────────────────────────────────────

type FilterStatus = "all" | "pending" | "approved" | "rejected" | "flagged";
const OPENAI_MODEL = "gpt-4o-mini";

export default function QuestionGenPage() {
  const { toasts, show } = useToast();
  const [status, setStatus] = useState<StatusResponse | null>(null);
  const [selectedKcId, setSelectedKcId] = useState<string | null>(null);
  const [drafts, setDrafts] = useState<ItemDraft[]>([]);
  const [filterStatus, setFilterStatus] = useState<FilterStatus>("all");
  const [generating, setGenerating] = useState(false);
  const [loadingDrafts, setLoadingDrafts] = useState(false);
  const [sgkContent, setSgkContent] = useState<string | null>(null);
  const [sgkLoading, setSgkLoading] = useState(false);
  const [rightTab, setRightTab] = useState<"sgk" | "none">("sgk");
  const [otherGradesExpanded, setOtherGradesExpanded] = useState(false);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // ── Fetch status ──────────────────────────────────────────────────────────
  const fetchStatus = useCallback(async () => {
    try {
      const s = await getStatus();
      setStatus(s);
      return s;
    } catch {
      return null;
    }
  }, []);

  // ── Start polling when job is running ─────────────────────────────────────
  const startPoll = useCallback(() => {
    if (pollRef.current) clearInterval(pollRef.current);
    pollRef.current = setInterval(async () => {
      const s = await fetchStatus();
      if (s && !s.job.running) {
        clearInterval(pollRef.current!);
        setGenerating(false);
        show(`✓ Hoàn tất! ${s.job.generated} nodes — $${s.job.cost_usd.toFixed(4)} USD`, "success");
        // Reload sidebar
      }
    }, 2000);
  }, [fetchStatus, show]);

  useEffect(() => {
    fetchStatus();
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, [fetchStatus]);

  // ── Fetch SGK content for selected KC ────────────────────────────────────
  useEffect(() => {
    if (!selectedKcId) { setSgkContent(null); return; }
    // Find chapter_info from kcStats (drafts have sgk_section field)
    const chapterInfo = drafts[0]?.sgk_section ?? null;
    if (!chapterInfo) { setSgkContent(null); return; }
    setSgkLoading(true);
    getSgkContent(chapterInfo)
      .then((r) => setSgkContent(r.found ? r.content : null))
      .catch(() => setSgkContent(null))
      .finally(() => setSgkLoading(false));
  }, [selectedKcId, drafts]);

  // ── Fetch drafts for selected KC ──────────────────────────────────────────
  const fetchDrafts = useCallback(async (kcId: string, statusFilter?: FilterStatus) => {
    setLoadingDrafts(true);
    try {
      // "flagged" is a client-side filter on top of all drafts
      const apiStatus = (!statusFilter || statusFilter === "all" || statusFilter === "flagged") ? undefined : statusFilter;
      const res = await getDrafts({ kc_id: kcId, status: apiStatus });
      const all = res.drafts;
      setDrafts(statusFilter === "flagged" ? all.filter((d) => d.flagged) : all);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Lỗi";
      show(msg, "error");
    } finally {
      setLoadingDrafts(false);
    }
  }, [show]);

  useEffect(() => {
    if (selectedKcId) fetchDrafts(selectedKcId, filterStatus);
  }, [selectedKcId, filterStatus, fetchDrafts]);

  // ── Actions ───────────────────────────────────────────────────────────────
  const handleRunGeneration = async () => {
    setGenerating(true);
    try {
      await runGeneration({ skip_threshold: 6, rate_limit_seconds: 2 });
      show("🚀 Job đã bắt đầu. Đang generate...", "success");
      startPoll();
      fetchStatus();
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Lỗi";
      show(msg, "error");
      setGenerating(false);
    }
  };

  const handleApprove = async (draftId: string) => {
    try {
      await approveDraft(draftId);
      setDrafts((prev) =>
        prev.map((d) => (d.id === draftId ? { ...d, status: "approved" as const } : d))
      );
      show("✓ Câu hỏi đã được import vào Item Bank", "success");
      fetchStatus();
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Lỗi";
      show(msg, "error");
    }
  };

  const handleReject = async (draftId: string) => {
    try {
      await rejectDraft(draftId);
      setDrafts((prev) =>
        prev.map((d) => (d.id === draftId ? { ...d, status: "rejected" as const } : d))
      );
      show("✗ Đã từ chối câu hỏi", "success");
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Lỗi";
      show(msg, "error");
    }
  };

  const handleRevert = async (draftId: string) => {
    try {
      const res = await revertDraft(draftId);
      setDrafts((prev) =>
        prev.map((d) =>
          d.id === draftId
            ? { ...d, status: "pending" as const, imported_item_id: null }
            : d
        )
      );
      const msg = res.item_deleted
        ? "↩ Đã hủy duyệt — item đã bị xóa khỏi Item Bank"
        : "↩ Đã đưa draft về pending";
      show(msg, "success");
      fetchStatus();
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Lỗi";
      show(msg, "error");
    }
  };

  const handleUpdate = async (draftId: string, patch: Partial<ItemDraft>) => {
    try {
      const updated = await updateDraft(draftId, patch as Parameters<typeof updateDraft>[1]);
      setDrafts((prev) => prev.map((d) => (d.id === draftId ? updated : d)));
      show("💾 Đã lưu thay đổi", "success");
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Lỗi";
      show(msg, "error");
      throw e;
    }
  };

  const handleBulkApprove = async () => {
    if (!selectedKcId) return;
    const pendingIds = drafts.filter((d) => d.status === "pending").map((d) => d.id);
    if (!pendingIds.length) {
      show("Không có câu hỏi nào đang chờ duyệt", "error");
      return;
    }
    try {
      const res = await bulkApprove(selectedKcId, pendingIds) as { success: number; failed: number };
      show(`✓ Đã approve ${res.success} câu, lỗi ${res.failed}`, "success");
      fetchDrafts(selectedKcId, filterStatus);
      fetchStatus();
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Lỗi";
      show(msg, "error");
    }
  };

  // ── Computed ──────────────────────────────────────────────────────────────
  const parseChapterInfo = (info?: string | null) => {
    if (!info) return { ki: 99, bai: 999 };
    const str = info.toLowerCase().trim();
    let ki = 1;
    const kiMatch = str.match(/k[ìi]?\s*(\d)/);
    if (kiMatch) {
      ki = parseInt(kiMatch[1], 10);
    } else if (str.includes("k!")) {
      ki = 1;
    } else if (str.endsWith("k2") || str.includes("k2")) {
      ki = 2;
    }
    const baiMatch = str.match(/b\s*(\d+)/) || str.match(/^(\d+)/);
    let bai = 999;
    if (baiMatch) {
      bai = parseInt(baiMatch[1], 10);
    }
    return { ki, bai };
  };

  const { grade6Kcs, otherKcs } = React.useMemo(() => {
    const raw = status?.drafts?.kcs ?? [];
    const g6: KCStats[] = [];
    const others: KCStats[] = [];
    
    raw.forEach((k) => {
      const isG6 = k.grade === 6 || k.kc_code.startsWith("G6-");
      if (isG6) {
        g6.push(k);
      } else {
        others.push(k);
      }
    });
    
    // Sort Grade 6 KCs: Descending (later lessons/semesters at top, early lessons at bottom)
    g6.sort((a, b) => {
      const pA = parseChapterInfo(a.chapter_info);
      const pB = parseChapterInfo(b.chapter_info);
      if (pA.ki !== pB.ki) {
        return pB.ki - pA.ki; // Semester 2 at the top, Semester 1 at the bottom
      }
      if (pA.bai !== pB.bai) {
        return pB.bai - pA.bai; // Large lesson numbers first
      }
      return b.kc_code.localeCompare(a.kc_code);
    });
    
    // Sort Other KCs alphabetically
    others.sort((a, b) => a.kc_code.localeCompare(b.kc_code));
    
    return { grade6Kcs: g6, otherKcs: others };
  }, [status?.drafts?.kcs]);

  const totals = status?.drafts?.totals ?? { pending: 0, approved: 0, rejected: 0, edited_approved: 0, flagged: 0, total: 0 };
  const job = status?.job;
  const cost: CostSummary | undefined = status?.cost;

  const allKcsCombined = React.useMemo(() => [...grade6Kcs, ...otherKcs], [grade6Kcs, otherKcs]);
  const selectedKcStat = allKcsCombined.find((k) => k.kc_id === selectedKcId);
  const selectedKcName = selectedKcStat?.kc_name ?? "";

  const pendingDrafts = drafts.filter((d) => d.status === "pending");

  const getKcStatusClass = (k: KCStats) => {
    if (k.pending === 0 && k.total > 0) return "badge-green";
    if (k.approved > 0 || k.edited_approved > 0) return "badge-yellow";
    return "badge-gray";
  };

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: CSS }} />

      <div className="layout">
        {/* Header */}
        <header className="header">
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <span style={{ fontSize: 20 }}>🧠</span>
            <h1>MCQ Generation Dashboard</h1>
          </div>

          {/* Stats */}
          <div className="stats-bar" style={{ marginLeft: 16 }}>
            <div className="stat-chip">
              <span style={{ color: "var(--yellow)" }}>⏳</span>
              <strong style={{ color: "var(--yellow)" }}>{totals.pending}</strong>
              <span style={{ color: "var(--text-muted)" }}>chờ duyệt</span>
            </div>
            <div className="stat-chip">
              <span style={{ color: "var(--green)" }}>✓</span>
              <strong style={{ color: "var(--green)" }}>{totals.approved + totals.edited_approved}</strong>
              <span style={{ color: "var(--text-muted)" }}>đã duyệt</span>
            </div>
            <div className="stat-chip">
              <span style={{ color: "var(--red)" }}>✗</span>
              <strong style={{ color: "var(--red)" }}>{totals.rejected}</strong>
              <span style={{ color: "var(--text-muted)" }}>từ chối</span>
            </div>
            {(totals.flagged ?? 0) > 0 && (
              <div className="stat-chip" title="Câu hỏi đang được flag để xem xét">
                <span>🚩</span>
                <strong style={{ color: "#f59e0b" }}>{totals.flagged}</strong>
                <span style={{ color: "var(--text-muted)" }}>xem xét</span>
              </div>
            )}
            <div className="stat-chip" title={`Input: ${cost?.total_input_tokens ?? 0} tokens / Output: ${cost?.total_output_tokens ?? 0} tokens — ${OPENAI_MODEL}`}>
              <span style={{ color: "#a78bfa" }}>$</span>
              <strong style={{ color: "#a78bfa", fontFamily: "'JetBrains Mono', monospace", fontSize: 13 }}>
                {(cost?.total_cost_usd ?? 0).toFixed(4)}
              </strong>
              <span style={{ color: "var(--text-muted)" }}>USD</span>
            </div>
          </div>

          {/* Job progress */}
          {job?.running && (
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginLeft: 16 }}>
              <div className="spinner" />
              <span style={{ fontSize: 12, color: "var(--text-muted)" }}>
                Generating {job.progress}/{job.total} — {job.last_kc ?? "..."}
              </span>
              <div className="progress-outer">
                <div
                  className="progress-inner"
                  style={{ width: job.total > 0 ? `${Math.round((job.progress / job.total) * 100)}%` : "0%" }}
                />
              </div>
              {job.cost_usd > 0 && (
                <span style={{ fontSize: 11, color: "#a78bfa", fontFamily: "'JetBrains Mono', monospace", whiteSpace: "nowrap" }}>
                  ${job.cost_usd.toFixed(4)}
                </span>
              )}
            </div>
          )}

          {/* Generate button */}
          <div style={{ marginLeft: "auto" }}>
            <button
              className="btn-primary"
              disabled={generating || job?.running}
              onClick={handleRunGeneration}
            >
              {generating || job?.running ? (
                <><div className="spinner" style={{ width: 14, height: 14, borderWidth: 2 }} /> Đang chạy...</>
              ) : (
                "🚀 Bắt đầu Generate"
              )}
            </button>
          </div>
        </header>

        {/* Main */}
        <div className="main-area">
          {/* Sidebar */}
          <aside className="sidebar">
            <div className="sidebar-header">
              <h2>Knowledge Components</h2>
              <span style={{ fontSize: 12, color: "var(--text-muted)" }}>{grade6Kcs.length + otherKcs.length} nodes có drafts</span>
            </div>
            <div className="sidebar-scroll">
              {grade6Kcs.length === 0 && otherKcs.length === 0 && (
                <div style={{ padding: 20, textAlign: "center", color: "var(--text-muted)", fontSize: 12 }}>
                  Chưa có drafts nào.<br />Nhấn "Bắt đầu Generate" để tạo.
                </div>
              )}

              {/* Grade 6 Section */}
              {grade6Kcs.length > 0 && (
                <>
                  <div style={{ padding: "8px 12px 4px 12px", fontSize: 11, fontWeight: 700, textTransform: "uppercase", color: "var(--yellow)", letterSpacing: 0.5 }}>
                    Lớp 6 ({grade6Kcs.length} nodes)
                  </div>
                  {grade6Kcs.map((k) => (
                    <div
                      key={k.kc_id}
                      className={`kc-item${selectedKcId === k.kc_id ? " active" : ""}`}
                      onClick={() => setSelectedKcId(k.kc_id)}
                    >
                      <div className="kc-item-info">
                        <div className="kc-item-name">{k.kc_name}</div>
                        <div className="kc-item-code">{k.kc_code}</div>
                      </div>
                      <div className="kc-badge">
                        {k.pending > 0 && <span className="badge badge-yellow">{k.pending}</span>}
                        {(k.approved + k.edited_approved) > 0 && (
                          <span className="badge badge-green">✓{k.approved + k.edited_approved}</span>
                        )}
                        {k.flagged > 0 && (
                          <span
                            className="badge badge-flag"
                            title={`${k.flagged} câu đang được flag để xem xét`}
                          >
                            🚩{k.flagged}
                          </span>
                        )}
                        {k.rejected > 0 && <span className="badge badge-red">✗{k.rejected}</span>}
                        <span className={`badge ${getKcStatusClass(k)}`}>{k.total}</span>
                      </div>
                    </div>
                  ))}
                </>
              )}

              {/* Other Grades Section */}
              {otherKcs.length > 0 && (
                <div style={{ marginTop: 12 }}>
                  <div
                    onClick={() => setOtherGradesExpanded(!otherGradesExpanded)}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      padding: "10px 12px",
                      fontSize: 11,
                      fontWeight: 700,
                      textTransform: "uppercase",
                      color: "var(--text-muted)",
                      letterSpacing: 0.5,
                      borderTop: "1px solid var(--border)",
                      borderBottom: "1px solid var(--border)",
                      cursor: "pointer",
                      backgroundColor: "rgba(255, 255, 255, 0.02)",
                    }}
                  >
                    <span>Lớp khác (7, 8, 9) ({otherKcs.length} nodes)</span>
                    <span>{otherGradesExpanded ? "▼" : "▶"}</span>
                  </div>
                  
                  {otherGradesExpanded && (
                    <div style={{ paddingBottom: 20 }}>
                      {otherKcs.map((k) => (
                        <div
                          key={k.kc_id}
                          className={`kc-item${selectedKcId === k.kc_id ? " active" : ""}`}
                          onClick={() => setSelectedKcId(k.kc_id)}
                        >
                          <div className="kc-item-info">
                            <div className="kc-item-name">{k.kc_name}</div>
                            <div className="kc-item-code">{k.kc_code}</div>
                          </div>
                          <div className="kc-badge">
                            {k.pending > 0 && <span className="badge badge-yellow">{k.pending}</span>}
                            {(k.approved + k.edited_approved) > 0 && (
                              <span className="badge badge-green">✓{k.approved + k.edited_approved}</span>
                            )}
                            {k.flagged > 0 && (
                              <span
                                className="badge badge-flag"
                                title={`${k.flagged} câu đang được flag để xem xét`}
                              >
                                🚩{k.flagged}
                              </span>
                            )}
                            {k.rejected > 0 && <span className="badge badge-red">✗{k.rejected}</span>}
                            <span className={`badge ${getKcStatusClass(k)}`}>{k.total}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          </aside>

          {/* Content */}
          <main className="content">
            {!selectedKcId ? (
              <div className="no-kc">
                <div style={{ fontSize: 48 }}>📋</div>
                <div style={{ fontWeight: 600 }}>Chọn một Knowledge Component</div>
                <div style={{ fontSize: 12 }}>để xem và duyệt câu hỏi được generate</div>
              </div>
            ) : (
              <div className="content-split">
                {/* Left: questions */}
                <div className="content-left">
                  <div className="content-header">
                    <div>
                      <div style={{ fontWeight: 600, fontSize: 15 }}>{selectedKcName}</div>
                      <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 2 }}>
                        {selectedKcStat?.kc_code} —{" "}
                        {selectedKcStat?.pending ?? 0} chờ duyệt /{" "}
                        {(selectedKcStat?.approved ?? 0) + (selectedKcStat?.edited_approved ?? 0)} đã duyệt
                      </div>
                    </div>

                    {/* Filter tabs */}
                    <div className="filter-tabs">
                    {(["all", "pending", "approved", "rejected", "flagged"] as FilterStatus[]).map((f) => (
                      <button
                        key={f}
                        className={`filter-tab${filterStatus === f ? " active" : ""}`}
                        onClick={() => setFilterStatus(f)}
                      >
                        {f === "all" ? "Tất cả" : f === "pending" ? "Chờ duyệt" : f === "approved" ? "Đã duyệt" : f === "rejected" ? "Từ chối" : "🚩 Xem xét"}
                      </button>
                    ))}
                    </div>

                    {/* Bulk approve */}
                    {pendingDrafts.length > 0 && (
                      <button className="btn-success btn-sm" onClick={handleBulkApprove}>
                        ✓ Approve tất cả ({pendingDrafts.length})
                      </button>
                    )}
                  </div>

                  <div className="content-scroll">
                    {loadingDrafts && (
                      <div className="empty">
                        <div className="spinner" style={{ width: 32, height: 32 }} />
                        <span>Đang tải...</span>
                      </div>
                    )}
                    {!loadingDrafts && drafts.length === 0 && (
                      <div className="empty">
                        <div className="empty-icon">📭</div>
                        <div style={{ fontWeight: 600 }}>Không có câu hỏi nào</div>
                        <div style={{ fontSize: 12 }}>
                          {filterStatus !== "all" ? `Không có câu hỏi "${filterStatus}"` : "Chưa generate cho KC này"}
                        </div>
                      </div>
                    )}
                    {!loadingDrafts && drafts.map((draft) => (
                      <QuestionCard
                        key={draft.id}
                        draft={draft}
                        onApprove={handleApprove}
                        onReject={handleReject}
                        onRevert={handleRevert}
                        onUpdate={handleUpdate}
                      />
                    ))}
                  </div>
                </div>

                {/* Right: SGK panel */}
                <div className="sgk-panel">
                  <div className="panel-tabs">
                    <button
                      className={`panel-tab${rightTab === "sgk" ? " active" : ""}`}
                      onClick={() => setRightTab("sgk")}
                    >
                      📖 Nội dung SGK
                    </button>
                  </div>

                  {rightTab === "sgk" && (
                    <>
                      <div className="sgk-panel-header">
                        <h3>Sách giáo khoa · {drafts[0]?.sgk_section ?? "—"}</h3>
                        {drafts[0]?.sgk_section && (
                          <span className="sgk-badge">{drafts[0].sgk_section}</span>
                        )}
                      </div>
                      <div className="sgk-scroll">
                        {sgkLoading && (
                          <div className="sgk-empty">
                            <div className="spinner" />
                            <span>Đang tải nội dung...</span>
                          </div>
                        )}
                        {!sgkLoading && !sgkContent && (
                          <div className="sgk-empty">
                            <div style={{ fontSize: 32 }}>📚</div>
                            <span>Không tìm thấy nội dung SGK</span>
                            <span style={{ fontSize: 11, color: "var(--text-muted)" }}>
                              {drafts[0]?.sgk_section ?? "chapter_info chưa xác định"}
                            </span>
                          </div>
                        )}
                        {!sgkLoading && sgkContent && (
                          <SgkRenderer content={sgkContent} />
                        )}
                      </div>
                    </>
                  )}
                </div>
              </div>
            )}
          </main>
        </div>
      </div>

      {/* Toasts */}
      <div className="toast-container">
        {toasts.map((t) => (
          <div key={t.id} className={`toast toast-${t.type}`}>
            <span>{t.type === "success" ? "✓" : "✗"}</span>
            <span>{t.msg}</span>
          </div>
        ))}
      </div>
    </>
  );
}
