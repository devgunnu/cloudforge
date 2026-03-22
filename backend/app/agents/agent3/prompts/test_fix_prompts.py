from __future__ import annotations

from app.agents.agent3.prompts.renderer import render


def test_fix_system(language: str) -> str:
    return render("test_fix_system.jinja2", language=language)


def test_fix_user(
    attempt: int,
    max_attempts: int,
    language: str,
    service_code: str,
    test_code: str,
    test_output: str,
) -> str:
    return render(
        "test_fix_user.jinja2",
        attempt=attempt,
        max_attempts=max_attempts,
        language=language,
        service_code=service_code,
        test_code=test_code,
        test_output=test_output,
    )
