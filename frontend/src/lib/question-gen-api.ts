/**
 * question-gen-api.ts
 * API client for the MCQ Generation & Human Review workflow.
 */

const BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

// ─── Types ───────────────────────────────────────────────────────────────────

export interface MCQAnswer {
  label: string;
  text: string;
  is_correct: boolean;
}

export interface MCQContent {
  question: string;
  answers: MCQAnswer[];
}

export interface ItemDraft {
  id: string;
  kc_id: string;
  kc_name: string;
  kc_code: string;
  content: MCQContent;
  difficulty_label: "easy" | "medium" | "hard";
  is_diagnostic_anchor: boolean;
  kst_irt_tag: string | null;
  generation_job_id: string | null;
  sgk_section: string | null;
  status: "pending" | "approved" | "rejected" | "edited_approved";
  imported_item_id: string | null;
  reviewed_at: string | null;
  created_at: string;
  flagged: boolean;
  flag_note: string | null;
}

export interface KCStats {
  kc_id: string;
  kc_name: string;
  kc_code: string;
  grade?: number | null;
  chapter_info?: string | null;
  pending: number;
  approved: number;
  rejected: number;
  edited_approved: number;
  flagged: number;
  total: number;
}

export interface DraftStats {
  kcs: KCStats[];
  totals: {
    pending: number;
    approved: number;
    rejected: number;
    edited_approved: number;
    flagged: number;
    total: number;
  };
}

export interface JobStatus {
  running: boolean;
  job_id: string | null;
  progress: number;
  total: number;
  generated: number;
  skipped: number;
  errors: number;
  cost_usd: number;
  last_kc: string | null;
}

export interface CostEntry {
  kc_code: string;
  input_tokens: number;
  output_tokens: number;
  cost_usd: number;
  created_at: string;
}

export interface CostSummary {
  calls: number;
  total_input_tokens: number;
  total_output_tokens: number;
  total_cost_usd: number;
  model: string;
  price_input_per_1m: number;
  price_output_per_1m: number;
  entries: CostEntry[];
}

export interface StatusResponse {
  job: JobStatus;
  drafts: DraftStats;
  cost: CostSummary;
}

export interface KCNode {
  id: string;
  code: string;
  name: string;
  grade: number;
  chapter_info: string | null;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    headers: { "Content-Type": "application/json" },
    ...init,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(err.detail || `API error ${res.status}`);
  }
  return res.json() as Promise<T>;
}

// ─── API Functions ────────────────────────────────────────────────────────────

/** Trigger a batch MCQ generation job. */
export async function runGeneration(options?: {
  skip_threshold?: number;
  rate_limit_seconds?: number;
  dry_run?: boolean;
  target_grade?: number;
  target_semester?: number;
}) {
  return apiFetch("/question-gen/run", {
    method: "POST",
    body: JSON.stringify({
      skip_threshold: options?.skip_threshold ?? 6,
      rate_limit_seconds: options?.rate_limit_seconds ?? 2.0,
      dry_run: options?.dry_run ?? false,
      target_grade: options?.target_grade ?? 6,
      target_semester: options?.target_semester ?? 1,
    }),
  });
}

/** Poll job status and draft aggregate stats. */
export async function getStatus(): Promise<StatusResponse> {
  return apiFetch("/question-gen/status");
}

/** List all KCs with edges (generation candidates). */
export async function getKCsWithEdges(): Promise<{ kcs: KCNode[]; total: number }> {
  return apiFetch("/question-gen/kcs");
}

/** List drafts with optional filters. */
export async function getDrafts(params?: {
  kc_id?: string;
  status?: string;
  limit?: number;
  offset?: number;
}): Promise<{ drafts: ItemDraft[]; count: number }> {
  const qs = new URLSearchParams();
  if (params?.kc_id) qs.set("kc_id", params.kc_id);
  if (params?.status) qs.set("status", params.status);
  if (params?.limit) qs.set("limit", String(params.limit));
  if (params?.offset) qs.set("offset", String(params.offset));
  return apiFetch(`/question-gen/drafts?${qs}`);
}

