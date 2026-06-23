"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  Background,
  BackgroundVariant,
  Controls,
  MarkerType,
  MiniMap,
  Panel,
  ReactFlow,
  ReactFlowProvider,
  type Edge,
  type Node,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import {
  Activity,
  ArrowLeft,
  Clock3,
  Eye,
  FileJson,
  GitBranch,
  Route,
} from "lucide-react";

import KCNodeComponent, { KCNodeData } from "@/components/KCNode";
import CustomEdgeComponent from "@/components/CustomEdge";
import {
  assessmentRunApi,
  AssessmentRunDetail,
  AssessmentRunKCGroup,
  AssessmentRunNodeState,
  AssessmentRunSummary,
  graphApi,
  GraphData,
  KCNode,
} from "@/lib/api";

const nodeTypes = {
  kcNode: KCNodeComponent,
};

const edgeTypes = {
  prerequisite: CustomEdgeComponent,
};

const STATE_COLORS: Record<AssessmentRunNodeState, string> = {
  tested_mastered: "#3fb950",
  inferred_mastered: "#7ee787",
  tested_gap: "#f85149",
  inferred_gap: "#d29922",
  unknown: "#6e7681",
};

function toRunNodes(
  graph: GraphData,
  nodeStates: Record<string, AssessmentRunNodeState>,
  testedOrder: Record<string, number>,
  currentKcId: string | null,
): Node[] {
  return (graph.nodes || []).map((node, index) => {
    const position = (
      node.metadata &&
      typeof node.metadata.x === "number" &&
      typeof node.metadata.y === "number"
    )
      ? { x: node.metadata.x, y: node.metadata.y }
      : { x: 250 * (index % 5), y: 190 * Math.floor(index / 5) };

    return {
      id: node.id,
      type: "kcNode",
      position,
      draggable: false,
      selectable: true,
      data: {
        id: node.id,
        code: node.code,
        name: node.name,
        grade: node.grade,
        subject: node.subject,
        chapter_info: node.chapter_info,
        runState: nodeStates[node.id] || "unknown",
        testedOrder: testedOrder[node.id] ?? null,
        isCurrentStep: currentKcId === node.id,
        hideHandles: true,
      } satisfies KCNodeData,
    };
  });
}

function toRunEdges(
  graph: GraphData,
  edgePath: Array<{ source: string; target: string }>,
): Edge[] {
  const highlighted = new Set(edgePath.map((edge) => `${edge.source}->${edge.target}`));
  const realEdges = (graph.edges || []).map((edge) => {
    const id = `${edge.source}->${edge.target}`;
    const isHighlighted = highlighted.has(id);
    const strokeColor = isHighlighted ? "#79c0ff" : "rgba(110, 118, 129, 0.35)";
    return {
      id,
      source: edge.source,
      target: edge.target,
      type: "prerequisite",
      selectable: false,
      data: {
        label: edge.label,
        edge_type: edge.edge_type ?? "prerequisite",
      },
      style: {
        stroke: strokeColor,
        strokeWidth: isHighlighted ? 3 : 1.5,
        opacity: isHighlighted ? 1 : 0.55,
      },
      markerEnd: {
        type: MarkerType.ArrowClosed,
        color: strokeColor,
        width: 14,
        height: 14,
      },
    } satisfies Edge;
  });

  const temporalEdges = edgePath.map((edge, index) => ({
    id: `run-path-${index}-${edge.source}-${edge.target}`,
    source: edge.source,
    target: edge.target,
    type: "smoothstep",
    selectable: false,
    animated: false,
    data: {
      label: `Step ${index + 1}`,
      edge_type: "inference",
    },
    style: {
      stroke: "rgba(88,166,255,0.9)",
      strokeWidth: 2,
      strokeDasharray: "6 5",
    },
    markerEnd: {
      type: MarkerType.ArrowClosed,
      color: "rgba(88,166,255,0.9)",
      width: 12,
      height: 12,
    },
  }) satisfies Edge[]);

  return [...realEdges, ...temporalEdges];
}

