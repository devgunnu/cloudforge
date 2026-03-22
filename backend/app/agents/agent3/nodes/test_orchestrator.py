from __future__ import annotations

import json
import logging
import threading
from typing import Any

from langchain_core.messages import HumanMessage, SystemMessage

from app.agents.agent3.config import CODE_MAX_RETRIES, EXT_MAP, TEST_EXECUTION_MAX_RETRIES
from app.agents.agent3.llm import get_fast_llm
from app.agents.agent3.prompts.test_fix_prompts import test_fix_system, test_fix_user
from app.agents.agent3.state import AgentState, CodeError, CodeGenState, TaskItem
from app.agents.agent3.tools.syntax_tools import check_syntax
from app.agents.agent3.tools.task_tools import (
    build_architecture_summary,
    describe_service,
    extract_tf_context_for_service,
)
from app.agents.agent3.tools.test_tools import run_tests
from app.agents.agent3.utils import strip_code_fences

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
# Helpers
# ---------------------------------------------------------------------------


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


def _find_task(task_list: list[TaskItem], service_id: str, task_type: str) -> TaskItem | None:
    """Find a task by service_id and task_type."""
    return next(
        (t for t in task_list if t["service_id"] == service_id and t["task_type"] == task_type),
        None,
    )


def _set_task_status(
    task_list: list[TaskItem], task_id: str, status: str, error: str | None = None
) -> None:
    """Update a task's status in-place."""
    for t in task_list:
        if t["task_id"] == task_id:
            t["status"] = status  # type: ignore[typeddict-item]
            if error is not None:
                t["error_message"] = error
            return


# ---------------------------------------------------------------------------
# Node entry-point
# ---------------------------------------------------------------------------


