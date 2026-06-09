"use client";

import { useState } from "react";
import { Loader2, Trash2, Plus, X } from "lucide-react";
import { graphApi, KCDetail } from "@/lib/api";

interface Props {
  detail: KCDetail;
  onUpdated: (data: Partial<KCDetail>) => void;
  onDeleted: () => void;
  onPrereqRemoved: () => void;
}

const GRADE_OPTIONS = [6, 7, 8, 9];
const SUBJECT_OPTIONS = [
  { value: "math", label: "Toán" },
  { value: "physics", label: "Vật Lý" },
  { value: "chemistry", label: "Hóa Học" },
  { value: "literature", label: "Ngữ Văn" },
];

export default function DetailsTab({ detail, onUpdated, onDeleted, onPrereqRemoved }: Props) {
  const [name, setName] = useState(detail.name);
  const [grade, setGrade] = useState(detail.grade);
  const [subject, setSubject] = useState(detail.subject);
  const [description, setDescription] = useState(detail.description ?? "");
  const [chapterInfo, setChapterInfo] = useState(detail.chapter_info ?? "");
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [saveMsg, setSaveMsg] = useState<string | null>(null);

  const handleSave = async () => {
    if (!chapterInfo.trim()) {
      setSaveMsg("⚠ Thiếu 'Bài mấy kì mấy'");
      return;
    }
    setSaving(true);
    setSaveMsg(null);
    try {
      const updated = await graphApi.updateKC(detail.id, { name, grade, subject, description, chapter_info: chapterInfo });
      onUpdated(updated);
      setSaveMsg("✓ Đã lưu");
      setTimeout(() => setSaveMsg(null), 2500);
    } catch {
      setSaveMsg("✗ Lỗi lưu");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    setDeleting(true);
    try {
      await graphApi.deleteKC(detail.id);
      onDeleted();
    } catch {
      setDeleting(false);
      setShowDeleteConfirm(false);
    }
  };

  const handleRemovePrereq = async (prereqId: string) => {
    try {
      await graphApi.removePrerequisite(detail.id, prereqId);
      onPrereqRemoved();
    } catch {
      // ignore
    }
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {/* ── Thông tin KC ── */}
      <div>
        <div style={{ fontSize: 11, fontWeight: 600, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 12 }}>
          Thông tin KC
        </div>

        {/* Tên KC */}
        <div style={{ marginBottom: 12 }}>
          <label>Tên KC *</label>
          <input
            className="input"
            value={name}
            onChange={e => setName(e.target.value)}
            placeholder="Tên Knowledge Component"
          />
        </div>

        {/* Chapter Info (Bài mấy kì mấy) */}
        <div style={{ marginBottom: 12 }}>
          <label>Bài mấy kì mấy *</label>
          <input
            className="input"
            value={chapterInfo}
            onChange={e => setChapterInfo(e.target.value)}
            placeholder="VD: Bài 3 Kì 1"
          />
        </div>

        {/* Grade chips */}
        <div style={{ marginBottom: 12 }}>
          <label>Lớp</label>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            {GRADE_OPTIONS.map(g => (
              <button
                key={g}
                onClick={() => setGrade(g)}
                style={{
                  padding: "5px 14px",
                  borderRadius: 20,
                  fontSize: 12,
                  fontWeight: 600,
                  cursor: "pointer",
                  border: `1px solid ${grade === g ? "var(--accent-blue)" : "var(--border)"}`,
                  background: grade === g ? "rgba(56,139,253,0.15)" : "var(--bg-elevated)",
                  color: grade === g ? "var(--accent-blue)" : "var(--text-secondary)",
                  transition: "all 0.15s ease",
                }}
              >
                Lớp {g}
              </button>
            ))}
          </div>
        </div>

        {/* Môn học */}
        <div style={{ marginBottom: 12 }}>
          <label>Môn học</label>
          <select className="select" value={subject} onChange={e => setSubject(e.target.value)}>
            {SUBJECT_OPTIONS.map(s => (
              <option key={s.value} value={s.value}>{s.label}</option>
            ))}
          </select>
        </div>

        {/* Mô tả */}
        <div style={{ marginBottom: 16 }}>
          <label>Mô tả <span style={{ color: "var(--text-muted)", fontWeight: 400 }}>(không bắt buộc)</span></label>
          <textarea
            className="input"
            style={{ resize: "vertical", minHeight: 72 }}
            value={description}
            onChange={e => setDescription(e.target.value)}
            placeholder="Học sinh sẽ học được gì ở KC này?"
          />
        </div>

        {/* Save button */}
        <button
          className="btn btn-primary"
          onClick={handleSave}
          disabled={saving}
          style={{ width: "100%", justifyContent: "center" }}
        >
          {saving ? <Loader2 size={14} className="animate-spin" /> : null}
          {saving ? "Đang lưu..." : saveMsg ?? "Lưu thay đổi"}
        </button>
      </div>

      <div className="divider" />

      {/* ── Prerequisites ── */}
      <div>
        <div style={{ fontSize: 11, fontWeight: 600, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 10 }}>
          Prerequisites ({detail.prerequisites.length})
        </div>
        {detail.prerequisites.length === 0 ? (
          <div style={{ fontSize: 12, color: "var(--text-muted)", fontStyle: "italic" }}>
            Không có prerequisite
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {detail.prerequisites.map(p => (
              <div
                key={p.id}
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  padding: "7px 10px",
                  borderRadius: 6,
                  background: "var(--bg-elevated)",
                  border: "1px solid var(--border)",
                }}
              >
                <div>
                  <div style={{ fontSize: 10, fontFamily: "monospace", color: "var(--text-muted)" }}>{p.code}</div>
                  <div style={{ fontSize: 12, color: "var(--text-primary)" }}>{p.name}</div>
                </div>
                <button
                  className="btn btn-ghost"
                  onClick={() => handleRemovePrereq(p.id)}
                  style={{ padding: "3px 6px", color: "var(--accent-red)" }}
                  title="Xoá prerequisite này"
                >
                  <X size={13} />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {detail.successors.length > 0 && (
        <>
          <div className="divider" />
          <div>
            <div style={{ fontSize: 11, fontWeight: 600, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 10 }}>
              Successors ({detail.successors.length})
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {detail.successors.map(s => (
                <div
                  key={s.id}
                  style={{
                    padding: "7px 10px",
                    borderRadius: 6,
                    background: "var(--bg-elevated)",
                    border: "1px solid var(--border)",
                  }}
                >
                  <div style={{ fontSize: 10, fontFamily: "monospace", color: "var(--text-muted)" }}>{s.code}</div>
                  <div style={{ fontSize: 12, color: "var(--text-primary)" }}>{s.name}</div>
                </div>
              ))}
            </div>
          </div>
        </>
      )}

      <div className="divider" />

      {/* ── Danger Zone ── */}
      <div
        style={{
          padding: 14,
          borderRadius: 8,
          border: "1px solid rgba(248,81,73,0.3)",
          background: "rgba(248,81,73,0.05)",
        }}
      >
        <div style={{ fontSize: 12, fontWeight: 600, color: "var(--accent-red)", marginBottom: 6 }}>
          ⚠ Danger Zone
        </div>
        <div style={{ fontSize: 11, color: "var(--text-secondary)", marginBottom: 12 }}>
          Xoá KC sẽ deactivate tất cả câu hỏi và xoá tất cả edges liên quan.
        </div>

        {!showDeleteConfirm ? (
          <button
            className="btn btn-danger"
            onClick={() => setShowDeleteConfirm(true)}
            style={{ width: "100%", justifyContent: "center" }}
          >
            <Trash2 size={13} /> Xoá KC này
          </button>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <div style={{ fontSize: 12, color: "var(--text-primary)", fontWeight: 500 }}>
              Xác nhận xoá?
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <button
                className="btn btn-danger"
                onClick={handleDelete}
                disabled={deleting}
                style={{ flex: 1, justifyContent: "center" }}
              >
                {deleting ? <Loader2 size={13} className="animate-spin" /> : <Trash2 size={13} />}
                {deleting ? "Đang xoá..." : "Xoá"}
              </button>
              <button
                className="btn btn-secondary"
                onClick={() => setShowDeleteConfirm(false)}
                style={{ flex: 1, justifyContent: "center" }}
              >
                Huỷ
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
