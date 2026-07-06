"""Generate draft items for the Grade 8 exam-path official assessment.

This does not insert anything into production. It only creates review artifacts:

- docs/grade8_exam_path_official_item_drafts.json
- docs/grade8_exam_path_official_item_drafts.md
"""

from __future__ import annotations

import asyncio
import json
import os
import sys
from fractions import Fraction
from pathlib import Path
from typing import Any

from sqlalchemy import text
from sqlalchemy.ext.asyncio import create_async_engine

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / "backend"))

from app.engines.assessment_v2.item_quality import infer_surface_signature, validate_official_item_bank  # noqa: E402


OUT_JSON = ROOT / "docs" / "grade8_exam_path_official_item_drafts.json"
OUT_MD = ROOT / "docs" / "grade8_exam_path_official_item_drafts.md"
SCOPE_JSON = ROOT / "docs" / "grade8_exam_scope.json"

BASE_KC_CODES = {
    "G8-MATH-TINH-GIA-TRI",
    "G8-MATH-NHAN-BIET-PHAN",
    "G8-MATH-XAC-DINH-DIEU",
    "G8-MATH-XAC-DINH-MAU",
    "G8-MATH-QUY-DONG-MAU",
    "G8-MATH-RUT-GON-PHAN",
    "G8-MATH-KIEM-TRA-HAI",
    "G8-MATH-GIAI-PHUONG-TRINH",
    "G8-MATH-KIEM-TRA-GIA",
    "G8-MATH-NHAN-BIET-PHUONG",
    "G8-MATH-NHAN-BIET-PHUONG-1",
    "G8-MATH-NHAN-BIET-HAM",
    "G8-MATH-TINH-HOAC-XAC",
    "G8-MATH-BIEU-DIEN-DIEM",
    "G8-MATH-BIEU-DIEN-DO",
    "G8-MATH-VE-DO-THI",
    "G8-MATH-XAC-DINH-QUAN",
    "G8-MATH-NHAN-BIET-HUONG",
    "G7-MATH-NHAN-BIET-BIEU",
    "G7-MATH-TINH-GIA-TRI-1",
    "G7-MATH-VIET-BIEU-THUC",
    "G7-MATH-KHAI-NIEM-DANG",
    "G7-MATH-QUY-TAC-CHUYEN",
    "G8-MATH-NHAN-BIET-DA",
    "G8-MATH-THU-GON-DA",
    "G8-MATH-NHAN-DANG-A",
    "G8-MATH-PHAN-TICH-DA",
    "G6-MATH-NHAN-BIET-PHAN-1",
    "G6-MATH-TINH-CHAT-CO",
    "G6-MATH-QUY-DONG-MAU",
    "G6-MATH-CONG-HAI-PHAN-1",
    "G6-MAMATMATHMAT",
    "G6-MATH-NHAN-BIET-HAI",
    "G6-MATH-B31K2",
    "G6-MATH-TIM-GIA-TRI-1",
    "G6-MATH-TIM-MOT-SO",
    "G6-MATH-BO-DAU-NGOAC",
    "G6-MATH-BO-DAU-NGOAC-1",
}


def _scope_kc_codes() -> set[str]:
    if not SCOPE_JSON.exists():
        return set()
    scope = json.loads(SCOPE_JSON.read_text(encoding="utf-8"))
    codes = set(scope.get("full_related_scope_codes") or [])
    codes.update(scope.get("core_diagnostic_scope_codes") or [])
    codes.update(scope.get("support_scope_codes") or [])
    return {str(code) for code in codes if code}


KC_CODES = BASE_KC_CODES | _scope_kc_codes()


def _load_env() -> None:
    env_path = ROOT / "backend" / ".env"
    if not env_path.exists():
        return
    for line in env_path.read_text(encoding="utf-8").splitlines():
        if "=" in line and not line.strip().startswith("#"):
            key, value = line.split("=", 1)
            os.environ.setdefault(key.strip(), value.strip().strip('"').strip("'"))


async def _load_nodes() -> dict[str, dict[str, str]]:
    _load_env()
    engine = create_async_engine(
        os.environ["DATABASE_URL"],
        echo=False,
        connect_args={"statement_cache_size": 0, "prepared_statement_cache_size": 0},
    )
    async with engine.connect() as conn:
        res = await conn.execute(
            text(
                """
                select id::text, code, name
                from knowledge_components
                where code = any(:codes)
                """
            ),
            {"codes": sorted(KC_CODES)},
        )
        rows = {row._mapping["code"]: dict(row._mapping) for row in res}
    missing = sorted(KC_CODES - set(rows))
    if missing:
        raise RuntimeError(f"Missing KC codes in production DB: {missing}")
    return rows


def _base(
    idx: int,
    nodes: dict[str, dict[str, str]],
    *,
    path: str,
    role: str,
    family: str,
    parameter_set: str,
    kc_code: str,
    question: str,
    answer_widget: str,
    checker_type: str,
    accepted_answers: list[str],
    requires_codes: list[str],
    diagnoses_codes: list[str] | None = None,
    common_wrong_patterns: list[dict[str, Any]] | None = None,
    flags: list[str] | None = None,
    difficulty_label: str = "medium",
    is_anchor: bool = False,
) -> dict[str, Any]:
    normalized_wrong_patterns = []
    for pattern in common_wrong_patterns or []:
        pattern_copy = dict(pattern)
        pattern_codes = pattern_copy.get("diagnoses_kc_codes") or []
        if pattern_codes:
            pattern_copy["diagnoses_kcs"] = [nodes[code]["id"] for code in pattern_codes]
        normalized_wrong_patterns.append(pattern_copy)

    return {
        "review_id": f"g8-path-{idx:03d}",
        "cluster": f"Grade 8 Exam Path / {path}",
        "official_assessment_scope": "grade8_exam_path",
        "target_exam_path": path,
        "item_role": role,
        "item_family": family,
        "surface_signature": infer_surface_signature(question),
        "parameter_set": parameter_set,
        "kc_id": nodes[kc_code]["id"],
        "kc_code": kc_code,
        "kc_name": nodes[kc_code]["name"],
        "question": question,
        "answer_type": answer_widget,
        "answer_widget": answer_widget,
        "checker_type": checker_type,
        "accepted_answers": accepted_answers,
        "tolerance": None,
        "difficulty_label": difficulty_label,
        "is_diagnostic_anchor": is_anchor,
        "requires_kcs": [nodes[code]["id"] for code in requires_codes],
        "requires_kc_codes": requires_codes,
        "diagnoses_kcs": [nodes[code]["id"] for code in (diagnoses_codes or [kc_code])],
        "diagnoses_kc_codes": diagnoses_codes or [kc_code],
        "inference_strength": "weak",
        "academic_reviewed": False,
        "pilot_status": "not_ready",
        "review_action": "revise",
        "common_wrong_patterns": normalized_wrong_patterns,
        "flags": flags or [],
        "review_notes": "Draft generated by Codex. Academic review required before pilot use.",
    }


def _wrong(pattern: str, diagnosis: str, codes: list[str]) -> dict[str, Any]:
    return {"pattern": pattern, "mode": "exact", "diagnosis": diagnosis, "diagnoses_kc_codes": codes}


