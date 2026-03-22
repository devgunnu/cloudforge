from __future__ import annotations

from typing import Any

from app.agents.agent3.prompts.renderer import render


def tf_generation_system(use_modules: bool = False) -> str:
    return render("tf_generation_system.jinja2", use_modules=use_modules)


def tf_generation_user(
    cloud_provider: str,
    services: list[dict[str, Any]],
    connections: list[dict[str, Any]],
) -> str:
    has_configs = any(s.get("config") for s in services)
    return render(
        "tf_generation_user.jinja2",
        cloud_provider=cloud_provider,
        services=services,
        connections=connections,
        has_configs=has_configs,
    )


def tf_fix_system(run_checkov: bool = True) -> str:
    return render("tf_fix_system.jinja2", run_checkov=run_checkov)


def tf_fix_user(
    attempt: int,
    max_attempts: int,
    error_summary: str,
    tf_files: dict[str, str],
) -> str:
    return render(
        "tf_fix_user.jinja2",
        attempt=attempt,
        max_attempts=max_attempts,
        error_summary=error_summary,
        tf_files=tf_files,
    )
