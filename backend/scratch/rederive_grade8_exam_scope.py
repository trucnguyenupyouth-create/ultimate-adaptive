"""Re-derive the Grade 8 exam-path diagnostic scope from production KCs.

The original mapping document records that the exam touches a broader
72-node graph, but it did not preserve that node list. This script makes the
scope explicit and auditable:

- validates all curated node codes against production;
- exports a markdown review file with node descriptions and internal edges;
- updates docs/grade8_exam_scope.json for the runtime/reportable scope.
"""

from __future__ import annotations

import asyncio
import json
import os
import sys
from collections import defaultdict
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from sqlalchemy import text
from sqlalchemy.ext.asyncio import create_async_engine


ROOT = Path(__file__).resolve().parents[2]
OUT_JSON = ROOT / "docs" / "grade8_exam_scope.json"
OUT_MD = ROOT / "docs" / "grade8_exam_scope_rederived.md"
ITEM_BANK_PATH = ROOT / "docs" / "grade8_exam_path_official_item_drafts.json"

ASSESSMENT_SCOPE = "grade8_exam_path"

QUESTION_MAP = {
    "I.1": {
        "status": "student_correct",
        "description": "Compute A = x/(x+5) at x = 3.",
        "primary": ["G8-MATH-TINH-GIA-TRI"],
    },
    "I.2": {
        "status": "student_unknown",
        "description": "Prove B = (x - 2)/x from a rational-expression identity.",
        "primary": [
            "G8-MATH-NHAN-BIET-PHAN",
            "G8-MATH-XAC-DINH-DIEU",
            "G8-MATH-XAC-DINH-MAU",
            "G8-MATH-QUY-DONG-MAU",
            "G8-MATH-RUT-GON-PHAN",
            "G8-MATH-NHAN-DANG-A",
            "G8-MATH-PHAN-TICH-DA",
        ],
    },
    "II.1a": {
        "status": "student_unknown",
        "description": "Solve 3(x - 2) + 5 = 2x.",
        "primary": [
            "G8-MATH-GIAI-PHUONG-TRINH",
            "G7-MATH-QUY-TAC-CHUYEN",
            "G6-MATH-BO-DAU-NGOAC",
        ],
    },
    "II.1b": {
        "status": "student_unknown",
        "description": "Solve (x - 2)/3 + (2x - 3)/6 = 1.",
        "primary": [
            "G8-MATH-GIAI-PHUONG-TRINH",
            "G6-MATH-QUY-DONG-MAU",
            "G6-MATH-CONG-HAI-PHAN-1",
            "G7-MATH-QUY-TAC-CHUYEN",
        ],
    },
    "II.2": {
        "status": "student_unknown",
        "description": "Set up and solve a savings-interest word problem.",
        "primary": [
            "G7-MATH-VIET-BIEU-THUC",
            "G7-MATH-NHAN-BIET-BIEU",
            "G6-MATH-B31K2",
            "G6-MATH-TIM-GIA-TRI-1",
            "G8-MATH-GIAI-PHUONG-TRINH",
        ],
    },
    "III.1": {
        "status": "student_unknown",
        "description": "Draw the graph of y = 2x - 4.",
        "primary": [
            "G8-MATH-NHAN-BIET-HAM",
            "G8-MATH-TINH-HOAC-XAC",
            "G8-MATH-BIEU-DIEN-DIEM",
            "G8-MATH-BIEU-DIEN-DO",
            "G8-MATH-VE-DO-THI",
        ],
    },
    "III.2": {
        "status": "student_unknown",
        "description": "Find m so y = 2x - 4 is parallel to y = (m^2 + 1)x + m - 3.",
        "primary": [
            "G8-MATH-NHAN-BIET-HAM",
            "G8-MATH-XAC-DINH-QUAN",
            "G8-MATH-NHAN-BIET-HUONG",
        ],
    },
}

