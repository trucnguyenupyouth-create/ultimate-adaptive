from __future__ import annotations

import json
import shutil
from collections import defaultdict
from pathlib import Path
from typing import Any


ROOT_DIR = Path(__file__).resolve().parents[3]
RUN_STORE_DIR = ROOT_DIR / "backend" / "data" / "assessment_runs"
DOCS_DIR = ROOT_DIR / "docs"
SEEDED_RUN_FILES = (
    "gemini_full_guarded_assessment.json",
    "gemini_frontier_guarded_smoke.json",
    "gemini_targeted_draft_smoke.json",
)

STATE_TESTED_MASTERED = "tested_mastered"
STATE_TESTED_GAP = "tested_gap"
STATE_INFERRED_MASTERED = "inferred_mastered"
STATE_INFERRED_GAP = "inferred_gap"
STATE_UNKNOWN = "unknown"


def ensure_run_store() -> None:
    RUN_STORE_DIR.mkdir(parents=True, exist_ok=True)


def ensure_seed_runs_imported() -> None:
    ensure_run_store()
    for filename in SEEDED_RUN_FILES:
        source = DOCS_DIR / filename
        target = RUN_STORE_DIR / filename
        if source.exists() and not target.exists():
            shutil.copy2(source, target)


def list_runs() -> list[dict[str, Any]]:
    ensure_seed_runs_imported()
    runs: list[dict[str, Any]] = []
    for path in sorted(RUN_STORE_DIR.glob("*.json")):
        run = _load_run_file(path)
        runs.append(_metadata_for_run(run, path.name))
    runs.sort(
        key=lambda run: (
            run.get("created_at") or "",
            run.get("run_id") or "",
        ),
        reverse=True,
    )
    return runs


def get_run(run_id: str) -> dict[str, Any]:
    ensure_seed_runs_imported()
    path = _path_for_run_id(run_id)
    if not path.exists():
        raise FileNotFoundError(f"Run not found: {run_id}")
    run = _load_run_file(path)
    metadata = _metadata_for_run(run, path.name)
    overlay = _derive_overlay(run)
    return {
        **run,
        "metadata": metadata,
        "overlay": overlay,
    }


def import_run(*, source_file: str | None = None, payload: dict[str, Any] | None = None, run_id: str | None = None) -> dict[str, Any]:
    ensure_run_store()
    if bool(source_file) == bool(payload):
        raise ValueError("Provide exactly one of source_file or payload")

    if source_file:
        source = _safe_docs_file(source_file)
        run = _load_run_file(source)
        target_run_id = _normalize_run_id(run_id or source.stem)
        target = _path_for_run_id(target_run_id)
        shutil.copy2(source, target)
        return _metadata_for_run(_load_run_file(target), target.name)

    target_run_id = _normalize_run_id(run_id or payload.get("run_id") or payload.get("title") or payload.get("mode") or "assessment_run")
    target = _path_for_run_id(target_run_id)
    target.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")
    return _metadata_for_run(_load_run_file(target), target.name)


def _safe_docs_file(source_file: str) -> Path:
    candidate = Path(source_file)
    if candidate.name != source_file or candidate.suffix.lower() != ".json":
        raise ValueError("source_file must be a JSON filename from docs/")
    source = DOCS_DIR / source_file
    if not source.exists():
        raise FileNotFoundError(f"Source file not found: {source_file}")
    return source


def _normalize_run_id(value: str) -> str:
    cleaned = "".join(ch.lower() if ch.isalnum() else "_" for ch in value.strip())
    cleaned = "_".join(part for part in cleaned.split("_") if part)
    return cleaned or "assessment_run"


def _path_for_run_id(run_id: str) -> Path:
    normalized = _normalize_run_id(run_id)
    return RUN_STORE_DIR / f"{normalized}.json"


def _load_run_file(path: Path) -> dict[str, Any]:
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except json.JSONDecodeError as exc:
        raise ValueError(f"Malformed run JSON: {path.name}") from exc


