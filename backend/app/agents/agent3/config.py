from __future__ import annotations

# NOTE: LLM provider and model are configured via LLM_PROVIDER,
#       OPENROUTER_MODEL / OLLAMA_MODEL in .env (see app/config.py).

# ---------------------------------------------------------------------------
# Retry / iteration limits
# ---------------------------------------------------------------------------

TF_MAX_RETRIES = 3
CODE_MAX_RETRIES = 3
ORCHESTRATOR_MAX_ITERATIONS = 10

# ---------------------------------------------------------------------------
# Subprocess timeouts (seconds)
# ---------------------------------------------------------------------------

TERRAFORM_TIMEOUT = 60
TFLINT_TIMEOUT = 30
CHECKOV_TIMEOUT = 120
TSC_TIMEOUT = 30

# ---------------------------------------------------------------------------
# Service type registry
# ---------------------------------------------------------------------------

SUPPORTED_SERVICE_TYPES = [
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
    "amplify",
]

# ---------------------------------------------------------------------------
# Scaffold / language resolution
# ---------------------------------------------------------------------------

LAMBDA_SERVICE_TYPES: frozenset[str] = frozenset(
    {"lambda", "api_gateway", "step_functions", "glue"}
)

JAVA_REQUIRED_SERVICES: frozenset[str] = frozenset({"kinesis"})

AMPLIFY_TRIGGER_SERVICE_TYPES: frozenset[str] = frozenset({"amplify"})

# Lambda features that mandate a specific runtime
RUNTIME_FEATURE_REQUIREMENTS: dict[str, str] = {
    "response_streaming": "typescript",
    "websocket_streaming": "typescript",
    "snapstart": "java",
    "kinesis_kcl": "java",
}

# Maps service_type -> which CDK stack it belongs to
STACK_ASSIGNMENT: dict[str, str] = {
    "vpc": "network-stack",
    "rds": "data-stack",
    "dynamodb": "data-stack",
    "s3": "data-stack",
    "elasticache": "data-stack",
    "kinesis": "streaming-stack",
    "glue": "streaming-stack",
    "lambda": "api-stack",
    "api_gateway": "api-stack",
    "sns": "api-stack",
    "sqs": "api-stack",
    "step_functions": "api-stack",
    "ecs": "api-stack",
    "ec2": "api-stack",
    "amplify": "frontend-stack",
}

# Default language for generated application code per service type
SERVICE_LANGUAGE_MAP: dict[str, str] = {
    "lambda": "python",
    "ecs": "python",
    "ec2": "python",
    "glue": "python",
    "step_functions": "python",
    "api_gateway": "typescript",
}

DEFAULT_LANGUAGE = "python"

# ---------------------------------------------------------------------------
# Language → file extension map (used across code-gen nodes)
# ---------------------------------------------------------------------------

EXT_MAP: dict[str, str] = {
    "python": "py",
    "typescript": "ts",
    "javascript": "js",
    "java": "java",
}

# ---------------------------------------------------------------------------
# ReAct agent recursion limit multiplier (steps per task)
# ---------------------------------------------------------------------------

RECURSION_STEPS_PER_TASK = 6  # ~2 super-steps per tool call × ~3 tool calls per task

# ---------------------------------------------------------------------------
# Terraform file names that are always generated
# ---------------------------------------------------------------------------

TF_BASE_FILES = ["main.tf", "variables.tf", "outputs.tf", "providers.tf"]

# ---------------------------------------------------------------------------
# Manager / parallel codegen
# ---------------------------------------------------------------------------

MAX_CODEGEN_WORKERS = 3
MANAGER_MAX_REVIEW_ITERATIONS = 2
TEST_EXECUTION_MAX_RETRIES = 2
PYTEST_TIMEOUT = 60  # seconds
JEST_TIMEOUT = 60