# Curated from the exam mapping, production node titles/descriptions, and the
# Grade 6-8 textbook summaries. It intentionally excludes geometry/probability
# nodes unless they directly support coordinate graphing in III.1.
FULL_RELATED_CODES = [
    # Grade 6 fraction and percent foundations.
    "G6-MATH-NHAN-BIET-PHAN-1",
    "G6-MATH-NHAN-BIET-HAI",
    "G6-MATH-TINH-CHAT-CO",
    "G6-MATH-RUT-GON-VE",
    "G6-MATH-QUY-DONG-MAU",
    "G6-MATH-CONG-HAI-PHAN",
    "G6-MATH-CONG-HAI-PHAN-1",
    "G6-MATH-TRU-HAI-PHAN",
    "G6-MAMATMATHMAT",
    "G6-MATH-NHAN-HAI-PHAN",
    "G6-MATH-CHIA-HAI-PHAN",
    "G6-MATH-PHAN-SO-NGHICH",
    "G6-MATH-SO-DOI-CUA",
    "G6-MATH-B31K2",
    "G6-MATH-TIM-GIA-TRI-1",
    "G6-MATH-TIM-MOT-SO",
    "G6-MATH-TIM-GIA-TRI",
    "G6-MATH-TIM-MOT-SO-1",
    # Grade 6 integers/sign/parentheses roots for equations.
    "G6-MATH-NHAN-BIET-DOC",
    "G6-MATH-NHAN-BIET-SO-1",
    "G6-MATH-CONG-HAI-SO",
    "G6-MATH-CONG-HAI-SO-1",
    "G6-MATH-TU-CHO-SO",
    "G6-MATH-NHAN-HAI-SO",
    "G6-MATH-NHAN-HAI-SO-1",
    "G6-MATH-THUC-HIEN-PHEP",
    "G6-MATH-BO-DAU-NGOAC",
    "G6-MATH-BO-DAU-NGOAC-1",
    "G6-MATH-BO-NGOAC-LONG",
    "G6-MATH-PHAN-PHOI-NHAN",
    "G6-MATH-AP-DUNG-DUNG",
    "G6-MATH-AP-DUNG-DUNG-1",
    # Grade 7 algebra foundations.
    "G9-MATH-NHAN-BIET-SO-1",
    "G7-MATH-KHAI-NIEM-DANG",
    "G7-MATH-QUY-TAC-CHUYEN",
    "G7-MATH-NHAN-BIET-BIEU",
    "G7-MATH-TINH-GIA-TRI-1",
    "G7-MATH-VIET-BIEU-THUC",
    "G7-MATH-NHAN-BIET-DON",
    "G7-MATH-NHAN-BIET-DA",
    "G7-MATH-THU-GON-DA",
    "G7-MATH-CONG-HAI-DA",
    "G7-MATH-TRU-HAI-DA",
    "G7-MATH-NHAN-DON-THUC",
    "G7-MATH-NHAN-DA-THUC",
    "G7-MATH-CHIA-HAI-DON",
    "G7-MATH-SAP-XEP-DA",
    # Grade 8 target/bridge nodes.
    "G8-MATH-TINH-GIA-TRI",
    "G8-MATH-NHAN-BIET-PHAN",
    "G8-MATH-XAC-DINH-DIEU",
    "G8-MATH-KIEM-TRA-HAI",
    "G8-MATH-XAC-DINH-MAU",
    "G8-MATH-QUY-DONG-MAU",
    "G8-MATH-RUT-GON-PHAN",
    "G8-MATH-NHAN-BIET-DA",
    "G8-MATH-NHAN-BIET-DON",
    "G8-MATH-NHAN-BIET-CAC",
    "G8-MATH-THU-GON-DA",
    "G8-MATH-CONG-HAI-DA",
    "G8-MATH-TRU-HAI-DA",
    "G8-MATH-NHAN-DON-THUC",
    "G8-MATH-PHAN-TICH-DA",
    "G8-MATH-NHAN-DANG-A",
    "G8-MATH-BIEN-DOI-TICH",
    "G8-MATH-NHAN-BIET-PHUONG",
    "G8-MATH-NHAN-BIET-PHUONG-1",
    "G8-MATH-KIEM-TRA-GIA",
    "G8-MATH-GIAI-PHUONG-TRINH",
    "G8-MATH-NHAN-BIET-HAM",
    "G8-MATH-TINH-HOAC-XAC",
    "G8-MATH-BIEU-DIEN-DIEM",
    "G8-MATH-BIEU-DIEN-DO",
    "G8-MATH-VE-DO-THI",
    "G8-MATH-XAC-DINH-QUAN",
    "G8-MATH-NHAN-BIET-HUONG",
]