def _metadata_for_run(run: dict[str, Any], source_file: str) -> dict[str, Any]:
    counts = run.get("counts") or {}
    steps = run.get("steps") or []
    kc_results = _extract_kc_results(run)
    cost = run.get("cost") or {}
    created_at = run.get("generated_at") or run.get("created_at")
    run_id = run.get("run_id") or Path(source_file).stem
    title = (
        run.get("title")
        or run.get("mode")
        or Path(source_file).stem.replace("_", " ")
    )
    return {
        "run_id": _normalize_run_id(run_id),
        "title": title,
        "created_at": created_at,
        "status": run.get("status") or (run.get("assessment_result") or {}).get("status"),
        "steps": counts.get("steps") or len(steps),
        "tested_kcs": counts.get("tested_kcs") or len(kc_results),
        "pending_draft_steps": counts.get("pending_draft_steps") or sum(
            1 for step in steps if step.get("source") == "pending_draft"
        ),
        "cost": cost,
        "source_file": source_file,
    }


def _derive_overlay(run: dict[str, Any]) -> dict[str, Any]:
    steps = run.get("steps") or []
    kc_results = _extract_kc_results(run)
    node_states = _extract_node_states(run, kc_results)
    steps_by_kc = _group_steps_by_kc(steps)
    tested_order = {
        group["kc_id"]: index + 1
        for index, group in enumerate(steps_by_kc)
    }
    edge_path = []
    for previous, current in zip(steps_by_kc, steps_by_kc[1:]):
        edge_path.append({
            "source": previous["kc_id"],
            "target": current["kc_id"],
            "source_code": previous.get("kc_code"),
            "target_code": current.get("kc_code"),
        })

    state_counts = run.get("state_counts")
    if not state_counts:
        state_counts = defaultdict(int)
        for state in node_states.values():
            state_counts[state] += 1
        state_counts = dict(state_counts)

    state_transitions = (run.get("session") or {}).get("state_transitions") or run.get("state_transitions") or []
    frontier_history = (run.get("session") or {}).get("frontier_history") or run.get("frontier_history") or []

    return {
        "node_states": node_states,
        "tested_order": tested_order,
        "steps_by_kc": steps_by_kc,
        "edge_path": edge_path,
        "state_counts": state_counts,
        "state_transitions": state_transitions,
        "frontier_history": frontier_history,
    }


def _extract_kc_results(run: dict[str, Any]) -> dict[str, str]:
    session = run.get("session") or {}
    if session.get("kc_results"):
        return session["kc_results"]
    if run.get("kc_results"):
        return run["kc_results"]
    if run.get("kc_results_named"):
        return {
            item["kc_id"]: item["outcome"]
            for item in run["kc_results_named"]
            if item.get("kc_id") and item.get("outcome")
        }
    assessment_result = run.get("assessment_result") or {}
    results: dict[str, str] = {}
    for kc in assessment_result.get("mastered", []):
        if isinstance(kc, str):
            results[kc] = "pass"
    for kc in assessment_result.get("gaps", []):
        if isinstance(kc, str):
            results[kc] = "fail"
    return results


def _extract_node_states(run: dict[str, Any], kc_results: dict[str, str]) -> dict[str, str]:
    session = run.get("session") or {}
    kc_states = session.get("kc_states") or run.get("kc_states")
    if kc_states:
        return kc_states

    node_states: dict[str, str] = {}
    for kc_id, outcome in kc_results.items():
        if outcome == "pass":
            node_states[kc_id] = STATE_TESTED_MASTERED
        elif outcome in {"fail", "fundamental_gap"}:
            node_states[kc_id] = STATE_TESTED_GAP

    result = run.get("result") or {}
    for kc_id in result.get("inferred_mastered", []):
        node_states.setdefault(kc_id, STATE_INFERRED_MASTERED)
    for kc_id in result.get("inferred_gaps", []):
        node_states.setdefault(kc_id, STATE_INFERRED_GAP)
    return node_states


def _group_steps_by_kc(steps: list[dict[str, Any]]) -> list[dict[str, Any]]:
    grouped: list[dict[str, Any]] = []
    current: dict[str, Any] | None = None
    for step in steps:
        kc_id = step.get("kc_id")
        if not kc_id:
            continue
        if current is None or current["kc_id"] != kc_id:
            current = {
                "kc_id": kc_id,
                "kc_code": step.get("kc_code"),
                "kc_name": step.get("kc_name"),
                "persona_knows_kc": step.get("persona_knows_kc"),
                "steps": [],
            }
            grouped.append(current)
        current["steps"].append(step)

    for group in grouped:
        group["n_items"] = len(group["steps"])
        group["n_correct"] = sum(1 for step in group["steps"] if step.get("agent_correct") or step.get("correct"))
        group["first_step"] = group["steps"][0]["step"]
        group["last_step"] = group["steps"][-1]["step"]
    return grouped
