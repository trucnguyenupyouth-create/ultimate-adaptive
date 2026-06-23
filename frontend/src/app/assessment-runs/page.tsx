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
  useReactFlow,
  type Edge,
  type Node,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import {
  Activity,
  ArrowLeft,
  BookOpen,
  CheckCircle2,
  Eye,
  FileJson,
  GitBranch,
  Info,
  ListTree,
  Route,
  Search,
  Target,
  XCircle,
} from "lucide-react";

import KCNodeComponent, { KCNodeData } from "@/components/KCNode";
import CustomEdgeComponent from "@/components/CustomEdge";
import {
  assessmentRunApi,
  AssessmentRunDetail,
  AssessmentRunFlowStep,
  AssessmentRunKCGroup,
  AssessmentRunNodeExplanation,
  AssessmentRunNodeState,
  AssessmentRunSummary,
  AssessmentRunStep,
  graphApi,
  GraphData,
  KCNode,
} from "@/lib/api";

const nodeTypes = { kcNode: KCNodeComponent };
const edgeTypes = { prerequisite: CustomEdgeComponent };

const STATE_META: Record<AssessmentRunNodeState, { label: string; color: string; soft: string }> = {
  tested_mastered: { label: "TESTED PASS", color: "#3fb950", soft: "rgba(63,185,80,0.14)" },
  inferred_mastered: { label: "INFERRED PASS", color: "#7ee787", soft: "rgba(126,231,135,0.10)" },
  tested_gap: { label: "TESTED GAP", color: "#f85149", soft: "rgba(248,81,73,0.14)" },
  inferred_gap: { label: "INFERRED GAP", color: "#d29922", soft: "rgba(210,153,34,0.12)" },
  unknown: { label: "UNKNOWN", color: "#8b949e", soft: "rgba(139,148,158,0.10)" },
};

const DEFAULT_COUNTS: Record<AssessmentRunNodeState, number> = {
  tested_mastered: 0,
  tested_gap: 0,
  inferred_mastered: 0,
  inferred_gap: 0,
  unknown: 0,
};

function applyTransitions(
  run: AssessmentRunDetail | null,
  upToGroupIndex: number,
): Record<string, AssessmentRunNodeState> {
  if (!run) return {};
  const transitions = run.overlay?.state_transitions || [];
  const groups = run.overlay?.steps_by_kc || [];
  const finalStates = run.overlay?.node_states || {};
  if (!transitions.length) return finalStates;
  if (upToGroupIndex < 0) return {};

  const allowedKcs = new Set(groups.slice(0, upToGroupIndex + 1).map((group) => group.kc_id));
  const replayed: Record<string, AssessmentRunNodeState> = {};
  for (const transition of transitions) {
    if (!allowedKcs.has(transition.kc_id)) continue;
    for (const change of transition.changes || []) {
      if (change?.kc_id && change?.to) replayed[change.kc_id] = change.to;
    }
  }
  return replayed;
}

function toRunNodes({
  graph,
  nodeStates,
  explanations,
  testedOrder,
  currentKcId,
  visibleNodeIds,
  showAllGraph,
}: {
  graph: GraphData;
  nodeStates: Record<string, AssessmentRunNodeState>;
  explanations: Record<string, AssessmentRunNodeExplanation>;
  testedOrder: Record<string, number>;
  currentKcId: string | null;
  visibleNodeIds: Set<string>;
  showAllGraph: boolean;
}): Node[] {
  const incoming = new Set((graph.edges || []).map((edge) => edge.target));
  const outgoing = new Set((graph.edges || []).map((edge) => edge.source));
  const blockById = new Map((graph.blocks || []).map((block) => [block.id, block.name]));

  return (graph.nodes || []).map((node, index) => {
    const state = nodeStates[node.id] || "unknown";
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
      hidden: !visibleNodeIds.has(node.id),
      data: {
        id: node.id,
        code: node.code,
        name: node.name,
        grade: node.grade,
        subject: node.subject,
        chapter_info: node.chapter_info,
        block_id: node.block_id,
        blockName: node.block_id ? blockById.get(node.block_id) || null : null,
        isRoot: !incoming.has(node.id),
        isLeaf: !outgoing.has(node.id),
        runState: state,
        runStateLabel: explanations[node.id]?.state_label || STATE_META[state].label,
        testedOrder: testedOrder[node.id] ?? null,
        isCurrentStep: currentKcId === node.id,
        hideHandles: true,
        dimmed: showAllGraph && state === "unknown" && currentKcId !== node.id,
      } satisfies KCNodeData,
    };
  });
}

