"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  ReactFlow,
  ReactFlowProvider,
  Background,
  BackgroundVariant,
  Controls,
  MiniMap,
  addEdge,
  applyNodeChanges,
  applyEdgeChanges,
  ConnectionMode,
  type Node,
  type Edge,
  type Connection,
  type NodeChange,
  type EdgeChange,
  type OnConnect,
  MarkerType,
  Panel,
  useReactFlow,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";

import {
  Plus,
  RefreshCw,
  AlertTriangle,
  GitBranch,
  Info,
} from "lucide-react";

import { graphApi, GraphHealth } from "@/lib/api";
import { KCNodeData } from "@/components/KCNode";
import KCNodeComponent from "@/components/KCNode";
import CreateKCPanel from "@/components/CreateKCPanel";
import HealthPanel from "@/components/HealthPanel";
import KCDetailPanel from "@/components/KCDetailPanel";

// Register custom node type
const nodeTypes = { kcNode: KCNodeComponent };

// ── Helpers ────────────────────────────────────────────────────────────────

function toFlowNodes(
  apiNodes: { id: string; code: string; name: string; grade: number; subject: string }[],
  health: GraphHealth | null
): Node[] {
  const rootSet = new Set(health?.root_kcs ?? []);
  const leafSet = new Set(health?.leaf_kcs ?? []);
  const lowSet  = new Set(health?.low_item_kcs ?? []);
  const itemCounts = health?.item_counts ?? {};

  return apiNodes.map((n, i) => ({
    id: n.id,
    type: "kcNode",
    position: { x: 260 * (i % 5), y: 190 * Math.floor(i / 5) },
    dragHandle: ".node-drag-handle",   // ← FIX: only drag via the header handle
    data: {
      id: n.id,
      code: n.code,
      name: n.name,
      grade: n.grade,
      subject: n.subject,
      isRoot: rootSet.has(n.id),
      isLeaf: leafSet.has(n.id),
      isLowItems: lowSet.has(n.id),
      itemCounts: itemCounts[n.id] ?? null,
    } satisfies KCNodeData,
  }));
}

function toFlowEdges(
  apiEdges: { source: string; target: string }[],
  cycleEdges: Set<string>
): Edge[] {
  return apiEdges.map((e) => {
    const id = `${e.source}->${e.target}`;
    const isCycle = cycleEdges.has(id);
    return {
      id,
      source: e.source,
      target: e.target,
      type: "smoothstep",
      animated: false,
      style: {
        stroke: isCycle ? "var(--accent-red)" : "var(--edge-default)",
        strokeWidth: isCycle ? 3 : 2,
        strokeDasharray: isCycle ? "6 3" : undefined,
      },
      markerEnd: {
        type: MarkerType.ArrowClosed,
        color: isCycle ? "var(--accent-red)" : "var(--edge-default)",
        width: 14,
        height: 14,
      },
    };
  });
}

// ── Main Component ─────────────────────────────────────────────────────────

