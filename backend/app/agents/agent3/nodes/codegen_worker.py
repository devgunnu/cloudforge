from __future__ import annotations

import json
import logging
import threading
from typing import Any

from app.agents.agent3.config import CODE_MAX_RETRIES, EXT_MAP
from app.agents.agent3.state import (
    CodeError,
    CodeGenState,
    CodegenWorkerState,
    TaskItem,
    WorkerResult,
)
from app.agents.agent3.tools.task_tools import describe_service

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Lazy singleton for the code-generation subgraph.
# ---------------------------------------------------------------------------

_code_subgraph = None
_code_subgraph_lock = threading.Lock()


def _get_code_subgraph():
    """Return the compiled code-generation subgraph (lazy, thread-safe)."""
    global _code_subgraph
    if _code_subgraph is None:
        with _code_subgraph_lock:
            if _code_subgraph is None:
                from app.agents.agent3.subgraphs.code_generation_loop import (
                    compile_code_generation_subgraph,
                )

                _code_subgraph = compile_code_generation_subgraph()
    return _code_subgraph


# ---------------------------------------------------------------------------
# API contract injection
# ---------------------------------------------------------------------------


def _inject_api_contracts(
    arch_ctx_json: str, api_contracts: list[dict[str, Any]], service_id: str
) -> str:
    """Add relevant API contracts into the architecture context JSON for a service."""
    relevant = [
        c
        for c in api_contracts
        if c.get("source_service_id") == service_id
        or c.get("target_service_id") == service_id
    ]
    if not relevant:
        return arch_ctx_json

    try:
        ctx = json.loads(arch_ctx_json)
    except (json.JSONDecodeError, TypeError):
        ctx = {"service_id": service_id}

    ctx["api_contracts"] = relevant
    return json.dumps(ctx, indent=2)


# ---------------------------------------------------------------------------
# Node entry-point
# ---------------------------------------------------------------------------


def codegen_worker_node(state: CodegenWorkerState) -> dict[str, Any]:
    """Generate code for all services in a task group via the code-generation subgraph."""
    group_id = state["group_id"]
    tasks = state.get("tasks") or []
    api_contracts = state.get("api_contracts") or []
    tf_context_map = state.get("tf_context_map") or {}
    arch_context_map = state.get("architecture_context_map") or {}
    architecture_overview = state.get("architecture_overview", "")

    code_subgraph = _get_code_subgraph()

    code_files: dict[str, str] = {}
    code_errors: list[CodeError] = []
    completed_tasks: list[TaskItem] = []

    for task in tasks:
        service_id = task["service_id"]
        language = task["language"]
        ext = EXT_MAP.get(language, language)

        # Gather context for this service
        tf_ctx = tf_context_map.get(service_id, "")
        arch_ctx = arch_context_map.get(service_id, json.dumps({"service_id": service_id}))

        # Inject API contracts into architecture context
        arch_ctx = _inject_api_contracts(arch_ctx, api_contracts, service_id)

        sub_state = CodeGenState(
            task=TaskItem(
                task_id=task["task_id"],
                service_id=service_id,
                task_type="code_gen",
                language=language,
                status="in_progress",
                retry_count=task.get("retry_count", 0),
                error_message=None,
            ),
            tf_context=tf_ctx,
            architecture_context=arch_ctx,
            architecture_overview=architecture_overview,
            generated_code=None,
            generated_tests=None,
            syntax_errors=[],
            fix_attempts=0,
            max_retries=CODE_MAX_RETRIES,
            done=False,
            human_review_required=False,
            human_review_message=None,
        )

        try:
            result = code_subgraph.invoke(sub_state)
            code = result.get("generated_code")

            if not code:
                errors = result.get("syntax_errors") or ["unknown error"]
                error_msg = "; ".join(errors)
                code_errors.append(
                    CodeError(
                        service_id=service_id,
                        task_type="code_gen",
                        file=f"services/{service_id}/handler.{ext}",
                        errors=errors,
                    )
                )
                completed_tasks.append(
                    TaskItem(
                        task_id=task["task_id"],
                        service_id=service_id,
                        task_type="code_gen",
                        language=language,
                        status="failed",
                        retry_count=task.get("retry_count", 0),
                        error_message=error_msg,
                    )
                )
                logger.warning("code_gen FAILED for %s (group %s): %s", service_id, group_id, error_msg)
                continue

            file_path = f"services/{service_id}/handler.{ext}"
            code_files[file_path] = code
            completed_tasks.append(
                TaskItem(
                    task_id=task["task_id"],
                    service_id=service_id,
                    task_type="code_gen",
                    language=language,
                    status="done",
                    retry_count=task.get("retry_count", 0),
                    error_message=None,
                )
            )
            logger.info("code_gen OK: %s (group %s)", file_path, group_id)

        except Exception as e:
            error_msg = str(e)
            code_errors.append(
                CodeError(
                    service_id=service_id,
                    task_type="code_gen",
                    file=f"services/{service_id}/handler.{ext}",
                    errors=[error_msg],
                )
            )
            completed_tasks.append(
                TaskItem(
                    task_id=task["task_id"],
                    service_id=service_id,
                    task_type="code_gen",
                    language=language,
                    status="failed",
                    retry_count=task.get("retry_count", 0),
                    error_message=error_msg,
                )
            )
            logger.warning("code_gen EXCEPTION for %s (group %s): %s", service_id, group_id, error_msg)

    logger.info(
        "codegen_worker done: group=%s, %d files generated, %d errors",
        group_id,
        len(code_files),
        len(code_errors),
    )

    return {
        "worker_results": [
            WorkerResult(
                group_id=group_id,
                code_files=code_files,
                code_errors=code_errors,
                completed_tasks=completed_tasks,
            )
        ]
    }
