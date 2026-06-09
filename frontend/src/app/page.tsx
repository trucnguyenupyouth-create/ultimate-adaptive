"use client";

import { useCallback, useEffect, useRef, useState, useMemo } from "react";
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
  List,
  Search,
  X,
} from "lucide-react";

import { graphApi, GraphHealth, GraphEdge } from "@/lib/api";
import { KCNodeData } from "@/components/KCNode";
import KCNodeComponent from "@/components/KCNode";
import CreateKCPanel from "@/components/CreateKCPanel";
import HealthPanel from "@/components/HealthPanel";
import KCDetailPanel from "@/components/KCDetailPanel";
import CustomEdgeComponent from "@/components/CustomEdge";
import EdgeDetailPanel from "@/components/EdgeDetailPanel";

// Register custom node and edge types
const nodeTypes = { kcNode: KCNodeComponent };
const edgeTypes = { prerequisite: CustomEdgeComponent };

// ── Helpers ────────────────────────────────────────────────────────────────

const getStoredPositions = (): Record<string, { x: number; y: number }> => {
  if (typeof window === "undefined") return {};
  try {
    const stored = localStorage.getItem("kb_node_positions");
    return stored ? JSON.parse(stored) : {};
  } catch {
    return {};
  }
};

const saveStoredPositions = (positions: Record<string, { x: number; y: number }>) => {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem("kb_node_positions", JSON.stringify(positions));
  } catch (e) {
    console.error("Error saving positions to localStorage", e);
  }
};

function toFlowNodes(
  apiNodes: { id: string; code: string; name: string; grade: number; subject: string; chapter_info?: string }[],
  health: GraphHealth | null
): Node[] {
  const rootSet = new Set(health?.root_kcs ?? []);
  const leafSet = new Set(health?.leaf_kcs ?? []);
  const lowSet  = new Set(health?.low_item_kcs ?? []);
  const itemCounts = health?.item_counts ?? {};

  const storedPositions = getStoredPositions();
  const updatedPositions = { ...storedPositions };
  let positionsChanged = false;

  const flowNodes = apiNodes.map((n, i) => {
    let position = storedPositions[n.id];
    
    if (!position) {
      position = { x: 260 * (i % 5), y: 190 * Math.floor(i / 5) };
      updatedPositions[n.id] = position;
      positionsChanged = true;
    }

    return {
      id: n.id,
      type: "kcNode",
      position,
      dragHandle: ".node-drag-handle",   // ← FIX: only drag via the header handle
      data: {
        id: n.id,
        code: n.code,
        name: n.name,
        grade: n.grade,
        subject: n.subject,
        chapter_info: n.chapter_info,
        isRoot: rootSet.has(n.id),
        isLeaf: leafSet.has(n.id),
        isLowItems: lowSet.has(n.id),
        itemCounts: itemCounts[n.id] ?? null,
      } satisfies KCNodeData,
    };
  });

  if (positionsChanged) {
    saveStoredPositions(updatedPositions);
  }

  return flowNodes;
}