function toRunEdges({
  graph,
  runPathEdges,
  visibleNodeIds,
  showRunPath,
  selectedExplanation,
}: {
  graph: GraphData;
  runPathEdges: Array<{ source: string; target: string }>;
  visibleNodeIds: Set<string>;
  showRunPath: boolean;
  selectedExplanation?: AssessmentRunNodeExplanation | null;
}): Edge[] {
  const realEdges = (graph.edges || []).map((edge) => {
    const id = `${edge.source}->${edge.target}`;
    const hidden = !visibleNodeIds.has(edge.source) || !visibleNodeIds.has(edge.target);
    return {
      id,
      source: edge.source,
      target: edge.target,
      type: "prerequisite",
      hidden,
      selectable: false,
      data: {
        label: edge.label,
        edge_type: edge.edge_type ?? "prerequisite",
      },
      style: {
        stroke: "rgba(139,148,158,0.36)",
        strokeWidth: 1.4,
        opacity: 0.72,
      },
      markerEnd: {
        type: MarkerType.ArrowClosed,
        color: "rgba(139,148,158,0.48)",
        width: 14,
        height: 14,
      },
    } satisfies Edge;
  });

  const runEdges = showRunPath
    ? runPathEdges.map((edge, index) => ({
        id: `run-path-${index}-${edge.source}-${edge.target}`,
        source: edge.source,
        target: edge.target,
        type: "smoothstep",
        hidden: !visibleNodeIds.has(edge.source) || !visibleNodeIds.has(edge.target),
        selectable: false,
        animated: false,
        label: `${index + 1} -> ${index + 2}`,
        labelStyle: { fill: "#79c0ff", fontWeight: 800, fontSize: 11 },
        labelBgStyle: { fill: "rgba(13,17,23,0.92)" },
        style: {
          stroke: "rgba(88,166,255,0.95)",
          strokeWidth: 3,
          strokeDasharray: "8 5",
        },
        markerEnd: {
          type: MarkerType.ArrowClosed,
          color: "rgba(88,166,255,0.95)",
          width: 16,
          height: 16,
        },
      }) satisfies Edge)
    : [];

  const inferenceEdge = selectedExplanation?.inferred_from_kc_id
    ? [{
        id: `inference-source-${selectedExplanation.inferred_from_kc_id}-${selectedExplanation.kc_id}`,
        source: selectedExplanation.inferred_from_kc_id,
        target: selectedExplanation.kc_id,
        type: "smoothstep",
        hidden: !visibleNodeIds.has(selectedExplanation.inferred_from_kc_id) || !visibleNodeIds.has(selectedExplanation.kc_id),
        selectable: false,
        label: "inferred by",
        labelStyle: { fill: STATE_META[selectedExplanation.state].color, fontWeight: 800, fontSize: 11 },
        labelBgStyle: { fill: "rgba(13,17,23,0.92)" },
        style: {
          stroke: STATE_META[selectedExplanation.state].color,
          strokeWidth: 3,
          strokeDasharray: "4 4",
        },
        markerEnd: {
          type: MarkerType.ArrowClosed,
          color: STATE_META[selectedExplanation.state].color,
          width: 16,
          height: 16,
        },
      } satisfies Edge]
    : [];

  return [...realEdges, ...runEdges, ...inferenceEdge];
}

