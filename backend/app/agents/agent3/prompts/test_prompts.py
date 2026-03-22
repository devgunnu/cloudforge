from __future__ import annotations

from app.agents.agent3.prompts.renderer import render


def test_generation_system(language: str) -> str:
    return render("test_generation_system.jinja2", language=language)


def test_generation_user(
    language: str,
    service_id: str,
    service_type: str,
    source_code: str,
    architecture_context: str,
    ext: str,
    architecture_overview: str = "",
) -> str:
    return render(
        "test_generation_user.jinja2",
        language=language,
        service_id=service_id,
        service_type=service_type,
        source_code=source_code,
        architecture_context=architecture_context,
        ext=ext,
        architecture_overview=architecture_overview,
    )
