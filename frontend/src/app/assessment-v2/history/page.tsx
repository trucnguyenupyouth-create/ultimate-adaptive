"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, RefreshCw, Search, CheckCircle2, AlertTriangle, HelpCircle } from "lucide-react";
import {
  getAssessmentV2Review,
  listAssessmentV2Sessions,
  type AssessmentV2Result,
  type AssessmentV2SessionMeta,
  type AssessmentV2SummaryRow,
  type AssessmentV2TranscriptStep,
} from "@/lib/assessment-v2-api";

const STATE_LABELS: Record<string, string> = {
  tested_mastered: "Đã test · vững",
  tested_gap: "Đã test · cần ôn",
  inferred_mastered: "Suy luận · có nền",
  inferred_gap: "Suy luận · có thể ảnh hưởng",
  unknown: "Chưa đủ bằng chứng",
};

function formatDate(value?: string | null) {
  if (!value) return "—";
  try {
    return new Intl.DateTimeFormat("vi-VN", {
      dateStyle: "short",
      timeStyle: "short",
    }).format(new Date(value));
  } catch {
    return value;
  }
}

function pct(value?: number) {
  if (typeof value !== "number" || Number.isNaN(value)) return "—";
  return `${Math.round(value * 100)}%`;
}

function correctness(step: AssessmentV2TranscriptStep) {
  if (step.response_type === "unknown") return { label: "Không biết", cls: "unknown", icon: HelpCircle };
  if (step.grading?.is_correct) return { label: "Đúng", cls: "correct", icon: CheckCircle2 };
  return { label: "Sai", cls: "wrong", icon: AlertTriangle };
}

function previousAnswerText(step?: AssessmentV2TranscriptStep) {
  if (!step) return "đây là câu đầu tiên";
  if (step.response_type === "unknown") return "câu trước học sinh chọn Không biết";
  return step.grading?.is_correct ? "câu trước đúng" : "câu trước sai";
}

function reasonText(reason?: string) {
  if (reason === "confirmation_after_breadth") {
    return "Câu xác nhận: hệ thống đã quét đủ rộng và cần thêm bằng chứng cho một node còn lưng chừng.";
  }
  if (reason === "complete_min_direct_evidence") {
    return "Câu bổ sung để hoàn tất bằng chứng trực tiếp tối thiểu.";
  }
  return "Engine chọn frontier có thông tin kỳ vọng cao nhất: nếu đúng hoặc sai đều giúp cập nhật nhiều node liên quan.";
}

function flattenRows(result: AssessmentV2Result): Array<{ group: string; row: AssessmentV2SummaryRow }> {
  return [
    ...result.summary.strong_areas.map((row) => ({ group: "Đã xác nhận vững", row })),
    ...result.summary.skills_to_review.map((row) => ({ group: "Kỹ năng cần review", row })),
    ...result.summary.possibly_affected.map((row) => ({ group: "Có thể bị ảnh hưởng", row })),
    ...result.summary.ready_to_learn.map((row) => ({ group: "Sẵn sàng học tiếp", row })),
    ...result.summary.not_enough_evidence.map((row) => ({ group: "Chưa đủ bằng chứng", row })),
  ];
}

