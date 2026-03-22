from __future__ import annotations

import json
import uuid
from typing import Any, AsyncIterator

from fastapi import APIRouter, HTTPException
from fastapi.responses import StreamingResponse

from app.agents.agent3 import (
    GenerateRequest,
    GenerationResult,
    HumanFeedback,
    StatusResponse,
    get_graph,
)

router = APIRouter(prefix="/workflows/agent3", tags=["agent3"])

# Nodes whose start/end events are surfaced as SSE progress messages
_PROGRESS_NODES = frozenset({
    "parse_input",
    "tf_generator",
    "tf_validation_loop",
    "manager_agent",
    "assembler",
    "error_handler",
})


def _sse(data: dict[str, Any]) -> str:
    return f"data: {json.dumps(data)}\n\n"


def _build_initial_state(request: GenerateRequest, thread_id: str) -> dict[str, Any]:
    return {
        "thread_id": thread_id,
        "raw_input": request.topology,
        "input_format": request.input_format,
        # language_overrides from the request are merged in parse_input_node
        # with any overrides embedded in the topology JSON itself
        "language_overrides": request.language_overrides,
        "tf_max_retries": request.tf_max_retries,
        "orchestrator_max_iterations": request.orchestrator_max_iterations,
        # Fields below are fully initialised by parse_input_node;
        # we set empty defaults here so LangGraph state is valid from the start
        "tf_fix_attempts": 0,
        "tf_validated": False,
        "tf_files": {},
        "tf_validation_results": [],
        "tf_error_summary": None,
        "services": [],
        "connections": [],
        "cloud_provider": "aws",
        "task_list": [],
        "orchestrator_messages": [],
        "orchestrator_iterations": 0,
        "code_files": {},
        "test_files": {},
        "code_errors": [],
        "current_phase": "parsing",
        "pipeline_errors": [],
        "human_review_required": False,
        "human_review_message": None,
        "artifacts": {},
        "generation_metadata": {},
    }


async def _stream_events(
    initial_state: dict[str, Any] | None,
    config: dict[str, Any],
) -> AsyncIterator[str]:
    graph = get_graph()
    thread_id: str = config["configurable"]["thread_id"]

    try:
        async for event in graph.astream_events(initial_state, config, version="v2"):
            event_type: str = event.get("event", "")
            node_name: str = event.get("name", "")
            data = event.get("data", {})

            # --- Node started ---
            if event_type == "on_chain_start" and node_name in _PROGRESS_NODES:
                yield _sse({"phase": node_name, "status": "started", "thread_id": thread_id})

            # --- Per-task custom events from codegen workers ---
            elif event_type == "on_custom_event" and isinstance(data, dict) and data.get("_event") == "task_update":
                payload = data
                yield _sse({
                    "phase": "task_update",
                    "thread_id": thread_id,
                    "task_id": payload.get("task_id"),
                    "service_id": payload.get("service_id"),
                    "language": payload.get("language"),
                    "status": payload.get("status"),
                    "error": payload.get("error"),
                })

            # --- Node finished ---
            elif event_type == "on_chain_end" and node_name in _PROGRESS_NODES:
                output = data.get("output", {}) or {}

                if node_name == "tf_validation_loop":
                    yield _sse({
                        "phase": "tf_validation_loop",
                        "status": "done",
                        "tf_fix_attempts": output.get("tf_fix_attempts", 0),
                        "tf_validated": output.get("tf_validated", False),
                        "thread_id": thread_id,
                    })

                elif node_name == "manager_agent":
                    task_groups = output.get("task_groups") or []
                    task_list = output.get("task_list") or []
                    plan_summary = output.get("manager_plan_summary", "")
                    # Only emit during planning mode — review mode returns empty task_groups.
                    if task_groups:
                        yield _sse({
                            "phase": "manager_agent",
                            "status": "planned",
                            "thread_id": thread_id,
                            "plan_summary": plan_summary,
                            "task_groups": [
                                {
                                    "group_id": g["group_id"],
                                    "service_ids": g["service_ids"],
                                    "rationale": g.get("rationale", ""),
                                }
                                for g in task_groups
                            ],
                            "tasks": [
                                {
                                    "task_id": t["task_id"],
                                    "service_id": t["service_id"],
                                    "language": t["language"],
                                    "task_type": t["task_type"],
                                    "status": t["status"],
                                }
                                for t in task_list
                                if t.get("task_type") == "code_gen"
                            ],
                        })

                elif node_name == "assembler":
                    meta = output.get("generation_metadata", {}) or {}
                    yield _sse({
                        "phase": "complete",
                        "thread_id": thread_id,
                        "artifacts": output.get("artifacts", {}),
                        "tf_fix_attempts": meta.get("tf_fix_attempts", 0),
                        "tf_validated": meta.get("tf_validated", False),
                        "tasks_completed": meta.get("tasks_done", 0),
                        "tasks_failed": meta.get("tasks_failed", 0),
                        "tasks_total": meta.get("tasks_total", 0),
                        "human_review_required": meta.get("human_review_required", False),
                        "code_errors": meta.get("code_errors", []),
                    })
                    return  # stream complete

                elif node_name == "error_handler":
                    meta = output.get("generation_metadata", {}) or {}
                    yield _sse({
                        "phase": "error",
                        "thread_id": thread_id,
                        "errors": meta.get("errors", []),
                        "phase_at_failure": meta.get("phase_at_failure", "unknown"),
                        "artifacts": output.get("artifacts", {}),
                    })
                    return

                else:
                    yield _sse({"phase": node_name, "status": "done", "thread_id": thread_id})

    except Exception as e:
        # Distinguish graph interrupts (expected pauses) from genuine errors
        # by inspecting whether the graph has a pending next-step.
        try:
            snapshot = graph.get_state(config)
            if snapshot and snapshot.next:
                values = snapshot.values or {}
                yield _sse({
                    "phase": "human_review_required",
                    "thread_id": thread_id,
                    "message": values.get("human_review_message") or str(e) or "Human review required.",
                })
                return
        except Exception:
            pass  # fall through to generic error
        yield _sse({"phase": "error", "thread_id": thread_id, "message": str(e)})
        return

    # Stream ended cleanly without reaching a terminal node (assembler/error_handler).
    # This can happen when the graph paused for human review and astream_events
    # drained naturally.
    try:
        snapshot = graph.get_state(config)
        if snapshot and snapshot.next:
            values = snapshot.values or {}
            yield _sse({
                "phase": "human_review_required",
                "thread_id": thread_id,
                "message": values.get("human_review_message") or "Human review required.",
            })
        else:
            yield _sse({"phase": "complete", "thread_id": thread_id, "partial": True})
    except Exception as e:
        yield _sse({"phase": "error", "thread_id": thread_id, "message": f"Stream ended unexpectedly: {e}"})


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------


