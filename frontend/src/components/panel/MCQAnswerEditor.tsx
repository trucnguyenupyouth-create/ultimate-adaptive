"use client";

import { Plus, Trash2 } from "lucide-react";

interface Answer {
  id: string;
  text: string;
  isCorrect: boolean;
}

interface Props {
  answers: Answer[];
  onChange: (answers: Answer[]) => void;
}

export default function MCQAnswerEditor({ answers, onChange }: Props) {
  const handleTextChange = (id: string, text: string) => {
    onChange(answers.map(a => a.id === id ? { ...a, text } : a));
  };

  const handleSelectCorrect = (id: string) => {
    // Only one can be correct
    onChange(answers.map(a => ({ ...a, isCorrect: a.id === id })));
  };

  const handleAddAnswer = () => {
    // Generate next label letter (E, F, G, ...)
    const nextId = `ans_${Date.now()}`;
    onChange([...answers, { id: nextId, text: "", isCorrect: false }]);
  };

  const handleRemove = (id: string) => {
    const updated = answers.filter(a => a.id !== id);
    // If we removed the correct answer, clear selection
    const removedWasCorrect = answers.find(a => a.id === id)?.isCorrect ?? false;
    if (removedWasCorrect && updated.length > 0) {
      // Clear all correct flags
      onChange(updated.map(a => ({ ...a, isCorrect: false })));
    } else {
      onChange(updated);
    }
  };

  const getLabel = (index: number) => String.fromCharCode(65 + index);

  return (
    <div>
      <label style={{ marginBottom: 6, display: "block" }}>
        Đáp án{" "}
        <span style={{ color: "var(--text-muted)", fontWeight: 400 }}>
          (chọn radio = đáp án đúng)
        </span>
      </label>

      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        {answers.map((answer, index) => (
          <div
            key={answer.id}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              padding: "6px 8px",
              borderRadius: 6,
              border: `1px solid ${answer.isCorrect ? "rgba(63,185,80,0.4)" : "var(--border)"}`,
              background: answer.isCorrect ? "rgba(63,185,80,0.05)" : "var(--bg-base)",
              transition: "all 0.15s ease",
            }}
          >
            {/* Correct answer radio */}
            <div
              onClick={() => handleSelectCorrect(answer.id)}
              title="Chọn đây là đáp án đúng"
              style={{
                width: 16,
                height: 16,
                borderRadius: "50%",
                border: `2px solid ${answer.isCorrect ? "#3fb950" : "var(--border)"}`,
                background: answer.isCorrect ? "#3fb950" : "transparent",
                cursor: "pointer",
                flexShrink: 0,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                transition: "all 0.15s ease",
              }}
            >
              {answer.isCorrect && (
                <div style={{ width: 6, height: 6, borderRadius: "50%", background: "#fff" }} />
              )}
            </div>

            {/* Label */}
            <span style={{
              fontSize: 11,
              fontWeight: 700,
              color: answer.isCorrect ? "#3fb950" : "var(--text-muted)",
              minWidth: 14,
              flexShrink: 0,
            }}>
              {getLabel(index)}
            </span>

            {/* Answer text input */}
            <input
              className="input"
              style={{
                flex: 1,
                padding: "4px 8px",
                fontSize: 12,
                border: "none",
                background: "transparent",
                outline: "none",
              }}
              placeholder={`Đáp án ${getLabel(index)}...`}
              value={answer.text}
              onChange={e => handleTextChange(answer.id, e.target.value)}
            />

            {/* Remove button (disabled if only 2 answers left) */}
            <button
              onClick={() => handleRemove(answer.id)}
              disabled={answers.length <= 2}
              title={answers.length <= 2 ? "Cần ít nhất 2 đáp án" : "Xoá đáp án này"}
              style={{
                background: "transparent",
                border: "none",
                cursor: answers.length <= 2 ? "not-allowed" : "pointer",
                color: answers.length <= 2 ? "var(--text-muted)" : "var(--accent-red)",
                padding: "2px 4px",
                borderRadius: 4,
                display: "flex",
                alignItems: "center",
                opacity: answers.length <= 2 ? 0.3 : 1,
                transition: "all 0.15s ease",
                flexShrink: 0,
              }}
            >
              <Trash2 size={13} />
            </button>
          </div>
        ))}

        {/* Add answer button */}
        {answers.length < 8 && (
          <button
            onClick={handleAddAnswer}
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 6,
              padding: "7px 0",
              borderRadius: 6,
              border: "1px dashed var(--border)",
              background: "transparent",
              color: "var(--text-secondary)",
              cursor: "pointer",
              fontSize: 12,
              transition: "all 0.15s ease",
            }}
            onMouseEnter={e => {
              (e.currentTarget as HTMLButtonElement).style.borderColor = "var(--accent-blue)";
              (e.currentTarget as HTMLButtonElement).style.color = "var(--accent-blue)";
            }}
            onMouseLeave={e => {
              (e.currentTarget as HTMLButtonElement).style.borderColor = "var(--border)";
              (e.currentTarget as HTMLButtonElement).style.color = "var(--text-secondary)";
            }}
          >
            <Plus size={13} /> Thêm đáp án ({getLabel(answers.length)})
          </button>
        )}
      </div>
    </div>
  );
}
