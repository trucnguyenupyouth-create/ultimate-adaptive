"use client";

import { useRef, useState, useCallback, DragEvent } from "react";
import { Upload, X, ImageOff, Loader2, ZoomIn } from "lucide-react";
import { KCImage, imageApi } from "@/lib/api";

interface Props {
  kcId: string;
  images: KCImage[];
  onChanged: (images: KCImage[]) => void;
}

const MAX_SIZE_MB = 10;
const MAX_SIZE_BYTES = MAX_SIZE_MB * 1024 * 1024;
const BLOCKED_TYPES = ["image/svg+xml", "image/svg"];
const MAX_CONCURRENT = 3;

interface UploadEntry {
  id: string;
  name: string;
  progress: number; // 0-100; -1 = error
  error?: string;
  done: boolean;
}

// ── Client-side WebP compression via Canvas ──────────────────────────────────
function compressToWebP(file: File, maxWidth = 800, quality = 0.82): Promise<{ blob: Blob; filename: string }> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(url);
      const scale = img.width > maxWidth ? maxWidth / img.width : 1;
      const w = Math.round(img.width * scale);
      const h = Math.round(img.height * scale);
      const canvas = document.createElement("canvas");
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext("2d")!;
      // White background for transparent images
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, w, h);
      ctx.drawImage(img, 0, 0, w, h);
      canvas.toBlob(
        (blob) => {
          if (!blob) { reject(new Error("Canvas toBlob failed")); return; }
          resolve({ blob, filename: file.name.replace(/\.[^.]+$/, ".webp") });
        },
        "image/webp",
        quality,
      );
    };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error("Cannot load image")); };
    img.src = url;
  });
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function fmtBytes(b: number) {
  if (b < 1024) return `${b}B`;
  if (b < 1024 * 1024) return `${(b / 1024).toFixed(0)}KB`;
  return `${(b / 1024 / 1024).toFixed(1)}MB`;
}