function GraphBuilderInner() {
  const [nodes, setNodes] = useState<Node[]>([]);
  const [edges, setEdges] = useState<Edge[]>([]);
  const [health, setHealth] = useState<GraphHealth | null>(null);
  const [healthLoading, setHealthLoading] = useState(false);

  const [showCreatePanel, setShowCreatePanel] = useState(false);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [toast, setToast] = useState<{ msg: string; type: "ok" | "err" } | null>(null);
  const [cycleEdges] = useState<Set<string>>(new Set());

  const toastTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const { fitView } = useReactFlow();

  // ── Toast helper ─────────────────────────────────────────────────────
  const showToast = (msg: string, type: "ok" | "err" = "ok") => {
    setToast({ msg, type });
    clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 3500);
  };

  // ── Load graph ────────────────────────────────────────────────────────
  const loadGraph = useCallback(async () => {
    try {
      setHealthLoading(true);
      const [graphData, healthData] = await Promise.all([
        graphApi.getGraph(),
        graphApi.getHealth(),
      ]);
      setHealth(healthData);
      setNodes(toFlowNodes(graphData.nodes, healthData));
      setEdges(toFlowEdges(graphData.edges, cycleEdges));
    } catch {
      showToast("Không kết nối được với backend", "err");
    } finally {
      setHealthLoading(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => { loadGraph(); }, [loadGraph]);

  // ── Node/Edge change handlers ─────────────────────────────────────────
  const onNodesChange = useCallback(
    (changes: NodeChange[]) => setNodes((nds) => applyNodeChanges(changes, nds)),
    []
  );
  const onEdgesChange = useCallback(
    (changes: EdgeChange[]) => setEdges((eds) => applyEdgeChanges(changes, eds)),
    []
  );

  // ── Connect handler — adds prerequisite edge ──────────────────────────
  const onConnect: OnConnect = useCallback(
    async (connection: Connection) => {
      if (!connection.source || !connection.target) return;
      if (connection.source === connection.target) return;

      // source = prereq_id (drag FROM = prerequisite)
      // target = kc_id    (drag TO   = successor that requires it)
      const prereq_id = connection.source;
      const kc_id     = connection.target;

      // Optimistically show edge while API call runs
      const tempEdge: Edge = {
        id: `${prereq_id}->${kc_id}`,
        source: prereq_id,
        target: kc_id,
        type: "smoothstep",
        animated: true,
        style: { stroke: "var(--accent-blue)", strokeWidth: 2 },
        markerEnd: { type: MarkerType.ArrowClosed, color: "var(--accent-blue)", width: 14, height: 14 },
      };
      setEdges((eds) => addEdge(tempEdge, eds));

      try {
        const result = await graphApi.addPrerequisite(kc_id, prereq_id);
        if (!result.ok) {
          // Remove temp edge and show error
          setEdges((eds) => eds.filter(e => e.id !== tempEdge.id));
          showToast(`⚠ Tạo vòng lặp! ${result.detail ?? ""}`, "err");
          return;
        }
        // Solidify the edge (stop animation, use default style)
        setEdges((eds) =>
          eds.map(e =>
            e.id === tempEdge.id
              ? {
                  ...e,
                  animated: false,
                  style: { stroke: "var(--edge-default)", strokeWidth: 2 },
                  markerEnd: { type: MarkerType.ArrowClosed, color: "var(--edge-default)", width: 14, height: 14 },
                }
              : e
          )
        );
        showToast(`✓ Đã thêm prerequisite`);
        graphApi.getHealth().then(setHealth);
      } catch {
        setEdges((eds) => eds.filter(e => e.id !== tempEdge.id));
        showToast("Lỗi thêm prerequisite", "err");
      }
    },
    []
  );

  // ── Edge delete handler ───────────────────────────────────────────────
  const onEdgeDelete = useCallback(async (edgesToDelete: Edge[]) => {
    for (const edge of edgesToDelete) {
      try {
        await graphApi.removePrerequisite(edge.target, edge.source);
        showToast("Đã xoá connection");
        graphApi.getHealth().then(setHealth);
      } catch {
        showToast("Lỗi xoá connection", "err");
      }
    }
  }, []);

  // ── KC created callback ───────────────────────────────────────────────
  const handleKCCreated = useCallback(
    (kc: { id: string; code: string; name: string; grade: number }) => {
      const newNode: Node = {
        id: kc.id,
        type: "kcNode",
        position: { x: 100 + Math.random() * 400, y: 100 + Math.random() * 300 },
        dragHandle: ".node-drag-handle",
        data: {
          id: kc.id,
          code: kc.code,
          name: kc.name,
          grade: kc.grade,
          subject: "math",
          isRoot: true,
          isLeaf: true,
          isLowItems: true,
          itemCounts: undefined,
        } satisfies KCNodeData,
      };
      setNodes((nds) => [...nds, newNode]);
      showToast(`✓ Đã tạo KC "${kc.name}"`);
      graphApi.getHealth().then(setHealth);
    },
    []
  );

  // ── KC updated callback (from panel) ─────────────────────────────────
  const handleKCUpdated = useCallback(
    (id: string, data: Partial<KCNodeData>) => {
      setNodes((nds) =>
        nds.map((n) =>
          n.id === id ? { ...n, data: { ...n.data, ...data } } : n
        )
      );
    },
    []
  );

  // ── KC deleted callback (from panel) ─────────────────────────────────
  const handleKCDeleted = useCallback(
    (id: string) => {
      setNodes((nds) => nds.filter((n) => n.id !== id));
      setEdges((eds) => eds.filter((e) => e.source !== id && e.target !== id));
      setSelectedNodeId(null);
      showToast("✓ Đã xoá KC");
      graphApi.getHealth().then(setHealth);
    },
    []
  );

  // ── Node click ────────────────────────────────────────────────────────
  const onNodeClick = useCallback((_: React.MouseEvent, node: Node) => {
    setSelectedNodeId(node.id);
    setShowCreatePanel(false); // Close create panel if open
  }, []);

  return (
    <div style={{ width: "100vw", height: "100vh", display: "flex", flexDirection: "column" }}>
      {/* ── Top navbar ──────────────────────────────────────────────── */}
      <div
        className="glass"
        style={{
          height: 56,
          display: "flex",
          alignItems: "center",
          padding: "0 20px",
          gap: 12,
          borderBottom: "1px solid var(--border)",
          borderRadius: 0,
          flexShrink: 0,
          zIndex: 10,
        }}
      >
        {/* Logo */}
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginRight: 8 }}>
          <div
            style={{
              width: 28,
              height: 28,
              background: "linear-gradient(135deg, #388bfd, #a371f7)",
              borderRadius: 6,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <GitBranch size={14} color="#fff" />
          </div>
          <div>
            <div style={{ fontSize: 13, fontWeight: 700, color: "var(--text-primary)", lineHeight: 1 }}>
              Graph Builder
            </div>
            <div style={{ fontSize: 10, color: "var(--text-muted)", lineHeight: 1 }}>
              Operation System · Layer 0
            </div>
          </div>
        </div>

        <div style={{ flex: 1 }} />

        {/* Actions */}
        <button className="btn btn-secondary" onClick={loadGraph} style={{ gap: 6 }}>
          <RefreshCw size={13} />
          Refresh
        </button>
        <button
          className="btn btn-primary"
          onClick={() => { setShowCreatePanel(!showCreatePanel); setSelectedNodeId(null); }}
        >
          <Plus size={14} />
          Thêm KC
        </button>
      </div>

      {/* ── Main canvas ──────────────────────────────────────────────── */}
      <div style={{ flex: 1, position: "relative" }}>
        <ReactFlow
          nodes={nodes}
          edges={edges}
          nodeTypes={nodeTypes}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={onConnect}
          onEdgesDelete={onEdgeDelete}
          onNodeClick={onNodeClick}
          onPaneClick={() => setSelectedNodeId(null)}
          fitView
          fitViewOptions={{ padding: 0.2 }}
          deleteKeyCode="Backspace"
          minZoom={0.2}
          maxZoom={2}
          connectionMode={ConnectionMode.Loose}          // ← FIX: easier connecting
          connectionLineStyle={{ stroke: "var(--accent-blue)", strokeWidth: 2, strokeDasharray: "5 5" }}
          defaultEdgeOptions={{
            type: "smoothstep",
            markerEnd: { type: MarkerType.ArrowClosed, color: "var(--edge-default)" },
            style: { stroke: "var(--edge-default)", strokeWidth: 2 },
          }}
        >
          <Background
            variant={BackgroundVariant.Dots}
            gap={24}
            size={1}
            color="var(--border-subtle)"
          />
          <Controls position="bottom-left" />
          <MiniMap
            position="bottom-right"
            nodeColor={(n) => {
              const d = n.data as unknown as KCNodeData;
              const colors: Record<number, string> = { 6: "#3fb950", 7: "#388bfd", 8: "#a371f7", 9: "#e05252" };
              return colors[d.grade as number] ?? "#8b949e";
            }}
            maskColor="rgba(13,17,23,0.7)"
          />

          {/* Health panel — top-left */}
          <Panel position="top-left">
            <HealthPanel health={health} loading={healthLoading} />
          </Panel>

          {/* Legend — top-center */}
          <Panel position="top-center">
            <div className="glass" style={{ padding: "6px 14px", borderRadius: 20, display: "flex", gap: 16 }}>
              {[
                { color: "#3fb950", label: "Lớp 6" },
                { color: "#388bfd", label: "Lớp 7" },
                { color: "#a371f7", label: "Lớp 8" },
                { color: "#e05252", label: "Lớp 9" },
              ].map(({ color, label }) => (
                <div key={label} style={{ display: "flex", alignItems: "center", gap: 5 }}>
                  <div style={{ width: 10, height: 10, borderRadius: 3, background: color }} />
                  <span style={{ fontSize: 11, color: "var(--text-secondary)" }}>{label}</span>
                </div>
              ))}
              <div style={{ width: 1, background: "var(--border)", margin: "0 2px" }} />
              <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
                <Info size={11} color="var(--text-muted)" />
                <span style={{ fontSize: 11, color: "var(--text-muted)" }}>
                  Kéo ● dưới node → ● trên node khác để thêm prerequisite
                </span>
              </div>
            </div>
          </Panel>
        </ReactFlow>

        {/* Create KC panel */}
        {showCreatePanel && (
          <CreateKCPanel
            onCreated={handleKCCreated}
            onClose={() => setShowCreatePanel(false)}
          />
        )}

        {/* KC Detail Panel */}
        <KCDetailPanel
          nodeId={selectedNodeId}
          onClose={() => setSelectedNodeId(null)}
          onKCUpdated={handleKCUpdated}
          onKCDeleted={handleKCDeleted}
        />

        {/* Toast notification */}
        {toast && (
          <div
            className="fade-in"
            style={{
              position: "absolute",
              bottom: 80,
              left: "50%",
              transform: "translateX(-50%)",
              padding: "10px 18px",
              borderRadius: 8,
              background: toast.type === "ok" ? "rgba(63,185,80,0.15)" : "rgba(248,81,73,0.15)",
              border: `1px solid ${toast.type === "ok" ? "rgba(63,185,80,0.4)" : "rgba(248,81,73,0.4)"}`,
              color: toast.type === "ok" ? "var(--accent-green)" : "var(--accent-red)",
              fontSize: 13,
              fontWeight: 500,
              zIndex: 999,
              backdropFilter: "blur(8px)",
              display: "flex",
              alignItems: "center",
              gap: 8,
              whiteSpace: "nowrap",
            }}
          >
            {toast.type === "err" && <AlertTriangle size={14} />}
            {toast.msg}
          </div>
        )}
      </div>
    </div>
  );
}

export default function GraphBuilderPage() {
  return (
    <ReactFlowProvider>
      <GraphBuilderInner />
    </ReactFlowProvider>
  );
}
