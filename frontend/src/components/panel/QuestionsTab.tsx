"use client";

import { useState } from "react";
import { Plus, AlertTriangle, CheckCircle } from "lucide-react";
import { Item, itemApi } from "@/lib/api";
import QuestionCard from "./QuestionCard";
import MCQAnswerEditor from "./MCQAnswerEditor";

interface Props {
  kcId: string;
  items: Item[];
  itemCounts: { total: number; easy: number; medium: number; hard: number };
  onRefresh: () => Promise<void>;
}

export type DifficultyLabel = "easy" | "medium" | "hard";

const DIFFICULTY_CONFIG: Record<DifficultyLabel, { label: string; color: string; border: string; bg: string; irt_b: string }> = {
  easy:   { label: "Dễ",        color: "#3fb950", border: "rgba(63,185,80,0.5)",  bg: "rgba(63,185,80,0.08)",  irt_b: "b = −1.0" },
  medium: { label: "Trung bình", color: "#388bfd", border: "rgba(56,139,253,0.5)", bg: "rgba(56,139,253,0.08)", irt_b: "b = 0.0"  },
  hard:   { label: "Khó",        color: "#a371f7", border: "rgba(163,113,247,0.5)",bg: "rgba(163,113,247,0.08)",irt_b: "b = +1.5" },
};

interface NewQuestionState {
  difficulty: DifficultyLabel;
  questionText: string;
  answers: { id: string; text: string; isCorrect: boolean }[];
}

function defaultNewQuestion(): NewQuestionState {
  return {
    difficulty: "easy",
    questionText: "",
    answers: [
      { id: "a", text: "", isCorrect: false },
      { id: "b", text: "", isCorrect: false },
      { id: "c", text: "", isCorrect: false },
      { id: "d", text: "", isCorrect: false },
    ],
  };
}