function applyTransitions(
  run: AssessmentRunDetail | null,
  upToGroupIndex: number,
): Record<string, AssessmentRunNodeState> {
  if (!run) return {};
  const transitions = run.overlay?.state_transitions || [];
  const groups = run.overlay?.steps_by_kc || [];
  const finalStates = run.overlay?.node_states || {};
  if (!transitions.length || upToGroupIndex < 0) {
    return upToGroupIndex < 0 ? {} : finalStates;
  }

  const allowedKcs = new Set(
    groups
      .slice(0, upToGroupIndex + 1)
      .map((group) => group.kc_id),
  );

  const replayed: Record<string, AssessmentRunNodeState> = {};
  for (const transition of transitions) {
    if (!allowedKcs.has(transition.kc_id)) continue;
    for (const change of transition.changes || []) {
      if (change?.kc_id && change?.to) {
        replayed[change.kc_id] = change.to;
      }
    }
  }
  return replayed;
}

function RunViewerPage() {
  const [graph, setGraph] = useState<GraphData | null>(null);
  const [runs, setRuns] = useState<AssessmentRunSummary[]>([]);
  const [selectedRunId, setSelectedRunId] = useState<string | null>(null);
  const [runDetail, setRunDetail] = useState<AssessmentRunDetail | null>(null);
  const [selectedGroupIndex, setSelectedGroupIndex] = useState<number>(-1);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [detailLoading, setDetailLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        setLoading(true);
        const [graphData, runsData] = await Promise.all([
          graphApi.getGraph(),
          assessmentRunApi.listRuns(),
        ]);
        if (cancelled) return;
        setGraph(graphData);
        setRuns(runsData.runs);
        setSelectedRunId((prev) => prev || runsData.runs[0]?.run_id || null);
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Failed to load assessment runs");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!selectedRunId) return;
    let cancelled = false;
    async function loadDetail() {
      try {
        setDetailLoading(true);
        const detail = await assessmentRunApi.getRun(selectedRunId);
        if (cancelled) return;
        setRunDetail(detail);
        const groupCount = detail.overlay?.steps_by_kc?.length || 0;
        setSelectedGroupIndex(groupCount > 0 ? groupCount - 1 : -1);
        setSelectedNodeId(null);
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Failed to load run detail");
        }
      } finally {
        if (!cancelled) setDetailLoading(false);
      }
    }
    loadDetail();
    return () => {
      cancelled = true;
    };
  }, [selectedRunId]);

  const groups = runDetail?.overlay?.steps_by_kc || [];
  const selectedGroup = selectedGroupIndex >= 0 ? groups[selectedGroupIndex] : null;

  const currentNodeStates = useMemo(() => {
    if (!runDetail) return {};
    if (selectedGroupIndex < 0) return runDetail.overlay?.node_states || {};
    return applyTransitions(runDetail, selectedGroupIndex);
  }, [runDetail, selectedGroupIndex]);

  const flowNodes = useMemo(() => {
    if (!graph) return [];
    return toRunNodes(
      graph,
      currentNodeStates,
      runDetail?.overlay?.tested_order || {},
      selectedNodeId || selectedGroup?.kc_id || null,
    );
  }, [graph, currentNodeStates, runDetail, selectedNodeId, selectedGroup]);

  const flowEdges = useMemo(() => {
    if (!graph) return [];
    return toRunEdges(graph, runDetail?.overlay?.edge_path || []);
  }, [graph, runDetail]);

  const selectedNodeGroup = useMemo(() => {
    if (!selectedNodeId) return selectedGroup;
    return groups.find((group) => group.kc_id === selectedNodeId) || selectedGroup;
  }, [groups, selectedGroup, selectedNodeId]);

  const stateCounts = runDetail?.overlay?.state_counts || {};

  return (
    <div style={{ height: "100vh", display: "grid", gridTemplateRows: "auto 1fr", background: "#0d1117", color: "#e6edf3" }}>
      <header style={{ borderBottom: "1px solid rgba(110,118,129,0.25)", background: "linear-gradient(180deg, rgba(17,24,39,0.96), rgba(13,17,23,0.96))", backdropFilter: "blur(10px)" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, padding: "14px 20px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <Link
              href="/"
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
                padding: "7px 12px",
                borderRadius: 8,
                color: "#c9d1d9",
                textDecoration: "none",
                border: "1px solid rgba(110,118,129,0.28)",
                background: "rgba(255,255,255,0.03)",
              }}
            >
              <ArrowLeft size={14} />
              Knowledge Graph
            </Link>
            <div>
              <div style={{ fontSize: 15, fontWeight: 700, display: "flex", alignItems: "center", gap: 8 }}>
                <Route size={16} color="#79c0ff" />
                Assessment Runs
              </div>
              <div style={{ fontSize: 12, color: "#8b949e" }}>
                Replay assessment flows on the real knowledge graph
              </div>
            </div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12, color: "#8b949e" }}>
            <FileJson size={14} />
            {runs.length} stored runs
          </div>
        </div>
      </header>

      <div style={{ display: "grid", gridTemplateColumns: "320px 1fr 380px", minHeight: 0 }}>
        <aside style={{ borderRight: "1px solid rgba(110,118,129,0.2)", background: "#11161d", minHeight: 0, overflowY: "auto" }}>
          <div style={{ padding: 16, display: "flex", flexDirection: "column", gap: 12 }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: "#8b949e", letterSpacing: "0.06em", textTransform: "uppercase" }}>
              Stored Runs
            </div>
            {loading && <div style={{ fontSize: 13, color: "#8b949e" }}>Loading runs...</div>}
            {error && <div style={{ fontSize: 13, color: "#f85149" }}>{error}</div>}
            {!loading && !runs.length && (
              <div style={{ fontSize: 13, color: "#8b949e" }}>No imported assessment runs yet.</div>
            )}
            {runs.map((run) => {
              const active = run.run_id === selectedRunId;
              return (
                <button
                  key={run.run_id}
                  onClick={() => setSelectedRunId(run.run_id)}
                  style={{
                    textAlign: "left",
                    borderRadius: 10,
                    border: active ? "1px solid rgba(88,166,255,0.45)" : "1px solid rgba(110,118,129,0.18)",
                    background: active ? "rgba(56,139,253,0.12)" : "rgba(255,255,255,0.02)",
                    padding: 12,
                    display: "flex",
                    flexDirection: "column",
                    gap: 8,
                    cursor: "pointer",
                    color: "#e6edf3",
                  }}
                >
                  <div style={{ fontSize: 13, fontWeight: 700 }}>{run.title}</div>
                  <div style={{ fontSize: 11, color: "#8b949e" }}>{run.source_file}</div>
                  <div style={{ display: "flex", gap: 6, flexWrap: "wrap", fontSize: 11 }}>
                    <span style={chipStyle("#79c0ff")}>{run.status || "unknown"}</span>
                    <span style={chipStyle("#3fb950")}>{run.steps} steps</span>
                    <span style={chipStyle("#d29922")}>{run.tested_kcs} tested KCs</span>
                    {run.pending_draft_steps > 0 && (
                      <span style={chipStyle("#f0883e")}>{run.pending_draft_steps} draft</span>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        </aside>

        <main style={{ position: "relative", minHeight: 0 }}>
          <ReactFlow
            nodes={flowNodes}
            edges={flowEdges}
            nodeTypes={nodeTypes}
            edgeTypes={edgeTypes}
            fitView
            fitViewOptions={{ padding: 0.18 }}
            minZoom={0.2}
            maxZoom={2}
            nodesDraggable={false}
            nodesConnectable={false}
            edgesFocusable={false}
            elementsSelectable={true}
            onNodeClick={(_, node) => setSelectedNodeId(node.id)}
          >
            <Background variant={BackgroundVariant.Dots} gap={24} size={1} color="rgba(110,118,129,0.22)" />
            <Controls position="bottom-left" />
            <MiniMap
              position="bottom-right"
              nodeColor={(node) => {
                const data = node.data as KCNodeData;
                return STATE_COLORS[data.runState || "unknown"];
              }}
              maskColor="rgba(13,17,23,0.72)"
            />
            <Panel position="top-left">
              <div style={{ display: "flex", flexDirection: "column", gap: 8, padding: 12, borderRadius: 12, border: "1px solid rgba(110,118,129,0.2)", background: "rgba(17,24,39,0.88)", backdropFilter: "blur(10px)", minWidth: 220 }}>
                <div style={{ fontSize: 12, fontWeight: 700, display: "flex", alignItems: "center", gap: 8 }}>
                  <Activity size={14} color="#79c0ff" />
                  Run State
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6, fontSize: 11 }}>
                  {Object.entries(stateCounts).map(([label, value]) => (
                    <div key={label} style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
                      <span style={{ color: "#8b949e" }}>{label}</span>
                      <span style={{ color: "#e6edf3", fontWeight: 700 }}>{value}</span>
                    </div>
                  ))}
                </div>
              </div>
            </Panel>
            <Panel position="bottom-center">
              <div style={{ minWidth: 520, padding: "10px 14px", borderRadius: 14, border: "1px solid rgba(110,118,129,0.2)", background: "rgba(17,24,39,0.9)", backdropFilter: "blur(10px)", display: "flex", flexDirection: "column", gap: 10 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
                  <div style={{ fontSize: 12, fontWeight: 700, display: "flex", alignItems: "center", gap: 8 }}>
                    <Clock3 size={13} color="#79c0ff" />
                    KC Transition Timeline
                  </div>
                  <div style={{ fontSize: 12, color: "#8b949e" }}>
                    {selectedGroup ? `${selectedGroupIndex + 1}/${groups.length}` : "No transitions"}
                  </div>
                </div>
                <input
                  type="range"
                  min={0}
                  max={Math.max(groups.length - 1, 0)}
                  value={Math.max(selectedGroupIndex, 0)}
                  disabled={!groups.length}
                  onChange={(e) => {
                    setSelectedGroupIndex(Number(e.target.value));
                    setSelectedNodeId(null);
                  }}
                />
                {selectedGroup && (
                  <div style={{ fontSize: 12, color: "#c9d1d9" }}>
                    Step {selectedGroupIndex + 1}: <strong>{selectedGroup.kc_code}</strong> - {selectedGroup.kc_name}
                  </div>
                )}
              </div>
            </Panel>
          </ReactFlow>
        </main>

        <aside style={{ borderLeft: "1px solid rgba(110,118,129,0.2)", background: "#11161d", minHeight: 0, overflowY: "auto" }}>
          <div style={{ padding: 16, display: "flex", flexDirection: "column", gap: 16 }}>
            <div>
              <div style={{ fontSize: 12, fontWeight: 700, color: "#8b949e", letterSpacing: "0.06em", textTransform: "uppercase" }}>
                Transcript
              </div>
              {detailLoading && <div style={{ marginTop: 8, fontSize: 13, color: "#8b949e" }}>Loading run detail...</div>}
            </div>

            {selectedNodeGroup ? (
              <>
                <div style={{ border: "1px solid rgba(110,118,129,0.2)", borderRadius: 12, padding: 14, background: "rgba(255,255,255,0.03)", display: "flex", flexDirection: "column", gap: 8 }}>
                  <div style={{ fontSize: 14, fontWeight: 700 }}>{selectedNodeGroup.kc_code}</div>
                  <div style={{ fontSize: 13, color: "#c9d1d9" }}>{selectedNodeGroup.kc_name}</div>
                  <div style={{ display: "flex", gap: 6, flexWrap: "wrap", fontSize: 11 }}>
                    <span style={chipStyle(selectedNodeGroup.persona_knows_kc ? "#3fb950" : "#f85149")}>
                      persona_knows={String(selectedNodeGroup.persona_knows_kc)}
                    </span>
                    <span style={chipStyle("#79c0ff")}>
                      {selectedNodeGroup.n_correct}/{selectedNodeGroup.n_items} correct
                    </span>
                  </div>
                </div>

                {(selectedNodeGroup.steps || []).map((step) => (
                  <div key={`${step.kc_id}-${step.step}`} style={{ border: "1px solid rgba(110,118,129,0.18)", borderRadius: 12, padding: 14, background: "rgba(255,255,255,0.02)", display: "flex", flexDirection: "column", gap: 10 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "flex-start" }}>
                      <div style={{ fontSize: 12, fontWeight: 700 }}>
                        Step {step.step}
                      </div>
                      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", justifyContent: "flex-end" }}>
                        <span style={chipStyle(step.agent_correct || step.correct ? "#3fb950" : "#f85149")}>
                          {(step.agent_correct || step.correct) ? "correct" : "wrong"}
                        </span>
                        {step.source && (
                          <span style={chipStyle(step.source === "pending_draft" ? "#f0883e" : "#8b949e")}>
                            {step.source}
                          </span>
                        )}
                        {step.is_diagnostic_anchor && <span style={chipStyle("#79c0ff")}>anchor</span>}
                        {step.difficulty_label && <span style={chipStyle("#c9d1d9")}>{step.difficulty_label}</span>}
                      </div>
                    </div>
                    {step.question && (
                      <div style={{ fontSize: 13, lineHeight: 1.5, color: "#e6edf3" }}>
                        {step.question}
                      </div>
                    )}
                    {(step.answers || []).length > 0 && (
                      <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                        {(step.answers || []).map((answer, index) => (
                          <div key={`${step.step}-${index}`} style={{ fontSize: 12, color: answer.is_correct ? "#7ee787" : "#8b949e" }}>
                            {answer.label}. {answer.text}
                          </div>
                        ))}
                      </div>
                    )}
                    <div style={{ fontSize: 12, color: "#c9d1d9" }}>
                      <strong>Correct:</strong> {step.correct_answer || "?"}
                    </div>
                    <div style={{ fontSize: 12, color: "#c9d1d9" }}>
                      <strong>Agent:</strong> {step.agent_answer || "?"}
                    </div>
                    {(step.agent_thinking || step.thinking) && (
                      <div style={{ fontSize: 12, color: "#8b949e", lineHeight: 1.5 }}>
                        <strong style={{ color: "#c9d1d9" }}>Reasoning:</strong> {step.agent_thinking || step.thinking}
                      </div>
                    )}
                  </div>
                ))}
              </>
            ) : (
              <div style={{ fontSize: 13, color: "#8b949e" }}>
                Select a run, then scrub the timeline or click a node to inspect its transcript.
              </div>
            )}

            {runDetail?.overlay?.frontier_history?.length ? (
              <div style={{ border: "1px solid rgba(110,118,129,0.2)", borderRadius: 12, padding: 14, background: "rgba(255,255,255,0.03)", display: "flex", flexDirection: "column", gap: 8 }}>
                <div style={{ fontSize: 12, fontWeight: 700, display: "flex", alignItems: "center", gap: 6 }}>
                  <Eye size={13} color="#79c0ff" />
                  Frontier Snapshot
                </div>
                {(() => {
                  const frontier = runDetail.overlay.frontier_history[Math.min(selectedGroupIndex, runDetail.overlay.frontier_history.length - 1)];
                  if (!frontier) {
                    return <div style={{ fontSize: 12, color: "#8b949e" }}>No frontier data for this step.</div>;
                  }
                  return (
                    <>
                      <div style={{ fontSize: 12, color: "#c9d1d9" }}>
                        Selected: <strong>{frontier.selected_kc || "none"}</strong>
                      </div>
                      <div style={{ fontSize: 12, color: "#8b949e" }}>
                        Reason: {frontier.reason || "n/a"}
                      </div>
                    </>
                  );
                })()}
              </div>
            ) : null}
          </div>
        </aside>
      </div>
    </div>
  );
}

function chipStyle(color: string) {
  return {
    display: "inline-flex",
    alignItems: "center",
    gap: 4,
    padding: "2px 7px",
    borderRadius: 999,
    fontSize: 11,
    fontWeight: 700,
    color,
    border: `1px solid ${color}55`,
    background: `${color}14`,
  } as const;
}

export default function AssessmentRunsPage() {
  return (
    <ReactFlowProvider>
      <RunViewerPage />
    </ReactFlowProvider>
  );
}
