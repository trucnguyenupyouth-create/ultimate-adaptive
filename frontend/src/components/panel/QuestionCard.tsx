"use client";

import { useState, useCallback } from "react";
import { Pencil, ChevronUp, Anchor } from "lucide-react";
import { Item, MCQContent, OpenContent, itemApi } from "@/lib/api";
import MCQAnswerEditor from "./MCQAnswerEditor";
import type { DifficultyLabel } from "./QuestionsTab";
import ImageManager from "@/components/ImageManager";

interface Props {
  item: Item;
  kcId: string;
  isEditing: boolean;
  onEdit: () => void;
  onCancelEdit: () => void;
  onEdited: () => Promise<void>;
}

const DIFFICULTY_CONFIG: Record<DifficultyLabel, { label: string; color: string; bg: string; border: string; irt_b: string }> = {
  easy:   { label: "Dễ",        color: "#3fb950", bg: "rgba(63,185,80,0.08)",   border: "rgba(63,185,80,0.5)",  irt_b: "b = −1.0" },
  medium: { label: "Trung bình", color: "#388bfd", bg: "rgba(56,139,253,0.08)",  border: "rgba(56,139,253,0.5)", irt_b: "b = 0.0"  },
  hard:   { label: "Khó",        color: "#a371f7", bg: "rgba(163,113,247,0.08)", border: "rgba(163,113,247,0.5)",irt_b: "b = +1.5" },
};

const isOpen = (item: Item) => item.format_type === "open";

