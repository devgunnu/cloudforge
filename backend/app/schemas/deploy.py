"""Pydantic schemas for the deploy API."""

from __future__ import annotations

from typing import Any, Literal

from pydantic import BaseModel, Field


# ── Request schemas ──────────────────────────────────────────────────

class ArchNodeSchema(BaseModel):
    """A single node from the CloudForge architecture."""
    id: str
    label: str
    sublabel: str = ""
    type: Literal["compute", "storage", "cache", "gateway", "queue", "auth"]
    x: float = 0
    y: float = 0
    terraformResource: str = ""
    estimatedCost: str = ""
    config: dict[str, str] = Field(default_factory=dict)
    whyChosen: str = ""
    validates: list[str] = Field(default_factory=list)
    blocks: list[str] = Field(default_factory=list)
    deployStatus: str = "queued"


class ArchEdgeSchema(BaseModel):
    """An edge between two architecture nodes."""
    source: str = Field(alias="from", default="")
    target: str = Field(alias="to", default="")

    model_config = {"populate_by_name": True}


class ArchitectureDataSchema(BaseModel):
    """Full architecture spec from the frontend."""
    nodes: list[ArchNodeSchema] = Field(default_factory=list)
    edges: list[ArchEdgeSchema] = Field(default_factory=list)


class StartDeployRequest(BaseModel):
    """Request body for POST /deploy/start."""
    architecture_data: ArchitectureDataSchema
    project_name: str = "cloudforge-project"
    region: str = "us-east-1"
    environment: str = "prod"
    aws_credentials: dict[str, str] | None = Field(
        default=None,
        description="Optional AWS credentials (access_key_id, secret_access_key, session_token)",
    )


class RollbackRequest(BaseModel):
    """Request body for POST /deploy/{deployment_id}/rollback."""
    confirm: bool = True


# ── Response schemas ─────────────────────────────────────────────────

class DeployStartResponse(BaseModel):
    """Response for POST /deploy/start."""
    deployment_id: str
    status: str = "accepted"
    message: str = "Deployment started"


class DeployStatusResponse(BaseModel):
    """Response for GET /deploy/{deployment_id}/status."""
    deployment_id: str
    project_name: str
    status: str
    region: str
    environment: str
    node_statuses: dict[str, str] = Field(default_factory=dict)
    outputs: dict[str, Any] = Field(default_factory=dict)
    is_rollback: bool = False
    created_at: str
    updated_at: str


class DeployListItem(BaseModel):
    """Summary item for GET /deploy/list."""
    deployment_id: str
    project_name: str
    status: str
    region: str
    environment: str
    is_rollback: bool = False
    created_at: str


class RollbackResponse(BaseModel):
    """Response for POST /deploy/{deployment_id}/rollback."""
    rollback_id: str
    status: str = "accepted"
    message: str = "Rollback started"
