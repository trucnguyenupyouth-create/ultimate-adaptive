"""
Tests for BKT Engine (Layer 2)

Run:  pytest tests/test_bkt.py -v
"""

import math
import pytest
from app.engines.bkt import (
    BKTState, update_observation, update_learning_event,
    is_mastered, init_with_irt, p_correct_expected,
    MASTERY_THRESHOLD, P_MASTERY_MIN, P_MASTERY_MAX,
)


# ── BKTState ──────────────────────────────────────────────────────────────────

class TestBKTState:
    def test_default_values(self):
        s = BKTState()
        assert s.p_mastery == 0.10
        assert s.p_transit == 0.30
        assert s.p_guess == 0.25
        assert s.p_slip == 0.10

    def test_to_dict_roundtrip(self):
        s = BKTState(p_mastery=0.45, p_know0=0.15, p_transit=0.40)
        d = s.to_dict()
        s2 = BKTState.from_dict(d)
        assert abs(s2.p_mastery - 0.45) < 1e-4
        assert abs(s2.p_transit - 0.40) < 1e-4


# ── update_observation ────────────────────────────────────────────────────────

class TestUpdateObservation:
    def test_correct_increases_mastery(self):
        """Correct answer should increase P(L)."""
        s = BKTState(p_mastery=0.40)
        s2 = update_observation(s, correct=True)
        assert s2.p_mastery > s.p_mastery

    def test_wrong_decreases_mastery(self):
        """Wrong answer should decrease P(L) relative to correct."""
        s = BKTState(p_mastery=0.60)
        s_correct = update_observation(s, correct=True)
        s_wrong   = update_observation(s, correct=False)
        assert s_wrong.p_mastery < s_correct.p_mastery

    def test_wrong_on_low_mastery_still_increases_due_to_transit(self):
        """
        BKT behavior: after wrong answer on very low mastery, P(L) still increases
        due to the transition term P(T). This is expected — the learning opportunity
        still occurred even if the student answered wrong.

        Note: The transition makes P(L_n+1) = P(L_n|obs) + (1 - P(L_n|obs)) * P(T)
        So even a wrong answer leads to a non-trivial update when P(T)=0.30.
        """
        s = BKTState(p_mastery=0.05, p_transit=0.30, p_guess=0.25, p_slip=0.10)
        s2 = update_observation(s, correct=False)
        # After wrong answer with P(T)=0.30, P(L) increases to ~0.30 (transition dominates)
        # This is INTENTIONAL BKT behavior — each attempt is a learning opportunity
        assert s2.p_mastery > s.p_mastery  # P(L) increased due to P(T)
        assert s2.p_mastery < 0.50         # but not dramatically high


    def test_five_correct_in_a_row_high_mastery(self):
        """5 correct answers should drive P(L) well above 0.80."""
        s = BKTState(p_mastery=0.10)
        for _ in range(5):
            s = update_observation(s, correct=True)
        assert s.p_mastery > 0.80

    def test_ten_correct_yields_mastery(self):
        """10 correct answers starting from 0.10 should reach mastery threshold."""
        s = BKTState(p_mastery=0.10)
        for _ in range(10):
            s = update_observation(s, correct=True)
        assert is_mastered(s)

    def test_mastery_stays_bounded(self):
        """P(L) must never exceed P_MASTERY_MAX or go below P_MASTERY_MIN."""
        s = BKTState(p_mastery=0.10)
        for _ in range(50):
            s = update_observation(s, correct=True)
        assert P_MASTERY_MIN <= s.p_mastery <= P_MASTERY_MAX

    def test_params_unchanged_after_update(self):
        """Update should not change P(T), P(G), P(S)."""
        s = BKTState(p_mastery=0.30, p_transit=0.35, p_guess=0.20, p_slip=0.08)
        s2 = update_observation(s, correct=True)
        assert s2.p_transit == s.p_transit
        assert s2.p_guess == s.p_guess
        assert s2.p_slip == s.p_slip


# ── update_learning_event ─────────────────────────────────────────────────────

class TestUpdateLearningEvent:
    def test_large_jump_from_video(self):
        """
        From spec: P_old=0.05, P(T_video)=0.85 → P_new ≈ 0.857
        """
        s = BKTState(p_mastery=0.05)
        s2 = update_learning_event(s, p_transit_content=0.85)
        expected = 0.05 + 0.95 * 0.85
        assert abs(s2.p_mastery - expected) < 1e-6

    def test_higher_content_quality_bigger_jump(self):
        """Better content (higher P(T)) → bigger mastery jump."""
        s = BKTState(p_mastery=0.20)
        s_low  = update_learning_event(s, p_transit_content=0.55)
        s_high = update_learning_event(s, p_transit_content=0.85)
        assert s_high.p_mastery > s_low.p_mastery

    def test_bounded_output(self):
        """P(L) never exceeds P_MASTERY_MAX after content."""
        s = BKTState(p_mastery=0.99)
        s2 = update_learning_event(s, p_transit_content=1.0)
        assert s2.p_mastery <= P_MASTERY_MAX

    def test_params_unchanged(self):
        """P(T), P(G), P(S) unchanged after content event."""
        s = BKTState(p_mastery=0.10, p_transit=0.30, p_guess=0.25, p_slip=0.10)
        s2 = update_learning_event(s, p_transit_content=0.70)
        assert s2.p_transit == 0.30


