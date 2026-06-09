// API client — thin wrapper over fetch, typed responses

const BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    headers: { "Content-Type": "application/json", ...init?.headers },
    ...init,
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`${res.status} ${path}: ${text}`);
  }
  return res.json();
}

// ── Types ──────────────────────────────────────────────────────────────────

export interface KCNode {
  id: string;
  code: string;
  name: string;
  grade: number;
  subject: string;
  description?: string;
  chapter_info?: string;
  notes?: string;
  block_id?: string | null;
}

export interface KCDetail extends KCNode {
  prerequisites: { id: string; code: string; name: string }[];
  successors: { id: string; code: string; name: string }[];
}

export interface GraphEdge {
  source: string; // prereq_id
  target: string; // kc_id
  label?: string | null;
  weight?: number;
  edge_type?: "prerequisite" | "inference" | "unsure";
}

export interface EdgeHistoryEntry {
  id: string;
  action: string;
  payload: any;
  created_at: string;
  performed_by_name: string;
}

export interface EdgeDetail {
  kc_id: string;
  prereq_id: string;
  label?: string | null;
  weight: number;
  created_at?: string | null;
  created_by?: string | null;
  created_by_name?: string | null;
  source_code: string;
  source_name: string;
  target_code: string;
  target_name: string;
  history: EdgeHistoryEntry[];
}

