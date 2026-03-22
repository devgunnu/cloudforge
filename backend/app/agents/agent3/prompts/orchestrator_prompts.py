from __future__ import annotations

from app.agents.agent3.prompts.renderer import render


def orchestrator_system(
    architecture_summary: str,
    tf_file_names: list[str],
) -> str:
    return render(
        "orchestrator_system.j2",
        architecture_summary=architecture_summary,
        tf_file_names=tf_file_names,
    )
