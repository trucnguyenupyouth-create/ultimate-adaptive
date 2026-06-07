"use client";

import { useState, useEffect, useRef } from "react";
import { Loader2, Save } from "lucide-react";
import { graphApi } from "@/lib/api";

interface Props {
  kcId: string;
  initialNotes: string;
  onSaved: (notes: string) => void;
}

export default function NotesTab({ kcId, initialNotes, onSaved }: Props) {
  const [notes, setNotes] = useState(initialNotes);
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState<Date | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  // Auto-save after 1.5s of no typing
  useEffect(() => {
    if (notes === initialNotes) return;
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      handleSave(notes);
    }, 1500);
    return () => clearTimeout(debounceRef.current);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [notes]);

  const handleSave = async (value: string) => {
    setSaving(true);
    try {
      await graphApi.updateKC(kcId, { notes: value });
      onSaved(value);
      setSavedAt(new Date());
    } catch {
      // ignore
    } finally {
      setSaving(false);
    }
  };

  const formatTime = (d: Date) =>
    d.toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" });

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <div style={{ fontSize: 11, fontWeight: 600, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.05em" }}>
        Ghi chú sư phạm
      </div>
      <div style={{ fontSize: 12, color: "var(--text-secondary)", lineHeight: 1.6 }}>
        Ghi chú nội bộ cho giảng viên: điểm cần nhấn mạnh, lỗi thường gặp, tips giảng dạy. Tự động lưu sau 1.5 giây.
      </div>

      <textarea
        className="input"
        style={{
          resize: "vertical",
          minHeight: 220,
          lineHeight: 1.7,
          fontSize: 13,
        }}
        placeholder="VD: Học sinh thường nhầm dấu khi chuyển vế. Cần nhấn mạnh quy tắc đổi dấu khi chuyển qua dấu = ..."
        value={notes}
        onChange={e => setNotes(e.target.value)}
      />

      {/* Status row */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ fontSize: 11, color: "var(--text-muted)" }}>
          {saving ? (
            <span style={{ display: "flex", alignItems: "center", gap: 4 }}>
              <Loader2 size={11} className="animate-spin" /> Đang lưu...
            </span>
          ) : savedAt ? (
            <span style={{ color: "var(--accent-green)" }}>
              ✓ Đã lưu lúc {formatTime(savedAt)}
            </span>
          ) : (
            "Chưa có thay đổi"
          )}
        </div>
        <button
          className="btn btn-secondary"
          onClick={() => handleSave(notes)}
          disabled={saving}
          style={{ fontSize: 12, padding: "6px 12px" }}
        >
          {saving ? <Loader2 size={12} className="animate-spin" /> : <Save size={12} />}
          Lưu ngay
        </button>
      </div>
    </div>
  );
}
