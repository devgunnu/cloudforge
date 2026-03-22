from __future__ import annotations

import logging

logger = logging.getLogger(__name__)


class AzureCostFetcher:
    """
    Azure pricing fetcher — not yet implemented.

    To implement: call the Azure Retail Prices API (public, no auth required):
    https://prices.azure.com/api/retail/prices
    """

    async def fetch(self, services: list[str], region: str) -> str | None:
        logger.debug("Azure cost fetcher not yet implemented — skipping")
        return None
