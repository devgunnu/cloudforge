from __future__ import annotations

from typing import Protocol, runtime_checkable

from app.agents.architecture_planner.terraform_mcp.models import TerraformProviderContext


@runtime_checkable
class TerraformMCPProvider(Protocol):
    """
    Protocol satisfied by TerraformMCPAdapter and any test stub / alternative
    implementation.

    Any agent that needs Terraform context depends on this Protocol, never on
    the concrete adapter class.  This enables easy mocking, testing, and future
    substitution without touching agent code.
    """

    async def get_provider_context(
        self,
        cloud_provider: str,
        resource_filter: list[str] | None = None,
        max_resources: int = 50,
    ) -> TerraformProviderContext | None:
        """
        Return typed provider context (resource list + descriptions).

        Args:
            cloud_provider: "AWS" | "GCP" | "Azure"
            resource_filter: Optional list of keyword strings; only resources
                             whose names contain at least one keyword are returned.
            max_resources:   Cap on the number of resources returned.

        Returns:
            TerraformProviderContext, or None if MCP is unavailable or the
            provider is not mapped.  Never raises.
        """
        ...

    async def format_for_prompt(
        self,
        cloud_provider: str,
        resource_filter: list[str] | None = None,
        max_resources: int = 50,
    ) -> str | None:
        """
        Convenience method returning a formatted, prompt-ready string, or None
        if no data is available.  This is the primary method agent nodes call.
        """
        ...


__all__ = ["TerraformMCPProvider"]
