import json
from pathlib import Path

import pytest

from app.services import assessment_run_store as store


@pytest.fixture
def temp_store(tmp_path, monkeypatch):
    docs_dir = tmp_path / "docs"
    run_store_dir = tmp_path / "backend" / "data" / "assessment_runs"
    docs_dir.mkdir(parents=True)
    run_store_dir.mkdir(parents=True)
    monkeypatch.setattr(store, "DOCS_DIR", docs_dir)
    monkeypatch.setattr(store, "RUN_STORE_DIR", run_store_dir)
    monkeypatch.setattr(store, "SEEDED_RUN_FILES", ())
    return docs_dir, run_store_dir


def _write_json(path: Path, payload: dict):
    path.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")


def test_list_runs_empty(temp_store):
    runs = store.list_runs()
    assert runs == []


def test_import_run_from_docs_file(temp_store):
    docs_dir, run_store_dir = temp_store
    payload = {
        "generated_at": "2026-06-23T00:00:00Z",
        "mode": "smoke_test",
        "steps": [{"step": 1, "kc_id": "kc-1", "source": "active_item"}],
        "session": {"kc_results": {"kc-1": "pass"}},
    }
    _write_json(docs_dir / "sample_run.json", payload)

    metadata = store.import_run(source_file="sample_run.json")
    assert metadata["run_id"] == "sample_run"
    assert (run_store_dir / "sample_run.json").exists()


def test_import_run_rejects_path_traversal(temp_store):
    with pytest.raises(ValueError, match="source_file must be a JSON filename"):
        store.import_run(source_file="../secret.json")


def test_get_run_derives_overlay_from_new_shape(temp_store):
    _, run_store_dir = temp_store
    payload = {
        "generated_at": "2026-06-23T00:00:00Z",
        "title": "New Shape",
        "steps": [
            {"step": 1, "kc_id": "kc-1", "kc_code": "KC1", "kc_name": "KC 1", "agent_correct": True},
            {"step": 2, "kc_id": "kc-1", "kc_code": "KC1", "kc_name": "KC 1", "agent_correct": True},
            {"step": 3, "kc_id": "kc-2", "kc_code": "KC2", "kc_name": "KC 2", "agent_correct": False},
        ],
        "session": {
            "kc_results": {"kc-1": "pass", "kc-2": "fail"},
            "kc_states": {"kc-1": "tested_mastered", "kc-2": "tested_gap", "kc-3": "inferred_gap"},
            "state_transitions": [{"step": 1, "changes": []}],
            "frontier_history": [{"step": 1, "selected_kc": "kc-1"}],
        },
    }
    _write_json(run_store_dir / "new_shape.json", payload)

    run = store.get_run("new_shape")
    assert run["overlay"]["node_states"]["kc-1"] == "tested_mastered"
    assert run["overlay"]["node_states"]["kc-3"] == "inferred_gap"
    assert run["overlay"]["tested_order"] == {"kc-1": 1, "kc-2": 2}
    assert len(run["overlay"]["steps_by_kc"]) == 2


def test_get_run_derives_overlay_from_legacy_shape(temp_store):
    _, run_store_dir = temp_store
    payload = {
        "generated_at": "2026-06-23T00:00:00Z",
        "assessment_result": {
            "status": "completed",
            "mastered": ["kc-1"],
            "gaps": ["kc-2"],
        },
        "steps": [
            {"step": 1, "kc_id": "kc-1", "kc_code": "KC1", "kc_name": "KC 1", "correct": True},
            {"step": 2, "kc_id": "kc-2", "kc_code": "KC2", "kc_name": "KC 2", "correct": False, "source": "pending_draft"},
        ],
    }
    _write_json(run_store_dir / "legacy_shape.json", payload)

    run = store.get_run("legacy_shape")
    assert run["overlay"]["node_states"]["kc-1"] == "tested_mastered"
    assert run["overlay"]["node_states"]["kc-2"] == "tested_gap"
    assert run["metadata"]["pending_draft_steps"] == 1
