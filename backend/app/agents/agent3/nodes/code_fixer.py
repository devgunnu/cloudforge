from __future__ import annotations

from typing import Any

from langchain_core.messages import HumanMessage, SystemMessage

from app.agents.agent3.config import EXT_MAP
from app.agents.agent3.llm import get_fast_llm
from app.agents.agent3.prompts.code_prompts import code_fix_system, code_fix_user
from app.agents.agent3.state import CodeGenState
from app.agents.agent3.utils import strip_code_fences, strip_think_tags


def code_fixer_node(state: CodeGenState) -> dict[str, Any]:
    """Call Claude (fast model) to fix syntax errors in generated code."""
    task = state["task"]
    language = task["language"]
    ext = EXT_MAP.get(language, language)
    service_id = task["service_id"]
    task_type = task["task_type"]
    errors = state.get("syntax_errors") or []

    if task_type == "test_gen":
        code = state.get("generated_tests") or ""
        filename = f"services/{service_id}/test_handler.{ext}"
    else:
        code = state.get("generated_code") or ""
        filename = f"services/{service_id}/index.{ext}"

    if not code:
        return {
            "fix_attempts": state["fix_attempts"] + 1,
            "syntax_errors": ["Nothing to fix — code is empty"],
        }

    system_msg = code_fix_system(language=language)
    user_msg = code_fix_user(
        attempt=state["fix_attempts"] + 1,
        max_attempts=state["max_retries"],
        language=language,
        filename=filename,
        errors=errors[-10:],  # cap to last 10 errors to keep context tight
        code=code,
    )

    try:
        response = get_fast_llm().invoke(
            [SystemMessage(content=system_msg), HumanMessage(content=user_msg)]
        )
        raw = strip_think_tags(response.content)
        fixed = strip_code_fences(raw)
        if not fixed.strip():
            fixed = raw.strip()

        update: dict[str, Any] = {"fix_attempts": state["fix_attempts"] + 1}
        if task_type == "test_gen":
            update["generated_tests"] = fixed
        else:
            update["generated_code"] = fixed
        return update
    except Exception as e:
        return {
            "fix_attempts": state["fix_attempts"] + 1,
            "syntax_errors": [f"Code fix failed: {e}"],
        }