function RunViewerPage() {
  const [graph, setGraph] = useState<GraphData | null>(null);
  const [runs, setRuns] = useState<AssessmentRunSummary[]>([]);
  const [selectedRunId, setSelectedRunId] = useState<string | null>(null);
  const [runDetail, setRunDetail] = useState<AssessmentRunDetail | null>(null);
  const [selectedGroupIndex, setSelectedGroupIndex] = useState<number>(-1);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [showAllGraph, setShowAllGraph] = useState(false);
  const [showInferred, setShowInferred] = useState(true);
  const [showUnknown, setShowUnknown] = useState(false);
  const [showRunPath, setShowRunPath] = useState(true);
  const [loading, setLoading] = useState(true);
  const [detailLoading, setDetailLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const reactFlow = useReactFlow();

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
        if (!cancelled) setError(err instanceof Error ? err.message : "Failed to load assessment runs");
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
    const runId = selectedRunId;
    let cancelled = false;
    async function loadDetail() {
      try {
        setDetailLoading(true);
        const detail = await assessmentRunApi.getRun(runId);
        if (cancelled) return;
        setRunDetail(detail);
        const flowCount = detail.overlay?.flow_steps?.length || detail.overlay?.steps_by_kc?.length || 0;
        const firstKcId = detail.overlay?.flow_steps?.[0]?.kc_id || detail.overlay?.steps_by_kc?.[0]?.kc_id || null;
        setSelectedGroupIndex(flowCount > 0 ? 0 : -1);
        setSelectedNodeId(firstKcId);
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : "Failed to load run detail");
      } finally {
        if (!cancelled) setDetailLoading(false);
      }
    }
    loadDetail();
    return () => {
      cancelled = true;
    };
  }, [selectedRunId]);

  const graphNodeById = useMemo(() => {
    return new Map((graph?.nodes || []).map((node) => [node.id, node]));
  }, [graph]);

  const groups = useMemo(() => runDetail?.overlay?.steps_by_kc || [], [runDetail]);
  const flowSteps = useMemo(() => {
    if (runDetail?.overlay?.flow_steps?.length) return runDetail.overlay.flow_steps;
    return groups.map((group, index) => ({
      order: index + 1,
      kc_id: group.kc_id,
      kc_code: group.kc_code,
      kc_name: group.kc_name,
      n_items: group.n_items,
      n_correct: group.n_correct,
      first_step: group.first_step,
      last_step: group.last_step,
      persona_knows_kc: group.persona_knows_kc,
    }));
  }, [groups, runDetail]);

  const selectedGroup = selectedGroupIndex >= 0 ? groups[selectedGroupIndex] : null;
  const selectedKcId = selectedNodeId || selectedGroup?.kc_id || null;
  const explanations = runDetail?.overlay?.node_explanations || {};
  const selectedExplanation = selectedKcId ? explanations[selectedKcId] : null;
  const selectedGraphNode = selectedKcId ? graphNodeById.get(selectedKcId) : null;
  const selectedGroupForNode = selectedKcId ? groups.find((group) => group.kc_id === selectedKcId) || null : null;
  const selectedFlowStep = selectedKcId ? flowSteps.find((step) => step.kc_id === selectedKcId) || null : null;

  const currentNodeStates = useMemo(() => {
    if (!runDetail) return {};
    return applyTransitions(runDetail, selectedGroupIndex);
  }, [runDetail, selectedGroupIndex]);

  const stateCounts = useMemo(() => {
    const counts = { ...DEFAULT_COUNTS };
    for (const state of Object.values(currentNodeStates)) counts[state] = (counts[state] || 0) + 1;
    return counts;
  }, [currentNodeStates]);

  const visibleNodeIds = useMemo(() => {
    const ids = new Set<string>();
    const testedOrder = runDetail?.overlay?.tested_order || {};
    const selectedSource = selectedExplanation?.inferred_from_kc_id;
    for (const node of graph?.nodes || []) {
      const state = currentNodeStates[node.id] || "unknown";
      const isTested = typeof testedOrder[node.id] === "number";
      const isSelected = node.id === selectedKcId || node.id === selectedSource;
      if (isSelected || isTested) {
        ids.add(node.id);
        continue;
      }
      if (state === "unknown") {
        if (showAllGraph || showUnknown) ids.add(node.id);
        continue;
      }
      if (state === "inferred_gap" || state === "inferred_mastered") {
        if (showInferred || showAllGraph) ids.add(node.id);
        continue;
      }
      ids.add(node.id);
    }
    return ids;
  }, [currentNodeStates, graph, runDetail, selectedExplanation, selectedKcId, showAllGraph, showInferred, showUnknown]);

  const flowNodes = useMemo(() => {
    if (!graph) return [];
    return toRunNodes({
      graph,
      nodeStates: currentNodeStates,
      explanations,
      testedOrder: runDetail?.overlay?.tested_order || {},
      currentKcId: selectedKcId,
      visibleNodeIds,
      showAllGraph,
    });
  }, [currentNodeStates, explanations, graph, runDetail, selectedKcId, showAllGraph, visibleNodeIds]);

  const flowEdges = useMemo(() => {
    if (!graph) return [];
    return toRunEdges({
      graph,
      runPathEdges: runDetail?.overlay?.run_path_edges || runDetail?.overlay?.edge_path || [],
      visibleNodeIds,
      showRunPath,
      selectedExplanation,
    });
  }, [graph, runDetail, selectedExplanation, showRunPath, visibleNodeIds]);

  useEffect(() => {
    if (!selectedKcId) return;
    const timer = window.setTimeout(() => {
      try {
        reactFlow.fitView({ nodes: [{ id: selectedKcId }], padding: 1.4, duration: 450, maxZoom: 1.1 });
      } catch {
        // React Flow may not be initialized on the first paint.
      }
    }, 80);
    return () => window.clearTimeout(timer);
  }, [reactFlow, selectedKcId]);

  const selectKc = (kcId: string, order?: number) => {
    setSelectedNodeId(kcId);
    if (typeof order === "number") setSelectedGroupIndex(order - 1);
  };

  const jumpToFinal = () => {
    const lastIndex = Math.max(flowSteps.length - 1, 0);
    setSelectedGroupIndex(lastIndex);
    setSelectedNodeId(flowSteps[lastIndex]?.kc_id || null);
  };

  return (
    <div style={{ height: "100vh", display: "grid", gridTemplateRows: "auto 1fr", background: "#0d1117", color: "#e6edf3" }}>
      <header style={{ borderBottom: "1px solid rgba(110,118,129,0.25)", background: "rgba(13,17,23,0.98)" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, padding: "12px 18px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <Link href="/" style={buttonLinkStyle()}>
              <ArrowLeft size={14} />
              Knowledge Graph
            </Link>
            <div>
              <div style={{ fontSize: 15, fontWeight: 800, display: "flex", alignItems: "center", gap: 8 }}>
                <Route size={16} color="#79c0ff" />
                Assessment Run Review
              </div>
              <div style={{ fontSize: 12, color: "#8b949e" }}>
                Flow chart, graph context, and node-level evidence for academic review
              </div>
            </div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <StateLegend />
            <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12, color: "#8b949e" }}>
              <FileJson size={14} />
              {runs.length} stored runs
            </div>
          </div>
        </div>
      </header>

      <div style={{ display: "grid", gridTemplateColumns: "360px 1fr 430px", minHeight: 0 }}>
        <aside style={sidePanelStyle("right")}>
          <RunSidebar
            runs={runs}
            selectedRunId={selectedRunId}
            loading={loading}
            error={error}
            flowSteps={flowSteps}
            selectedKcId={selectedKcId}
            onSelectRun={setSelectedRunId}
            onSelectFlowStep={(step) => selectKc(step.kc_id, step.order)}
          />
        </aside>

        <main style={{ position: "relative", minHeight: 0 }}>
          <ReactFlow
            nodes={flowNodes}
            edges={flowEdges}
            nodeTypes={nodeTypes}
            edgeTypes={edgeTypes}
            fitView
            fitViewOptions={{ padding: 0.24 }}
            minZoom={0.18}
            maxZoom={2}
            nodesDraggable={false}
            nodesConnectable={false}
            edgesFocusable={false}
            elementsSelectable={true}
            onNodeClick={(_, node) => {
              const order = runDetail?.overlay?.tested_order?.[node.id];
              selectKc(node.id, order);
            }}
          >
            <Background variant={BackgroundVariant.Dots} gap={24} size={1} color="rgba(110,118,129,0.22)" />
            <Controls position="bottom-left" />
            <MiniMap
              position="bottom-right"
              nodeColor={(node) => {
                const data = node.data as unknown as KCNodeData;
                return STATE_META[data.runState || "unknown"].color;
              }}
              maskColor="rgba(13,17,23,0.72)"
            />
            <Panel position="top-left">
              <GraphControls
                stateCounts={stateCounts}
                showAllGraph={showAllGraph}
                showInferred={showInferred}
                showUnknown={showUnknown}
                showRunPath={showRunPath}
                onToggleAllGraph={() => setShowAllGraph((value) => !value)}
                onToggleInferred={() => setShowInferred((value) => !value)}
                onToggleUnknown={() => setShowUnknown((value) => !value)}
                onToggleRunPath={() => setShowRunPath((value) => !value)}
              />
            </Panel>
            <Panel position="bottom-center">
              <Timeline
                selectedGroupIndex={selectedGroupIndex}
                flowSteps={flowSteps}
                onChange={(index) => {
                  setSelectedGroupIndex(index);
                  setSelectedNodeId(flowSteps[index]?.kc_id || null);
                }}
                onFinal={jumpToFinal}
              />
            </Panel>
          </ReactFlow>
        </main>

        <aside style={sidePanelStyle("left")}>
          <NodeInspector
            detailLoading={detailLoading}
            graphNode={selectedGraphNode}
            explanation={selectedExplanation || null}
            group={selectedGroupForNode}
            flowStep={selectedFlowStep}
            sourceNode={selectedExplanation?.inferred_from_kc_id ? graphNodeById.get(selectedExplanation.inferred_from_kc_id) : null}
            onSelectSource={(kcId) => selectKc(kcId, runDetail?.overlay?.tested_order?.[kcId])}
          />
        </aside>
      </div>
    </div>
  );
}