export default function QuestionCard({
  item, kcId, isEditing, onEdit, onCancelEdit, onEdited,
}: Props) {
  const open = isOpen(item);
  const mcqContent = item.content as MCQContent;
  const openContent = item.content as OpenContent;
  const cfg = DIFFICULTY_CONFIG[item.difficulty_label as DifficultyLabel] ?? DIFFICULTY_CONFIG.medium;

  // ── Edit form state ──────────────────────────────────────────────────────
  const [editDifficulty, setEditDifficulty] = useState<DifficultyLabel>(item.difficulty_label as DifficultyLabel);
  const [editQuestion, setEditQuestion] = useState(item.content.question);
  // MCQ-specific
  const [editAnswers, setEditAnswers] = useState(
    (mcqContent.answers ?? []).map((a, i) => ({
      id: `edit_${i}`,
      text: a.text,
      isCorrect: a.is_correct,
    }))
  );
  // Open-specific
  const [editExpected, setEditExpected] = useState(openContent.expected_answer ?? "");

  const [editSaving, setEditSaving] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);

  // ── Anchor state ──────────────────────────────────────────────────
  const [isAnchor, setIsAnchor] = useState(item.is_diagnostic_anchor ?? false);
  const [anchorLoading, setAnchorLoading] = useState(false);
  const [anchorWarning, setAnchorWarning] = useState<string | null>(null);

  const handleToggleAnchor = useCallback(async () => {
    setAnchorLoading(true);
    setAnchorWarning(null);
    try {
      const res = await itemApi.toggleAnchor(item.id, !isAnchor);
      setIsAnchor(res.is_diagnostic_anchor);
      if (res.warning) setAnchorWarning(res.warning);
    } catch (e) {
      console.error("Toggle anchor failed", e);
    } finally {
      setAnchorLoading(false);
    }
  }, [item.id, isAnchor]);

  const handleEditSave = async () => {
    setEditError(null);
    if (!editQuestion.trim()) { setEditError("Câu hỏi không được để trống"); return; }

    if (!open) {
      if (!editAnswers.some(a => a.isCorrect)) { setEditError("Chưa chọn đáp án đúng"); return; }
      if (editAnswers.filter(a => a.text.trim()).length < 2) { setEditError("Cần ít nhất 2 đáp án"); return; }
    } else {
      if (!editExpected.trim()) { setEditError("Đáp án không được để trống"); return; }
    }

    setEditSaving(true);
    try {
      const content = open
        ? { question: editQuestion, expected_answer: editExpected }
        : {
            question: editQuestion,
            answers: editAnswers
              .filter(a => a.text.trim())
              .map((a, i) => ({
                label: String.fromCharCode(65 + i),
                text: a.text,
                is_correct: a.isCorrect,
              })),
          };

      await itemApi.edit(item.id, {
        kc_id: kcId,
        difficulty_label: open ? "medium" : editDifficulty,
        format_type: item.format_type as "mcq4" | "open",
        content,
      });
      await onEdited();
    } catch (err: unknown) {
      setEditError(err instanceof Error ? err.message : "Lỗi lưu");
    } finally {
      setEditSaving(false);
    }
  };

  return (
    <div
      style={{
        borderRadius: 8,
        border: `1px solid var(--border)`,
        background: "var(--bg-elevated)",
        overflow: "hidden",
        transition: "all 0.15s ease",
      }}
    >
      {/* ── Collapsed header ── */}
      <div style={{ padding: "10px 12px" }}>
        {/* Images — always shown above question text */}
        <ImageManager target={{ itemId: item.id }} />

        {/* Question text */}
        <div
          style={{
            fontSize: 12,
            color: "var(--text-primary)",
            lineHeight: 1.5,
            marginBottom: 6,
            display: "-webkit-box",
            WebkitLineClamp: isEditing ? undefined : 2,
            WebkitBoxOrient: "vertical",
            overflow: isEditing ? "visible" : "hidden",
          }}
        >
          {item.content.question}
        </div>

        {/* Open: show expected answer in read mode */}
        {!isEditing && open && openContent.expected_answer && (
          <div
            style={{
              fontSize: 11,
              color: "var(--text-secondary)",
              background: "rgba(63,185,80,0.06)",
              border: "1px solid rgba(63,185,80,0.2)",
              borderRadius: 5,
              padding: "4px 8px",
              marginBottom: 6,
            }}
          >
            <span style={{ color: "#3fb950", fontWeight: 600, marginRight: 4 }}>Đáp án:</span>
            {openContent.expected_answer}
          </div>
        )}

        {/* Footer row */}
        <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
          {/* Entry Point badge */}
          {isAnchor && (
            <span
              title="Diagnostic Anchor: câu này được chọn làm Entry Point cho Cold Start CAT"
              style={{
                fontSize: 10, fontWeight: 700, padding: "2px 7px", borderRadius: 20,
                color: "#e3a100",
                background: "rgba(227,161,0,0.12)",
                border: "1px solid rgba(227,161,0,0.5)",
                display: "inline-flex", alignItems: "center", gap: 3,
              }}
            >
              <Anchor size={9} />
              Entry Point
            </span>
          )}
          {/* Difficulty badge — only for MCQ */}
          {!open && (
            <span style={{
              fontSize: 10, fontWeight: 600, padding: "2px 8px", borderRadius: 20,
              color: cfg.color, background: cfg.bg, border: `1px solid ${cfg.border}`,
            }}>
              {cfg.label}
            </span>
          )}
          {/* Format badge */}
          <span style={{
            fontSize: 10, fontWeight: 600, padding: "2px 8px", borderRadius: 20,
            color: open ? "#3fb950" : "#388bfd",
            background: open ? "rgba(63,185,80,0.1)" : "rgba(56,139,253,0.1)",
            border: open ? "1px solid rgba(63,185,80,0.2)" : "1px solid rgba(56,139,253,0.2)",
          }}>
            {open ? "Open" : "MCQ"}
          </span>
          <div style={{ flex: 1 }} />
          {/* Anchor toggle button */}
          <button
            onClick={handleToggleAnchor}
            disabled={anchorLoading}
            title={isAnchor ? "Bỏ tag Entry Point" : "Tag làm Entry Point (Diagnostic Anchor)"}
            style={{
              padding: "3px 6px",
              background: isAnchor ? "rgba(227,161,0,0.15)" : "transparent",
              border: isAnchor ? "1px solid rgba(227,161,0,0.5)" : "1px solid transparent",
              borderRadius: 5, cursor: anchorLoading ? "default" : "pointer",
              color: isAnchor ? "#e3a100" : "var(--text-muted)",
              opacity: anchorLoading ? 0.5 : 1,
              transition: "all 0.15s",
            }}
          >
            <Anchor size={13} />
          </button>
          {/* Edit button */}
          <button
            className="btn btn-ghost"
            onClick={isEditing ? onCancelEdit : onEdit}
            style={{ padding: "3px 6px" }}
            title={isEditing ? "Huỷ sửa" : "Sửa câu hỏi"}
          >
            {isEditing ? <ChevronUp size={13} /> : <Pencil size={13} />}
          </button>
        </div>
        {/* Anchor warning */}
        {anchorWarning && (
          <div style={{
            marginTop: 4, fontSize: 10,
            color: "#e3a100",
            background: "rgba(227,161,0,0.08)",
            border: "1px solid rgba(227,161,0,0.3)",
            borderRadius: 5, padding: "3px 8px",
          }}>
            ⚠️ {anchorWarning}
          </div>
        )}
      </div>

      {/* ── Edit form (expanded) ── */}
      {isEditing && (
        <div style={{ borderTop: "1px solid var(--border)", padding: "12px 12px" }}>

          {/* Difficulty selector — MCQ only */}
          {!open && (
            <div style={{ marginBottom: 10 }}>
              <label style={{ marginBottom: 6, display: "block" }}>Độ khó</label>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 5 }}>
                {(Object.keys(DIFFICULTY_CONFIG) as DifficultyLabel[]).map(d => {
                  const c = DIFFICULTY_CONFIG[d];
                  const sel = editDifficulty === d;
                  return (
                    <button
                      key={d}
                      onClick={() => setEditDifficulty(d)}
                      style={{
                        padding: "6px 4px", borderRadius: 6, cursor: "pointer",
                        border: `1.5px solid ${sel ? c.color : "var(--border)"}`,
                        background: sel ? c.bg : "var(--bg-base)",
                        textAlign: "center", transition: "all 0.15s ease",
                      }}
                    >
                      <div style={{ fontSize: 11, fontWeight: 600, color: sel ? c.color : "var(--text-secondary)" }}>{c.label}</div>
                      <div style={{ fontSize: 9, color: "var(--text-muted)" }}>{c.irt_b}</div>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Question text */}
          <div style={{ marginBottom: 10 }}>
            <label>Câu hỏi *</label>
            <textarea
              className="input"
              style={{ resize: "vertical", minHeight: 70 }}
              value={editQuestion}
              onChange={e => setEditQuestion(e.target.value)}
            />
          </div>

          {/* MCQ answers OR Open expected answer */}
          {open ? (
            <div style={{ marginBottom: 10 }}>
              <label>Đáp án mong đợi *</label>
              <textarea
                className="input"
                style={{ resize: "vertical", minHeight: 60 }}
                value={editExpected}
                onChange={e => setEditExpected(e.target.value)}
                placeholder="Nhập đáp án đúng..."
              />
            </div>
          ) : (
            <MCQAnswerEditor answers={editAnswers} onChange={setEditAnswers} />
          )}

          {editError && (
            <div style={{ fontSize: 11, color: "var(--accent-red)", marginTop: 8 }}>⚠ {editError}</div>
          )}

          <div style={{ display: "flex", gap: 6, marginTop: 10 }}>
            <button
              className="btn btn-primary"
              onClick={handleEditSave}
              disabled={editSaving}
              style={{ flex: 1, justifyContent: "center", fontSize: 12 }}
            >
              {editSaving ? "Lưu..." : "Lưu thay đổi"}
            </button>
            <button
              className="btn btn-ghost"
              onClick={onCancelEdit}
              style={{ fontSize: 12 }}
            >
              Huỷ
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
