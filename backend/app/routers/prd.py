from __future__ import annotations

import asyncio
import json
import logging
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timezone
from uuid import uuid4

from bson import ObjectId
from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import StreamingResponse

from app.agents.agent1 import run_until_interrupt
from app.agents.agent1.state import AgentState
from app.core.dependencies import get_current_user
from app.db.mongo import prd_conversations_col, projects_col
from app.schemas.prd import ConstraintChip, PrdRespondRequest, PrdStartRequest
from app.services.workflow_sessions import session_store

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/workflows/prd/v2", tags=["prd-v2"])


# ---------------------------------------------------------------------------
# SSE helpers
# ---------------------------------------------------------------------------

def _sse(data: dict) -> str:
    return f"data: {json.dumps(data)}\n\n"


def _infer_category(label: str) -> str:
    low = label.lower()
    if any(k in low for k in ["latency", "throughput", "performance", "p95", "p99", "response"]):
        return "performance"
    if any(k in low for k in ["jwt", "tls", "auth", "security", "encrypt", "ssl"]):
        return "security"
    if any(k in low for k in ["cost", "price", "budget", "dollar", "$"]):
        return "cost"
    return "reliability"


def _parse_constraints(state: AgentState) -> list[ConstraintChip]:
    if state.plan_json is None:
        return []
    chips: list[ConstraintChip] = []
    for item in state.plan_json.non_functional_requirements:
        if isinstance(item, dict):
            label = (
                item.get("requirement")
                or item.get("description")
                or str(item)
            )
        else:
            label = str(item)
        label = label.strip()
        if not label:
            continue
        chips.append(
            ConstraintChip(
                id=str(uuid4()),
                label=label,
                category=_infer_category(label),
            )
        )
    return chips


# ---------------------------------------------------------------------------
# Async wrapper around the sync agent runner
# ---------------------------------------------------------------------------

async def _run_agent1(state: AgentState) -> AgentState:
    loop = asyncio.get_event_loop()

    def _sync_run() -> AgentState:
        return run_until_interrupt(state.as_graph_state())

    with ThreadPoolExecutor() as executor:
        result: AgentState = await loop.run_in_executor(executor, _sync_run)
    return result


# ---------------------------------------------------------------------------
# Persistence helpers
# ---------------------------------------------------------------------------

async def _persist_prd(
    project_id: str,
    session_id: str,
    result: AgentState,
    chips: list[ConstraintChip],
) -> None:
    now = datetime.now(timezone.utc)
    session_doc = {
        "project_id": ObjectId(project_id),
        "session_id": session_id,
        "status": "plan_ready",
        "plan_markdown": result.plan_markdown or "",
        "plan_json": result.plan_json.model_dump(mode="json") if result.plan_json else {},
        "messages": [],
        "created_at": now,
        "updated_at": now,
    }
    await prd_conversations_col().update_one(
        {"session_id": session_id},
        {"$set": session_doc},
        upsert=True,
    )
    await projects_col().update_one(
        {"_id": ObjectId(project_id)},
        {"$set": {"prd_session_id": session_id, "updated_at": now}},
    )


# ---------------------------------------------------------------------------
# POST /workflows/prd/v2/start/{project_id}
# ---------------------------------------------------------------------------