function RunSidebar({
  runs,
  selectedRunId,
  loading,
  error,
  flowSteps,
  selectedKcId,
  onSelectRun,
  onSelectFlowStep,
}: {
  runs: AssessmentRunSummary[];
  selectedRunId: string | null;
  loading: boolean;
  error: string | null;
  flowSteps: AssessmentRunFlowStep[];
  selectedKcId: string | null;
  onSelectRun: (runId: string) => void;
  onSelectFlowStep: (step: AssessmentRunFlowStep) => void;
}) {
  return (
    <div style={{ padding: 14, display: "flex", flexDirection: "column", gap: 14 }}>
      <SectionTitle icon={<FileJson size={14} color="#79c0ff" />} label="Runs" />
      {loading && <MutedText>Loading runs...</MutedText>}
      {error && <div style={{ fontSize: 13, color: "#f85149" }}>{error}</div>}
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {runs.map((run) => {
          const active = run.run_id === selectedRunId;
          return (
            <button
              key={run.run_id}
              onClick={() => onSelectRun(run.run_id)}
              style={{
                textAlign: "left",
                borderRadius: 8,
                border: active ? "1px solid rgba(88,166,255,0.55)" : "1px solid rgba(110,118,129,0.2)",
                background: active ? "rgba(56,139,253,0.12)" : "rgba(255,255,255,0.025)",
                padding: 10,
                display: "flex",
                flexDirection: "column",
                gap: 7,
                cursor: "pointer",
                color: "#e6edf3",
              }}
            >
              <div style={{ fontSize: 13, fontWeight: 800 }}>{run.title}</div>
              <div style={{ fontSize: 11, color: "#8b949e" }}>{run.source_file}</div>
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                <Chip color="#79c0ff">{run.status || "unknown"}</Chip>
                <Chip color="#3fb950">{run.steps} items</Chip>
                <Chip color="#d29922">{run.tested_kcs} KCs</Chip>
                {run.pending_draft_steps > 0 && <Chip color="#f0883e">{run.pending_draft_steps} draft</Chip>}
              </div>
            </button>
          );
        })}
      </div>

      <SectionTitle icon={<ListTree size={14} color="#79c0ff" />} label="Run Flow" />
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {flowSteps.map((step, index) => {
          const active = step.kc_id === selectedKcId;
          const state = outcomeState(step);
          const meta = STATE_META[state];
          return (
            <button
              key={`${step.kc_id}-${step.order}`}
              onClick={() => onSelectFlowStep(step)}
              style={{
                position: "relative",
                textAlign: "left",
                borderRadius: 8,
                border: active ? `1px solid ${meta.color}` : "1px solid rgba(110,118,129,0.18)",
                background: active ? meta.soft : "rgba(255,255,255,0.025)",
                padding: "10px 10px 10px 42px",
                color: "#e6edf3",
                cursor: "pointer",
              }}
            >
              {index < flowSteps.length - 1 && (
                <div style={{ position: "absolute", left: 21, top: 34, bottom: -12, width: 2, background: "rgba(88,166,255,0.45)" }} />
              )}
              <div style={{
                position: "absolute",
                left: 10,
                top: 10,
                width: 24,
                height: 24,
                borderRadius: 999,
                display: "grid",
                placeItems: "center",
                fontSize: 11,
                fontWeight: 900,
                color: "#0d1117",
                background: meta.color,
              }}>
                {step.order}
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 8, alignItems: "flex-start" }}>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: 12, fontWeight: 800, color: "#f0f6fc", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {step.kc_code || step.kc_id}
                  </div>
                  <div style={{ fontSize: 12, color: "#c9d1d9", lineHeight: 1.35 }}>
                    {step.kc_name || "Untitled KC"}
                  </div>
                </div>
                <Chip color={meta.color}>{meta.label}</Chip>
              </div>
              <div style={{ marginTop: 8, display: "flex", gap: 6, flexWrap: "wrap" }}>
                <Chip color="#79c0ff">{step.n_correct}/{step.n_items} correct</Chip>
                {step.frontier_reason && <Chip color="#8b949e">{step.frontier_reason}</Chip>}
                {typeof step.closure_gain === "number" && <Chip color="#d29922">gain {step.closure_gain}</Chip>}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function GraphControls({
  stateCounts,
  showAllGraph,
  showInferred,
  showUnknown,
  showRunPath,
  onToggleAllGraph,
  onToggleInferred,
  onToggleUnknown,
  onToggleRunPath,
}: {
  stateCounts: Record<AssessmentRunNodeState, number>;
  showAllGraph: boolean;
  showInferred: boolean;
  showUnknown: boolean;
  showRunPath: boolean;
  onToggleAllGraph: () => void;
  onToggleInferred: () => void;
  onToggleUnknown: () => void;
  onToggleRunPath: () => void;
}) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10, padding: 12, borderRadius: 12, border: "1px solid rgba(110,118,129,0.22)", background: "rgba(17,24,39,0.9)", minWidth: 280 }}>
      <SectionTitle icon={<Activity size={14} color="#79c0ff" />} label="Graph State" />
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 7 }}>
        {(Object.keys(STATE_META) as AssessmentRunNodeState[]).map((state) => (
          <div key={state} style={{ display: "flex", justifyContent: "space-between", gap: 8, fontSize: 11 }}>
            <span style={{ color: STATE_META[state].color, fontWeight: 800 }}>{STATE_META[state].label}</span>
            <span style={{ color: "#e6edf3", fontWeight: 800 }}>{stateCounts[state] || 0}</span>
          </div>
        ))}
      </div>
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
        <ToggleChip active={showAllGraph} onClick={onToggleAllGraph}>All graph</ToggleChip>
        <ToggleChip active={showInferred} onClick={onToggleInferred}>Inferred</ToggleChip>
        <ToggleChip active={showUnknown} onClick={onToggleUnknown}>Unknown</ToggleChip>
        <ToggleChip active={showRunPath} onClick={onToggleRunPath}>Run path</ToggleChip>
      </div>
    </div>
  );
}

