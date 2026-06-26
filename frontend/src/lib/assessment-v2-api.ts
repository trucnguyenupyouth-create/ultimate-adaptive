const BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    headers: { "Content-Type": "application/json", ...init?.headers },
    ...init,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(err.detail || `API error ${res.status}`);
  }
  return res.json() as Promise<T>;
}

export interface AssessmentV2Item {
  item_id: string;
  kc_id: string;
  kc_code?: string;
  kc_name?: string;
  question: string;
  answer_type?: string;
  answer_widget?: string;
  checker_type?: string;
  difficulty_label?: string;
  is_diagnostic_anchor?: boolean;
  progress_hint?: string;
}

export interface AssessmentV2SessionResponse {
  session_id: string;
  session_code: string;
  status: "in_progress" | "completed";
  max_questions: number;
  question_number?: number;
  item?: AssessmentV2Item | null;
  last_grading?: Record<string, unknown>;
  summary?: AssessmentV2Summary;
  responses?: AssessmentV2TranscriptStep[];
}

export interface AssessmentV2Result {
  session_id: string;
  session_code: string;
  status: "in_progress" | "completed";
  max_questions: number;
  summary: AssessmentV2Summary;
  responses: AssessmentV2TranscriptStep[];
  run: Record<string, unknown>;
}

export interface AssessmentV2SummaryRow {
  kc_id: string;
  code?: string;
  name?: string;
  state: string;
  probability_band: string;
  p_mastery: number;
}

export interface AssessmentV2Summary {
  strong_areas: AssessmentV2SummaryRow[];
  skills_to_review: AssessmentV2SummaryRow[];
  possibly_affected: AssessmentV2SummaryRow[];
  not_enough_evidence: AssessmentV2SummaryRow[];
  ready_to_learn: AssessmentV2SummaryRow[];
  value_metrics: {
    questions_asked: number;
    skills_directly_tested: number;
    skills_inferred: number;
    skills_not_directly_asked: number;
  };
}

export interface AssessmentV2TranscriptStep {
  step: number;
  item: AssessmentV2Item;
  answer: string;
  response_type: string;
  grading: {
    is_correct?: boolean;
    matched_rule?: string;
    normalized_answer?: string;
    diagnosed_misconception?: string | null;
    notes?: string[];
  };
}

export async function createAssessmentV2Session(options?: {
  max_questions?: number;
  student_label?: string;
}): Promise<AssessmentV2SessionResponse> {
  return apiFetch("/assessment-v2/sessions", {
    method: "POST",
    body: JSON.stringify({
      max_questions: options?.max_questions ?? 35,
      student_label: options?.student_label ?? null,
    }),
  });
}

export async function submitAssessmentV2Response(
  sessionId: string,
  payload: { item_id: string; answer?: unknown; response_type?: "answer" | "unknown" },
): Promise<AssessmentV2SessionResponse | AssessmentV2Result> {
  return apiFetch(`/assessment-v2/sessions/${sessionId}/responses`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function getAssessmentV2Result(sessionId: string): Promise<AssessmentV2Result> {
  return apiFetch(`/assessment-v2/sessions/${sessionId}/result`);
}
