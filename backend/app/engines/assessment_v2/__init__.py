"""
Assessment V2 lab modules.

This package is intentionally independent from the existing assessment engine.
It is safe to import in tests and scripts without changing production API
behaviour.
"""

from app.engines.assessment_v2.diagnostic_engine import (
    DiagnosticItem,
    DiagnosticResponse,
    DiagnosticRun,
    DiagnosticState,
    KnowledgeStateParticleSelector,
    V2DiagnosticEngine,
)
from app.engines.assessment_v2.open_grading import OpenGradeResult, grade_open_response
from app.engines.assessment_v2.strand_scope import (
    STRAND_G6_ALGEBRA,
    STRAND_G6_GEOMETRY_DEFERRED,
    STRAND_REVIEW_REQUIRED,
    StrandAssignment,
    propose_g6_strands,
)

__all__ = [
    "DiagnosticItem",
    "DiagnosticResponse",
    "DiagnosticRun",
    "DiagnosticState",
    "KnowledgeStateParticleSelector",
    "OpenGradeResult",
    "STRAND_G6_ALGEBRA",
    "STRAND_G6_GEOMETRY_DEFERRED",
    "STRAND_REVIEW_REQUIRED",
    "StrandAssignment",
    "V2DiagnosticEngine",
    "grade_open_response",
    "propose_g6_strands",
]
