from __future__ import annotations

import json
import logging
from typing import Any, TypedDict

from langchain_core.messages import HumanMessage, SystemMessage

from app.agents.agent3.llm import get_default_llm
from app.agents.agent3.prompts.renderer import render
from app.agents.agent3.state import TaskItem

logger = logging.getLogger(__name__)


class InfraWorkerInput(TypedDict):
    """Input state for a single infra_codegen_worker invocation (used with Send)."""
    infra_task: TaskItem
    services: list
    connections: list
    project_name: str


def _get_service_type(file_path: str, services: list[dict[str, Any]]) -> str:
    """Derive the service type from the artifact file path.

    - "docker-compose.yml" → "all"
    - "services/{sid}/Dockerfile" → service_type of matching service
    - anything else → "unknown"
    """
    if file_path == "docker-compose.yml":
        return "all"

    parts = file_path.split("/")
    if len(parts) >= 3 and parts[0] == "services" and parts[2] == "Dockerfile":
        sid = parts[1]
        for svc in services:
            if svc.get("id") == sid:
                return svc.get("service_type", "unknown")

    return "unknown"


def _strip_markdown_fences(content: str) -> str:
    """Remove markdown code fences that an LLM may have added despite instructions."""
    if not content.startswith("```"):
        return content
    lines = content.split("\n")
    # Drop the opening fence line (``` or ```yaml etc.)
    start = 1
    # Drop the closing fence if present
    end = len(lines) - 1 if lines[-1].strip() == "```" else len(lines)
    return "\n".join(lines[start:end])


def infra_codegen_worker_node(state: dict[str, Any]) -> dict[str, Any]:
    """Generate a single project structure artifact (Dockerfile, docker-compose.yml) via LLM.

    Reads an infra_task whose service_id holds the artifact file path
    (e.g. 'docker-compose.yml' or 'services/api/Dockerfile'), calls the LLM with
    infra_scaffold_systemjinja2 + infra_scaffold_userjinja2, and returns the content
    in code_files.
    """
    task: TaskItem = state["infra_task"]
    services: list = state.get("services") or []
    connections: list = state.get("connections") or []
    project_name: str = state.get("project_name") or "cloudforge-app"

    file_path: str = task["service_id"]
    service_type: str = _get_service_type(file_path, services)

    try:
        system_prompt = render("infra_scaffold_systemjinja2")
        user_prompt = render(
            "infra_scaffold_userjinja2",
            file_path=file_path,
            project_name=project_name,
            service_type=service_type,
            services_json=json.dumps(services, indent=2),
            connections=connections,
        )

        response = get_default_llm().invoke([
            SystemMessage(content=system_prompt),
            HumanMessage(content=user_prompt),
        ])
        content = _strip_markdown_fences(response.content.strip())

        logger.info(
            "infra_codegen_worker: generated %s (%d chars, service_type=%s)",
            file_path,
            len(content),
            service_type,
        )
        return {"code_files": {file_path: content}}

    except Exception:
        logger.exception(
            "infra_codegen_worker: failed to generate %s", file_path
        )
        return {"code_files": {}}