def test_orchestrator_node(state: AgentState) -> dict[str, Any]:
    """Generate tests, execute them, and fix code on test failure."""
    task_list = list(state.get("task_list") or [])
    code_files: dict[str, str] = dict(state.get("code_files") or {})
    services = state.get("services") or []
    connections = state.get("connections") or []
    tf_files = state.get("tf_files") or {}

    # Build full architecture overview (same approach as the orchestrator node)
    arch_summary = build_architecture_summary(services, connections)
    from app.agents.agent3.prompts.orchestrator_prompts import orchestrator_system

    arch_overview = orchestrator_system(
        architecture_summary=arch_summary,
        tf_file_names=list(tf_files.keys()),
    )

    code_subgraph = _get_code_subgraph()

    test_files: dict[str, str] = {}
    code_errors: list[CodeError] = []

    # Collect unique service IDs that have pending test_gen tasks
    seen: set[str] = set()
    test_service_ids: list[str] = []
    for task in task_list:
        sid = task["service_id"]
        if task["task_type"] == "test_gen" and task["status"] == "pending" and sid not in seen:
            seen.add(sid)
            test_service_ids.append(sid)

    for service_id in test_service_ids:
        test_task = _find_task(task_list, service_id, "test_gen")
        if not test_task:
            continue

        language = test_task["language"]
        ext = EXT_MAP.get(language, language)
        code_path = f"services/{service_id}/handler.{ext}"
        test_path = f"services/{service_id}/test_handler.{ext}"

        # --- Check that code_gen completed successfully ---
        code_task = _find_task(task_list, service_id, "code_gen")
        if code_task is None or code_task["status"] != "done":
            _set_task_status(
                task_list,
                test_task["task_id"],
                "failed",
                error="Skipped: code_gen did not complete successfully",
            )
            continue

        # --- Generate tests via code-generation subgraph ---
        source_code = code_files.get(code_path, "")
        _set_task_status(task_list, test_task["task_id"], "in_progress")
        arch_ctx = _build_arch_ctx_json(state, service_id)

        sub_state = CodeGenState(
            task=TaskItem(
                task_id=test_task["task_id"],
                service_id=service_id,
                task_type="test_gen",
                language=language,
                status="in_progress",
                retry_count=test_task.get("retry_count", 0),
                error_message=None,
            ),
            tf_context="",
            architecture_context=arch_ctx,
            architecture_overview=arch_overview,
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
            test_code = result.get("generated_tests")
        except Exception as e:
            error_msg = f"Test generation subgraph error: {e}"
            _set_task_status(task_list, test_task["task_id"], "failed", error=error_msg)
            code_errors.append(
                CodeError(
                    service_id=service_id,
                    task_type="test_gen",
                    file=test_path,
                    errors=[error_msg],
                )
            )
            logger.warning("test_gen EXCEPTION for %s: %s", service_id, error_msg)
            continue

        if not test_code:
            errors = result.get("syntax_errors") or ["unknown error"]
            _set_task_status(task_list, test_task["task_id"], "failed", error="; ".join(errors))
            code_errors.append(
                CodeError(
                    service_id=service_id,
                    task_type="test_gen",
                    file=test_path,
                    errors=errors,
                )
            )
            logger.warning("test_gen FAILED for %s: no tests produced", service_id)
            continue

        # --- Execute tests ---
        service_code = code_files.get(code_path, "")
        try:
            test_result = run_tests(service_code, test_code, language, service_id)
        except Exception as e:
            error_msg = f"Test execution error: {e}"
            _set_task_status(task_list, test_task["task_id"], "failed", error=error_msg)
            code_errors.append(
                CodeError(
                    service_id=service_id,
                    task_type="test_gen",
                    file=test_path,
                    errors=[error_msg],
                )
            )
            logger.warning("test execution EXCEPTION for %s: %s", service_id, error_msg)
            continue

        # --- Fix loop if tests fail ---
        fix_attempts = 0
        while not test_result["passed"] and fix_attempts < TEST_EXECUTION_MAX_RETRIES:
            try:
                sys_msg = test_fix_system(language=language)
                usr_msg = test_fix_user(
                    attempt=fix_attempts + 1,
                    max_attempts=TEST_EXECUTION_MAX_RETRIES,
                    language=language,
                    service_code=service_code,
                    test_code=test_code,
                    test_output=test_result["output"],
                )
                response = get_fast_llm().invoke(
                    [SystemMessage(content=sys_msg), HumanMessage(content=usr_msg)]
                )
                fixed_code = strip_code_fences(response.content)

                # Re-validate syntax before accepting the fix
                syntax_errors = check_syntax(fixed_code, language)
                if not syntax_errors:
                    service_code = fixed_code
                    code_files[code_path] = service_code
                    test_result = run_tests(service_code, test_code, language, service_id)
                else:
                    logger.warning(
                        "test fix for %s has syntax errors, skipping: %s",
                        service_id,
                        syntax_errors[:3],
                    )
            except Exception as e:
                logger.warning(
                    "test fix attempt %d for %s failed: %s",
                    fix_attempts + 1,
                    service_id,
                    e,
                )

            fix_attempts += 1

        # --- Record final outcome ---
        if test_result["passed"]:
            test_files[test_path] = test_code
            _set_task_status(task_list, test_task["task_id"], "done")
            logger.info("test_gen OK: %s (tests passed)", test_path)
        else:
            error_msg = f"Tests failed after {fix_attempts} fix attempts: {test_result['output'][:500]}"
            _set_task_status(task_list, test_task["task_id"], "failed", error=error_msg)
            code_errors.append(
                CodeError(
                    service_id=service_id,
                    task_type="test_gen",
                    file=test_path,
                    errors=test_result.get("errors") or [error_msg],
                )
            )
            logger.warning("test_gen FAILED for %s: tests did not pass", service_id)

    logger.info(
        "test_orchestrator done: %d test files, %d code errors",
        len(test_files),
        len(code_errors),
    )

    return {
        "test_files": test_files,
        "code_files": code_files,
        "task_list": task_list,
        "code_errors": code_errors,
        "current_phase": "assembly",
    }