function Timeline({
  selectedGroupIndex,
  flowSteps,
  onChange,
  onFinal,
}: {
  selectedGroupIndex: number;
  flowSteps: AssessmentRunFlowStep[];
  onChange: (index: number) => void;
  onFinal: () => void;
}) {
  const selected = selectedGroupIndex >= 0 ? flowSteps[selectedGroupIndex] : null;
  return (
    <div style={{ minWidth: 560, padding: "10px 14px", borderRadius: 12, border: "1px solid rgba(110,118,129,0.24)", background: "rgba(17,24,39,0.92)", display: "flex", flexDirection: "column", gap: 10 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
        <SectionTitle icon={<Route size={13} color="#79c0ff" />} label="Replay" />
        <button onClick={onFinal} style={smallButtonStyle()}>
          Final state
        </button>
      </div>
      <input
        type="range"
        min={0}
        max={Math.max(flowSteps.length - 1, 0)}
        value={Math.max(selectedGroupIndex, 0)}
        disabled={!flowSteps.length}
        onChange={(event) => onChange(Number(event.target.value))}
      />
      <div style={{ fontSize: 12, color: "#c9d1d9" }}>
        {selected ? (
          <>
            <strong>#{selected.order}</strong> {selected.kc_code} - {selected.kc_name}
          </>
        ) : "No flow steps"}
      </div>
    </div>
  );
}

function NodeInspector({
  detailLoading,
  graphNode,
  explanation,
  group,
  flowStep,
  sourceNode,
  onSelectSource,
}: {
  detailLoading: boolean;
  graphNode?: KCNode | null;
  explanation: AssessmentRunNodeExplanation | null;
  group?: AssessmentRunKCGroup | null;
  flowStep?: AssessmentRunFlowStep | null;
  sourceNode?: KCNode | null;
  onSelectSource: (kcId: string) => void;
}) {
  const state = explanation?.state || "unknown";
  const meta = STATE_META[state];
  const steps = group?.steps || [];

  return (
    <div style={{ padding: 16, display: "flex", flexDirection: "column", gap: 14 }}>
      <SectionTitle icon={<Search size={14} color="#79c0ff" />} label="Node Inspector" />
      {detailLoading && <MutedText>Loading run detail...</MutedText>}
      {!graphNode && !explanation ? (
        <MutedText>Select a flow step or graph node to inspect its state, evidence, and inference reason.</MutedText>
      ) : (
        <>
          <div style={cardStyle(meta.color)}>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "flex-start" }}>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: 14, fontWeight: 900, color: "#f0f6fc", lineHeight: 1.3 }}>
                  {graphNode?.code || group?.kc_code || explanation?.kc_id}
                </div>
                <div style={{ marginTop: 6, fontSize: 13, color: "#c9d1d9", lineHeight: 1.4 }}>
                  {graphNode?.name || group?.kc_name || "Untitled KC"}
                </div>
              </div>
              <Chip color={meta.color}>{explanation?.state_label || meta.label}</Chip>
            </div>
            <div style={{ marginTop: 10, display: "flex", gap: 6, flexWrap: "wrap" }}>
              {typeof explanation?.tested_order === "number" && <Chip color="#79c0ff">tested #{explanation.tested_order}</Chip>}
              {graphNode?.grade && <Chip color="#8b949e">Lớp {graphNode.grade}</Chip>}
              {graphNode?.chapter_info && <Chip color="#8b949e">{graphNode.chapter_info}</Chip>}
              {flowStep?.frontier_reason && <Chip color="#d29922">{flowStep.frontier_reason}</Chip>}
            </div>
          </div>

          <div style={cardStyle(meta.color)}>
            <SectionTitle icon={<Info size={14} color={meta.color} />} label="Why This State?" />
            <div style={{ marginTop: 8, fontSize: 13, color: "#e6edf3", lineHeight: 1.55 }}>
              {explanation?.reason_text || "Node này chưa có đủ evidence trong run."}
            </div>
            {explanation?.reason_code && (
              <div style={{ marginTop: 8, fontSize: 11, color: "#8b949e", fontFamily: "monospace" }}>
                reason: {explanation.reason_code}
              </div>
            )}
            {sourceNode && explanation?.inferred_from_kc_id && (
              <button onClick={() => onSelectSource(explanation.inferred_from_kc_id!)} style={{ ...smallButtonStyle(), marginTop: 10 }}>
                Focus source: {sourceNode.code}
              </button>
            )}
          </div>

          {flowStep && (
            <div style={cardStyle("#79c0ff")}>
              <SectionTitle icon={<Target size={14} color="#79c0ff" />} label="Frontier Decision" />
              <MetricGrid
                rows={[
                  ["Reason", flowStep.frontier_reason || "n/a"],
                  ["Closure gain", valueOrDash(flowStep.closure_gain)],
                  ["Unknown ancestors", valueOrDash(flowStep.unknown_ancestors)],
                  ["Unknown descendants", valueOrDash(flowStep.unknown_descendants)],
                  ["Items", valueOrDash(flowStep.item_count)],
                  ["Unseen", valueOrDash(flowStep.unseen_item_count)],
                  ["Anchors", valueOrDash(flowStep.anchor_count)],
                ]}
              />
            </div>
          )}

          <div style={cardStyle("#8b949e")}>
            <SectionTitle icon={<BookOpen size={14} color="#79c0ff" />} label="Evidence" />
            {steps.length ? (
              <div style={{ marginTop: 10, display: "flex", flexDirection: "column", gap: 12 }}>
                {steps.map((step) => <ItemEvidence key={`${step.kc_id}-${step.step}`} step={step} />)}
              </div>
            ) : (
              <MutedText>
                Node này không được test trực tiếp trong run. State hiện tại đến từ graph inference.
              </MutedText>
            )}
          </div>
        </>
      )}
    </div>
  );
}

