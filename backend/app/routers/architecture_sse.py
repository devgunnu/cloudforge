from __future__ import annotations

import json
import logging
import os
from datetime import datetime, timezone
from typing import AsyncGenerator
from uuid import uuid4

from bson import ObjectId
from fastapi import APIRouter, Depends, HTTPException, Request
from fastapi.responses import StreamingResponse
from langgraph.types import Command

from app.agents.architecture_planner import create_graph, make_initial_state
from app.config import settings
from app.core.dependencies import get_current_user
from app.db.mongo import architectures_col, prd_conversations_col, projects_col
from app.schemas.arch_sse import ArchSSERespondRequest, ArchSSEReviewRequest, ArchSSEStartRequest

router = APIRouter(prefix="/workflows/architecture/v2", tags=["architecture-v2"])
logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Data paths — same constants as architecture.py
# ---------------------------------------------------------------------------

_APP_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
_GRAPH_JSON = os.path.join(_APP_DIR, "agents", "data", "graph", "graph.json")
_SUMMARIES_JSON = os.path.join(_APP_DIR, "agents", "data", "graph", "community_summaries.json")

_PROVIDER_MAP: dict[str, str] = {"aws": "AWS", "gcp": "GCP", "azure": "Azure"}

# Node → SSE step number
_NODE_STEPS = {
    "info_gathering": 1,
    "query": 2,
    "kg_traversal": 3,
    "service_discovery": 4,
    "architecture": 5,
    "compliance": 6,
    "eval": 7,
}

# ---------------------------------------------------------------------------
# Graph singleton
# ---------------------------------------------------------------------------

_arch_graph_v2 = None


def _get_arch_graph(kuzu_conn=None):  # noqa: ARG001 — kuzu_conn reserved for future use
    global _arch_graph_v2
    if _arch_graph_v2 is None:
        _arch_graph_v2 = create_graph(
            graph_json_path=_GRAPH_JSON,
            community_summaries_path=_SUMMARIES_JSON,
        )
    return _arch_graph_v2


# ---------------------------------------------------------------------------
# SSE helpers
# ---------------------------------------------------------------------------


def _sse(data: dict) -> str:
    return f"data: {json.dumps(data)}\n\n"


def _serialize_diagram(diagram) -> dict | None:
    if diagram is None:
        return None
    if hasattr(diagram, "model_dump"):
        return diagram.model_dump(by_alias=True)
    if isinstance(diagram, dict):
        return diagram
    return None


# ---------------------------------------------------------------------------
# Streaming generator — start
# ---------------------------------------------------------------------------


async def _stream_arch_start(
    project_id: str,
    project: dict,
    payload: ArchSSEStartRequest,
    user: dict,
    kuzu_conn,
    request: Request,
) -> AsyncGenerator[str, None]:
    # 1. Fetch PRD and gate on accepted status
    prd_conv = await prd_conversations_col().find_one({"project_id": ObjectId(project_id)})
    if not prd_conv or prd_conv.get("status") != "accepted":
        yield _sse({"type": "error", "message": "PRD not accepted"})
        return

    # 2. Create session
    session_id = str(uuid4())
    config = {"configurable": {"thread_id": session_id}}

    # 3. Build graph and initial state
    graph = _get_arch_graph(kuzu_conn)
    cloud_provider = _PROVIDER_MAP.get(
        project.get("cloud_provider", "aws").lower(), "AWS"
    )
    initial_state = make_initial_state(
        budget=payload.budget or "",
        traffic=payload.traffic or "",
        availability=payload.availability or "",
        prd=prd_conv.get("plan_markdown", ""),
        cloud_provider=cloud_provider,
    )

    # 4. Persist session
    now = datetime.now(timezone.utc)
    await architectures_col().insert_one(
        {
            "project_id": ObjectId(project_id),
            "session_id": session_id,
            "status": "in_progress",
            "created_at": now,
            "updated_at": now,
        }
    )
    await projects_col().update_one(
        {"_id": ObjectId(project_id)},
        {"$set": {"arch_session_id": session_id, "updated_at": now}},
    )

    # 5. Stream
    seen_nodes: set[str] = set()
    try:
        async for state_snapshot in graph.astream(initial_state, config, stream_mode="values"):
            if await request.is_disconnected():
                logger.info("Client disconnected, stopping architecture stream")
                return

            current_node = state_snapshot.get("current_node", "")

            # Check for interrupt
            try:
                graph_state = graph.get_state(config)
            except Exception:
                graph_state = None

            if graph_state and graph_state.next:
                interrupts = []
                for task in graph_state.tasks:
                    interrupts.extend(getattr(task, "interrupts", []))

                if interrupts:
                    payload_val = interrupts[0].value
                    if isinstance(payload_val, dict):
                        if "questions" in payload_val:
                            yield _sse({"node": "interrupt", "type": "questions", **payload_val})
                        elif "summary" in payload_val:
                            yield _sse({"node": "interrupt", "type": "review", **payload_val})
                        else:
                            yield _sse({"node": "interrupt", "type": "unknown", "payload": payload_val})
                    yield "data: [DONE]\n\n"
                    return

            # Emit node event once per node
            if current_node and current_node in _NODE_STEPS and current_node not in seen_nodes:
                seen_nodes.add(current_node)
                step = _NODE_STEPS[current_node]
                event: dict = {"node": current_node, "status": "done", "step": step}
                if current_node == "kg_traversal":
                    event["active_nodes_count"] = len(state_snapshot.get("active_nodes") or [])
                elif current_node == "compliance":
                    event["gaps_count"] = len(state_snapshot.get("compliance_gaps") or [])
                elif current_node == "eval":
                    event["score"] = state_snapshot.get("eval_score")
                yield _sse(event)

    except Exception as exc:
        logger.exception("Workflow error in arch stream")
        yield _sse({"type": "error", "message": "An internal error occurred. Please try again."})
        return

    # 6. Graph completed — finalise
    try:
        final_state = graph.get_state(config).values or {}
    except Exception:
        final_state = {}

    arch_diagram = _serialize_diagram(final_state.get("architecture_diagram"))

    await architectures_col().update_one(
        {"session_id": session_id},
        {
            "$set": {
                "status": "review_ready",
                "architecture_diagram": arch_diagram,
                "nfr_document": final_state.get("nfr_document"),
                "eval_score": final_state.get("eval_score"),
                "updated_at": datetime.now(timezone.utc),
            }
        },
    )

    yield _sse(
        {
            "node": "complete",
            "session_id": session_id,
            "architecture_diagram": arch_diagram,
            "nfr_document": final_state.get("nfr_document"),
            "eval_score": final_state.get("eval_score"),
        }
    )
    yield "data: [DONE]\n\n"


