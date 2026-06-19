"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  approveDraft,
  bulkApprove,
  createDraft,
  exportFlaggedDrafts,
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
import { itemApi } from "@/lib/api";
import type { Item } from "@/lib/api";


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

  /* Search */
  .sidebar-search { padding: 8px 12px; flex-shrink: 0; }
  .search-input {
    width: 100%; background: var(--surface2); border: 1px solid var(--border);
    border-radius: 8px; color: var(--text); font-size: 13px; padding: 7px 10px 7px 30px;
    outline: none; font-family: inherit; transition: border-color 0.15s;
  }
  .search-input:focus { border-color: var(--accent); }
  .search-wrap { position: relative; }
  .search-icon { position: absolute; left: 9px; top: 50%; transform: translateY(-50%); font-size: 13px; color: var(--text-dim); pointer-events: none; }
  .search-clear { position: absolute; right: 8px; top: 50%; transform: translateY(-50%); background: none; border: none; color: var(--text-muted); cursor: pointer; font-size: 14px; padding: 0; line-height: 1; }
  .search-clear:hover { color: var(--text); }
  .no-results { padding: 20px; text-align: center; color: var(--text-muted); font-size: 12px; }

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
  .content-split { display: grid; grid-template-columns: 1fr 380px; overflow: hidden; flex: 1; transition: grid-template-columns 0.2s ease; }
  .content-left { display: flex; flex-direction: column; overflow: hidden; }

  /* Responsive layout — desktop only */
  @media (max-width: 1450px) { .main-area { grid-template-columns: 260px 1fr; } }
  @media (max-width: 1250px) {
    .main-area { grid-template-columns: 230px 1fr; }
    .kc-item-name { font-size: 12px; }
    .stat-chip { padding: 5px 8px; font-size: 11px; }
    .stat-chip strong { font-size: 14px; }
  }
  @media (max-width: 1050px) {
    .main-area { grid-template-columns: 200px 1fr; }
    .kc-item { padding: 8px 12px; }
    .kc-item-name { font-size: 11px; }
    .kc-item-code { display: none; }
    .content-split { grid-template-columns: 1fr 280px; }
  }
  /* SGK collapsed strip */
  .sgk-panel-strip { display: flex; flex-direction: column; align-items: center; padding: 12px 6px; gap: 8px; cursor: pointer; }
  .sgk-strip-label { writing-mode: vertical-rl; transform: rotate(180deg); font-size: 11px; font-weight: 600; color: var(--text-muted); letter-spacing: 0.06em; user-select: none; margin-top: 8px; }

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

