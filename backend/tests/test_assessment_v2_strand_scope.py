from app.engines.assessment_v2.strand_scope import (
    STRAND_G6_ALGEBRA,
    STRAND_G6_GEOMETRY_DEFERRED,
    STRAND_REVIEW_REQUIRED,
    propose_g6_strands,
)


def test_propose_g6_algebra_scope_is_conservative_about_geometry_and_bridges():
    graph = {
        "nodes": [
            {"id": "a", "code": "G6-MATH-UCLN", "name": "Tim uoc chung lon nhat", "grade": 6},
            {"id": "b", "code": "G6-MATH-BCNN", "name": "Tim boi chung nho nhat", "grade": 6},
            {"id": "g", "code": "G6-MATH-GOC", "name": "Ve goc bang thuoc do", "grade": 6},
            {"id": "x", "code": "G6-MATH-DO-LUONG", "name": "Ti so do dai doan thang", "grade": 6},
            {"id": "g7", "code": "G7-MATH-SO-HUU-TI", "name": "So huu ti", "grade": 7},
        ],
        "edges": [
            {"source": "a", "target": "b", "edge_type": "prerequisite"},
            {"source": "b", "target": "x", "edge_type": "prerequisite"},
            {"source": "g", "target": "x", "edge_type": "prerequisite"},
            {"source": "x", "target": "g7", "edge_type": "prerequisite"},
        ],
    }

    assignments = propose_g6_strands(graph)

    assert assignments["a"].strand == STRAND_G6_ALGEBRA
    assert assignments["g"].strand == STRAND_G6_GEOMETRY_DEFERRED
    assert assignments["x"].strand == STRAND_REVIEW_REQUIRED
    assert "g7" not in assignments