# ---------------------------------------------------------------------------
# Streaming generator — respond (resume after questions interrupt)
# ---------------------------------------------------------------------------


async def _stream_arch_resume(
    session_id: str,
    resume_value,
    kuzu_conn,
    request: Request,
) -> AsyncGenerator[str, None]:
    config = {"configurable": {"thread_id": session_id}}
    graph = _get_arch_graph(kuzu_conn)

    seen_nodes: set[str] = set()
    try:
        async for state_snapshot in graph.astream(
            Command(resume=resume_value), config, stream_mode="values"
        ):
            if await request.is_disconnected():
                logger.info("Client disconnected, stopping architecture stream")
                return

            current_node = state_snapshot.get("current_node", "")

            try:
                graph_state = graph.get_state(config)
            except Exception:
                graph_state = None

            if graph_state and graph_state.next:
                interrupts = []
                for task in graph_state.tasks:
                    interrupts.extend(getattr(task, "interrupts", []))

                if interrupts:
                    payload_val = interrupts[0].value
                    if isinstance(payload_val, dict):
                        if "questions" in payload_val:
                            yield _sse({"node": "interrupt", "type": "questions", **payload_val})
                        elif "summary" in payload_val:
                            yield _sse({"node": "interrupt", "type": "review", **payload_val})
                        else:
                            yield _sse({"node": "interrupt", "type": "unknown", "payload": payload_val})
                    yield "data: [DONE]\n\n"
                    return

            if current_node and current_node in _NODE_STEPS and current_node not in seen_nodes:
                seen_nodes.add(current_node)
                step = _NODE_STEPS[current_node]
                event: dict = {"node": current_node, "status": "done", "step": step}
                if current_node == "kg_traversal":
                    event["active_nodes_count"] = len(state_snapshot.get("active_nodes") or [])
                elif current_node == "compliance":
                    event["gaps_count"] = len(state_snapshot.get("compliance_gaps") or [])
                elif current_node == "eval":
                    event["score"] = state_snapshot.get("eval_score")
                yield _sse(event)

    except Exception as exc:
        logger.exception("Workflow error in arch stream")
        yield _sse({"type": "error", "message": "An internal error occurred. Please try again."})
        return

    try:
        final_state = graph.get_state(config).values or {}
    except Exception:
        final_state = {}

    arch_diagram = _serialize_diagram(final_state.get("architecture_diagram"))

    await architectures_col().update_one(
        {"session_id": session_id},
        {
            "$set": {
                "status": "review_ready",
                "architecture_diagram": arch_diagram,
                "nfr_document": final_state.get("nfr_document"),
                "eval_score": final_state.get("eval_score"),
                "updated_at": datetime.now(timezone.utc),
            }
        },
    )

    yield _sse(
        {
            "node": "complete",
            "session_id": session_id,
            "architecture_diagram": arch_diagram,
            "nfr_document": final_state.get("nfr_document"),
            "eval_score": final_state.get("eval_score"),
        }
    )
    yield "data: [DONE]\n\n"


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------


