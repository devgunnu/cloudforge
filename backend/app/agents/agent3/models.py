from __future__ import annotations

from typing import Any, Literal

from pydantic import BaseModel, Field


class ServiceNodeInput(BaseModel):
    id: str
    service_type: Literal[
        "lambda",
        "s3",
        "rds",
        "vpc",
        "api_gateway",
        "dynamodb",
        "sns",
        "sqs",
        "cloudfront",
        "ecs",
        "ec2",
        "elasticache",
        "kinesis",
        "glue",
        "step_functions",
        "cognito",
    ]
    label: str
    config: dict[str, Any] = Field(default_factory=dict)


class ConnectionInput(BaseModel):
    source: str
    target: str
    relationship: str = "connects_to"


class TopologyInput(BaseModel):
    services: list[ServiceNodeInput]
    connections: list[ConnectionInput] = Field(default_factory=list)
    cloud_provider: str = "aws"
    # Optional per-service language overrides inside the topology JSON itself
    language_overrides: dict[str, str] = Field(default_factory=dict)


class GenerateRequest(BaseModel):
    topology: str = Field(description="Raw JSON or YAML string describing the cloud topology")
    input_format: Literal["json", "yaml"] = "json"
    tf_max_retries: int = Field(default=3, ge=0, le=10)
    orchestrator_max_iterations: int = Field(default=10, ge=1, le=20)
    # Per-service language overrides; merged with any overrides inside the topology JSON
    language_overrides: dict[str, str] = Field(
        default_factory=dict,
        description="Override language per service id, e.g. {'fn1': 'typescript'}",
    )


class GenerationResult(BaseModel):
    thread_id: str
    artifacts: dict[str, str]
    tf_validation_passed: bool
    tf_fix_attempts: int
    tasks_completed: int
    tasks_total: int
    human_review_required: bool
    human_review_message: str | None = None
    generation_metadata: dict[str, Any] = Field(default_factory=dict)


class HumanFeedback(BaseModel):
    message: str
    corrected_files: dict[str, str] = Field(
        default_factory=dict,
        description="Optional manual corrections: filename -> corrected content",
    )


class StatusResponse(BaseModel):
    thread_id: str
    current_phase: str
    human_review_required: bool
    human_review_message: str | None = None
    artifacts: dict[str, str] | None = None
    interrupted: bool
    tf_fix_attempts: int
    tasks_completed: int
    tasks_total: int
