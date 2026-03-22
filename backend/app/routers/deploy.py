"""
Deploy router — SSE streaming deployment endpoints.

Endpoints:
  POST /deploy/start              → Start a new deployment, returns deployment_id
  GET  /deploy/{id}/stream        → SSE stream of deployment events
  GET  /deploy/{id}/status        → Current deployment status (JSON)
  POST /deploy/{id}/rollback      → Rollback a deployment
  POST /deploy/{id}/cancel        → Cancel a running deployment
  GET  /deploy/list               → List all deployments
"""

from __future__ import annotations

import logging

from fastapi import APIRouter, HTTPException
from fastapi.responses import StreamingResponse

from app.schemas.deploy import (
    DeployListItem,
    DeployStartResponse,
    DeployStatusResponse,
    RollbackRequest,
    RollbackResponse,
    StartDeployRequest,
)
from app.services.deploy_orchestrator import DeploymentOrchestrator

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/deploy", tags=["deploy"])

# Shared orchestrator instance
_orchestrator = DeploymentOrchestrator()


@router.post("/start", response_model=DeployStartResponse)
async def start_deployment(payload: StartDeployRequest) -> DeployStartResponse:
    """
    Start a new infrastructure deployment.

    Accepts the architecture data (nodes + edges) from the forge pipeline
    and kicks off the Terraform generation → init → plan → apply pipeline.
    """
    # Convert Pydantic models to dicts for the orchestrator
    arch_data = {
        "nodes": [node.model_dump(by_alias=True) for node in payload.architecture_data.nodes],
        "edges": [edge.model_dump(by_alias=True) for edge in payload.architecture_data.edges],
    }

    deployment_id = await _orchestrator.start_deployment(
        architecture_data=arch_data,
        project_name=payload.project_name,
        region=payload.region,
        environment=payload.environment,
        aws_credentials=payload.aws_credentials,
    )

    return DeployStartResponse(
        deployment_id=deployment_id,
        status="accepted",
        message=f"Deployment {deployment_id} started — stream events at /deploy/{deployment_id}/stream",
    )


@router.get("/{deployment_id}/stream")
async def stream_deployment(deployment_id: str) -> StreamingResponse:
    """
    SSE stream of deployment events.

    Connect via EventSource or fetch with streaming.
    Events: log, node_status, stage_change, terraform_output, error, complete.
    """
    deployment = await _orchestrator.get_deployment_status(deployment_id)
    if not deployment:
        raise HTTPException(status_code=404, detail="Deployment not found")

    async def event_generator():
        try:
            async for event in _orchestrator.stream_events(deployment_id):
                yield event.to_sse()
        except Exception as e:
            logger.error("SSE stream error for %s: %s", deployment_id, str(e))
            yield f"data: {{\"type\": \"error\", \"message\": \"{str(e)}\"}}\n\n"

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )


@router.get("/{deployment_id}/status", response_model=DeployStatusResponse)
async def get_deployment_status(deployment_id: str) -> DeployStatusResponse:
    """Get the current status of a deployment."""
    deployment = await _orchestrator.get_deployment_status(deployment_id)
    if not deployment:
        raise HTTPException(status_code=404, detail="Deployment not found")

    return DeployStatusResponse(
        deployment_id=deployment["deployment_id"],
        project_name=deployment["project_name"],
        status=deployment["status"].value if hasattr(deployment["status"], "value") else deployment["status"],
        region=deployment["region"],
        environment=deployment["environment"],
        node_statuses=deployment.get("node_statuses", {}),
        outputs=deployment.get("outputs", {}),
        is_rollback=deployment.get("is_rollback", False),
        created_at=deployment["created_at"],
        updated_at=deployment["updated_at"],
    )


@router.post("/{deployment_id}/rollback", response_model=RollbackResponse)
async def rollback_deployment(
    deployment_id: str, payload: RollbackRequest
) -> RollbackResponse:
    """Rollback a completed or failed deployment using terraform destroy."""
    if not payload.confirm:
        raise HTTPException(
            status_code=400, detail="Rollback not confirmed — set confirm=true"
        )

    try:
        rollback_id = await _orchestrator.rollback_deployment(deployment_id)
        return RollbackResponse(
            rollback_id=rollback_id,
            status="accepted",
            message=f"Rollback {rollback_id} started for deployment {deployment_id}",
        )
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))


@router.post("/{deployment_id}/cancel")
async def cancel_deployment(deployment_id: str) -> dict:
    """Cancel a running deployment."""
    cancelled = await _orchestrator.cancel_deployment(deployment_id)
    if not cancelled:
        raise HTTPException(
            status_code=409,
            detail="Deployment is not running or already completed",
        )
    return {"deployment_id": deployment_id, "status": "cancelled"}


@router.get("/list", response_model=list[DeployListItem])
async def list_deployments() -> list[DeployListItem]:
    """List all deployments."""
    deployments = await _orchestrator.state_manager.list_deployments()
    return [
        DeployListItem(
            deployment_id=d["deployment_id"],
            project_name=d["project_name"],
            status=d["status"].value if hasattr(d["status"], "value") else d["status"],
            region=d["region"],
            environment=d["environment"],
            is_rollback=d.get("is_rollback", False),
            created_at=d["created_at"],
        )
        for d in deployments
    ]
