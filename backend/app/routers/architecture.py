from __future__ import annotations

import logging
import os
from typing import Any

from fastapi import APIRouter, HTTPException
from langgraph.types import Command

from app.agents.architecture_planner import create_graph, make_initial_state
from app.agents.agent1.state import AgentState
from app.config import settings
from app.schemas.architecture import (
    ArchWorkflowResponse,
    ClarifyingQuestionSchema,
    RespondArchWorkflowRequest,
    ReviewArchWorkflowRequest,
    StartArchWorkflowRequest,
)
from app.services.arch_sessions import arch_session_store
from app.services.workflow_sessions import session_store

router = APIRouter(prefix="/workflows/architecture", tags=["architecture"])
logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Data paths — resolved relative to THIS file so they work regardless of CWD.
# layout: backend/app/routers/architecture.py
#         backend/app/agents/data/graph/{graph,community_summaries}.json
# ---------------------------------------------------------------------------
_APP_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
_GRAPH_JSON = os.path.join(_APP_DIR, "agents", "data", "graph", "graph.json")
_SUMMARIES_JSON = os.path.join(_APP_DIR, "agents", "data", "graph", "community_summaries.json")

# cloud_provider normalisation: Agent 1 stores lowercase ("aws"),
# Agent 2 prompts expect upper-case ("AWS", "GCP", "Azure").
_PROVIDER_MAP: dict[str, str] = {"aws": "AWS", "gcp": "GCP", "azure": "Azure"}

# ---------------------------------------------------------------------------
# Singleton compiled graph — created once per process; state is per thread_id
# ---------------------------------------------------------------------------
_arch_graph = None


def _get_arch_graph():
    global _arch_graph
    if _arch_graph is None:
        _arch_graph = create_graph(
            graph_json_path=_GRAPH_JSON,
            community_summaries_path=_SUMMARIES_JSON,
        )
    return _arch_graph


# ---------------------------------------------------------------------------
# Interrupt / state helpers
# ---------------------------------------------------------------------------


def _detect_interrupt(graph, config: dict) -> tuple[str | None, Any]:
    """
    Return (interrupt_type, interrupt_payload) when the graph is paused at an
    interrupt(), or (None, None) when the graph has completed.

    interrupt_type values:
      "questions" — info_gathering subgraph waiting for user answers
      "review"    — accept subgraph waiting for architecture approval
      "unknown"   — interrupt with unrecognised payload shape
    """
    try:
        snapshot = graph.get_state(config)
    except Exception:
        return None, None

    if not snapshot or not snapshot.next:
        return None, None  # graph completed normally

    interrupts: list = []
    for task in snapshot.tasks:
        interrupts.extend(getattr(task, "interrupts", []))

    if not interrupts:
        return None, None

    payload = interrupts[0].value
    if isinstance(payload, dict):
        if "questions" in payload:
            return "questions", payload
        if "summary" in payload:
            return "review", payload

    return "unknown", payload


def _current_state_values(graph, config: dict) -> dict[str, Any]:
    """Return the latest values snapshot from the MemorySaver checkpointer."""
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
    """Inspect the graph's current checkpoint and return the appropriate response."""
    interrupt_type, interrupt_payload = _detect_interrupt(graph, config)

    # ── Graph paused for clarifying questions ────────────────────────────────
    if interrupt_type == "questions":
        questions = [
            ClarifyingQuestionSchema(**q)
            for q in interrupt_payload.get("questions", [])
        ]
        arch_session_store.update(
            session_id,
            status="needs_clarification",
            interrupt_type="questions",
            interrupt_payload=interrupt_payload,
        )
        return ArchWorkflowResponse(
            session_id=session_id,
            status="needs_clarification",
            clarifying_questions=questions,
        )

    # ── Graph paused for architecture review ─────────────────────────────────
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
            eval_score=state.get("eval_score"),
            eval_feedback=state.get("eval_feedback"),
            compliance_gaps=_serialize_gaps(state.get("compliance_gaps")),
            error_message=state.get("error_message"),
        )

    # ── Graph completed (or unknown interrupt) ───────────────────────────────
    state = _current_state_values(graph, config)
    arch_session_store.update(session_id, status="accepted")
    return ArchWorkflowResponse(
        session_id=session_id,
        status="accepted",
        architecture_diagram=_serialize_diagram(state.get("architecture_diagram")),
        nfr_document=state.get("nfr_document"),
        component_responsibilities=state.get("component_responsibilities"),
        extra_context=state.get("extra_context"),
        eval_score=state.get("eval_score"),
        eval_feedback=state.get("eval_feedback"),
        compliance_gaps=_serialize_gaps(state.get("compliance_gaps")),
        error_message=state.get("error_message"),
    )


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------


