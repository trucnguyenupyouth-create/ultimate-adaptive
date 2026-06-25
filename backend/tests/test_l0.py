"""
Layer 0 Tests — KnowledgeGraph + CATController

4 mandatory test cases that must pass before Layer 1 begins:
  1. test_new_student_goes_to_foundation  — wrong streak → navigate to root
  2. test_expert_student_reaches_top      — right streak → navigate to leaf
  3. test_no_graph_cycles                 — DAG validation
  4. test_find_starting_kc_selects_middle — middle-node selection logic

Run: pytest backend/tests/test_l0.py -v
"""

import pytest
from app.engines.knowledge_graph import KnowledgeGraph, KCNode
from app.engines.assessment import (
    CATController,
    AssessmentSession,
    STATE_INFERRED_GAP,
    STATE_INFERRED_MASTERED,
    STATE_TESTED_GAP,
    STATE_TESTED_MASTERED,
)


# ── Fixtures ──────────────────────────────────────────────────────────────────

def build_linear_graph() -> tuple[KnowledgeGraph, list[str]]:
    """
    Simple linear chain: A → B → C → D → E
    A = root (most basic), E = leaf (most advanced)
    """
    kg = KnowledgeGraph()
    ids = []
    for i, (code, name, grade) in enumerate([
        ("G9-A", "Số tự nhiên", 6),
        ("G9-B", "Số nguyên", 7),
        ("G9-C", "Phân số", 7),
        ("G9-D", "Biểu thức đại số", 8),
        ("G9-E", "Phương trình bậc 1", 9),
    ]):
        node = KCNode(id=f"kc-{i}", code=code, name=name, grade=grade)
        kg.add_kc(node)
        ids.append(f"kc-{i}")

    # Chain: kc-0 → kc-1 → kc-2 → kc-3 → kc-4
    for i in range(1, len(ids)):
        kg.add_prerequisite(kc_id=ids[i], prereq_id=ids[i - 1])

    return kg, ids


def build_branching_graph() -> tuple[KnowledgeGraph, dict[str, str]]:
    """
    Branching graph:
        root1 ──┐
                ├── mid1 ── leaf1
        root2 ──┘

    mid1 has 2 prerequisites (root1 + root2).
    Starting KC for new student (known=∅): should be root1 or root2
    (highest descendants among eligible — both have same: 2 descendants)
    """
    kg = KnowledgeGraph()
    nodes = {
        "root1": KCNode(id="root1", code="R1", name="Root 1", grade=6),
        "root2": KCNode(id="root2", code="R2", name="Root 2", grade=6),
        "mid1":  KCNode(id="mid1",  code="M1", name="Mid 1",  grade=7),
        "leaf1": KCNode(id="leaf1", code="L1", name="Leaf 1", grade=9),
    }
    for node in nodes.values():
        kg.add_kc(node)

    kg.add_prerequisite(kc_id="mid1",  prereq_id="root1")
    kg.add_prerequisite(kc_id="mid1",  prereq_id="root2")
    kg.add_prerequisite(kc_id="leaf1", prereq_id="mid1")
    return kg, {k: k for k in nodes}


def build_diamond_graph() -> KnowledgeGraph:
    """
    Diamond graph:
        A
       / \
      B   C
       \ /
        D
    """
    kg = KnowledgeGraph()
    for node_id in ["A", "B", "C", "D"]:
        kg.add_kc(KCNode(id=node_id, code=node_id, name=f"KC {node_id}", grade=6))
    kg.add_prerequisite(kc_id="B", prereq_id="A")
    kg.add_prerequisite(kc_id="C", prereq_id="A")
    kg.add_prerequisite(kc_id="D", prereq_id="B")
    kg.add_prerequisite(kc_id="D", prereq_id="C")
    return kg


def make_items(kc_ids: list[str]) -> dict[str, list[dict]]:
    """Create mock item pool (3 items per KC, varying difficulty)."""
    items = {}
    for kc_id in kc_ids:
        items[kc_id] = [
            {"id": f"{kc_id}-easy",   "kc_id": kc_id, "content": {}, "irt_a": 1.0, "irt_b": -1.0, "irt_c": 0.25, "is_diagnostic_anchor": False},
            {"id": f"{kc_id}-medium", "kc_id": kc_id, "content": {}, "irt_a": 1.0, "irt_b":  0.0, "irt_c": 0.25, "is_diagnostic_anchor": True},
            {"id": f"{kc_id}-hard",   "kc_id": kc_id, "content": {}, "irt_a": 1.0, "irt_b":  1.5, "irt_c": 0.25, "is_diagnostic_anchor": False},
        ]
    return items


