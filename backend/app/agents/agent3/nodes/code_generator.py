from __future__ import annotations

import json
from typing import Any

from langchain_core.messages import HumanMessage, SystemMessage

from app.agents.agent3.config import EXT_MAP
from app.agents.agent3.llm import get_default_llm
from app.agents.agent3.prompts.code_prompts import code_generation_system, code_generation_user
from app.agents.agent3.state import CodeGenState
from app.agents.agent3.utils import strip_code_fences


def code_generator_node(state: CodeGenState) -> dict[str, Any]:
    """Call Claude to generate application code for a specific service."""
    task = state["task"]
    language = task["language"]
    ext = EXT_MAP.get(language, language)

    # Parse the JSON architecture context blob built by the orchestrator
    try:
        ctx: dict[str, Any] = json.loads(state.get("architecture_context") or "{}")
    except (json.JSONDecodeError, TypeError):
        ctx = {}

    service_id = task["service_id"]
    service_type = ctx.get("service_type", "lambda")
    label = ctx.get("label", service_id)
    config: dict[str, Any] = ctx.get("config") or {}
    incoming: list[dict[str, str]] = ctx.get("incoming") or []
    outgoing: list[dict[str, str]] = ctx.get("outgoing") or []

    system_msg = code_generation_system(language=language)
    user_msg = code_generation_user(
        language=language,
        service_id=service_id,
        service_type=service_type,
        label=label,
        config=config,
        incoming=incoming,
        outgoing=outgoing,
        tf_context=state.get("tf_context") or "",
        ext=ext,
    )

    try:
        response = get_default_llm().invoke(
            [SystemMessage(content=system_msg), HumanMessage(content=user_msg)]
        )
        code = strip_code_fences(response.content)
        if not code.strip():
            return {"syntax_errors": ["Code generator returned empty output"]}
        return {"generated_code": code}
    except Exception as e:
        return {"syntax_errors": [f"Code generation failed: {e}"]}
