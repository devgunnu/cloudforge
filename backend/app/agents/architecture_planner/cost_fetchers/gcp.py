from __future__ import annotations

import logging

logger = logging.getLogger(__name__)


class GcpCostFetcher:
    """
    GCP pricing fetcher — not yet implemented.

    To implement: call the GCP Cloud Billing Catalog API (public endpoint, no auth for list):
    https://cloudbilling.googleapis.com/v1/services
    """

    async def fetch(self, services: list[str], region: str) -> str | None:
        logger.debug("GCP cost fetcher not yet implemented — skipping")
        return None
