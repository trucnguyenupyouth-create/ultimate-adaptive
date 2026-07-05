"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  approveDraft,
  bulkApprove,
  createDraft,
  exportFlaggedDrafts,
  flagDraft,
  getDrafts,
  getV2ReviewItems,
  getSgkContent,
  getStatus,
  rejectDraft,
  revertDraft,
  runGeneration,
  updateDraft,
  updateV2ReviewItem,
} from "@/lib/question-gen-api";
import type {
  CostSummary,
  ItemDraft,
  KCStats,
  MCQAnswer,
  MCQContent,
  SgkResponse,
  StatusResponse,
  V2ReviewItem,
} from "@/lib/question-gen-api";
import { itemApi } from "@/lib/api";
import type { Item } from "@/lib/api";
import ImageManager from "@/components/ImageManager";

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
  .badge-empty { background: transparent; color: #f97316; border: 1px dashed #f97316; } /* no drafts yet */

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

  /* Assessment V2 review */
  .v2-review { display: flex; flex-direction: column; overflow: hidden; height: 100%; background: var(--bg); }
  .v2-review-header { padding: 18px 24px; border-bottom: 1px solid var(--border); background: var(--surface); display: flex; gap: 16px; align-items: flex-start; justify-content: space-between; flex-wrap: wrap; }
  .v2-review-title { display: flex; flex-direction: column; gap: 6px; min-width: 280px; }
  .v2-review-title h2 { font-size: 18px; color: var(--accent-light); margin: 0; }
  .v2-review-title p { color: var(--text-muted); font-size: 13px; line-height: 1.5; max-width: 780px; }
  .v2-summary { display: flex; gap: 8px; flex-wrap: wrap; }
  .v2-chip { background: var(--surface2); border: 1px solid var(--border); border-radius: 8px; padding: 7px 10px; font-size: 12px; display: inline-flex; gap: 6px; align-items: center; }
  .v2-chip strong { font-size: 15px; color: var(--text); }
  .v2-controls { padding: 12px 24px; border-bottom: 1px solid var(--border); background: var(--surface); display: flex; gap: 10px; flex-wrap: wrap; align-items: center; }
  .v2-select, .v2-input { background: var(--surface2); border: 1px solid var(--border); color: var(--text); border-radius: 8px; padding: 8px 10px; font-family: inherit; font-size: 13px; outline: none; }
  .v2-input { min-width: 260px; }
  .v2-scroll { overflow: auto; flex: 1; padding: 20px 24px 32px; display: grid; grid-template-columns: minmax(0, 1fr) 360px; gap: 18px; align-items: start; }
  .v2-list { display: flex; flex-direction: column; gap: 12px; }
  .v2-card { background: var(--surface); border: 1px solid var(--border); border-radius: 10px; overflow: hidden; }
  .v2-card.needs-review { border-color: #7c5f1f; }
  .v2-card-header { padding: 12px 14px; background: var(--surface2); border-bottom: 1px solid var(--border); display: flex; gap: 8px; flex-wrap: wrap; align-items: center; }
  .v2-card-body { padding: 14px; display: flex; flex-direction: column; gap: 12px; }
  .v2-question { font-size: 14px; line-height: 1.6; color: var(--text); }
  .v2-meta-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 8px; }
  .v2-meta { background: var(--surface2); border: 1px solid var(--border); border-radius: 8px; padding: 8px 10px; font-size: 12px; color: var(--text-muted); }
  .v2-meta strong { color: var(--text); display: block; margin-top: 2px; word-break: break-word; }
  .v2-kc-list { display: flex; flex-wrap: wrap; gap: 5px; }
  .v2-kc-pill { font-family: 'JetBrains Mono', monospace; font-size: 10px; color: var(--text-muted); background: var(--surface2); border: 1px solid var(--border); border-radius: 999px; padding: 3px 7px; }
  .v2-warning { background: #2a1a08; border: 1px solid #a16207; color: #fbbf24; border-radius: 8px; padding: 8px 10px; font-size: 12px; line-height: 1.5; }
  .v2-patterns { display: flex; flex-direction: column; gap: 6px; }
  .v2-pattern { background: var(--surface2); border: 1px solid var(--border); border-radius: 8px; padding: 8px 10px; font-size: 12px; line-height: 1.5; }
  .v2-actions { display: flex; flex-direction: column; gap: 6px; }
  .v2-action-note { background: #111827; border: 1px solid #334155; border-radius: 8px; padding: 8px 10px; font-size: 12px; line-height: 1.5; color: var(--text-muted); }
  .v2-action-note strong { color: #93c5fd; }
  .v2-side { display: flex; flex-direction: column; gap: 12px; position: sticky; top: 0; }
  .v2-panel { background: var(--surface); border: 1px solid var(--border); border-radius: 10px; padding: 14px; }
  .v2-panel h3 { font-size: 13px; color: var(--accent-light); margin-bottom: 10px; text-transform: uppercase; letter-spacing: 0.06em; }
  .v2-panel ul { padding-left: 18px; color: var(--text-muted); font-size: 12px; line-height: 1.7; }
  .v2-panel li strong { color: var(--text); }
  .v2-status-row { display: flex; gap: 6px; flex-wrap: wrap; margin-top: 2px; }
  .v2-status-button { background: transparent; border: 1px solid var(--border); color: var(--text-muted); font-size: 11px; padding: 5px 8px; border-radius: 999px; }
  .v2-status-button.active { background: var(--accent); border-color: var(--accent); color: white; }
  .v2-comment { width: 100%; min-height: 72px; background: var(--surface2); border: 1px solid var(--border); color: var(--text); border-radius: 8px; padding: 9px 10px; font-family: inherit; font-size: 12px; line-height: 1.5; resize: vertical; outline: none; }
  .v2-comment:focus { border-color: var(--accent); }
  .v2-row-actions { display: flex; gap: 8px; align-items: center; flex-wrap: wrap; }
  .v2-risk-row { display: flex; gap: 6px; flex-wrap: wrap; align-items: center; }
  .v2-risk-tag { background: #3b1d0a; border: 1px solid #b45309; color: #fdba74; border-radius: 999px; padding: 3px 8px; font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.03em; }
  .v2-risk-tag.ready { background: #052e16; border-color: #15803d; color: #86efac; }
  .v2-action-required { background: #1e1b4b; border: 1px solid #6366f1; color: #c7d2fe; border-radius: 8px; padding: 8px 10px; font-size: 12px; line-height: 1.5; }
  .v2-replacement { background: #101827; border: 1px solid #334155; border-radius: 8px; padding: 9px 10px; font-size: 12px; line-height: 1.55; color: var(--text-muted); }
  .v2-replacement strong { color: var(--text); }
  .v2-save-state { font-size: 11px; color: var(--text-muted); }
  .v2-save-state.saved { color: var(--green); }
  .v2-save-state.failed { color: var(--red); }
  .v2-workbench { background: #111827; border: 1px solid #334155; border-radius: 8px; padding: 10px; display: flex; flex-direction: column; gap: 10px; }
  .v2-workbench-title { color: #93c5fd; font-size: 11px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.06em; }
  .v2-edit-grid { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 8px; }
  .v2-edit-grid label, .v2-field { display: flex; flex-direction: column; gap: 5px; color: var(--text-muted); font-size: 11px; font-weight: 700; }
  .v2-wide-input { width: 100%; min-width: 0; }
  @media (max-width: 900px) { .v2-edit-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); } }
  @media (max-width: 1250px) { .v2-scroll { grid-template-columns: 1fr; } .v2-side { position: static; } }
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

        {/* Image manager — lazy loaded per draft */}
        <ImageManager target={{ draftId: draft.id }} />
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

type V2LocalStatus = "needs_review" | "revise" | "accepted" | "rejected";
type V2RiskFilter = "all" | "mcq_disguised" | "binary_disguised" | "needs_widget_checker" | "fragile_text_grader" | "ready_for_algorithm";

const RISK_FILTER_LABELS: Record<V2RiskFilter, string> = {
  all: "All risk states",
  mcq_disguised: "MCQ disguised",
  binary_disguised: "Binary",
  needs_widget_checker: "Needs parser/widget",
  fragile_text_grader: "Fragile text grader",
  ready_for_algorithm: "Ready for algorithm",
};

const ACTION_LABELS: Record<string, string> = {
  replace_required: "Replace required",
  needs_widget_checker: "Needs widget/checker",
  human_review_only: "Human review only",
  review_risk: "Review risk",
  ready_for_algorithm: "Ready for algorithm",
};

function itemReviewWarnings(item: V2ReviewItem): string[] {
  const warnings: string[] = [];
  for (const tag of item.risk_tags ?? []) {
    if (tag === "mcq_disguised") warnings.push("MCQ trá hình: đáp án/không gian lựa chọn nằm ngay trong đề, guessing vẫn cao.");
    else if (tag === "binary_disguised") warnings.push("Binary item: học sinh có thể đoán Có/Không với xác suất cao.");
    else if (tag === "ordered_list_widget") warnings.push("Cần ordered-list widget, không nên chấm bằng string tự do.");
    else if (tag === "expression_parser_widget") warnings.push("Cần parser/widget cho biểu thức, không nên chấm bằng exact text.");
    else if (tag === "fragile_text_grader") warnings.push("Accepted answers dài/đa dạng, heuristic string match dễ false negative.");
    else if (tag === "reasoning_hard_to_auto_grade") warnings.push("Reasoning tự do khó auto-grade chắc; chỉ dùng khi có rubric/NLP/manual review.");
    else if (tag === "needs_widget_checker") warnings.push("Bị chặn khỏi algorithm-ready cho đến khi có widget/checker phù hợp.");
    else warnings.push(tag);
  }
  if (!item.academic_reviewed) warnings.push("Chưa academic review.");
  if (item.inference_strength === "weak") warnings.push("Đang để weak inference; cần reviewer quyết định có nâng lên medium/strong không.");
  if (item.answer_type === "short_text") warnings.push("short_text cần rubric hoặc redesign thành structured input để auto-grade chắc hơn.");
  if (!item.requires_kcs?.length) warnings.push("requires_kcs đang trống; cần xác nhận có thật sự là root/atomic item không.");
  if (!item.common_wrong_patterns?.length) warnings.push("Thiếu common_wrong_patterns để diagnose misconception.");
  if (item.codex_review_status === "provisionally_accepted_for_algorithm_test_only") {
    warnings.push("Codex chỉ accept tạm cho algorithm fixture; chưa phải academic approval.");
  }
  for (const flag of item.flags ?? []) warnings.push(flag);
  return warnings;
}

const ANSWER_WIDGETS = ["number", "fraction", "decimal", "power", "expression", "ordered_list", "set", "probability", "coordinate_pair", "ordered_pair_list"];
const CHECKER_TYPES = ["numeric_equal", "fraction_equal", "decimal_equal", "power_tuple", "expression_equivalent", "ordered_list_equal", "set_equal", "probability_equal", "coordinate_pair_equal", "ordered_pair_list_equal", "rubric_manual"];
const PILOT_STATUSES = ["not_ready", "ready_for_pilot", "retired"];
const REVIEW_ACTIONS = ["accept", "revise", "replace", "needs_checker", "needs_widget"];
const ITEM_ROLES = ["", "anchor", "misconception", "confirmation", "transfer", "bridge", "readiness"];

function V2PilotWorkbench({
  item,
  disabled,
  onSave,
}: {
  item: V2ReviewItem;
  disabled: boolean;
  onSave: (patch: Parameters<typeof updateV2ReviewItem>[1]) => void;
}) {
  const [question, setQuestion] = useState(item.question);
  const [accepted, setAccepted] = useState((item.accepted_answers ?? []).join("; "));
  const [notes, setNotes] = useState(item.review_notes ?? "");
  const [scope, setScope] = useState(item.official_assessment_scope ?? "");
  const [path, setPath] = useState(item.target_exam_path ?? "");
  const [family, setFamily] = useState(item.item_family ?? "");
  const [signature, setSignature] = useState(item.surface_signature ?? "");
  const [parameterSet, setParameterSet] = useState(item.parameter_set ?? "");

  useEffect(() => {
    setQuestion(item.question);
    setAccepted((item.accepted_answers ?? []).join("; "));
    setNotes(item.review_notes ?? "");
    setScope(item.official_assessment_scope ?? "");
    setPath(item.target_exam_path ?? "");
    setFamily(item.item_family ?? "");
    setSignature(item.surface_signature ?? "");
    setParameterSet(item.parameter_set ?? "");
  }, [item.review_id, item.question, item.accepted_answers, item.review_notes, item.official_assessment_scope, item.target_exam_path, item.item_family, item.surface_signature, item.parameter_set]);

  const blockers = item.pilot_blockers ?? [];
  const qualityErrors = item.official_quality?.errors ?? [];
  const qualityWarnings = item.official_quality?.warnings ?? [];
  return (
    <div className="v2-workbench">
      <div className="v2-workbench-title">Pilot readiness workbench</div>
      <div className="v2-edit-grid">
        <label>
          Pilot status
          <select className="v2-select" value={item.pilot_status ?? "not_ready"} disabled={disabled} onChange={(event) => onSave({ pilot_status: event.target.value, note: `Pilot status set to ${event.target.value}` })}>
            {PILOT_STATUSES.map((value) => <option key={value} value={value}>{value}</option>)}
          </select>
        </label>
        <label>
          Review action
          <select className="v2-select" value={item.review_action ?? "revise"} disabled={disabled} onChange={(event) => onSave({ review_action: event.target.value, note: `Review action set to ${event.target.value}` })}>
            {REVIEW_ACTIONS.map((value) => <option key={value} value={value}>{value}</option>)}
          </select>
        </label>
        <label>
          Item role
          <select className="v2-select" value={item.item_role ?? ""} disabled={disabled} onChange={(event) => onSave({ item_role: event.target.value, note: `Item role set to ${event.target.value}` })}>
            {ITEM_ROLES.map((value) => <option key={value || "blank"} value={value}>{value || "Unset"}</option>)}
          </select>
        </label>
        <label>
          Answer widget
          <select className="v2-select" value={item.answer_widget ?? "number"} disabled={disabled} onChange={(event) => onSave({ answer_widget: event.target.value, note: `Answer widget set to ${event.target.value}` })}>
            {ANSWER_WIDGETS.map((value) => <option key={value} value={value}>{value}</option>)}
          </select>
        </label>
        <label>
          Checker
          <select className="v2-select" value={item.checker_type ?? "numeric_equal"} disabled={disabled} onChange={(event) => onSave({ checker_type: event.target.value, note: `Checker set to ${event.target.value}` })}>
            {CHECKER_TYPES.map((value) => <option key={value} value={value}>{value}</option>)}
          </select>
        </label>
      </div>
      <div className="v2-edit-grid">
        <label>
          Official scope
          <input className="v2-input" value={scope} onChange={(event) => setScope(event.target.value)} placeholder="grade8_exam_path" />
        </label>
        <label>
          Exam path
          <input className="v2-input" value={path} onChange={(event) => setPath(event.target.value)} placeholder="rational_expression" />
        </label>
        <label>
          Item family
          <input className="v2-input" value={family} onChange={(event) => setFamily(event.target.value)} placeholder="combine_rational_unlike_denominators" />
        </label>
        <label>
          Parameter set
          <input className="v2-input" value={parameterSet} onChange={(event) => setParameterSet(event.target.value)} placeholder="x2_minus_2_over_x_xplus2" />
        </label>
      </div>
      <label className="v2-field">
        Surface signature
        <input className="v2-input v2-wide-input" value={signature} onChange={(event) => setSignature(event.target.value)} />
      </label>
      <label className="v2-field">
        Question
        <textarea className="v2-comment" value={question} onChange={(event) => setQuestion(event.target.value)} />
      </label>
      <label className="v2-field">
        Accepted answers, separated by semicolon
        <input className="v2-input v2-wide-input" value={accepted} onChange={(event) => setAccepted(event.target.value)} />
      </label>
      <label className="v2-field">
        Review notes
        <textarea className="v2-comment" value={notes} onChange={(event) => setNotes(event.target.value)} />
      </label>
      {blockers.length > 0 && (
        <div className="v2-warning">
          <strong>Pilot blockers:</strong> {blockers.join(", ")}
        </div>
      )}
      {(qualityErrors.length > 0 || qualityWarnings.length > 0) && (
        <div className="v2-warning">
          <strong>Official quality:</strong> {[...qualityErrors.map((value) => `error:${value}`), ...qualityWarnings.map((value) => `warn:${value}`)].join(", ")}
        </div>
      )}
      <div className="v2-row-actions">
        <button
          className="btn-primary btn-sm"
          disabled={disabled}
          onClick={() => onSave({
            question,
            accepted_answers: accepted.split(";").map((value) => value.trim()).filter(Boolean),
            review_notes: notes,
            official_assessment_scope: scope,
            target_exam_path: path,
            item_family: family,
            surface_signature: signature,
            parameter_set: parameterSet,
            note: "Reviewer saved pilot item fields",
          })}
        >
          Save pilot fields
        </button>
        {item.suggested_replacement && (
          <button
            className="btn-ghost btn-sm"
            disabled={disabled}
            onClick={() => onSave({
              question: item.suggested_replacement?.question,
              answer_type: item.suggested_replacement?.answer_type,
              accepted_answers: item.suggested_replacement?.accepted_answers ?? [],
              review_action: "revise",
              pilot_status: "not_ready",
              note: "Reviewer applied suggested replacement draft",
            })}
          >
            Apply suggested replacement
          </button>
        )}
        <button
          className="btn-success btn-sm"
          disabled={disabled || blockers.length > 0}
          onClick={() => onSave({
            review_decision: "accepted",
            review_action: "accept",
            pilot_status: "ready_for_pilot",
            note: "Reviewer marked item ready for pilot",
          })}
        >
          Mark ready for pilot
        </button>
      </div>
    </div>
  );
}

function AssessmentV2ReviewPanel() {
  const [items, setItems] = useState<V2ReviewItem[]>([]);
  const [gapRecords, setGapRecords] = useState<Array<Record<string, unknown> & { cluster: string }>>([]);
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [commentDrafts, setCommentDrafts] = useState<Record<string, string>>({});
  const [saveStatusById, setSaveStatusById] = useState<Record<string, "saved" | "failed">>({});

  const loadReviewItems = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await getV2ReviewItems();
      setItems(res.items);
      setGapRecords(res.gap_records);
      setCommentDrafts(Object.fromEntries(res.items.map((item) => [item.review_id, item.review_comment ?? ""])));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Không tải được V2 review items");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadReviewItems();
  }, [loadReviewItems]);

  const clusters = React.useMemo(
    () => Array.from(new Set(items.map((item) => item.cluster))),
    [items]
  );
  const [cluster, setCluster] = useState("all");
  const [riskFilter, setRiskFilter] = useState<V2RiskFilter>("all");
  const [query, setQuery] = useState("");

  const stats = React.useMemo(() => {
    const shortText = items.filter((item) => item.answer_type === "short_text").length;
    const missingRequires = items.filter((item) => !item.requires_kcs?.length).length;
    const anchors = items.filter((item) => item.is_diagnostic_anchor).length;
    const patterns = items.reduce((sum, item) => sum + (item.common_wrong_patterns?.length ?? 0), 0);
    const codexAdded = items.filter((item) => item.codex_review_status === "provisionally_accepted_for_algorithm_test_only").length;
    const flagged = items.filter((item) => item.flagged_for_review).length;
    const blocked = items.filter((item) => item.grader_readiness !== "ready").length;
    const ready = items.filter((item) => item.grader_readiness === "ready").length;
    return { shortText, missingRequires, anchors, patterns, codexAdded, flagged, blocked, ready };
  }, [items]);

  const filtered = React.useMemo(() => {
    const q = query.trim().toLowerCase();
    return items.filter((item) => {
      if (cluster !== "all" && item.cluster !== cluster) return false;
      if (riskFilter === "ready_for_algorithm" && item.grader_readiness !== "ready") return false;
      if (riskFilter !== "all" && riskFilter !== "ready_for_algorithm") {
        const tags = item.risk_tags ?? [];
        if (riskFilter === "needs_widget_checker") {
          if (!tags.includes("needs_widget_checker") && item.recommended_review_action !== "needs_widget_checker") return false;
        } else if (!tags.includes(riskFilter)) {
          return false;
        }
      }
      if (!q) return true;
      return (
        item.question.toLowerCase().includes(q) ||
        item.kc_id.toLowerCase().includes(q) ||
        item.answer_type.toLowerCase().includes(q) ||
        item.cluster.toLowerCase().includes(q) ||
        (item.risk_tags ?? []).some((tag) => tag.toLowerCase().includes(q)) ||
        (item.recommended_review_action ?? "").toLowerCase().includes(q)
      );
    });
  }, [cluster, riskFilter, query, items]);

  const statusCounts = React.useMemo(() => {
    const counts: Record<V2LocalStatus, number> = { needs_review: 0, revise: 0, accepted: 0, rejected: 0 };
    items.forEach((item) => {
      counts[item.review_decision ?? "needs_review"] += 1;
    });
    return counts;
  }, [items]);

  const persistItem = useCallback(async (
    item: V2ReviewItem,
    patch: Parameters<typeof updateV2ReviewItem>[1],
  ) => {
    setSavingId(item.review_id);
    setError(null);
    setSaveStatusById((prev) => {
      const next = { ...prev };
      delete next[item.review_id];
      return next;
    });
    try {
      const updated = await updateV2ReviewItem(item.review_id, patch);
      setItems((prev) => prev.map((row) => row.review_id === updated.review_id ? updated : row));
      setCommentDrafts((prev) => ({ ...prev, [updated.review_id]: updated.review_comment ?? "" }));
      setSaveStatusById((prev) => ({ ...prev, [updated.review_id]: "saved" }));
      window.setTimeout(() => {
        setSaveStatusById((prev) => {
          const next = { ...prev };
          delete next[item.review_id];
          return next;
        });
      }, 3000);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Không lưu được review state");
      setSaveStatusById((prev) => ({ ...prev, [item.review_id]: "failed" }));
    } finally {
      setSavingId(null);
    }
  }, []);

  return (
    <div className="v2-review">
      <div className="v2-review-header">
        <div className="v2-review-title">
          <h2>Assessment V2 Open Diagnostic Review</h2>
          <p>
            60 local open-ended review items for Grade 6 algebra/non-geometry: 29 AI drafts plus 31 Codex-added
            pilot fixtures. Đây là khu vực review học thuật, chưa import vào Item Bank và không dùng để approve production.
          </p>
        </div>
        <div className="v2-summary">
          <span className="v2-chip"><strong>{items.length}</strong> items</span>
          <span className="v2-chip"><strong>{stats.anchors}</strong> anchors</span>
          <span className="v2-chip"><strong>{stats.shortText}</strong> short_text</span>
          <span className="v2-chip"><strong>{stats.missingRequires}</strong> missing requires_kcs</span>
          <span className="v2-chip"><strong>{stats.codexAdded}</strong> Codex-added</span>
          <span className="v2-chip"><strong>{stats.flagged}</strong> flagged</span>
          <span className="v2-chip"><strong>{stats.blocked}</strong> blocked</span>
          <span className="v2-chip"><strong>{stats.ready}</strong> ready</span>
          <span className="v2-chip"><strong>{gapRecords.length}</strong> gap records</span>
        </div>
      </div>

      <div className="v2-controls">
        <select className="v2-select" value={cluster} onChange={(event) => setCluster(event.target.value)}>
          <option value="all">All clusters</option>
          {clusters.map((name) => <option key={name} value={name}>{name}</option>)}
        </select>
        <select className="v2-select" value={riskFilter} onChange={(event) => setRiskFilter(event.target.value as V2RiskFilter)}>
          {(Object.keys(RISK_FILTER_LABELS) as V2RiskFilter[]).map((key) => (
            <option key={key} value={key}>{RISK_FILTER_LABELS[key]}</option>
          ))}
        </select>
        <input
          className="v2-input"
          placeholder="Search item, KC id, answer type, risk tag..."
          value={query}
          onChange={(event) => setQuery(event.target.value)}
        />
        <span style={{ color: "var(--text-muted)", fontSize: 12 }}>
          Showing {filtered.length}/{items.length}
        </span>
        <button className="btn-ghost btn-sm" onClick={loadReviewItems} disabled={loading}>
          {loading ? "Loading..." : "Reload saved reviews"}
        </button>
        {error && <span style={{ color: "var(--red)", fontSize: 12 }}>{error}</span>}
      </div>

      <div className="v2-scroll">
        <div className="v2-list">
          {loading && (
            <div className="empty">
              <div className="spinner" />
              <span>Đang tải V2 review items...</span>
            </div>
          )}
          {filtered.map((item) => {
            const warnings = itemReviewWarnings(item);
            const localStatus = item.review_decision ?? "needs_review";
            return (
              <div key={item.review_id} className={`v2-card${warnings.length ? " needs-review" : ""}`}>
                <div className="v2-card-header">
                  <span className="badge badge-purple">{item.review_id}</span>
                  <span className="badge badge-blue">{item.cluster}</span>
                  <span className="diff-pill diff-medium">{item.answer_type}</span>
                  <span className="anchor-pill">{item.difficulty_label}</span>
                  {item.is_diagnostic_anchor && <span className="badge badge-green">anchor</span>}
                  <span className="badge badge-gray">{item.inference_strength} inference</span>
                  {item.codex_review_status === "provisionally_accepted_for_algorithm_test_only" && (
                    <span className="badge badge-blue">Codex added</span>
                  )}
                  <span className={`v2-risk-tag${item.grader_readiness === "ready" ? " ready" : ""}`}>
                    {item.grader_readiness === "ready" ? "algorithm ready" : "blocked"}
                  </span>
                  {item.recommended_review_action && (
                    <span className="v2-risk-tag">
                      {ACTION_LABELS[item.recommended_review_action] ?? item.recommended_review_action}
                    </span>
                  )}
                  {!item.academic_reviewed && <span className="badge badge-yellow">needs academic review</span>}
                  {item.flagged_for_review && <span className="badge badge-flag">flagged</span>}
                </div>
                <div className="v2-card-body">
                  <div className="v2-question">{item.question}</div>

                  <div className="v2-risk-row">
                    {(item.risk_tags?.length ? item.risk_tags : ["no_structural_risk_detected"]).map((tag) => (
                      <span className={`v2-risk-tag${tag === "no_structural_risk_detected" ? " ready" : ""}`} key={`${item.review_id}-${tag}`}>
                        {tag}
                      </span>
                    ))}
                  </div>

                  {item.recommended_review_action && item.recommended_review_action !== "ready_for_algorithm" && (
                    <div className="v2-action-required">
                      <strong>Recommended action:</strong> {ACTION_LABELS[item.recommended_review_action] ?? item.recommended_review_action}
                      {item.required_checker ? ` · Required checker: ${item.required_checker}` : ""}
                    </div>
                  )}

                  {item.suggested_replacement && (
                    <div className="v2-replacement">
                      <strong>Suggested replacement:</strong> {item.suggested_replacement.question}
                      <br />
                      <strong>Answer type:</strong> {item.suggested_replacement.answer_type ?? "unspecified"}
                      {" · "}
                      <strong>Accepted:</strong> {(item.suggested_replacement.accepted_answers ?? []).join("; ") || "unspecified"}
                      {item.suggested_replacement.reason && (
                        <>
                          <br />
                          <strong>Why:</strong> {item.suggested_replacement.reason}
                        </>
                      )}
                    </div>
                  )}

                  <V2PilotWorkbench
                    item={item}
                    disabled={savingId === item.review_id}
                    onSave={(patch) => persistItem(item, patch)}
                  />

                  <div className="v2-status-row">
                    {(["needs_review", "revise", "accepted", "rejected"] as V2LocalStatus[]).map((state) => (
                      <button
                        key={state}
                        className={`v2-status-button${localStatus === state ? " active" : ""}`}
                        disabled={savingId === item.review_id}
                        onClick={() => persistItem(item, {
                          review_decision: state,
                          note: `Reviewer set decision to ${state}`,
                        })}
                      >
                        {state === "needs_review" ? "Needs review" : state === "revise" ? "Revise" : state === "accepted" ? "Accept" : "Reject"}
                      </button>
                    ))}
                    <button
                      className={`v2-status-button${item.flagged_for_review ? " active" : ""}`}
                      disabled={savingId === item.review_id}
                      onClick={() => persistItem(item, {
                        flagged_for_review: !item.flagged_for_review,
                        note: item.flagged_for_review ? "Reviewer removed flag" : "Reviewer flagged item",
                      })}
                    >
                      {item.flagged_for_review ? "Unflag" : "Flag"}
                    </button>
                    <button
                      className="v2-status-button"
                      disabled={savingId === item.review_id}
                      onClick={() => persistItem(item, {
                        review_decision: "revise",
                        flagged_for_review: true,
                        note: "Reviewer marked item as replace required / not open-ended enough",
                      })}
                    >
                      Mark replace required
                    </button>
                    <button
                      className="v2-status-button"
                      disabled={savingId === item.review_id}
                      onClick={() => persistItem(item, {
                        review_decision: "revise",
                        flagged_for_review: true,
                        note: "Reviewer marked item as needing widget/checker before algorithm use",
                      })}
                    >
                      Mark needs checker
                    </button>
                  </div>

                  <div className="v2-row-actions">
                    <textarea
                      className="v2-comment"
                      placeholder="Reviewer comment: what to fix, why accepted/rejected, inference concerns..."
                      value={commentDrafts[item.review_id] ?? ""}
                      onChange={(event) => setCommentDrafts((prev) => ({ ...prev, [item.review_id]: event.target.value }))}
                    />
                    <button
                      className="btn-primary btn-sm"
                      disabled={savingId === item.review_id}
                      onClick={() => persistItem(item, {
                        review_comment: commentDrafts[item.review_id] ?? "",
                        note: "Reviewer saved comment",
                      })}
                    >
                      {savingId === item.review_id ? "Saving..." : "Save comment"}
                    </button>
                    {saveStatusById[item.review_id] && (
                      <span className={`v2-save-state ${saveStatusById[item.review_id]}`}>
                        {saveStatusById[item.review_id] === "saved" ? "Saved" : "Save failed"}
                      </span>
                    )}
                    {item.reviewed_at && (
                      <span style={{ color: "var(--text-muted)", fontSize: 11 }}>
                        saved {new Date(item.reviewed_at).toLocaleString()}
                      </span>
                    )}
                  </div>

                  <div className="v2-meta-grid">
                    <div className="v2-meta">
                      Accepted answers
                      <strong>{item.accepted_answers.join("; ") || "missing"}</strong>
                    </div>
                    <div className="v2-meta">
                      Diagnoses KCs
                      <strong>{item.diagnoses_kcs.length}</strong>
                    </div>
                    <div className="v2-meta">
                      Requires KCs
                      <strong>{item.requires_kcs.length}</strong>
                    </div>
                    <div className="v2-meta">
                      Wrong patterns
                      <strong>{item.common_wrong_patterns.length}</strong>
                    </div>
                  </div>

                  {item.requires_kcs.length > 0 && (
                    <div>
                      <div style={{ fontSize: 11, color: "var(--text-muted)", marginBottom: 5 }}>requires_kcs</div>
                      <div className="v2-kc-list">
                        {item.requires_kcs.map((kc) => <span className="v2-kc-pill" key={kc}>{kc}</span>)}
                      </div>
                    </div>
                  )}

                  {warnings.length > 0 && (
                    <div className="v2-warning">
                      <strong>Review needed:</strong>
                      <ul style={{ paddingLeft: 18, marginTop: 4 }}>
                        {warnings.map((warning, index) => <li key={index}>{warning}</li>)}
                      </ul>
                    </div>
                  )}

                  <div className="v2-patterns">
                    {item.common_wrong_patterns.slice(0, 3).map((pattern, index) => (
                      <div className="v2-pattern" key={`${item.review_id}-pattern-${index}`}>
                        <strong>{pattern.pattern}</strong> · {pattern.diagnosis}
                      </div>
                    ))}
                  </div>

                  {item.action_notes && item.action_notes.length > 0 && (
                    <div className="v2-actions">
                      {item.action_notes.map((action, index) => (
                        <div className="v2-action-note" key={`${item.review_id}-action-${index}`}>
                          <strong>{action.action}</strong>: {action.note}
                          {action.concern && (
                            <div style={{ marginTop: 3, color: "#fbbf24" }}>Concern: {action.concern}</div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                  {item.review_history && item.review_history.length > 0 && (
                    <div style={{ color: "var(--text-muted)", fontSize: 11 }}>
                      Persisted review updates: {item.review_history.length}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        <aside className="v2-side">
          <div className="v2-panel">
            <h3>Todo Review</h3>
            <ul>
              <li><strong>{statusCounts.needs_review}</strong> items still need first-pass academic review.</li>
              <li><strong>{statusCounts.revise}</strong> marked revise and persisted.</li>
              <li><strong>{statusCounts.accepted}</strong> accepted and persisted.</li>
              <li><strong>{statusCounts.rejected}</strong> rejected and persisted.</li>
              <li><strong>{stats.flagged}</strong> flagged and persisted.</li>
              <li><strong>{stats.blocked}</strong> blocked from algorithm until redesign/checker.</li>
              <li><strong>{stats.ready}</strong> structurally ready for deterministic testing.</li>
            </ul>
          </div>
          <div className="v2-panel">
            <h3>Risk Filters</h3>
            <ul>
              <li><strong>{items.filter((item) => item.risk_tags?.includes("mcq_disguised")).length}</strong> MCQ disguised.</li>
              <li><strong>{items.filter((item) => item.risk_tags?.includes("binary_disguised")).length}</strong> binary answer risk.</li>
              <li><strong>{items.filter((item) => item.risk_tags?.includes("needs_widget_checker") || item.recommended_review_action === "needs_widget_checker").length}</strong> need parser/widget.</li>
              <li><strong>{items.filter((item) => item.risk_tags?.includes("fragile_text_grader")).length}</strong> fragile text grader.</li>
            </ul>
          </div>
          <div className="v2-panel">
            <h3>Required Decisions</h3>
            <ul>
              <li>Confirm primary KC and algebra/non-geometry scope.</li>
              <li>Fill or verify `requires_kcs` for every bridge item.</li>
              <li>Downgrade ambiguous wrong answers to weak inference.</li>
              <li>Redesign `short_text` items into structured input where possible.</li>
              <li>Only set strong inference after academic review.</li>
            </ul>
          </div>
          <div className="v2-panel">
            <h3>Gap Records</h3>
            <ul>
              {gapRecords.length === 0 ? (
                <li>No gap records parsed.</li>
              ) : gapRecords.map((gap, index) => (
                <li key={index}>
                  <strong>{String(gap.cluster)}</strong>: {String(gap.reason ?? gap.note ?? gap.gap ?? "needs item authoring")}
                </li>
              ))}
            </ul>
          </div>
          <div className="v2-panel">
            <h3>Next Step After Approval</h3>
            <ul>
              <li>Convert accepted items into reviewed V2 JSON fixtures.</li>
              <li>Run deterministic heuristic tests before AI simulation.</li>
              <li>Use student open-ended UI only after grading schema is stable.</li>
            </ul>
          </div>
        </aside>
      </div>
    </div>
  );
}



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
  const [reviewMode, setReviewMode] = useState<"mcq" | "v2">("mcq");
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
  const [pendingImageFiles, setPendingImageFiles] = useState<File[]>([]);
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
  const resetAddForm = () => {
    setAddForm({
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
    setPendingImageFiles([]);
  };

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
      // Upload any images selected before save
      if (pendingImageFiles.length > 0) {
        try {
          const { uploadImages } = await import("@/lib/image-api");
          await uploadImages(pendingImageFiles, { draftId: newDraft.id });
        } catch {
          show("⚠ Câu hỏi đã lưu nhưng ảnh tải lên thất bại. Thêm ảnh lại trong card.", "error");
        }
      }
      // Prepend — appears at top of draft list as pending
      setDrafts(prev => [newDraft, ...prev]);
      setStatus(prev => prev ? mutateKcStats(prev, selectedKcId, { pending: +1 }) : prev);
      show("✓ Đã lưu — xuất hiện đầu danh sách Chờ duyệt", "success");
      if (keepOpen) {
        setAddForm(prev => ({ ...prev, questionText: "", isEntryPoint: false, answers: prev.answers.map(a => ({ ...a, text: "", isCorrect: false })) }));
        setPendingImageFiles([]);
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
    if (k.total === 0) return "badge-empty";          // no drafts at all — newly visible
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
            <button
              className={reviewMode === "v2" ? "btn-primary" : "btn-ghost"}
              onClick={() => setReviewMode((mode) => mode === "v2" ? "mcq" : "v2")}
              title="Mở khu vực review Assessment V2 open-ended items"
            >
              {reviewMode === "v2" ? "V2 Review" : "Assessment V2 Review"}
            </button>

            {/* Hide Flagged toggle */}
            {reviewMode === "mcq" && (
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
            )}

            {/* Export flagged */}
            {reviewMode === "mcq" && (
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
            )}

            {/* Generate */}
            {reviewMode === "mcq" && (
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
            )}
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
                        <span
                          className={`badge ${getKcStatusClass(k)}`}
                          title={k.total === 0 ? "Chưa có câu hỏi nào — có thể Add thủ công hoặc Generate" : undefined}
                        >{k.total === 0 ? "0 câu" : k.total}</span>
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
                            <span
                              className={`badge ${getKcStatusClass(k)}`}
                              title={k.total === 0 ? "Chưa có câu hỏi nào — có thể Add thủ công hoặc Generate" : undefined}
                            >{k.total === 0 ? "0 câu" : k.total}</span>
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
            {reviewMode === "v2" ? (
              <AssessmentV2ReviewPanel />
            ) : !selectedKcId ? (
              <div className="no-kc">
                <div style={{ fontSize: 48 }}>📋</div>
                <div style={{ fontWeight: 600 }}>Chọn một Knowledge Component</div>
                <div style={{ fontSize: 12 }}>để xem và duyệt câu hỏi được generate</div>
              </div>
            ) : (
              <div className="content-split" style={{ gridTemplateColumns: sgkCollapsed ? "1fr 42px" : undefined }}>
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


                        {/* Image picker */}
                        <div style={{ marginTop: 10 }}>
                          <div style={{
                            fontSize: 11, fontWeight: 600, color: "var(--text-muted)",
                            marginBottom: 6, display: "flex", alignItems: "center", gap: 6,
                          }}>
                            🖼 Hinảnh đính kèm
                            <span style={{
                              fontSize: 10, background: "var(--surface3)",
                              border: "1px solid var(--border)", borderRadius: 4,
                              padding: "1px 5px",
                            }}>
                              {pendingImageFiles.length}/5
                            </span>
                          </div>
                          {pendingImageFiles.length > 0 && (
                            <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 6 }}>
                              {pendingImageFiles.map((f, idx) => (
                                <div key={idx} style={{
                                  position: "relative", width: 64, height: 64,
                                  borderRadius: 6, overflow: "hidden",
                                  border: "1.5px solid var(--border)",
                                }}>
                                  {/* eslint-disable-next-line @next/next/no-img-element */}
                                  <img src={URL.createObjectURL(f)} alt={f.name}
                                    style={{ width: "100%", height: "100%", objectFit: "contain", background: "rgba(0,0,0,0.2)" }} />
                                  <button
                                    onClick={() => setPendingImageFiles(prev => prev.filter((_, j) => j !== idx))}
                                    title="Xóa"
                                    style={{
                                      position: "absolute", top: 2, right: 2,
                                      background: "rgba(200,50,50,0.85)", border: "none",
                                      borderRadius: 3, color: "#fff", fontSize: 10,
                                      width: 16, height: 16, lineHeight: "16px",
                                      cursor: "pointer", textAlign: "center",
                                    }}
                                  >×</button>
                                </div>
                              ))}
                            </div>
                          )}
                          {pendingImageFiles.length < 5 && (
                            <div
                              onDragOver={e => { e.preventDefault(); e.currentTarget.style.borderColor = "var(--accent)"; }}
                              onDragLeave={e => { e.currentTarget.style.borderColor = "var(--border)"; }}
                              onDrop={e => {
                                e.preventDefault();
                                e.currentTarget.style.borderColor = "var(--border)";
                                const allowed = ["image/jpeg","image/png","image/webp","image/gif"];
                                const files = Array.from(e.dataTransfer.files).filter(f => allowed.includes(f.type) && f.size <= 5*1024*1024);
                                setPendingImageFiles(prev => [...prev, ...files].slice(0, 5));
                              }}
                              onClick={() => {
                                const input = document.createElement("input");
                                input.type = "file"; input.multiple = true;
                                input.accept = "image/jpeg,image/png,image/webp,image/gif";
                                input.onchange = e => {
                                  const files = Array.from((e.target as HTMLInputElement).files ?? []).filter(f => f.size <= 5*1024*1024);
                                  setPendingImageFiles(prev => [...prev, ...files].slice(0, 5));
                                };
                                input.click();
                              }}
                              style={{
                                border: "1.5px dashed var(--border)", borderRadius: 8,
                                padding: "8px 12px", textAlign: "center", cursor: "pointer",
                                fontSize: 11, color: "var(--text-muted)",
                                background: "var(--surface3)", transition: "border-color 0.15s",
                              }}
                            >
                              📎 Kéo thả hoặc nhấn để chọn ảnh · JPG / PNG / WebP · tối đa 5MB
                            </div>
                          )}
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
