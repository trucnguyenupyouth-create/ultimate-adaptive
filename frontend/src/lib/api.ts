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
  notes?: string;
}

export interface KCDetail extends KCNode {
  prerequisites: { id: string; code: string; name: string }[];
  successors: { id: string; code: string; name: string }[];
}

export interface GraphEdge {
  source: string; // prereq_id
  target: string; // kc_id
}

export interface GraphData {
  nodes: KCNode[];
  edges: GraphEdge[];
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
}

export interface UpdateKCPayload {
  name?: string;
  grade?: number;
  subject?: string;
  description?: string;
  notes?: string;
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

  addPrerequisite: (kc_id: string, prereq_id: string) =>
    request<{ ok: boolean; message?: string; detail?: string }>(
      "/graph/prerequisite",
      { method: "POST", body: JSON.stringify({ kc_id, prereq_id }) }
    ),

  removePrerequisite: (kc_id: string, prereq_id: string) =>
    request<{ ok: boolean }>(
      `/graph/prerequisite?kc_id=${kc_id}&prereq_id=${prereq_id}`,
      { method: "DELETE" }
    ),
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