CORE_DIAGNOSTIC_CODES = [
    "G6-MAMATMATHMAT",
    "G6-MATH-B31K2",
    "G6-MATH-BO-DAU-NGOAC",
    "G6-MATH-BO-DAU-NGOAC-1",
    "G6-MATH-CONG-HAI-PHAN-1",
    "G6-MATH-NHAN-BIET-HAI",
    "G6-MATH-NHAN-BIET-PHAN-1",
    "G6-MATH-QUY-DONG-MAU",
    "G6-MATH-TIM-GIA-TRI-1",
    "G6-MATH-TIM-MOT-SO",
    "G6-MATH-TINH-CHAT-CO",
    "G7-MATH-KHAI-NIEM-DANG",
    "G7-MATH-NHAN-BIET-BIEU",
    "G7-MATH-QUY-TAC-CHUYEN",
    "G7-MATH-TINH-GIA-TRI-1",
    "G7-MATH-VIET-BIEU-THUC",
    "G8-MATH-BIEU-DIEN-DIEM",
    "G8-MATH-BIEU-DIEN-DO",
    "G8-MATH-GIAI-PHUONG-TRINH",
    "G8-MATH-KIEM-TRA-GIA",
    "G8-MATH-KIEM-TRA-HAI",
    "G8-MATH-NHAN-BIET-DA",
    "G8-MATH-NHAN-BIET-HAM",
    "G8-MATH-NHAN-BIET-HUONG",
    "G8-MATH-NHAN-BIET-PHAN",
    "G8-MATH-NHAN-BIET-PHUONG",
    "G8-MATH-NHAN-BIET-PHUONG-1",
    "G8-MATH-NHAN-DANG-A",
    "G8-MATH-PHAN-TICH-DA",
    "G8-MATH-QUY-DONG-MAU",
    "G8-MATH-RUT-GON-PHAN",
    "G8-MATH-THU-GON-DA",
    "G8-MATH-TINH-HOAC-XAC",
    "G8-MATH-VE-DO-THI",
    "G8-MATH-XAC-DINH-DIEU",
    "G8-MATH-XAC-DINH-MAU",
    "G8-MATH-XAC-DINH-QUAN",
]

STRANDS = {
    "fraction_percent_foundations_g6": FULL_RELATED_CODES[0:18],
    "integer_parentheses_foundations_g6": FULL_RELATED_CODES[18:32],
    "algebra_foundations_g7": FULL_RELATED_CODES[32:47],
    "rational_expression_g8": [
        "G8-MATH-TINH-GIA-TRI",
        "G8-MATH-NHAN-BIET-PHAN",
        "G8-MATH-XAC-DINH-DIEU",
        "G8-MATH-KIEM-TRA-HAI",
        "G8-MATH-XAC-DINH-MAU",
        "G8-MATH-QUY-DONG-MAU",
        "G8-MATH-RUT-GON-PHAN",
        "G8-MATH-NHAN-BIET-DA",
        "G8-MATH-THU-GON-DA",
        "G8-MATH-PHAN-TICH-DA",
        "G8-MATH-NHAN-DANG-A",
        "G8-MATH-BIEN-DOI-TICH",
    ],
    "equation_modeling_g8": [
        "G8-MATH-NHAN-BIET-PHUONG",
        "G8-MATH-NHAN-BIET-PHUONG-1",
        "G8-MATH-KIEM-TRA-GIA",
        "G8-MATH-GIAI-PHUONG-TRINH",
    ],
    "linear_function_graph_g8": [
        "G8-MATH-NHAN-BIET-HAM",
        "G8-MATH-TINH-HOAC-XAC",
        "G8-MATH-BIEU-DIEN-DIEM",
        "G8-MATH-BIEU-DIEN-DO",
        "G8-MATH-VE-DO-THI",
        "G8-MATH-XAC-DINH-QUAN",
        "G8-MATH-NHAN-BIET-HUONG",
    ],
    "polynomial_support_g8": [
        "G8-MATH-NHAN-BIET-DON",
        "G8-MATH-NHAN-BIET-CAC",
        "G8-MATH-CONG-HAI-DA",
        "G8-MATH-TRU-HAI-DA",
        "G8-MATH-NHAN-DON-THUC",
    ],
}


