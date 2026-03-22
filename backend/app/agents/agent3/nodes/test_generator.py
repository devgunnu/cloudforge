from __future__ import annotations

import json
from typing import Any

from langchain_core.messages import HumanMessage, SystemMessage

from app.agents.agent3.config import EXT_MAP
from app.agents.agent3.llm import get_default_llm
from app.agents.agent3.prompts.test_prompts import test_generation_system, test_generation_user
from app.agents.agent3.state import CodeGenState
from app.agents.agent3.utils import strip_code_fences


def test_generator_node(state: CodeGenState) -> dict[str, Any]:
    """Call Claude to generate unit tests for the already-generated service code."""
    task = state["task"]
    language = task["language"]
    ext = EXT_MAP.get(language, language)

    try:
        ctx: dict[str, Any] = json.loads(state.get("architecture_context") or "{}")
    except (json.JSONDecodeError, TypeError):
        ctx = {}

    service_id = task["service_id"]
    service_type = ctx.get("service_type", "lambda")
    source_code = state.get("generated_code") or "# source code not available"

    # Build a concise architecture description for the test prompt
    incoming = ctx.get("incoming") or []
    outgoing = ctx.get("outgoing") or []
    arch_lines: list[str] = []
    if incoming:
        arch_lines.append("Receives from: " + ", ".join(f"{c['from']} ({c['via']})" for c in incoming))
    if outgoing:
        arch_lines.append("Calls/triggers: " + ", ".join(f"{c['to']} ({c['via']})" for c in outgoing))
    arch_description = "\n".join(arch_lines)

    system_msg = test_generation_system(language=language)
    user_msg = test_generation_user(
        language=language,
        service_id=service_id,
        service_type=service_type,
        source_code=source_code,
        architecture_context=arch_description,
        ext=ext,
    )

    try:
        response = get_default_llm().invoke(
            [SystemMessage(content=system_msg), HumanMessage(content=user_msg)]
        )
        tests = strip_code_fences(response.content)
        if not tests.strip():
            return {"syntax_errors": ["Test generator returned empty output"]}
        return {"generated_tests": tests}
    except Exception as e:
        return {"syntax_errors": [f"Test generation failed: {e}"]}
