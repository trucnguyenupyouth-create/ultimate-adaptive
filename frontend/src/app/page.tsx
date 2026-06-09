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

import { graphApi, GraphHealth, GraphEdge, GraphBlock, GraphNote, EdgeType, KCNode } from "@/lib/api";
import { KCNodeData } from "@/components/KCNode";
import KCNodeComponent from "@/components/KCNode";
import BlockNodeComponent from "@/components/BlockNode";
import NoteNodeComponent from "@/components/NoteNode";
import CreateKCPanel from "@/components/CreateKCPanel";
import HealthPanel from "@/components/HealthPanel";
import KCDetailPanel from "@/components/KCDetailPanel";
import CustomEdgeComponent from "@/components/CustomEdge";
import EdgeDetailPanel from "@/components/EdgeDetailPanel";

// Register custom node and edge types
const nodeTypes = {
  kcNode: KCNodeComponent,
  blockNode: BlockNodeComponent,
  noteNode: NoteNodeComponent,
};
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
  apiNodes: KCNode[],
  apiBlocks: GraphBlock[],
  health: GraphHealth | null,
  onBlockRename: (id: string, name: string) => void,
  onBlockDelete: (id: string) => void,
  onBlockResize: (id: string, x: number, y: number, width: number, height: number) => void
): Node[] {
  const rootSet = new Set(health?.root_kcs ?? []);
  const leafSet = new Set(health?.leaf_kcs ?? []);
  const lowSet  = new Set(health?.low_item_kcs ?? []);
  const itemCounts = health?.item_counts ?? {};

  const storedPositions = getStoredPositions();
  const updatedPositions = { ...storedPositions };
  let positionsChanged = false;

  const flowNodes = apiNodes.map((n, i) => {
    // Read from DB metadata position if available, else fallback to stored local storage
    let position = (n.metadata && typeof n.metadata.x === "number" && typeof n.metadata.y === "number")
      ? { x: n.metadata.x, y: n.metadata.y }
      : storedPositions[n.id];
    
    if (!position) {
      position = { x: 260 * (i % 5), y: 190 * Math.floor(i / 5) };
      updatedPositions[n.id] = position;
      positionsChanged = true;
    }

    const containingBlock = apiBlocks.find((b) => b.id === n.block_id);

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
        block_id: n.block_id,
        blockName: containingBlock ? containingBlock.name : null,
        isRoot: rootSet.has(n.id),
        isLeaf: leafSet.has(n.id),
        isLowItems: lowSet.has(n.id),
        itemCounts: itemCounts[n.id] ?? null,
      } satisfies KCNodeData,
    };
  });

  // Map blocks to flow nodes
  const blockFlowNodes = apiBlocks.map((b) => ({
    id: b.id,
    type: "blockNode",
    position: { x: b.x, y: b.y },
    style: { width: b.width, height: b.height },
    zIndex: -1,
    data: {
      id: b.id,
      name: b.name,
      onRename: onBlockRename,
      onDelete: onBlockDelete,
    },
  }));

  if (positionsChanged) {
    saveStoredPositions(updatedPositions);
  }

  // Render blocks first so they stay in background
  return [...blockFlowNodes, ...flowNodes];
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
    const edgeType = e.edge_type ?? "prerequisite";

    const strokeColor =
      isCycle
        ? "var(--accent-red)"
        : edgeType === "unsure"
        ? (isSelected ? "#f0c040" : "#d29922")
        : edgeType === "inference"
        ? (isSelected ? "#79c0ff" : "#8b949e")
        : (isSelected ? "var(--accent-blue)" : "var(--edge-default)");

    const strokeDashArray =
      isCycle ? "6 3" : edgeType === "inference" ? "8 5" : undefined;

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
        edge_type: edgeType,
      },
      style: {
        stroke: strokeColor,
        strokeWidth: isCycle || isSelected ? 3 : 2,
        strokeDasharray: strokeDashArray,
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
  const [toolbarOpen, setToolbarOpen] = useState(false);
  const [activeEdgeType, setActiveEdgeType] = useState<EdgeType>("prerequisite");

  // Search and List States
  const [searchQuery, setSearchQuery] = useState("");
  const [navSearch, setNavSearch] = useState("");
  const [showNavResults, setShowNavResults] = useState(false);
  const [showListPanel, setShowListPanel] = useState(false);
  const [nodeToDelete, setNodeToDelete] = useState<Node | null>(null);

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

  // ── Block callbacks and handlers ──────────────────────────────────────
  const handleBlockRename = useCallback(async (id: string, newName: string) => {
    try {
      await graphApi.updateBlock(id, { name: newName });
      setNodes((nds) =>
        nds.map((n) =>
          n.id === id ? { ...n, data: { ...n.data, name: newName } } : n
        )
      );
      showToast("✓ Đã đổi tên block");
    } catch {
      showToast("Lỗi đổi tên block", "err");
    }
  }, []);

  const handleBlockDelete = useCallback(async (id: string) => {
    const confirm = window.confirm("Bạn có chắc chắn muốn xoá block này? Các nodes bên trong sẽ không bị xoá.");
    if (!confirm) return;
    try {
      await graphApi.deleteBlock(id);
      
      // Remove block node from state
      setNodes((nds) => nds.filter((n) => n.id !== id));
      
      // Update all child nodes to have block_id = null
      setNodes((nds) =>
        nds.map((n) =>
          n.type === "kcNode" && (n.data as any).block_id === id
            ? { ...n, data: { ...n.data, block_id: null, blockName: null } }
            : n
        )
      );
      
      showToast("✓ Đã xoá block");
      graphApi.getHealth().then(setHealth);
    } catch {
      showToast("Lỗi xoá block", "err");
    }
  }, [setHealth]);

  const handleBlockResize = useCallback(
    async (id: string, x: number, y: number, width: number, height: number) => {
      try {
        await graphApi.updateBlock(id, { x, y, width, height });
        
        // Update local state so coords and dimensions are in sync
        setNodes((nds) =>
          nds.map((n) =>
            n.id === id
              ? {
                  ...n,
                  position: { x, y },
                  style: { ...n.style, width, height },
                }
              : n
          )
        );
        showToast("✓ Đã lưu kích thước block");
      } catch (e) {
        showToast("Lỗi lưu kích thước block", "err");
      }
    },
    []
  );

  const handleCreateBlock = useCallback(async () => {
    let position = { x: 100, y: 100 };
    try {
      const { x, y, zoom } = getViewport();
      const centerX = -x / zoom + (window.innerWidth / 2) / zoom;
      const centerY = -y / zoom + (window.innerHeight / 2) / zoom;
      position = { x: centerX - 200, y: centerY - 150 };
    } catch (e) {
      console.error("Failed to get viewport center", e);
    }

    try {
      const newBlock = await graphApi.createBlock({
        name: "Block mới",
        x: position.x,
        y: position.y,
        width: 400,
        height: 300,
      });

      const flowNode: Node = {
        id: newBlock.id,
        type: "blockNode",
        position: { x: newBlock.x, y: newBlock.y },
        style: { width: newBlock.width, height: newBlock.height },
        zIndex: -1,
        data: {
          id: newBlock.id,
          name: newBlock.name,
          onRename: handleBlockRename,
          onDelete: handleBlockDelete,
          onResize: handleBlockResize,
        },
      };

      setNodes((nds) => [...nds, flowNode]);
      showToast("✓ Đã tạo Block mới");
    } catch {
      showToast("Lỗi tạo Block", "err");
    }
  }, [getViewport, handleBlockRename, handleBlockDelete, handleBlockResize]);

  const onNodeDragStop = useCallback(
    async (event: any, node: Node) => {
      if (node.type === "blockNode") {
        try {
          const width = node.style?.width ? Number(node.style.width) : 400;
          const height = node.style?.height ? Number(node.style.height) : 300;
          await graphApi.updateBlock(node.id, {
            x: node.position.x,
            y: node.position.y,
            width,
            height,
          });
          
          // Also save positions of containing KC nodes to DB so they sync
          setNodes((nds) => {
            const childKCs = nds.filter(
              (n) => n.type === "kcNode" && (n.data as any).block_id === node.id
            );
            childKCs.forEach((child) => {
              graphApi.updateKC(child.id, {
                x: child.position.x,
                y: child.position.y,
              }).catch((err) => console.error("Lỗi cập nhật vị trí child KC", err));
            });
            return nds;
          });
        } catch (e) {
          showToast("Lỗi lưu vị trí block", "err");
        }
      } else if (node.type === "kcNode") {
        const kcCenter = {
          x: node.position.x + 100,
          y: node.position.y + 60,
        };
        
        // Find containing block
        setNodes((nds) => {
          const blockNodes = nds.filter((n) => n.type === "blockNode");
          const containingBlock = blockNodes.find((block) => {
            const bx = block.position.x;
            const by = block.position.y;
            const bw = block.style?.width ? Number(block.style.width) : 400;
            const bh = block.style?.height ? Number(block.style.height) : 300;
            
            return (
              kcCenter.x >= bx &&
              kcCenter.x <= bx + bw &&
              kcCenter.y >= by &&
              kcCenter.y <= by + bh
            );
          });
          
          const currentBlockId = (node.data as any).block_id || null;
          const newBlockId = containingBlock ? containingBlock.id : null;
          
          if (currentBlockId !== newBlockId) {
            // Trigger API update with new block and position coordinates
            graphApi.updateKC(node.id, { 
              block_id: newBlockId,
              x: node.position.x,
              y: node.position.y,
            })
              .then(() => {
                showToast(
                  newBlockId
                    ? `✓ Đã đưa KC vào block "${containingBlock?.data.name}"`
                    : `✓ Đã đưa KC ra khỏi block`
                );
                graphApi.getHealth().then(setHealth);
              })
              .catch(() => {
                showToast("Lỗi cập nhật block cho KC", "err");
                // Revert node state
                setNodes((currentNodes) =>
                  currentNodes.map((n) =>
                    n.id === node.id
                      ? {
                          ...n,
                          data: {
                            ...n.data,
                            block_id: currentBlockId,
                            blockName: currentBlockId
                              ? (blockNodes.find((b) => b.id === currentBlockId)?.data.name || "")
                              : null,
                          },
                        }
                      : n
                  )
                );
              });
            
            return nds.map((n) =>
              n.id === node.id
                ? {
                    ...n,
                    data: {
                      ...n.data,
                      block_id: newBlockId,
                      blockName: containingBlock ? containingBlock.data.name : null,
                    },
                  }
                : n
            );
          } else {
            // Block didn't change, but coordinates did. Save to DB.
            graphApi.updateKC(node.id, {
              x: node.position.x,
              y: node.position.y,
            }).catch((err) => {
              console.error("Lỗi cập nhật vị trí KC lên database", err);
            });
          }
          return nds;
        });
      } else if (node.type === "noteNode") {
        // Save note position after drag
        graphApi.updateNote(node.id, { x: node.position.x, y: node.position.y }).catch(() => {
          showToast("Lỗi lưu vị trí ghi chú", "err");
        });
      }
    },
    [setHealth]
  );

  // ── Load graph ────────────────────────────────────────────────────────
  const handleNoteDelete = useCallback(async (id: string) => {
    try {
      await graphApi.deleteNote(id);
      setNodes((nds) => nds.filter((n) => n.id !== id));
      showToast("✓ Đã xoá ghi chú");
    } catch {
      showToast("Lỗi xoá ghi chú", "err");
    }
  }, []);

  const handleNoteContentSave = useCallback((id: string, content: string) => {
    setNodes((nds) =>
      nds.map((n) => n.id === id ? { ...n, data: { ...n.data, content } } : n)
    );
  }, []);

  const makeNoteFlowNode = useCallback((n: GraphNote): Node => ({
    id: n.id,
    type: "noteNode",
    position: { x: n.x, y: n.y },
    style: { width: n.width, height: n.height },
    dragHandle: undefined,
    data: {
      content: n.content,
      color: n.color,
      onDelete: handleNoteDelete,
      onContentSave: handleNoteContentSave,
    },
  }), [handleNoteDelete, handleNoteContentSave]);

  const handleCreateNote = useCallback(async () => {
    let position = { x: 100, y: 100 };
    try {
      const { x, y, zoom } = getViewport();
      const centerX = -x / zoom + (window.innerWidth / 2) / zoom;
      const centerY = -y / zoom + (window.innerHeight / 2) / zoom;
      position = { x: centerX - 100, y: centerY - 75 };
    } catch { /* fallback */ }
    try {
      const note = await graphApi.createNote({
        content: "",
        x: position.x,
        y: position.y,
        width: 200,
        height: 150,
      });
      setNodes((nds) => [...nds, makeNoteFlowNode(note)]);
      showToast("✓ Đã tạo ghi chú mới");
    } catch {
      showToast("Lỗi tạo ghi chú", "err");
    }
  }, [getViewport, makeNoteFlowNode]);

  const handleChangeEdgeType = useCallback(async (newType: EdgeType) => {
    if (!selectedEdgeId) return;
    // edge id format: "${source}->${target}"
    const [prereq_id, kc_id] = selectedEdgeId.split("->");
    if (!prereq_id || !kc_id) return;
    try {
      await graphApi.changeEdgeType(kc_id, prereq_id, newType);
      // Update local edge state immediately
      setEdges((eds) =>
        eds.map((e) =>
          e.id === selectedEdgeId
            ? {
                ...e,
                data: { ...e.data, edge_type: newType },
              }
            : e
        )
      );
      setActiveEdgeType(newType);
      showToast(`✓ Đã đổi loại nét → ${newType}`);
    } catch {
      showToast("Lỗi đổi loại nét", "err");
    }
  }, [selectedEdgeId]);

  // Sync activeEdgeType when a different edge is selected
  useEffect(() => {
    if (!selectedEdgeId) return;
    setEdges((eds) => {
      const edge = eds.find((e) => e.id === selectedEdgeId);
      if (edge) setActiveEdgeType((edge.data as any)?.edge_type ?? "prerequisite");
      return eds;
    });
  }, [selectedEdgeId]);

  const loadGraph = useCallback(async () => {
    try {
      setHealthLoading(true);
      const [graphData, healthData] = await Promise.all([
        graphApi.getGraph(),
        graphApi.getHealth(),
      ]);
      setHealth(healthData);
      const kcAndBlockNodes = toFlowNodes(
        graphData.nodes,
        graphData.blocks || [],
        healthData,
        handleBlockRename,
        handleBlockDelete,
        handleBlockResize
      );
      const noteNodes = (graphData.notes || []).map(makeNoteFlowNode);
      setNodes([...kcAndBlockNodes, ...noteNodes]);
      setEdges(toFlowEdges(graphData.edges, cycleEdges, selectedEdgeId));

      // Auto-migrate coordinates from localStorage to DB if missing in DB metadata
      const storedPositions = getStoredPositions();
      const nodesToSync = graphData.nodes.filter((n) => {
        const hasDbPos = n.metadata && typeof n.metadata.x === "number" && typeof n.metadata.y === "number";
        const hasLocalPos = storedPositions[n.id] !== undefined;
        return !hasDbPos && hasLocalPos;
      });
      if (nodesToSync.length > 0) {
        Promise.all(
          nodesToSync.map((n) => {
            const pos = storedPositions[n.id];
            return graphApi.updateKC(n.id, { x: pos.x, y: pos.y })
              .catch((err) => console.error(`Lỗi đồng bộ vị trí KC ${n.id} lên DB:`, err));
          })
        ).then(() => {
          console.log(`Đã tự động đồng bộ ${nodesToSync.length} vị trí KC từ localStorage lên DB.`);
        });
      }
    } catch {
      showToast("Không kết nối được với backend", "err");
    } finally {
      setHealthLoading(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [handleBlockRename, handleBlockDelete, handleBlockResize, makeNoteFlowNode]);

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
        // Find if any block is being dragged and by how much
        const blockDragChanges = changes.filter(
          (c) => c.type === "position" && c.dragging === true
        );
        
        const adjustedChanges = [...changes];
        
        blockDragChanges.forEach((change: any) => {
          const blockNode = nds.find((n) => n.id === change.id);
          if (blockNode && blockNode.type === "blockNode" && change.position) {
            const dx = change.position.x - blockNode.position.x;
            const dy = change.position.y - blockNode.position.y;
            
            if (dx !== 0 || dy !== 0) {
              // Find all KC nodes that are associated with this block
              const childKCs = nds.filter(
                (n) => n.type === "kcNode" && (n.data as any).block_id === blockNode.id
              );
              
              // Add artificial position changes for children
              childKCs.forEach((child) => {
                adjustedChanges.push({
                  id: child.id,
                  type: "position",
                  position: {
                    x: child.position.x + dx,
                    y: child.position.y + dy,
                  },
                });
              });
            }
          }
        });

        const nextNodes = applyNodeChanges(adjustedChanges, nds);
        
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

  const executeNodeDelete = useCallback(async () => {
    if (!nodeToDelete) return;
    try {
      await graphApi.deleteKC(nodeToDelete.id);
      handleKCDeleted(nodeToDelete.id);
      showToast("✓ Đã xoá KC");
    } catch {
      showToast("Lỗi xoá KC", "err");
    } finally {
      setNodeToDelete(null);
    }
  }, [nodeToDelete, handleKCDeleted]);

  const onBeforeDelete = useCallback(
    async ({ nodes: nodesToDelete }: { nodes: Node[]; edges: Edge[] }) => {
      if (nodesToDelete.length > 0) {
        setNodeToDelete(nodesToDelete[0]);
        return false; // Abort automatic delete so we can confirm
      }
      return true;
    },
    []
  );

  // Handle keyboard shortcuts when deletion modal is open
  useEffect(() => {
    if (!nodeToDelete) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Enter") {
        e.preventDefault();
        executeNodeDelete();
      } else if (e.key === "Escape") {
        e.preventDefault();
        setNodeToDelete(null);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [nodeToDelete, executeNodeDelete]);

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
        <button className="btn btn-secondary" onClick={handleCreateBlock} style={{ gap: 6 }}>
          <Plus size={13} />
          Thêm Block
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
          onBeforeDelete={onBeforeDelete}
          onNodeClick={onNodeClick}
          onEdgeClick={onEdgeClick}
          onNodeDragStop={onNodeDragStop}
          onPaneClick={() => { setSelectedNodeId(null); setSelectedEdgeId(null); }}
          fitView
          fitViewOptions={{ padding: 0.2 }}
          deleteKeyCode={["Backspace", "Delete"]}
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

          {/* ── Bottom collapsible toolbar ─────────────────────────── */}
          <Panel position="bottom-center">
            <div
              className="glass"
              style={{
                borderRadius: toolbarOpen ? 14 : 28,
                padding: toolbarOpen ? "10px 16px" : "6px 12px",
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                gap: 10,
                transition: "all 0.22s cubic-bezier(0.4,0,0.2,1)",
                border: "1px solid var(--border)",
                boxShadow: "0 4px 20px rgba(0,0,0,0.35)",
                minWidth: toolbarOpen ? 360 : 0,
                overflow: "hidden",
                marginBottom: 8,
              }}
            >
              {/* Toggle button — always visible */}
              <button
                id="toolbar-toggle-btn"
                onClick={() => setToolbarOpen((o) => !o)}
                title={toolbarOpen ? "Thu gọn toolbar" : "Mở toolbar công cụ"}
                style={{
                  background: "none",
                  border: "none",
                  cursor: "pointer",
                  color: "var(--text-secondary)",
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                  fontSize: 11,
                  fontWeight: 600,
                  padding: "2px 4px",
                  borderRadius: 8,
                  transition: "color 0.15s",
                  whiteSpace: "nowrap",
                }}
                onMouseEnter={(e) => (e.currentTarget.style.color = "var(--text-primary)")}
                onMouseLeave={(e) => (e.currentTarget.style.color = "var(--text-secondary)")}
              >
                <span style={{ fontSize: 15 }}>{toolbarOpen ? "⚙ Công cụ ▾" : "⚙"}</span>
                {!toolbarOpen && <span style={{ fontSize: 10, color: "var(--text-muted)" }}>Công cụ</span>}
              </button>

              {/* Expanded toolbar content */}
              {toolbarOpen && (
                <div style={{ display: "flex", flexDirection: "column", gap: 10, width: "100%" }}>
                  {/* ── Edge type row ───────────────────────── */}
                  <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
                    <div style={{ fontSize: 9, fontWeight: 700, color: "var(--text-muted)", letterSpacing: "0.06em", textTransform: "uppercase" }}>
                      Loại kết nối {selectedEdgeId ? "(đã chọn)" : "(chọn edge trước)"}
                    </div>
                    <div style={{ display: "flex", gap: 7 }}>
                      {([
                        { type: "prerequisite" as EdgeType, label: "── Prerequisite", color: "var(--edge-default)", dashStyle: "none" },
                        { type: "inference" as EdgeType, label: "- - Inference", color: "#8b949e", dashStyle: "8px 4px" },
                        { type: "unsure" as EdgeType, label: "── Unsure?", color: "#d29922", dashStyle: "none" },
                      ]).map(({ type, label, color, dashStyle }) => {
                        const isActive = activeEdgeType === type;
                        const hasEdge = !!selectedEdgeId;
                        return (
                          <button
                            key={type}
                            id={`edge-type-${type}`}
                            onClick={() => hasEdge && handleChangeEdgeType(type)}
                            disabled={!hasEdge}
                            title={hasEdge ? `Đổi loại nét → ${type}` : "Chọn một edge trước"}
                            style={{
                              flex: 1,
                              padding: "5px 8px",
                              borderRadius: 8,
                              border: `1.5px solid ${isActive && hasEdge ? color : "var(--border)"}`,
                              background: isActive && hasEdge ? `${color}18` : "var(--bg-elevated)",
                              color: hasEdge ? (isActive ? color : "var(--text-secondary)") : "var(--text-muted)",
                              cursor: hasEdge ? "pointer" : "not-allowed",
                              fontSize: 10,
                              fontWeight: isActive ? 700 : 400,
                              display: "flex",
                              alignItems: "center",
                              gap: 5,
                              transition: "all 0.15s",
                              opacity: hasEdge ? 1 : 0.5,
                            }}
                          >
                            {/* Visual dash preview */}
                            <svg width={22} height={8} style={{ flexShrink: 0 }}>
                              <line
                                x1={0} y1={4} x2={22} y2={4}
                                stroke={hasEdge ? color : "var(--text-muted)"}
                                strokeWidth={2}
                                strokeDasharray={dashStyle === "none" ? undefined : dashStyle}
                              />
                            </svg>
                            {label}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Divider */}
                  <div style={{ height: 1, background: "var(--border)", margin: "0 -4px" }} />

                  {/* ── Add note row ───────────────────────── */}
                  <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
                    <div style={{ fontSize: 9, fontWeight: 700, color: "var(--text-muted)", letterSpacing: "0.06em", textTransform: "uppercase" }}>
                      Ghi chú
                    </div>
                    <button
                      id="add-note-btn"
                      onClick={handleCreateNote}
                      style={{
                        padding: "6px 14px",
                        borderRadius: 8,
                        border: "1.5px solid #e8d44d",
                        background: "rgba(255,253,231,0.12)",
                        color: "#d4b400",
                        cursor: "pointer",
                        fontSize: 12,
                        fontWeight: 600,
                        display: "flex",
                        alignItems: "center",
                        gap: 7,
                        transition: "background 0.15s",
                      }}
                      onMouseEnter={(e) => (e.currentTarget.style.background = "rgba(255,253,231,0.22)")}
                      onMouseLeave={(e) => (e.currentTarget.style.background = "rgba(255,253,231,0.12)")}
                    >
                      📝 Thêm ghi chú
                    </button>
                  </div>
                </div>
              )}
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

        {/* Delete Confirmation Modal */}
        {nodeToDelete && (
          <div
            style={{
              position: "fixed",
              inset: 0,
              background: "rgba(0,0,0,0.6)",
              backdropFilter: "blur(4px)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              zIndex: 9999,
            }}
            onClick={() => setNodeToDelete(null)}
          >
            <div
              className="glass"
              style={{
                width: 400,
                padding: 24,
                borderRadius: 12,
                border: "1px solid var(--border)",
                boxShadow: "0 8px 32px rgba(0,0,0,0.5)",
                display: "flex",
                flexDirection: "column",
                gap: 16,
              }}
              onClick={(e) => e.stopPropagation()}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <div
                  style={{
                    width: 36,
                    height: 36,
                    borderRadius: "50%",
                    background: "rgba(248,81,73,0.1)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    color: "var(--accent-red)",
                  }}
                >
                  <AlertTriangle size={18} />
                </div>
                <div style={{ fontSize: 16, fontWeight: 700, color: "var(--text-primary)" }}>
                  Xác nhận xoá Knowledge Component
                </div>
              </div>

              <div style={{ fontSize: 13, color: "var(--text-secondary)", lineHeight: 1.5 }}>
                Bạn có chắc chắn muốn xoá KC <strong>{(nodeToDelete.data as any).name}</strong> (<code>{(nodeToDelete.data as any).code}</code>) không?
                <br />
                <span style={{ color: "var(--accent-red)", fontWeight: 500, display: "inline-block", marginTop: 6 }}>
                  ⚠ Thao tác này sẽ xoá tất cả câu hỏi và liên kết liên quan!
                </span>
              </div>

              <div style={{ display: "flex", gap: 12, justifyContent: "flex-end", marginTop: 8 }}>
                <button
                  className="btn btn-secondary"
                  onClick={() => setNodeToDelete(null)}
                  style={{ padding: "8px 16px" }}
                >
                  Huỷ (Esc)
                </button>
                <button
                  className="btn btn-danger"
                  onClick={executeNodeDelete}
                  style={{ padding: "8px 16px", background: "var(--accent-red)", color: "#fff" }}
                >
                  Xoá (Enter)
                </button>
              </div>
            </div>
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
