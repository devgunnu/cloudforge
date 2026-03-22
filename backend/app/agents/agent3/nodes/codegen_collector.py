from __future__ import annotations

import logging
from typing import Any

from app.agents.agent3.state import AgentState

logger = logging.getLogger(__name__)


def codegen_collector_node(state: AgentState) -> dict[str, Any]:
    """Merge worker_results from parallel codegen workers into canonical state."""
    worker_results = state.get("worker_results") or []

    merged_code_files: dict[str, str] = dict(state.get("code_files") or {})
    merged_code_errors = []
    task_list = list(state.get("task_list") or [])

    for wr in worker_results:
        # Merge code files
        merged_code_files.update(wr.get("code_files") or {})

        # Collect errors
        merged_code_errors.extend(wr.get("code_errors") or [])

        # Update task statuses
        completed = {t["task_id"]: t for t in (wr.get("completed_tasks") or [])}
        for i, task in enumerate(task_list):
            if task["task_id"] in completed:
                task_list[i] = completed[task["task_id"]]

    logger.info(
        "codegen_collector: merged %d worker results, %d code files, %d errors",
        len(worker_results),
        len(merged_code_files),
        len(merged_code_errors),
    )

    return {
        "code_files": merged_code_files,
        "code_errors": merged_code_errors,
        "task_list": task_list,
    }
