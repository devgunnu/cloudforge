from __future__ import annotations

from urllib.parse import urlparse

from langchain_community.utilities import DuckDuckGoSearchAPIWrapper


def trusted_doc_domains(cloud_provider: str) -> list[str]:
    provider = cloud_provider.lower().strip()
    if provider == "azure":
        return ["learn.microsoft.com", "azure.microsoft.com"]
    if provider == "gcp":
        return ["cloud.google.com"]
    return ["docs.aws.amazon.com", "aws.amazon.com"]


def _is_trusted_domain(domain: str, trusted_domains: list[str]) -> bool:
    return any(domain == item or domain.endswith(f".{item}") for item in trusted_domains)


def web_search(query: str, cloud_provider: str, max_results: int = 5) -> list[dict[str, str]]:
    # Search is intentionally constrained to official cloud docs to reduce hallucinated guidance.
    search = DuckDuckGoSearchAPIWrapper(max_results=max_results)
    trusted = trusted_doc_domains(cloud_provider)

    results: list[dict[str, str]] = []
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
