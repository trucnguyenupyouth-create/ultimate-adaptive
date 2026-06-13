"""
Tests for IRT Engine (Layer 1)

Run:  pytest tests/test_irt.py -v
"""

import math
import pytest
from app.engines.irt import (
    p_correct, information, update_theta, select_zpd,
    zpd_target_for_mastery, label_to_b,
    D, THETA_MIN, THETA_MAX,
)


# ── p_correct ─────────────────────────────────────────────────────────────────

class TestPCorrect:
    def test_at_theta_equals_b_returns_midpoint(self):
        """When θ=b, P = c + (1-c)/2 = (1+c)/2"""
        a, b, c = 1.0, 0.0, 0.25
        expected = c + (1.0 - c) / 2.0
        assert abs(p_correct(0.0, a, b, c) - expected) < 1e-6

    def test_high_theta_approaches_one(self):
        """Very able student gets very easy item → P ≈ 1.0"""
        assert p_correct(4.0, 1.0, -2.0, 0.0) > 0.99

    def test_low_theta_approaches_guessing_floor(self):
        """Very weak student on very hard item → P ≈ c"""
        c = 0.25
        assert abs(p_correct(-4.0, 1.0, 2.0, c) - c) < 0.02

    def test_output_always_in_range(self):
        """P(correct) must always be in [c, 1]."""
        for theta in [-4, -2, 0, 2, 4]:
            for b in [-2, 0, 2]:
                c = 0.25
                p = p_correct(theta, 1.0, b, c)
                assert c <= p <= 1.0 + 1e-9

    def test_monotone_increasing_in_theta(self):
        """Higher theta → higher probability, all else equal."""
        a, b, c = 1.0, 0.0, 0.25
        ps = [p_correct(t, a, b, c) for t in [-2, -1, 0, 1, 2]]
        assert ps == sorted(ps)

    def test_no_overflow_on_extreme_values(self):
        """Should not raise OverflowError for extreme params."""
        p_correct(100.0, 5.0, -10.0, 0.0)   # should not raise
        p_correct(-100.0, 5.0, 10.0, 0.0)   # should not raise


# ── information ───────────────────────────────────────────────────────────────

class TestInformation:
    def test_peaks_near_b(self):
        """Item is most informative near its own difficulty b."""
        a, b, c = 1.0, 0.0, 0.25
        i_at_b = information(0.0, a, b, c)
        i_far  = information(3.0, a, b, c)
        assert i_at_b > i_far

    def test_always_nonnegative(self):
        """Information is always ≥ 0."""
        for theta in [-3, -1, 0, 1, 3]:
            assert information(theta, 1.0, 0.0, 0.25) >= 0.0

    def test_higher_discrimination_more_information(self):
        """Item with higher a provides more information (all else equal)."""
        i_low  = information(0.0, 0.5, 0.0, 0.25)
        i_high = information(0.0, 2.0, 0.0, 0.25)
        assert i_high > i_low


# ── update_theta ──────────────────────────────────────────────────────────────

