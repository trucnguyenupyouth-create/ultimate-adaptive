import json

from app.services import assessment_v2_review_service as store


def test_review_store_lists_summary_and_persists_updates(tmp_path, monkeypatch):
    path = tmp_path / "review_items.json"
    path.write_text(
        json.dumps(
            {
                "items": [
                    {
                        "review_id": "v2-test",
                        "cluster": "Fractions",
                        "answer_type": "fraction",
                        "requires_kcs": ["kc-a"],
                        "codex_review_status": "provisionally_accepted_for_algorithm_test_only",
                        "flagged_for_review": False,
                        "review_decision": "needs_review",
                        "review_comment": "",
                        "review_history": [],
                    }
                ],
                "gap_records": [{"cluster": "Fractions", "reason": "gap"}],
            },
            ensure_ascii=False,
        ),
        encoding="utf-8",
    )
    monkeypatch.setattr(store, "STORE_PATH", path)

    listed = store.list_review_items()
    assert listed["summary"]["total"] == 1
    assert listed["summary"]["gap_records"] == 1
    assert listed["summary"]["decisions"]["needs_review"] == 1
    assert listed["summary"]["codex_added"] == 1

    updated = store.update_review_item(
        "v2-test",
        {
            "review_decision": "accepted",
            "flagged_for_review": True,
            "review_comment": "Looks good for fixture only.",
            "note": "unit test",
        },
    )

    assert updated["review_decision"] == "accepted"
    assert updated["flagged_for_review"] is True
    assert updated["review_comment"] == "Looks good for fixture only."
    assert len(updated["review_history"]) == 1

    persisted = json.loads(path.read_text(encoding="utf-8"))
    assert persisted["items"][0]["review_decision"] == "accepted"


def test_review_store_rejects_invalid_decision(tmp_path, monkeypatch):
    path = tmp_path / "review_items.json"
    path.write_text(
        json.dumps({"items": [{"review_id": "v2-test"}], "gap_records": []}),
        encoding="utf-8",
    )
    monkeypatch.setattr(store, "STORE_PATH", path)

    try:
        store.update_review_item("v2-test", {"review_decision": "maybe"})
    except ValueError as exc:
        assert "Invalid review_decision" in str(exc)
    else:
        raise AssertionError("Expected invalid decision to raise ValueError")


def test_review_store_flags_mcq_disguised_and_suggests_replacement(tmp_path, monkeypatch):
    path = tmp_path / "review_items.json"
    path.write_text(
        json.dumps(
            {
                "items": [
                    {
                        "review_id": "v2-001",
                        "cluster": "Fractions",
                        "question": "Trong các cách viết sau: 3/4, 5/0, -2/7, 0/9. Cách viết nào KHÔNG phải là phân số hợp lệ? Nêu lí do ngắn gọn.",
                        "answer_type": "short_text",
                        "accepted_answers": ["5/0 vì mẫu số bằng 0"],
                        "requires_kcs": ["kc-a"],
                        "common_wrong_patterns": [],
                    }
                ],
                "gap_records": [],
            },
            ensure_ascii=False,
        ),
        encoding="utf-8",
    )
    monkeypatch.setattr(store, "STORE_PATH", path)

    listed = store.list_review_items()
    item = listed["items"][0]
    assert "mcq_disguised" in item["risk_tags"]
    assert "fragile_text_grader" in item["risk_tags"]
    assert item["recommended_review_action"] == "replace_required"
    assert item["grader_readiness"] == "blocked"
    assert item["suggested_replacement"]["answer_type"] == "integer"


def test_review_store_identifies_widget_checker_items(tmp_path, monkeypatch):
    path = tmp_path / "review_items.json"
    path.write_text(
        json.dumps(
            {
                "items": [
                    {
                        "review_id": "v2-015",
                        "cluster": "Expressions",
                        "question": "Viết kết quả dưới dạng một lũy thừa: 5⁴ · 5",
                        "answer_type": "short_text",
                        "accepted_answers": ["5^5", "5 mũ 5"],
                        "requires_kcs": ["kc-a"],
                        "common_wrong_patterns": [],
                    }
                ],
                "gap_records": [],
            },
            ensure_ascii=False,
        ),
        encoding="utf-8",
    )
    monkeypatch.setattr(store, "STORE_PATH", path)

    item = store.list_review_items()["items"][0]
    assert "expression_parser_widget" in item["risk_tags"]
    assert "needs_widget_checker" in item["risk_tags"]
    assert item["recommended_review_action"] == "needs_widget_checker"
    assert item["required_checker"] == "power_widget"
