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


def test_assessment_mode_does_not_repeat_same_kc_after_one_probe():
    engine = _engine()
    run = engine.new_run()
    first = engine.select_next(run)
    assert first is not None

    engine.apply_response(run, first, DiagnosticResponse(item_id=first.id, correct=True, student_answer="5/6"))
    second = engine.select_next(run)

    assert second is not None
    assert second.kc_id != first.kc_id


def test_assessment_mode_can_confirm_after_breadth_is_exhausted():
    engine = V2DiagnosticEngine(
        nodes=[{"id": "a", "code": "A", "name": "A"}],
        edges=[],
        items=[
            DiagnosticItem(id="item-a-1", kc_id="a", format_type="mcq", difficulty_label="anchor", content={"answer_type": "choice", "accepted_answers": ["1"]}),
            DiagnosticItem(id="item-a-2", kc_id="a", format_type="mcq", difficulty_label="medium", content={"answer_type": "choice", "accepted_answers": ["2"]}),
        ],
    )
    run = engine.new_run()
    first = engine.select_next(run)
    assert first is not None

    engine.apply_response(run, first, DiagnosticResponse(item_id=first.id, correct=True, student_answer="1"))
    second = engine.select_next(run)

    assert second is not None
    assert second.kc_id == "a"
    assert second.id != first.id
    assert run.frontier_history[-1]["reason"] == "confirmation_after_breadth"


def test_assessment_mode_uses_bkt_wrong_and_unknown_is_strong_penalty():
    engine = _engine()
    run_wrong = engine.new_run()
    item = engine.items_by_kc["a"][0]

    engine.apply_response(run_wrong, item, DiagnosticResponse(item_id=item.id, correct=False, student_answer="wrong"))
    assert round(run_wrong.states["a"].p_mastery, 2) == 0.14
    assert run_wrong.states["a"].label == "tested_gap"
    assert run_wrong.state_transitions[-1]["changes"][0]["reason"] == "bkt_direct_wrong"

    run_unknown = engine.new_run()
    engine.apply_response(
        run_unknown,
        item,
        DiagnosticResponse(item_id=item.id, correct=False, student_answer="không biết", response_type="unknown"),
    )
    assert round(run_unknown.states["a"].p_mastery, 2) == 0.02
    assert run_unknown.states["a"].label == "tested_gap"


def test_probability_band_is_reported_for_uncertain_and_likely_states():
    state = _engine().new_run().states["a"]
    assert state.probability_band == "uncertain"
    assert state.to_dict()["probability_band"] == "uncertain"


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