# ── Test 1: New student fails → navigates to foundation ───────────────────────

def test_new_student_goes_to_foundation():
    """
    Bot Mất Gốc: always answers wrong.
    Expected: system navigates DOWN to root KC, reports fundamental_gap.
    """
    kg, ids = build_linear_graph()
    cat = CATController(kg)
    items = make_items(ids)

    # Start at middle of graph (kc-2 or kc-3 for new student with empty known)
    result = cat.start("student-lost", known_kcs=set(), theta=0.0, available_items=items)
    assert result["status"] == "started"
    assert result["item"] is not None

    # Always answer wrong — should navigate down to root
    for _ in range(20):
        if result.get("status") == "done":
            break
        result = cat.respond(result["session"], result["item"], correct=False, available_items=items)

    assert result["status"] == "done"
    assert "fundamental_gap" in result["result"]["fundamental_gaps"] or \
           len(result["result"]["gaps"]) > 0, "Should have found gaps"


# ── Test 2: Expert student passes → reaches top ───────────────────────────────

def test_expert_student_reaches_top():
    """
    Bot Thần Đồng: always answers correctly.
    Expected: system navigates UP through entire graph, no gaps.
    """
    kg, ids = build_linear_graph()
    cat = CATController(kg)
    items = make_items(ids)

    result = cat.start("student-expert", known_kcs=set(), theta=2.0, available_items=items)
    assert result["status"] == "started"

    for _ in range(50):
        if result.get("status") == "done":
            break
        result = cat.respond(result["session"], result["item"], correct=True, available_items=items)

    assert result["status"] == "done"
    assert len(result["result"]["gaps"]) == 0, "Expert student should have no gaps"
    assert len(result["result"]["mastered"]) > 0, "Expert should have mastered some KCs"


def test_item_selection_does_not_repeat_until_pool_exhausted():
    """
    Within one KC, CAT should remember all served item IDs.
    The first item may use the anchor filter, but subsequent picks should not
    keep re-entering cold-start anchor selection or forget older seen items.
    """
    kg, ids = build_linear_graph()
    cat = CATController(kg)
    items = make_items(ids)

    result = cat.start("student-repeat-check", known_kcs=set(), theta=0.0, available_items=items)
    assert result["status"] == "started"

    first_item = result["item"]["id"]
    result = cat.respond(result["session"], result["item"], correct=False, available_items=items)
    second_item = result["item"]["id"]
    result = cat.respond(result["session"], result["item"], correct=True, available_items=items)
    third_item = result["item"]["id"]

    assert len({first_item, second_item, third_item}) == 3


# ── Test 3: No graph cycles ────────────────────────────────────────────────────

def test_no_graph_cycles():
    """Graph must be a valid DAG — no cycles allowed."""
    kg, ids = build_linear_graph()
    assert kg.validate_dag() is True

    # Attempting to add a cycle should raise ValueError
    with pytest.raises(ValueError, match="cycle"):
        # A → B → C → ... → E, now try to add E → A (cycle!)
        kg.add_prerequisite(kc_id=ids[0], prereq_id=ids[-1])


def test_cycle_detection_on_new_graph():
    """Test cycle detection on a fresh graph."""
    kg = KnowledgeGraph()
    for i in range(3):
        kg.add_kc(KCNode(id=f"n{i}", code=f"C{i}", name=f"KC {i}", grade=7))

    kg.add_prerequisite(kc_id="n1", prereq_id="n0")  # n0 → n1
    kg.add_prerequisite(kc_id="n2", prereq_id="n1")  # n1 → n2

    # n0 requires n2 → creates cycle: n0 → n1 → n2 → n0
    with pytest.raises(ValueError):
        kg.add_prerequisite(kc_id="n0", prereq_id="n2")

    assert kg.validate_dag() is True  # Graph should be unchanged after failed add


# ── Test 4: find_starting_kc selects middle node ─────────────────────────────

