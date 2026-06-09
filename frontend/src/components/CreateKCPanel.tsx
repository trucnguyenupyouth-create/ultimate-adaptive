"use client";

import { useState } from "react";
import { X, Plus, Loader2 } from "lucide-react";
import { graphApi, CreateKCPayload } from "@/lib/api";

interface Props {
  onCreated: (kc: { id: string; code: string; name: string; grade: number }) => void;
  onClose: () => void;
}

const GRADE_OPTIONS = [9, 8, 7, 6];
const SUBJECT_OPTIONS = ["math", "physics", "chemistry", "literature"];

export default function CreateKCPanel({ onCreated, onClose }: Props) {
  const [form, setForm] = useState<CreateKCPayload>({
    code: "",
    name: "",
    grade: 9,
    subject: "math",
    description: "",
    chapter_info: "",
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Auto-generate code from name + grade
  const autoCode = () => {
    const subjectMap: Record<string, string> = {
      math: "MATH", physics: "PHY", chemistry: "CHE", literature: "LIT",
    };
    const slug = form.name
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/đ/gi, "d")
      .toUpperCase()
      .replace(/[^A-Z0-9\s]/g, "")
      .trim()
      .split(/\s+/)
      .slice(0, 3)
      .join("-");
    setForm((f) => ({
      ...f,
      code: `G${f.grade}-${subjectMap[f.subject ?? "math"] ?? "KC"}-${slug}`,
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.code || !form.name) return;
    setLoading(true);
    setError(null);
    try {
      const kc = await graphApi.createKC(form);
      onCreated(kc);
      onClose();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Lỗi tạo KC");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="glass fade-in"
      style={{
        position: "absolute",
        top: 16,
        right: 16,
        width: 320,
        borderRadius: 12,
        padding: 20,
        zIndex: 100,
      }}
    >
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
        <div>
          <div style={{ fontSize: 14, fontWeight: 600, color: "var(--text-primary)" }}>
            Thêm Knowledge Component
          </div>
          <div style={{ fontSize: 12, color: "var(--text-secondary)", marginTop: 2 }}>
            Kéo node vào đúng vị trí sau khi tạo
          </div>
        </div>
        <button className="btn btn-ghost" onClick={onClose} style={{ padding: "4px 6px" }}>
          <X size={16} />
        </button>
      </div>

      <form onSubmit={handleSubmit}>
        {/* Grade */}
        <div style={{ marginBottom: 12 }}>
          <label>Lớp học</label>
          <select
            className="select"
            value={form.grade}
            onChange={(e) => setForm((f) => ({ ...f, grade: Number(e.target.value) }))}
          >
            {GRADE_OPTIONS.map((g) => (
              <option key={g} value={g}>Lớp {g}</option>
            ))}
          </select>
        </div>

        {/* Subject */}
        <div style={{ marginBottom: 12 }}>
          <label>Môn học</label>
          <select
            className="select"
            value={form.subject}
            onChange={(e) => setForm((f) => ({ ...f, subject: e.target.value }))}
          >
            {SUBJECT_OPTIONS.map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
        </div>

        {/* Name */}
        <div style={{ marginBottom: 12 }}>
          <label>Tên KC *</label>
          <input
            className="input"
            placeholder="VD: Phương trình bậc nhất một ẩn"
            value={form.name}
            onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
            onBlur={autoCode}
            required
          />
        </div>

        {/* Chapter Info (Bài mấy kì mấy) */}
        <div style={{ marginBottom: 12 }}>
          <label>Bài mấy kì mấy *</label>
          <input
            className="input"
            placeholder="VD: Bài 3 Kì 1"
            value={form.chapter_info}
            onChange={(e) => setForm((f) => ({ ...f, chapter_info: e.target.value }))}
            required
          />
        </div>

        {/* Code */}
        <div style={{ marginBottom: 12 }}>
          <label>Code * <span style={{ color: "var(--text-muted)", fontWeight: 400 }}>(unique, auto-generated)</span></label>
          <input
            className="input"
            style={{ fontFamily: "monospace", fontSize: 12 }}
            placeholder="VD: G9-MATH-PT-BAC-NHAT"
            value={form.code}
            onChange={(e) => setForm((f) => ({ ...f, code: e.target.value.toUpperCase() }))}
            required
          />
        </div>

        {/* Description */}
        <div style={{ marginBottom: 16 }}>
          <label>Mô tả <span style={{ color: "var(--text-muted)", fontWeight: 400 }}>(không bắt buộc)</span></label>
          <textarea
            className="input"
            style={{ resize: "vertical", minHeight: 60 }}
            placeholder="Học sinh sẽ học gì ở KC này?"
            value={form.description}
            onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
          />
        </div>

        {error && (
          <div
            style={{
              padding: "8px 12px",
              background: "rgba(248,81,73,0.1)",
              border: "1px solid rgba(248,81,73,0.3)",
              borderRadius: 6,
              fontSize: 12,
              color: "var(--accent-red)",
              marginBottom: 12,
            }}
          >
            {error}
          </div>
        )}

        <button className="btn btn-primary" type="submit" disabled={loading} style={{ width: "100%" }}>
          {loading ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
          Tạo Knowledge Component
        </button>
      </form>
    </div>
  );
}
