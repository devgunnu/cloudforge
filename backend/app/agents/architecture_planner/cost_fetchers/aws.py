from __future__ import annotations

import asyncio
import logging
import re

import httpx

logger = logging.getLogger(__name__)

_SERVICE_CODE_MAP: dict[str, str] = {
    "EC2": "AmazonEC2",
    "RDS": "AmazonRDS",
    "S3": "AmazonS3",
    "Lambda": "AWSLambda",
    "DynamoDB": "AmazonDynamoDB",
    "ECS": "AmazonECS",
    "EKS": "AmazonEKS",
    "CloudFront": "AmazonCloudFront",
    "ElastiCache": "AmazonElastiCache",
    "SQS": "AWSQueueService",
    "SNS": "AmazonSNS",
    "API Gateway": "AmazonApiGateway",
    "VPC": "AmazonVPC",
    "Route53": "AmazonRoute53",
    "CloudWatch": "AmazonCloudWatch",
    "Secrets Manager": "AWSSecretsManager",
    "WAF": "AWSWaf",
    "ALB": "AmazonEC2",
    "ELB": "AmazonEC2",
    "Fargate": "AmazonECS",
}

_PRICING_BASE = "https://pricing.us-east-1.amazonaws.com/offers/v1.0/aws"
_MAX_BYTES = 2_000_000  # 2 MB per service — keeps latency bounded
_TIMEOUT = 20.0


class AwsCostFetcher:
    """Fetches on-demand pricing from the public AWS Pricing API (no credentials required)."""

    async def fetch(self, services: list[str], region: str) -> str | None:
        unique = list(dict.fromkeys(services))  # deduplicate, preserve order
        mapped = [(svc, _SERVICE_CODE_MAP[svc]) for svc in unique if svc in _SERVICE_CODE_MAP]
        for svc in unique:
            if svc not in _SERVICE_CODE_MAP:
                logger.debug("No AWS service code mapping for %r — skipping", svc)
        if not mapped:
            return None

        async with httpx.AsyncClient(timeout=_TIMEOUT) as client:
            results = await asyncio.gather(
                *[self._fetch_one(client, svc, code) for svc, code in mapped],
                return_exceptions=True,
            )

        lines = []
        for (svc, _), result in zip(mapped, results):
            if isinstance(result, Exception):
                logger.warning("AWS pricing fetch failed for %s: %s", svc, result)
            elif result:
                lines.append(result)
        return "\n".join(lines) if lines else None

    async def _fetch_one(
        self,
        client: httpx.AsyncClient,
        service_name: str,
        service_code: str,
    ) -> str | None:
        url = f"{_PRICING_BASE}/{service_code}/current/index.json"
        async with client.stream("GET", url) as resp:
            resp.raise_for_status()
            chunks: list[bytes] = []
            total = 0
            async for chunk in resp.aiter_bytes(chunk_size=65536):
                chunks.append(chunk)
                total += len(chunk)
                if total >= _MAX_BYTES:
                    break
        raw = b"".join(chunks).decode("utf-8", errors="replace")
        return _extract_prices(service_name, service_code, raw)


def _extract_prices(service_name: str, service_code: str, raw: str) -> str | None:
    prices = [
        float(p)
        for p in re.findall(r'"USD"\s*:\s*"([0-9.]+)"', raw)
        if float(p) > 0
    ]
    if not prices:
        return None
    prices = sorted(set(prices))[:5]
    sample = ", ".join(f"${p:.4f}/unit" for p in prices)
    return (
        f"**{service_name}** ({service_code}): on-demand from "
        f"${prices[0]:.4f} to ${prices[-1]:.4f}/unit. Sample: [{sample}]"
    )
