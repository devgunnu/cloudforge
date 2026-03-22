from __future__ import annotations

import logging

from app.agents.architecture_planner.terraform_mcp.client import TerraformMCPClient
from app.agents.architecture_planner.terraform_mcp.models import (
    TerraformProviderContext,
    TerraformResource,
)

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Provider name mapping — extend here to add new cloud providers
# ---------------------------------------------------------------------------

_PROVIDER_MAP: dict[str, str] = {
    "AWS":   "hashicorp/aws",
    "GCP":   "hashicorp/google",
    "Azure": "hashicorp/azurerm",
}

# ---------------------------------------------------------------------------
# Resource-name-prefix → category map
# Infers a human-readable category without an extra MCP call.
# ---------------------------------------------------------------------------

_RESOURCE_CATEGORY_PREFIXES: list[tuple[str, str]] = [
    # AWS
    ("aws_lambda",          "Compute"),
    ("aws_ecs",             "Compute"),
    ("aws_eks",             "Compute"),
    ("aws_instance",        "Compute"),
    ("aws_autoscaling",     "Compute"),
    ("aws_batch",           "Compute"),
    ("aws_rds",             "Database"),
    ("aws_dynamodb",        "Database"),
    ("aws_elasticache",     "Database"),
    ("aws_redshift",        "Database"),
    ("aws_neptune",         "Database"),
    ("aws_docdb",           "Database"),
    ("aws_s3",              "Storage"),
    ("aws_efs",             "Storage"),
    ("aws_glacier",         "Storage"),
    ("aws_cloudfront",      "CDN"),
    ("aws_sqs",             "Messaging"),
    ("aws_sns",             "Messaging"),
    ("aws_kinesis",         "Messaging"),
    ("aws_msk",             "Messaging"),
    ("aws_eventbridge",     "Messaging"),
    ("aws_api_gateway",     "Networking"),
    ("aws_apigatewayv2",    "Networking"),
    ("aws_lb",              "Networking"),
    ("aws_alb",             "Networking"),
    ("aws_vpc",             "Networking"),
    ("aws_route53",         "Networking"),
    ("aws_iam",             "Security"),
    ("aws_kms",             "Security"),
    ("aws_waf",             "Security"),
    ("aws_shield",          "Security"),
    ("aws_cloudwatch",      "Monitoring"),
    ("aws_xray",            "Monitoring"),
    ("aws_cloudtrail",      "Monitoring"),
    ("aws_codepipeline",    "DevOps"),
    ("aws_codebuild",       "DevOps"),
    ("aws_codecommit",      "DevOps"),
    ("aws_cognito",         "Identity"),
    # GCP
    ("google_cloud_run",        "Compute"),
    ("google_container",        "Compute"),
    ("google_compute",          "Compute"),
    ("google_cloudfunctions",   "Compute"),
    ("google_sql",              "Database"),
    ("google_spanner",          "Database"),
    ("google_bigtable",         "Database"),
    ("google_firestore",        "Database"),
    ("google_storage",          "Storage"),
    ("google_pubsub",           "Messaging"),
    ("google_monitoring",       "Monitoring"),
    ("google_logging",          "Monitoring"),
    ("google_iam",              "Security"),
    ("google_kms",              "Security"),
    # Azure
    ("azurerm_function",        "Compute"),
    ("azurerm_container",       "Compute"),
    ("azurerm_kubernetes",      "Compute"),
    ("azurerm_virtual_machine", "Compute"),
    ("azurerm_sql",             "Database"),
    ("azurerm_cosmosdb",        "Database"),
    ("azurerm_redis_cache",     "Database"),
    ("azurerm_postgresql",      "Database"),
    ("azurerm_storage",         "Storage"),
    ("azurerm_servicebus",      "Messaging"),
    ("azurerm_eventhub",        "Messaging"),
    ("azurerm_cdn",             "CDN"),
    ("azurerm_monitor",         "Monitoring"),
    ("azurerm_key_vault",       "Security"),
    ("azurerm_active_directory", "Identity"),
]


def _infer_category(resource_name: str) -> str:
    for prefix, category in _RESOURCE_CATEGORY_PREFIXES:
        if resource_name.startswith(prefix):
            return category
    return "Other"


def _extract_text(mcp_result: dict) -> str:
    """Pull the text string out of an MCP tool result content list."""
    content = mcp_result.get("content", [])
    for item in content:
        if isinstance(item, dict) and item.get("type") == "text":
            return item.get("text", "")
    return ""