class TestUpdateTheta:
    def test_all_correct_easy_items_yields_positive_theta(self):
        """Student who gets all easy items right → θ > 0."""
        responses = [(True, 1.0, -1.0, 0.25)] * 10
        theta, se = update_theta(responses)
        assert theta > 0.0

    def test_all_wrong_hard_items_yields_negative_theta(self):
        """Student who gets all hard items wrong → θ < 0."""
        responses = [(False, 1.0, 1.0, 0.25)] * 10
        theta, se = update_theta(responses)
        assert theta < 0.0

    def test_mixed_medium_items_theta_near_zero(self):
        """Mixed correct/wrong on medium items → θ ≈ 0."""
        # 5 correct, 5 wrong on medium items (b=0) → theta should be near 0
        responses = [(True, 1.0, 0.0, 0.25)] * 5 + [(False, 1.0, 0.0, 0.25)] * 5
        theta, se = update_theta(responses)
        assert -0.5 < theta < 0.5

    def test_se_decreases_with_more_responses(self):
        """More responses → smaller standard error (more certainty)."""
        r5  = [(True, 1.0, 0.0, 0.25)] * 3 + [(False, 1.0, 0.0, 0.25)] * 2
        r20 = [(True, 1.0, 0.0, 0.25)] * 12 + [(False, 1.0, 0.0, 0.25)] * 8
        _, se5  = update_theta(r5)
        _, se20 = update_theta(r20)
        assert se20 < se5

    def test_se_is_finite_and_positive(self):
        """SE must be a finite positive number."""
        responses = [(True, 1.0, 0.0, 0.25)] * 5 + [(False, 1.0, 0.0, 0.25)] * 5
        _, se = update_theta(responses)
        assert se > 0.0
        assert se < float("inf")

    def test_insufficient_data_returns_init(self):
        """With < 2 responses, return (init, 1.0) unchanged."""
        theta, se = update_theta([(True, 1.0, 0.0, 0.25)], init=0.5)
        assert theta == 0.5
        assert se == 1.0

    def test_theta_bounded(self):
        """θ must stay within [-4, 4]."""
        responses = [(True, 1.0, -3.0, 0.0)] * 20  # all correct, very easy
        theta, _ = update_theta(responses)
        assert THETA_MIN <= theta <= THETA_MAX


# ── select_zpd ────────────────────────────────────────────────────────────────

class TestSelectZPD:
    def _make_items(self, b_values):
        return [
            {"id": f"item-{i}", "irt_a": 1.0, "irt_b": b, "irt_c": 0.25}
            for i, b in enumerate(b_values)
        ]

    def test_selects_item_closest_to_target(self):
        """Should select the item whose P(correct|θ) is closest to 0.65."""
        items = self._make_items([-2.0, -0.5, 0.0, 0.5, 2.0])
        # theta=0.0, target=0.65 → item with b≈-0.5 should be selected (P closer to 0.65)
        selected = select_zpd(0.0, items, target_p=0.65)
        assert selected is not None
        # Verify it's actually closest
        for item in items:
            p_sel = p_correct(0.0, 1.0, selected["irt_b"], 0.25)
            p_cmp = p_correct(0.0, 1.0, item["irt_b"], 0.25)
            assert abs(p_sel - 0.65) <= abs(p_cmp - 0.65) + 1e-9

    def test_excludes_seen_items(self):
        """Should not select an item already seen."""
        items = self._make_items([0.0, 0.1, 0.2])
        seen = {items[0]["id"]}
        selected = select_zpd(0.0, items, seen_ids=seen)
        assert selected["id"] != items[0]["id"]

    def test_returns_none_on_empty_pool(self):
        """Empty item pool → None."""
        assert select_zpd(0.0, []) is None

    def test_fallback_when_all_seen(self):
        """When all items are seen, allow repeats (don't return None)."""
        items = self._make_items([0.0])
        seen = {items[0]["id"]}
        selected = select_zpd(0.0, items, seen_ids=seen)
        assert selected is not None  # falls back to full pool

    def test_strong_student_gets_harder_item(self):
        """Strong student (θ=2) should get a harder item than weak student (θ=-2)."""
        items = self._make_items([-2.0, -1.0, 0.0, 1.0, 2.0])
        strong = select_zpd(2.0, items, target_p=0.65)
        weak   = select_zpd(-2.0, items, target_p=0.65)
        assert strong["irt_b"] >= weak["irt_b"]


# ── Helpers ───────────────────────────────────────────────────────────────────

class TestHelpers:
    def test_zpd_target_early_stage(self):
        assert zpd_target_for_mastery(0.3) == 0.75

    def test_zpd_target_mid_stage(self):
        assert zpd_target_for_mastery(0.5) == 0.65

    def test_zpd_target_late_stage(self):
        assert zpd_target_for_mastery(0.8) == 0.55

    def test_label_to_b_mapping(self):
        assert label_to_b("easy") == -1.0
        assert label_to_b("medium") == 0.0
        assert label_to_b("hard") == 1.5
        assert label_to_b(None) == 0.0   # default to medium
        assert label_to_b("unknown") == 0.0
