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

// ── Graph API ──────────────────────────────────────────────────────────────

export const graphApi = {
  getGraph: () => request<GraphData>("/graph/"),
  getHealth: () => request<GraphHealth>("/graph/health"),

  createKC: (payload: CreateKCPayload) =>
    request<{ id: string; code: string; name: string; grade: number }>(
      "/graph/kc",
      { method: "POST", body: JSON.stringify(payload) }
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
