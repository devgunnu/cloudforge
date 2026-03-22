from __future__ import annotations

import logging
import os
from typing import Any

from fastapi import APIRouter, HTTPException
from langgraph.types import Command

from app.agents.architecture_planner import create_graph, make_initial_state
from app.agents.agent1.state import AgentState
from app.schemas.architecture import (
    ArchWorkflowResponse,
    ReviewArchWorkflowRequest,
    StartArchWorkflowRequest,
)
from app.services.arch_sessions import arch_session_store
from app.services.workflow_sessions import session_store

router = APIRouter(prefix="/workflows/architecture", tags=["architecture"])
logger = logging.getLogger(__name__)

_APP_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
_GRAPH_JSON = os.path.join(_APP_DIR, "agents", "data", "graph", "graph.json")

_PROVIDER_MAP: dict[str, str] = {"aws": "AWS", "gcp": "GCP", "azure": "Azure"}

_arch_graph = None


def _get_arch_graph():
    global _arch_graph
    if _arch_graph is None:
        _arch_graph = create_graph(graph_json_path=_GRAPH_JSON)
    return _arch_graph


def _detect_interrupt(graph, config: dict) -> tuple[str | None, Any]:
    try:
        snapshot = graph.get_state(config)
    except Exception:
        return None, None

    if not snapshot or not snapshot.next:
        return None, None

    interrupts: list = []
    for task in snapshot.tasks:
        interrupts.extend(getattr(task, "interrupts", []))

    if not interrupts:
        return None, None

    payload = interrupts[0].value
    if isinstance(payload, dict) and "summary" in payload:
        return "review", payload

    return "unknown", payload


def _current_state_values(graph, config: dict) -> dict[str, Any]:
    try:
        snapshot = graph.get_state(config)
        return snapshot.values if snapshot else {}
    except Exception:
        return {}


def _serialize_diagram(diagram: Any) -> dict[str, Any] | None:
    if diagram is None:
        return None
    if hasattr(diagram, "model_dump"):
        return diagram.model_dump(by_alias=True)
    if isinstance(diagram, dict):
        return diagram
    return None


def _serialize_gaps(gaps: Any) -> list[dict[str, Any]]:
    result: list[dict[str, Any]] = []
    for g in gaps or []:
        if hasattr(g, "model_dump"):
            result.append(g.model_dump())
        elif isinstance(g, dict):
            result.append(g)
    return result


def _build_response(session_id: str, graph, config: dict) -> ArchWorkflowResponse:
    interrupt_type, interrupt_payload = _detect_interrupt(graph, config)

    if interrupt_type == "review":
        state = _current_state_values(graph, config)
        arch_session_store.update(
            session_id,
            status="review_ready",
            interrupt_type="review",
            interrupt_payload=interrupt_payload,
        )
        return ArchWorkflowResponse(
            session_id=session_id,
            status="review_ready",
            architecture_diagram=_serialize_diagram(state.get("architecture_diagram")),
            nfr_document=state.get("nfr_document"),
            component_responsibilities=state.get("component_responsibilities"),
            extra_context=state.get("extra_context"),
            arch_test_passed=state.get("arch_test_passed"),
            arch_test_violations_count=len(state.get("arch_test_violations") or []),
            compliance_gaps=_serialize_gaps(state.get("compliance_gaps")),
            error_message=state.get("error_message"),
        )

    state = _current_state_values(graph, config)
    arch_session_store.update(session_id, status="accepted")
    return ArchWorkflowResponse(
        session_id=session_id,
        status="accepted",
        architecture_diagram=_serialize_diagram(state.get("architecture_diagram")),
        nfr_document=state.get("nfr_document"),
        component_responsibilities=state.get("component_responsibilities"),
        extra_context=state.get("extra_context"),
        arch_test_passed=state.get("arch_test_passed"),
        arch_test_violations_count=len(state.get("arch_test_violations") or []),
        compliance_gaps=_serialize_gaps(state.get("compliance_gaps")),
        error_message=state.get("error_message"),
    )


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------


@router.post("/start", response_model=ArchWorkflowResponse)
async def start_arch_workflow(payload: StartArchWorkflowRequest) -> ArchWorkflowResponse:
    prd_data = session_store.get(payload.prd_session_id)
    if not prd_data:
        raise HTTPException(status_code=404, detail="PRD session not found.")

    prd_state = AgentState.model_validate(prd_data)
    if prd_state.status != "accepted":
        raise HTTPException(
            status_code=409,
            detail=(
                f"PRD is not accepted yet (current status: '{prd_state.status}'). "
                "Accept the PRD via POST /workflows/prd/accept before starting architecture planning."
            ),
        )
    if not prd_state.plan_markdown:
        raise HTTPException(
            status_code=409,
            detail="The accepted PRD has no plan content. Re-run the PRD workflow.",
        )

    cloud_provider = _PROVIDER_MAP.get(
        prd_state.cloud_provider.lower(), prd_state.cloud_provider.upper()
    )

    session_id = arch_session_store.create(payload.prd_session_id)
    config = {"configurable": {"thread_id": session_id}}

    initial_state = make_initial_state(
        budget=payload.budget,
        traffic=payload.traffic,
        availability=payload.availability,
        prd=prd_state.plan_markdown,
        cloud_provider=cloud_provider,
    )

    graph = _get_arch_graph()
    try:
        await graph.ainvoke(initial_state, config=config)
    except Exception as exc:
        logger.error("Architecture start error [%s]: %s", session_id, exc, exc_info=True)
        arch_session_store.update(session_id, status="error")
        return ArchWorkflowResponse(session_id=session_id, status="error", error_message=str(exc))

    return _build_response(session_id, graph, config)


@router.post("/review", response_model=ArchWorkflowResponse)
async def review_arch_workflow(payload: ReviewArchWorkflowRequest) -> ArchWorkflowResponse:
    session = arch_session_store.get(payload.session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Architecture session not found.")

    if session["status"] != "review_ready":
        raise HTTPException(
            status_code=409,
            detail=f"Session is not awaiting review (current status: '{session['status']}').",
        )

    config = {"configurable": {"thread_id": session["thread_id"]}}
    graph = _get_arch_graph()

    try:
        await graph.ainvoke(
            Command(resume={"accepted": payload.accepted, "changes": payload.changes}),
            config=config,
        )
    except Exception as exc:
        logger.error("Architecture review error [%s]: %s", payload.session_id, exc, exc_info=True)
        arch_session_store.update(payload.session_id, status="error")
        return ArchWorkflowResponse(
            session_id=payload.session_id, status="error", error_message=str(exc)
        )

    return _build_response(payload.session_id, graph, config)