@router.post("/start/{project_id}")
async def start_arch_v2(
    project_id: str,
    payload: ArchSSEStartRequest,
    request: Request,
    user: dict = Depends(get_current_user),
):
    project = await projects_col().find_one({"_id": ObjectId(project_id)})
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    if str(project["owner_id"]) != str(user["_id"]):
        raise HTTPException(status_code=403, detail="Forbidden")

    kuzu_conn = getattr(request.app.state, "kuzu_conn", None)

    return StreamingResponse(
        _stream_arch_start(project_id, project, payload, user, kuzu_conn, request),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )


@router.post("/respond/{project_id}")
async def respond_arch_v2(
    project_id: str,
    payload: ArchSSERespondRequest,
    request: Request,
    user: dict = Depends(get_current_user),
):
    project = await projects_col().find_one({"_id": ObjectId(project_id)})
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    if str(project.get("owner_id")) != str(user["_id"]):
        raise HTTPException(status_code=403, detail="Forbidden")

    arch_doc = await architectures_col().find_one(
        {"project_id": ObjectId(project_id)},
        sort=[("created_at", -1)],
    )
    if not arch_doc:
        raise HTTPException(status_code=404, detail="Architecture session not found")

    session_id = arch_doc["session_id"]
    kuzu_conn = getattr(request.app.state, "kuzu_conn", None)

    return StreamingResponse(
        _stream_arch_resume(session_id, payload.answers, kuzu_conn, request),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )


@router.post("/review/{project_id}")
async def review_arch_v2(
    project_id: str,
    payload: ArchSSEReviewRequest,
    request: Request,
    user: dict = Depends(get_current_user),
):
    project = await projects_col().find_one({"_id": ObjectId(project_id)})
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    if str(project.get("owner_id")) != str(user["_id"]):
        raise HTTPException(status_code=403, detail="Forbidden")

    arch_doc = await architectures_col().find_one(
        {"project_id": ObjectId(project_id)},
        sort=[("created_at", -1)],
    )
    if not arch_doc:
        raise HTTPException(status_code=404, detail="Architecture session not found")

    session_id = arch_doc["session_id"]
    kuzu_conn = getattr(request.app.state, "kuzu_conn", None)

    resume_value = {"accepted": payload.accepted, "changes": payload.changes}

    return StreamingResponse(
        _stream_arch_resume(session_id, resume_value, kuzu_conn, request),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )


@router.get("/{project_id}")
async def get_architecture(
    project_id: str,
    user: dict = Depends(get_current_user),
) -> dict:
    project = await projects_col().find_one({"_id": ObjectId(project_id)})
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    if str(project["owner_id"]) != str(user["_id"]):
        raise HTTPException(status_code=403, detail="Forbidden")

    arch_doc = await architectures_col().find_one(
        {"project_id": ObjectId(project_id)},
        sort=[("created_at", -1)],
    )
    if not arch_doc:
        raise HTTPException(status_code=404, detail="No architecture session for this project")

    return {
        "session_id": arch_doc["session_id"],
        "status": arch_doc.get("status"),
        "architecture_diagram": arch_doc.get("architecture_diagram") or {},
        "nfr_document": arch_doc.get("nfr_document") or "",
        "eval_score": arch_doc.get("eval_score"),
    }


@router.post("/accept/{project_id}")
async def accept_arch_v2(
    project_id: str,
    request: Request,
    user: dict = Depends(get_current_user),
):
    project = await projects_col().find_one({"_id": ObjectId(project_id)})
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    if str(project["owner_id"]) != str(user["_id"]):
        raise HTTPException(status_code=403, detail="Forbidden")

    arch_doc = await architectures_col().find_one(
        {"project_id": ObjectId(project_id)},
        sort=[("created_at", -1)],
    )
    if not arch_doc:
        raise HTTPException(status_code=404, detail="Architecture session not found")

    session_id = arch_doc["session_id"]
    now = datetime.now(timezone.utc)

    await architectures_col().update_one(
        {"session_id": session_id},
        {"$set": {"status": "accepted", "updated_at": now}},
    )
    await projects_col().update_one(
        {"_id": ObjectId(project_id)},
        {"$set": {"stage": "build", "updated_at": now}},
    )

    return {"session_id": session_id, "status": "accepted"}
