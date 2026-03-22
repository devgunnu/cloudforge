from __future__ import annotations

from typing import Any, Literal

from pydantic import BaseModel, Field


ArchWorkflowStatus = Literal["needs_clarification", "review_ready", "accepted", "error"]


# ---------------------------------------------------------------------------
# Request models
# ---------------------------------------------------------------------------


class StartArchWorkflowRequest(BaseModel):
    """Start the architecture planner from an accepted PRD session."""

    prd_session_id: str = Field(
        description="session_id returned by POST /workflows/prd/accept"
    )
    budget: str = Field(
        default="",
        description="Budget constraint, e.g. '$500/month'. Leave blank to let the agent ask.",
    )
    traffic: str = Field(
        default="",
        description="Expected traffic, e.g. '10k requests/day'.",
    )
    availability: str = Field(
        default="",
        description="Availability target, e.g. '99.9% uptime'.",
    )


class RespondArchWorkflowRequest(BaseModel):
    """Submit answers to the architecture planner's clarifying questions."""

    session_id: str
    answers: list[str] = Field(
        default_factory=list,
        description="One answer string per question, in the same order they were returned.",
    )


class ReviewArchWorkflowRequest(BaseModel):
    """Accept or request changes to the generated architecture."""

    session_id: str
    accepted: bool
    changes: str = Field(
        default="",
        description="Requested changes when accepted=False.",
    )


# ---------------------------------------------------------------------------
# Nested response sub-models
# ---------------------------------------------------------------------------


class ClarifyingQuestionSchema(BaseModel):
    question: str
    choices: list[str]
    context: str


# ---------------------------------------------------------------------------
# Response model
# ---------------------------------------------------------------------------


class ArchWorkflowResponse(BaseModel):
    session_id: str
    status: ArchWorkflowStatus

    # ── needs_clarification ──────────────────────────────────────────────────
    clarifying_questions: list[ClarifyingQuestionSchema] = Field(default_factory=list)

    # ── review_ready | accepted ──────────────────────────────────────────────
    architecture_diagram: dict[str, Any] | None = None
    nfr_document: str | None = None
    component_responsibilities: str | None = None
    extra_context: str | None = None
    eval_score: float | None = None
    eval_feedback: str | None = None
    compliance_gaps: list[dict[str, Any]] = Field(default_factory=list)

    # ── always present on error ──────────────────────────────────────────────
    error_message: str | None = None
