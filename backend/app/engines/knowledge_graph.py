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
    Two-layer directed graph over knowledge components.

    _G       — HARD prerequisite edges only (edge_type == "prerequisite").
               Must be a DAG. Used for:
                 • Cycle detection (reject any new prerequisite that creates a cycle)
                 • Assessment navigation (find_starting_kc, navigate)
                 • KST inference (ancestors/descendants = mastered → mastered above)

    _G_full  — ALL edges (prerequisite + inference + unsure).
               No cycle constraint. Used for:
                 • Frontend visualisation (to_dict)
                 • Any soft-link analysis that needs the full picture

    Rationale:
        inference edges model "if student knows A, they likely know B" — a
        probabilistic observation, NOT a pedagogical requirement. A cycle
        A → B (inference) → A is perfectly valid ("knowing either suggests
        the other"). Forcing DAG validation on them would wrongly reject
        legitimate soft links.

        unsure edges are editorial bookmarks; they carry no semantic
        constraint at all.
    """

    # Hard prerequisite graph — DAG enforced
    _G: nx.DiGraph = field(default_factory=nx.DiGraph, init=False, repr=False)
    # Full graph — all edge types, no cycle constraint
    _G_full: nx.DiGraph = field(default_factory=nx.DiGraph, init=False, repr=False)

    # ── Build ──────────────────────────────────────────────────────────────

    def add_kc(self, kc: KCNode) -> None:
        self._G.add_node(kc.id, **kc.__dict__)
        self._G_full.add_node(kc.id, **kc.__dict__)

    def add_prerequisite(
        self,
        kc_id: str,
        prereq_id: str,
        label: str | None = None,
        weight: float = 1.0,
        edge_type: str = "prerequisite",
    ) -> None:
        """
        Add a directed edge prereq_id → kc_id.

        • edge_type == "prerequisite":
            Hard dependency — A must be mastered before B.
            Cycle check is enforced on _G.
            Raises ValueError if the edge would create a cycle.

        • edge_type == "inference" | "unsure":
            Soft/probabilistic link — no cycle check.
            Added to _G_full only; invisible to assessment logic.
        """
        if kc_id == prereq_id:
            raise ValueError("A KC cannot be its own prerequisite.")

        common_attrs = dict(label=label, weight=weight, edge_type=edge_type)

        if edge_type == "prerequisite":
            # Test on a copy before mutating _G
            test_G = self._G.copy()
            test_G.add_edge(prereq_id, kc_id)
            if not nx.is_directed_acyclic_graph(test_G):
                raise ValueError(
                    f"Adding prerequisite {prereq_id} → {kc_id} would create a cycle."
                )
            self._G.add_edge(prereq_id, kc_id, **common_attrs)

        # All types go into the full graph (no cycle constraint)
        self._G_full.add_edge(prereq_id, kc_id, **common_attrs)

    def remove_prerequisite(self, kc_id: str, prereq_id: str) -> None:
        if self._G.has_edge(prereq_id, kc_id):
            self._G.remove_edge(prereq_id, kc_id)
        if self._G_full.has_edge(prereq_id, kc_id):
            self._G_full.remove_edge(prereq_id, kc_id)

    def load_from_dicts(
        self,
        kcs: list[dict],
        prerequisites: list[dict]  # [{kc_id, prereq_id, label, weight, edge_type?}, ...]
    ) -> None:
        """Bulk load from DB query results."""
        for kc in kcs:
            self._G.add_node(kc["id"], **kc)
            self._G_full.add_node(kc["id"], **kc)
        for edge in prerequisites:
            etype = edge.get("edge_type", "prerequisite")
            attrs = dict(
                label=edge.get("label"),
                weight=edge.get("weight", 1.0),
                edge_type=etype,
            )
            # Only hard prerequisites go into _G (DAG layer)
            if etype == "prerequisite":
                self._G.add_edge(edge["prereq_id"], edge["kc_id"], **attrs)
            # All edges go into _G_full (visualisation layer)
            self._G_full.add_edge(edge["prereq_id"], edge["kc_id"], **attrs)

    # ── Validation ────────────────────────────────────────────────────────

    def validate_dag(self) -> bool:
        """Returns True if the hard-prerequisite graph is a valid DAG (no cycles)."""
        return nx.is_directed_acyclic_graph(self._G)

    def health_check(self) -> dict:
        """
        Returns graph health stats for the CMS dashboard.
        Warns about:
          - Isolated nodes (no edges)
          - Potential dead-ends (no successors = leaf nodes in prerequisite tree)
        """
        nodes = list(self._G_full.nodes())
        return {
            "total_kcs": len(nodes),
            "total_edges": self._G_full.number_of_edges(),
            "prerequisite_edges": self._G.number_of_edges(),
            "inference_edges": sum(
                1 for _, _, d in self._G_full.edges(data=True)
                if d.get("edge_type") in ("inference", "unsure")
            ),
            "is_dag": self.validate_dag(),
            "root_kcs": [n for n in nodes if self._G.in_degree(n) == 0],   # no hard prerequisites
            "leaf_kcs": [n for n in nodes if self._G.out_degree(n) == 0],  # no hard successors
            "isolated_kcs": list(nx.isolates(self._G_full)),
        }

    # ── Assessment Entry ──────────────────────────────────────────────────

    def find_starting_kc(self, known_kcs: set[str]) -> Optional[str]:
        """
        KST: find the best KC to start assessment from.

        Strategy for NEW STUDENT (known_kcs = ∅):
          - Drop the prerequisite eligibility filter entirely
          - Score each KC by: total_ancestors + total_descendants
            → Maximises both-way connectivity = true "middle" of graph
            → Node with highest betweenness-like score divides graph most evenly
            → Answering it correctly unlocks the most knowledge above
            → Answering it incorrectly reveals the most remediable gaps below
          - This avoids starting at a root (dead-end on fail) or leaf (useless on pass)

        Strategy for RETURNING STUDENT (known_kcs non-empty):
          - Eligible KCs = only KCs where ALL direct prerequisites are in known_kcs
            (student has the prerequisite foundation to attempt them)
          - Score: fulfilled_ancestors + unmastered_descendants
            → Picks the KC at the frontier of current knowledge

        Returns None if no eligible KC found (e.g. empty graph or all mastered).
        """
        if len(self._G) == 0:
            return None

        is_new_student = len(known_kcs) == 0
        best_kc: Optional[str] = None
        best_score: int = -1

        for kc in self._G.nodes():
            if kc in known_kcs:
                continue

            if is_new_student:
                # For new students: score by ancestors × descendants (PRODUCT, not sum).
                #
                # Why product?
                #   - sum(anc + desc) rewards roots (0 anc + many desc = high sum)
                #     but roots are DEAD ENDS on fail — no remediation path.
                #   - product(anc × desc) = 0 when either side is 0.
                #     A root gets score 0 (dead end). A leaf gets score 0 (useless).
                #     Only true MIDDLE nodes (ancestors AND descendants > 0) score high.
                #
                # This is the "binary search on knowledge space" intuition:
                #   Best starting point = node that splits the graph most evenly.
                #   Pass → explore desc subtree above.
                #   Fail → diagnose anc subtree below.
                #   High product = both directions are meaningful.
                #
                # Equivalent to argmax of information gain in both directions.
                # Reference: ALEKS entry-point selection (Falmagne et al.)
                all_ancestors = len(nx.ancestors(self._G, kc))
                all_descendants = len(nx.descendants(self._G, kc))
                score = all_ancestors * all_descendants  # PRODUCT not sum
            else:
                # For returning students: must have all prerequisites fulfilled.
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
        if kc_id not in self._G_full:
            return None
        return dict(self._G_full.nodes[kc_id])

    def to_dict(self) -> dict:
        """Serialise graph to JSON-safe dict for frontend visualisation.

        Uses _G_full so that inference and unsure edges are included.
        The frontend needs all edge types to render the full graph picture.
        Assessment logic (find_starting_kc, navigate) continues to use _G
        (hard prerequisites only).
        """
        return {
            "nodes": [
                {"id": n, **self._G_full.nodes[n]}
                for n in self._G_full.nodes()
            ],
            "edges": [
                {
                    "source": u,
                    "target": v,
                    "label": self._G_full.edges[u, v].get("label"),
                    "weight": self._G_full.edges[u, v].get("weight", 1.0),
                    "edge_type": self._G_full.edges[u, v].get("edge_type", "prerequisite"),
                }
                for u, v in self._G_full.edges()
            ],
        }

    def __len__(self) -> int:
        """Total number of KCs (nodes) in the graph."""
        return len(self._G_full)
