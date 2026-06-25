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
