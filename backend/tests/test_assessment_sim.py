"""
Tests for Assessment Simulation Engine

Tests both math-based and agent-based simulation logic.
Agent tests mock the Gemini API for deterministic testing.
"""
import pytest
import asyncio
from unittest.mock import AsyncMock, MagicMock, patch

from app.engines.agent_student import (
    StudentPersona, AgentResponse, 
    parse_agent_response, format_question, get_correct_answer,
    build_persona_prompt,
)
from app.engines.assessment_sim import (
    DiagnosticResult, compare_diagnosis, simulate_response_math,
)


# ── Test fixtures ────────────────────────────────────────────────────────────

@pytest.fixture
def sample_item():
    return {
        "id": "item-1",
        "kc_id": "kc-1",
        "irt_a": 1.0,
        "irt_b": 0.0,
        "irt_c": 0.25,
        "is_diagnostic_anchor": True,
        "content": {
            "question": "Tập hợp A = {2, 4, 6} có bao nhiêu phần tử?",
            "answers": [
                {"label": "A", "text": "2", "is_correct": False},
                {"label": "B", "text": "3", "is_correct": True},
                {"label": "C", "text": "4", "is_correct": False},
                {"label": "D", "text": "6", "is_correct": False},
            ],
        },
    }


@pytest.fixture
def expert_persona():
    return StudentPersona(
        name="expert",
        true_theta=2.0,
        true_mastery={"kc-1": True, "kc-2": True, "kc-3": True},
        p_slip=0.05,
        p_guess=0.25,
    )


@pytest.fixture
def beginner_persona():
    return StudentPersona(
        name="beginner",
        true_theta=-2.0,
        true_mastery={"kc-1": False, "kc-2": False, "kc-3": False},
        p_slip=0.10,
        p_guess=0.25,
    )


@pytest.fixture
def mixed_persona():
    return StudentPersona(
        name="mixed",
        true_theta=0.0,
        true_mastery={"kc-1": True, "kc-2": False, "kc-3": True, "kc-4": False},
        p_slip=0.10,
        p_guess=0.25,
    )


# ── Tests: parse_agent_response ──────────────────────────────────────────────

class TestParseAgentResponse:
    
    def test_standard_format(self):
        raw = "THINKING: Em nghĩ câu này dễ, đếm có 3 phần tử.\nANSWER: B"
        result = parse_agent_response(raw)
        assert result.answer == "B"
        assert "3 phần tử" in result.thinking
    
    def test_lowercase_answer(self):
        raw = "THINKING: Hmm...\nANSWER: c"
        result = parse_agent_response(raw)
        assert result.answer == "C"
    
    def test_no_thinking(self):
        raw = "ANSWER: D"
        result = parse_agent_response(raw)
        assert result.answer == "D"
        assert result.thinking == ""
    
    def test_multiline_thinking(self):
        raw = """THINKING: Câu này hỏi về tập hợp.
Em nhớ cô dạy rằng phần tử là mỗi số trong ngoặc.
Đếm: 2, 4, 6 → có 3 phần tử.
ANSWER: B"""
        result = parse_agent_response(raw)
        assert result.answer == "B"
        assert "tập hợp" in result.thinking
    
    def test_fallback_no_format(self):
        raw = "B"
        result = parse_agent_response(raw)
        assert result.answer == "B"


# ── Tests: format_question ───────────────────────────────────────────────────

class TestFormatQuestion:
    
    def test_formats_correctly(self, sample_item):
        q = format_question(sample_item, "Tập hợp")
        assert "Tập hợp A = {2, 4, 6}" in q
        assert "A. 2" in q
        assert "B. 3" in q
        assert "Chủ đề: Tập hợp" in q
    
    def test_json_string_content(self):
        import json
        item = {
            "content": json.dumps({
                "question": "1 + 1 = ?",
                "answers": [
                    {"label": "A", "text": "1", "is_correct": False},
                    {"label": "B", "text": "2", "is_correct": True},
                    {"label": "C", "text": "3", "is_correct": False},
                    {"label": "D", "text": "4", "is_correct": False},
                ],
            })
        }
        q = format_question(item)
        assert "1 + 1 = ?" in q


# ── Tests: get_correct_answer ────────────────────────────────────────────────

class TestGetCorrectAnswer:
    
    def test_finds_correct(self, sample_item):
        assert get_correct_answer(sample_item) == "B"
    
    def test_fallback(self):
        item = {"content": {"question": "?", "answers": []}}
        assert get_correct_answer(item) == "A"


# ── Tests: compare_diagnosis ────────────────────────────────────────────────