export default function QuestionsTab({ kcId, items, itemCounts, onRefresh }: Props) {
  const [showAddForm, setShowAddForm] = useState(false);
  const [form, setForm] = useState<NewQuestionState>(defaultNewQuestion());
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);

  const MIN_QUESTIONS = 15;
  const lacking = Math.max(0, MIN_QUESTIONS - itemCounts.total);

  const handleSave = async (keepOpen: boolean) => {
    setError(null);
    // Validate
    if (!form.questionText.trim()) {
      setError("Câu hỏi không được để trống");
      return;
    }
    const hasCorrect = form.answers.some(a => a.isCorrect);
    if (!hasCorrect) {
      setError("Chưa chọn đáp án đúng");
      return;
    }
    const filledAnswers = form.answers.filter(a => a.text.trim());
    if (filledAnswers.length < 2) {
      setError("Cần ít nhất 2 đáp án có nội dung");
      return;
    }

    setSaving(true);
    try {
      await itemApi.create({
        kc_id: kcId,
        difficulty_label: form.difficulty,
        format_type: "mcq",
        content: {
          question: form.questionText,
          answers: form.answers
            .filter(a => a.text.trim())
            .map((a, i) => ({
              label: String.fromCharCode(65 + i), // A, B, C, ...
              text: a.text,
              is_correct: a.isCorrect,
            })),
        },
      });
      await onRefresh();
      if (keepOpen) {
        // Reset form but keep difficulty
        setForm(prev => ({ ...defaultNewQuestion(), difficulty: prev.difficulty }));
      } else {
        setShowAddForm(false);
        setForm(defaultNewQuestion());
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Lỗi lưu câu hỏi");
    } finally {
      setSaving(false);
    }
  };


  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      {/* ── Health bar ── */}
      <div
        style={{
          padding: "10px 12px",
          borderRadius: 8,
          background: "var(--bg-elevated)",
          border: "1px solid var(--border)",
        }}
      >
        <div style={{ display: "flex", gap: 8, marginBottom: lacking > 0 ? 8 : 0 }}>
          <HealthPill count={itemCounts.easy}   color="#3fb950" label="D" />
          <HealthPill count={itemCounts.medium} color="#388bfd" label="TB" />
          <HealthPill count={itemCounts.hard}   color="#a371f7" label="K" />
          <div style={{ flex: 1 }} />
          {itemCounts.total >= MIN_QUESTIONS ? (
            <CheckCircle size={14} color="var(--accent-green)" />
          ) : null}
        </div>
        {lacking > 0 && (
          <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11, color: "var(--accent-yellow)" }}>
            <AlertTriangle size={11} />
            Cần thêm {lacking} câu để đủ {MIN_QUESTIONS} câu tối thiểu
          </div>
        )}
      </div>

      {/* ── Add button ── */}
      {!showAddForm && (
        <button
          className="btn btn-primary"
          onClick={() => { setShowAddForm(true); setForm(defaultNewQuestion()); setError(null); }}
          style={{ width: "100%", justifyContent: "center" }}
        >
          <Plus size={14} /> Thêm câu hỏi
        </button>
      )}

      {/* ── Add form ── */}
      {showAddForm && (
        <div
          style={{
            borderRadius: 8,
            border: "1px solid var(--border)",
            background: "var(--bg-elevated)",
            padding: 14,
          }}
        >
          {/* Difficulty selector */}
          <div style={{ marginBottom: 12 }}>
            <label style={{ marginBottom: 8, display: "block" }}>Độ khó</label>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 6 }}>
              {(Object.keys(DIFFICULTY_CONFIG) as DifficultyLabel[]).map(d => {
                const cfg = DIFFICULTY_CONFIG[d];
                const selected = form.difficulty === d;
                return (
                  <button
                    key={d}
                    onClick={() => setForm(prev => ({ ...prev, difficulty: d }))}
                    style={{
                      padding: "8px 4px",
                      borderRadius: 6,
                      border: `1.5px solid ${selected ? cfg.color : "var(--border)"}`,
                      background: selected ? cfg.bg : "var(--bg-base)",
                      cursor: "pointer",
                      textAlign: "center",
                      transition: "all 0.15s ease",
                    }}
                  >
                    <div style={{ fontSize: 12, fontWeight: 600, color: selected ? cfg.color : "var(--text-secondary)" }}>
                      {cfg.label}
                    </div>
                    <div style={{ fontSize: 9, color: "var(--text-muted)", marginTop: 2 }}>
                      {cfg.irt_b}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Question text */}
          <div style={{ marginBottom: 12 }}>
            <label>Câu hỏi *</label>
            <textarea
              className="input"
              style={{ resize: "vertical", minHeight: 80 }}
              placeholder="Nhập câu hỏi... Dùng $...$ cho công thức toán"
              value={form.questionText}
              onChange={e => setForm(prev => ({ ...prev, questionText: e.target.value }))}
            />
          </div>

          {/* MCQ answers */}
          <MCQAnswerEditor
            answers={form.answers}
            onChange={answers => setForm(prev => ({ ...prev, answers }))}
          />

          {/* Error */}
          {error && (
            <div style={{ fontSize: 12, color: "var(--accent-red)", marginTop: 8, marginBottom: 4 }}>
              ⚠ {error}
            </div>
          )}

          {/* Actions */}
          <div style={{ display: "flex", gap: 6, marginTop: 12 }}>
            <button
              className="btn btn-secondary"
              onClick={() => handleSave(true)}
              disabled={saving}
              style={{ flex: 1, justifyContent: "center", fontSize: 12 }}
            >
              {saving ? "Lưu..." : "Lưu & Thêm tiếp"}
            </button>
            <button
              className="btn btn-primary"
              onClick={() => handleSave(false)}
              disabled={saving}
              style={{ flex: 1, justifyContent: "center", fontSize: 12 }}
            >
              {saving ? "Lưu..." : "Lưu & Đóng"}
            </button>
            <button
              className="btn btn-ghost"
              onClick={() => { setShowAddForm(false); setError(null); }}
              disabled={saving}
              style={{ padding: "8px 10px", fontSize: 12 }}
            >
              Huỷ
            </button>
          </div>
        </div>
      )}

      {/* ── Question list ── */}
      {items.length === 0 && !showAddForm && (
        <div style={{ textAlign: "center", padding: "24px 0", color: "var(--text-muted)", fontSize: 13 }}>
          Chưa có câu hỏi nào
        </div>
      )}
      {items.map(item => (
        <QuestionCard
          key={item.id}
          item={item}
          isEditing={editingId === item.id}
          onEdit={() => setEditingId(item.id)}
          onCancelEdit={() => setEditingId(null)}
          onEdited={async () => { setEditingId(null); await onRefresh(); }}
          kcId={kcId}
        />
      ))}
    </div>
  );
}

function HealthPill({ count, color, label }: { count: number; color: string; label: string }) {
  return (
    <div style={{
      display: "flex", alignItems: "center", gap: 4,
      padding: "3px 10px", borderRadius: 20,
      background: `${color}15`, border: `1px solid ${color}30`,
      fontSize: 12, color, fontWeight: 600,
    }}>
      {label}: {count}
    </div>
  );
}
