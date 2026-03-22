from __future__ import annotations

from typing import Protocol, runtime_checkable


@runtime_checkable
class CostFetcher(Protocol):
    """Protocol that all cloud pricing fetchers must satisfy."""

    async def fetch(
        self,
        services: list[str],
        region: str,
    ) -> str | None:
        """
        Fetch on-demand pricing for the given service names.

        Args:
            services: Architecture node service names (e.g. ["EC2", "RDS", "S3"]).
            region:   Cloud region string (e.g. "us-east-1", "eastus", "us-central1").

        Returns:
            A formatted string for prompt injection, or None if no data could be fetched.
        """
        ...
