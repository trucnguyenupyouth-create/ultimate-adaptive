"use client";

import { useState } from "react";
import { Pencil, ChevronUp } from "lucide-react";
import { Item, itemApi } from "@/lib/api";
import MCQAnswerEditor from "./MCQAnswerEditor";
import type { DifficultyLabel } from "./QuestionsTab";

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

export default function QuestionCard({
  item, kcId, isEditing, onEdit, onCancelEdit, onEdited,
}: Props) {
  const cfg = DIFFICULTY_CONFIG[item.difficulty_label as DifficultyLabel] ?? DIFFICULTY_CONFIG.medium;

  // Edit form state
  const [editDifficulty, setEditDifficulty] = useState<DifficultyLabel>(item.difficulty_label as DifficultyLabel);
  const [editQuestion, setEditQuestion] = useState(item.content.question);
  const [editAnswers, setEditAnswers] = useState(
    (item.content.answers ?? []).map((a, i) => ({
      id: `edit_${i}`,
      text: a.text,
      isCorrect: a.is_correct,
    }))
  );
  const [editSaving, setEditSaving] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);

  const handleEditSave = async () => {
    setEditError(null);
    if (!editQuestion.trim()) { setEditError("Câu hỏi không được để trống"); return; }
    if (!editAnswers.some(a => a.isCorrect)) { setEditError("Chưa chọn đáp án đúng"); return; }
    if (editAnswers.filter(a => a.text.trim()).length < 2) { setEditError("Cần ít nhất 2 đáp án"); return; }

    setEditSaving(true);
    try {
      await itemApi.edit(item.id, {
        kc_id: kcId,
        difficulty_label: editDifficulty,
        format_type: "mcq",
        content: {
          question: editQuestion,
          answers: editAnswers
            .filter(a => a.text.trim())
            .map((a, i) => ({
              label: String.fromCharCode(65 + i),
              text: a.text,
              is_correct: a.isCorrect,
            })),
        },
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
        {/* Question text */}
        <div
          style={{
            fontSize: 12,
            color: "var(--text-primary)",
            lineHeight: 1.5,
            marginBottom: 8,
            display: "-webkit-box",
            WebkitLineClamp: isEditing ? undefined : 2,
            WebkitBoxOrient: "vertical",
            overflow: isEditing ? "visible" : "hidden",
          }}
        >
          {item.content.question}
        </div>

        {/* Footer row */}
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          {/* Difficulty badge */}
          <span style={{
            fontSize: 10, fontWeight: 600, padding: "2px 8px", borderRadius: 20,
            color: cfg.color, background: cfg.bg, border: `1px solid ${cfg.border}`,
          }}>
            {cfg.label}
          </span>
          <span style={{
            fontSize: 10, fontWeight: 600, padding: "2px 8px", borderRadius: 20,
            color: "#388bfd", background: "rgba(56,139,253,0.1)", border: "1px solid rgba(56,139,253,0.2)",
          }}>
            MCQ
          </span>
          <div style={{ flex: 1 }} />
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
      </div>

      {/* ── Edit form (expanded) ── */}
      {isEditing && (
        <div style={{ borderTop: "1px solid var(--border)", padding: "12px 12px" }}>
          {/* Difficulty selector */}
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

          {/* Answers */}
          <MCQAnswerEditor answers={editAnswers} onChange={setEditAnswers} />

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
