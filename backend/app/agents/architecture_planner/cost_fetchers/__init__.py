from __future__ import annotations

import logging

from app.agents.architecture_planner.cost_fetchers.aws import AwsCostFetcher
from app.agents.architecture_planner.cost_fetchers.azure import AzureCostFetcher
from app.agents.architecture_planner.cost_fetchers.base import CostFetcher
from app.agents.architecture_planner.cost_fetchers.gcp import GcpCostFetcher

logger = logging.getLogger(__name__)

# Registry: cloud_provider string → fetcher instance.
# To add a new provider: implement the CostFetcher protocol and add an entry here.
_REGISTRY: dict[str, CostFetcher] = {
    "AWS": AwsCostFetcher(),
    "Azure": AzureCostFetcher(),
    "GCP": GcpCostFetcher(),
}


async def fetch_cost_data(
    cloud_provider: str,
    services: list[str],
    region: str = "us-east-1",
) -> str | None:
    """
    Dispatch to the appropriate cloud pricing fetcher.

    Returns None silently for unknown providers or when the fetcher returns no data.
    Never raises — all exceptions are caught and logged as warnings.
    """
    fetcher = _REGISTRY.get(cloud_provider)
    if fetcher is None:
        logger.debug("No cost fetcher registered for provider %r", cloud_provider)
        return None
    try:
        return await fetcher.fetch(services=services, region=region)
    except Exception as exc:
        logger.warning("Cost fetch failed for %s: %s", cloud_provider, exc)
        return None


__all__ = ["fetch_cost_data"]