const QuestionCard = React.memo(function QuestionCard({
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
});



// ─────────────────────────────────────────────────────────────────────────────
// Optimistic stat mutation (Fix #1) — no network call needed after actions
// ─────────────────────────────────────────────────────────────────────────────

function mutateKcStats(
  prev: StatusResponse,
  kcId: string,
  delta: { pending?: number; approved?: number; rejected?: number }
): StatusResponse {
  return {
    ...prev,
    drafts: {
      ...prev.drafts,
      kcs: prev.drafts.kcs.map((k) =>
        k.kc_id !== kcId ? k : {
          ...k,
          pending:  Math.max(0, k.pending  + (delta.pending  ?? 0)),
          approved: Math.max(0, k.approved + (delta.approved ?? 0)),
          rejected: Math.max(0, k.rejected + (delta.rejected ?? 0)),
        }
      ),
      totals: {
        ...prev.drafts.totals,
        pending:  Math.max(0, prev.drafts.totals.pending  + (delta.pending  ?? 0)),
        approved: Math.max(0, prev.drafts.totals.approved + (delta.approved ?? 0)),
        rejected: Math.max(0, prev.drafts.totals.rejected + (delta.rejected ?? 0)),
      },
    },
  };
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
  const [exporting, setExporting] = useState(false);
  const [loadingDrafts, setLoadingDrafts] = useState(false);
  const [sgkContent, setSgkContent] = useState<string | null>(null);
  const [sgkLoading, setSgkLoading] = useState(false);
  const [rightTab, setRightTab] = useState<"sgk" | "none">("sgk");
  const [items, setItems] = useState<Item[]>([]);
  // ── Add question form state ──────────────────────────────────────────────
  const [showAddForm, setShowAddForm] = useState(false);
  const [addForm, setAddForm] = useState({
    difficulty: "easy" as "easy" | "medium" | "hard",
    questionText: "",
    isEntryPoint: false,
    answers: [
      { text: "", isCorrect: false },
      { text: "", isCorrect: false },
      { text: "", isCorrect: false },
      { text: "", isCorrect: false },
    ],
  });
  const [addSaving, setAddSaving] = useState(false);
  const [addError, setAddError] = useState<string | null>(null);
  const [otherGradesExpanded, setOtherGradesExpanded] = useState(false);
  const [hideFlagged, setHideFlagged] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [sgkCollapsed, setSgkCollapsed] = useState(false);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const sgkCache = useRef<Record<string, string>>({}); // Fix #4: client-side SGK cache

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

  // Fix #2+#4: SGK fires in parallel with drafts (reads from KC stats loaded at startup)
  // and is cached client-side so revisiting a KC costs zero network calls.
  const selectedKcChapterInfo = React.useMemo(
    () => status?.drafts?.kcs?.find((k) => k.kc_id === selectedKcId)?.chapter_info ?? null,
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [selectedKcId, status?.drafts?.kcs]
  );

  useEffect(() => {
    if (!selectedKcId) { setSgkContent(null); return; }
    const chapterInfo = selectedKcChapterInfo;
    if (!chapterInfo) { setSgkContent(null); return; }
    // Serve from cache — instant, no spinner
    if (sgkCache.current[chapterInfo]) {
      setSgkContent(sgkCache.current[chapterInfo]);
      return;
    }
    setSgkLoading(true);
    getSgkContent(chapterInfo)
      .then((r) => {
        const content = r.found ? r.content : null;
        if (content) sgkCache.current[chapterInfo] = content;
        setSgkContent(content);
      })
      .catch(() => setSgkContent(null))
      .finally(() => setSgkLoading(false));
  }, [selectedKcId, selectedKcChapterInfo]);

  // Fix #5: fetchItems is on-demand only — NOT auto-triggered on KC switch
  const fetchItems = useCallback(async (kcId: string) => {
    try {
      const its = await itemApi.list(kcId);
      setItems(Array.isArray(its) ? its : []);
    } catch {
      setItems([]);
    }
  }, []);


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
  const handleExportFlagged = async () => {
    setExporting(true);
    try {
      const filename = await exportFlaggedDrafts();
      show(`📥 Đã tải: ${filename}`, "success");
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Lỗi export";
      show(msg, "error");
    } finally {
      setExporting(false);
    }
  };

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

  // Fix #1: per-action optimistic updates — zero extra network calls
  const handleApprove = useCallback(async (draftId: string) => {
    try {
      await approveDraft(draftId);
      setDrafts((prev) => prev.map((d) => d.id === draftId ? { ...d, status: "approved" as const } : d));
      setStatus((prev) => prev && selectedKcId ? mutateKcStats(prev, selectedKcId, { pending: -1, approved: +1 }) : prev);
      show("✓ Câu hỏi đã được import vào Item Bank", "success");
    } catch (e: unknown) {
      show(e instanceof Error ? e.message : "Lỗi", "error");
    }
  }, [show, selectedKcId]);

  const handleReject = useCallback(async (draftId: string) => {
    try {
      await rejectDraft(draftId);
      setDrafts((prev) => prev.map((d) => d.id === draftId ? { ...d, status: "rejected" as const } : d));
      setStatus((prev) => prev && selectedKcId ? mutateKcStats(prev, selectedKcId, { pending: -1, rejected: +1 }) : prev);
      show("✗ Đã từ chối câu hỏi", "success");
    } catch (e: unknown) {
      show(e instanceof Error ? e.message : "Lỗi", "error");
    }
  }, [show, selectedKcId]);

  const handleRevert = useCallback(async (draftId: string) => {
    try {
      const res = await revertDraft(draftId);
      // Capture prev status inside setDrafts so we don’t need drafts as dep
      setDrafts((prev) => {
        const old = prev.find((d) => d.id === draftId);
        const wasApproved = old?.status === "approved" || old?.status === "edited_approved";
        const wasRejected = old?.status === "rejected";
        if (selectedKcId) {
          setStatus((s) => s ? mutateKcStats(s, selectedKcId, {
            pending: +1,
            approved: wasApproved ? -1 : 0,
            rejected: wasRejected ? -1 : 0,
          }) : s);
        }
        return prev.map((d) => d.id === draftId ? { ...d, status: "pending" as const, imported_item_id: null } : d);
      });
      const msg = res.item_deleted ? "↩ Đã hủy duyệt — item đã bị xóa khỏi Item Bank" : "↩ Đã đưa draft về pending";
      show(msg, "success");
    } catch (e: unknown) {
      show(e instanceof Error ? e.message : "Lỗi", "error");
    }
  }, [show, selectedKcId]);

  const handleUpdate = useCallback(async (draftId: string, patch: Partial<ItemDraft>) => {
    try {
      const updated = await updateDraft(draftId, patch as Parameters<typeof updateDraft>[1]);
      setDrafts((prev) => prev.map((d) => (d.id === draftId ? updated : d)));
      show("💾 Đã lưu thay đổi", "success");
    } catch (e: unknown) {
      show(e instanceof Error ? e.message : "Lỗi", "error");
      throw e;
    }
  }, [show]);

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
      // Optimistic: flip all pending→approved locally, no refetch
      setDrafts((prev) => prev.map((d) => d.status === "pending" ? { ...d, status: "approved" as const } : d));
      setStatus((prev) => prev ? mutateKcStats(prev, selectedKcId, { pending: -res.success, approved: +res.success }) : prev);
    } catch (e: unknown) {
      show(e instanceof Error ? e.message : "Lỗi", "error");
    }
  };

  // ── Add question (manual) ─────────────────────────────────────────
  const resetAddForm = () => setAddForm({
    difficulty: "easy",
    questionText: "",
    isEntryPoint: false,
    answers: [
      { text: "", isCorrect: false },
      { text: "", isCorrect: false },
      { text: "", isCorrect: false },
      { text: "", isCorrect: false },
    ],
  });

  const handleAddSave = async (keepOpen: boolean) => {
    if (!selectedKcId) return;
    setAddError(null);
    if (!addForm.questionText.trim()) { setAddError("Câu hỏi không được để trống"); return; }
    const hasCorrect = addForm.answers.some(a => a.isCorrect);
    if (!hasCorrect) { setAddError("Chưa chọn đáp án đúng"); return; }
    const filled = addForm.answers.filter(a => a.text.trim());
    if (filled.length < 2) { setAddError("Cần ít nhất 2 đáp án có nội dung"); return; }
    setAddSaving(true);
    try {
      const newDraft = await createDraft({
        kc_id: selectedKcId,
        difficulty_label: addForm.difficulty,
        is_diagnostic_anchor: addForm.isEntryPoint,
        content: {
          question: addForm.questionText,
          answers: addForm.answers
            .filter(a => a.text.trim())
            .map((a, i) => ({ label: String.fromCharCode(65 + i), text: a.text, is_correct: a.isCorrect })),
        },
      });
      // Prepend — appears at top of draft list as “Chờ duyệt”
      setDrafts(prev => [newDraft, ...prev]);
      setStatus(prev => prev ? mutateKcStats(prev, selectedKcId, { pending: +1 }) : prev);
      show("✓ Đã lưu — xuất hiện đầu danh sách Chờ duyệt", "success");
      if (keepOpen) {
        setAddForm(prev => ({ ...prev, questionText: "", isEntryPoint: false, answers: prev.answers.map(a => ({ ...a, text: "", isCorrect: false })) }));
      } else {
        setShowAddForm(false);
        resetAddForm();
      }
    } catch (e: unknown) {
      setAddError(e instanceof Error ? e.message : "Lỗi lưu");
    } finally {
      setAddSaving(false);
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

  const pendingDrafts = drafts.filter((d) => d.status === "pending" && (!hideFlagged || !d.flagged));

  // Drafts shown in main panel (apply hideFlagged filter)
  const visibleDrafts = React.useMemo(
    () => (hideFlagged ? drafts.filter((d) => !d.flagged) : drafts),
    [drafts, hideFlagged]
  );

  // Sidebar KC search filter
  const searchLower = searchQuery.toLowerCase().trim();
  const filteredGrade6Kcs = React.useMemo(
    () => searchLower ? grade6Kcs.filter((k) => k.kc_name.toLowerCase().includes(searchLower) || k.kc_code.toLowerCase().includes(searchLower)) : grade6Kcs,
    [grade6Kcs, searchLower]
  );
  const filteredOtherKcs = React.useMemo(
    () => searchLower ? otherKcs.filter((k) => k.kc_name.toLowerCase().includes(searchLower) || k.kc_code.toLowerCase().includes(searchLower)) : otherKcs,
    [otherKcs, searchLower]
  );
  // Auto-expand Other Grades when search matches
  const effectiveOtherExpanded = otherGradesExpanded || (searchLower.length > 0 && filteredOtherKcs.length > 0);
  const totalFiltered = filteredGrade6Kcs.length + filteredOtherKcs.length;

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

          {/* Action buttons */}
          <div style={{ marginLeft: "auto", display: "flex", gap: 8, alignItems: "center" }}>
            {/* Hide Flagged toggle */}
            <button
              className="btn-ghost"
              onClick={() => setHideFlagged((v) => !v)}
              title={hideFlagged ? "Đang ẩn câu hỏi flagged (v1 xấu). Nhấn để hiện lại." : "Đang hiện tất cả câu hỏi. Nhấn để ẩn flagged."}
              style={{
                display: "flex", alignItems: "center", gap: 6, fontSize: 13,
                padding: "6px 14px", border: `1px solid ${hideFlagged ? "var(--accent)" : "var(--border)"}`,
                borderRadius: 8, color: hideFlagged ? "var(--accent-light)" : "var(--text-muted)",
                background: hideFlagged ? "rgba(124,106,247,0.1)" : "transparent",
              }}
            >
              {hideFlagged ? "👁️ Ẩn flagged" : "👁️ Hiện flagged"}
            </button>

            {/* Export flagged */}
            <button
              className="btn-ghost"
              style={{
                display: "flex",
                alignItems: "center",
                gap: 6,
                fontSize: 13,
                padding: "6px 14px",
                border: "1px solid var(--border)",
                borderRadius: 8,
                opacity: (totals.flagged ?? 0) === 0 ? 0.45 : 1,
              }}
              disabled={exporting || (totals.flagged ?? 0) === 0}
              onClick={handleExportFlagged}
              title={(totals.flagged ?? 0) === 0 ? "Chưa có câu nào được flag" : `Export ${totals.flagged} câu được flag thành file .md`}
            >
              {exporting ? (
                <><div className="spinner" style={{ width: 13, height: 13, borderWidth: 2 }} /> Đang xuất...</>
              ) : (
                <>📥 Export Flagged {(totals.flagged ?? 0) > 0 && <span style={{ background: "#f59e0b22", color: "#f59e0b", borderRadius: 4, padding: "1px 6px", fontSize: 11, fontWeight: 700 }}>{totals.flagged}</span>}</>
              )}
            </button>

            {/* Generate */}
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
              <span style={{ fontSize: 12, color: "var(--text-muted)" }}>
                {searchLower ? `${totalFiltered} / ${grade6Kcs.length + otherKcs.length}` : grade6Kcs.length + otherKcs.length} nodes
              </span>
            </div>
            {/* Search */}
            <div className="sidebar-search">
              <div className="search-wrap">
                <span className="search-icon">🔍</span>
                <input
                  id="kc-search"
                  className="search-input"
                  placeholder="Tìm node..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  autoComplete="off"
                  spellCheck={false}
                />
                {searchQuery && (
                  <button className="search-clear" onClick={() => setSearchQuery("")} title="Xoá">
                    ×
                  </button>
                )}
              </div>
            </div>
            <div className="sidebar-scroll">
              {totalFiltered === 0 && (
                <div className="no-results">
                  {searchLower ? `Không tìm thấy node nào cho "${searchQuery}"` : "Chưa có drafts nào."}
                  {!searchLower && <><br />Nhấn "Bắt đầu Generate" để tạo.</>}
                </div>
              )}

              {/* Grade 6 Section */}
              {filteredGrade6Kcs.length > 0 && (
                <>
                  <div style={{ padding: "8px 12px 4px 12px", fontSize: 11, fontWeight: 700, textTransform: "uppercase", color: "var(--yellow)", letterSpacing: 0.5 }}>
                    Lớp 6 ({filteredGrade6Kcs.length} nodes)
                  </div>
                  {filteredGrade6Kcs.map((k) => (
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
              {filteredOtherKcs.length > 0 && (
                <div style={{ marginTop: 12 }}>
                  <div
                    onClick={() => setOtherGradesExpanded(!otherGradesExpanded)}
                    style={{
                      display: "flex", alignItems: "center", justifyContent: "space-between",
                      padding: "10px 12px", fontSize: 11, fontWeight: 700, textTransform: "uppercase",
                      color: "var(--text-muted)", letterSpacing: 0.5,
                      borderTop: "1px solid var(--border)", borderBottom: "1px solid var(--border)",
                      cursor: "pointer", backgroundColor: "rgba(255, 255, 255, 0.02)",
                    }}
                  >
                    <span>Lớp khác (7, 8, 9) ({filteredOtherKcs.length} nodes)</span>
                    <span>{effectiveOtherExpanded ? "▼" : "▶"}</span>
                  </div>
                  
                  {effectiveOtherExpanded && (
                    <div style={{ paddingBottom: 20 }}>
                      {filteredOtherKcs.map((k) => (
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
                    {/* Add question button */}
                    {selectedKcId && (
                      <button
                        className="btn-sm"
                        onClick={() => { setShowAddForm(v => !v); setAddError(null); }}
                        style={{
                          background: showAddForm ? "var(--accent)" : "transparent",
                          border: `1px solid var(--accent)`,
                          color: showAddForm ? "#fff" : "var(--accent-light)",
                          borderRadius: 6, padding: "4px 12px", fontSize: 12,
                          fontWeight: 600, cursor: "pointer", display: "flex",
                          alignItems: "center", gap: 5, transition: "all 0.15s",
                        }}
                      >
                        {showAddForm ? "× Đóng" : "+ Thêm câu hỏi"}
                      </button>
                    )}
                  </div>

                  <div className="content-scroll">
                    {/* ── Inline Add Question Form ── */}
                    {showAddForm && selectedKcId && (
                      <div style={{
                        background: "var(--surface2)", border: "1px solid var(--accent)",
                        borderRadius: 10, padding: 16, marginBottom: 16,
                      }}>
                        <div style={{ fontSize: 13, fontWeight: 700, color: "var(--accent-light)", marginBottom: 12 }}>
                          + Thêm câu hỏi thủ công
                        </div>

                        {/* Difficulty + Entry Point toggle */}
                        <div style={{ display: "flex", gap: 6, marginBottom: 10, alignItems: "center", flexWrap: "wrap" }}>
                          {(["easy", "medium", "hard"] as const).map(d => {
                            const cfg = { easy: { label: "Dễ", color: "var(--easy)" }, medium: { label: "Trung bình", color: "var(--medium)" }, hard: { label: "Khó", color: "var(--hard)" } }[d];
                            const sel = addForm.difficulty === d;
                            return (
                              <button key={d} onClick={() => setAddForm(p => ({ ...p, difficulty: d }))}
                                style={{ padding: "4px 12px", borderRadius: 6, cursor: "pointer", fontSize: 12, fontWeight: sel ? 700 : 400,
                                  border: `1.5px solid ${sel ? cfg.color : "var(--border)"}`,
                                  background: sel ? `${cfg.color}22` : "transparent",
                                  color: sel ? cfg.color : "var(--text-muted)", transition: "all 0.15s" }}
                              >{cfg.label}</button>
                            );
                          })}
                          {/* Entry Point toggle */}
                          <label style={{ display: "flex", alignItems: "center", gap: 5, marginLeft: 4, cursor: "pointer", fontSize: 12,
                            color: addForm.isEntryPoint ? "var(--accent-light)" : "var(--text-muted)",
                            background: addForm.isEntryPoint ? "#150f3a" : "transparent",
                            border: `1.5px solid ${addForm.isEntryPoint ? "var(--accent)" : "var(--border)"}`,
                            borderRadius: 6, padding: "3px 9px", transition: "all 0.15s", userSelect: "none" }}>
                            <input type="checkbox" checked={addForm.isEntryPoint}
                              onChange={e => setAddForm(p => ({ ...p, isEntryPoint: e.target.checked }))}
                              style={{ accentColor: "var(--accent)", width: 13, height: 13, cursor: "pointer" }}
                            />
                            🔑 Entry Point
                          </label>
                        </div>

                        {/* Question text */}
                        <textarea
                          style={{ width: "100%", minHeight: 80, background: "var(--surface3)", border: "1px solid var(--border)",
                            borderRadius: 6, color: "var(--text)", fontSize: 13, padding: "8px 10px", resize: "vertical",
                            fontFamily: "inherit", outline: "none", marginBottom: 10 }}
                          placeholder="Nhập câu hỏi... Dùng $...$ cho công thức toán"
                          value={addForm.questionText}
                          onChange={e => setAddForm(p => ({ ...p, questionText: e.target.value }))}
                        />

                        {/* Answers */}
                        <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 10 }}>
                          {addForm.answers.map((ans, i) => (
                            <div key={i} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                              <input type="checkbox" checked={ans.isCorrect}
                                onChange={e => setAddForm(p => ({
                                  ...p,
                                  answers: p.answers.map((a, j) => j === i ? { ...a, isCorrect: e.target.checked } : a)
                                }))}
                                style={{ accentColor: "var(--green)", width: 15, height: 15, flexShrink: 0, cursor: "pointer" }}
                                title="Đáp án đúng"
                              />
                              <span style={{ fontSize: 12, color: "var(--text-muted)", width: 16, flexShrink: 0 }}>{String.fromCharCode(65 + i)}.</span>
                              <input
                                style={{ flex: 1, background: "var(--surface3)", border: `1px solid ${ans.isCorrect ? "var(--green)" : "var(--border)"}`,
                                  borderRadius: 6, color: "var(--text)", fontSize: 13, padding: "6px 10px", outline: "none", fontFamily: "inherit" }}
                                placeholder={`Đáp án ${String.fromCharCode(65 + i)}`}
                                value={ans.text}
                                onChange={e => setAddForm(p => ({
                                  ...p,
                                  answers: p.answers.map((a, j) => j === i ? { ...a, text: e.target.value } : a)
                                }))}
                              />
                            </div>
                          ))}
                        </div>

                        {addError && <div style={{ fontSize: 12, color: "var(--red)", marginBottom: 8 }}>⚠ {addError}</div>}

                        <div style={{ display: "flex", gap: 6 }}>
                          <button onClick={() => handleAddSave(true)} disabled={addSaving}
                            style={{ flex: 1, padding: "7px", borderRadius: 6, fontSize: 12, fontWeight: 600, cursor: "pointer",
                              background: "var(--surface3)", border: "1px solid var(--border)", color: "var(--text)" }}>
                            {addSaving ? "Lưu..." : "Lưu & Thêm tiếp"}
                          </button>
                          <button onClick={() => handleAddSave(false)} disabled={addSaving}
                            style={{ flex: 1, padding: "7px", borderRadius: 6, fontSize: 12, fontWeight: 700, cursor: "pointer",
                              background: "var(--accent)", border: "none", color: "#fff" }}>
                            {addSaving ? "Lưu..." : "Lưu & Đóng"}
                          </button>
                          <button onClick={() => { setShowAddForm(false); resetAddForm(); setAddError(null); }}
                            style={{ padding: "7px 12px", borderRadius: 6, fontSize: 12, cursor: "pointer",
                              background: "transparent", border: "1px solid var(--border)", color: "var(--text-muted)" }}>
                            Huỷ
                          </button>
                        </div>
                      </div>
                    )}

                    {loadingDrafts && (
                      <div className="empty">
                        <div className="spinner" style={{ width: 32, height: 32 }} />
                        <span>Đang tải...</span>
                      </div>
                    )}
                    {!loadingDrafts && visibleDrafts.length === 0 && (
                      <div className="empty">
                        <div className="empty-icon">📭</div>
                        <div style={{ fontWeight: 600 }}>Không có câu hỏi nào</div>
                        <div style={{ fontSize: 12 }}>
                          {hideFlagged && drafts.length > 0
                            ? `Đang ẩn ${drafts.length} câu flagged. Nhấn "👁️ Hiện flagged" để xem.`
                            : filterStatus !== "all" ? `Không có câu hỏi "${filterStatus}"` : "Chưa generate cho KC này"}
                        </div>
                      </div>
                    )}
                    {!loadingDrafts && visibleDrafts.map((draft) => (
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
                <div className="sgk-panel" style={{ width: sgkCollapsed ? 42 : undefined, minWidth: sgkCollapsed ? 42 : undefined }}>
                  {sgkCollapsed ? (
                    /* Collapsed strip — click to expand */
                    <div className="sgk-panel-strip" onClick={() => setSgkCollapsed(false)} title="Mở nội dung SGK">
                      <button style={{ background: "transparent", border: "1px solid var(--border)", borderRadius: 6, padding: "6px 7px", fontSize: 14, color: "var(--accent-light)", cursor: "pointer" }}>
                        📖
                      </button>
                      <span className="sgk-strip-label">Nội dung SGK</span>
                    </div>
                  ) : (
                    <>
                      <div className="panel-tabs">
                        <button
                          className={`panel-tab${rightTab === "sgk" ? " active" : ""}`}
                          onClick={() => setRightTab("sgk")}
                        >
                          📖 Nội dung SGK
                        </button>
                        <button
                          title="Thu gọn SGK"
                          onClick={() => setSgkCollapsed(true)}
                          style={{ marginLeft: "auto", background: "transparent", border: "none", color: "var(--text-muted)", fontSize: 13, padding: "0 12px", cursor: "pointer" }}
                        >▶</button>
                      </div>

                      {rightTab === "sgk" && (
                        <>
                          <div className="sgk-panel-header">
                            <h3>Sách giáo khoa · {selectedKcChapterInfo ?? "—"}</h3>
                            {selectedKcChapterInfo && (
                              <span className="sgk-badge">{selectedKcChapterInfo}</span>
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
                                  {selectedKcChapterInfo ?? "chapter_info chưa xác định"}
                                </span>
                              </div>
                            )}
                            {!sgkLoading && sgkContent && (
                              <SgkRenderer content={sgkContent} />
                            )}
                          </div>
                        </>
                      )}
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
