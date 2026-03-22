from __future__ import annotations

import time
from typing import Any

from app.agents.agent3.state import AgentState


def _count_tasks(task_list: list, status: str) -> int:
    return sum(1 for t in task_list if t["status"] == status)


def assembler_node(state: AgentState) -> dict[str, Any]:
    """Merge all generated artifacts into the final output dict."""
    artifacts: dict[str, str] = {}
    artifacts.update(state.get("tf_files") or {})
    artifacts.update(state.get("code_files") or {})
    artifacts.update(state.get("test_files") or {})

    task_list = state.get("task_list") or []
    code_errors = state.get("code_errors") or []

    metadata: dict[str, Any] = {
        "tf_fix_attempts": state.get("tf_fix_attempts", 0),
        "tf_validated": state.get("tf_validated", False),
        "tasks_total": len(task_list),
        "tasks_done": _count_tasks(task_list, "done"),
        "tasks_failed": _count_tasks(task_list, "failed"),
        "manager_plan_summary": state.get("manager_plan_summary", ""),
        "api_contracts_count": len(state.get("api_contracts") or []),
        "task_groups_count": len(state.get("task_groups") or []),
        "manager_review_count": state.get("manager_review_count", 0),
        "human_review_required": state.get("human_review_required", False),
        "code_errors": [dict(e) for e in code_errors],
        "generated_at": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
    }

    return {
        "artifacts": artifacts,
        "generation_metadata": metadata,
        "current_phase": "done",
    }


def error_handler_node(state: AgentState) -> dict[str, Any]:
    """Collect whatever partial artifacts exist and surface pipeline errors."""
    artifacts: dict[str, str] = {}
    artifacts.update(state.get("tf_files") or {})
    artifacts.update(state.get("code_files") or {})
    artifacts.update(state.get("test_files") or {})

    return {
        "artifacts": artifacts,
        "generation_metadata": {
            "errors": state.get("pipeline_errors") or [],
            "phase_at_failure": state.get("current_phase", "unknown"),
        },
        "current_phase": "error",
    }