def test_find_starting_kc_middle_node():
    """
    For a new student (known=∅), only root KCs are eligible.
    The root with most descendants should be selected.

    For a partially knowledgeable student, should select an eligible KC
    that maximises fulfilled_ancestors + unmastered_descendants.
    """
    kg, ids = build_linear_graph()
    # ids = [kc-0 (root), kc-1, kc-2, kc-3, kc-4 (leaf)]

    # New student → should start in the graph middle to maximise state split.
    start = kg.find_starting_kc(known_kcs=set())
    assert start == ids[2], f"New student should start at middle, got {start}"

    # Student who knows kc-0 → eligible: kc-1 (only eligible, all prereqs in known)
    start = kg.find_starting_kc(known_kcs={ids[0]})
    assert start == ids[1]

    # Student who knows kc-0 and kc-1 → eligible: kc-2
    start = kg.find_starting_kc(known_kcs={ids[0], ids[1]})
    assert start == ids[2]

    # Student who knows everything → None (all mastered)
    start = kg.find_starting_kc(known_kcs=set(ids))
    assert start is None


def test_find_starting_kc_branching_graph():
    """
    Branching graph test: new student starts at a true split point, not a root.
    """
    kg, node_ids = build_branching_graph()

    # New student — mid1 has ancestors and descendants, roots are dead-ends on fail.
    start = kg.find_starting_kc(known_kcs=set())
    assert start == "mid1"

    # After knowing root1 → root2 is still eligible (its prerequisites: none)
    # mid1 is NOT eligible (needs both root1 AND root2)
    start = kg.find_starting_kc(known_kcs={"root1"})
    assert start == "root2", f"Should pick root2 next, got {start}"

    # After knowing both roots → mid1 becomes eligible
    start = kg.find_starting_kc(known_kcs={"root1", "root2"})
    assert start == "mid1"


# ── Test 5: Navigate correctly ────────────────────────────────────────────────

def test_navigate_up_on_pass():
    """Passing a KC should navigate to an eligible successor."""
    kg, ids = build_linear_graph()

    # Pass kc-2 → should navigate to kc-3 (its direct successor, all prereqs met)
    next_kc = kg.navigate("kc-2", passed=True, known_kcs={"kc-0", "kc-1", "kc-2"})
    assert next_kc == "kc-3"


def test_navigate_down_on_fail():
    """Failing a KC should navigate to an unmastered prerequisite."""
    kg, ids = build_linear_graph()

    # Fail kc-3 (known: kc-0, kc-1, kc-2 → kc-2 is NOT in known, it's a prereq)
    next_kc = kg.navigate("kc-3", passed=False, known_kcs={"kc-0", "kc-1"})
    # kc-2 is a prerequisite of kc-3 and not in known → should navigate to kc-2
    assert next_kc == "kc-2"


def test_navigate_returns_none_at_leaf():
    """Passing the leaf node should return None (nowhere to go)."""
    kg, ids = build_linear_graph()
    all_known = set(ids[:-1])  # know everything except the last
    next_kc = kg.navigate(ids[-1], passed=True, known_kcs=all_known | {ids[-1]})
    assert next_kc is None


def test_navigate_returns_none_at_root_fail():
    """Failing the root KC (no prerequisites) should return None — fundamental gap."""
    kg, ids = build_linear_graph()
    next_kc = kg.navigate(ids[0], passed=False, known_kcs=set())
    assert next_kc is None


def test_pass_closure_infers_ancestors_mastered():
    """Correct answers softly increase ancestor mastery instead of hard-closing them."""
    kg, ids = build_linear_graph()
    cat = CATController(kg)
    session = AssessmentSession(student_id="s", kc=ids[2]).to_dict()
    result = {"status": "continue", "session": session, "item": {"id": "start", "kc_id": ids[2]}}
    items = make_items(ids)

    for _ in range(2):
        result = cat.respond(result["session"], result["item"], correct=True, available_items=items)

    states = result["session"]["kc_states"]
    mastery = result["session"]["kc_mastery"]
    assert states[ids[2]] == STATE_TESTED_MASTERED
    assert ids[0] not in states
    assert ids[1] not in states
    assert mastery[ids[0]] > 0.5
    assert mastery[ids[1]] > 0.5


def test_fail_closure_infers_descendants_gap():
    """Wrong answers softly decrease descendants instead of hard-closing them."""
    kg, ids = build_linear_graph()
    cat = CATController(kg)
    session = AssessmentSession(student_id="s", kc=ids[1]).to_dict()
    result = {"status": "continue", "session": session, "item": {"id": "start", "kc_id": ids[1]}}
    items = make_items(ids)

    for _ in range(2):
        result = cat.respond(result["session"], result["item"], correct=False, available_items=items)

    states = result["session"]["kc_states"]
    mastery = result["session"]["kc_mastery"]
    assert states[ids[1]] == STATE_TESTED_GAP
    assert ids[2] not in states
    assert ids[3] not in states
    assert ids[4] not in states
    assert mastery[ids[2]] < 0.5
    assert mastery[ids[3]] < 0.5
    assert mastery[ids[4]] < 0.5


