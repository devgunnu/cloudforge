from __future__ import annotations

from typing import Any

from app.agents.agent3.prompts.renderer import render


def code_generation_system(language: str) -> str:
    return render("code_generation_system.j2", language=language)


def code_generation_user(
    language: str,
    service_id: str,
    service_type: str,
    label: str,
    config: dict[str, Any],
    incoming: list[dict[str, str]],
    outgoing: list[dict[str, str]],
    tf_context: str,
    ext: str,
) -> str:
    return render(
        "code_generation_user.j2",
        language=language,
        service_id=service_id,
        service_type=service_type,
        label=label,
        config=config,
        incoming=incoming,
        outgoing=outgoing,
        tf_context=tf_context,
        ext=ext,
    )


def code_fix_system(language: str) -> str:
    return render("code_fix_system.j2", language=language)


def code_fix_user(
    attempt: int,
    max_attempts: int,
    language: str,
    filename: str,
    errors: list[str],
    code: str,
) -> str:
    return render(
        "code_fix_user.j2",
        attempt=attempt,
        max_attempts=max_attempts,
        language=language,
        filename=filename,
        errors=errors,
        code=code,
    )
