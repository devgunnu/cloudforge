from __future__ import annotations

import json
import logging
from typing import Any, TypedDict

from langchain_core.messages import HumanMessage, SystemMessage

from app.agents.agent3.llm import get_default_llm
from app.agents.agent3.prompts.renderer import render
from app.agents.agent3.state import TaskItem

logger = logging.getLogger(__name__)

# Relationship types that indicate an API call path from frontend to backend
_API_RELATIONSHIPS = frozenset({"routes_to", "triggers"})


class FrontendWorkerInput(TypedDict):
    """Input state for a single frontend_codegen_worker invocation (used with Send)."""
    frontend_task: TaskItem
    services: list
    connections: list
    project_name: str
    api_endpoints: list  # list of endpoint dicts derived from topology


def _derive_api_endpoints(services: list[dict[str, Any]], connections: list[dict[str, Any]]) -> list[dict[str, Any]]:
    """Extract likely API endpoints from the topology.

    Looks for connections whose relationship indicates an HTTP routing or
    triggering path (e.g. api_gateway routes_to lambda). Returns a list of
    dicts suitable for injecting into the frontend prompt so the LLM knows
    which backend endpoints exist.
    """
    endpoints = []
    for conn in connections:
        if conn.get("relationship") in _API_RELATIONSHIPS:
            endpoints.append({
                "source": conn["source"],
                "target": conn["target"],
                "relationship": conn["relationship"],
            })
    return endpoints


def _strip_markdown_fences(content: str) -> str:
    """Remove markdown code fences that an LLM may have added despite instructions."""
    if not content.startswith("```"):
        return content
    lines = content.split("\n")
    start = 1
    end = len(lines) - 1 if lines[-1].strip() == "```" else len(lines)
    return "\n".join(lines[start:end])


def frontend_codegen_worker_node(state: dict[str, Any]) -> dict[str, Any]:
    """Generate a single frontend TypeScript/TSX file via LLM.

    Reads a frontend_task whose service_id holds the file path
    (e.g. 'frontend/src/App.tsx'), calls the LLM with
    frontend_systemjinja2 + frontend_userjinja2, and returns the content
    merged into code_files.
    """
    task: TaskItem = state["frontend_task"]
    services: list = state.get("services") or []
    connections: list = state.get("connections") or []
    project_name: str = state.get("project_name") or "cloudforge-app"
    # Caller may pre-compute endpoints; fall back to deriving them from topology
    api_endpoints: list = state.get("api_endpoints") or _derive_api_endpoints(services, connections)

    file_path: str = task["service_id"]

    try:
        system_prompt = render("frontend_systemjinja2")
        user_prompt = render(
            "frontend_userjinja2",
            file_path=file_path,
            project_name=project_name,
            api_endpoints_json=json.dumps(api_endpoints, indent=2),
            services_json=json.dumps(services, indent=2),
            connections=connections,
        )

        response = get_default_llm().invoke([
            SystemMessage(content=system_prompt),
            HumanMessage(content=user_prompt),
        ])
        content = _strip_markdown_fences(response.content.strip())

        logger.info(
            "frontend_codegen_worker: generated %s (%d chars)",
            file_path,
            len(content),
        )
        return {"code_files": {file_path: content}}

    except Exception:
        logger.exception(
            "frontend_codegen_worker: failed to generate %s", file_path
        )
        return {"code_files": {}}
