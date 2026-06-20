"use client";

/**
 * ImageManager.tsx
 *
 * Reusable component for managing images attached to a question (item or draft).
 * Features:
 *   - Drag-and-drop or click-to-upload (up to 5 images, 5 MB each)
 *   - Thumbnail grid with preview, delete, replace, and caption editing
 *   - Drag-to-reorder
 *   - Upload progress per file
 *   - Inline lightbox (full-size preview on click)
 *
 * Usage:
 *   <ImageManager target={{ draftId: "..." }} />
 *   <ImageManager target={{ itemId: "..." }} />
 */

import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  deleteImage,
  formatBytes,
  getImagesForDraft,
  getImagesForItem,
  QuestionImage,
  reorderImages,
  replaceImage,
  updateImageMeta,
  uploadImages,
} from "@/lib/image-api";

// ── Constants ─────────────────────────────────────────────────────────────────

const MAX_IMAGES = 5;
const MAX_BYTES  = 5 * 1024 * 1024;
const ALLOWED    = ["image/jpeg", "image/png", "image/webp", "image/gif"];

// ── Sub-components ────────────────────────────────────────────────────────────

/** Full-screen lightbox for a single image */
function Lightbox({
  src, alt, onClose,
}: { src: string; alt: string; onClose: () => void }) {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose]);

  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed", inset: 0, zIndex: 9999,
        background: "rgba(0,0,0,0.85)", display: "flex",
        alignItems: "center", justifyContent: "center", cursor: "zoom-out",
      }}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={src} alt={alt}
        onClick={e => e.stopPropagation()}
        style={{
          maxWidth: "90vw", maxHeight: "90vh",
          objectFit: "contain", borderRadius: 8,
          boxShadow: "0 8px 40px rgba(0,0,0,0.7)",
          cursor: "default",
        }}
      />
      <button
        onClick={onClose}
        style={{
          position: "absolute", top: 16, right: 20,
          background: "rgba(255,255,255,0.1)", border: "none",
          borderRadius: "50%", width: 36, height: 36,
          fontSize: 18, color: "#fff", cursor: "pointer",
          display: "flex", alignItems: "center", justifyContent: "center",
        }}
      >×</button>
    </div>
  );
}