def _load_env() -> None:
    env_path = ROOT / "backend" / ".env"
    if not env_path.exists():
        return
    for line in env_path.read_text(encoding="utf-8").splitlines():
        if "=" in line and not line.strip().startswith("#"):
            key, value = line.split("=", 1)
            os.environ.setdefault(key.strip(), value.strip().strip('"').strip("'"))


def _grade_from_code(code: str) -> int | None:
    if code.startswith("G6-"):
        return 6
    if code.startswith("G7-") or code.startswith("G9-MATH-NHAN-BIET-SO-1"):
        return 7
    if code.startswith("G8-"):
        return 8
    return None


def _load_direct_item_codes() -> list[str]:
    if not ITEM_BANK_PATH.exists():
        return []
    raw = json.loads(ITEM_BANK_PATH.read_text(encoding="utf-8"))
    codes = {
        str(item.get("kc_code"))
        for item in raw.get("items", [])
        if item.get("official_assessment_scope") == ASSESSMENT_SCOPE and item.get("kc_code")
    }
    return sorted(codes)


async def _load_production_graph() -> tuple[dict[str, dict[str, Any]], list[dict[str, Any]]]:
    _load_env()
    engine = create_async_engine(
        os.environ["DATABASE_URL"],
        echo=False,
        connect_args={"statement_cache_size": 0, "prepared_statement_cache_size": 0},
    )
    try:
        async with engine.connect() as conn:
            node_rows = await conn.execute(
                text(
                    """
                    select id::text, code, name, grade, subject, chapter_info, description
                    from knowledge_components
                    where code = any(:codes)
                    order by grade, code
                    """
                ),
                {"codes": sorted(set(FULL_RELATED_CODES) | set(CORE_DIAGNOSTIC_CODES))},
            )
            nodes = {row._mapping["code"]: dict(row._mapping) for row in node_rows}

            edge_rows = await conn.execute(
                text(
                    """
                    select p.prereq_id::text as source_id,
                           p.kc_id::text as target_id,
                           pre.code as source_code,
                           kc.code as target_code,
                           p.weight,
                           p.edge_type
                    from kc_prerequisites p
                    join knowledge_components pre on pre.id = p.prereq_id
                    join knowledge_components kc on kc.id = p.kc_id
                    where p.edge_type = 'prerequisite'
                      and pre.code = any(:codes)
                      and kc.code = any(:codes)
                    order by pre.code, kc.code
                    """
                ),
                {"codes": sorted(set(FULL_RELATED_CODES))},
            )
            edges = [dict(row._mapping) for row in edge_rows]
    finally:
        await engine.dispose()
    return nodes, edges


def _validate(nodes: dict[str, dict[str, Any]]) -> None:
    duplicate_codes = sorted({code for code in FULL_RELATED_CODES if FULL_RELATED_CODES.count(code) > 1})
    if duplicate_codes:
        raise RuntimeError(f"Duplicate codes in curated scope: {duplicate_codes}")
    missing = sorted(set(FULL_RELATED_CODES) - set(nodes))
    if missing:
        raise RuntimeError(f"Missing production KCs in curated scope: {missing}")
    missing_core = sorted(set(CORE_DIAGNOSTIC_CODES) - set(FULL_RELATED_CODES))
    if missing_core:
        raise RuntimeError(f"Core diagnostic codes missing from full scope: {missing_core}")


def _short_description(node: dict[str, Any]) -> str:
    text = str(node.get("description") or "").strip().replace("\n", " ")
    if not text:
        return "No production description yet."
    return text[:180] + ("..." if len(text) > 180 else "")