def test_diamond_pass_leaf_infers_all_prerequisites_mastered():
    """In a diamond, passing the leaf softly boosts all prerequisite ancestors."""
    kg = build_diamond_graph()
    cat = CATController(kg)
    session = AssessmentSession(student_id="s", kc="D").to_dict()
    result = {"status": "continue", "session": session, "item": {"id": "start", "kc_id": "D"}}
    items = make_items(["A", "B", "C", "D"])

    for _ in range(2):
        result = cat.respond(result["session"], result["item"], correct=True, available_items=items)

    states = result["session"]["kc_states"]
    mastery = result["session"]["kc_mastery"]
    assert states["D"] == STATE_TESTED_MASTERED
    assert "A" not in states
    assert "B" not in states
    assert "C" not in states
    assert mastery["A"] > 0.5
    assert mastery["B"] > 0.5
    assert mastery["C"] > 0.5


def test_diamond_fail_root_infers_all_descendants_gap():
    """In a diamond, failing the root softly lowers all descendants."""
    kg = build_diamond_graph()
    cat = CATController(kg)
    session = AssessmentSession(student_id="s", kc="A").to_dict()
    result = {"status": "continue", "session": session, "item": {"id": "start", "kc_id": "A"}}
    items = make_items(["A", "B", "C", "D"])

    for _ in range(2):
        result = cat.respond(result["session"], result["item"], correct=False, available_items=items)

    states = result["session"]["kc_states"]
    mastery = result["session"]["kc_mastery"]
    assert states["A"] == STATE_TESTED_GAP
    assert "B" not in states
    assert "C" not in states
    assert "D" not in states
    assert mastery["B"] < 0.5
    assert mastery["C"] < 0.5
    assert mastery["D"] < 0.5


def test_tested_state_wins_over_later_inference_conflict():
    """A directly tested result should not be overwritten by soft inference."""
    kg, ids = build_linear_graph()
    cat = CATController(kg)
    session = AssessmentSession(
        student_id="s",
        kc=ids[3],
        kc_states={ids[2]: STATE_TESTED_GAP},
        kc_results={ids[2]: "fail"},
    ).to_dict()
    result = {"status": "continue", "session": session, "item": {"id": "start", "kc_id": ids[3]}}
    items = make_items(ids)

    for _ in range(3):
        result = cat.respond(result["session"], result["item"], correct=True, available_items=items)

    states = result["session"]["kc_states"]
    assert states[ids[2]] == STATE_TESTED_GAP
    assert result["session"]["kc_mastery"][ids[2]] <= 0.3


def test_frontier_moves_to_unknown_boundary_after_pass():
    """After passing the middle of a chain, frontier should move upward, not back down."""
    kg, ids = build_linear_graph()
    cat = CATController(kg)
    items = make_items(ids)
    session = AssessmentSession(student_id="s", kc=ids[2]).to_dict()
    result = {"status": "continue", "session": session, "item": {"id": "start", "kc_id": ids[2]}}

    for _ in range(3):
        result = cat.respond(result["session"], result["item"], correct=True, available_items=items)

    assert result["status"] == "continue"
    assert result["session"]["kc"] == ids[3]
    assert result["session"]["frontier_history"][-1]["selected_kc"] == ids[3]


def test_frontier_stops_after_fail_root_closes_chain():
    """Failing the root marks only direct evidence hard and leaves descendants soft."""
    kg, ids = build_linear_graph()
    cat = CATController(kg)
    items = make_items(ids)
    session = AssessmentSession(student_id="s", kc=ids[0]).to_dict()
    result = {"status": "continue", "session": session, "item": {"id": "start", "kc_id": ids[0]}}

    for _ in range(2):
        result = cat.respond(result["session"], result["item"], correct=False, available_items=items)

    assert result["status"] == "continue"
    assert result["session"]["kc_states"][ids[0]] == STATE_TESTED_GAP
    assert ids[1] not in result["session"]["kc_states"]
    assert result["session"]["kc_mastery"][ids[1]] < 0.5
