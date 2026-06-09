"""
KnowledgeGraph Engine — Layer 0

Implements KST (Knowledge Space Theory) graph operations:
  - find_starting_kc(): middle-node selection for assessment entry
  - navigate(): up/down traversal based on pass/fail
  - validate_dag(): cycle detection (runs before any edge insert)

This engine operates on plain Python dicts loaded from DB.
It does NOT touch SQLAlchemy sessions — that's the service layer's job.

All graph ops are synchronous (NetworkX is CPU-bound, not I/O-bound).
Call from async context via asyncio.to_thread() if needed.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Optional
import networkx as nx


@dataclass
class KCNode:
    id: str
    code: str
    name: str
    grade: int
    subject: str = "math"
    chapter_info: Optional[str] = None


@dataclass
class KnowledgeGraph:
    """
    Directed Acyclic Graph where edge A → B means:
      "A is a prerequisite of B"
      (you must master A before attempting B)

    Usage:
        kg = KnowledgeGraph()
        kg.add_kc(KCNode(id="uuid-1", code="G9-ALG-PT1", name="Phương trình bậc 1", grade=9))
        kg.add_prerequisite(kc_id="uuid-2", prereq_id="uuid-1")  # uuid-1 must come before uuid-2
        start = kg.find_starting_kc(known_kcs=set())
    """

    _G: nx.DiGraph = field(default_factory=nx.DiGraph, init=False, repr=False)

    # ── Build ──────────────────────────────────────────────────────────────

    def add_kc(self, kc: KCNode) -> None:
        self._G.add_node(kc.id, **kc.__dict__)

    def add_prerequisite(self, kc_id: str, prereq_id: str, label: str | None = None, weight: float = 1.0) -> None:
        """
        Add edge prereq_id → kc_id  (prereq must be mastered before kc).
        Raises ValueError if this would create a cycle.
        """
        if kc_id == prereq_id:
            raise ValueError("A KC cannot be its own prerequisite.")
        # Test on a copy before mutating
        test_G = self._G.copy()
        test_G.add_edge(prereq_id, kc_id)
        if not nx.is_directed_acyclic_graph(test_G):
            raise ValueError(
                f"Adding prerequisite {prereq_id} → {kc_id} would create a cycle."
            )
        self._G.add_edge(prereq_id, kc_id, label=label, weight=weight)

    def remove_prerequisite(self, kc_id: str, prereq_id: str) -> None:
        if self._G.has_edge(prereq_id, kc_id):
            self._G.remove_edge(prereq_id, kc_id)

    def load_from_dicts(
        self,
        kcs: list[dict],
        prerequisites: list[dict]  # [{kc_id, prereq_id, label, weight}, ...]
    ) -> None:
        """Bulk load from DB query results."""
        for kc in kcs:
            self._G.add_node(kc["id"], **kc)
        for edge in prerequisites:
            # Direct add (already validated in DB on insert)
            self._G.add_edge(
                edge["prereq_id"],
                edge["kc_id"],
                label=edge.get("label"),
                weight=edge.get("weight", 1.0)
            )

    # ── Validation ────────────────────────────────────────────────────────

    def validate_dag(self) -> bool:
        """Returns True if graph is a valid DAG (no cycles)."""
        return nx.is_directed_acyclic_graph(self._G)

    def health_check(self) -> dict:
        """
        Returns graph health stats for the CMS dashboard.
        Warns about:
          - Isolated nodes (no edges)
          - Potential dead-ends (no successors = leaf nodes in prerequisite tree)
        """
        nodes = list(self._G.nodes())
        return {
            "total_kcs": len(nodes),
            "total_edges": self._G.number_of_edges(),
            "is_dag": self.validate_dag(),
            "root_kcs": [n for n in nodes if self._G.in_degree(n) == 0],   # no prerequisites
            "leaf_kcs": [n for n in nodes if self._G.out_degree(n) == 0],  # no successors
            "isolated_kcs": list(nx.isolates(self._G)),
        }

    # ── Assessment Entry ──────────────────────────────────────────────────

    def find_starting_kc(self, known_kcs: set[str]) -> Optional[str]:
        """
        KST: find the best KC to start assessment from.

        Strategy:
          1. Eligible KCs = KCs where ALL direct prerequisites are in known_kcs
             (student has the foundation to attempt them)
          2. Score each eligible KC:
             score = fulfilled_ancestors + unmastered_descendants
             → maximise: pick the KC in the "middle" of the graph
               - many fulfilled ancestors = student has solid foundation below it
               - many unmastered descendants = lots of knowledge unlocked above it
          3. For new student (known_kcs = ∅):
             only root KCs are eligible → pick most central root (most descendants)

        Returns None if no eligible KC found (e.g. empty graph or all mastered).
        """
        if len(self._G) == 0:
            return None

        best_kc: Optional[str] = None
        best_score: int = -1

        for kc in self._G.nodes():
            if kc in known_kcs:
                continue

            # Check all direct prerequisites are fulfilled
            direct_prereqs = list(self._G.predecessors(kc))
            if not all(p in known_kcs for p in direct_prereqs):
                continue  # not eligible — missing prerequisites

            fulfilled_ancestors = sum(
                1 for a in nx.ancestors(self._G, kc) if a in known_kcs
            )
            unmastered_descendants = sum(
                1 for d in nx.descendants(self._G, kc) if d not in known_kcs
            )
            score = fulfilled_ancestors + unmastered_descendants

            if score > best_score:
                best_score = score
                best_kc = kc

        return best_kc

    # ── Navigation ────────────────────────────────────────────────────────

    def navigate(
        self,
        current_kc: str,
        passed: bool,
        known_kcs: set[str],
    ) -> Optional[str]:
        """
        KST navigation after a KC pass/fail decision.

        Pass → look UP: find an eligible successor KC
               (successor whose all prerequisites are now fulfilled)
        Fail → look DOWN: find an unmastered prerequisite KC to remediate

        Priority: KC with most descendants (most "blocking" knowledge).
        Returns None when:
          - Pass: no more successors (student reached top of their known graph)
          - Fail: no unmastered prerequisites (fundamental gap at root level)
        """
        if passed:
            updated_known = known_kcs | {current_kc}
            candidates = [
                s for s in self._G.successors(current_kc)
                if s not in updated_known
                and all(p in updated_known for p in self._G.predecessors(s))
            ]
        else:
            candidates = [
                p for p in self._G.predecessors(current_kc)
                if p not in known_kcs
            ]

        if not candidates:
            return None

        # Pick KC with the most descendants (most impactful — clears the most path)
        return max(candidates, key=lambda k: len(nx.descendants(self._G, k)))

    # ── Utilities ─────────────────────────────────────────────────────────

    def get_prerequisites_recursive(self, kc_id: str) -> list[str]:
        """All ancestors of a KC (recursive prerequisites)."""
        return list(nx.ancestors(self._G, kc_id))

    def get_successors_recursive(self, kc_id: str) -> list[str]:
        """All descendants of a KC (everything this KC unlocks)."""
        return list(nx.descendants(self._G, kc_id))

    def get_kc_info(self, kc_id: str) -> Optional[dict]:
        """Node attributes for a KC."""
        if kc_id not in self._G:
            return None
        return dict(self._G.nodes[kc_id])

    def to_dict(self) -> dict:
        """Serialise graph to JSON-safe dict for frontend visualisation."""
        return {
            "nodes": [
                {"id": n, **self._G.nodes[n]}
                for n in self._G.nodes()
            ],
            "edges": [
                {
                    "source": u,
                    "target": v,
                    "label": self._G.edges[u, v].get("label"),
                    "weight": self._G.edges[u, v].get("weight", 1.0)
                }
                for u, v in self._G.edges()
            ],
        }

    def __len__(self) -> int:
        return len(self._G)
