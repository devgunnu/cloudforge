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


class FileManifestEntry(TypedDict):
    path: str
    fill_strategy: str   # "template" | "llm_handler" | "llm_cdk" | "llm_frontend" | "llm_java" | "llm_test"
    language: str
    service_id: str | None
    required: bool
    description: str


class TaskItem(TypedDict):
    task_id: str
    service_id: str
    task_type: Literal["code_gen", "test_gen", "infra_gen", "frontend_gen"]
    language: str  # "python", "typescript", "java", etc.
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


class APIContract(TypedDict):
    """Interface contract between two connected services."""
    source_service_id: str
    target_service_id: str
    relationship: str  # from Connection.relationship
    contract_type: str  # "event_payload", "api_request", "queue_message", "stream_record"
    payload_schema: dict[str, Any]  # JSON schema of exchanged data
    function_signatures: dict[str, str]  # language -> signature string
    notes: str


class TaskGroup(TypedDict):
    """A group of semantically related services assigned to one codegen worker."""
    group_id: str
    service_ids: list[str]
    tasks: list[TaskItem]  # code_gen tasks only
    api_contracts: list[APIContract]  # contracts relevant to this group
    rationale: str  # why these services are grouped


class WorkerResult(TypedDict):
    """Result from a single parallel codegen worker."""
    group_id: str
    code_files: dict[str, str]
    code_errors: list[CodeError]
    completed_tasks: list[TaskItem]


class TestResult(TypedDict):
    """Result from executing tests for a service."""
    service_id: str
    passed: bool
    output: str  # stdout/stderr from test runner
    errors: list[str]


class CodegenWorkerState(TypedDict):
    """State for a single parallel codegen worker (used with Send)."""
    group_id: str
    tasks: list[TaskItem]
    api_contracts: list[APIContract]
    tf_context_map: dict[str, str]  # service_id -> relevant TF lines
    architecture_context_map: dict[str, str]  # service_id -> architecture JSON blob
    architecture_overview: str
    code_files: dict[str, str]
    code_errors: list[CodeError]
    completed_task_list: list[TaskItem]


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
    tf_files: Annotated[dict[str, str], lambda a, b: {**a, **b}]  # filename -> HCL content
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

    # Manager planning output
    api_contracts: list[APIContract]
    task_groups: list[TaskGroup]
    manager_plan_summary: str
    worker_results: Annotated[list[WorkerResult], add]  # fan-in from parallel workers
    manager_review_count: int

    # Code artifacts
    code_files: dict[str, str]   # path -> content
    test_files: dict[str, str]
    code_errors: Annotated[list[CodeError], add]  # append-only error log

    # Scaffold phase output
    scaffold_files: dict[str, str]          # path -> content (template-generated files)
    file_manifest: list[FileManifestEntry]  # full project file manifest
    project_name: str

    # Pipeline control
    current_phase: Literal[
        "parsing",
        "scaffolding",
        "tf_generation",
        "tf_validation",
        "planning",
        "orchestration",
        "testing",
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
    architecture_overview: str       # full architecture summary (all services + connections + TF files)
    generated_code: str | None
    generated_tests: str | None
    syntax_errors: Annotated[list[str], add]
    fix_attempts: int
    max_retries: int
    done: bool
    human_review_required: bool
    human_review_message: str | None