export interface GraphBlock {
  id: string;
  name: string;
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface CreateBlockPayload {
  name: string;
  x: number;
  y: number;
  width?: number;
  height?: number;
}

export interface UpdateBlockPayload {
  name?: string;
  x?: number;
  y?: number;
  width?: number;
  height?: number;
}

export type EdgeType = "prerequisite" | "inference" | "unsure";

export interface GraphNote {
  id: string;
  content: string;
  x: number;
  y: number;
  width: number;
  height: number;
  color: string;
}

export interface CreateNotePayload {
  content?: string;
  x: number;
  y: number;
  width?: number;
  height?: number;
  color?: string;
}

export interface UpdateNotePayload {
  content?: string;
  x?: number;
  y?: number;
  width?: number;
  height?: number;
}

export interface GraphData {
  nodes: KCNode[];
  edges: GraphEdge[];
  blocks: GraphBlock[];
  notes: GraphNote[];
}

export interface ItemCount {
  kc_id: string;
  total: number;
  easy: number;
  medium: number;
  hard: number;
}

export interface GraphHealth {
  total_kcs: number;
  total_edges: number;
  is_dag: boolean;
  root_kcs: string[];
  leaf_kcs: string[];
  isolated_kcs: string[];
  item_counts: Record<string, ItemCount>;
  low_item_kcs: string[];
}

export interface CreateKCPayload {
  code: string;
  name: string;
  grade: number;
  subject?: string;
  description?: string;
  chapter_info: string;
  block_id?: string | null;
}

export interface UpdateKCPayload {
  name?: string;
  grade?: number;
  subject?: string;
  description?: string;
  chapter_info?: string;
  notes?: string;
  block_id?: string | null;
}

export type DifficultyLabel = "easy" | "medium" | "hard";

export interface MCQAnswer {
  label: string;
  text: string;
  is_correct: boolean;
}

export interface MCQContent {
  question: string;
  answers: MCQAnswer[];
}

export interface Item {
  id: string;
  kc_id: string;
  version: number;
  content: MCQContent;
  difficulty_label: DifficultyLabel;
  format_type: string;
  irt_b: number;
  irt_c?: number;
  is_active: boolean;
  created_at: string;
}

export interface CreateItemPayload {
  kc_id: string;
  difficulty_label: DifficultyLabel;
  format_type: "mcq";
  content: MCQContent;
}

// ── Graph API ──────────────────────────────────────────────────────────────

export const graphApi = {
  getGraph: () => request<GraphData>("/graph/"),
  getHealth: () => request<GraphHealth>("/graph/health"),

  createKC: (payload: CreateKCPayload) =>
    request<{ id: string; code: string; name: string; grade: number }>(
      "/graph/kc",
      { method: "POST", body: JSON.stringify(payload) }
    ),

  getKCDetail: (id: string) =>
    request<KCDetail>(`/graph/kc/${id}`),

  updateKC: (id: string, payload: UpdateKCPayload) =>
    request<KCNode>(`/graph/kc/${id}`, {
      method: "PUT",
      body: JSON.stringify(payload),
    }),

  deleteKC: (id: string) =>
    request<{ ok: boolean; deleted_items: number; deleted_edges: number }>(
      `/graph/kc/${id}`,
      { method: "DELETE" }
    ),

  addPrerequisite: (kc_id: string, prereq_id: string, label?: string | null, weight?: number, edge_type?: string) =>
    request<{ ok: boolean; message?: string; detail?: string }>(
      "/graph/prerequisite",
      { method: "POST", body: JSON.stringify({ kc_id, prereq_id, label, weight, edge_type: edge_type ?? "prerequisite" }) }
    ),

  removePrerequisite: (kc_id: string, prereq_id: string) =>
    request<{ ok: boolean }>(
      `/graph/prerequisite?kc_id=${kc_id}&prereq_id=${prereq_id}`,
      { method: "DELETE" }
    ),

  getEdge: (kc_id: string, prereq_id: string) =>
    request<EdgeDetail>(`/graph/edge?kc_id=${kc_id}&prereq_id=${prereq_id}`),

  updateEdge: (kc_id: string, prereq_id: string, label: string | null, weight?: number) =>
    request<{ ok: boolean }>("/graph/edge", {
      method: "PATCH",
      body: JSON.stringify({ kc_id, prereq_id, label, weight }),
    }),

  reverseEdge: (kc_id: string, prereq_id: string) =>
    request<{ ok: boolean }>("/graph/edge/reverse", {
      method: "POST",
      body: JSON.stringify({ kc_id, prereq_id }),
    }),

  createBlock: (payload: CreateBlockPayload) =>
    request<GraphBlock>("/graph/block", {
      method: "POST",
      body: JSON.stringify(payload),
    }),

  updateBlock: (id: string, payload: UpdateBlockPayload) =>
    request<GraphBlock>(`/graph/block/${id}`, {
      method: "PUT",
      body: JSON.stringify(payload),
    }),

  deleteBlock: (id: string) =>
    request<{ ok: boolean }>(`/graph/block/${id}`, {
      method: "DELETE",
    }),

  changeEdgeType: (kc_id: string, prereq_id: string, edge_type: EdgeType) =>
    request<{ ok: boolean }>("/graph/edge/change-type", {
      method: "POST",
      body: JSON.stringify({ kc_id, prereq_id, edge_type }),
    }),

  createNote: (payload: CreateNotePayload) =>
    request<GraphNote>("/graph/note", {
      method: "POST",
      body: JSON.stringify(payload),
    }),

  updateNote: (id: string, payload: UpdateNotePayload) =>
    request<GraphNote>(`/graph/note/${id}`, {
      method: "PUT",
      body: JSON.stringify(payload),
    }),

  deleteNote: (id: string) =>
    request<{ ok: boolean }>(`/graph/note/${id}`, {
      method: "DELETE",
    }),
};

// ── Item Bank API ──────────────────────────────────────────────────────────

export const itemApi = {
  list: (kcId: string, activeOnly = true) =>
    request<Item[]>(`/items/?kc_id=${kcId}&active_only=${activeOnly}`),

  create: (payload: CreateItemPayload) =>
    request<Item>("/items/", { method: "POST", body: JSON.stringify(payload) }),

  edit: (itemId: string, payload: CreateItemPayload) =>
    request<{ old_id: string; new_item: Item }>(`/items/${itemId}`, {
      method: "PUT",
      body: JSON.stringify(payload),
    }),

  toggle: (itemId: string, isActive: boolean) =>
    request<{ ok: boolean; is_active: boolean }>(`/items/${itemId}/toggle`, {
      method: "PATCH",
      body: JSON.stringify({ is_active: isActive }),
    }),
};