export default function AssessmentV2HistoryPage() {
  const [sessions, setSessions] = useState<AssessmentV2SessionMeta[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [selected, setSelected] = useState<AssessmentV2Result | null>(null);
  const [query, setQuery] = useState("");
  const [loadingList, setLoadingList] = useState(true);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadSessions = async () => {
    setLoadingList(true);
    setError(null);
    try {
      const res = await listAssessmentV2Sessions({ limit: 100 });
      setSessions(res.sessions);
      if (!selectedId && res.sessions[0]) setSelectedId(res.sessions[0].session_id);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoadingList(false);
    }
  };

  useEffect(() => {
    let active = true;
    listAssessmentV2Sessions({ limit: 100 })
      .then((res) => {
        if (!active) return;
        setSessions(res.sessions);
        if (res.sessions[0]) setSelectedId(res.sessions[0].session_id);
      })
      .catch((err) => {
        if (active) setError((err as Error).message);
      })
      .finally(() => {
        if (active) setLoadingList(false);
      });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (!selectedId) return;
    let active = true;
    getAssessmentV2Review(selectedId)
      .then((review) => {
        if (active) setSelected(review);
      })
      .catch((err) => {
        if (active) setError((err as Error).message);
      })
      .finally(() => {
        if (active) setLoadingDetail(false);
      });
    return () => {
      active = false;
    };
  }, [selectedId]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return sessions;
    return sessions.filter((session) =>
      [session.session_code, session.student_label, session.status, session.recommendation?.code, session.recommendation?.name]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(q)),
    );
  }, [query, sessions]);

  const run = (selected?.run ?? {}) as {
    frontier_history?: Array<{
      selected_item?: string;
      reason?: string;
      top_candidates?: Array<{
        item_id?: string;
        expected_gain?: number;
        response_balance?: number;
        item_quality?: number;
        gain_if_correct?: number;
        gain_if_wrong?: number;
      }>;
    }>;
    states?: Record<string, {
      label?: string;
      p_mastery?: number;
      direct_evidence_count?: number;
      inferred_evidence_count?: number;
    }>;
    state_transitions?: Array<{
      kc_id?: string;
      changes?: Array<{ kc_id?: string; reason?: string; from_p_mastery?: number; to_p_mastery?: number }>;
    }>;
  };

  const responses = selected?.responses ?? [];
  const rows = selected ? flattenRows(selected) : [];
  const responseByKc = new Map(responses.map((step) => [step.item.kc_id, step]));

  return (
    <main className="history-shell">
      <aside className="history-sidebar">
        <div className="history-topbar">
          <Link href="/assessment-v2/algebra" className="back-link">
            <ArrowLeft size={16} /> Assessment
          </Link>
          <button className="icon-button" onClick={loadSessions} disabled={loadingList} title="Tải lại">
            <RefreshCw size={16} />
          </button>
        </div>

        <div>
          <p className="eyebrow">Assessment V2</p>
          <h1>Lịch sử test</h1>
          <p className="subtitle">Dữ liệu được đọc từ bảng production `assessment_v2_sessions`.</p>
        </div>

        <label className="search-box">
          <Search size={16} />
          <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Tìm session, học sinh, KC..." />
        </label>

        <div className="session-list">
          {loadingList && <div className="empty-card">Đang tải lịch sử...</div>}
          {!loadingList && filtered.length === 0 && <div className="empty-card">Chưa có session phù hợp.</div>}
          {filtered.map((session) => (
            <button
              key={session.session_id}
              className={`session-card ${selectedId === session.session_id ? "selected" : ""}`}
              onClick={() => {
                setSelected(null);
                setLoadingDetail(true);
                setSelectedId(session.session_id);
              }}
            >
              <div className="session-card-head">
                <strong>{session.student_label || session.session_code}</strong>
                <span className={session.status === "completed" ? "done" : "running"}>{session.status}</span>
              </div>
              <p>{formatDate(session.completed_at ?? session.updated_at ?? session.created_at)}</p>
              <div className="mini-metrics">
                <span>{session.questions_asked}/{session.max_questions} câu</span>
                <span>{session.correct_count} đúng</span>
                <span>{session.skills_directly_tested} node test</span>
              </div>
            </button>
          ))}
        </div>
      </aside>

      <section className="history-content">
        {error && <div className="error-card">{error}</div>}
        {loadingDetail && <div className="loading-card">Đang tải chi tiết session...</div>}
        {!loadingDetail && selected && (
          <>
            <header className="detail-header">
              <div>
                <p className="eyebrow">{selected.session_code}</p>
                <h2>Review kết quả assessment</h2>
                <p className="subtitle">
                  {responses.length} câu đã hỏi · {selected.summary.value_metrics.skills_directly_tested} node test trực tiếp · {selected.summary.value_metrics.skills_inferred} node suy luận
                </p>
              </div>
              <div className="header-actions">
                <Link href={`/assessment-v2/algebra`} className="primary-link">Mở assessment mới</Link>
              </div>
            </header>

            <div className="metric-grid">
              {[
                ["Câu đã hỏi", selected.summary.value_metrics.questions_asked],
                ["Node test trực tiếp", selected.summary.value_metrics.skills_directly_tested],
                ["Node suy luận", selected.summary.value_metrics.skills_inferred],
                ["Không hỏi trực tiếp", selected.summary.value_metrics.skills_not_directly_asked],
              ].map(([label, value]) => (
                <div key={label} className="metric-card">
                  <strong>{value}</strong>
                  <span>{label}</span>
                </div>
              ))}
            </div>

            <div className="review-grid">
              <section className="panel">
                <h3>1. Chuỗi câu hỏi theo thứ tự</h3>
                <div className="timeline">
                  {responses.map((step, index) => {
                    const result = correctness(step);
                    const Icon = result.icon;
                    const frontierEntry = run.frontier_history?.find((entry) => entry.selected_item === step.item.item_id) ?? run.frontier_history?.[index];
                    const candidate = frontierEntry?.top_candidates?.find((row) => row.item_id === step.item.item_id) ?? frontierEntry?.top_candidates?.[0];
                    return (
                      <article key={`${step.step}-${step.item.item_id}`} className="timeline-card">
                        <div className="timeline-head">
                          <span className="number">#{step.step}</span>
                          <div>
                            <p className="kc-code">{step.item.kc_code ?? step.item.kc_id}</p>
                            <h4>{step.item.kc_name ?? "Kỹ năng chưa đặt tên"}</h4>
                          </div>
                          <span className={`answer-chip ${result.cls}`}><Icon size={14} /> {result.label}</span>
                        </div>
                        <p className="question">{step.item.question}</p>
                        <div className="answer-table">
                          <span>Đáp án học sinh</span><strong>{step.response_type === "unknown" ? "Không biết" : step.answer || "—"}</strong>
                          <span>Checker</span><strong>{step.grading?.matched_rule ?? step.item.checker_type ?? "—"}</strong>
                          <span>Misconception</span><strong>{step.grading?.diagnosed_misconception || "Không phát hiện"}</strong>
                        </div>
                        <div className="why">
                          <strong>Vì sao hỏi câu này?</strong>
                          <p>
                            {index === 0
                              ? "Câu đầu tiên là điểm vào: engine chọn node/item có khả năng chia nhánh graph tốt và có item usable."
                              : `Sau khi ${previousAnswerText(responses[index - 1])}, engine chọn frontier tiếp theo để làm rõ vùng kiến thức còn chưa chắc.`}
                          </p>
                          <p>
                            {reasonText(frontierEntry?.reason)}
                            {candidate ? ` expected_gain=${candidate.expected_gain ?? "—"}, gain_if_correct=${candidate.gain_if_correct ?? "—"}, gain_if_wrong=${candidate.gain_if_wrong ?? "—"}.` : ""}
                          </p>
                        </div>
                      </article>
                    );
                  })}
                </div>
              </section>

              <section className="panel">
                <h3>2. Node được đánh dấu sau test</h3>
                <div className="node-list">
                  {rows.map(({ group, row }) => {
                    const direct = responseByKc.get(row.kc_id);
                    const transition = run.state_transitions
                      ?.flatMap((entry) => (entry.changes ?? []).map((change) => ({ ...change, source: entry.kc_id })))
                      .reverse()
                      .find((change) => change.kc_id === row.kc_id);
                    return (
                      <article key={`${group}-${row.kc_id}`} className="node-card">
                        <div className="node-head">
                          <div>
                            <p className="kc-code">{row.code ?? row.kc_id}</p>
                            <h4>{row.name ?? "Kỹ năng chưa đặt tên"}</h4>
                          </div>
                          <strong>{pct(row.p_mastery)}</strong>
                        </div>
                        <span className={`state-pill ${row.state}`}>{group} · {STATE_LABELS[row.state] ?? row.state}</span>
                        <p>
                          {direct
                            ? `Có bằng chứng trực tiếp ở câu ${direct.step}: ${direct.response_type === "unknown" ? "Không biết" : direct.grading?.is_correct ? "đúng" : "sai"}.`
                            : transition?.reason?.includes("descendant_decay")
                              ? `Suy luận giảm do node tiên quyết ${transition.source ?? "trước đó"} có tín hiệu yếu; đây là “có thể bị ảnh hưởng”, chưa phải kết luận tuyệt đối.`
                              : transition?.reason?.includes("ancestor_boost")
                                ? `Suy luận tăng do một node phía sau trong graph được trả lời đúng.`
                                : "Chưa có bằng chứng trực tiếp trong session này."}
                        </p>
                      </article>
                    );
                  })}
                </div>
              </section>
            </div>
          </>
        )}
        {!loadingDetail && !selected && <div className="loading-card">Chọn một session để xem chi tiết.</div>}
      </section>

      <style jsx>{`
        .history-shell {
          min-height: 100vh;
          display: grid;
          grid-template-columns: 360px minmax(0, 1fr);
          background: #f5f7ff;
          color: #111827;
        }
        .history-sidebar {
          border-right: 1px solid rgba(15, 23, 42, 0.08);
          background: #ffffff;
          padding: 22px;
          display: flex;
          flex-direction: column;
          gap: 18px;
          min-height: 100vh;
        }
        .history-topbar, .session-card-head, .detail-header, .timeline-head, .node-head {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          gap: 12px;
        }
        .back-link, .primary-link, .icon-button {
          border: 1px solid rgba(15, 23, 42, 0.1);
          background: #ffffff;
          border-radius: 999px;
          padding: 9px 12px;
          display: inline-flex;
          align-items: center;
          gap: 8px;
          font-weight: 800;
          color: #3d72f8;
          text-decoration: none;
        }
        .icon-button {
          width: 38px;
          height: 38px;
          justify-content: center;
          cursor: pointer;
        }
        .eyebrow, .kc-code {
          margin: 0 0 5px;
          font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
          color: #3d72f8;
          font-size: 11px;
          font-weight: 900;
          text-transform: uppercase;
          letter-spacing: 0;
        }
        h1, h2, h3, h4, p {
          margin-top: 0;
        }
        h1 {
          font-size: 32px;
          line-height: 1;
          margin-bottom: 8px;
        }
        h2 {
          font-size: 30px;
          margin-bottom: 8px;
        }
        h3 {
          font-size: 20px;
          margin-bottom: 16px;
        }
        h4 {
          font-size: 16px;
          margin-bottom: 0;
          line-height: 1.2;
        }
        .subtitle {
          color: #6b7280;
          line-height: 1.5;
          margin-bottom: 0;
        }
        .search-box {
          display: flex;
          align-items: center;
          gap: 8px;
          border: 1px solid rgba(15, 23, 42, 0.1);
          border-radius: 14px;
          padding: 10px 12px;
          background: #f8fafc;
        }
        .search-box input {
          border: none;
          background: transparent;
          outline: none;
          width: 100%;
          font-size: 14px;
        }
        .session-list, .timeline, .node-list {
          display: flex;
          flex-direction: column;
          gap: 12px;
        }
        .session-card, .empty-card, .loading-card, .error-card, .metric-card, .panel, .timeline-card, .node-card {
          border: 1px solid rgba(15, 23, 42, 0.08);
          border-radius: 18px;
          background: #ffffff;
          box-shadow: 0 10px 28px rgba(15, 23, 42, 0.04);
        }
        .session-card {
          width: 100%;
          text-align: left;
          padding: 14px;
          cursor: pointer;
        }
        .session-card.selected {
          border-color: rgba(61, 114, 248, 0.55);
          background: #eef2ff;
        }
        .session-card p {
          margin: 8px 0;
          color: #6b7280;
          font-size: 12px;
        }
        .done, .running {
          border-radius: 999px;
          padding: 4px 8px;
          font-size: 11px;
          font-weight: 900;
        }
        .done {
          background: #ecfdf5;
          color: #10b981;
        }
        .running {
          background: #fff8ec;
          color: #f59e0b;
        }
        .mini-metrics {
          display: flex;
          gap: 6px;
          flex-wrap: wrap;
        }
        .mini-metrics span {
          border-radius: 999px;
          background: #f3f4f6;
          padding: 5px 8px;
          font-size: 11px;
          font-weight: 800;
          color: #374151;
        }
        .history-content {
          padding: 28px;
          overflow: auto;
        }
        .header-actions {
          display: flex;
          gap: 8px;
        }
        .metric-grid {
          display: grid;
          grid-template-columns: repeat(4, minmax(0, 1fr));
          gap: 12px;
          margin: 20px 0;
        }
        .metric-card {
          padding: 16px;
        }
        .metric-card strong {
          display: block;
          font-size: 30px;
          line-height: 1;
        }
        .metric-card span {
          display: block;
          color: #6b7280;
          margin-top: 6px;
          font-weight: 700;
        }
        .review-grid {
          display: grid;
          grid-template-columns: minmax(0, 1.1fr) minmax(340px, 0.9fr);
          gap: 18px;
          align-items: start;
        }
        .panel {
          padding: 20px;
        }
        .timeline-card, .node-card, .empty-card, .loading-card, .error-card {
          padding: 16px;
        }
        .number {
          width: 38px;
          height: 38px;
          border-radius: 12px;
          background: #3d72f8;
          color: white;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          font-weight: 950;
          flex-shrink: 0;
        }
        .answer-chip {
          display: inline-flex;
          align-items: center;
          gap: 5px;
          border-radius: 999px;
          padding: 6px 9px;
          font-size: 12px;
          font-weight: 900;
          white-space: nowrap;
        }
        .answer-chip.correct { background: #ecfdf5; color: #10b981; }
        .answer-chip.wrong { background: #fef2f2; color: #ef4444; }
        .answer-chip.unknown { background: #fff8ec; color: #f59e0b; }
        .question {
          font-weight: 750;
          line-height: 1.55;
          margin: 12px 0;
        }
        .answer-table {
          display: grid;
          grid-template-columns: 130px minmax(0, 1fr);
          gap: 7px 10px;
          border-radius: 14px;
          background: #f8fafc;
          padding: 12px;
          font-size: 13px;
        }
        .answer-table span {
          color: #6b7280;
        }
        .answer-table strong {
          overflow-wrap: anywhere;
        }
        .why {
          margin-top: 12px;
          border-radius: 14px;
          background: #eef2ff;
          border: 1px solid rgba(61, 114, 248, 0.14);
          padding: 12px;
        }
        .why p {
          color: #374151;
          font-size: 13px;
          line-height: 1.5;
          margin: 7px 0 0;
        }
        .state-pill {
          display: inline-flex;
          margin: 10px 0;
          border-radius: 999px;
          padding: 6px 9px;
          font-size: 12px;
          font-weight: 900;
          background: #f3f4f6;
        }
        .state-pill.tested_mastered, .state-pill.inferred_mastered { color: #10b981; background: #ecfdf5; }
        .state-pill.tested_gap { color: #ef4444; background: #fef2f2; }
        .state-pill.inferred_gap { color: #f59e0b; background: #fff8ec; }
        .node-card p {
          color: #374151;
          line-height: 1.5;
          margin-bottom: 0;
        }
        .error-card {
          color: #ef4444;
          background: #fef2f2;
          margin-bottom: 16px;
        }
        @media (max-width: 1050px) {
          .history-shell, .review-grid {
            grid-template-columns: 1fr;
          }
          .history-sidebar {
            min-height: auto;
          }
          .metric-grid {
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }
        }
      `}</style>
    </main>
  );
}