function ItemEvidence({ step }: { step: AssessmentRunStep }) {
  const correct = Boolean(step.agent_correct || step.correct);
  return (
    <div style={{ border: "1px solid rgba(110,118,129,0.18)", borderRadius: 8, padding: 12, background: "rgba(255,255,255,0.025)" }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 8, alignItems: "flex-start" }}>
        <div style={{ fontSize: 13, fontWeight: 900, color: "#f0f6fc" }}>Item step {step.step}</div>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap", justifyContent: "flex-end" }}>
          <Chip color={correct ? "#3fb950" : "#f85149"}>{correct ? "correct" : "wrong"}</Chip>
          {step.source && <Chip color={step.source === "pending_draft" ? "#f0883e" : "#8b949e"}>{step.source}</Chip>}
          {step.is_diagnostic_anchor && <Chip color="#79c0ff">anchor</Chip>}
          {step.difficulty_label && <Chip color="#c9d1d9">{step.difficulty_label}</Chip>}
          {typeof step.irt_b === "number" && <Chip color="#8b949e">b={step.irt_b}</Chip>}
        </div>
      </div>
      {step.question && <div style={{ marginTop: 10, fontSize: 13, lineHeight: 1.55, color: "#e6edf3" }}>{step.question}</div>}
      {(step.answers || []).length > 0 && (
        <div style={{ marginTop: 10, display: "flex", flexDirection: "column", gap: 5 }}>
          {(step.answers || []).map((answer, index) => (
            <div key={`${step.step}-${index}`} style={{ fontSize: 12, color: answer.is_correct ? "#7ee787" : "#9da7b3", lineHeight: 1.45 }}>
              <strong>{answer.label}.</strong> {answer.text}
            </div>
          ))}
        </div>
      )}
      <div style={{ marginTop: 10, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, fontSize: 12, color: "#c9d1d9" }}>
        <div><strong>Correct:</strong> {step.correct_answer || "?"}</div>
        <div><strong>Agent:</strong> {step.agent_answer || "?"}</div>
      </div>
      {(step.agent_thinking || step.thinking) && (
        <div style={{ marginTop: 10, fontSize: 12, color: "#9da7b3", lineHeight: 1.55 }}>
          <strong style={{ color: "#c9d1d9" }}>Reasoning:</strong> {step.agent_thinking || step.thinking}
        </div>
      )}
    </div>
  );
}