function toFlowEdges(
  apiEdges: GraphEdge[],
  cycleEdges: Set<string>,
  selectedEdgeId: string | null
): Edge[] {
  return apiEdges.map((e) => {
    const id = `${e.source}->${e.target}`;
    const isCycle = cycleEdges.has(id);
    const isSelected = selectedEdgeId === id;
    
    const strokeColor = isCycle
      ? "var(--accent-red)"
      : isSelected
      ? "var(--accent-blue)"
      : "var(--edge-default)";
      
    return {
      id,
      source: e.source,
      target: e.target,
      type: "prerequisite",
      animated: false,
      data: {
        label: e.label,
        weight: e.weight,
        isCycle,
      },
      style: {
        stroke: strokeColor,
        strokeWidth: isCycle || isSelected ? 3 : 2,
        strokeDasharray: isCycle ? "6 3" : undefined,
      },
      markerEnd: {
        type: MarkerType.ArrowClosed,
        color: strokeColor,
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
  const [selectedEdgeId, setSelectedEdgeId] = useState<string | null>(null);
  const [toast, setToast] = useState<{ msg: string; type: "ok" | "err" } | null>(null);
  const [cycleEdges] = useState<Set<string>>(new Set());

  // Search and List States
  const [searchQuery, setSearchQuery] = useState("");
  const [navSearch, setNavSearch] = useState("");
  const [showNavResults, setShowNavResults] = useState(false);
  const [showListPanel, setShowListPanel] = useState(false);

  const toastTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const { fitView, setCenter, getViewport } = useReactFlow();

  const focusNode = useCallback((node: Node) => {
    setCenter(node.position.x + 90, node.position.y + 50, { zoom: 1.2, duration: 800 });
    setSelectedNodeId(node.id);
    setSelectedEdgeId(null);
  }, [setCenter]);

  const missingKCs = useMemo(() => {
    return nodes
      .map(n => n.data as unknown as KCNodeData)
      .filter(d => !d.chapter_info || !d.chapter_info.trim());
  }, [nodes]);

  const filteredNodes = useMemo(() => {
    if (!searchQuery.trim()) return nodes;
    const query = searchQuery.toLowerCase();
    return nodes.filter((n) => {
      const d = n.data as unknown as KCNodeData;
      return (
        d.name.toLowerCase().includes(query) ||
        d.code.toLowerCase().includes(query) ||
        (d.chapter_info && d.chapter_info.toLowerCase().includes(query))
      );
    });
  }, [nodes, searchQuery]);

  const navFilteredNodes = useMemo(() => {
    if (!navSearch.trim()) return [];
    const query = navSearch.toLowerCase();
    return nodes.filter((n) => {
      const d = n.data as unknown as KCNodeData;
      return (
        d.name.toLowerCase().includes(query) ||
        d.code.toLowerCase().includes(query)
      );
    });
  }, [nodes, navSearch]);

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
      setEdges(toFlowEdges(graphData.edges, cycleEdges, selectedEdgeId));
    } catch {
      showToast("Không kết nối được với backend", "err");
    } finally {
      setHealthLoading(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => { loadGraph(); }, [loadGraph]);

  // Update edge style highlights locally on selection change
  useEffect(() => {
    setEdges((eds) =>
      eds.map((e) => {
        const isSelected = e.id === selectedEdgeId;
        const isCycle = cycleEdges.has(e.id);
        const color = isCycle
          ? "var(--accent-red)"
          : isSelected
          ? "var(--accent-blue)"
          : "var(--edge-default)";
        return {
          ...e,
          style: {
            ...e.style,
            stroke: color,
            strokeWidth: isCycle || isSelected ? 3 : 2,
          },
          markerEnd: {
            ...(e.markerEnd as any),
            color,
          },
        };
      })
    );
  }, [selectedEdgeId, cycleEdges]);

  // ── Node/Edge change handlers ─────────────────────────────────────────
  const onNodesChange = useCallback(
    (changes: NodeChange[]) => {
      setNodes((nds) => {
        const nextNodes = applyNodeChanges(changes, nds);
        
        // Save node positions on drag
        const positions = getStoredPositions();
        let changed = false;
        nextNodes.forEach((node) => {
          const stored = positions[node.id];
          if (!stored || stored.x !== node.position.x || stored.y !== node.position.y) {
            positions[node.id] = node.position;
            changed = true;
          }
        });
        if (changed) {
          saveStoredPositions(positions);
        }
        
        return nextNodes;
      });
    },
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
    (kc: { id: string; code: string; name: string; grade: number; chapter_info?: string }) => {
      let position = { x: 100 + Math.random() * 400, y: 100 + Math.random() * 300 };
      try {
        const { x, y, zoom } = getViewport();
        const centerX = -x / zoom + (window.innerWidth / 2) / zoom;
        const centerY = -y / zoom + (window.innerHeight / 2) / zoom;
        position = { x: centerX - 90, y: centerY - 50 };
      } catch (e) {
        console.error("Failed to get viewport center", e);
      }

      const newNode: Node = {
        id: kc.id,
        type: "kcNode",
        position,
        dragHandle: ".node-drag-handle",
        data: {
          id: kc.id,
          code: kc.code,
          name: kc.name,
          grade: kc.grade,
          subject: "math",
          chapter_info: kc.chapter_info,
          isRoot: true,
          isLeaf: true,
          isLowItems: true,
          itemCounts: undefined,
        } satisfies KCNodeData,
      };
      
      // Save the new node's position to localStorage
      const positions = getStoredPositions();
      positions[kc.id] = newNode.position;
      saveStoredPositions(positions);

      setNodes((nds) => [...nds, newNode]);
      showToast(`✓ Đã tạo KC "${kc.name}"`);
      graphApi.getHealth().then(setHealth);
    },
    [getViewport]
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
      // Clean up position from localStorage
      const positions = getStoredPositions();
      if (positions[id]) {
        delete positions[id];
        saveStoredPositions(positions);
      }

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
    setSelectedEdgeId(null);
    setShowCreatePanel(false); // Close create panel if open
  }, []);

  const onEdgeClick = useCallback((_: React.MouseEvent, edge: Edge) => {
    setSelectedEdgeId(edge.id);
    setSelectedNodeId(null);
    setShowCreatePanel(false);
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

        {/* Search Box in Navbar */}
        <div style={{ position: "relative", width: 220, marginLeft: 20 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <Search size={14} color="var(--text-muted)" style={{ position: "absolute", left: 10 }} />
            <input
              className="input"
              placeholder="Tìm nhanh KC..."
              value={navSearch}
              onChange={(e) => {
                setNavSearch(e.target.value);
                setShowNavResults(true);
              }}
              onFocus={() => setShowNavResults(true)}
              style={{ height: 32, fontSize: 12, paddingLeft: 30 }}
            />
          </div>
          {showNavResults && navSearch.trim() && (
            <>
              <div 
                onClick={() => setShowNavResults(false)}
                style={{ position: "fixed", inset: 0, zIndex: 998 }}
              />
              <div
                className="glass"
                style={{
                  position: "absolute",
                  top: 38,
                  left: 0,
                  width: 280,
                  maxHeight: 300,
                  overflowY: "auto",
                  borderRadius: 8,
                  padding: 8,
                  zIndex: 999,
                  boxShadow: "0 4px 12px rgba(0,0,0,0.5)",
                  display: "flex",
                  flexDirection: "column",
                  gap: 4,
                }}
              >
                {navFilteredNodes.length === 0 ? (
                  <div style={{ fontSize: 11, color: "var(--text-muted)", padding: "6px 10px", fontStyle: "italic" }}>
                    Không tìm thấy KC nào
                  </div>
                ) : (
                  navFilteredNodes.map((n) => {
                    const d = n.data as unknown as KCNodeData;
                    return (
                      <div
                        key={n.id}
                        onClick={() => {
                          focusNode(n);
                          setShowNavResults(false);
                          setNavSearch("");
                        }}
                        style={{
                          padding: "6px 10px",
                          borderRadius: 6,
                          cursor: "pointer",
                          fontSize: 12,
                          transition: "background 0.15s",
                        }}
                        className="list-item-hover"
                      >
                        <div style={{ fontSize: 9, fontFamily: "monospace", color: "var(--text-muted)" }}>{d.code}</div>
                        <div style={{ fontWeight: 600, color: "var(--text-primary)" }}>{d.name}</div>
                      </div>
                    );
                  })
                )}
              </div>
            </>
          )}
        </div>

        <div style={{ flex: 1 }} />

        {/* Actions */}
        <button className="btn btn-secondary" onClick={() => setShowListPanel(!showListPanel)} style={{ gap: 6 }}>
          <List size={13} />
          Danh sách KC
        </button>
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
          edgeTypes={edgeTypes}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={onConnect}
          onEdgesDelete={onEdgeDelete}
          onNodeClick={onNodeClick}
          onEdgeClick={onEdgeClick}
          onPaneClick={() => { setSelectedNodeId(null); setSelectedEdgeId(null); }}
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

        {/* Missing chapter_info notification banner */}
        {missingKCs.length > 0 && (
          <div
            className="glass fade-in"
            style={{
              position: "absolute",
              top: 16,
              left: "50%",
              transform: "translateX(-50%)",
              width: "80%",
              maxWidth: 800,
              padding: "10px 16px",
              borderRadius: 8,
              border: "1px solid rgba(248,81,73,0.3)",
              background: "rgba(248,81,73,0.1)",
              color: "var(--text-primary)",
              fontSize: 12,
              zIndex: 40,
              boxShadow: "0 4px 12px rgba(0,0,0,0.3)",
              display: "flex",
              flexDirection: "column",
              gap: 6,
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 6, fontWeight: 600, color: "var(--accent-red)" }}>
              <AlertTriangle size={14} />
              <span>Cảnh báo: Có {missingKCs.length} nodes thiếu thông tin "Bài mấy kì mấy"!</span>
            </div>
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center" }}>
              <span style={{ color: "var(--text-secondary)" }}>Nhấp vào node để bổ sung:</span>
              {missingKCs.map((n) => (
                <button
                  key={n.id}
                  onClick={() => {
                    const flowNode = nodes.find(fn => fn.id === n.id);
                    if (flowNode) {
                      focusNode(flowNode);
                    }
                  }}
                  className="btn btn-secondary"
                  style={{
                    padding: "2px 6px",
                    fontSize: 10,
                    fontFamily: "monospace",
                    borderColor: "rgba(248,81,73,0.4)",
                    background: "rgba(248,81,73,0.05)",
                    color: "var(--accent-red)",
                  }}
                >
                  {n.code}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Left Side: KC List Panel */}
        {showListPanel && (
          <div
            className="glass fade-in"
            style={{
              position: "absolute",
              top: 16,
              left: 16,
              bottom: 16,
              width: 320,
              borderRadius: 12,
              padding: 20,
              zIndex: 100,
              display: "flex",
              flexDirection: "column",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16, flexShrink: 0 }}>
              <div style={{ fontSize: 14, fontWeight: 600, color: "var(--text-primary)" }}>
                Danh sách KCs
              </div>
              <button className="btn btn-ghost" onClick={() => setShowListPanel(false)} style={{ padding: "4px 6px" }}>
                <X size={16} />
              </button>
            </div>

            <div style={{ marginBottom: 16, flexShrink: 0 }}>
              <input
                className="input"
                placeholder="Tìm theo tên, mã hoặc bài..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                style={{ fontSize: 13 }}
              />
            </div>

            <div style={{ flex: 1, overflowY: "auto", display: "flex", flexDirection: "column", gap: 8 }}>
              {filteredNodes.length === 0 ? (
                <div style={{ fontSize: 12, color: "var(--text-muted)", fontStyle: "italic", textAlign: "center", marginTop: 20 }}>
                  Không tìm thấy KC nào
                </div>
              ) : (
                filteredNodes.map((n) => {
                  const d = n.data as unknown as KCNodeData;
                  return (
                    <div
                      key={n.id}
                      onClick={() => focusNode(n)}
                      style={{
                        padding: "10px 12px",
                        borderRadius: 8,
                        background: selectedNodeId === n.id ? "rgba(56,139,253,0.15)" : "var(--bg-elevated)",
                        border: `1px solid ${selectedNodeId === n.id ? "var(--accent-blue)" : "var(--border)"}`,
                        cursor: "pointer",
                        transition: "all 0.15s ease",
                      }}
                      className="list-item-hover"
                    >
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
                        <span style={{ fontSize: 9, fontFamily: "monospace", color: "var(--text-muted)" }}>
                          {d.code}
                        </span>
                        <span style={{ fontSize: 9, color: "var(--accent-blue)", fontWeight: 600 }}>
                          {d.chapter_info || "Thiếu bài học"}
                        </span>
                      </div>
                      <div style={{ fontSize: 12, fontWeight: 600, color: "var(--text-primary)", lineHeight: 1.3 }}>
                        {d.name}
                      </div>
                      <div style={{ fontSize: 10, color: "var(--text-muted)", marginTop: 4 }}>
                        Lớp {d.grade} · {d.subject === "math" ? "Toán" : d.subject}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        )}

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

        {/* Edge Detail Panel (slides in from left) */}
        <EdgeDetailPanel
          edgeId={selectedEdgeId}
          onClose={() => setSelectedEdgeId(null)}
          onEdgeUpdated={loadGraph}
          onEdgeDeleted={() => {
            setSelectedEdgeId(null);
            loadGraph();
            showToast("✓ Đã xoá liên kết");
          }}
          onEdgeReversed={() => {
            setSelectedEdgeId(null);
            loadGraph();
            showToast("✓ Đã đảo chiều liên kết");
          }}
          onJumpToKC={(kcId) => {
            setSelectedNodeId(kcId);
            setSelectedEdgeId(null);
          }}
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
