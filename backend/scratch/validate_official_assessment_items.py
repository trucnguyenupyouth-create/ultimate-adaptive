"""Validate an official Assessment V2 item-bank JSON file.

Usage:
    python backend/scratch/validate_official_assessment_items.py path/to/items.json

The input may be either:
    {"items": [...]}  or  [...]
"""

from __future__ import annotations

import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / "backend"))

from app.engines.assessment_v2.item_quality import validate_official_item_bank  # noqa: E402


def main() -> int:
    if len(sys.argv) != 2:
        print("Usage: python backend/scratch/validate_official_assessment_items.py path/to/items.json")
        return 2

    path = Path(sys.argv[1])
    try:
        data = json.loads(path.read_text(encoding="utf-8"))
    except json.JSONDecodeError as exc:
        print(f"Invalid JSON: {exc}")
        return 2
    items = data.get("items", data) if isinstance(data, dict) else data
    if not isinstance(items, list):
        print("Input must be a list of items or an object with an items list.")
        return 2

    result = validate_official_item_bank(items)
    print(json.dumps(result["summary"], ensure_ascii=False, indent=2))

    failed = False
    for item_id, item_result in result["items"].items():
        if item_result["errors"] or item_result["warnings"]:
            print(f"\n{item_id}")
            for error in item_result["errors"]:
                print(f"  ERROR: {error}")
            for warning in item_result["warnings"]:
                print(f"  WARN: {warning}")
        if item_result["errors"]:
            failed = True
    return 1 if failed else 0


if __name__ == "__main__":
    raise SystemExit(main())
