"use client";

import { useState, useEffect, useRef } from "react";
import {
  Play, RotateCcw, ChevronRight, CheckCircle, XCircle,
  Zap, Brain, Target, AlertCircle, Info, ArrowLeft,
  TrendingUp, Activity, BookOpen, Eye
} from "lucide-react";
import Link from "next/link";

const BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

// ── Types ─────────────────────────────────────────────────────────────────────

interface SimStep {
  step: number;
  item_id: string;
  item_b: number;
  item_a: number;
  correct: boolean;
  theta: number;
  theta_se: number;
  p_mastery_before: number;
  p_mastery_after: number;
  is_mastered: boolean;
  zpd_target: number;
  actual_p_correct: number;
  reasoning?: string;
}

interface SimResult {
  profile: string;
  initial_theta: number;
  final_theta: number;
  final_p_mastery: number;
  is_mastered: boolean;
  total_steps: number;
  final_bkt_params: {
    p_mastery: number;
    p_know0: number;
    p_transit: number;
    p_guess: number;
    p_slip: number;
  };
  steps: SimStep[];
}

interface ItemFromApi {
  id: string;
  kc_id: string;
  irt_a: number;
  irt_b: number;
  irt_c: number;
  difficulty_label?: string;
  content?: { question?: string };
}

// ── Profile metadata ──────────────────────────────────────────────────────────

const PROFILES = [
  {
    id: "strong",
    label: "Học sinh giỏi",
    theta: 1.5,
    description: "θ=+1.5 · ~85% đúng · Học nhanh",
    color: "#3fb950",
    icon: "🏆",
  },
  {
    id: "average",
    label: "Học sinh TB",
    theta: 0.0,
    description: "θ=0.0 · ~60% đúng · Trung bình",
    color: "#388bfd",
    icon: "📚",
  },
  {
    id: "weak",
    label: "Học sinh yếu",
    theta: -1.5,
    description: "θ=-1.5 · ~30% đúng · Cần hỗ trợ",
    color: "#f85149",
    icon: "🌱",
  },
  {
    id: "guesser",
    label: "Đoán mò",
    theta: -1.0,
    description: "θ=-1.0 · ~25% đúng · Chọn random",
    color: "#d29922",
    icon: "🎲",
  },
  {
    id: "careless",
    label: "Bất cẩn",
    theta: 1.0,
    description: "θ=+1.0 · Biết nhưng hay sai",
    color: "#a371f7",
    icon: "⚡",
  },
];

// ── Helpers ───────────────────────────────────────────────────────────────────

function MasteryBar({ value, before, after }: { value: number; before?: number; after?: number }) {
  const pct = Math.min(100, value * 100);
  const color =
    value >= 0.95 ? "#3fb950" :
    value >= 0.75 ? "#388bfd" :
    value >= 0.40 ? "#d29922" : "#f85149";

  return (
    <div style={{ position: "relative" }}>
      <div style={{
        height: 8, borderRadius: 4, background: "#21262d", overflow: "hidden",
        position: "relative",
      }}>
        <div style={{
          height: "100%", width: `${pct}%`, background: color,
          borderRadius: 4, transition: "width 0.5s ease",
        }} />
        {before !== undefined && after !== undefined && (
          <div style={{
            position: "absolute", top: 0, left: `${before * 100}%`,
            width: `${(after - before) * 100}%`, height: "100%",
            background: color, opacity: 0.4, transition: "all 0.5s ease",
          }} />
        )}
      </div>
      <div style={{
        display: "flex", justifyContent: "space-between", marginTop: 2,
        fontSize: 10, color: "#8b949e",
      }}>
        <span>0%</span>
        <span style={{ color, fontWeight: 600 }}>{(value * 100).toFixed(1)}%</span>
        <span>100%</span>
      </div>
    </div>
  );
}