// ── Component ─────────────────────────────────────────────────────────────────
export default function ImagesTab({ kcId, images, onChanged }: Props) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploads, setUploads] = useState<UploadEntry[]>([]);
  const [dragging, setDragging] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [lightbox, setLightbox] = useState<string | null>(null);

  // ── Validation ─────────────────────────────────────────────────────────────
  const validateFile = (file: File): string | null => {
    if (BLOCKED_TYPES.includes(file.type)) return "SVG không được hỗ trợ. Dùng JPG, PNG, hoặc WebP.";
    if (!file.type.startsWith("image/")) return `"${file.name}" không phải file ảnh.`;
    if (file.size > MAX_SIZE_BYTES) return `"${file.name}" quá lớn (${fmtBytes(file.size)}). Giới hạn ${MAX_SIZE_MB}MB.`;
    if (file.size < 100) return `"${file.name}" bị hỏng hoặc quá nhỏ.`;
    return null;
  };

  // ── Upload a single file ───────────────────────────────────────────────────
  const uploadFile = useCallback(async (file: File) => {
    const err = validateFile(file);
    const entryId = `${Date.now()}-${file.name}`;

    if (err) {
      setUploads(prev => [...prev, { id: entryId, name: file.name, progress: -1, error: err, done: true }]);
      setTimeout(() => setUploads(prev => prev.filter(u => u.id !== entryId)), 5000);
      return;
    }

    setUploads(prev => [...prev, { id: entryId, name: file.name, progress: 0, done: false }]);

    try {
      // Client-side compress first (reduces upload bandwidth)
      const { blob, filename } = await compressToWebP(file);

      const result = await imageApi.upload(
        kcId,
        blob,
        filename,
        (pct) => setUploads(prev => prev.map(u => u.id === entryId ? { ...u, progress: pct } : u)),
      );

      // Add to gallery
      const newImage: KCImage = {
        id: result.id,
        url: result.url,
        original_name: result.original_name,
        size_bytes: result.size_bytes,
        created_at: result.created_at,
      };
      onChanged([...images, newImage]);

      // Mark done
      setUploads(prev => prev.map(u => u.id === entryId ? { ...u, progress: 100, done: true } : u));
      setTimeout(() => setUploads(prev => prev.filter(u => u.id !== entryId)), 2000);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Lỗi upload";
      setUploads(prev => prev.map(u => u.id === entryId ? { ...u, progress: -1, error: msg, done: true } : u));
      setTimeout(() => setUploads(prev => prev.filter(u => u.id !== entryId)), 6000);
    }
  }, [kcId, images, onChanged]);

  // ── Process file list (queue with max concurrency) ─────────────────────────
  const processFiles = useCallback(async (files: FileList | File[]) => {
    const arr = Array.from(files).filter(f => f.type.startsWith("image/") || !f.type);
    const queue = [...arr];
    const workers: Promise<void>[] = [];

    const worker = async () => {
      while (queue.length > 0) {
        const file = queue.shift()!;
        await uploadFile(file);
      }
    };

    for (let i = 0; i < Math.min(MAX_CONCURRENT, arr.length); i++) {
      workers.push(worker());
    }
    await Promise.all(workers);
  }, [uploadFile]);

  // ── Drag handlers ──────────────────────────────────────────────────────────
  const onDragOver = (e: DragEvent) => { e.preventDefault(); setDragging(true); };
  const onDragLeave = () => setDragging(false);
  const onDrop = (e: DragEvent) => {
    e.preventDefault();
    setDragging(false);
    if (e.dataTransfer.files.length) processFiles(e.dataTransfer.files);
  };

  // ── Delete ─────────────────────────────────────────────────────────────────
  const handleDelete = async (img: KCImage) => {
    if (deletingId) return;
    setDeletingId(img.id);
    try {
      await imageApi.delete(kcId, img.id);
      onChanged(images.filter(i => i.id !== img.id));
    } catch (e) {
      console.error("Delete failed", e);
    } finally {
      setDeletingId(null);
    }
  };

  const activeUploads = uploads.filter(u => !u.done);
  const hasUploads = uploads.length > 0;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      {/* ── Drop zone ── */}
      <div
        onDragOver={onDragOver}
        onDragLeave={onDragLeave}
        onDrop={onDrop}
        onClick={() => fileInputRef.current?.click()}
        style={{
          border: `2px dashed ${dragging ? "var(--accent-blue)" : "var(--border)"}`,
          borderRadius: 10,
          padding: "20px 16px",
          textAlign: "center",
          cursor: "pointer",
          background: dragging ? "rgba(56,139,253,0.06)" : "var(--bg-elevated)",
          transition: "all 0.15s ease",
        }}
      >
        <Upload size={20} color={dragging ? "var(--accent-blue)" : "var(--text-muted)"} style={{ margin: "0 auto 8px" }} />
        <div style={{ fontSize: 13, fontWeight: 600, color: dragging ? "var(--accent-blue)" : "var(--text-primary)", marginBottom: 3 }}>
          {dragging ? "Thả ảnh vào đây" : "Kéo & thả ảnh, hoặc click để chọn"}
        </div>
        <div style={{ fontSize: 11, color: "var(--text-muted)" }}>
          JPG, PNG, GIF, WebP, BMP — tối đa {MAX_SIZE_MB}MB mỗi file
        </div>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/jpeg,image/png,image/gif,image/bmp,image/webp,image/tiff,image/heic"
          multiple
          style={{ display: "none" }}
          onChange={e => { if (e.target.files) processFiles(e.target.files); e.target.value = ""; }}
        />
      </div>

      {/* ── Upload progress rows ── */}
      {hasUploads && (
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          {uploads.map(u => (
            <div
              key={u.id}
              style={{
                padding: "8px 10px",
                borderRadius: 6,
                border: `1px solid ${u.error ? "rgba(248,81,73,0.4)" : u.done ? "rgba(63,185,80,0.4)" : "var(--border)"}`,
                background: u.error ? "rgba(248,81,73,0.06)" : u.done ? "rgba(63,185,80,0.06)" : "var(--bg-elevated)",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: u.error || u.done ? 0 : 4 }}>
                {!u.done && !u.error && <Loader2 size={12} className="animate-spin" color="var(--accent-blue)" />}
                <span style={{ fontSize: 11, color: "var(--text-secondary)", flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {u.name}
                </span>
                {u.error && <span style={{ fontSize: 10, color: "var(--accent-red)", flexShrink: 0 }}>✗ Lỗi</span>}
                {u.done && !u.error && <span style={{ fontSize: 10, color: "var(--accent-green)", flexShrink: 0 }}>✓ Xong</span>}
                {!u.done && <span style={{ fontSize: 10, color: "var(--text-muted)", flexShrink: 0 }}>{u.progress}%</span>}
              </div>
              {u.error && (
                <div style={{ fontSize: 10, color: "var(--accent-red)", marginTop: 2 }}>{u.error}</div>
              )}
              {!u.done && !u.error && (
                <div style={{ height: 3, borderRadius: 2, background: "var(--border)", overflow: "hidden" }}>
                  <div style={{
                    height: "100%", borderRadius: 2,
                    background: "var(--accent-blue)",
                    width: `${u.progress}%`,
                    transition: "width 0.1s",
                  }} />
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* ── Gallery grid ── */}
      {images.length === 0 && !hasUploads ? (
        <div style={{ textAlign: "center", padding: "28px 0", color: "var(--text-muted)" }}>
          <ImageOff size={28} style={{ margin: "0 auto 10px", opacity: 0.4 }} />
          <div style={{ fontSize: 13, fontWeight: 500, marginBottom: 4 }}>Chưa có ảnh nào</div>
          <div style={{ fontSize: 11 }}>Upload ảnh để đính kèm vào KC này</div>
        </div>
      ) : (
        <div style={{
          display: "grid",
          gridTemplateColumns: "repeat(3, 1fr)",
          gap: 8,
        }}>
          {images.map(img => (
            <div
              key={img.id}
              style={{
                position: "relative",
                aspectRatio: "1",
                borderRadius: 8,
                overflow: "hidden",
                border: "1px solid var(--border)",
                background: "var(--bg-elevated)",
                cursor: "pointer",
              }}
              title={`${img.original_name} · ${fmtBytes(img.size_bytes)}`}
            >
              {/* Image thumbnail */}
              <img
                src={img.url}
                alt={img.original_name}
                loading="lazy"
                onClick={() => setLightbox(img.url)}
                style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
                onError={(e) => {
                  (e.target as HTMLImageElement).style.display = "none";
                  (e.target as HTMLImageElement).nextElementSibling?.setAttribute("style", "display:flex");
                }}
              />
              {/* Fallback placeholder */}
              <div style={{
                display: "none", position: "absolute", inset: 0,
                alignItems: "center", justifyContent: "center",
                background: "var(--bg-elevated)",
              }}>
                <ImageOff size={18} color="var(--text-muted)" />
              </div>

              {/* Hover overlay */}
              <div className="img-overlay" style={{
                position: "absolute", inset: 0,
                background: "rgba(0,0,0,0)",
                display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
                transition: "background 0.15s",
              }}
                onMouseEnter={e => (e.currentTarget.style.background = "rgba(0,0,0,0.45)")}
                onMouseLeave={e => (e.currentTarget.style.background = "rgba(0,0,0,0)")}
              >
                <button
                  onClick={() => setLightbox(img.url)}
                  style={{
                    opacity: 0, background: "rgba(255,255,255,0.15)", border: "none",
                    borderRadius: 6, padding: 6, cursor: "pointer", color: "#fff",
                    transition: "opacity 0.15s",
                  }}
                  className="overlay-btn"
                  title="Xem ảnh lớn"
                >
                  <ZoomIn size={14} />
                </button>
                <button
                  onClick={() => handleDelete(img)}
                  disabled={deletingId === img.id}
                  style={{
                    opacity: 0, background: "rgba(248,81,73,0.7)", border: "none",
                    borderRadius: 6, padding: 6, cursor: "pointer", color: "#fff",
                    transition: "opacity 0.15s",
                  }}
                  className="overlay-btn"
                  title="Xoá ảnh"
                >
                  {deletingId === img.id ? <Loader2 size={14} className="animate-spin" /> : <X size={14} />}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {images.length > 0 && (
        <div style={{ fontSize: 10, color: "var(--text-muted)", textAlign: "right" }}>
          {images.length} ảnh · {fmtBytes(images.reduce((a, i) => a + i.size_bytes, 0))} tổng
        </div>
      )}

      {/* ── Lightbox ── */}
      {lightbox && (
        <div
          onClick={() => setLightbox(null)}
          style={{
            position: "fixed", inset: 0, zIndex: 9999,
            background: "rgba(0,0,0,0.85)",
            display: "flex", alignItems: "center", justifyContent: "center",
            cursor: "zoom-out",
          }}
        >
          <img
            src={lightbox}
            alt=""
            style={{
              maxWidth: "90vw", maxHeight: "90vh",
              objectFit: "contain", borderRadius: 8,
              boxShadow: "0 8px 40px rgba(0,0,0,0.6)",
            }}
            onClick={e => e.stopPropagation()}
          />
          <button
            onClick={() => setLightbox(null)}
            style={{
              position: "absolute", top: 16, right: 16,
              background: "rgba(255,255,255,0.15)", border: "none",
              borderRadius: 8, padding: "6px 8px", cursor: "pointer", color: "#fff",
            }}
          >
            <X size={18} />
          </button>
        </div>
      )}

      <style>{`
        .img-overlay:hover .overlay-btn { opacity: 1 !important; }
      `}</style>
    </div>
  );
}