/** Get a single draft. */
export async function getDraft(draftId: string): Promise<ItemDraft> {
  return apiFetch(`/question-gen/drafts/${draftId}`);
}

/** Create a manual (human-authored) draft, saved as status='pending'. */
export async function createDraft(payload: {
  kc_id: string;
  content: { question: string; answers: Array<{ label: string; text: string; is_correct: boolean }> };
  difficulty_label: "easy" | "medium" | "hard";
  is_diagnostic_anchor?: boolean;
  kst_irt_tag?: string | null;
}): Promise<ItemDraft> {
  return apiFetch("/question-gen/drafts", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

/** Update draft content (human edit). */
export async function updateDraft(
  draftId: string,
  patch: {
    content?: MCQContent;
    difficulty_label?: string;
    kst_irt_tag?: string;
  }
): Promise<ItemDraft> {
  return apiFetch(`/question-gen/drafts/${draftId}`, {
    method: "PATCH",
    body: JSON.stringify(patch),
  });
}

/** Approve a draft → creates Item in DB. */
export async function approveDraft(draftId: string) {
  return apiFetch(`/question-gen/drafts/${draftId}/approve`, {
    method: "POST",
  });
}

/** Reject a draft. */
export async function rejectDraft(draftId: string) {
  return apiFetch(`/question-gen/drafts/${draftId}/reject`, {
    method: "POST",
  });
}

export interface RevertDraftResponse {
  item_deleted: boolean;
  draft: ItemDraft;
}

/** Revert an approved/rejected draft back to pending (undo). */
export async function revertDraft(draftId: string): Promise<RevertDraftResponse> {
  return apiFetch<RevertDraftResponse>(`/question-gen/drafts/${draftId}/revert`, {
    method: "POST",
  });
}

/** Bulk approve all selected drafts for a KC. */
export async function bulkApprove(kcId: string, draftIds: string[]) {
  return apiFetch("/question-gen/drafts/bulk-approve", {
    method: "POST",
    body: JSON.stringify({ kc_id: kcId, draft_ids: draftIds }),
  });
}

/** Get cumulative OpenAI cost for this server session. */
export async function getCost(): Promise<CostSummary> {
  return apiFetch("/question-gen/cost");
}

// ─── SGK Content ─────────────────────────────────────────────────────────────

export interface SgkResponse {
  chapter_info: string;
  content: string;
  found: boolean;
}

/** Fetch SGK textbook section for a chapter_info like "B8K1" or "B23K2". */
export async function getSgkContent(chapterInfo: string): Promise<SgkResponse> {
  return apiFetch(`/question-gen/sgk/${encodeURIComponent(chapterInfo)}`);
}

// ─── Flag / Note ─────────────────────────────────────────────────────────────

/** Toggle flag on a draft with optional reviewer note. */
export async function flagDraft(
  draftId: string,
  flagged: boolean,
  flagNote?: string,
): Promise<ItemDraft> {
  return apiFetch(`/question-gen/drafts/${draftId}/flag`, {
    method: "POST",
    body: JSON.stringify({ flagged, flag_note: flagNote ?? null }),
  });
}

// ─── Export ───────────────────────────────────────────────────────────────────

/**
 * Fetch all flagged drafts as a Markdown file and trigger a browser download.
 * Returns the filename used.
 */
export async function exportFlaggedDrafts(): Promise<string> {
  const res = await fetch(`${BASE}/question-gen/drafts/flagged/export`, {
    headers: { Accept: "text/markdown" },
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error((err as { detail?: string }).detail || `API error ${res.status}`);
  }
  const blob = await res.blob();
  // Extract filename from Content-Disposition header, fallback to timestamp
  const disposition = res.headers.get("content-disposition") ?? "";
  const match = disposition.match(/filename="([^"]+)"/);
  const filename = match ? match[1] : `flagged_questions_${Date.now()}.md`;

  // Trigger download
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);

  return filename;
}

