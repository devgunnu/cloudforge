from __future__ import annotations

import json
import logging
from dataclasses import dataclass, field
from typing import Any

from app.agents.agent3.config import CODE_MAX_RETRIES, EXT_MAP
from app.agents.agent3.state import AgentState, CodeError, CodeGenState, TaskItem
from app.agents.agent3.tools.task_tools import (
    describe_service,
    extract_tf_context_for_service,
)

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Mutable context shared across code-gen invocations
# ---------------------------------------------------------------------------


@dataclass
class _OrchestratorCtx:
    """All mutable state updated during an orchestrator invocation."""

    code_files: dict[str, str] = field(default_factory=dict)
    test_files: dict[str, str] = field(default_factory=dict)
    task_list: list[TaskItem] = field(default_factory=list)
    code_errors: list[CodeError] = field(default_factory=list)

    # -- Task helpers --

    def find_task(self, service_id: str, task_type: str) -> TaskItem | None:
        return next(
            (t for t in self.task_list if t["service_id"] == service_id and t["task_type"] == task_type),
            None,
        )

    def set_task_status(self, task_id: str, status: str, error: str | None = None) -> None:
        for t in self.task_list:
            if t["task_id"] == task_id:
                t["status"] = status  # type: ignore[typeddict-item]
                if error is not None:
                    t["error_message"] = error
                return


def _build_arch_ctx_json(state: AgentState, service_id: str) -> str:
    """Build a JSON context blob for a single service."""
    services = state.get("services", [])
    connections = state.get("connections", [])
    svc = next((s for s in services if s["id"] == service_id), None)
    if not svc:
        return json.dumps({"service_id": service_id})

    outgoing = [c for c in connections if c["source"] == service_id]
    incoming = [c for c in connections if c["target"] == service_id]

    return json.dumps(
        {
            "service_id": service_id,
            "service_type": svc["service_type"],
            "label": svc["label"],
            "config": svc["config"],
            "connections": describe_service(svc, connections),
            "incoming": [{"from": c["source"], "via": c["relationship"]} for c in incoming],
            "outgoing": [{"to": c["target"], "via": c["relationship"]} for c in outgoing],
        },
        indent=2,
    )


# ---------------------------------------------------------------------------
# Direct code/test generation (no tool-calling LLM required)
# ---------------------------------------------------------------------------


