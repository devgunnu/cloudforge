from __future__ import annotations

from typing import Any

from app.agents.agent3.config import EXT_MAP
from app.agents.agent3.state import CodeGenState
from app.agents.agent3.tools.syntax_tools import check_syntax


def code_validator_node(state: CodeGenState) -> dict[str, Any]:
    """Check syntax of generated_code (or generated_tests for test tasks)."""
    task = state["task"]
    language = task["language"]
    ext = EXT_MAP.get(language, language)
    service_id = task["service_id"]
    task_type = task["task_type"]

    if task_type == "test_gen":
        code = state.get("generated_tests") or ""
        filename = f"services/{service_id}/test_handler.{ext}"
    else:
        code = state.get("generated_code") or ""
        filename = f"services/{service_id}/index.{ext}"

    if not code:
        return {"syntax_errors": ["No code to validate"]}

    errors = check_syntax(code, language, filename)
    if errors:
        return {"syntax_errors": errors}

    return {"done": True}