def _items(nodes: dict[str, dict[str, str]]) -> list[dict[str, Any]]:
    items: list[dict[str, Any]] = []
    idx = 1

    def add(**kwargs: Any) -> None:
        nonlocal idx
        items.append(_base(idx, nodes, **kwargs))
        idx += 1

    # Path A: Rational expressions, 30 items.
    for a in [2, 3, 4, 5, 6]:
        add(
            path="rational_expression",
            role="anchor",
            family="domain_single_linear_denominator",
            parameter_set=f"x_plus_{a}",
            kc_code="G8-MATH-XAC-DINH-DIEU",
            question=f"Với phân thức 5/(x + {a}), giá trị nào của x làm phân thức không xác định?",
            answer_widget="number",
            checker_type="numeric_equal",
            accepted_answers=[str(-a)],
            requires_codes=["G8-MATH-NHAN-BIET-PHAN"],
            common_wrong_patterns=[_wrong(str(a), "Quên đổi dấu khi giải x + a = 0.", ["G8-MATH-XAC-DINH-DIEU"])],
            is_anchor=True,
        )
    for a in [2, 3, 4, 5, 6]:
        add(
            path="rational_expression",
            role="misconception",
            family="factor_common_x_from_quadratic",
            parameter_set=f"x2_plus_{a}x",
            kc_code="G8-MATH-PHAN-TICH-DA",
            question=f"Điền biểu thức còn thiếu: x^2 + {a}x = x · ____.",
            answer_widget="expression",
            checker_type="expression_equivalent",
            accepted_answers=[f"x+{a}"],
            requires_codes=["G8-MATH-NHAN-BIET-DA"],
            common_wrong_patterns=[_wrong(str(a), "Chỉ lấy hệ số, bỏ mất biến x trong nhân tử còn lại.", ["G8-MATH-PHAN-TICH-DA"])],
        )
    for a in [2, 3, 4, 5, 6]:
        add(
            path="rational_expression",
            role="bridge",
            family="common_denominator_x_and_x_plus_a",
            parameter_set=f"x_xplus{a}",
            kc_code="G8-MATH-XAC-DINH-MAU",
            question=f"Mẫu thức chung đơn giản của hai phân thức 1/x và 1/(x + {a}) là gì?",
            answer_widget="expression",
            checker_type="expression_equivalent",
            accepted_answers=[f"x*(x+{a})"],
            requires_codes=["G8-MATH-NHAN-BIET-PHAN", "G8-MATH-NHAN-BIET-DA"],
        )
    for a in [2, 3, 4, 5, 6]:
        add(
            path="rational_expression",
            role="confirmation",
            family="convert_one_over_x_to_common_denominator",
            parameter_set=f"den_x_xplus{a}",
            kc_code="G8-MATH-QUY-DONG-MAU",
            question=f"Khi quy đồng 1/x về mẫu x(x + {a}), tử thức mới là gì?",
            answer_widget="expression",
            checker_type="expression_equivalent",
            accepted_answers=[f"x+{a}"],
            requires_codes=["G8-MATH-XAC-DINH-MAU", "G6-MATH-TINH-CHAT-CO"],
        )
    for a in [2, 3, 4, 5, 6]:
        add(
            path="rational_expression",
            role="transfer",
            family="difference_of_squares_factor_missing",
            parameter_set=f"x2_minus_{a*a}",
            kc_code="G8-MATH-NHAN-DANG-A",
            question=f"Điền nhân tử còn thiếu: x^2 - {a*a} = (x - {a})(____).",
            answer_widget="expression",
            checker_type="expression_equivalent",
            accepted_answers=[f"x+{a}"],
            requires_codes=["G8-MATH-NHAN-BIET-DA"],
        )
    for a in [2, 3, 4, 5, 6]:
        add(
            path="rational_expression",
            role="bridge",
            family="simplify_cancel_common_factor",
            parameter_set=f"x2_minus_{a*a}_over_x_xplus{a}",
            kc_code="G8-MATH-RUT-GON-PHAN",
            question=f"Rút gọn phân thức (x^2 - {a*a})/[x(x + {a})].",
            answer_widget="expression",
            checker_type="expression_equivalent",
            accepted_answers=[f"(x-{a})/x"],
            requires_codes=["G8-MATH-NHAN-DANG-A", "G8-MATH-NHAN_BIET-PHAN".replace("_", "-")],
            flags=["concept_missing_explicit_graph_node:cộng_trừ_phân_thức"],
        )

    # Path B: Linear equations, 25 items.
    for a, b, c, d, ans in [(3, 2, 5, 2, 1), (4, 1, 2, 2, 1), (5, 2, 7, 3, 3), (2, 5, 1, 1, 9), (6, 1, -4, 2, 1)]:
        add(
            path="linear_equation",
            role="anchor",
            family="solve_linear_parentheses_ax_minus_b_plus_c_eq_dx",
            parameter_set=f"{a}_{b}_{c}_{d}",
            kc_code="G8-MATH-GIAI-PHUONG-TRINH",
            question=f"Giải phương trình: {a}(x - {b}) + {c} = {d}x.",
            answer_widget="number",
            checker_type="numeric_equal",
            accepted_answers=[str(ans)],
            requires_codes=["G6-MATH-BO-DAU-NGOAC", "G7-MATH-QUY-TAC-CHUYEN"],
            is_anchor=True,
        )
    for a, b in [(3, 2), (4, 3), (5, 1), (2, 7), (6, 4)]:
        add(
            path="linear_equation",
            role="misconception",
            family="expand_coefficient_parentheses",
            parameter_set=f"{a}_x_minus_{b}",
            kc_code="G6-MATH-BO-DAU-NGOAC",
            question=f"Khai triển biểu thức {a}(x - {b}).",
            answer_widget="expression",
            checker_type="expression_equivalent",
            accepted_answers=[f"{a}*x-{a*b}"],
            requires_codes=[],
            diagnoses_codes=["G6-MATH-BO-DAU-NGOAC"],
            common_wrong_patterns=[_wrong(f"{a}x-{b}", "Chỉ nhân hệ số với x, không nhân vào hằng số trong ngoặc.", ["G6-MATH-BO-DAU-NGOAC"])],
        )
    for lhs, rhs, ans in [("3*x-1", "2*x", "1"), ("4*x+5", "2*x+9", "2"), ("5*x-7", "3*x+1", "4"), ("2*x+11", "5*x-1", "4"), ("7*x-6", "4*x+9", "5")]:
        add(
            path="linear_equation",
            role="confirmation",
            family="solve_linear_collect_like_terms",
            parameter_set=f"{lhs}_eq_{rhs}".replace("*", ""),
            kc_code="G8-MATH-GIAI-PHUONG-TRINH",
            question=f"Giải phương trình: {lhs.replace('*', '')} = {rhs.replace('*', '')}.",
            answer_widget="number",
            checker_type="numeric_equal",
            accepted_answers=[ans],
            requires_codes=["G7-MATH-QUY-TAC-CHUYEN"],
        )
    for den1, den2, a, b in [(3, 6, 2, 3), (2, 4, 1, 3), (5, 10, 2, 1), (4, 8, 3, 2), (6, 12, 1, 5)]:
        ans = Fraction(1, 1) + Fraction(a, den1) + Fraction(b, den2)
        ans = ans / (Fraction(1, den1) + Fraction(2, den2))
        add(
            path="linear_equation",
            role="transfer",
            family="solve_linear_with_numeric_denominators",
            parameter_set=f"{den1}_{den2}_{a}_{b}",
            kc_code="G8-MATH-GIAI-PHUONG-TRINH",
            question=f"Giải phương trình: (x - {a})/{den1} + (2x - {b})/{den2} = 1.",
            answer_widget="fraction",
            checker_type="fraction_equal",
            accepted_answers=[f"{ans.numerator}/{ans.denominator}" if ans.denominator != 1 else str(ans.numerator)],
            requires_codes=["G6-MATH-QUY-DONG-MAU", "G6-MATH-CONG-HAI-PHAN-1", "G7-MATH-QUY-TAC-CHUYEN"],
        )
    for ans, eq in [(1, "3*x-1=2*x"), (2, "4*x+5=2*x+9"), (3, "5*x-4=3*x+2"), (4, "2*x+1=9"), (5, "7*x-6=4*x+9")]:
        add(
            path="linear_equation",
            role="bridge",
            family="check_solution_by_lhs_minus_rhs",
            parameter_set=f"{ans}_{eq}".replace("*", ""),
            kc_code="G8-MATH-KIEM-TRA-GIA",
            question=f"Với phương trình {eq.replace('*', '')}, tính giá trị vế trái trừ vế phải khi x = {ans}.",
            answer_widget="number",
            checker_type="numeric_equal",
            accepted_answers=["0"],
            requires_codes=["G7-MATH-TINH-GIA-TRI-1"],
        )

    # Grade 7 prerequisite probes for Grade 8 linear equations and functions.
    for expr, answer in [
        ("3x + 5", "x"),
        ("4a - 7", "a"),
        ("2m + n", "m;n"),
        ("5t", "t"),
        ("p/3 + 2", "p"),
    ]:
        add(
            path="linear_equation",
            role="prerequisite_probe",
            family="identify_variable_in_algebraic_expression",
            parameter_set=expr.replace(" ", "").replace("+", "plus").replace("-", "minus").replace("/", "over"),
            kc_code="G7-MATH-NHAN-BIET-BIEU",
            question=f"Trong biểu thức {expr}, biến là gì? Nếu có nhiều biến, viết theo thứ tự xuất hiện và ngăn cách bằng dấu chấm phẩy.",
            answer_widget="set" if ";" in answer else "expression",
            checker_type="set_equal" if ";" in answer else "expression_equivalent",
            accepted_answers=[answer],
            requires_codes=[],
            diagnoses_codes=["G7-MATH-NHAN-BIET-BIEU"],
        )
    for expr, values, answer in [
        ("3x + 5", "x = 2", "11"),
        ("2a - 7", "a = 5", "3"),
        ("m/2 + 4", "m = 6", "7"),
        ("5 - 3t", "t = -1", "8"),
        ("2x + y", "x = 3, y = 4", "10"),
    ]:
        add(
            path="linear_equation",
            role="prerequisite_probe",
            family="evaluate_algebraic_expression_given_values",
            parameter_set=f"{expr}_{values}".replace(" ", "").replace("+", "plus").replace("-", "minus").replace("/", "over").replace("=", "eq").replace(",", "_"),
            kc_code="G7-MATH-TINH-GIA-TRI-1",
            question=f"Tính giá trị của biểu thức {expr} khi {values}.",
            answer_widget="number",
            checker_type="numeric_equal",
            accepted_answers=[answer],
            requires_codes=["G7-MATH-NHAN-BIET-BIEU"],
            diagnoses_codes=["G7-MATH-TINH-GIA-TRI-1"],
        )
    for equation, side, answer in [
        ("3x + 2 = 11", "trái", "3x+2"),
        ("5 - y = 2y + 1", "phải", "2y+1"),
        ("a/2 + 4 = 10", "trái", "a/2+4"),
        ("7 = 2m - 3", "phải", "2m-3"),
        ("p + 6 = 4p", "trái", "p+6"),
    ]:
        add(
            path="linear_equation",
            role="prerequisite_probe",
            family="identify_side_of_equation",
            parameter_set=f"{equation}_{side}".replace(" ", "").replace("+", "plus").replace("-", "minus").replace("/", "over").replace("=", "eq"),
            kc_code="G7-MATH-KHAI-NIEM-DANG",
            question=f"Trong đẳng thức {equation}, viết biểu thức ở vế {side}.",
            answer_widget="expression",
            checker_type="expression_equivalent",
            accepted_answers=[answer],
            requires_codes=["G7-MATH-NHAN-BIET-BIEU"],
            diagnoses_codes=["G7-MATH-KHAI-NIEM-DANG"],
        )
    for equation, variable, answer in [
        ("x + 5 = 12", "x", "7"),
        ("y - 4 = 9", "y", "13"),
        ("3x = 18", "x", "6"),
        ("a/2 = 7", "a", "14"),
        ("2m + 3 = 11", "m", "4"),
    ]:
        add(
            path="linear_equation",
            role="prerequisite_probe",
            family="solve_one_step_or_two_step_equation_by_transposition",
            parameter_set=equation.replace(" ", "").replace("+", "plus").replace("-", "minus").replace("/", "over").replace("=", "eq"),
            kc_code="G7-MATH-QUY-TAC-CHUYEN",
            question=f"Giải phương trình {equation}. Giá trị của {variable} là bao nhiêu?",
            answer_widget="number",
            checker_type="numeric_equal",
            accepted_answers=[answer],
            requires_codes=["G7-MATH-KHAI-NIEM-DANG"],
            diagnoses_codes=["G7-MATH-QUY-TAC-CHUYEN"],
        )

    # Path C: Word-problem modeling, 22 items.
    for pct in ["6", "5.8", "7.5"]:
        decimal = str(Fraction(pct) / 100)
        add(
            path="word_problem_modeling",
            role="anchor",
            family="percent_to_decimal",
            parameter_set=pct.replace(".", "_"),
            kc_code="G6-MATH-B31K2",
            question=f"Viết {pct}% dưới dạng số thập phân.",
            answer_widget="decimal",
            checker_type="decimal_equal",
            accepted_answers=[decimal],
            requires_codes=[],
            diagnoses_codes=["G6-MATH-B31K2"],
        )
    for total in [300, 250, 180, 420]:
        add(
            path="word_problem_modeling",
            role="misconception",
            family="represent_remaining_amount_total_minus_x",
            parameter_set=str(total),
            kc_code="G7-MATH-VIET-BIEU-THUC",
            question=f"Một tổng tiền {total} triệu được chia làm hai phần. Nếu phần thứ nhất là x triệu, phần thứ hai là bao nhiêu triệu?",
            answer_widget="expression",
            checker_type="expression_equivalent",
            accepted_answers=[f"{total}-x"],
            requires_codes=["G7-MATH-NHAN-BIET-BIEU"],
        )
    for pct, amount in [(6, "x"), (5.8, "300-x"), (7, "x"), (4.5, "250-x")]:
        accepted = f"{float(pct)/100}*({amount})" if "-" in amount else f"{float(pct)/100}*{amount}"
        add(
            path="word_problem_modeling",
            role="confirmation",
            family="write_interest_expression",
            parameter_set=f"{pct}_{amount}".replace(".", "_"),
            kc_code="G6-MATH-TIM-GIA-TRI-1",
            question=f"Viết biểu thức tiền lãi của khoản {amount} triệu với lãi suất {pct}% một năm.",
            answer_widget="expression",
            checker_type="expression_equivalent",
            accepted_answers=[accepted],
            requires_codes=["G6-MATH-B31K2", "G7-MATH-NHAN-BIET-BIEU"],
        )
    for total, p1, p2, interest in [(300, 6, 5.8, 17.72), (250, 7, 5, 16), (200, 8, 6, 14), (400, 6.5, 5, 23)]:
        add(
            path="word_problem_modeling",
            role="transfer",
            family="build_interest_equation_from_context",
            parameter_set=f"{total}_{p1}_{p2}_{interest}".replace(".", "_"),
            kc_code="G7-MATH-VIET-BIEU-THUC",
            question=f"Tổng {total} triệu chia vào hai khoản. Khoản A là x triệu lãi {p1}%, khoản B là phần còn lại lãi {p2}%. Tổng lãi là {interest} triệu. Viết phương trình theo x.",
            answer_widget="expression",
            checker_type="expression_equivalent",
            accepted_answers=[f"{float(p1)/100}*x+{float(p2)/100}*({total}-x)"],
            requires_codes=["G6-MATH-B31K2", "G6-MATH-TIM-GIA-TRI-1"],
            flags=["concept_missing_explicit_graph_node:lập_phương_trình_bài_toán"],
        )
    for total, p1, p2, x in [(300, 6, 5.8, 160), (250, 7, 5, 175), (200, 8, 6, 100), (400, 6.5, 5, 200)]:
        interest = (p1 / 100) * x + (p2 / 100) * (total - x)
        add(
            path="word_problem_modeling",
            role="bridge",
            family="solve_interest_model_for_first_amount",
            parameter_set=f"{total}_{p1}_{p2}_{x}".replace(".", "_"),
            kc_code="G8-MATH-GIAI-PHUONG-TRINH",
            question=f"Giải phương trình 0.{'0' if p1 < 10 else ''}{str(p1).replace('.', '')}x + {p2/100}({total} - x) = {interest:.2f}. Tìm x.",
            answer_widget="number",
            checker_type="numeric_equal",
            accepted_answers=[str(x)],
            requires_codes=["G7-MATH-VIET-BIEU-THUC", "G7-MATH-QUY-TAC-CHUYEN"],
            flags=["concept_missing_explicit_graph_node:lập_phương_trình_bài_toán"],
        )
    # Add two extra modeling anchors.
    for total, x in [(300, 160), (250, 175), (400, 200)]:
        add(
            path="word_problem_modeling",
            role="confirmation",
            family="compute_remaining_amount",
            parameter_set=f"{total}_{x}",
            kc_code="G7-MATH-VIET-BIEU-THUC",
            question=f"Tổng tiền là {total} triệu. Nếu khoản A là {x} triệu thì khoản B là bao nhiêu triệu?",
            answer_widget="number",
            checker_type="numeric_equal",
            accepted_answers=[str(total - x)],
            requires_codes=[],
        )

    # Path D: Linear functions, 24 items.
    for a, b in [(2, -4), (3, 1), (-2, 5), (4, -3), (1, -6)]:
        add(
            path="linear_function",
            role="anchor",
            family="identify_slope_in_y_ax_plus_b",
            parameter_set=f"{a}_{b}",
            kc_code="G8-MATH-NHAN-BIET-HAM",
            question=f"Trong hàm số y = {a}x {'+' if b >= 0 else '-'} {abs(b)}, hệ số a là bao nhiêu?",
            answer_widget="number",
            checker_type="numeric_equal",
            accepted_answers=[str(a)],
            requires_codes=[],
            is_anchor=True,
        )
    for a, b, x in [(2, -4, 0), (2, -4, 2), (3, 1, -1), (-2, 5, 3)]:
        y = a * x + b
        add(
            path="linear_function",
            role="confirmation",
            family="compute_function_value_linear",
            parameter_set=f"{a}_{b}_{x}",
            kc_code="G8-MATH-TINH-HOAC-XAC",
            question=f"Với y = {a}x {'+' if b >= 0 else '-'} {abs(b)}, tính y khi x = {x}.",
            answer_widget="number",
            checker_type="numeric_equal",
            accepted_answers=[str(y)],
            requires_codes=["G7-MATH-TINH-GIA-TRI-1"],
        )
    for a, b, x in [(2, -4, 0), (2, -4, 2), (3, 1, 1), (-2, 5, 2), (4, -3, 0)]:
        y = a * x + b
        add(
            path="linear_function",
            role="transfer",
            family="point_on_line_from_x_value",
            parameter_set=f"{a}_{b}_{x}",
            kc_code="G8-MATH-BIEU-DIEN-DIEM",
            question=f"Trên đồ thị y = {a}x {'+' if b >= 0 else '-'} {abs(b)}, điểm ứng với x = {x} có tọa độ là gì?",
            answer_widget="coordinate_pair",
            checker_type="coordinate_pair_equal",
            accepted_answers=[f"({x},{y})"],
            requires_codes=["G8-MATH-TINH-HOAC-XAC"],
        )
    for a, b in [(2, -4), (3, 1), (-2, 5), (4, -3), (1, -6)]:
        p1 = (0, b)
        p2 = (1, a + b)
        add(
            path="linear_function",
            role="bridge",
            family="two_points_for_line_graph",
            parameter_set=f"{a}_{b}",
            kc_code="G8-MATH-VE-DO-THI",
            question=f"Cho hàm số y = {a}x {'+' if b >= 0 else '-'} {abs(b)}. Viết hai điểm thuộc đồ thị theo thứ tự khi x = 0 rồi x = 1.",
            answer_widget="ordered_pair_list",
            checker_type="ordered_pair_list_equal",
            accepted_answers=[f"({p1[0]},{p1[1]});({p2[0]},{p2[1]})"],
            requires_codes=["G8-MATH-TINH-HOAC-XAC", "G8-MATH-BIEU-DIEN-DIEM"],
        )
    for a, b, m_answer in [(2, -4, "1"), (5, 1, "2"), (10, -2, "3"), (17, 3, "4"), (26, -4, "5")]:
        # m^2 + 1 = a, choose cases where the positive answer is simple except one stretch item.
        add(
            path="linear_function",
            role="misconception",
            family="parallel_parameter_m_squared_plus_one",
            parameter_set=f"{a}_{b}",
            kc_code="G8-MATH-XAC-DINH-QUAN",
            question=f"Đường thẳng d1: y = {a}x {'+' if b >= 0 else '-'} {abs(b)}. Đường thẳng d2: y = (m^2 + 1)x + m - 3. Giá trị dương của m để hai đường có cùng hệ số góc là gì?",
            answer_widget="number" if m_answer.isdigit() else "expression",
            checker_type="numeric_equal" if m_answer.isdigit() else "expression_equivalent",
            accepted_answers=[m_answer],
            requires_codes=["G8-MATH-NHAN-BIET-HAM"],
            flags=["concept_missing_explicit_graph_node:tham_số_đường_thẳng"],
        )

    # Core diagnostic direct-coverage top-up.
    # These items make the documented Grade 8 core scope directly testable instead of inference-only.
    for question, answer in [
        ("Trong phân số -7/9, tử số là bao nhiêu?", "-7"),
        ("Trong phân số 0/8, mẫu số là bao nhiêu?", "8"),
        ("Với biểu thức 5/n, giá trị nào của n làm biểu thức không phải là phân số?", "0"),
    ]:
        add(
            path="rational_expression",
            role="prerequisite_probe",
            family="recognize_valid_fraction_parts",
            parameter_set=question.replace(" ", "_"),
            kc_code="G6-MATH-NHAN-BIET-PHAN-1",
            question=question,
            answer_widget="number",
            checker_type="numeric_equal",
            accepted_answers=[answer],
            requires_codes=[],
            diagnoses_codes=["G6-MATH-NHAN-BIET-PHAN-1"],
        )
    for question, answer in [
        ("Điền mẫu số còn thiếu: 3/5 = 12/____.", "20"),
        ("Điền tử số còn thiếu: -2/7 = ____/21.", "-6"),
        ("Điền mẫu số còn thiếu: 15/20 = 3/____.", "4"),
    ]:
        add(
            path="rational_expression",
            role="prerequisite_probe",
            family="equivalent_fraction_missing_part",
            parameter_set=question.replace(" ", "_"),
            kc_code="G6-MATH-TINH-CHAT-CO",
            question=question,
            answer_widget="number",
            checker_type="numeric_equal",
            accepted_answers=[answer],
            requires_codes=["G6-MATH-NHAN-BIET-PHAN-1"],
            diagnoses_codes=["G6-MATH-TINH-CHAT-CO"],
        )
    for question, answer in [
        ("Khi quy đồng 1/3 lên mẫu 12, tử số mới là bao nhiêu?", "4"),
        ("Mẫu chung nhỏ nhất của 2/3 và 5/6 là bao nhiêu?", "6"),
        ("Khi quy đồng -1/4 lên mẫu 12, tử số mới là bao nhiêu?", "-3"),
    ]:
        add(
            path="rational_expression",
            role="prerequisite_probe",
            family="common_denominator_fraction_numeric_probe",
            parameter_set=question.replace(" ", "_"),
            kc_code="G6-MATH-QUY-DONG-MAU",
            question=question,
            answer_widget="number",
            checker_type="numeric_equal",
            accepted_answers=[answer],
            requires_codes=["G6-MATH-TINH-CHAT-CO"],
            diagnoses_codes=["G6-MATH-QUY-DONG-MAU"],
        )
    for question, answer in [
        ("Tính 1/3 + 1/6. Viết kết quả tối giản.", "1/2"),
        ("Tính -1/4 + 3/8. Viết kết quả tối giản.", "1/8"),
        ("Tính 2/5 + 1/10. Viết kết quả tối giản.", "1/2"),
    ]:
        add(
            path="linear_equation",
            role="prerequisite_probe",
            family="add_unlike_fractions_numeric",
            parameter_set=question.replace(" ", "_"),
            kc_code="G6-MATH-CONG-HAI-PHAN-1",
            question=question,
            answer_widget="fraction",
            checker_type="fraction_equal",
            accepted_answers=[answer],
            requires_codes=["G6-MATH-QUY-DONG-MAU"],
            diagnoses_codes=["G6-MATH-CONG-HAI-PHAN-1"],
        )
    for question, answer in [
        ("Tính 3/4 - 1/6. Viết kết quả tối giản.", "7/12"),
        ("Tính 5/6 - 1/3. Viết kết quả tối giản.", "1/2"),
        ("Tính 1/4 - 2/3. Viết kết quả tối giản.", "-5/12"),
    ]:
        add(
            path="linear_equation",
            role="prerequisite_probe",
            family="subtract_unlike_fractions_numeric",
            parameter_set=question.replace(" ", "_"),
            kc_code="G6-MAMATMATHMAT",
            question=question,
            answer_widget="fraction",
            checker_type="fraction_equal",
            accepted_answers=[answer],
            requires_codes=["G6-MATH-QUY-DONG-MAU"],
            diagnoses_codes=["G6-MAMATMATHMAT"],
        )
    for question, answer in [
        ("Với hai phân số 2/3 và 4/6, tích chéo 2·6 bằng bao nhiêu?", "12"),
        ("Điền tử số còn thiếu để k/12 = 1/3.", "4"),
        ("Điền mẫu số còn thiếu để 6/k = 2/5.", "15"),
    ]:
        add(
            path="rational_expression",
            role="prerequisite_probe",
            family="fraction_cross_product_missing_part",
            parameter_set=question.replace(" ", "_"),
            kc_code="G6-MATH-NHAN-BIET-HAI",
            question=question,
            answer_widget="number",
            checker_type="numeric_equal",
            accepted_answers=[answer],
            requires_codes=["G6-MATH-NHAN-BIET-PHAN-1"],
            diagnoses_codes=["G6-MATH-NHAN-BIET-HAI"],
        )
    for question, answer in [
        ("20% của một số là 12. Số đó là bao nhiêu?", "60"),
        ("25% của một số là 40. Số đó là bao nhiêu?", "160"),
        ("5% của một số là 9. Số đó là bao nhiêu?", "180"),
    ]:
        add(
            path="word_problem_modeling",
            role="prerequisite_probe",
            family="find_whole_from_percent_value",
            parameter_set=question.replace(" ", "_"),
            kc_code="G6-MATH-TIM-MOT-SO",
            question=question,
            answer_widget="number",
            checker_type="numeric_equal",
            accepted_answers=[answer],
            requires_codes=["G6-MATH-B31K2"],
            diagnoses_codes=["G6-MATH-TIM-MOT-SO"],
        )
    for question, answer in [
        ("Bỏ ngoặc và thu gọn: x - (3 - y).", "x-3+y"),
        ("Bỏ ngoặc và thu gọn: 5 - (a + 2).", "3-a"),
        ("Bỏ ngoặc và thu gọn: m - (-2 + n).", "m+2-n"),
    ]:
        add(
            path="linear_equation",
            role="prerequisite_probe",
            family="remove_parentheses_minus_before",
            parameter_set=question.replace(" ", "_"),
            kc_code="G6-MATH-BO-DAU-NGOAC-1",
            question=question,
            answer_widget="expression",
            checker_type="expression_equivalent",
            accepted_answers=[answer],
            requires_codes=["G6-MATH-BO-DAU-NGOAC"],
            diagnoses_codes=["G6-MATH-BO-DAU-NGOAC-1"],
        )
    for question, answer in [
        ("Trong phân thức (2x - 1)/(x + 3), mẫu thức là gì?", "x+3"),
        ("Trong phân thức (x^2 + 1)/(3x - 2), tử thức là gì?", "x^2+1"),
        ("Khi xem đa thức 5x - 4 là một phân thức, mẫu thức bằng bao nhiêu?", "1"),
    ]:
        add(
            path="rational_expression",
            role="anchor",
            family="identify_rational_expression_part",
            parameter_set=question.replace(" ", "_"),
            kc_code="G8-MATH-NHAN-BIET-PHAN",
            question=question,
            answer_widget="expression" if answer != "1" else "number",
            checker_type="expression_equivalent" if answer != "1" else "numeric_equal",
            accepted_answers=[answer],
            requires_codes=["G8-MATH-NHAN-BIET-DA"],
            diagnoses_codes=["G8-MATH-NHAN-BIET-PHAN"],
        )
    for question, answer in [
        ("Với hai phân thức (x + 1)/(x - 1) và (x + 2)/(x - 2), tích chéo A·D là gì?", "(x+1)*(x-2)"),
        ("Với hai phân thức x/(x + 3) và 2/(x - 1), tích chéo B·C là gì?", "2*(x+3)"),
        ("Với hai phân thức k/(x + 2) và 3/x, theo tích chéo vế phải của đẳng thức k·x = ____ là gì?", "3*(x+2)"),
    ]:
        add(
            path="rational_expression",
            role="confirmation",
            family="rational_expression_cross_product_component",
            parameter_set=question.replace(" ", "_"),
            kc_code="G8-MATH-KIEM-TRA-HAI",
            question=question,
            answer_widget="expression",
            checker_type="expression_equivalent",
            accepted_answers=[answer],
            requires_codes=["G8-MATH-NHAN-BIET-PHAN"],
            diagnoses_codes=["G8-MATH-KIEM-TRA-HAI"],
        )
    for question, answer in [
        ("Trong đa thức x^2y - 3xy + 5, có bao nhiêu hạng tử?", "3"),
        ("Trong đa thức 2x^2 - y + 7, viết hạng tử thứ hai kèm dấu.", "-y"),
        ("Trong đa thức a^2b + 4ab - 1, có bao nhiêu hạng tử chứa biến?", "2"),
    ]:
        add(
            path="rational_expression",
            role="prerequisite_probe",
            family="identify_polynomial_terms",
            parameter_set=question.replace(" ", "_"),
            kc_code="G8-MATH-NHAN-BIET-DA",
            question=question,
            answer_widget="number" if answer.lstrip("-").isdigit() else "expression",
            checker_type="numeric_equal" if answer.lstrip("-").isdigit() else "expression_equivalent",
            accepted_answers=[answer],
            requires_codes=[],
            diagnoses_codes=["G8-MATH-NHAN-BIET-DA"],
        )
    for question, answer in [
        ("Thu gọn đa thức x^2 + 3x^2 - 2y.", "4*x^2-2*y"),
        ("Thu gọn đa thức 5xy - 2xy + 4.", "3*x*y+4"),
        ("Thu gọn đa thức 2a - 7 + 3a + 1.", "5*a-6"),
    ]:
        add(
            path="rational_expression",
            role="prerequisite_probe",
            family="combine_like_terms_polynomial",
            parameter_set=question.replace(" ", "_"),
            kc_code="G8-MATH-THU-GON-DA",
            question=question,
            answer_widget="expression",
            checker_type="expression_equivalent",
            accepted_answers=[answer],
            requires_codes=["G8-MATH-NHAN-BIET-DA"],
            diagnoses_codes=["G8-MATH-THU-GON-DA"],
        )
    for question, answer in [
        ("Trong phương trình 2x + 5 = 11, ẩn là gì?", "x"),
        ("Trong hệ thức x + y = 3, có bao nhiêu ẩn?", "2"),
        ("Trong phương trình 4t - 7 = 9, ẩn là gì?", "t"),
    ]:
        add(
            path="linear_equation",
            role="prerequisite_probe",
            family="recognize_one_variable_equation_structure",
            parameter_set=question.replace(" ", "_"),
            kc_code="G8-MATH-NHAN-BIET-PHUONG",
            question=question,
            answer_widget="number" if answer.isdigit() else "expression",
            checker_type="numeric_equal" if answer.isdigit() else "expression_equivalent",
            accepted_answers=[answer],
            requires_codes=["G7-MATH-NHAN-BIET-BIEU"],
            diagnoses_codes=["G8-MATH-NHAN-BIET-PHUONG"],
        )
    for question, answer in [
        ("Trong phương trình 3x + 6 = 0, hệ số a của dạng ax + b = 0 là bao nhiêu?", "3"),
        ("Trong phương trình 5 - 2x = 0, hệ số a của dạng ax + b = 0 là bao nhiêu?", "-2"),
        ("Trong phương trình x^2 + 1 = 0, bậc cao nhất của x là bao nhiêu?", "2"),
    ]:
        add(
            path="linear_equation",
            role="prerequisite_probe",
            family="identify_first_degree_equation_coefficients",
            parameter_set=question.replace(" ", "_"),
            kc_code="G8-MATH-NHAN-BIET-PHUONG-1",
            question=question,
            answer_widget="number",
            checker_type="numeric_equal",
            accepted_answers=[answer],
            requires_codes=["G8-MATH-NHAN-BIET-PHUONG"],
            diagnoses_codes=["G8-MATH-NHAN-BIET-PHUONG-1"],
        )
    for question, answer in [
        ("Từ bảng x: 0, 1, 2 và y: -4, -2, 0, viết điểm ứng với x = 2.", "(2,0)"),
        ("Từ bảng x: -1, 0, 1 và y: 3, 1, -1, viết điểm ứng với x = -1.", "(-1,3)"),
        ("Từ bảng x: 0, 1 và y: 5, 8, viết hai điểm theo thứ tự x = 0 rồi x = 1.", "(0,5);(1,8)"),
    ]:
        add(
            path="linear_function",
            role="prerequisite_probe",
            family="represent_points_from_value_table",
            parameter_set=question.replace(" ", "_"),
            kc_code="G8-MATH-BIEU-DIEN-DO",
            question=question,
            answer_widget="ordered_pair_list" if ";" in answer else "coordinate_pair",
            checker_type="ordered_pair_list_equal" if ";" in answer else "coordinate_pair_equal",
            accepted_answers=[answer],
            requires_codes=["G8-MATH-BIEU-DIEN-DIEM"],
            diagnoses_codes=["G8-MATH-BIEU-DIEN-DO"],
        )
    for question, answer in [
        ("Với y = -2x + 3, khi x tăng thêm 1 thì y thay đổi bao nhiêu?", "-2"),
        ("Với y = 3x - 1, khi x tăng thêm 1 thì y thay đổi bao nhiêu?", "3"),
        ("Với y = -x + 5, khi x tăng thêm 1 thì y thay đổi bao nhiêu?", "-1"),
    ]:
        add(
            path="linear_function",
            role="prerequisite_probe",
            family="slope_direction_as_y_change",
            parameter_set=question.replace(" ", "_"),
            kc_code="G8-MATH-NHAN-BIET-HUONG",
            question=question,
            answer_widget="number",
            checker_type="numeric_equal",
            accepted_answers=[answer],
            requires_codes=["G8-MATH-NHAN-BIET-HAM"],
            diagnoses_codes=["G8-MATH-NHAN-BIET-HUONG"],
        )

    supplemental_items = [
        # Grade 6 fraction and percent roots.
        ("fraction_foundation", "prerequisite_probe", "simplify_fraction_by_gcd", "12_18", "G6-MATH-RUT-GON-VE", "Rút gọn phân số 12/18 về tối giản.", "fraction", "fraction_equal", ["2/3"], ["G6-MATH-NHAN-BIET-PHAN-1"], ["G6-MATH-RUT-GON-VE"], "6/9"),
        ("fraction_foundation", "prerequisite_probe", "reduce_negative_fraction", "minus15_20", "G6-MATH-RUT-GON-VE", "Viết phân số -15/20 ở dạng tối giản.", "fraction", "fraction_equal", ["-3/4"], ["G6-MATH-NHAN-BIET-PHAN-1"], ["G6-MATH-RUT-GON-VE"], ["3/4"]),
        ("fraction_foundation", "prerequisite_probe", "add_same_denominator_fraction", "2_7_plus_3_7", "G6-MATH-CONG-HAI-PHAN", "Tính 2/7 + 3/7.", "fraction", "fraction_equal", ["5/7"], ["G6-MATH-NHAN-BIET-PHAN-1"], ["G6-MATH-CONG-HAI-PHAN"], ["5/14"]),
        ("fraction_foundation", "prerequisite_probe", "combine_signed_same_denominator_fraction", "minus1_5_plus_3_5", "G6-MATH-CONG-HAI-PHAN", "Điền kết quả tối giản: -1/5 + 3/5 = ____.", "fraction", "fraction_equal", ["2/5"], ["G6-MATH-NHAN-BIET-PHAN-1"], ["G6-MATH-CONG-HAI-PHAN"], ["-4/5"]),
        ("fraction_foundation", "prerequisite_probe", "subtract_same_denominator_fraction", "5_7_minus_2_7", "G6-MATH-TRU-HAI-PHAN", "Tính 5/7 - 2/7.", "fraction", "fraction_equal", ["3/7"], ["G6-MATH-NHAN-BIET-PHAN-1"], ["G6-MATH-TRU-HAI-PHAN"], ["3/0"]),
        ("fraction_foundation", "prerequisite_probe", "subtract_signed_same_denominator_fraction", "minus1_6_minus_3_6", "G6-MATH-TRU-HAI-PHAN", "Hoàn thành phép trừ: -1/6 - 3/6 = ____.", "fraction", "fraction_equal", ["-2/3"], ["G6-MATH-NHAN-BIET-PHAN-1"], ["G6-MATH-TRU-HAI-PHAN"], ["2/6"]),
        ("fraction_foundation", "prerequisite_probe", "multiply_two_fractions", "2_3_times_3_5", "G6-MATH-NHAN-HAI-PHAN", "Tính 2/3 × 3/5.", "fraction", "fraction_equal", ["2/5"], ["G6-MATH-NHAN-BIET-PHAN-1"], ["G6-MATH-NHAN-HAI-PHAN"], ["5/8"]),
        ("fraction_foundation", "prerequisite_probe", "multiply_signed_fractions", "minus4_7_times_14_3", "G6-MATH-NHAN-HAI-PHAN", "Tính và rút gọn: -4/7 × 14/3.", "fraction", "fraction_equal", ["-8/3"], ["G6-MATH-NHAN-BIET-PHAN-1"], ["G6-MATH-NHAN-HAI-PHAN"], ["-56/21"]),
        ("fraction_foundation", "prerequisite_probe", "divide_two_fractions", "2_3_div_4_5", "G6-MATH-CHIA-HAI-PHAN", "Tính 2/3 : 4/5.", "fraction", "fraction_equal", ["5/6"], ["G6-MATH-PHAN-SO-NGHICH", "G6-MATH-NHAN-HAI-PHAN"], ["G6-MATH-CHIA-HAI-PHAN"], ["8/15"]),
        ("fraction_foundation", "prerequisite_probe", "divide_signed_fraction", "minus3_4_div_9_8", "G6-MATH-CHIA-HAI-PHAN", "Thực hiện phép chia phân số: -3/4 : 9/8.", "fraction", "fraction_equal", ["-2/3"], ["G6-MATH-PHAN-SO-NGHICH", "G6-MATH-NHAN-HAI-PHAN"], ["G6-MATH-CHIA-HAI-PHAN"], ["-27/32"]),
        ("fraction_foundation", "prerequisite_probe", "reciprocal_positive_fraction", "3_5", "G6-MATH-PHAN-SO-NGHICH", "Phân số nghịch đảo của 3/5 là gì?", "fraction", "fraction_equal", ["5/3"], ["G6-MATH-NHAN-BIET-PHAN-1"], ["G6-MATH-PHAN-SO-NGHICH"], ["-5/3"]),
        ("fraction_foundation", "prerequisite_probe", "reciprocal_negative_fraction", "minus2_7", "G6-MATH-PHAN-SO-NGHICH", "Viết nghịch đảo của phân số -2/7.", "fraction", "fraction_equal", ["-7/2"], ["G6-MATH-NHAN-BIET-PHAN-1"], ["G6-MATH-PHAN-SO-NGHICH"], ["7/2"]),
        ("fraction_foundation", "prerequisite_probe", "opposite_positive_fraction", "3_5", "G6-MATH-SO-DOI-CUA", "Số đối của 3/5 là gì?", "fraction", "fraction_equal", ["-3/5"], ["G6-MATH-NHAN-BIET-PHAN-1"], ["G6-MATH-SO-DOI-CUA"], ["5/3"]),
        ("fraction_foundation", "prerequisite_probe", "opposite_negative_fraction", "minus7_9", "G6-MATH-SO-DOI-CUA", "Điền số đối của -7/9.", "fraction", "fraction_equal", ["7/9"], ["G6-MATH-NHAN-BIET-PHAN-1"], ["G6-MATH-SO-DOI-CUA"], ["-9/7"]),
        ("fraction_foundation", "prerequisite_probe", "fraction_of_number_direct", "2_3_of_18", "G6-MATH-TIM-GIA-TRI", "Tính 2/3 của 18.", "number", "numeric_equal", ["12"], ["G6-MATH-NHAN-HAI-PHAN"], ["G6-MATH-TIM-GIA-TRI"], ["27"]),
        ("fraction_foundation", "prerequisite_probe", "fraction_of_quantity_context", "3_5_of_20_students", "G6-MATH-TIM-GIA-TRI", "Một lớp có 20 học sinh; 3/5 số học sinh tham gia CLB. Có bao nhiêu học sinh tham gia?", "number", "numeric_equal", ["12"], ["G6-MATH-NHAN-HAI-PHAN"], ["G6-MATH-TIM-GIA-TRI"], ["4"]),
        ("fraction_foundation", "prerequisite_probe", "find_whole_from_fraction_value", "2_3_is_10", "G6-MATH-TIM-MOT-SO-1", "2/3 của một số là 10. Số đó là bao nhiêu?", "number", "numeric_equal", ["15"], ["G6-MATH-CHIA-HAI-PHAN"], ["G6-MATH-TIM-MOT-SO-1"], ["20/3"]),
        ("fraction_foundation", "prerequisite_probe", "recover_total_from_fraction_part", "3_4_is_18", "G6-MATH-TIM-MOT-SO-1", "Một đoạn đường đã đi được 3/4 là 18 km. Cả đoạn đường dài bao nhiêu km?", "number", "numeric_equal", ["24"], ["G6-MATH-CHIA-HAI-PHAN"], ["G6-MATH-TIM-MOT-SO-1"], ["13.5"]),
        # Grade 6 integer/sign/parentheses roots.
        ("integer_foundation", "prerequisite_probe", "write_negative_integer_context", "below_zero_5", "G6-MATH-NHAN-BIET-DOC", "Viết số nguyên biểu diễn nhiệt độ 5 độ dưới 0.", "number", "numeric_equal", ["-5"], [], ["G6-MATH-NHAN-BIET-DOC"], ["5"]),
        ("integer_foundation", "prerequisite_probe", "write_basement_floor_integer", "basement_2", "G6-MATH-NHAN-BIET-DOC", "Tầng hầm thứ 2 được biểu diễn bằng số nguyên nào nếu mặt đất là 0?", "number", "numeric_equal", ["-2"], [], ["G6-MATH-NHAN-BIET-DOC"], ["2"]),
        ("integer_foundation", "prerequisite_probe", "opposite_negative_integer", "minus7", "G6-MATH-NHAN-BIET-SO-1", "Số đối của -7 là bao nhiêu?", "number", "numeric_equal", ["7"], ["G6-MATH-NHAN-BIET-DOC"], ["G6-MATH-NHAN-BIET-SO-1"], ["-7"]),
        ("integer_foundation", "prerequisite_probe", "opposite_positive_integer", "12", "G6-MATH-NHAN-BIET-SO-1", "Điền số đối của 12.", "number", "numeric_equal", ["-12"], ["G6-MATH-NHAN-BIET-DOC"], ["G6-MATH-NHAN-BIET-SO-1"], ["12"]),
        ("integer_foundation", "prerequisite_probe", "add_two_negative_integers", "minus7_minus5", "G6-MATH-CONG-HAI-SO", "Tính (-7) + (-5).", "number", "numeric_equal", ["-12"], ["G6-MATH-NHAN-BIET-DOC"], ["G6-MATH-CONG-HAI-SO"], ["12"]),
        ("integer_foundation", "prerequisite_probe", "context_two_decreases", "decrease4_decrease6", "G6-MATH-CONG-HAI-SO", "Một giá trị giảm 4 rồi giảm tiếp 6. Tổng thay đổi là bao nhiêu?", "number", "numeric_equal", ["-10"], ["G6-MATH-NHAN-BIET-DOC"], ["G6-MATH-CONG-HAI-SO"], ["10"]),
        ("integer_foundation", "prerequisite_probe", "add_opposite_sign_integers", "minus8_plus3", "G6-MATH-CONG-HAI-SO-1", "Tính (-8) + 3.", "number", "numeric_equal", ["-5"], ["G6-MATH-NHAN-BIET-DOC"], ["G6-MATH-CONG-HAI-SO-1"], ["11"]),
        ("integer_foundation", "prerequisite_probe", "combine_positive_and_negative_integer", "6_plus_minus10", "G6-MATH-CONG-HAI-SO-1", "Hoàn thành phép tính: 6 + (-10) = ____.", "number", "numeric_equal", ["-4"], ["G6-MATH-NHAN-BIET-DOC"], ["G6-MATH-CONG-HAI-SO-1"], ["16"]),
        ("integer_foundation", "prerequisite_probe", "subtract_integer_plain", "minus3_minus5", "G6-MATH-TU-CHO-SO", "Tính (-3) - 5.", "number", "numeric_equal", ["-8"], ["G6-MATH-NHAN-BIET-SO-1"], ["G6-MATH-TU-CHO-SO"], ["2"]),
        ("integer_foundation", "prerequisite_probe", "subtract_negative_integer", "4_minus_minus9", "G6-MATH-TU-CHO-SO", "Điền kết quả: 4 - (-9) = ____.", "number", "numeric_equal", ["13"], ["G6-MATH-NHAN-BIET-SO-1"], ["G6-MATH-TU-CHO-SO"], ["-5"]),
        ("integer_foundation", "prerequisite_probe", "multiply_opposite_sign_integers", "minus6_times4", "G6-MATH-NHAN-HAI-SO", "Tính (-6) × 4.", "number", "numeric_equal", ["-24"], ["G6-MATH-NHAN-BIET-DOC"], ["G6-MATH-NHAN-HAI-SO"], ["24"]),
        ("integer_foundation", "prerequisite_probe", "product_positive_negative_integer", "5_times_minus9", "G6-MATH-NHAN-HAI-SO", "Hoàn thành tích: 5 × (-9) = ____.", "number", "numeric_equal", ["-45"], ["G6-MATH-NHAN-BIET-DOC"], ["G6-MATH-NHAN-HAI-SO"], ["45"]),
        ("integer_foundation", "prerequisite_probe", "multiply_two_negative_integers", "minus6_times_minus4", "G6-MATH-NHAN-HAI-SO-1", "Tính (-6) × (-4).", "number", "numeric_equal", ["24"], ["G6-MATH-NHAN-BIET-DOC"], ["G6-MATH-NHAN-HAI-SO-1"], ["-24"]),
        ("integer_foundation", "prerequisite_probe", "positive_product_same_sign", "7_times8", "G6-MATH-NHAN-HAI-SO-1", "Tích của 7 và 8 bằng bao nhiêu?", "number", "numeric_equal", ["56"], ["G6-MATH-NHAN-BIET-DOC"], ["G6-MATH-NHAN-HAI-SO-1"], ["-56"]),
        ("integer_foundation", "prerequisite_probe", "divide_negative_by_positive_integer", "minus24_div6", "G6-MATH-THUC-HIEN-PHEP", "Tính (-24) : 6.", "number", "numeric_equal", ["-4"], ["G6-MATH-NHAN-BIET-DOC"], ["G6-MATH-THUC-HIEN-PHEP"], ["4"]),
        ("integer_foundation", "prerequisite_probe", "divide_two_negative_integers", "minus35_div_minus5", "G6-MATH-THUC-HIEN-PHEP", "Thực hiện phép chia: (-35) : (-5).", "number", "numeric_equal", ["7"], ["G6-MATH-NHAN-BIET-DOC"], ["G6-MATH-THUC-HIEN-PHEP"], ["-7"]),
        ("integer_foundation", "prerequisite_probe", "remove_nested_parentheses_minus_inside", "a_minus_b_minus_c_plus2", "G6-MATH-BO-NGOAC-LONG", "Bỏ ngoặc: a - (b - (c + 2)).", "expression", "expression_equivalent", ["a-b+c+2"], ["G6-MATH-BO-DAU-NGOAC", "G6-MATH-BO-DAU-NGOAC-1"], ["G6-MATH-BO-NGOAC-LONG"], ["a-b-c-2"]),
        ("integer_foundation", "prerequisite_probe", "simplify_nested_parentheses_expression", "x_plus_y_minus_z_minus3", "G6-MATH-BO-NGOAC-LONG", "Rút gọn biểu thức x + (y - (z - 3)).", "expression", "expression_equivalent", ["x+y-z+3"], ["G6-MATH-BO-DAU-NGOAC", "G6-MATH-BO-DAU-NGOAC-1"], ["G6-MATH-BO-NGOAC-LONG"], ["x+y-z-3"]),
        ("integer_foundation", "prerequisite_probe", "distribute_number_over_sum", "4_xplus3", "G6-MATH-PHAN-PHOI-NHAN", "Khai triển 4(x + 3).", "expression", "expression_equivalent", ["4*x+12"], ["G6-MATH-NHAN-HAI-SO-1"], ["G6-MATH-PHAN-PHOI-NHAN"], ["4*x+3"]),
        ("integer_foundation", "prerequisite_probe", "factor_common_number_from_binomial", "5a_plus10", "G6-MATH-PHAN-PHOI-NHAN", "Viết 5a + 10 thành tích có nhân tử chung 5.", "expression", "expression_equivalent", ["5*(a+2)"], ["G6-MATH-NHAN-HAI-SO-1"], ["G6-MATH-PHAN-PHOI-NHAN"], ["5*(a+10)"]),
        ("integer_foundation", "prerequisite_probe", "order_operations_no_parentheses", "3_plus4_times2", "G6-MATH-AP-DUNG-DUNG", "Tính 3 + 4 × 2.", "number", "numeric_equal", ["11"], ["G6-MATH-NHAN-HAI-SO-1"], ["G6-MATH-AP-DUNG-DUNG"], ["14"]),
        ("integer_foundation", "prerequisite_probe", "division_before_addition", "18_div3_plus5", "G6-MATH-AP-DUNG-DUNG", "Theo đúng thứ tự phép tính, 18 : 3 + 5 bằng bao nhiêu?", "number", "numeric_equal", ["11"], ["G6-MATH-THUC-HIEN-PHEP"], ["G6-MATH-AP-DUNG-DUNG"], ["6"]),
        ("integer_foundation", "prerequisite_probe", "order_operations_parentheses_first", "2_times_3_plus4", "G6-MATH-AP-DUNG-DUNG-1", "Tính 2 × (3 + 4).", "number", "numeric_equal", ["14"], ["G6-MATH-AP-DUNG-DUNG"], ["G6-MATH-AP-DUNG-DUNG-1"], ["10"]),
        ("integer_foundation", "prerequisite_probe", "parentheses_then_multiply", "12_minus5_times3", "G6-MATH-AP-DUNG-DUNG-1", "Hoàn thành: (12 - 5) × 3 = ____.", "number", "numeric_equal", ["21"], ["G6-MATH-AP-DUNG-DUNG"], ["G6-MATH-AP-DUNG-DUNG-1"], ["-3"]),
        # Grade 7 algebra roots.
        ("algebra_foundation", "prerequisite_probe", "recognize_rational_number_fraction_form", "minus0_75", "G9-MATH-NHAN-BIET-SO-1", "Viết -0.75 dưới dạng phân số tối giản.", "fraction", "fraction_equal", ["-3/4"], ["G6-MATH-NHAN-BIET-PHAN-1"], ["G9-MATH-NHAN-BIET-SO-1"], ["3/4"]),
        ("algebra_foundation", "prerequisite_probe", "rational_number_numerator_for_denominator", "5_as_a_over2", "G9-MATH-NHAN-BIET-SO-1", "Tìm tử số a để 5 = a/2.", "number", "numeric_equal", ["10"], ["G6-MATH-NHAN-BIET-PHAN-1"], ["G9-MATH-NHAN-BIET-SO-1"], ["5"]),
        ("algebra_foundation", "prerequisite_probe", "identify_monomial_coefficient", "minus7x3", "G7-MATH-NHAN-BIET-DON", "Hệ số của đơn thức -7x^3 là bao nhiêu?", "number", "numeric_equal", ["-7"], ["G7-MATH-NHAN-BIET-BIEU"], ["G7-MATH-NHAN-BIET-DON"], ["7"]),
        ("algebra_foundation", "prerequisite_probe", "monomial_degree_two_variables", "4a2b3", "G7-MATH-NHAN-BIET-DON", "Bậc của đơn thức 4a^2b^3 là bao nhiêu?", "number", "numeric_equal", ["5"], ["G7-MATH-NHAN-BIET-BIEU"], ["G7-MATH-NHAN-BIET-DON"], ["6"]),
        ("algebra_foundation", "prerequisite_probe", "polynomial_term_count", "x2_minus3x_plus2", "G7-MATH-NHAN-BIET-DA", "Trong đa thức x^2 - 3x + 2, có bao nhiêu hạng tử?", "number", "numeric_equal", ["3"], ["G7-MATH-NHAN-BIET-DON"], ["G7-MATH-NHAN-BIET-DA"], ["2"]),
        ("algebra_foundation", "prerequisite_probe", "polynomial_degree_single_variable", "5x4_minusx_plus1", "G7-MATH-NHAN-BIET-DA", "Bậc của đa thức 5x^4 - x + 1 là bao nhiêu?", "number", "numeric_equal", ["4"], ["G7-MATH-NHAN-BIET-DON"], ["G7-MATH-NHAN-BIET-DA"], ["5"]),
        ("algebra_foundation", "prerequisite_probe", "combine_like_terms_g7", "2x2_3x_minusx2_plus5", "G7-MATH-THU-GON-DA", "Thu gọn đa thức 2x^2 + 3x - x^2 + 5.", "expression", "expression_equivalent", ["x^2+3*x+5"], ["G7-MATH-NHAN-BIET-DA"], ["G7-MATH-THU-GON-DA"], ["x^2+8*x"]),
        ("algebra_foundation", "prerequisite_probe", "simplify_polynomial_constants_g7", "4a_minus2_plus6a_plus7", "G7-MATH-THU-GON-DA", "Rút gọn: 4a - 2 + 6a + 7.", "expression", "expression_equivalent", ["10*a+5"], ["G7-MATH-NHAN-BIET-DA"], ["G7-MATH-THU-GON-DA"], ["10*a-9"]),
        ("algebra_foundation", "prerequisite_probe", "add_two_polynomials_g7", "2x2_3x_plus_x2_minus5x", "G7-MATH-CONG-HAI-DA", "Cộng hai đa thức: (2x^2 + 3x) + (x^2 - 5x).", "expression", "expression_equivalent", ["3*x^2-2*x"], ["G7-MATH-THU-GON-DA"], ["G7-MATH-CONG-HAI-DA"], ["3*x^2+8*x"]),
        ("algebra_foundation", "prerequisite_probe", "sum_polynomial_with_constant_g7", "a2_minus4_plus3a2_plus1", "G7-MATH-CONG-HAI-DA", "Tìm tổng của a^2 - 4 và 3a^2 + 1.", "expression", "expression_equivalent", ["4*a^2-3"], ["G7-MATH-THU-GON-DA"], ["G7-MATH-CONG-HAI-DA"], ["4*a^2+5"]),
        ("algebra_foundation", "prerequisite_probe", "subtract_two_polynomials_g7", "3x2_plusx_minus_x2_minus2x", "G7-MATH-TRU-HAI-DA", "Thực hiện phép trừ: (3x^2 + x) - (x^2 - 2x).", "expression", "expression_equivalent", ["2*x^2+3*x"], ["G7-MATH-THU-GON-DA", "G6-MATH-BO-DAU-NGOAC-1"], ["G7-MATH-TRU-HAI-DA"], ["2*x^2-x"]),
        ("algebra_foundation", "prerequisite_probe", "subtract_polynomials_with_constants_g7", "5a_plus1_minus_2a_minus4", "G7-MATH-TRU-HAI-DA", "Rút gọn hiệu (5a + 1) - (2a - 4).", "expression", "expression_equivalent", ["3*a+5"], ["G7-MATH-THU-GON-DA", "G6-MATH-BO-DAU-NGOAC-1"], ["G7-MATH-TRU-HAI-DA"], ["3*a-3"]),
        ("algebra_foundation", "prerequisite_probe", "multiply_monomial_polynomial_g7", "3x_2x_minus5", "G7-MATH-NHAN-DON-THUC", "Khai triển 3x(2x - 5).", "expression", "expression_equivalent", ["6*x^2-15*x"], ["G6-MATH-PHAN-PHOI-NHAN", "G7-MATH-NHAN-BIET-DON"], ["G7-MATH-NHAN-DON-THUC"], ["6*x^2-5"]),
        ("algebra_foundation", "prerequisite_probe", "negative_monomial_times_polynomial_g7", "minus2a_a_plus3", "G7-MATH-NHAN-DON-THUC", "Tính tích -2a(a + 3).", "expression", "expression_equivalent", ["-2*a^2-6*a"], ["G6-MATH-PHAN-PHOI-NHAN", "G7-MATH-NHAN-BIET-DON"], ["G7-MATH-NHAN-DON-THUC"], ["-2*a^2+3"]),
        ("algebra_foundation", "prerequisite_probe", "multiply_two_binomials_g7", "xplus2_xplus3", "G7-MATH-NHAN-DA-THUC", "Khai triển (x + 2)(x + 3).", "expression", "expression_equivalent", ["x^2+5*x+6"], ["G7-MATH-NHAN-DON-THUC"], ["G7-MATH-NHAN-DA-THUC"], ["x^2+6"]),
        ("algebra_foundation", "prerequisite_probe", "product_two_polynomials_g7", "aminus1_aplus4", "G7-MATH-NHAN-DA-THUC", "Tính tích hai đa thức: (a - 1)(a + 4).", "expression", "expression_equivalent", ["a^2+3*a-4"], ["G7-MATH-NHAN-DON-THUC"], ["G7-MATH-NHAN-DA-THUC"], ["a^2-4"]),
        ("algebra_foundation", "prerequisite_probe", "divide_two_monomials_g7", "12x5_div_3x2", "G7-MATH-CHIA-HAI-DON", "Chia 12x^5 cho 3x^2.", "expression", "expression_equivalent", ["4*x^3"], ["G7-MATH-NHAN-BIET-DON"], ["G7-MATH-CHIA-HAI-DON"], ["4*x^7"]),
        ("algebra_foundation", "prerequisite_probe", "signed_monomial_division_g7", "minus15a4_div5a", "G7-MATH-CHIA-HAI-DON", "Thực hiện phép chia đơn thức: -15a^4 : 5a.", "expression", "expression_equivalent", ["-3*a^3"], ["G7-MATH-NHAN-BIET-DON"], ["G7-MATH-CHIA-HAI-DON"], ["-3*a^4"]),
        ("algebra_foundation", "prerequisite_probe", "order_polynomial_descending_g7", "3_minus2x2_plusx", "G7-MATH-SAP-XEP-DA", "Sắp xếp 3 - 2x^2 + x theo lũy thừa giảm của x.", "expression", "expression_equivalent", ["-2*x^2+x+3"], ["G7-MATH-NHAN-BIET-DA"], ["G7-MATH-SAP-XEP-DA"], ["3-2*x^2+x"]),
        ("algebra_foundation", "prerequisite_probe", "arrange_polynomial_by_power_g7", "y_plus4y3_minus1", "G7-MATH-SAP-XEP-DA", "Viết đa thức y + 4y^3 - 1 theo lũy thừa giảm.", "expression", "expression_equivalent", ["4*y^3+y-1"], ["G7-MATH-NHAN-BIET-DA"], ["G7-MATH-SAP-XEP-DA"], ["y+4*y^3-1"]),
        # Grade 8 support/bridge nodes.
        ("rational_expression", "prerequisite_probe", "evaluate_rational_expression_simple", "x_over_xplus2_at2", "G8-MATH-TINH-GIA-TRI", "Tính giá trị của x/(x + 2) khi x = 2.", "fraction", "fraction_equal", ["1/2"], ["G7-MATH-TINH-GIA-TRI-1", "G8-MATH-NHAN-BIET-PHAN"], ["G8-MATH-TINH-GIA-TRI"], ["2"]),
        ("rational_expression", "prerequisite_probe", "rational_expression_value_with_domain", "xplus1_over_xminus1_at3", "G8-MATH-TINH-GIA-TRI", "Với phân thức (x + 1)/(x - 1), giá trị tại x = 3 là bao nhiêu?", "number", "numeric_equal", ["2"], ["G7-MATH-TINH-GIA-TRI-1", "G8-MATH-NHAN-BIET-PHAN"], ["G8-MATH-TINH-GIA-TRI"], ["4/2"]),
        ("rational_expression", "prerequisite_probe", "product_difference_of_squares", "xminus3_xplus3", "G8-MATH-BIEN-DOI-TICH", "Khai triển (x - 3)(x + 3).", "expression", "expression_equivalent", ["x^2-9"], ["G8-MATH-NHAN-DANG-A"], ["G8-MATH-BIEN-DOI-TICH"], ["x^2+9"]),
        ("rational_expression", "prerequisite_probe", "expand_conjugate_product", "2a_minus5_2a_plus5", "G8-MATH-BIEN-DOI-TICH", "Tính tích (2a - 5)(2a + 5).", "expression", "expression_equivalent", ["4*a^2-25"], ["G8-MATH-NHAN-DANG-A"], ["G8-MATH-BIEN-DOI-TICH"], ["4*a^2+25"]),
        ("rational_expression", "prerequisite_probe", "recognize_multivariable_monomial_coefficient", "minus4x2y", "G8-MATH-NHAN-BIET-DON", "Trong đơn thức -4x^2y, hệ số là bao nhiêu?", "number", "numeric_equal", ["-4"], ["G7-MATH-NHAN-BIET-BIEU"], ["G8-MATH-NHAN-BIET-DON"], ["4"]),
        ("rational_expression", "prerequisite_probe", "degree_multivariable_monomial", "3ab2", "G8-MATH-NHAN-BIET-DON", "Bậc của đơn thức 3ab^2 là bao nhiêu?", "number", "numeric_equal", ["3"], ["G7-MATH-NHAN-BIET-BIEU"], ["G8-MATH-NHAN-BIET-DON"], ["2"]),
        ("rational_expression", "prerequisite_probe", "like_monomial_common_variable_part", "4a2b_and_minus7a2b", "G8-MATH-NHAN-BIET-CAC", "Hai đơn thức 4a^2b và -7a^2b đồng dạng có phần biến chung là gì?", "expression", "expression_equivalent", ["a^2*b"], ["G8-MATH-NHAN-BIET-DON"], ["G8-MATH-NHAN-BIET-CAC"], ["a*b^2"]),
        ("rational_expression", "prerequisite_probe", "find_exponent_for_like_terms", "5x2y_and_minus3xmy", "G8-MATH-NHAN-BIET-CAC", "Để 5x^2y và -3x^m y là hai đơn thức đồng dạng, m bằng bao nhiêu?", "number", "numeric_equal", ["2"], ["G8-MATH-NHAN-BIET-DON"], ["G8-MATH-NHAN-BIET-CAC"], ["1"]),
        ("rational_expression", "prerequisite_probe", "add_multivariable_polynomials", "x2_2xy_plus3x2_minusxy", "G8-MATH-CONG-HAI-DA", "Cộng (x^2 + 2xy) và (3x^2 - xy).", "expression", "expression_equivalent", ["4*x^2+x*y"], ["G8-MATH-THU-GON-DA"], ["G8-MATH-CONG-HAI-DA"], ["4*x^2+3*x*y"]),
        ("rational_expression", "prerequisite_probe", "sum_linear_multivariable_polynomials", "a_minusb_plus2a_plus3b", "G8-MATH-CONG-HAI-DA", "Tìm tổng của a - b và 2a + 3b.", "expression", "expression_equivalent", ["3*a+2*b"], ["G8-MATH-THU-GON-DA"], ["G8-MATH-CONG-HAI-DA"], ["3*a-4*b"]),
        ("rational_expression", "prerequisite_probe", "subtract_multivariable_polynomials", "4x2_xy_minus_x2_minus2xy", "G8-MATH-TRU-HAI-DA", "Thực hiện phép trừ: (4x^2 + xy) - (x^2 - 2xy).", "expression", "expression_equivalent", ["3*x^2+3*x*y"], ["G8-MATH-THU-GON-DA", "G6-MATH-BO-DAU-NGOAC-1"], ["G8-MATH-TRU-HAI-DA"], ["3*x^2-x*y"]),
        ("rational_expression", "prerequisite_probe", "difference_linear_multivariable_polynomials", "5a_minusb_minus2a_plus3b", "G8-MATH-TRU-HAI-DA", "Rút gọn hiệu (5a - b) - (2a + 3b).", "expression", "expression_equivalent", ["3*a-4*b"], ["G8-MATH-THU-GON-DA", "G6-MATH-BO-DAU-NGOAC-1"], ["G8-MATH-TRU-HAI-DA"], ["3*a+2*b"]),
        ("rational_expression", "prerequisite_probe", "multiply_monomial_polynomial_g8", "2x_3x_plus4y", "G8-MATH-NHAN-DON-THUC", "Khai triển 2x(3x + 4y).", "expression", "expression_equivalent", ["6*x^2+8*x*y"], ["G6-MATH-PHAN-PHOI-NHAN", "G8-MATH-NHAN-BIET-DON"], ["G8-MATH-NHAN-DON-THUC"], ["6*x^2+4*y"]),
        ("rational_expression", "prerequisite_probe", "signed_monomial_times_polynomial_g8", "minus3a_2a_minusb", "G8-MATH-NHAN-DON-THUC", "Tính tích -3a(2a - b).", "expression", "expression_equivalent", ["-6*a^2+3*a*b"], ["G6-MATH-PHAN-PHOI-NHAN", "G8-MATH-NHAN-BIET-DON"], ["G8-MATH-NHAN-DON-THUC"], ["-6*a^2-3*a*b"]),
    ]

    for (
        path,
        role,
        family,
        parameter_set,
        kc_code,
        question,
        answer_widget,
        checker_type,
        accepted_answers,
        requires_codes,
        diagnoses_codes,
        wrong_patterns,
    ) in supplemental_items:
        wrong_values = wrong_patterns if isinstance(wrong_patterns, list) else [wrong_patterns]
        add(
            path=path,
            role=role,
            family=family,
            parameter_set=parameter_set,
            kc_code=kc_code,
            question=question,
            answer_widget=answer_widget,
            checker_type=checker_type,
            accepted_answers=accepted_answers,
            requires_codes=requires_codes,
            diagnoses_codes=diagnoses_codes,
            common_wrong_patterns=[
                _wrong(str(pattern), "Common wrong pattern generated for academic review.", diagnoses_codes)
                for pattern in wrong_values
            ],
        )

    scope_codes = _scope_kc_codes()
    direct_codes = {item["kc_code"] for item in items}
    missing_direct = sorted(scope_codes - direct_codes)
    assert not missing_direct, missing_direct
    return items