@router.post("/start", response_model=ArchWorkflowResponse)
async def start_arch_workflow(payload: StartArchWorkflowRequest) -> ArchWorkflowResponse:
    """
    Start the Architecture Planner (Agent 2) using an accepted PRD from Agent 1.

    Prerequisite flow:
      POST /workflows/prd/start  → session_id
      POST /workflows/prd/respond  (repeat until plan_ready)
      POST /workflows/prd/accept   accepted=true  → use that session_id here
    """
    # ── Validate Agent 1 session ─────────────────────────────────────────────
    prd_data = session_store.get(payload.prd_session_id)
    if not prd_data:
        raise HTTPException(status_code=404, detail="PRD session not found.")

    prd_state = AgentState.model_validate(prd_data)
    if prd_state.status != "accepted":
        raise HTTPException(
            status_code=409,
            detail=(
                f"PRD is not accepted yet (current status: '{prd_state.status}'). "
                "Accept the PRD via POST /workflows/prd/accept before starting "
                "architecture planning."
            ),
        )
    if not prd_state.plan_markdown:
        raise HTTPException(
            status_code=409,
            detail="The accepted PRD has no plan content. Re-run the PRD workflow.",
        )

    # ── Normalise cloud_provider casing ──────────────────────────────────────
    cloud_provider = _PROVIDER_MAP.get(
        prd_state.cloud_provider.lower(), prd_state.cloud_provider.upper()
    )

    # ── Create arch session (session_id doubles as the LangGraph thread_id) ──
    session_id = arch_session_store.create(payload.prd_session_id)
    config = {"configurable": {"thread_id": session_id}}

    initial_state = make_initial_state(
        budget=payload.budget,
        traffic=payload.traffic,
        availability=payload.availability,
        prd=prd_state.plan_markdown,
        cloud_provider=cloud_provider,
    )

    # ── Run Agent 2 until first interrupt or completion ───────────────────────
    graph = _get_arch_graph()
    try:
        await graph.ainvoke(initial_state, config=config)
    except Exception as exc:
        logger.error("Architecture start error [%s]: %s", session_id, exc, exc_info=True)
        arch_session_store.update(session_id, status="error")
        return ArchWorkflowResponse(
            session_id=session_id,
            status="error",
            error_message=str(exc),
        )

    return _build_response(session_id, graph, config)


@router.post("/respond", response_model=ArchWorkflowResponse)
async def respond_arch_workflow(payload: RespondArchWorkflowRequest) -> ArchWorkflowResponse:
    """
    Supply answers to the architecture planner's clarifying questions.
    Only valid when the session status is 'needs_clarification'.
    """
    session = arch_session_store.get(payload.session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Architecture session not found.")

    if session["status"] != "needs_clarification":
        raise HTTPException(
            status_code=409,
            detail=(
                f"Session is not awaiting clarification "
                f"(current status: '{session['status']}')."
            ),
        )

    config = {"configurable": {"thread_id": session["thread_id"]}}
    graph = _get_arch_graph()

    try:
        await graph.ainvoke(Command(resume=payload.answers), config=config)
    except Exception as exc:
        logger.error("Architecture respond error [%s]: %s", payload.session_id, exc, exc_info=True)
        arch_session_store.update(payload.session_id, status="error")
        return ArchWorkflowResponse(
            session_id=payload.session_id,
            status="error",
            error_message=str(exc),
        )

    return _build_response(payload.session_id, graph, config)


@router.post("/review", response_model=ArchWorkflowResponse)
async def review_arch_workflow(payload: ReviewArchWorkflowRequest) -> ArchWorkflowResponse:
    """
    Accept or request changes to the architecture diagram.
    Only valid when the session status is 'review_ready'.

    - accepted=true  → finalises the architecture (status → 'accepted')
    - accepted=false → triggers another architecture iteration with your changes
    """
    session = arch_session_store.get(payload.session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Architecture session not found.")

    if session["status"] != "review_ready":
        raise HTTPException(
            status_code=409,
            detail=(
                f"Session is not awaiting review "
                f"(current status: '{session['status']}')."
            ),
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
            session_id=payload.session_id,
            status="error",
            error_message=str(exc),
        )

    return _build_response(payload.session_id, graph, config)