function StateLegend() {
  return (
    <div style={{ display: "flex", gap: 6, flexWrap: "wrap", justifyContent: "flex-end" }}>
      {(Object.keys(STATE_META) as AssessmentRunNodeState[]).filter((state) => state !== "unknown").map((state) => (
        <Chip key={state} color={STATE_META[state].color}>{STATE_META[state].label}</Chip>
      ))}
    </div>
  );
}

function SectionTitle({ icon, label }: { icon: React.ReactNode; label: string }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12, fontWeight: 900, color: "#f0f6fc", textTransform: "uppercase", letterSpacing: "0.04em" }}>
      {icon}
      {label}
    </div>
  );
}

function Chip({ color, children }: { color: string; children: React.ReactNode }) {
  return <span style={chipStyle(color)}>{children}</span>;
}

function ToggleChip({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      style={{
        border: active ? "1px solid rgba(88,166,255,0.55)" : "1px solid rgba(110,118,129,0.28)",
        background: active ? "rgba(88,166,255,0.14)" : "rgba(255,255,255,0.025)",
        color: active ? "#79c0ff" : "#8b949e",
        borderRadius: 999,
        padding: "4px 9px",
        fontSize: 11,
        fontWeight: 800,
        cursor: "pointer",
      }}
    >
      {children}
    </button>
  );
}