def _parse_resource_list(
    text_blob: str,
    resource_filter: list[str] | None,
    max_resources: int,
) -> list[TerraformResource]:
    """
    Parse the text response from list_terraform_registry_provider_resources.

    The MCP server returns a newline-separated list; each line is typically::

        aws_lambda_function - Manages an AWS Lambda Function resource.

    or just::

        aws_lambda_function
    """
    resources: list[TerraformResource] = []
    filter_lower = [f.lower() for f in resource_filter] if resource_filter else None

    for line in text_blob.splitlines():
        line = line.strip(" -•*\t")
        if not line:
            continue

        if " - " in line:
            name, _, description = line.partition(" - ")
            name = name.strip()
            description = description.strip()
        else:
            name = line.strip()
            description = ""

        # Skip header / prose lines (contain spaces inside the name part)
        if not name or " " in name:
            continue

        # Apply keyword filter when requested
        if filter_lower and not any(f in name.lower() for f in filter_lower):
            continue

        resources.append(TerraformResource(
            name=name,
            description=description or f"Terraform resource: {name}",
            category=_infer_category(name),
        ))

        if len(resources) >= max_resources:
            break

    return resources


def _format_context_for_prompt(context: TerraformProviderContext) -> str:
    header = (
        f"## Terraform Registry: Available {context.cloud_provider} Resources "
        f"({context.provider})\n"
    )
    lines = [header]
    for r in context.resources:
        lines.append(f"- {r.name} [{r.category}]: {r.description}")
    return "\n".join(lines)


# ---------------------------------------------------------------------------
# Public adapter
# ---------------------------------------------------------------------------


class TerraformMCPAdapter:
    """
    High-level, session-scoped adapter for the Terraform MCP server.

    Exposes a clean async API consumed by any agent node.  Caches provider
    resource lists within the adapter instance lifetime (one instance per
    graph execution, created in ``create_graph()``).

    Satisfies the ``TerraformMCPProvider`` Protocol — any agent that accepts
    a ``TerraformMCPProvider`` can use this adapter or a test stub.

    Args:
        cmd: Command list to launch the terraform-mcp-server subprocess.
             Examples::

                 ["npx", "-y", "@hashicorp/terraform-mcp-server"]
                 ["docker", "run", "--rm", "-i", "hashicorp/terraform-mcp-server"]
    """

    def __init__(self, cmd: list[str]) -> None:
        self._cmd = cmd
        # Cache: (cloud_provider, frozenset(filter_terms)) → TerraformProviderContext
        self._cache: dict[tuple, TerraformProviderContext] = {}

    async def get_provider_context(
        self,
        cloud_provider: str,
        resource_filter: list[str] | None = None,
        max_resources: int = 50,
    ) -> TerraformProviderContext | None:
        """
        Fetch and cache Terraform resource information for the given cloud provider.

        Returns ``None`` (and logs a warning) on any failure — never raises.
        """
        tf_provider = _PROVIDER_MAP.get(cloud_provider)
        if tf_provider is None:
            logger.debug("No Terraform provider mapped for cloud_provider=%r", cloud_provider)
            return None

        cache_key = (cloud_provider, frozenset(resource_filter or []))
        if cache_key in self._cache:
            logger.debug("Terraform MCP cache hit for %s", cloud_provider)
            return self._cache[cache_key]

        try:
            context = await self._fetch(cloud_provider, tf_provider, resource_filter, max_resources)
            self._cache[cache_key] = context
            return context
        except Exception as exc:
            logger.warning(
                "Terraform MCP unavailable for %s (%s: %s) — falling back to LLM-only",
                cloud_provider,
                type(exc).__name__,
                exc,
            )
            return None

    async def format_for_prompt(
        self,
        cloud_provider: str,
        resource_filter: list[str] | None = None,
        max_resources: int = 50,
    ) -> str | None:
        """
        Return a formatted, prompt-ready string of available Terraform resources,
        or ``None`` if MCP is unavailable.

        This is the primary method agent nodes should call.
        """
        context = await self.get_provider_context(cloud_provider, resource_filter, max_resources)
        if context is None:
            return None
        return _format_context_for_prompt(context)

    async def _fetch(
        self,
        cloud_provider: str,
        tf_provider: str,
        resource_filter: list[str] | None,
        max_resources: int,
    ) -> TerraformProviderContext:
        async with TerraformMCPClient(cmd=self._cmd) as client:
            raw_result = await client.call(
                "list_terraform_registry_provider_resources",
                {"provider": tf_provider},
            )
        text_blob = _extract_text(raw_result)
        resources = _parse_resource_list(text_blob, resource_filter, max_resources)
        return TerraformProviderContext(
            provider=tf_provider,
            cloud_provider=cloud_provider,
            resources=resources,
            resource_schema_snippets={},
        )


__all__ = ["TerraformMCPAdapter"]