def _write_summary(items: list[dict[str, Any]], validation: dict[str, Any]) -> None:
    by_path: dict[str, int] = {}
    by_role: dict[str, int] = {}
    by_widget: dict[str, int] = {}
    for item in items:
        by_path[item["target_exam_path"]] = by_path.get(item["target_exam_path"], 0) + 1
        by_role[item["item_role"]] = by_role.get(item["item_role"], 0) + 1
        by_widget[item["answer_widget"]] = by_widget.get(item["answer_widget"], 0) + 1

    lines = [
        "# Grade 8 Exam-Path Official Item Drafts",
        "",
        "Generated by deterministic templates. These are **drafts**, not academic-approved items.",
        "",
        "## Summary",
        "",
        f"- Total items: {len(items)}",
        f"- Validation errors: {validation['summary']['errors']}",
        f"- Validation warnings: {validation['summary']['warnings']}",
        "- Academic reviewed: 0",
        "- Pilot ready: 0",
        "- Graph node changes: 0",
        "",
        "## Counts By Path",
        "",
    ]
    lines += [f"- {key}: {value}" for key, value in sorted(by_path.items())]
    lines += ["", "## Counts By Role", ""]
    lines += [f"- {key}: {value}" for key, value in sorted(by_role.items())]
    lines += ["", "## Counts By Widget", ""]
    lines += [f"- {key}: {value}" for key, value in sorted(by_widget.items())]
    lines += [
        "",
        "## Review Notes",
        "",
        "- Every item has `official_assessment_scope=grade8_exam_path`.",
        "- Every item has `item_role`, `item_family`, `surface_signature`, and `parameter_set`.",
        "- Missing graph concepts are recorded as flags, not inserted as nodes.",
        "- Use `backend/scratch/validate_official_assessment_items.py docs/grade8_exam_path_official_item_drafts.json` before importing/reviewing.",
    ]
    OUT_MD.write_text("\n".join(lines) + "\n", encoding="utf-8")


async def main() -> int:
    nodes = await _load_nodes()
    items = _items(nodes)
    validation = validate_official_item_bank(items)
    OUT_JSON.write_text(json.dumps({"items": items}, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    _write_summary(items, validation)
    print(json.dumps(validation["summary"], ensure_ascii=False, indent=2))
    return 1 if validation["summary"]["errors"] else 0


if __name__ == "__main__":
    raise SystemExit(asyncio.run(main()))