def _write_scope_json(nodes: dict[str, dict[str, Any]], edges: list[dict[str, Any]]) -> None:
    direct_item_codes = _load_direct_item_codes()
    full_codes = list(FULL_RELATED_CODES)
    foundation_codes = [code for code in full_codes if _grade_from_code(code) in {6, 7}]
    inference_only_codes = sorted(set(full_codes) - set(direct_item_codes))
    now = datetime.now(timezone.utc).isoformat()

    payload = {
        "assessment_scope": ASSESSMENT_SCOPE,
        "version": 2,
        "updated_at": now,
        "notes": [
            "Runtime/reportable scope re-derived from grade8_exam_question_node_mapping.md, production KC metadata, and Grade 6-8 textbook skill dependencies.",
            "The assessment seed is a student who only solved I.1 and could not do I.2, II.1, II.2, III.1, III.2.",
            "full_related_scope_codes is the auditable root-cause graph. direct_item_scope_codes is the subset currently covered by generated draft items.",
            "Do not report inferred gaps outside full_related_scope_codes.",
        ],
        "exam_signal": {
            "student_correct": ["I.1"],
            "student_unknown_or_failed": ["I.2", "II.1a", "II.1b", "II.2", "III.1", "III.2"],
        },
        "counts": {
            "full_related_scope": len(full_codes),
            "core_diagnostic_scope": len(CORE_DIAGNOSTIC_CODES),
            "foundation_priority_scope": len(foundation_codes),
            "direct_item_scope": len(direct_item_codes),
            "inference_only_scope": len(inference_only_codes),
            "internal_edges": len(edges),
        },
        "question_map": QUESTION_MAP,
        "strand_scope_codes": STRANDS,
        "full_related_scope_codes": full_codes,
        "core_diagnostic_scope_codes": list(CORE_DIAGNOSTIC_CODES),
        "foundation_priority_scope_codes": foundation_codes,
        "direct_item_scope_codes": direct_item_codes,
        "inference_only_scope_codes": inference_only_codes,
        "support_scope_codes": [],
        "reportable_scope_codes": full_codes,
        "nodes": [
            {
                "code": code,
                "id": str(nodes[code]["id"]),
                "name": nodes[code]["name"],
                "grade": nodes[code]["grade"],
                "description_excerpt": _short_description(nodes[code]),
                "has_direct_item": code in direct_item_codes,
                "is_core_diagnostic": code in CORE_DIAGNOSTIC_CODES,
            }
            for code in full_codes
        ],
        "internal_edges": [
            {
                "source_code": edge["source_code"],
                "target_code": edge["target_code"],
                "weight": float(edge["weight"] or 1),
                "edge_type": edge["edge_type"],
            }
            for edge in edges
        ],
    }
    OUT_JSON.write_text(json.dumps(payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def _write_markdown(nodes: dict[str, dict[str, Any]], edges: list[dict[str, Any]]) -> None:
    direct_item_codes = set(_load_direct_item_codes())
    by_grade: dict[int, list[str]] = defaultdict(list)
    for code in FULL_RELATED_CODES:
        by_grade[int(nodes[code]["grade"])].append(code)
    outgoing: dict[str, list[str]] = defaultdict(list)
    incoming: dict[str, list[str]] = defaultdict(list)
    for edge in edges:
        outgoing[edge["source_code"]].append(edge["target_code"])
        incoming[edge["target_code"]].append(edge["source_code"])

    lines: list[str] = [
        "# Grade 8 Exam Root-Cause Scope, Re-derived",
        "",
        f"Updated: {datetime.now(timezone.utc).isoformat()}",
        "",
        "## Why This File Exists",
        "",
        "The older mapping document said the Grade 8 exam touched 72 related nodes, but it did not save that exact list. This file makes the scope explicit and auditable.",
        "",
        "Grounding:",
        "",
        "- Source mapping: `docs/grade8_exam_question_node_mapping.md`.",
        "- Student signal: the student solved only I.1, direct substitution into `A = x/(x+5)` at `x = 3`; all other tasks were not solved.",
        "- Scope intent: diagnose root causes from Grade 8 tasks down into Grade 7 and Grade 6 foundations, especially fractions, signs/parentheses, algebraic expressions, equations, percent modeling, and linear functions.",
        "",
        "## Counts",
        "",
        f"- Full related scope: **{len(FULL_RELATED_CODES)} nodes**.",
        f"- Core diagnostic scope: **{len(CORE_DIAGNOSTIC_CODES)} nodes**.",
        f"- Foundation priority scope, Grade 6-7: **{sum(len(by_grade[g]) for g in [6, 7])} nodes**.",
        f"- Direct item coverage today: **{len(direct_item_codes)} nodes**.",
        f"- Inference-only until more items are generated: **{len(set(FULL_RELATED_CODES) - direct_item_codes)} nodes**.",
        f"- Internal prerequisite edges inside this scope: **{len(edges)} edges**.",
        "",
        "## Interpretation",
        "",
        "This is not a promise that one 30-35 question assessment can directly test all nodes. The assessment should use the full scope as the reportable/inference graph, while direct questions prioritize the core and Grade 6-7 foundation nodes most likely to explain the student's failure on I.2, II.1, II.2, III.1, and III.2.",
        "",
        "## Exam Question To Node Map",
        "",
    ]

    for question_id, info in QUESTION_MAP.items():
        lines.extend([
            f"### {question_id}",
            "",
            f"- Student signal: `{info['status']}`",
            f"- Task: {info['description']}",
            f"- Primary nodes: {', '.join(f'`{code}`' for code in info['primary'])}",
            "",
        ])

    lines.extend(["## Strand Scope", ""])
    for strand, codes in STRANDS.items():
        lines.extend([f"### {strand}", ""])
        for code in codes:
            node = nodes[code]
            marker = "direct item" if code in direct_item_codes else "inference only"
            core_marker = "core" if code in CORE_DIAGNOSTIC_CODES else "context"
            lines.append(f"- `{code}` · G{node['grade']} · {node['name']} · {core_marker}, {marker}")
        lines.append("")

    lines.extend(["## Full Node Audit", ""])
    for grade in sorted(by_grade):
        lines.extend([f"### Grade {grade}", ""])
        lines.append("| Code | Node name | Diagnostic role | Direct item? | Description excerpt |")
        lines.append("|---|---|---|---|---|")
        for code in by_grade[grade]:
            node = nodes[code]
            role = "core" if code in CORE_DIAGNOSTIC_CODES else "context/root-cause"
            direct = "yes" if code in direct_item_codes else "no"
            lines.append(
                f"| `{code}` | {node['name']} | {role} | {direct} | {_short_description(node)} |"
            )
        lines.append("")

    lines.extend(["## Internal Edges", ""])
    if edges:
        lines.append("| Prerequisite | Target | Interpretation |")
        lines.append("|---|---|---|")
        for edge in edges:
            source = edge["source_code"]
            target = edge["target_code"]
            lines.append(f"| `{source}` | `{target}` | If `{target}` is hard, `{source}` is a plausible prerequisite to probe. |")
    else:
        lines.append("No internal production edges were found inside this curated scope.")
    lines.append("")

    lines.extend(["## Item Gap Queue", ""])
    missing_direct = sorted(set(FULL_RELATED_CODES) - direct_item_codes)
    if missing_direct:
        lines.append("These nodes are in the root-cause graph but do not yet have direct Grade 8 path items:")
        lines.append("")
        for code in missing_direct:
            node = nodes[code]
            lines.append(f"- `{code}` · G{node['grade']} · {node['name']}")
    else:
        lines.append("All full-scope nodes currently have at least one direct item.")
    lines.append("")

    OUT_MD.write_text("\n".join(lines) + "\n", encoding="utf-8")


async def main() -> None:
    nodes, edges = await _load_production_graph()
    _validate(nodes)
    _write_scope_json(nodes, edges)
    _write_markdown(nodes, edges)
    direct_count = len(_load_direct_item_codes())
    print(
        json.dumps(
            {
                "full_related_scope": len(FULL_RELATED_CODES),
                "core_diagnostic_scope": len(CORE_DIAGNOSTIC_CODES),
                "direct_item_scope": direct_count,
                "inference_only_scope": len(set(FULL_RELATED_CODES) - set(_load_direct_item_codes())),
                "internal_edges": len(edges),
                "out_json": str(OUT_JSON),
                "out_md": str(OUT_MD),
            },
            ensure_ascii=False,
            indent=2,
        )
    )


if __name__ == "__main__":
    asyncio.run(main())
