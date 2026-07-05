from __future__ import annotations

import json

from app.engines.assessment_v2.diagnostic_engine import (
    DiagnosticItem,
    DiagnosticResponse,
    DiagnosticRun,
    DiagnosticState,
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


def _g8_item(
    item_id: str,
    kc_id: str,
    *,
    role: str,
    family: str,
    surface: str,
    path: str = "linear_equation",
    requires: list[str] | None = None,
    diagnoses: list[str] | None = None,
    anchor: bool = False,
) -> DiagnosticItem:
    return DiagnosticItem(
        id=item_id,
        kc_id=kc_id,
        format_type="open",
        difficulty_label=role,
        is_diagnostic_anchor=anchor,
        content={
            "question": item_id,
            "official_assessment_scope": "grade8_exam_path",
            "target_exam_path": path,
            "item_role": role,
            "item_family": family,
            "surface_signature": surface,
            "answer_widget": "number",
            "checker_type": "numeric_equal",
            "accepted_answers": ["1"],
            "requires_kcs": requires or [],
            "diagnoses_kcs": diagnoses or [kc_id],
            "inference_strength": "weak",
            "academic_reviewed": False,
        },
    )


def _grade8_deep_dive_engine(extra_items: list[DiagnosticItem] | None = None) -> V2DiagnosticEngine:
    nodes = [
        {"id": "root", "code": "ROOT", "name": "Root prerequisite"},
        {"id": "mid", "code": "MID", "name": "Middle prerequisite"},
        {"id": "cap", "code": "CAP", "name": "Capstone transfer"},
        {"id": "other", "code": "OTHER", "name": "Other path"},
    ]
    edges = [
        {"source": "root", "target": "mid", "edge_type": "prerequisite"},
        {"source": "mid", "target": "cap", "edge_type": "prerequisite"},
    ]
    items = [
        _g8_item(
            "transfer-cap",
            "cap",
            role="transfer",
            family="solve_transfer",
            surface="transfer_surface",
            requires=["mid"],
            diagnoses=["mid"],
            anchor=True,
        ),
        _g8_item(
            "probe-mid",
            "mid",
            role="misconception",
            family="expand_probe",
            surface="probe_mid_surface",
            requires=["root"],
            diagnoses=["mid"],
        ),
        _g8_item(
            "anchor-root",
            "root",
            role="anchor",
            family="root_anchor",
            surface="root_anchor_surface",
            diagnoses=["root"],
        ),
        _g8_item(
            "other-item",
            "other",
            role="anchor",
            family="other_anchor",
            surface="other_surface",
            path="rational_expression",
            diagnoses=["other"],
        ),
    ]
    if extra_items:
        items.extend(extra_items)
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


def test_run_payload_is_json_serializable_after_frontier_selection():
    engine = _engine()
    run = engine.new_run()
    item = engine.select_next(run)
    assert item is not None
    frontier = run.frontier_history[-1]
    selected = frontier["top_candidates"][0]
    assert selected["selector_strategy"] == "state_space_eig"
    assert "information_gain" in selected
    assert "expected_entropy_after" in selected

    engine.apply_response(run, item, DiagnosticResponse(item_id=item.id, correct=True, student_answer="5/6"))

    json.dumps(run.to_dict())


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

    reasons = [change["reason"] for change in run.state_transitions[-1]["changes"]]
    assert "strong_open_requires:item-c-unreviewed" not in reasons
    assert any(reason.startswith("state_space_particle_update:") for reason in reasons)


def test_chain_particle_inference_pass_descendant_boosts_ancestors_and_fail_root_lowers_descendants():
    engine = _engine()
    item_c = engine.items_by_kc["c"][0]
    run_correct = engine.new_run()

    engine.apply_response(run_correct, item_c, DiagnosticResponse(item_id=item_c.id, correct=True))

    assert run_correct.states["a"].p_mastery >= 0.80
    assert run_correct.states["b"].p_mastery >= 0.80

    run_wrong = engine.new_run()
    item_a = engine.items_by_kc["a"][0]
    engine.apply_response(run_wrong, item_a, DiagnosticResponse(item_id=item_a.id, correct=False))

    assert run_wrong.states["b"].p_mastery <= 0.30
    assert run_wrong.states["c"].p_mastery <= 0.30


def test_diamond_selector_prefers_state_space_split_over_raw_degree():
    nodes = [
        {"id": "a", "code": "A", "name": "Root"},
        {"id": "b", "code": "B", "name": "Branch left"},
        {"id": "c", "code": "C", "name": "Branch right"},
        {"id": "d", "code": "D", "name": "Capstone"},
    ]
    edges = [
        {"source": "a", "target": "b", "edge_type": "prerequisite"},
        {"source": "a", "target": "c", "edge_type": "prerequisite"},
        {"source": "b", "target": "d", "edge_type": "prerequisite"},
        {"source": "c", "target": "d", "edge_type": "prerequisite"},
    ]
    items = [
        DiagnosticItem(id=f"item-{node['id']}", kc_id=node["id"], format_type="open", content={})
        for node in nodes
    ]
    engine = V2DiagnosticEngine(nodes, edges, items)
    run = engine.new_run()

    first = engine.select_next(run)

    assert first is not None
    assert first.kc_id in {"b", "c"}
    assert run.frontier_history[-1]["top_candidates"][0]["reason"] == "state_space_expected_information_gain"


def test_particle_state_roundtrips_through_payload_dict():
    engine = _engine()
    run = engine.new_run()
    item = engine.select_next(run)
    assert item is not None
    engine.apply_response(run, item, DiagnosticResponse(item_id=item.id, correct=True))

    payload = run.to_dict()
    restored = DiagnosticRun(
        states={
            kc_id: DiagnosticState(
                kc_id=kc_id,
                p_mastery=state["p_mastery"],
                direct_evidence_count=state["direct_evidence_count"],
                correct_count=state["correct_count"],
                wrong_count=state["wrong_count"],
                inferred_evidence_count=state["inferred_evidence_count"],
            )
            for kc_id, state in payload["states"].items()
        },
        tested_order=payload["tested_order"],
        seen_items=set(payload["seen_items"]),
        evidence_by_kc=payload["evidence_by_kc"],
        frontier_history=payload["frontier_history"],
        state_transitions=payload["state_transitions"],
        particle_state=payload["particle_state"],
    )

    second = engine.select_next(restored)

    assert payload["particle_state"]["strategy"] == "state_space_particles"
    assert second is not None


def test_grade8_fail_transfer_deep_dives_to_prerequisite_probe_before_unrelated_eig():
    engine = _grade8_deep_dive_engine()
    run = engine.new_run()
    item = engine.items_by_id["transfer-cap"]

    engine.apply_response(run, item, DiagnosticResponse(item_id=item.id, correct=False, student_answer="wrong"))
    next_item = engine.select_next(run)

    assert next_item is not None
    assert next_item.id == "probe-mid"
    frontier = run.frontier_history[-1]
    assert frontier["selector_policy"] == "grade8_deep_dive"
    assert frontier["reason"] == "grade8_deep_dive_after_failed_response"
    assert frontier["source_failed_kc"] == "cap"
    assert "probe:diagnosed misconception" in frontier["deep_dive_reason"]


def test_grade8_unknown_response_records_deep_dive_audit_context():
    engine = _grade8_deep_dive_engine()
    run = engine.new_run()
    item = engine.items_by_id["transfer-cap"]

    engine.apply_response(
        run,
        item,
        DiagnosticResponse(item_id=item.id, correct=False, student_answer="I don't know", response_type="unknown"),
    )
    next_item = engine.select_next(run)

    assert next_item is not None
    top = run.frontier_history[-1]["top_candidates"][0]
    assert top["selector_strategy"] == "grade8_deep_dive_state_space_eig"
    assert top["source_response_type"] == "unknown"
    assert "unknown_on:transfer-cap" in top["deep_dive_reason"]
    assert top["candidate_pool"]["target_exam_path"] == "linear_equation"


def test_grade8_can_ask_same_kc_twice_when_family_and_surface_are_different():
    second_cap = _g8_item(
        "cap-followup",
        "cap",
        role="prerequisite_probe",
        family="cap_followup",
        surface="cap_followup_surface",
        requires=[],
        diagnoses=[],
    )
    engine = V2DiagnosticEngine(
        nodes=[{"id": "cap", "code": "CAP", "name": "Capstone"}],
        edges=[],
        items=[
            _g8_item("transfer-cap", "cap", role="transfer", family="transfer", surface="transfer_surface", requires=[], diagnoses=[]),
            second_cap,
        ],
    )
    run = engine.new_run()
    first = engine.items_by_id["transfer-cap"]

    engine.apply_response(run, first, DiagnosticResponse(item_id=first.id, correct=False, student_answer="wrong"))
    next_item = engine.select_next(run)

    assert next_item is not None
    assert next_item.id == "cap-followup"
    assert next_item.kc_id == "cap"


def test_grade8_duplicate_surface_signature_is_not_selected_twice():
    duplicate_surface = _g8_item(
        "cap-duplicate-surface",
        "cap",
        role="prerequisite_probe",
        family="different_family",
        surface="transfer_surface",
        requires=[],
        diagnoses=[],
    )
    engine = V2DiagnosticEngine(
        nodes=[{"id": "cap", "code": "CAP", "name": "Capstone"}],
        edges=[],
        items=[
            _g8_item("transfer-cap", "cap", role="transfer", family="transfer", surface="transfer_surface", requires=[], diagnoses=[]),
            duplicate_surface,
        ],
    )
    run = engine.new_run()
    first = engine.items_by_id["transfer-cap"]

    engine.apply_response(run, first, DiagnosticResponse(item_id=first.id, correct=False, student_answer="wrong"))

    assert engine.select_next(run) is None


def test_grade8_deep_dive_falls_back_to_normal_eig_when_no_probe_exists():
    engine = V2DiagnosticEngine(
        nodes=[
            {"id": "cap", "code": "CAP", "name": "Capstone"},
            {"id": "other", "code": "OTHER", "name": "Other"},
        ],
        edges=[],
        items=[
            _g8_item("transfer-cap", "cap", role="transfer", family="transfer", surface="transfer_surface", requires=["missing"], diagnoses=["missing"]),
            _g8_item("other-item", "other", role="anchor", family="other", surface="other_surface", path="rational_expression", diagnoses=["other"]),
        ],
    )
    run = engine.new_run()
    first = engine.items_by_id["transfer-cap"]

    engine.apply_response(run, first, DiagnosticResponse(item_id=first.id, correct=False, student_answer="wrong"))
    next_item = engine.select_next(run)

    assert next_item is not None
    assert next_item.id == "other-item"
    assert run.frontier_history[-1]["selector_policy"] == "state_space_eig"
