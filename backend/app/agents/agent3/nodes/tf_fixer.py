from __future__ import annotations

from typing import Any

from langchain_core.messages import HumanMessage, SystemMessage

from app.agents.agent3.llm import get_default_llm
from app.agents.agent3.prompts.tf_prompts import tf_fix_system, tf_fix_user
from app.agents.agent3.state import TFValidationState
from app.agents.agent3.utils import safe_json_extract


def tf_fixer_node(state: TFValidationState) -> dict[str, Any]:
    """Call Claude to fix Terraform validation errors and return corrected files."""
    system_msg = tf_fix_system(run_checkov=True)
    user_msg = tf_fix_user(
        attempt=state["fix_attempts"] + 1,
        max_attempts=state["max_retries"],
        error_summary=state.get("error_summary") or "Unknown errors — review all files",
        tf_files=state["tf_files"],
    )

    try:
        response = get_default_llm().invoke(
            [SystemMessage(content=system_msg), HumanMessage(content=user_msg)]
        )
        data = safe_json_extract(response.content)
        corrected: dict[str, str] = {
            f["name"]: f["content"]
            for f in data.get("files", [])
            if isinstance(f, dict) and "name" in f and "content" in f
        }

        # Merge only the corrected files; leave others unchanged
        updated_files = {**state["tf_files"], **corrected}

        return {
            "tf_files": updated_files,
            "fix_attempts": state["fix_attempts"] + 1,
            "error_summary": None,  # cleared — will be repopulated after next validation pass
        }
    except Exception as e:
        # Still increment attempt count so we don't loop forever
        return {
            "fix_attempts": state["fix_attempts"] + 1,
            "error_summary": (state.get("error_summary") or "") + f"\n[Fixer error: {e}]",
        }