@router.post("/generate")
async def generate(request: GenerateRequest) -> StreamingResponse:
    """
    Start an agent3 generation run.
    Returns a Server-Sent Events stream with progress updates.
    Final event has phase='complete' and includes all generated artifacts.
    """
    thread_id = str(uuid.uuid4())
    config = {"configurable": {"thread_id": thread_id}}
    initial_state = _build_initial_state(request, thread_id)

    return StreamingResponse(
        _stream_events(initial_state, config),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",
            "X-Thread-ID": thread_id,
        },
    )


@router.get("/status/{thread_id}", response_model=StatusResponse)
async def get_status(thread_id: str) -> StatusResponse:
    """Poll the current state of any generation run by thread_id."""
    graph = get_graph()
    config = {"configurable": {"thread_id": thread_id}}

    try:
        snapshot = graph.get_state(config)
    except Exception as e:
        raise HTTPException(status_code=404, detail=f"Thread '{thread_id}' not found: {e}")

    values: dict[str, Any] = snapshot.values or {}
    task_list = values.get("task_list") or []

    return StatusResponse(
        thread_id=thread_id,
        current_phase=values.get("current_phase", "unknown"),
        human_review_required=values.get("human_review_required", False),
        human_review_message=values.get("human_review_message"),
        artifacts=values.get("artifacts") or None,
        interrupted=bool(snapshot.next),
        tf_fix_attempts=values.get("tf_fix_attempts", 0),
        tasks_completed=sum(1 for t in task_list if t["status"] == "done"),
        tasks_total=len(task_list),
    )


@router.post("/resume/{thread_id}")
async def resume(thread_id: str, feedback: HumanFeedback) -> StreamingResponse:
    """
    Resume an interrupted generation run after human review.
    Supply corrected_files to inject manual TF/code fixes before resuming.
    """
    graph = get_graph()
    config = {"configurable": {"thread_id": thread_id}}

    try:
        snapshot = graph.get_state(config)
    except Exception as e:
        raise HTTPException(status_code=404, detail=f"Thread '{thread_id}' not found: {e}")

    if not snapshot.next:
        raise HTTPException(
            status_code=400,
            detail="This run is not interrupted — nothing to resume",
        )

    # Inject human feedback and any corrected files
    update: dict[str, Any] = {
        "human_review_message": feedback.message,
        "human_review_required": False,
    }
    if feedback.corrected_files:
        current_tf: dict[str, str] = dict(snapshot.values.get("tf_files") or {})
        current_tf.update(feedback.corrected_files)
        update["tf_files"] = current_tf

    graph.update_state(config, update)

    # Resume streaming — pass None as input since we're continuing an existing thread
    return StreamingResponse(
        _stream_events(None, config),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",
        },
    )