# ── is_mastered ───────────────────────────────────────────────────────────────

class TestIsMastered:
    def test_below_threshold_not_mastered(self):
        assert not is_mastered(BKTState(p_mastery=0.94))

    def test_at_threshold_mastered(self):
        assert is_mastered(BKTState(p_mastery=MASTERY_THRESHOLD))

    def test_above_threshold_mastered(self):
        assert is_mastered(BKTState(p_mastery=0.99))

    def test_custom_threshold(self):
        """Allow lower threshold (e.g., 0.90 for early pilot)."""
        assert is_mastered(BKTState(p_mastery=0.91), threshold=0.90)
        assert not is_mastered(BKTState(p_mastery=0.89), threshold=0.90)


# ── init_with_irt ─────────────────────────────────────────────────────────────

class TestInitWithIRT:
    def test_strong_student_higher_prior(self):
        """Strong student (θ=2) should have higher P(L0) than weak (θ=-2)."""
        strong = init_with_irt(theta=2.0)
        weak   = init_with_irt(theta=-2.0)
        assert strong.p_know0 > weak.p_know0
        assert strong.p_mastery > weak.p_mastery  # starts from P(L0)

    def test_strong_student_lower_slip(self):
        """Strong student should have lower slip rate (less careless)."""
        strong = init_with_irt(theta=2.0)
        weak   = init_with_irt(theta=-2.0)
        assert strong.p_slip < weak.p_slip

    def test_strong_student_higher_transit(self):
        """Strong student should have higher learning rate P(T)."""
        strong = init_with_irt(theta=2.0)
        weak   = init_with_irt(theta=-2.0)
        assert strong.p_transit > weak.p_transit

    def test_guess_rate_unchanged(self):
        """P(G) must NOT change with theta (depends on format, not ability)."""
        s1 = init_with_irt(theta=2.0, base_p_guess=0.25)
        s2 = init_with_irt(theta=-2.0, base_p_guess=0.25)
        assert s1.p_guess == s2.p_guess == 0.25

    def test_average_student_near_defaults(self):
        """θ=0 → params close to defaults."""
        s = init_with_irt(theta=0.0, base_p_transit=0.30, base_p_slip=0.10)
        # P(T) should be close to 0.30
        assert abs(s.p_transit - 0.30) < 0.05
        # P(S) should be close to 0.10
        assert abs(s.p_slip - 0.10) < 0.02

    def test_p_know0_bounded(self):
        """P(L0) stays in [0.05, 0.45] regardless of extreme theta."""
        extreme_strong = init_with_irt(theta=10.0)
        extreme_weak   = init_with_irt(theta=-10.0)
        assert 0.05 <= extreme_strong.p_know0 <= 0.45
        assert 0.05 <= extreme_weak.p_know0 <= 0.45

    def test_p_slip_bounded_minimum(self):
        """P(S) should not go below 0.04 even for very strong students."""
        s = init_with_irt(theta=10.0)
        assert s.p_slip >= 0.04

    def test_p_transit_bounded_maximum(self):
        """P(T) should not exceed 0.85 even for very strong students."""
        s = init_with_irt(theta=10.0)
        assert s.p_transit <= 0.85


# ── Full learning sequence ────────────────────────────────────────────────────

class TestLearningSequence:
    def test_content_then_practice_reaches_mastery(self):
        """
        Realistic sequence: init KC → view video → practice → mastered.
        Average student on easy-ish KC.
        """
        s = init_with_irt(theta=0.0)

        # View a detailed video (P(T)=0.80)
        s = update_learning_event(s, p_transit_content=0.80)
        assert s.p_mastery > 0.60  # big jump expected

        # Practice: 5 correct answers
        for _ in range(5):
            s = update_observation(s, correct=True)

        assert is_mastered(s)

    def test_strong_student_faster_mastery(self):
        """Strong student should master KC faster than weak student."""
        strong = init_with_irt(theta=1.5)
        weak   = init_with_irt(theta=-1.5)

        n_strong = 0
        for _ in range(30):
            strong = update_observation(strong, correct=True)
            n_strong += 1
            if is_mastered(strong):
                break

        n_weak = 0
        for _ in range(30):
            weak = update_observation(weak, correct=True)
            n_weak += 1
            if is_mastered(weak):
                break

        assert n_strong <= n_weak  # strong student needs ≤ answers

    def test_p_correct_expected_consistency(self):
        """Expected P(correct) should be consistent with mastery level."""
        low_mastery  = BKTState(p_mastery=0.10, p_guess=0.25, p_slip=0.10)
        high_mastery = BKTState(p_mastery=0.90, p_guess=0.25, p_slip=0.10)
        assert p_correct_expected(high_mastery) > p_correct_expected(low_mastery)