@router.post("/start/{project_id}")
async def start_prd(
    project_id: str,
    payload: PrdStartRequest,
    user: dict = Depends(get_current_user),
) -> StreamingResponse:
    # Gate: validate project
    try:
        oid = ObjectId(project_id)
    except Exception:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Project not found")

    project = await projects_col().find_one({"_id": oid})
    if project is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Project not found")
    if project.get("owner_id") != ObjectId(str(user["_id"])):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Forbidden")
    if project.get("stage") != "prd":
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Project stage is '{project.get('stage')}', expected 'prd'",
        )

    # Resolve or create in-memory session
    existing_session_id: str | None = project.get("prd_session_id")
    if existing_session_id:
        raw = session_store.get(existing_session_id)
        if raw:
            initial_state = AgentState.model_validate(raw)
        else:
            # Session evicted from memory — rebuild from Mongo
            conv = await prd_conversations_col().find_one({"session_id": existing_session_id})
            if conv:
                initial_state = AgentState(
                    session_id=existing_session_id,
                    prd_text=payload.prd_text,
                    cloud_provider=payload.cloud_provider.lower().strip(),
                    status="running",
                )
                session_store.save(initial_state.as_graph_state())
            else:
                initial_state = None
        if initial_state is None:
            existing_session_id = None

    if not existing_session_id:
        base_state = AgentState(
            prd_text=payload.prd_text,
            cloud_provider=payload.cloud_provider.lower().strip(),
            status="running",
        )
        raw = session_store.create(base_state.as_graph_state())
        session_id = raw["session_id"]
        initial_state = AgentState.model_validate(raw)
    else:
        session_id = existing_session_id

    async def _stream():
        try:
            result = await _run_agent1(initial_state)
            session_store.save(result.as_graph_state())

            chips = _parse_constraints(result)
            await _persist_prd(project_id, session_id, result, chips)

            for chip in chips:
                yield _sse({"type": "constraint", "chip": chip.model_dump()})

            yield _sse({
                "type": "plan_ready",
                "session_id": session_id,
                "plan_markdown": result.plan_markdown or "",
            })

        except Exception as exc:
            logger.exception("Error in start_prd SSE stream")
            yield _sse({"type": "error", "message": str(exc)})

        yield "data: [DONE]\n\n"

    return StreamingResponse(
        _stream(),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )


# ---------------------------------------------------------------------------
# POST /workflows/prd/v2/respond/{project_id}
# ---------------------------------------------------------------------------

@router.post("/respond/{project_id}")
async def respond_prd(
    project_id: str,
    payload: PrdRespondRequest,
    user: dict = Depends(get_current_user),
) -> StreamingResponse:
    # Gate: validate project
    try:
        oid = ObjectId(project_id)
    except Exception:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Project not found")

    project = await projects_col().find_one({"_id": oid})
    if project is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Project not found")
    if project.get("owner_id") != ObjectId(str(user["_id"])):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Forbidden")

    session_id: str | None = project.get("prd_session_id")
    if not session_id:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="No active PRD session; call /start first",
        )

    raw = session_store.get(session_id)
    if not raw:
        # Try to restore from Mongo
        conv = await prd_conversations_col().find_one({"session_id": session_id})
        if not conv:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Session not found")
        raw = {
            "session_id": session_id,
            "prd_text": conv.get("plan_markdown", ""),
            "cloud_provider": project.get("cloud_provider", "aws"),
            "status": "needs_input",
            "plan_markdown": conv.get("plan_markdown"),
            "plan_json": conv.get("plan_json"),
        }
        session_store.save(raw)

    state = AgentState.model_validate(raw)
    state.user_answers = list(state.user_answers) + [payload.message]
    state.accepted = None
    state.status = "running"

    async def _stream():
        try:
            result = await _run_agent1(state)
            session_store.save(result.as_graph_state())

            chips = _parse_constraints(result)
            await _persist_prd(project_id, session_id, result, chips)

            for chip in chips:
                yield _sse({"type": "constraint", "chip": chip.model_dump()})

            yield _sse({
                "type": "plan_ready",
                "session_id": session_id,
                "plan_markdown": result.plan_markdown or "",
            })

        except Exception as exc:
            logger.exception("Error in respond_prd SSE stream")
            yield _sse({"type": "error", "message": str(exc)})

        yield "data: [DONE]\n\n"

    return StreamingResponse(
        _stream(),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )


# ---------------------------------------------------------------------------
# POST /workflows/prd/v2/accept/{project_id}
# ---------------------------------------------------------------------------

@router.post("/accept/{project_id}")
async def accept_prd(
    project_id: str,
    user: dict = Depends(get_current_user),
) -> dict:
    # Gate: validate project
    try:
        oid = ObjectId(project_id)
    except Exception:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Project not found")

    project = await projects_col().find_one({"_id": oid})
    if project is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Project not found")
    if project.get("owner_id") != ObjectId(str(user["_id"])):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Forbidden")

    prd_session_id: str | None = project.get("prd_session_id")
    if not prd_session_id:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="No PRD session to accept; call /start first",
        )

    now = datetime.now(timezone.utc)
    await prd_conversations_col().update_one(
        {"session_id": prd_session_id},
        {"$set": {"status": "accepted", "updated_at": now}},
    )
    await projects_col().update_one(
        {"_id": oid},
        {"$set": {"stage": "arch", "updated_at": now}},
    )

    return {"session_id": prd_session_id, "status": "accepted"}
