from app.engines.assessment_v2.diagnostic_engine import (
    DiagnosticItem,
    DiagnosticResponse,
    V2DiagnosticEngine,
)


def _engine():
    nodes = [
        {"id": "a", "code": "G6-MATH-PHAN-SO", "name": "Nhan biet phan so"},
        {"id": "b", "code": "G6-MATH-QUY-DONG", "name": "Quy dong mau"},
        {"id": "c", "code": "G6-MATH-CONG-PHAN-SO", "name": "Cong phan so khac mau"},
    ]
    edges = [
        {"source": "a", "target": "b", "edge_type": "prerequisite"},
        {"source": "b", "target": "c", "edge_type": "prerequisite"},
    ]
    items = [
        DiagnosticItem(
            id="item-c-strong",
            kc_id="c",
            format_type="open",
            difficulty_label="anchor",
            is_diagnostic_anchor=True,
            content={
                "question": "1/2 + 1/3 = ?",
                "answer_type": "fraction",
                "accepted_answers": ["5/6"],
                "requires_kcs": ["a", "b"],
                "diagnoses_kcs": ["b"],
                "inference_strength": "strong",
                "academic_reviewed": True,
            },
        ),
        DiagnosticItem(
            id="item-a-mcq",
            kc_id="a",
            format_type="mcq",
            difficulty_label="anchor",
            is_diagnostic_anchor=True,
            content={"question": "Which is a fraction?"},
        ),
    ]
    return V2DiagnosticEngine(nodes, edges, items)


def test_strong_open_correct_infers_prerequisites_mastered():
    engine = _engine()
    run = engine.new_run()
    item = engine.items_by_kc["c"][0]

    engine.apply_response(run, item, DiagnosticResponse(item_id=item.id, correct=True, student_answer="5/6"))

    assert run.states["a"].label == "inferred_mastered"
    assert run.states["b"].label == "inferred_mastered"
    reasons = [change["reason"] for change in run.state_transitions[-1]["changes"]]
    assert "strong_open_requires:item-c-strong" in reasons


def test_strong_open_wrong_can_diagnose_targeted_gap():
    engine = _engine()
    run = engine.new_run()
    item = engine.items_by_kc["c"][0]

    engine.apply_response(run, item, DiagnosticResponse(item_id=item.id, correct=False, student_answer="2/5"))

    assert run.states["b"].label == "inferred_gap"
    reasons = [change["reason"] for change in run.state_transitions[-1]["changes"]]
    assert "strong_open_diagnoses:item-c-strong" in reasons


def test_unreviewed_open_item_does_not_apply_strong_inference():
    item = DiagnosticItem(
        id="item-c-unreviewed",
        kc_id="c",
        format_type="open",
        difficulty_label="anchor",
        is_diagnostic_anchor=True,
        content={
            "question": "1/2 + 1/3 = ?",
            "answer_type": "fraction",
            "accepted_answers": ["5/6"],
            "requires_kcs": ["a", "b"],
            "inference_strength": "strong",
            "academic_reviewed": False,
        },
    )
    engine = V2DiagnosticEngine(
        nodes=[
            {"id": "a", "code": "A", "name": "A"},
            {"id": "b", "code": "B", "name": "B"},
            {"id": "c", "code": "C", "name": "C"},
        ],
        edges=[
            {"source": "a", "target": "b", "edge_type": "prerequisite"},
            {"source": "b", "target": "c", "edge_type": "prerequisite"},
        ],
        items=[item],
    )
    run = engine.new_run()

    engine.apply_response(run, item, DiagnosticResponse(item_id=item.id, correct=True))

    assert run.states["a"].label == "unknown"
    assert run.states["b"].label == "unknown"
    reasons = [change["reason"] for change in run.state_transitions[-1]["changes"]]
    assert "strong_open_requires:item-c-unreviewed" not in reasons
