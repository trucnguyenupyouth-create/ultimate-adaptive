"""
Conservative strand proposal for Grade 6 Assessment V2.

This does not write to the database and does not claim academic truth. It only
produces reviewable proposals from graph structure plus transparent textual
signals. Final strand approval should be done by curriculum owners.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any

import networkx as nx


STRAND_G6_ALGEBRA = "g6_algebra"
STRAND_G6_GEOMETRY_DEFERRED = "g6_geometry_visual_deferred"
STRAND_REVIEW_REQUIRED = "review_required"

GEOMETRY_TERMS = (
    "hinh", "hình", "diem", "điểm", "duong", "đường", "doan", "đoạn",
    "tia", "goc", "góc", "tam giac", "tam giác", "tron", "tròn",
    "thang", "thẳng", "song song", "vuong goc", "vuông góc",
)
GEOMETRY_DEFER_TERMS = (
    "ve ", "vẽ ", "do bang thuoc", "đo bằng thước", "thuoc do", "thước đo",
    "compa", "hinh ve", "hình vẽ",
)
ALGEBRA_TERMS = (
    "so ", "số ", "phan so", "phân số", "thap phan", "thập phân",
    "uoc", "ước", "boi", "bội", "ucln", "bcnn", "luy thua", "lũy thừa",
    "bieu thuc", "biểu thức", "phep tinh", "phép tính", "ti le", "tỉ lệ",
    "ti so", "tỉ số", "phan tram", "phần trăm", "du lieu", "dữ liệu",
    "xac suat", "xác suất", "bang thong ke", "bảng thống kê",
)


@dataclass(frozen=True)
class StrandAssignment:
    kc_id: str
    strand: str
    confidence: float
    review_status: str = "proposed"
    reasons: list[str] = field(default_factory=list)
    neighbor_counts: dict[str, int] = field(default_factory=dict)


def _text(kc: dict[str, Any]) -> str:
    pieces = [kc.get("code"), kc.get("name"), kc.get("chapter_info")]
    return " ".join(str(part or "").lower() for part in pieces)


def _contains_any(text: str, terms: tuple[str, ...]) -> bool:
    return any(term in text for term in terms)


def _hard_graph_from_dict(graph: dict[str, Any]) -> nx.DiGraph:
    g = nx.DiGraph()
    for node in graph.get("nodes", []):
        if int(node.get("grade") or 0) == 6:
            g.add_node(str(node["id"]), **node)
    for edge in graph.get("edges", []):
        source = str(edge.get("source") or edge.get("prereq_id"))
        target = str(edge.get("target") or edge.get("kc_id"))
        if source in g and target in g and edge.get("edge_type", "prerequisite") == "prerequisite":
            g.add_edge(source, target)
    return g


def propose_g6_strands(graph: dict[str, Any]) -> dict[str, StrandAssignment]:
    """
    Propose Grade 6 algebra/non-geometry scope.

    Edge-first principle in this first implementation:
    - textual seeds identify obvious geometry and obvious algebra/statistics;
    - neighbor context is used to detect bridges/mixed areas;
    - mixed nodes are marked review_required instead of forced into algebra.
    """
    g = _hard_graph_from_dict(graph)
    seed: dict[str, str] = {}
    deferred: set[str] = set()

    for kc_id, data in g.nodes(data=True):
        text = _text(data)
        if _contains_any(text, GEOMETRY_DEFER_TERMS):
            deferred.add(kc_id)
            seed[kc_id] = STRAND_G6_GEOMETRY_DEFERRED
        elif _contains_any(text, GEOMETRY_TERMS):
            seed[kc_id] = STRAND_G6_GEOMETRY_DEFERRED
        elif _contains_any(text, ALGEBRA_TERMS):
            seed[kc_id] = STRAND_G6_ALGEBRA

    assignments: dict[str, StrandAssignment] = {}
    for kc_id, data in g.nodes(data=True):
        neighbors = set(g.predecessors(kc_id)) | set(g.successors(kc_id))
        algebra_neighbors = sum(1 for n in neighbors if seed.get(n) == STRAND_G6_ALGEBRA)
        geometry_neighbors = sum(1 for n in neighbors if seed.get(n) == STRAND_G6_GEOMETRY_DEFERRED)
        neighbor_counts = {"algebra": algebra_neighbors, "geometry_or_deferred": geometry_neighbors}
        reasons: list[str] = []

        if kc_id in deferred:
            assignments[kc_id] = StrandAssignment(
                kc_id=kc_id,
                strand=STRAND_G6_GEOMETRY_DEFERRED,
                confidence=0.95,
                reasons=["visual_geometry_term"],
                neighbor_counts=neighbor_counts,
            )
            continue

        own_seed = seed.get(kc_id)
        if own_seed == STRAND_G6_GEOMETRY_DEFERRED:
            reasons.append("geometry_text_signal")
        elif own_seed == STRAND_G6_ALGEBRA:
            reasons.append("algebra_or_data_text_signal")

        if own_seed == STRAND_G6_ALGEBRA and geometry_neighbors == 0:
            assignments[kc_id] = StrandAssignment(
                kc_id=kc_id,
                strand=STRAND_G6_ALGEBRA,
                confidence=0.85 if algebra_neighbors else 0.75,
                reasons=reasons + ["no_geometry_neighbor_signal"],
                neighbor_counts=neighbor_counts,
            )
        elif own_seed == STRAND_G6_ALGEBRA and algebra_neighbors >= geometry_neighbors + 2:
            assignments[kc_id] = StrandAssignment(
                kc_id=kc_id,
                strand=STRAND_G6_ALGEBRA,
                confidence=0.70,
                reasons=reasons + ["mostly_algebra_neighbors"],
                neighbor_counts=neighbor_counts,
            )
        elif own_seed == STRAND_G6_GEOMETRY_DEFERRED and algebra_neighbors == 0:
            assignments[kc_id] = StrandAssignment(
                kc_id=kc_id,
                strand=STRAND_G6_GEOMETRY_DEFERRED,
                confidence=0.85,
                reasons=reasons + ["no_algebra_neighbor_signal"],
                neighbor_counts=neighbor_counts,
            )
        else:
            assignments[kc_id] = StrandAssignment(
                kc_id=kc_id,
                strand=STRAND_REVIEW_REQUIRED,
                confidence=0.40,
                reasons=reasons + ["mixed_or_insufficient_graph_evidence"],
                neighbor_counts=neighbor_counts,
            )

    return assignments


def algebra_scope_ids(assignments: dict[str, StrandAssignment], include_review_required: bool = False) -> set[str]:
    allowed = {STRAND_G6_ALGEBRA}
    if include_review_required:
        allowed.add(STRAND_REVIEW_REQUIRED)
    return {kc_id for kc_id, assignment in assignments.items() if assignment.strand in allowed}