class TestCompareDiagnosis:
    
    def test_perfect_match(self, expert_persona):
        """All KCs correctly assessed."""
        assessed = {"kc-1": "pass", "kc-2": "pass", "kc-3": "pass"}
        result = compare_diagnosis(
            expert_persona, assessed, 1.8, 9, {"kc-1", "kc-2", "kc-3"}
        )
        assert result.true_negative == 3
        assert result.false_positive == 0
        assert result.false_negative == 0
        assert result.gap_recall == 1.0
        assert result.mastery_recall == 1.0
    
    def test_missed_gap(self, mixed_persona):
        """Assess misses a gap (false negative)."""
        assessed = {
            "kc-1": "pass",  # TN (truly knows, correctly passed)
            "kc-2": "pass",  # FN! (truly gap, but passed)
            "kc-3": "pass",  # TN
            # kc-4 not tested
        }
        result = compare_diagnosis(
            mixed_persona, assessed, 0.5, 9, {"kc-1", "kc-2", "kc-3", "kc-4"}
        )
        assert result.false_negative >= 1  # kc-2 was missed
        assert result.gap_recall < 1.0
    
    def test_false_positive(self, expert_persona):
        """Expert fails a KC they know (false positive)."""
        assessed = {"kc-1": "pass", "kc-2": "fail", "kc-3": "pass"}
        result = compare_diagnosis(
            expert_persona, assessed, 1.5, 12, {"kc-1", "kc-2", "kc-3"}
        )
        assert result.false_positive == 1
        assert result.gap_precision < 1.0  # no true gaps exist
    
    def test_not_tested_gap(self, mixed_persona):
        """KC with gap not tested → false negative."""
        assessed = {"kc-1": "pass", "kc-3": "pass"}
        # kc-2 and kc-4 not tested
        result = compare_diagnosis(
            mixed_persona, assessed, 0.3, 6, {"kc-1", "kc-2", "kc-3", "kc-4"}
        )
        fn_kcs = [c for c in result.kc_comparisons if "FN" in c.get("category", "")]
        assert len(fn_kcs) >= 2  # kc-2 and kc-4 both missed
    
    def test_beginner_all_gaps(self, beginner_persona):
        """Beginner fails everything → all true positives."""
        assessed = {"kc-1": "fail", "kc-2": "fail", "kc-3": "fundamental_gap"}
        result = compare_diagnosis(
            beginner_persona, assessed, -1.8, 9, {"kc-1", "kc-2", "kc-3"}
        )
        assert result.true_positive == 3
        assert result.gap_precision == 1.0
        assert result.gap_recall == 1.0
    
    def test_theta_error(self, expert_persona):
        result = compare_diagnosis(
            expert_persona, {"kc-1": "pass"}, 1.5, 3, {"kc-1"}
        )
        assert result.theta_error == 0.5  # |2.0 - 1.5|


# ── Tests: simulate_response_math ───────────────────────────────────────────

class TestSimulateResponseMath:
    
    def test_expert_usually_correct(self, expert_persona, sample_item):
        """Expert with high theta should answer correctly most of the time."""
        import random
        random.seed(42)
        results = [
            simulate_response_math(expert_persona, sample_item, "kc-1")
            for _ in range(100)
        ]
        pct_correct = sum(results) / len(results)
        assert pct_correct > 0.70  # expert should be > 70%
    
    def test_beginner_usually_wrong(self, beginner_persona, sample_item):
        """Beginner with gap should mostly guess wrong."""
        import random
        random.seed(42)
        results = [
            simulate_response_math(beginner_persona, sample_item, "kc-1")
            for _ in range(100)
        ]
        pct_correct = sum(results) / len(results)
        assert pct_correct < 0.40  # beginner guessing ~ 25%


# ── Tests: build_persona_prompt ──────────────────────────────────────────────

class TestBuildPersonaPrompt:
    
    def test_prompt_contains_persona_info(self):
        p = StudentPersona(
            name="Minh",
            true_theta=0.5,
            ability_description="Học sinh trung bình",
            knowledge_detail="Em biết cộng trừ nhưng không biết nhân.",
            common_mistakes="hay nhầm dấu",
        )
        prompt = build_persona_prompt(p)
        assert "Minh" in prompt
        assert "Học sinh trung bình" in prompt
        assert "hay nhầm dấu" in prompt
        assert "THINKING:" in prompt
        assert "ANSWER:" in prompt
    
    def test_prompt_has_slip_guess_pct(self):
        p = StudentPersona(name="Test", true_theta=0.0, p_slip=0.15, p_guess=0.30)
        prompt = build_persona_prompt(p)
        assert "15%" in prompt  # slip
        assert "30%" in prompt  # guess


# ── Tests: DiagnosticResult ──────────────────────────────────────────────────

class TestDiagnosticResult:
    
    def test_to_dict_structure(self):
        r = DiagnosticResult(
            true_positive=5, true_negative=10, false_positive=2, false_negative=3,
            not_tested=5, total_items_used=30, kcs_visited=8, kcs_in_graph=25,
            true_theta=0.5, assessed_theta=0.3,
        )
        d = r.to_dict()
        assert "confusion_matrix" in d
        assert "metrics" in d
        assert "efficiency" in d
        assert "theta" in d
        assert d["metrics"]["f1_score"] > 0
    
    def test_edge_case_no_gaps(self):
        """When there are no true gaps, precision should be 1.0."""
        r = DiagnosticResult(true_positive=0, true_negative=10, false_positive=0, false_negative=0)
        assert r.gap_precision == 1.0
        assert r.gap_recall == 1.0
