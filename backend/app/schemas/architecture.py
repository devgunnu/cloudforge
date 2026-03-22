from __future__ import annotations

from typing import Any, Literal

from pydantic import BaseModel, Field


ArchWorkflowStatus = Literal["review_ready", "accepted", "error"]


# ---------------------------------------------------------------------------
# Request models
# ---------------------------------------------------------------------------


class StartArchWorkflowRequest(BaseModel):
    """Start the architecture planner from an accepted PRD session."""

    prd_session_id: str = Field(
        description="session_id returned by POST /workflows/prd/accept"
    )
    budget: str = Field(default="", description="Budget constraint, e.g. '$500/month'.")
    traffic: str = Field(default="", description="Expected traffic, e.g. '10k requests/day'.")
    availability: str = Field(default="", description="Availability target, e.g. '99.9% uptime'.")


class ReviewArchWorkflowRequest(BaseModel):
    """Accept or request changes to the generated architecture."""

    session_id: str
    accepted: bool
    changes: str = Field(default="", description="Requested changes when accepted=False.")


# ---------------------------------------------------------------------------
# Response model
# ---------------------------------------------------------------------------


class ArchWorkflowResponse(BaseModel):
    session_id: str
    status: ArchWorkflowStatus

    # ── review_ready | accepted ──────────────────────────────────────────────
    architecture_diagram: dict[str, Any] | None = None
    nfr_document: str | None = None
    component_responsibilities: str | None = None
    extra_context: str | None = None
    arch_test_passed: bool | None = None
    arch_test_violations_count: int | None = None
    compliance_gaps: list[dict[str, Any]] = Field(default_factory=list)

    # ── always present on error ──────────────────────────────────────────────
    error_message: str | None = None
