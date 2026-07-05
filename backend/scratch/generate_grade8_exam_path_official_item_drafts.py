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

KC_CODES = {
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
    "G6-MATH-TINH-CHAT-CO",
    "G6-MATH-QUY-DONG-MAU",
    "G6-MATH-CONG-HAI-PHAN-1",
    "G6-MATH-B31K2",
    "G6-MATH-TIM-GIA-TRI-1",
    "G6-MATH-TIM-MOT-SO",
    "G6-MATH-BO-DAU-NGOAC",
    "G6-MATH-BO-DAU-NGOAC-1",
}


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

    assert len(items) == 101, len(items)
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
