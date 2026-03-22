import asyncio
import json
import logging
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Request
from fastapi.responses import StreamingResponse
from bson import ObjectId

from app.core.dependencies import get_current_user
from app.db.mongo import projects_col, builds_col, deployments_col
from app.db.encryption import decrypt
from app.providers.factory import get_provider
from app.schemas.deploy import DeployRollbackRequest
from app.utils.serialization import serialize_doc

router = APIRouter(prefix="/workflows/deploy", tags=["deploy"])
logger = logging.getLogger(__name__)


def _sse(data: dict) -> str:
    return f"data: {json.dumps(data)}\n\n"


def _find_cf_template(artifacts: dict) -> str:
    """Find a CloudFormation template in artifacts, or return a minimal placeholder."""
    for key, content in artifacts.items():
        if isinstance(content, str) and (
            key.endswith(".yaml") or key.endswith(".yml") or key.endswith(".json")
        ):
            if "AWSTemplateFormatVersion" in content or "Resources" in content:
                return content
    return json.dumps({
        "AWSTemplateFormatVersion": "2010-09-09",
        "Description": "CloudForge generated stack",
        "Resources": {
            "Placeholder": {
                "Type": "AWS::CloudFormation::WaitConditionHandle"
            }
        }
    })


@router.post("/start/{project_id}")
async def start_deploy(project_id: str, request: Request, user=Depends(get_current_user)):
    project = await projects_col().find_one({"_id": ObjectId(project_id)})
    if not project:
        raise HTTPException(404, "Project not found")
    if str(project["owner_id"]) != str(user["_id"]):
        raise HTTPException(403, "Forbidden")

    build_doc = await builds_col().find_one(
        {"project_id": ObjectId(project_id), "status": "complete"}
    )
    if not build_doc:
        raise HTTPException(409, "No completed build for this project")

    if not project.get("cloud_credentials_encrypted"):
        raise HTTPException(409, "Cloud credentials not configured")

    try:
        creds_json = decrypt(project["cloud_credentials_encrypted"])
    except Exception:
        raise HTTPException(status_code=400, detail="Failed to decrypt cloud credentials. Re-enter your credentials.")
    credentials = json.loads(creds_json)
    provider_type = project.get("cloud_provider_type") or credentials.get("provider", "aws")

    deployment_id = str(ObjectId())

    deploy_doc = {
        "_id": ObjectId(deployment_id),
        "project_id": ObjectId(project_id),
        "build_id": build_doc["_id"],
        "status": "running",
        "provider": provider_type,
        "region": credentials.get("region", "us-east-1"),
        "log_lines": [],
        "resource_statuses": {},
        "stack_outputs": {},
        "external_id": None,
        "role_arn": credentials.get("role_arn"),
        "created_at": datetime.now(timezone.utc),
        "updated_at": datetime.now(timezone.utc),
    }
    await deployments_col().insert_one(deploy_doc)

    async def _stream():
        log_lines = []
        resource_statuses = {}

        async def on_event(event: dict):
            if event.get("type") == "log":
                log_lines.append(event["line"])
            elif event.get("type") == "node_status":
                resource_statuses[event["nodeId"]] = event["status"]

        try:
            provider = get_provider(provider_type, credentials)

            yield _sse({"type": "log", "line": "⟳ Verifying cloud credentials…"})
            await provider.verify_credentials()
            yield _sse({"type": "log", "line": "✓ Credentials verified"})

            stack_name = f"cloudforge-{project_id[:8]}"
            artifacts = build_doc.get("artifacts", {})
            template_body = _find_cf_template(artifacts)

            event_queue: asyncio.Queue = asyncio.Queue()

            async def queuing_on_event(event: dict):
                await on_event(event)
                await event_queue.put(event)

            deploy_task = asyncio.create_task(
                provider.deploy(stack_name, template_body, {}, queuing_on_event)
            )

            while not deploy_task.done():
                if await request.is_disconnected():
                    deploy_task.cancel()
                    logger.info("Client disconnected, cancelled deploy task")
                    return
                try:
                    event = await asyncio.wait_for(event_queue.get(), timeout=1.0)
                    yield _sse(event)
                except asyncio.TimeoutError:
                    continue

            while not event_queue.empty():
                event = event_queue.get_nowait()
                yield _sse(event)

            stack_outputs = await deploy_task

            await deployments_col().update_one(
                {"_id": ObjectId(deployment_id)},
                {"$set": {
                    "status": "complete",
                    "log_lines": log_lines,
                    "resource_statuses": resource_statuses,
                    "stack_outputs": stack_outputs,
                    "updated_at": datetime.now(timezone.utc),
                }}
            )
            await projects_col().update_one(
                {"_id": ObjectId(project_id)},
                {"$set": {
                    "deployment_id": deployment_id,
                    "stage": "done",
                    "status": "deployed",
                    "updated_at": datetime.now(timezone.utc),
                }}
            )

            yield _sse({"type": "log", "line": "✓ Deployment complete"})

        except Exception:
            logger.exception("Workflow error in deploy stream")
            await deployments_col().update_one(
                {"_id": ObjectId(deployment_id)},
                {"$set": {"status": "failed", "updated_at": datetime.now(timezone.utc)}}
            )
            yield _sse({"type": "error", "message": "An internal error occurred. Please try again."})

        yield "data: [DONE]\n\n"

    return StreamingResponse(
        _stream(),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )


@router.post("/rollback/{project_id}")
async def rollback_deploy(
    project_id: str,
    body: DeployRollbackRequest,
    user=Depends(get_current_user),
):
    project = await projects_col().find_one({"_id": ObjectId(project_id)})
    if not project:
        raise HTTPException(404, "Project not found")
    if str(project["owner_id"]) != str(user["_id"]):
        raise HTTPException(403, "Forbidden")

    deployment = await deployments_col().find_one({"_id": ObjectId(body.deployment_id)})
    if not deployment:
        raise HTTPException(404, "Deployment not found")

    if not project.get("cloud_credentials_encrypted"):
        raise HTTPException(409, "Cloud credentials not configured")

    try:
        creds_json = decrypt(project["cloud_credentials_encrypted"])
    except Exception:
        raise HTTPException(status_code=400, detail="Failed to decrypt cloud credentials. Re-enter your credentials.")
    credentials = json.loads(creds_json)
    provider_type = project.get("cloud_provider_type") or credentials.get("provider", "aws")

    stack_name = f"cloudforge-{project_id[:8]}"

    provider = get_provider(provider_type, credentials)
    await provider.rollback(stack_name)

    await deployments_col().update_one(
        {"_id": ObjectId(body.deployment_id)},
        {"$set": {"status": "failed", "updated_at": datetime.now(timezone.utc)}}
    )

    return {"rolled_back": True}


@router.get("/status/{project_id}")
async def deploy_status(project_id: str, user=Depends(get_current_user)):
    project = await projects_col().find_one({"_id": ObjectId(project_id)})
    if not project:
        raise HTTPException(404, "Project not found")
    if str(project["owner_id"]) != str(user["_id"]):
        raise HTTPException(403, "Forbidden")

    deployment = await deployments_col().find_one(
        {"project_id": ObjectId(project_id)},
        sort=[("created_at", -1)],
    )
    if not deployment:
        raise HTTPException(404, "No deployment found for this project")

    return serialize_doc(deployment)