/** Single image thumbnail card */
function ImageThumb({
  img,
  isDragging,
  onDragStart,
  onDragOver,
  onDrop,
  onPreview,
  onDelete,
  onReplace,
  onCaptionChange,
}: {
  img: QuestionImage;
  isDragging: boolean;
  onDragStart: () => void;
  onDragOver:  (e: React.DragEvent) => void;
  onDrop:      () => void;
  onPreview:   () => void;
  onDelete:    () => void;
  onReplace:   (f: File) => void;
  onCaptionChange: (c: string) => void;
}) {
  const [caption, setCaption] = useState(img.caption ?? "");
  const [captionDirty, setCaptionDirty] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [replacing, setReplacing] = useState(false);
  const replaceInputRef = useRef<HTMLInputElement>(null);

  const handleCaptionBlur = () => {
    if (captionDirty) { onCaptionChange(caption); setCaptionDirty(false); }
  };

  return (
    <div
      draggable
      onDragStart={onDragStart}
      onDragOver={onDragOver}
      onDrop={onDrop}
      style={{
        position: "relative",
        border: `1.5px solid ${isDragging ? "var(--accent)" : "var(--border)"}`,
        borderRadius: 8,
        background: "var(--surface3)",
        overflow: "hidden",
        opacity: isDragging ? 0.4 : 1,
        transition: "opacity 0.15s, border-color 0.15s",
        cursor: "grab",
      }}
    >
      {/* Image preview */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={img.public_url}
        alt={img.caption || img.filename}
        onClick={onPreview}
        style={{
          display: "block", width: "100%", height: 100,
          objectFit: "contain", cursor: "zoom-in",
          background: "rgba(0,0,0,0.2)",
        }}
      />

      {/* Action buttons overlay */}
      <div style={{
        position: "absolute", top: 4, right: 4,
        display: "flex", gap: 3,
      }}>
        {/* Replace button */}
        <button
          title="Thay thế ảnh"
          disabled={replacing}
          onClick={() => replaceInputRef.current?.click()}
          style={{
            background: "rgba(0,0,0,0.65)", border: "none", borderRadius: 4,
            color: "#fff", fontSize: 11, padding: "3px 6px", cursor: "pointer",
          }}
        >
          {replacing ? "…" : "↺"}
        </button>
        {/* Delete button */}
        <button
          title="Xóa ảnh"
          disabled={deleting}
          onClick={async () => {
            if (!confirm("Xóa ảnh này?")) return;
            setDeleting(true);
            onDelete();
          }}
          style={{
            background: "rgba(200,50,50,0.8)", border: "none", borderRadius: 4,
            color: "#fff", fontSize: 11, padding: "3px 6px", cursor: "pointer",
          }}
        >
          {deleting ? "…" : "×"}
        </button>
      </div>

      {/* Drag handle indicator */}
      <div style={{
        position: "absolute", top: 4, left: 4,
        fontSize: 10, color: "rgba(255,255,255,0.5)", cursor: "grab",
        userSelect: "none",
      }}>⠿</div>

      {/* File size badge */}
      <div style={{
        position: "absolute", bottom: 28, right: 4,
        fontSize: 9, color: "rgba(255,255,255,0.5)",
        background: "rgba(0,0,0,0.5)", borderRadius: 3, padding: "1px 4px",
      }}>
        {formatBytes(img.size_bytes)}
      </div>

      {/* Caption input */}
      <input
        type="text"
        placeholder="Ghi chú (tuỳ chọn)"
        value={caption}
        onChange={e => { setCaption(e.target.value); setCaptionDirty(true); }}
        onBlur={handleCaptionBlur}
        style={{
          width: "100%", background: "transparent", border: "none",
          borderTop: "1px solid var(--border)", color: "var(--text)",
          fontSize: 10, padding: "4px 6px", outline: "none",
          fontFamily: "inherit",
        }}
      />

      {/* Hidden replace file input */}
      <input
        ref={replaceInputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/gif"
        style={{ display: "none" }}
        onChange={async e => {
          const f = e.target.files?.[0];
          if (!f) return;
          setReplacing(true);
          onReplace(f);
          e.target.value = "";
        }}
      />
    </div>
  );
}

// ── Props ─────────────────────────────────────────────────────────────────────

interface Props {
  target: { draftId?: string; itemId?: string };
  /** Called after any mutation so parent can refresh if needed */
  onChanged?: () => void;
}

// ── Main component ────────────────────────────────────────────────────────────

export default function ImageManager({ target, onChanged }: Props) {
  const [images, setImages]       = useState<QuestionImage[]>([]);
  const [loading, setLoading]     = useState(true);
  const [uploading, setUploading] = useState(false);
  const [uploadErr, setUploadErr] = useState<string | null>(null);
  const [lightbox, setLightbox]   = useState<QuestionImage | null>(null);
  const [dragIdx, setDragIdx]     = useState<number | null>(null);
  const [dragOver, setDragOver]   = useState<number | null>(null);
  const dropZoneRef               = useRef<HTMLDivElement>(null);

  // ── Load images ──────────────────────────────────────────────────────────
  const load = useCallback(async () => {
    try {
      const imgs = target.draftId
        ? await getImagesForDraft(target.draftId)
        : target.itemId
        ? await getImagesForItem(target.itemId)
        : [];
      setImages(imgs.sort((a, b) => a.display_order - b.display_order));
    } catch { /* silent */ }
    finally { setLoading(false); }
  }, [target.draftId, target.itemId]);

  useEffect(() => { load(); }, [load]);

  // ── File upload handler ──────────────────────────────────────────────────
  const handleFiles = useCallback(async (rawFiles: FileList | File[]) => {
    setUploadErr(null);
    const files = Array.from(rawFiles).filter(f => ALLOWED.includes(f.type));
    if (!files.length) { setUploadErr("Chỉ hỗ trợ jpg, png, webp, gif"); return; }

    const tooLarge = files.find(f => f.size > MAX_BYTES);
    if (tooLarge) { setUploadErr(`${tooLarge.name} vượt quá 5 MB`); return; }

    const remaining = MAX_IMAGES - images.length;
    if (files.length > remaining) {
      setUploadErr(`Chỉ được tải thêm ${remaining} ảnh (tối đa ${MAX_IMAGES})`);
      return;
    }

    setUploading(true);
    try {
      const newImgs = await uploadImages(files, {
        draftId: target.draftId,
        itemId:  target.itemId,
      });
      setImages(prev => [...prev, ...newImgs]);
      onChanged?.();
    } catch (e: unknown) {
      setUploadErr(e instanceof Error ? e.message : "Lỗi tải lên");
    } finally {
      setUploading(false);
    }
  }, [images.length, target.draftId, target.itemId, onChanged]);

  // ── Drop-zone drag events ────────────────────────────────────────────────
  const handleDropZoneDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    if (e.dataTransfer.files.length) handleFiles(e.dataTransfer.files);
  }, [handleFiles]);

  // ── Thumbnail reorder (drag between cards) ───────────────────────────────
  const handleReorderDrop = useCallback(async (dropIdx: number) => {
    if (dragIdx === null || dragIdx === dropIdx) { setDragIdx(null); setDragOver(null); return; }
    const next = [...images];
    const [moved] = next.splice(dragIdx, 1);
    next.splice(dropIdx, 0, moved);
    setImages(next);
    setDragIdx(null);
    setDragOver(null);
    try {
      await reorderImages(next.map(i => i.id));
      onChanged?.();
    } catch { /* optimistic — silent */ }
  }, [dragIdx, images, onChanged]);

  // ── Delete ───────────────────────────────────────────────────────────────
  const handleDelete = useCallback(async (img: QuestionImage) => {
    setImages(prev => prev.filter(i => i.id !== img.id));
    try {
      await deleteImage(img.id);
      onChanged?.();
    } catch {
      setImages(prev => [...prev, img].sort((a,b) => a.display_order - b.display_order));
    }
  }, [onChanged]);

  // ── Replace ──────────────────────────────────────────────────────────────
  const handleReplace = useCallback(async (img: QuestionImage, file: File) => {
    try {
      const updated = await replaceImage(img.id, file);
      setImages(prev => prev.map(i => i.id === img.id ? updated : i));
      onChanged?.();
    } catch (e: unknown) {
      setUploadErr(e instanceof Error ? e.message : "Lỗi thay thế");
    }
  }, [onChanged]);

  // ── Caption ──────────────────────────────────────────────────────────────
  const handleCaption = useCallback(async (img: QuestionImage, caption: string) => {
    try {
      const updated = await updateImageMeta(img.id, { caption: caption || null });
      setImages(prev => prev.map(i => i.id === img.id ? updated : i));
    } catch { /* silent */ }
  }, []);

  // ── Render ───────────────────────────────────────────────────────────────
  const canUpload = images.length < MAX_IMAGES;

  return (
    <div style={{ marginTop: 10 }}>
      {/* Section header */}
      <div style={{
        fontSize: 11, fontWeight: 600, color: "var(--text-muted)",
        marginBottom: 8, display: "flex", alignItems: "center", gap: 6,
      }}>
        🖼 Hình ảnh
        <span style={{
          fontSize: 10, background: "var(--surface3)",
          border: "1px solid var(--border)", borderRadius: 4,
          padding: "1px 5px", color: "var(--text-muted)",
        }}>
          {images.length}/{MAX_IMAGES}
        </span>
        {loading && <span style={{ fontSize: 10, color: "var(--text-muted)" }}>Đang tải...</span>}
      </div>

      {/* Error banner */}
      {uploadErr && (
        <div style={{
          fontSize: 11, color: "var(--accent-red, #f85149)",
          background: "#f8514912", border: "1px solid #f8514930",
          borderRadius: 6, padding: "5px 8px", marginBottom: 8,
          display: "flex", justifyContent: "space-between",
        }}>
          <span>⚠ {uploadErr}</span>
          <button onClick={() => setUploadErr(null)} style={{
            background: "none", border: "none", color: "inherit",
            cursor: "pointer", fontSize: 12, lineHeight: 1,
          }}>×</button>
        </div>
      )}

      {/* Thumbnail grid */}
      {images.length > 0 && (
        <div style={{
          display: "grid",
          gridTemplateColumns: `repeat(${Math.min(images.length, 3)}, 1fr)`,
          gap: 6, marginBottom: 8,
        }}>
          {images.map((img, idx) => (
            <ImageThumb
              key={img.id}
              img={img}
              isDragging={dragOver === idx && dragIdx !== null && dragIdx !== idx}
              onDragStart={() => setDragIdx(idx)}
              onDragOver={e => { e.preventDefault(); setDragOver(idx); }}
              onDrop={() => handleReorderDrop(idx)}
              onPreview={() => setLightbox(img)}
              onDelete={() => handleDelete(img)}
              onReplace={f => handleReplace(img, f)}
              onCaptionChange={c => handleCaption(img, c)}
            />
          ))}
        </div>
      )}

      {/* Drop zone — shown when can upload */}
      {canUpload && (
        <div
          ref={dropZoneRef}
          onDragOver={e => { e.preventDefault(); e.currentTarget.style.borderColor = "var(--accent)"; }}
          onDragLeave={e => { e.currentTarget.style.borderColor = "var(--border)"; }}
          onDrop={e => { e.currentTarget.style.borderColor = "var(--border)"; handleDropZoneDrop(e); }}
          style={{
            border: "1.5px dashed var(--border)",
            borderRadius: 8,
            padding: "10px 12px",
            textAlign: "center",
            cursor: uploading ? "default" : "pointer",
            transition: "border-color 0.15s",
            background: "var(--surface3)",
            opacity: uploading ? 0.6 : 1,
          }}
          onClick={() => {
            if (uploading) return;
            const input = document.createElement("input");
            input.type = "file";
            input.multiple = true;
            input.accept = "image/jpeg,image/png,image/webp,image/gif";
            input.onchange = e => {
              const files = (e.target as HTMLInputElement).files;
              if (files) handleFiles(files);
            };
            input.click();
          }}
        >
          {uploading ? (
            <span style={{ fontSize: 12, color: "var(--text-muted)" }}>
              Đang tải lên...
            </span>
          ) : (
            <div>
              <div style={{ fontSize: 16, marginBottom: 3 }}>📎</div>
              <div style={{ fontSize: 11, color: "var(--text-muted)" }}>
                Kéo thả hoặc nhấn để chọn ảnh
              </div>
              <div style={{ fontSize: 10, color: "var(--text-muted)", marginTop: 2, opacity: 0.6 }}>
                JPG / PNG / WebP / GIF · tối đa 5MB · còn {MAX_IMAGES - images.length} ảnh
              </div>
            </div>
          )}
        </div>
      )}

      {/* Lightbox */}
      {lightbox && (
        <Lightbox
          src={lightbox.public_url}
          alt={lightbox.caption || lightbox.filename}
          onClose={() => setLightbox(null)}
        />
      )}
    </div>
  );
}
