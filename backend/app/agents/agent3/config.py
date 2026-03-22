from __future__ import annotations

# NOTE: LLM model names are configured via settings.agent3_model /
#       settings.agent3_fast_model (app/config.py) so they can be
#       overridden through the .env file without touching source code.

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
]

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
