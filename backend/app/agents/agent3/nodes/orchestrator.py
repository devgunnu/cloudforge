from __future__ import annotations

import json
from dataclasses import dataclass, field
from typing import Any

from langchain_core.messages import HumanMessage
from langchain_core.tools import tool
from langgraph.prebuilt import create_react_agent

from app.agents.agent3.config import CODE_MAX_RETRIES, EXT_MAP, RECURSION_STEPS_PER_TASK
from app.agents.agent3.llm import get_default_llm
from app.agents.agent3.prompts.orchestrator_prompts import orchestrator_system
from app.agents.agent3.state import AgentState, CodeError, CodeGenState, TaskItem
from app.agents.agent3.tools.task_tools import (
    build_architecture_summary,
    describe_service,
    extract_tf_context_for_service,
)

# ---------------------------------------------------------------------------
# Mutable context shared between tool closures and the orchestrator node
# ---------------------------------------------------------------------------


@dataclass
class _OrchestratorCtx:
    """All mutable state updated by tools during an orchestrator invocation."""

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
    """Build a JSON context blob for a single service (used inside tool closures)."""
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
# Tool factory — builds @tool functions closed over ctx + state + code_subgraph
# ---------------------------------------------------------------------------


def _build_tools(ctx: _OrchestratorCtx, state: AgentState, code_subgraph: Any) -> list:
    """Return a list of @tool functions with shared context injected via closure."""

    @tool
    def get_pending_tasks() -> str:
        """Return a JSON list of all pending tasks (code_gen and test_gen)."""
        pending = [t for t in ctx.task_list if t["status"] == "pending"]
        return json.dumps(pending, indent=2) if pending else "[]"

    @tool
    def get_architecture_summary() -> str:
        """Return a human-readable summary of the cloud architecture and service dependencies."""
        return build_architecture_summary(
            state.get("services", []), state.get("connections", [])
        )

    @tool
    def generate_service_code(service_id: str, language: str) -> str:
        """
        Generate application code for the specified cloud service.
        Returns the generated file path on success, or an error description.
        """
        task = ctx.find_task(service_id, "code_gen")
        if task is None:
            return f"ERROR: No code_gen task found for service_id='{service_id}'"

        ctx.set_task_status(task["task_id"], "in_progress")

        ext = EXT_MAP.get(language, language)
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
                return f"FAILED: {'; '.join(errors)}"

            file_path = f"services/{service_id}/handler.{ext}"
            ctx.code_files[file_path] = code
            ctx.set_task_status(task["task_id"], "done")
            return f"OK: {file_path}"
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
            return f"ERROR: {error_msg}"

    @tool
    def generate_service_tests(service_id: str, language: str) -> str:
        """
        Generate unit tests for the specified service.
        Requires generate_service_code to be called first for this service.
        Returns the generated test file path on success, or an error description.
        """
        ext = EXT_MAP.get(language, language)
        code_path = f"services/{service_id}/handler.{ext}"
        source_code = ctx.code_files.get(code_path, "")

        task = ctx.find_task(service_id, "test_gen")
        if task is None:
            return f"ERROR: No test_gen task found for service_id='{service_id}'"

        ctx.set_task_status(task["task_id"], "in_progress")
        arch_ctx = _build_arch_ctx_json(state, service_id)

        # Reuse the code_generation subgraph with test_gen task type
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
                return f"FAILED: {'; '.join(errors)}"

            test_path = f"services/{service_id}/test_handler.{ext}"
            ctx.test_files[test_path] = tests
            ctx.set_task_status(task["task_id"], "done")
            return f"OK: {test_path}"
        except Exception as e:
            error_msg = str(e)
            ctx.set_task_status(task["task_id"], "failed", error=error_msg)
            return f"ERROR: {error_msg}"

    @tool
    def mark_task_done(task_id: str) -> str:
        """Explicitly mark a specific task as done by its task_id."""
        task = next((t for t in ctx.task_list if t["task_id"] == task_id), None)
        if task is None:
            return f"ERROR: Task '{task_id}' not found"
        ctx.set_task_status(task_id, "done")
        return f"OK: Task '{task_id}' marked done"

    return [get_pending_tasks, get_architecture_summary, generate_service_code, generate_service_tests, mark_task_done]


# ---------------------------------------------------------------------------
# Node factory
# ---------------------------------------------------------------------------


def make_orchestrator_node(compiled_code_subgraph: Any):
    """Factory: returns a LangGraph node function closed over the compiled code subgraph."""

    def orchestrator_node(state: AgentState) -> dict[str, Any]:
        # Seed context from current state (handles multi-iteration correctly)
        ctx = _OrchestratorCtx(
            code_files=dict(state.get("code_files") or {}),
            test_files=dict(state.get("test_files") or {}),
            task_list=list(state.get("task_list") or []),
            code_errors=[],
        )

        tools = _build_tools(ctx, state, compiled_code_subgraph)

        # Build dynamic system prompt with current architecture + TF context
        arch_summary = build_architecture_summary(
            state.get("services", []), state.get("connections", [])
        )
        system_prompt = orchestrator_system(
            architecture_summary=arch_summary,
            tf_file_names=list(state.get("tf_files", {}).keys()),
        )

        # `prompt` is the current API (state_modifier is deprecated in langgraph-prebuilt 1.x)
        agent = create_react_agent(get_default_llm(), tools, prompt=system_prompt)

        # Build initial message if this is the first orchestrator iteration
        prior_messages = list(state.get("orchestrator_messages") or [])
        if not prior_messages:
            pending_count = sum(1 for t in ctx.task_list if t["status"] == "pending")
            prior_messages = [
                HumanMessage(
                    content=(
                        f"Start generating code. There are {pending_count} pending tasks. "
                        "Call get_pending_tasks() first to see the full task list, "
                        "then work through them systematically."
                    )
                )
            ]

        # recursion_limit guards against the ReAct agent looping indefinitely
        max_iter = state.get("orchestrator_max_iterations", 10)
        result = agent.invoke(
            {"messages": prior_messages},
            config={"recursion_limit": max_iter * RECURSION_STEPS_PER_TASK},
        )

        return {
            "orchestrator_messages": result["messages"],
            "code_files": ctx.code_files,
            "test_files": ctx.test_files,
            "task_list": ctx.task_list,
            "code_errors": ctx.code_errors,
            "orchestrator_iterations": state.get("orchestrator_iterations", 0) + 1,
            "current_phase": "assembly",
        }

    return orchestrator_node
