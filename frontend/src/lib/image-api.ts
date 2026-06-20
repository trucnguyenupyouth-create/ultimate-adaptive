/**
 * image-api.ts — Frontend API client for question image management.
 * Mirrors backend /images/* endpoints.
 */

const BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

export interface QuestionImage {
  id: string;
  item_id: string | null;
  draft_id: string | null;
  public_url: string;
  filename: string;
  mime_type: string;
  size_bytes: number;
  display_order: number;
  caption: string | null;
  created_at: string;
}

// ── List ──────────────────────────────────────────────────────────────────────

export async function getImagesForItem(itemId: string): Promise<QuestionImage[]> {
  const r = await fetch(`${BASE}/images/for-item/${itemId}`);
  if (!r.ok) throw new Error(await r.text());
  return r.json();
}

export async function getImagesForDraft(draftId: string): Promise<QuestionImage[]> {
  const r = await fetch(`${BASE}/images/for-draft/${draftId}`);
  if (!r.ok) throw new Error(await r.text());
  return r.json();
}

// ── Upload ────────────────────────────────────────────────────────────────────

export async function uploadImages(
  files: File[],
  target: { itemId?: string; draftId?: string },
): Promise<QuestionImage[]> {
  const form = new FormData();
  files.forEach(f => form.append("files", f));
  if (target.itemId)  form.append("item_id",  target.itemId);
  if (target.draftId) form.append("draft_id", target.draftId);

  const r = await fetch(`${BASE}/images/upload`, { method: "POST", body: form });
  if (!r.ok) {
    const err = await r.json().catch(() => ({ detail: r.statusText }));
    throw new Error(err.detail ?? r.statusText);
  }
  return r.json();
}

// ── Update metadata ───────────────────────────────────────────────────────────

export async function updateImageMeta(
  imageId: string,
  patch: { caption?: string | null; display_order?: number },
): Promise<QuestionImage> {
  const r = await fetch(`${BASE}/images/${imageId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(patch),
  });
  if (!r.ok) throw new Error(await r.text());
  return r.json();
}

// ── Delete ────────────────────────────────────────────────────────────────────

export async function deleteImage(imageId: string): Promise<void> {
  const r = await fetch(`${BASE}/images/${imageId}`, { method: "DELETE" });
  if (!r.ok && r.status !== 204) throw new Error(await r.text());
}

// ── Replace ───────────────────────────────────────────────────────────────────

export async function replaceImage(imageId: string, file: File): Promise<QuestionImage> {
  const form = new FormData();
  form.append("file", file);
  const r = await fetch(`${BASE}/images/${imageId}/replace`, { method: "POST", body: form });
  if (!r.ok) {
    const err = await r.json().catch(() => ({ detail: r.statusText }));
    throw new Error(err.detail ?? r.statusText);
  }
  return r.json();
}

// ── Reorder ───────────────────────────────────────────────────────────────────

export async function reorderImages(imageIds: string[]): Promise<QuestionImage[]> {
  const r = await fetch(`${BASE}/images/reorder`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ image_ids: imageIds }),
  });
  if (!r.ok) throw new Error(await r.text());
  return r.json();
}

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Format bytes as human-readable string. */
export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