def _run_code_gen(
    ctx: _OrchestratorCtx,
    state: AgentState,
    code_subgraph: Any,
    service_id: str,
    task: TaskItem,
) -> None:
    """Generate application code for a service via the code-generation subgraph."""
    language = task["language"]
    ext = EXT_MAP.get(language, language)
    ctx.set_task_status(task["task_id"], "in_progress")

    arch_ctx = _build_arch_ctx_json(state, service_id)
    tf_ctx = extract_tf_context_for_service(state.get("tf_files", {}), service_id)

    sub_state = CodeGenState(
        task=TaskItem(
            task_id=task["task_id"],
            service_id=service_id,
            task_type="code_gen",
            language=language,
            status="in_progress",
            retry_count=task["retry_count"],
            error_message=None,
        ),
        tf_context=tf_ctx,
        architecture_context=arch_ctx,
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
            ctx.set_task_status(task["task_id"], "failed", error="; ".join(errors))
            ctx.code_errors.append(
                CodeError(
                    service_id=service_id,
                    task_type="code_gen",
                    file=f"services/{service_id}/handler.{ext}",
                    errors=errors,
                )
            )
            return

        file_path = f"services/{service_id}/handler.{ext}"
        ctx.code_files[file_path] = code
        ctx.set_task_status(task["task_id"], "done")
        logger.info("code_gen OK: %s", file_path)
    except Exception as e:
        error_msg = str(e)
        ctx.set_task_status(task["task_id"], "failed", error=error_msg)
        ctx.code_errors.append(
            CodeError(
                service_id=service_id,
                task_type="code_gen",
                file=f"services/{service_id}/handler.{ext}",
                errors=[error_msg],
            )
        )
        logger.warning("code_gen FAILED for %s: %s", service_id, error_msg)


def _run_test_gen(
    ctx: _OrchestratorCtx,
    state: AgentState,
    code_subgraph: Any,
    service_id: str,
    task: TaskItem,
) -> None:
    """Generate unit tests for a service via the code-generation subgraph."""
    language = task["language"]
    ext = EXT_MAP.get(language, language)

    code_path = f"services/{service_id}/handler.{ext}"
    source_code = ctx.code_files.get(code_path, "")

    ctx.set_task_status(task["task_id"], "in_progress")
    arch_ctx = _build_arch_ctx_json(state, service_id)

    sub_state = CodeGenState(
        task=TaskItem(
            task_id=task["task_id"],
            service_id=service_id,
            task_type="test_gen",
            language=language,
            status="in_progress",
            retry_count=task["retry_count"],
            error_message=None,
        ),
        tf_context="",
        architecture_context=arch_ctx,
        generated_code=source_code,
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
        tests = result.get("generated_tests")

        if not tests:
            errors = result.get("syntax_errors") or ["unknown error"]
            ctx.set_task_status(task["task_id"], "failed", error="; ".join(errors))
            ctx.code_errors.append(
                CodeError(
                    service_id=service_id,
                    task_type="test_gen",
                    file=f"services/{service_id}/test_handler.{ext}",
                    errors=errors,
                )
            )
            return

        test_path = f"services/{service_id}/test_handler.{ext}"
        ctx.test_files[test_path] = tests
        ctx.set_task_status(task["task_id"], "done")
        logger.info("test_gen OK: %s", test_path)
    except Exception as e:
        error_msg = str(e)
        ctx.set_task_status(task["task_id"], "failed", error=error_msg)
        ctx.code_errors.append(
            CodeError(
                service_id=service_id,
                task_type="test_gen",
                file=f"services/{service_id}/test_handler.{ext}",
                errors=[error_msg],
            )
        )
        logger.warning("test_gen FAILED for %s: %s", service_id, error_msg)


# ---------------------------------------------------------------------------
# Node factory
# ---------------------------------------------------------------------------


def make_orchestrator_node(compiled_code_subgraph: Any):
    """Factory: returns a LangGraph node function closed over the compiled code subgraph.

    Uses direct invocation instead of a ReAct agent — the orchestration logic
    is deterministic (iterate services, code before tests) and does not require
    tool-calling LLM support.
    """

    def orchestrator_node(state: AgentState) -> dict[str, Any]:
        ctx = _OrchestratorCtx(
            code_files=dict(state.get("code_files") or {}),
            test_files=dict(state.get("test_files") or {}),
            task_list=list(state.get("task_list") or []),
            code_errors=[],
        )

        # Collect unique service IDs in task-list order
        seen: set[str] = set()
        service_ids: list[str] = []
        for task in ctx.task_list:
            sid = task["service_id"]
            if sid not in seen:
                seen.add(sid)
                service_ids.append(sid)

        # Process each service: generate code first, then tests
        for service_id in service_ids:
            code_task = ctx.find_task(service_id, "code_gen")
            test_task = ctx.find_task(service_id, "test_gen")

            # --- Code generation ---
            if code_task and code_task["status"] == "pending":
                _run_code_gen(ctx, state, compiled_code_subgraph, service_id, code_task)

            # --- Test generation (only if code succeeded) ---
            if test_task and test_task["status"] == "pending":
                code_task_now = ctx.find_task(service_id, "code_gen")
                if code_task_now is None or code_task_now["status"] == "done":
                    _run_test_gen(ctx, state, compiled_code_subgraph, service_id, test_task)
                else:
                    ctx.set_task_status(
                        test_task["task_id"],
                        "failed",
                        error="Skipped: code_gen did not complete successfully",
                    )

        return {
            "code_files": ctx.code_files,
            "test_files": ctx.test_files,
            "task_list": ctx.task_list,
            "code_errors": ctx.code_errors,
            "orchestrator_iterations": state.get("orchestrator_iterations", 0) + 1,
            "current_phase": "assembly",
        }

    return orchestrator_node
