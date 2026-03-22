from __future__ import annotations

from pydantic import BaseModel


class TerraformResource(BaseModel):
    """A single resource type available in a Terraform provider."""

    name: str         # e.g. "aws_lambda_function"
    description: str  # from MCP response or inferred
    category: str     # inferred from resource name prefix


class TerraformProviderContext(BaseModel):
    """Full context for a cloud provider fetched from the Terraform MCP server."""

    provider: str                          # e.g. "hashicorp/aws"
    cloud_provider: str                    # "AWS" | "GCP" | "Azure"
    resources: list[TerraformResource]
    resource_schema_snippets: dict[str, str]  # resource_name → description snippet (populated lazily)


__all__ = ["TerraformResource", "TerraformProviderContext"]
