from __future__ import annotations

import logging
from typing import Any

from app.agents.agent3.state import AgentState

logger = logging.getLogger(__name__)


def codegen_collector_node(state: AgentState) -> dict[str, Any]:
    """Merge worker_results from parallel codegen workers into canonical state."""
    worker_results = state.get("worker_results") or []

    # Do NOT seed from state["code_files"] here — the field is annotated with a
    # dict-merge reducer, so LangGraph will automatically merge the delta we
    # return with whatever is already accumulated in the channel.  Seeding from
    # the existing value would double-apply previously written files.
    merged_code_files: dict[str, str] = {}
    merged_code_errors = []
    task_list = list(state.get("task_list") or [])

    for wr in worker_results:
        # Collect code files from this worker result
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
