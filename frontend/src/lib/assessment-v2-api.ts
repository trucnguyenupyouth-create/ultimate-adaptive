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
  learning_loop?: AssessmentV2LearningLoop;
  responses: AssessmentV2TranscriptStep[];
  run: Record<string, unknown>;
  mastery_check?: AssessmentV2MasteryCheck;
  audit?: {
    frontier_history?: unknown[];
    state_transitions?: unknown[];
    evidence_by_kc?: Record<string, unknown[]>;
  };
}

export interface AssessmentV2SessionMeta {
  session_id: string;
  session_code: string;
  status: "in_progress" | "completed";
  student_label?: string | null;
  max_questions: number;
  questions_asked: number;
  correct_count: number;
  unknown_count: number;
  skills_directly_tested: number;
  skills_inferred: number;
  created_at?: string | null;
  updated_at?: string | null;
  completed_at?: string | null;
  recommendation?: (AssessmentV2SummaryRow & { source_bucket?: string }) | null;
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

export interface AssessmentV2LearningLoop {
  recommendation?: AssessmentV2SummaryRow & { source_bucket?: string } | null;
  lesson?: {
    lesson_id?: string;
    title: string;
    subtitle: string;
    concept: string;
    worked_example: string[];
    practice_prompt: string;
    mastery: {
      prompt: string;
      answer_widget: string;
      accepted_answers: string[];
      hint: string;
    };
  } | null;
  mastery_status: "not_started" | "passed" | "needs_more_practice" | string;
  mastery_checks: AssessmentV2MasteryCheck[];
  updated_at?: string | null;
}

export interface AssessmentV2MasteryCheck {
  step: number;
  submitted_at: string;
  answer: string;
  accepted_answers: string[];
  correct: boolean;
  lesson_id?: string | null;
  target_kc_id?: string | null;
  target_kc_code?: string | null;
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

export async function listAssessmentV2Sessions(options?: {
  limit?: number;
  status?: "in_progress" | "completed";
}): Promise<{ sessions: AssessmentV2SessionMeta[]; limit: number; status?: string | null }> {
  const params = new URLSearchParams();
  params.set("limit", String(options?.limit ?? 50));
  if (options?.status) params.set("status", options.status);
  return apiFetch(`/assessment-v2/sessions?${params.toString()}`);
}

export async function getAssessmentV2Session(sessionId: string): Promise<AssessmentV2SessionResponse | AssessmentV2Result> {
  return apiFetch(`/assessment-v2/sessions/${sessionId}`);
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

export async function getAssessmentV2Review(sessionId: string): Promise<AssessmentV2Result> {
  return apiFetch(`/assessment-v2/sessions/${sessionId}/review`);
}

export async function getAssessmentV2LearningLoop(sessionId: string): Promise<{
  session_id: string;
  session_code: string;
  learning_loop: AssessmentV2LearningLoop;
}> {
  return apiFetch(`/assessment-v2/sessions/${sessionId}/learning-loop`);
}

export async function submitAssessmentV2Mastery(
  sessionId: string,
  payload: { answer?: unknown },
): Promise<AssessmentV2Result> {
  return apiFetch(`/assessment-v2/sessions/${sessionId}/mastery`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}
