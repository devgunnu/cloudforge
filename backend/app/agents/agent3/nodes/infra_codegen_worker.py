from __future__ import annotations

import json
import logging
from pathlib import Path
from typing import Any, TypedDict

from langchain_core.messages import HumanMessage, SystemMessage

from app.agents.agent3.config import STACK_ASSIGNMENT
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


def _build_services_in_stack(stack_name: str, services: list[dict[str, Any]]) -> list[dict[str, Any]]:
    """Return the subset of services that belong to the given CDK stack."""
    return [
        s for s in services
        if STACK_ASSIGNMENT.get(s.get("service_type", "")) == stack_name
    ]


def _strip_markdown_fences(content: str) -> str:
    """Remove markdown code fences that an LLM may have added despite instructions."""
    if not content.startswith("```"):
        return content
    lines = content.split("\n")
    # Drop the opening fence line (``` or ```typescript etc.)
    start = 1
    # Drop the closing fence if present
    end = len(lines) - 1 if lines[-1].strip() == "```" else len(lines)
    return "\n".join(lines[start:end])


def infra_codegen_worker_node(state: dict[str, Any]) -> dict[str, Any]:
    """Generate a single CDK stack TypeScript file via LLM.

    Reads an infra_task whose service_id holds the stack file path
    (e.g. 'infrastructure/lib/stacks/api-stack.ts'), calls the LLM with
    cdk_stack_system.j2 + cdk_stack_user.j2, and returns the content
    merged into tf_files (CDK stacks are treated as IaC artifacts).
    """
    task: TaskItem = state["infra_task"]
    services: list = state.get("services") or []
    connections: list = state.get("connections") or []
    project_name: str = state.get("project_name") or "cloudforge-app"

    # service_id holds the stack file path for infra_gen tasks
    stack_file_path: str = task["service_id"]
    # Derive the logical stack name from the filename stem: "api-stack.ts" → "api-stack"
    stack_name: str = Path(stack_file_path).stem

    services_in_stack = _build_services_in_stack(stack_name, services)

    try:
        system_prompt = render("cdk_stack_system.j2")
        user_prompt = render(
            "cdk_stack_user.j2",
            stack_file_path=stack_file_path,
            stack_name=stack_name,
            project_name=project_name,
            services_in_stack=services_in_stack,
            all_services_json=json.dumps(services, indent=2),
            connections=connections,
        )

        response = get_default_llm().invoke([
            SystemMessage(content=system_prompt),
            HumanMessage(content=user_prompt),
        ])
        content = _strip_markdown_fences(response.content.strip())

        logger.info(
            "infra_codegen_worker: generated %s (%d chars, %d services in stack)",
            stack_file_path,
            len(content),
            len(services_in_stack),
        )
        return {"tf_files": {stack_file_path: content}}

    except Exception:
        logger.exception(
            "infra_codegen_worker: failed to generate %s", stack_file_path
        )
        return {"tf_files": {}}
