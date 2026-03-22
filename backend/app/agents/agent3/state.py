from __future__ import annotations

from operator import add
from typing import Annotated, Any, Literal, TypedDict

from langchain_core.messages import BaseMessage
from langgraph.graph.message import add_messages


# ---------------------------------------------------------------------------
# Atomic data types
# ---------------------------------------------------------------------------


class ServiceNode(TypedDict):
    id: str
    service_type: str  # "lambda", "s3", "rds", "vpc", "api_gateway", etc.
    label: str
    config: dict[str, Any]


class Connection(TypedDict):
    source: str
    target: str
    relationship: str  # "triggers", "reads", "writes", "routes_to", "connects_to"


class TaskItem(TypedDict):
    task_id: str
    service_id: str
    task_type: Literal["code_gen", "test_gen"]
    language: str  # "python", "typescript", etc.
    status: Literal["pending", "in_progress", "done", "failed"]
    retry_count: int
    error_message: str | None


class ValidationResult(TypedDict):
    tool: str  # "terraform_fmt", "terraform_validate", "tflint", "checkov"
    passed: bool
    output: str
    errors: list[str]


class CodeError(TypedDict):
    service_id: str
    task_type: str
    file: str
    errors: list[str]


# ---------------------------------------------------------------------------
# Top-level graph state
# ---------------------------------------------------------------------------


class AgentState(TypedDict):
    # Input
    thread_id: str
    raw_input: str
    input_format: Literal["json", "yaml"]
    language_overrides: dict[str, str]  # service_id -> language, e.g. {"fn1": "typescript"}

    # Parsed topology
    services: list[ServiceNode]
    connections: list[Connection]
    cloud_provider: str

    # Terraform phase
    tf_files: dict[str, str]  # filename -> HCL content
    tf_validation_results: Annotated[list[ValidationResult], add]
    tf_fix_attempts: int
    tf_max_retries: int
    tf_validated: bool
    tf_error_summary: str | None

    # Orchestrator phase
    task_list: list[TaskItem]
    orchestrator_messages: Annotated[list[BaseMessage], add_messages]
    orchestrator_iterations: int
    orchestrator_max_iterations: int

    # Code artifacts
    code_files: dict[str, str]   # path -> content
    test_files: dict[str, str]
    code_errors: Annotated[list[CodeError], add]  # append-only error log

    # Pipeline control
    current_phase: Literal[
        "parsing",
        "tf_generation",
        "tf_validation",
        "orchestration",
        "assembly",
        "done",
        "error",
    ]
    pipeline_errors: Annotated[list[str], add]
    human_review_required: bool
    human_review_message: str | None

    # Final output
    artifacts: dict[str, str]
    generation_metadata: dict[str, Any]


# ---------------------------------------------------------------------------
# TF validation subgraph state
# ---------------------------------------------------------------------------


class TFValidationState(TypedDict):
    tf_files: dict[str, str]
    validation_results: Annotated[list[ValidationResult], add]
    fix_attempts: int
    max_retries: int
    error_summary: str | None
    validated: bool
    human_review_required: bool
    human_review_message: str | None


# ---------------------------------------------------------------------------
# Code generation subgraph state
# ---------------------------------------------------------------------------


class CodeGenState(TypedDict):
    task: TaskItem
    tf_context: str
    architecture_context: str        # JSON string: {service_type, label, config, incoming, outgoing}
    generated_code: str | None
    generated_tests: str | None
    syntax_errors: Annotated[list[str], add]
    fix_attempts: int
    max_retries: int
    done: bool
    human_review_required: bool
    human_review_message: str | None