function MutedText({ children }: { children: React.ReactNode }) {
  return <div style={{ fontSize: 13, color: "#8b949e", lineHeight: 1.5 }}>{children}</div>;
}

function MetricGrid({ rows }: { rows: Array<[string, string | number]> }) {
  return (
    <div style={{ marginTop: 10, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
      {rows.map(([label, value]) => (
        <div key={label} style={{ display: "flex", flexDirection: "column", gap: 3 }}>
          <span style={{ fontSize: 11, color: "#8b949e" }}>{label}</span>
          <span style={{ fontSize: 12, color: "#e6edf3", fontWeight: 800 }}>{value}</span>
        </div>
      ))}
    </div>
  );
}

function outcomeState(step: AssessmentRunFlowStep): AssessmentRunNodeState {
  const outcome = step.outcome || step.decision;
  if (outcome === "pass" || outcome === "mastered") return "tested_mastered";
  if (outcome === "fail" || outcome === "fundamental_gap" || outcome === "gap") return "tested_gap";
  if (step.n_items > 0 && step.n_correct === step.n_items) return "tested_mastered";
  if (step.n_items > 0 && step.n_correct === 0) return "tested_gap";
  return "unknown";
}

function valueOrDash(value: unknown) {
  return typeof value === "number" || typeof value === "string" ? value : "-";
}

function sidePanelStyle(borderSide: "left" | "right") {
  return {
    borderLeft: borderSide === "left" ? "1px solid rgba(110,118,129,0.2)" : undefined,
    borderRight: borderSide === "right" ? "1px solid rgba(110,118,129,0.2)" : undefined,
    background: "#11161d",
    minHeight: 0,
    overflowY: "auto",
  } as const;
}

function buttonLinkStyle() {
  return {
    display: "inline-flex",
    alignItems: "center",
    gap: 6,
    padding: "7px 12px",
    borderRadius: 8,
    color: "#c9d1d9",
    textDecoration: "none",
    border: "1px solid rgba(110,118,129,0.28)",
    background: "rgba(255,255,255,0.03)",
    fontSize: 13,
    fontWeight: 700,
  } as const;
}

function smallButtonStyle() {
  return {
    border: "1px solid rgba(88,166,255,0.35)",
    background: "rgba(88,166,255,0.12)",
    color: "#79c0ff",
    borderRadius: 8,
    padding: "5px 9px",
    fontSize: 12,
    fontWeight: 800,
    cursor: "pointer",
  } as const;
}

function cardStyle(color: string) {
  return {
    border: `1px solid ${color}33`,
    borderRadius: 8,
    padding: 14,
    background: "rgba(255,255,255,0.03)",
  } as const;
}

function chipStyle(color: string) {
  return {
    display: "inline-flex",
    alignItems: "center",
    gap: 4,
    padding: "2px 7px",
    borderRadius: 999,
    fontSize: 11,
    fontWeight: 800,
    color,
    border: `1px solid ${color}55`,
    background: `${color}14`,
    whiteSpace: "nowrap",
  } as const;
}

export default function AssessmentRunsPage() {
  return (
    <ReactFlowProvider>
      <RunViewerPage />
    </ReactFlowProvider>
  );
}
