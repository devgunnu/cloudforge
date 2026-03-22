from __future__ import annotations

from typing import Any, Literal

from pydantic import BaseModel, Field


# ---------------------------------------------------------------------------
# LLM structured output schemas (used with .with_structured_output())
# ---------------------------------------------------------------------------


class APIContractLLMOutput(BaseModel):
    source_service_id: str = Field(description="ID of the service that initiates the call")
    target_service_id: str = Field(description="ID of the service that receives the call")
    relationship: str = Field(description="Type of relationship e.g. invokes, publishes_to")
    contract_type: str = Field(description="One of: event_payload, api_request, queue_message, stream_record")
    payload_schema: dict[str, Any] = Field(default_factory=dict, description="JSON schema of the data payload")
    function_signatures: dict[str, str] = Field(default_factory=dict, description="Language to function signature mapping")
    notes: str = Field(default="", description="Additional notes about the contract")


class TaskGroupLLMOutput(BaseModel):
    group_id: str = Field(description="Unique identifier for this task group")
    service_ids: list[str] = Field(description="List of service IDs to generate code for in this group")
    rationale: str = Field(default="", description="Why these services are grouped together")


class ManagerPlanOutput(BaseModel):
    api_contracts: list[APIContractLLMOutput] = Field(
        default_factory=list,
        description="Interface contracts between connected services",
    )
    task_groups: list[TaskGroupLLMOutput] = Field(
        description="Groups of services for parallel code generation"
    )
    plan_summary: str = Field(default="", description="High-level summary of the generation plan")


class TFFile(BaseModel):
    name: str = Field(description="Terraform filename e.g. main.tf, variables.tf")
    content: str = Field(description="Full HCL content of the file")


class TFGeneratorOutput(BaseModel):
    files: list[TFFile] = Field(description="All Terraform files to generate")


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
