from __future__ import annotations

import os
from concurrent.futures import ThreadPoolExecutor, TimeoutError as FuturesTimeoutError
from typing import Any
from urllib.parse import urlparse

from langchain_community.utilities import DuckDuckGoSearchAPIWrapper

from app.config import settings


def _normalize(value: str) -> str:
    return " ".join(value.strip().lower().split())


def trusted_doc_domains(cloud_provider: str) -> list[str]:
    provider = cloud_provider.lower().strip()
    if provider == "azure":
        return ["learn.microsoft.com", "azure.microsoft.com"]
    if provider == "gcp":
        return ["cloud.google.com"]
    return ["docs.aws.amazon.com", "aws.amazon.com"]


def _is_trusted_domain(domain: str, trusted_domains: list[str]) -> bool:
    return any(domain == item or domain.endswith(f".{item}") for item in trusted_domains)


def _extract_items_from_tinyfish_result(result: Any) -> list[dict[str, Any]]:
    if isinstance(result, list):
        return [item for item in result if isinstance(item, dict)]

    if isinstance(result, dict):
        # Common wrappers for list payloads.
        for key in ("results", "items", "links", "data", "documents"):
            value = result.get(key)
            if isinstance(value, list):
                return [item for item in value if isinstance(item, dict)]

        # Single-item payload.
        if any(k in result for k in ("url", "link", "href")):
            return [result]

    return []


def _tinyfish_search(query: str, trusted_domains: list[str], max_results: int) -> list[dict[str, Any]]:
    try:
        from tinyfish import TinyFish
    except Exception as exc:  # noqa: BLE001
        raise RuntimeError(f"tinyfish_import_failed: {exc}") from exc

    client = TinyFish()
    collected: list[dict[str, Any]] = []
    seen_links: set[str] = set()

    for domain in trusted_domains:
        url = f"https://{domain}"
        goal = (
            "Find official cloud documentation pages relevant to this query and return strictly JSON. "
            f"Query: {query}. "
            f"Return up to {max_results} items as an array with keys: title, url, posted, snippet. "
            f"Only include links whose domain is exactly {domain} or a subdomain of {domain}."
        )

        complete_event: dict[str, Any] | None = None
        with client.agent.stream(url=url, goal=goal) as stream:
            for event in stream:
                if isinstance(event, dict) and _normalize(str(event.get("type", ""))) == "complete":
                    complete_event = event

        if not complete_event:
            continue

        status = _normalize(str(complete_event.get("status", "")))
        if status and status != "completed":
            continue

        items = _extract_items_from_tinyfish_result(complete_event.get("result"))
        for item in items:
            link = str(item.get("url") or item.get("link") or item.get("href") or "").strip()
            if not link or link in seen_links:
                continue

            source_domain = (urlparse(link).netloc or "").lower()
            if not _is_trusted_domain(source_domain, trusted_domains):
                continue

            seen_links.add(link)
            collected.append(
                {
                    "title": str(item.get("title") or item.get("name") or "").strip(),
                    "snippet": str(item.get("snippet") or item.get("summary") or item.get("posted") or "").strip(),
                    "link": link,
                    "source_domain": source_domain,
                    "is_official_source": True,
                }
            )
            if len(collected) >= max_results:
                return collected[:max_results]

    return collected[:max_results]


def _tinyfish_search_with_timeout(query: str, trusted_domains: list[str], max_results: int) -> list[dict[str, Any]]:
    with ThreadPoolExecutor(max_workers=1) as executor:
        future = executor.submit(_tinyfish_search, query, trusted_domains, max_results)
        try:
            return future.result(timeout=settings.tinyfish_timeout_seconds)
        except FuturesTimeoutError:
            return []


def _duckduckgo_search(query: str, trusted: list[str], max_results: int) -> list[dict[str, Any]]:
    # Search is intentionally constrained to official cloud docs to reduce hallucinated guidance.
    search = DuckDuckGoSearchAPIWrapper(max_results=max_results)
    results: list[dict[str, Any]] = []
    seen_links: set[str] = set()
    for domain in trusted:
        scoped_query = f"{query} site:{domain}"
        for item in search.results(scoped_query, max_results):
            link = str(item.get("link", "")).strip()
            if not link or link in seen_links:
                continue

            source_domain = (urlparse(link).netloc or "").lower()
            if not _is_trusted_domain(source_domain, trusted):
                continue

            seen_links.add(link)
            results.append(
                {
                    "title": str(item.get("title", "")).strip(),
                    "snippet": str(item.get("snippet", "")).strip(),
                    "link": link,
                    "source_domain": source_domain,
                    "is_official_source": True,
                }
            )
    return results[:max_results]


def web_search(query: str, cloud_provider: str, max_results: int = 5) -> list[dict[str, Any]]:
    trusted = trusted_doc_domains(cloud_provider)

    # Development workflow prefers the faster DDG path for tighter iteration loops.
    if settings.app_env.strip().lower() == "development":
        return _duckduckgo_search(query=query, trusted=trusted, max_results=max_results)

    # TinyFish is preferred for richer browser-driven extraction, but failures should never block results.
    if settings.enable_tinyfish_search:
        api_key = os.getenv("TINYFISH_API_KEY", "").strip()
        # Skip TinyFish when key is absent or obviously placeholder-like.
        if api_key and "*" not in api_key:
            try:
                tinyfish_results = _tinyfish_search_with_timeout(
                    query=query,
                    trusted_domains=trusted,
                    max_results=max_results,
                )
                if tinyfish_results:
                    return tinyfish_results
            except Exception:
                # Fall back silently to the existing DuckDuckGo behavior on auth/credit/runtime issues.
                pass

    return _duckduckgo_search(query=query, trusted=trusted, max_results=max_results)