function StepCard({ step, index }: { step: SimStep; index: number }) {
  const [expanded, setExpanded] = useState(false);
  const delta = step.p_mastery_after - step.p_mastery_before;
  const stage =
    step.p_mastery_before < 0.4 ? { label: "EARLY", color: "#f85149" } :
    step.p_mastery_before < 0.75 ? { label: "MID", color: "#d29922" } :
    { label: "LATE", color: "#3fb950" };

  return (
    <div
      onClick={() => setExpanded(!expanded)}
      style={{
        background: step.is_mastered ? "rgba(63,185,80,0.08)" : "#161b22",
        border: `1px solid ${step.is_mastered ? "#3fb950" : step.correct ? "#21262d" : "#f8514940"}`,
        borderRadius: 8, padding: "10px 14px", cursor: "pointer",
        transition: "all 0.2s", userSelect: "none",
        animation: `fadeIn 0.3s ease ${index * 0.05}s both`,
      }}
    >
      {/* Header row */}
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        {/* Step number */}
        <div style={{
          width: 28, height: 28, borderRadius: "50%",
          background: step.correct ? "#3fb95020" : "#f8514920",
          border: `1px solid ${step.correct ? "#3fb950" : "#f85149"}`,
          display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: 12, fontWeight: 700, color: step.correct ? "#3fb950" : "#f85149",
          flexShrink: 0,
        }}>
          {step.step}
        </div>

        {/* Result icon */}
        {step.correct
          ? <CheckCircle size={16} color="#3fb950" />
          : <XCircle size={16} color="#f85149" />
        }

        {/* Difficulty badge */}
        <div style={{
          fontSize: 11, padding: "2px 8px", borderRadius: 4,
          background: "#21262d", color: "#8b949e", fontFamily: "monospace",
        }}>
          b={step.item_b.toFixed(2)} · a={step.item_a.toFixed(1)}
        </div>

        {/* Stage */}
        <div style={{
          fontSize: 10, padding: "1px 6px", borderRadius: 3,
          background: `${stage.color}20`, color: stage.color, fontWeight: 600,
        }}>
          {stage.label}
        </div>

        {/* Spacer */}
        <div style={{ flex: 1 }} />

        {/* P(L) change */}
        <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12 }}>
          <span style={{ color: "#8b949e" }}>{(step.p_mastery_before * 100).toFixed(1)}%</span>
          <ChevronRight size={12} color="#484f58" />
          <span style={{
            color: delta > 0 ? "#3fb950" : "#f85149", fontWeight: 600,
          }}>
            {(step.p_mastery_after * 100).toFixed(1)}%
          </span>
          {delta > 0 && (
            <span style={{ color: "#3fb950", fontSize: 10 }}>+{(delta * 100).toFixed(1)}%</span>
          )}
        </div>

        {/* Mastered badge */}
        {step.is_mastered && (
          <div style={{
            fontSize: 11, padding: "2px 8px", borderRadius: 4,
            background: "#3fb95030", color: "#3fb950", fontWeight: 700,
          }}>
            ✅ MASTERED
          </div>
        )}
      </div>

      {/* Expanded: θ + reasoning */}
      {expanded && (
        <div style={{ marginTop: 10, paddingTop: 10, borderTop: "1px solid #21262d" }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8, marginBottom: 10 }}>
            <div style={{ background: "#0d1117", borderRadius: 6, padding: 8 }}>
              <div style={{ fontSize: 10, color: "#8b949e", marginBottom: 2 }}>θ (Năng lực)</div>
              <div style={{ fontSize: 14, fontWeight: 600, color: "#388bfd" }}>
                {step.theta > 0 ? "+" : ""}{step.theta.toFixed(3)}
              </div>
              <div style={{ fontSize: 10, color: "#484f58" }}>SE={step.theta_se.toFixed(3)}</div>
            </div>
            <div style={{ background: "#0d1117", borderRadius: 6, padding: 8 }}>
              <div style={{ fontSize: 10, color: "#8b949e", marginBottom: 2 }}>ZPD Target</div>
              <div style={{ fontSize: 14, fontWeight: 600, color: "#d29922" }}>
                {(step.zpd_target * 100).toFixed(0)}%
              </div>
              <div style={{ fontSize: 10, color: "#484f58" }}>
                Actual: {(step.actual_p_correct * 100).toFixed(0)}%
              </div>
            </div>
            <div style={{ background: "#0d1117", borderRadius: 6, padding: 8 }}>
              <div style={{ fontSize: 10, color: "#8b949e", marginBottom: 2 }}>P(mastery)</div>
              <div style={{ fontSize: 14, fontWeight: 600, color: delta > 0 ? "#3fb950" : "#f85149" }}>
                {(step.p_mastery_after * 100).toFixed(1)}%
              </div>
              <div style={{ fontSize: 10, color: delta > 0 ? "#3fb95080" : "#f8514980" }}>
                {delta > 0 ? "▲" : "▼"} {Math.abs(delta * 100).toFixed(1)}%
              </div>
            </div>
          </div>
          {step.reasoning && (
            <div style={{
              fontSize: 11, color: "#8b949e", background: "#0d1117",
              borderRadius: 6, padding: "8px 10px", lineHeight: 1.6,
              borderLeft: "3px solid #30363d",
            }}>
              {step.reasoning}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function SandboxPage() {
  const [profile, setProfile] = useState("average");
  const [customTheta, setCustomTheta] = useState<number | null>(null);
  const [useCustomTheta, setUseCustomTheta] = useState(false);
  const [maxSteps, setMaxSteps] = useState(20);
  const [scriptedMode, setScriptedMode] = useState(false);
  const [scriptedInput, setScriptedInput] = useState(""); // "T,F,T,T,F"

  const [kcs, setKcs] = useState<any[]>([]);
  const [items, setItems] = useState<ItemFromApi[]>([]);
  const [selectedKcIds, setSelectedKcIds] = useState<Set<string>>(new Set());
  const [loadingKcs, setLoadingKcs] = useState(true);

  const [result, setResult] = useState<SimResult | null>(null);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const resultsRef = useRef<HTMLDivElement>(null);

  // Load KCs + items on mount
  useEffect(() => {
    async function loadData() {
      try {
        const [graphData, itemsData] = await Promise.all([
          fetch(`${BASE}/graph/`).then(r => r.json()),
          fetch(`${BASE}/items/`).then(r => r.json()),
        ]);
        setKcs(graphData.nodes ?? []);
        setItems(itemsData ?? []);
        // Auto-select all KCs
        if (graphData.nodes?.length) {
          setSelectedKcIds(new Set(graphData.nodes.map((n: any) => n.id)));
        }
      } catch (e) {
        setError("Không thể kết nối tới backend. Kiểm tra Render đã deploy chưa.");
      } finally {
        setLoadingKcs(false);
      }
    }
    loadData();
  }, []);

  const selectedProfile = PROFILES.find(p => p.id === profile)!;

  // Filter items by selected KCs
  const filteredItems = items.filter(item =>
    selectedKcIds.has(item.kc_id)
  );

  async function runSimulation() {
    if (filteredItems.length === 0) {
      setError("Không có items cho KC đã chọn. Cần thêm câu hỏi vào Item Bank.");
      return;
    }

    setRunning(true);
    setError(null);
    setResult(null);

    try {
      const payload: any = {
        profile,
        items: filteredItems.map(i => ({
          id: i.id,
          kc_id: i.kc_id,
          irt_a: i.irt_a,
          irt_b: i.irt_b,
          irt_c: i.irt_c,
        })),
        max_steps: maxSteps,
        verbose: true,
      };

      if (useCustomTheta && customTheta !== null) {
        payload.custom_theta = customTheta;
      }

      if (scriptedMode && scriptedInput.trim()) {
        payload.scripted_responses = scriptedInput
          .split(",")
          .map(s => s.trim().toUpperCase())
          .filter(s => s === "T" || s === "F")
          .map(s => s === "T");
      }

      const data = await fetch(`${BASE}/sandbox/simulate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      }).then(r => {
        if (!r.ok) throw new Error(`${r.status}`);
        return r.json();
      });

      setResult(data);
      setTimeout(() => resultsRef.current?.scrollIntoView({ behavior: "smooth" }), 100);
    } catch (e: any) {
      setError(`Simulation thất bại: ${e.message}`);
    } finally {
      setRunning(false);
    }
  }

  return (
    <div style={{
      minHeight: "100vh", background: "#0d1117", color: "#e6edf3",
      fontFamily: "'Inter', sans-serif", overflowY: "auto",
    }}>
      <style>{`
        @keyframes fadeIn { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: none; } }
        @keyframes pulse { 0%,100% { opacity: 1; } 50% { opacity: 0.5; } }
        .hover-btn:hover { opacity: 0.85; transform: translateY(-1px); }
        .kc-chip:hover { border-color: #388bfd !important; }
        input[type=range] { accent-color: #388bfd; }
      `}</style>

      {/* ── Header ── */}
      <div style={{
        borderBottom: "1px solid #21262d", padding: "16px 24px",
        display: "flex", alignItems: "center", gap: 16,
        position: "sticky", top: 0, background: "#0d1117", zIndex: 100,
      }}>
        <Link href="/" style={{
          display: "flex", alignItems: "center", gap: 6,
          color: "#8b949e", textDecoration: "none", fontSize: 13,
        }}>
          <ArrowLeft size={14} /> Graph Builder
        </Link>
        <div style={{ width: 1, height: 16, background: "#30363d" }} />
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <Eye size={18} color="#a371f7" />
          <span style={{ fontWeight: 700, fontSize: 16 }}>X-Ray Sandbox</span>
        </div>
        <div style={{
          fontSize: 11, padding: "2px 8px", borderRadius: 4,
          background: "#a371f720", color: "#a371f7", fontWeight: 600,
        }}>
          Assessment Simulator
        </div>
        <div style={{ flex: 1 }} />
        <div style={{ fontSize: 12, color: "#8b949e" }}>
          {filteredItems.length} items · {selectedKcIds.size} KCs
        </div>
      </div>

      <div style={{ maxWidth: 1100, margin: "0 auto", padding: "24px 24px 80px" }}>

        {/* ── 2-column layout ── */}
        <div style={{ display: "grid", gridTemplateColumns: "360px 1fr", gap: 24 }}>

          {/* ── LEFT: Config Panel ── */}
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>

            {/* Profile selector */}
            <div style={{
              background: "#161b22", border: "1px solid #30363d",
              borderRadius: 12, padding: 16,
            }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: "#8b949e", marginBottom: 12, textTransform: "uppercase", letterSpacing: "0.05em" }}>
                Student Profile
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {PROFILES.map(p => (
                  <button
                    key={p.id}
                    onClick={() => setProfile(p.id)}
                    style={{
                      display: "flex", alignItems: "center", gap: 12,
                      padding: "10px 12px", borderRadius: 8, cursor: "pointer",
                      border: profile === p.id
                        ? `1px solid ${p.color}`
                        : "1px solid #21262d",
                      background: profile === p.id ? `${p.color}15` : "#0d1117",
                      textAlign: "left", transition: "all 0.15s",
                    }}
                  >
                    <span style={{ fontSize: 18 }}>{p.icon}</span>
                    <div style={{ flex: 1 }}>
                      <div style={{
                        fontSize: 13, fontWeight: 600,
                        color: profile === p.id ? p.color : "#e6edf3",
                      }}>
                        {p.label}
                      </div>
                      <div style={{ fontSize: 11, color: "#8b949e" }}>{p.description}</div>
                    </div>
                    {profile === p.id && (
                      <div style={{
                        width: 8, height: 8, borderRadius: "50%",
                        background: p.color, flexShrink: 0,
                      }} />
                    )}
                  </button>
                ))}
              </div>
            </div>

            {/* Custom theta override */}
            <div style={{
              background: "#161b22", border: "1px solid #30363d",
              borderRadius: 12, padding: 16,
            }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: "#8b949e", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                  Custom θ (Năng lực)
                </div>
                <label style={{ display: "flex", alignItems: "center", gap: 6, cursor: "pointer" }}>
                  <div style={{
                    width: 32, height: 18, borderRadius: 9,
                    background: useCustomTheta ? "#388bfd" : "#30363d",
                    position: "relative", transition: "background 0.2s",
                  }} onClick={() => setUseCustomTheta(!useCustomTheta)}>
                    <div style={{
                      position: "absolute", top: 2, left: useCustomTheta ? 16 : 2,
                      width: 14, height: 14, borderRadius: "50%", background: "white",
                      transition: "left 0.2s",
                    }} />
                  </div>
                </label>
              </div>
              {useCustomTheta && (
                <div>
                  <input
                    type="range" min="-3" max="3" step="0.1"
                    value={customTheta ?? selectedProfile.theta}
                    onChange={e => setCustomTheta(parseFloat(e.target.value))}
                    style={{ width: "100%", marginBottom: 6 }}
                  />
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: "#8b949e" }}>
                    <span>-3.0 (Rất yếu)</span>
                    <span style={{ color: "#388bfd", fontWeight: 600, fontFamily: "monospace" }}>
                      θ = {(customTheta ?? selectedProfile.theta) > 0 ? "+" : ""}
                      {(customTheta ?? selectedProfile.theta).toFixed(1)}
                    </span>
                    <span>+3.0 (Rất giỏi)</span>
                  </div>
                </div>
              )}
            </div>

            {/* Scripted responses */}
            <div style={{
              background: "#161b22", border: "1px solid #30363d",
              borderRadius: 12, padding: 16,
            }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: "#8b949e", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                  Kịch bản Đúng/Sai
                </div>
                <label style={{ display: "flex", alignItems: "center", gap: 6, cursor: "pointer" }}>
                  <div style={{
                    width: 32, height: 18, borderRadius: 9,
                    background: scriptedMode ? "#388bfd" : "#30363d",
                    position: "relative", transition: "background 0.2s",
                  }} onClick={() => setScriptedMode(!scriptedMode)}>
                    <div style={{
                      position: "absolute", top: 2, left: scriptedMode ? 16 : 2,
                      width: 14, height: 14, borderRadius: "50%", background: "white",
                      transition: "left 0.2s",
                    }} />
                  </div>
                </label>
              </div>
              {scriptedMode ? (
                <div>
                  <input
                    type="text"
                    placeholder="T,F,T,T,F,T,T,T,T,T"
                    value={scriptedInput}
                    onChange={e => setScriptedInput(e.target.value)}
                    style={{
                      width: "100%", background: "#0d1117", border: "1px solid #30363d",
                      borderRadius: 6, padding: "8px 10px", color: "#e6edf3",
                      fontSize: 13, fontFamily: "monospace", outline: "none",
                    }}
                  />
                  <div style={{ fontSize: 11, color: "#8b949e", marginTop: 6 }}>
                    T = Đúng, F = Sai. Cách nhau bằng dấu phẩy.
                    {scriptedInput && (
                      <span style={{ color: "#388bfd", marginLeft: 6 }}>
                        {scriptedInput.split(",").filter(s => ["T","F"].includes(s.trim().toUpperCase())).length} bước
                      </span>
                    )}
                  </div>
                </div>
              ) : (
                <div style={{ fontSize: 12, color: "#484f58" }}>
                  Tắt → hệ thống tự simulate dựa trên IRT P(correct|θ)
                </div>
              )}
            </div>

            {/* Max steps */}
            <div style={{
              background: "#161b22", border: "1px solid #30363d",
              borderRadius: 12, padding: 16,
            }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: "#8b949e", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 12 }}>
                Số bước tối đa
              </div>
              <input
                type="range" min="5" max="40" step="5"
                value={maxSteps}
                onChange={e => setMaxSteps(parseInt(e.target.value))}
                style={{ width: "100%", marginBottom: 6 }}
              />
              <div style={{ textAlign: "center", fontSize: 13, fontWeight: 600, color: "#388bfd" }}>
                {maxSteps} bước
              </div>
            </div>

            {/* KC filter */}
            <div style={{
              background: "#161b22", border: "1px solid #30363d",
              borderRadius: 12, padding: 16,
            }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: "#8b949e", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                  Knowledge Components
                </div>
                <div style={{ display: "flex", gap: 8 }}>
                  <button
                    onClick={() => setSelectedKcIds(new Set(kcs.map((k: any) => k.id)))}
                    style={{ fontSize: 11, color: "#388bfd", background: "none", border: "none", cursor: "pointer" }}
                  >Chọn tất</button>
                  <button
                    onClick={() => setSelectedKcIds(new Set())}
                    style={{ fontSize: 11, color: "#8b949e", background: "none", border: "none", cursor: "pointer" }}
                  >Bỏ tất</button>
                </div>
              </div>
              {loadingKcs ? (
                <div style={{ color: "#8b949e", fontSize: 13 }}>Đang tải...</div>
              ) : (
                <div style={{ display: "flex", flexWrap: "wrap", gap: 6, maxHeight: 200, overflowY: "auto" }}>
                  {kcs.map((kc: any) => {
                    const selected = selectedKcIds.has(kc.id);
                    const itemCount = items.filter(i => i.kc_id === kc.id).length;
                    return (
                      <button
                        key={kc.id}
                        className="kc-chip"
                        onClick={() => {
                          const next = new Set(selectedKcIds);
                          if (selected) next.delete(kc.id); else next.add(kc.id);
                          setSelectedKcIds(next);
                        }}
                        style={{
                          fontSize: 11, padding: "4px 8px", borderRadius: 6, cursor: "pointer",
                          border: `1px solid ${selected ? "#388bfd" : "#30363d"}`,
                          background: selected ? "#388bfd20" : "#0d1117",
                          color: selected ? "#388bfd" : "#8b949e",
                          transition: "all 0.15s",
                        }}
                      >
                        {kc.code}
                        {itemCount > 0 && (
                          <span style={{ marginLeft: 4, opacity: 0.7 }}>({itemCount})</span>
                        )}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Run button */}
            <button
              onClick={runSimulation}
              disabled={running || filteredItems.length === 0}
              className="hover-btn"
              style={{
                display: "flex", alignItems: "center", justifyContent: "center",
                gap: 10, padding: "14px 24px", borderRadius: 10,
                background: running ? "#21262d" : `linear-gradient(135deg, ${selectedProfile.color}, ${selectedProfile.color}cc)`,
                border: "none", color: running ? "#8b949e" : "white",
                fontSize: 15, fontWeight: 700, cursor: running ? "not-allowed" : "pointer",
                transition: "all 0.2s", boxShadow: running ? "none" : `0 4px 20px ${selectedProfile.color}40`,
              }}
            >
              {running ? (
                <>
                  <Activity size={18} style={{ animation: "pulse 1s infinite" }} />
                  Đang chạy simulation...
                </>
              ) : (
                <>
                  <Play size={18} />
                  Chạy Simulation
                </>
              )}
            </button>

            {error && (
              <div style={{
                display: "flex", gap: 8, padding: "10px 12px", borderRadius: 8,
                background: "#f8514915", border: "1px solid #f8514940",
                fontSize: 12, color: "#f85149",
              }}>
                <AlertCircle size={14} style={{ flexShrink: 0, marginTop: 1 }} />
                {error}
              </div>
            )}
          </div>

          {/* ── RIGHT: Results ── */}
          <div ref={resultsRef}>
            {!result && !running && (
              <div style={{
                height: 400, display: "flex", flexDirection: "column",
                alignItems: "center", justifyContent: "center", gap: 16,
                color: "#484f58",
              }}>
                <Eye size={48} strokeWidth={1} />
                <div style={{ fontSize: 16, fontWeight: 600 }}>X-Ray Sandbox</div>
                <div style={{ fontSize: 13, textAlign: "center", maxWidth: 300, lineHeight: 1.6 }}>
                  Chọn profile học sinh và chạy simulation để xem hệ thống IRT + BKT hoạt động như thế nào theo từng bước.
                </div>
              </div>
            )}

            {result && (
              <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>

                {/* Summary cards */}
                <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12 }}>
                  {[
                    {
                      label: "Kết quả",
                      value: result.is_mastered ? "✅ MASTERED" : "⏳ Chưa master",
                      color: result.is_mastered ? "#3fb950" : "#d29922",
                      sub: `Sau ${result.total_steps} câu`,
                    },
                    {
                      label: "θ cuối (Năng lực)",
                      value: `${result.final_theta > 0 ? "+" : ""}${result.final_theta.toFixed(3)}`,
                      color: "#388bfd",
                      sub: `Bắt đầu: ${result.initial_theta > 0 ? "+" : ""}${result.initial_theta.toFixed(1)}`,
                    },
                    {
                      label: "P(mastery) cuối",
                      value: `${(result.final_p_mastery * 100).toFixed(1)}%`,
                      color: result.final_p_mastery >= 0.95 ? "#3fb950" : "#d29922",
                      sub: "Ngưỡng: 95%",
                    },
                    {
                      label: "Số câu đã làm",
                      value: result.total_steps,
                      color: "#a371f7",
                      sub: `Tối đa: ${maxSteps}`,
                    },
                  ].map((card, i) => (
                    <div key={i} style={{
                      background: "#161b22", border: "1px solid #30363d",
                      borderRadius: 10, padding: "14px 16px",
                      animation: `fadeIn 0.3s ease ${i * 0.07}s both`,
                    }}>
                      <div style={{ fontSize: 11, color: "#8b949e", marginBottom: 6 }}>{card.label}</div>
                      <div style={{ fontSize: 18, fontWeight: 700, color: card.color }}>{card.value}</div>
                      <div style={{ fontSize: 11, color: "#484f58", marginTop: 2 }}>{card.sub}</div>
                    </div>
                  ))}
                </div>

                {/* P(mastery) progression bar */}
                <div style={{
                  background: "#161b22", border: "1px solid #30363d",
                  borderRadius: 10, padding: 16,
                }}>
                  <div style={{ fontSize: 12, fontWeight: 600, color: "#8b949e", marginBottom: 10, display: "flex", alignItems: "center", gap: 6 }}>
                    <TrendingUp size={14} /> P(mastery) cuối
                  </div>
                  <MasteryBar value={result.final_p_mastery} />
                </div>

                {/* BKT params */}
                <div style={{
                  background: "#161b22", border: "1px solid #30363d",
                  borderRadius: 10, padding: 16,
                }}>
                  <div style={{ fontSize: 12, fontWeight: 600, color: "#8b949e", marginBottom: 10, display: "flex", alignItems: "center", gap: 6 }}>
                    <Brain size={14} /> BKT Parameters (IRT-injected)
                  </div>
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                    {Object.entries(result.final_bkt_params).map(([k, v]) => (
                      <div key={k} style={{
                        background: "#0d1117", borderRadius: 6, padding: "6px 10px",
                        border: "1px solid #21262d",
                      }}>
                        <div style={{ fontSize: 10, color: "#8b949e" }}>{k}</div>
                        <div style={{ fontSize: 13, fontWeight: 600, color: "#e6edf3", fontFamily: "monospace" }}>
                          {(v as number).toFixed(4)}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Step-by-step log */}
                <div style={{
                  background: "#161b22", border: "1px solid #30363d",
                  borderRadius: 10, padding: 16,
                }}>
                  <div style={{
                    fontSize: 12, fontWeight: 600, color: "#8b949e", marginBottom: 12,
                    display: "flex", alignItems: "center", gap: 6,
                  }}>
                    <Activity size={14} /> Step-by-step Log
                    <span style={{ marginLeft: "auto", fontSize: 11, color: "#484f58" }}>
                      Click từng bước để xem chi tiết
                    </span>
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                    {result.steps.map((step, i) => (
                      <StepCard key={step.step} step={step} index={i} />
                    ))}
                  </div>
                </div>

                {/* Re-run */}
                <button
                  onClick={() => { setResult(null); runSimulation(); }}
                  className="hover-btn"
                  style={{
                    display: "flex", alignItems: "center", justifyContent: "center",
                    gap: 8, padding: "10px 20px", borderRadius: 8,
                    background: "#21262d", border: "1px solid #30363d",
                    color: "#8b949e", fontSize: 13, cursor: "pointer", transition: "all 0.2s",
                  }}
                >
                  <RotateCcw size={14} /> Chạy lại
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
