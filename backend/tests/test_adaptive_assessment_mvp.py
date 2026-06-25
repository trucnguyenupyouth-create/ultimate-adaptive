from app.engines.assessment import CATController
from app.engines.knowledge_graph import KCNode, KnowledgeGraph


def build_mvp_graph() -> KnowledgeGraph:
    kg = KnowledgeGraph()
    for node_id in ["A", "B", "C", "D", "E", "F", "G", "H"]:
        kg.add_kc(KCNode(id=node_id, code=node_id, name=f"KC {node_id}", grade=6))

    for child, parent in [
        ("B", "A"),
        ("C", "A"),
        ("D", "B"),
        ("E", "C"),
        ("F", "D"),
        ("F", "E"),
        ("G", "C"),
        ("H", "G"),
    ]:
        kg.add_prerequisite(kc_id=child, prereq_id=parent)
    return kg


def make_items(kc_ids: list[str]) -> dict[str, list[dict]]:
    return {
        kc_id: [
            {
                "id": f"{kc_id}-anchor",
                "kc_id": kc_id,
                "content": {},
                "irt_a": 1.4,
                "irt_b": 0.0,
                "irt_c": 0.25,
                "difficulty_label": "anchor",
                "is_diagnostic_anchor": True,
            },
            {
                "id": f"{kc_id}-easy",
                "kc_id": kc_id,
                "content": {},
                "irt_a": 1.0,
                "irt_b": -1.0,
                "irt_c": 0.25,
                "difficulty_label": "easy",
                "is_diagnostic_anchor": False,
            },
            {
                "id": f"{kc_id}-hard",
                "kc_id": kc_id,
                "content": {},
                "irt_a": 1.0,
                "irt_b": 1.0,
                "irt_c": 0.25,
                "difficulty_label": "hard",
                "is_diagnostic_anchor": False,
            },
        ]
        for kc_id in kc_ids
    }


def test_bounded_mvp_simulation_classifies_multiple_kcs_without_ai():
    kg = build_mvp_graph()
    cat = CATController(kg)
    cat.MAX_ITEMS = 10
    items = make_items(["A", "B", "C", "D", "E", "F", "G", "H"])
    mastered_truth = {"A", "B", "C", "G"}

    result = cat.start("safe-deterministic-student", known_kcs=set(), theta=0.0, available_items=items)
    served_item_ids: list[str] = []
    while result["status"] != "done":
        item = result["item"]
        served_item_ids.append(item["id"])
        result = cat.respond(
            result["session"],
            item,
            correct=item["kc_id"] in mastered_truth,
            available_items=items,
        )

    assessment = result["result"]
    tested_count = len(assessment["tested_mastered"]) + len(assessment["tested_gaps"])

    assert assessment["total_items"] == 10
    assert tested_count >= 4
    assert len(set(served_item_ids)) == len(served_item_ids)
    assert assessment["tested_mastered"]
    assert assessment["tested_gaps"]
    assert assessment["unknown"]

    first_decision = assessment["frontier_history"][0]["candidates"][0]
    assert first_decision["expected_gain"] > 0
    assert "p_correct" in first_decision
    assert "response_balance" in first_decision

