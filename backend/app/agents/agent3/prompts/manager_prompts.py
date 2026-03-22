from __future__ import annotations

from typing import Any

from app.agents.agent3.prompts.renderer import render


def manager_planning_system() -> str:
    return render("manager_planning_system.jinja2")


def manager_planning_user(
    architecture_summary: str,
    tf_file_names: list[str],
    tf_files_content: dict[str, str],
    services: list[dict[str, Any]],
    connections: list[dict[str, str]],
    code_gen_tasks: list[dict[str, Any]],
) -> str:
    return render(
        "manager_planning_user.jinja2",
        architecture_summary=architecture_summary,
        tf_file_names=tf_file_names,
        tf_files_content=tf_files_content,
        services=services,
        connections=connections,
        code_gen_tasks=code_gen_tasks,
    )
