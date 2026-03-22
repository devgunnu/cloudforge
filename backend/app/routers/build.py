from __future__ import annotations

import asyncio
import json
import logging
from datetime import datetime, timezone
from pathlib import Path
from uuid import uuid4

from bson import ObjectId
from fastapi import APIRouter, Depends, HTTPException, Request
from fastapi.responses import StreamingResponse

from app.agents.agent3 import GenerateRequest, get_graph
from app.core.dependencies import get_current_user
from app.db.encryption import decrypt
from app.db.mongo import architectures_col, builds_col, projects_col
from app.routers.agent3 import _build_initial_state, _stream_events
from app.schemas.build import BuildCommitRequest
from app.services.github import commit_files, list_repos
from app.utils.serialization import serialize_doc

router = APIRouter(prefix="/workflows/build", tags=["build"])
logger = logging.getLogger(__name__)


def _sse(data: dict) -> str:
    return f"data: {json.dumps(data)}\n\n"

# ---------------------------------------------------------------------------
# Service type normalisation
# ---------------------------------------------------------------------------

_SERVICE_TYPE_MAP = {
    "api gateway": "apigateway",
    "gateway": "apigateway",
    "apigw": "apigateway",
    "lambda": "lambda",
    "function": "lambda",
    "ec2": "ec2",
    "server": "ec2",
    "rds": "rds",
    "postgres": "rds",
    "mysql": "rds",
    "database": "rds",
    "dynamodb": "dynamodb",
    "nosql": "dynamodb",
    "s3": "s3",
    "storage": "s3",
    "bucket": "s3",
    "elasticache": "elasticache",
    "redis": "elasticache",
    "cache": "elasticache",
    "ecs": "ecs",
    "container": "ecs",
    "eks": "eks",
    "kubernetes": "eks",
    "sqs": "sqs",
    "queue": "sqs",
    "sns": "sns",
    "cloudfront": "cloudfront",
    "cdn": "cloudfront",
    "alb": "alb",
    "load balancer": "alb",
    "secrets manager": "secretsmanager",
    "cognito": "cognito",
    "auth": "cognito",
}


def _normalize_service_type(service: str) -> str:
    low = service.lower().strip()
    for key, val in _SERVICE_TYPE_MAP.items():
        if key in low:
            return val
    return low.replace(" ", "_")


def _arch_diagram_to_topology(arch_diagram: dict) -> dict:
    """Convert architecture_diagram from Agent 2 to topology format for Agent 3."""
    nodes = arch_diagram.get("nodes", [])
    connections = arch_diagram.get("connections", [])

    services = []
    for node in nodes:
        services.append(
            {
                "id": node.get("id", ""),
                "service_type": _normalize_service_type(
                    node.get("service", node.get("type", ""))
                ),
                "label": node.get(
                    "description", node.get("label", node.get("id", ""))
                ),
                "config": node.get("config", {}),
            }
        )

    conns = []
    for conn in connections:
        conns.append(
            {
                "source": conn.get(
                    "from", conn.get("from_", conn.get("source", ""))
                ),
                "target": conn.get("to", conn.get("target", "")),
            }
        )

    return {"services": services, "connections": conns}


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def _artifacts_to_files(artifacts: dict) -> list[dict]:
    files = []
    for key, content in artifacts.items():
        if isinstance(content, str):
            ext = key.rsplit(".", 1)[-1] if "." in key else "text"
            lang_map = {
                "tf": "hcl",
                "py": "python",
                "ts": "typescript",
                "js": "javascript",
                "yaml": "yaml",
                "yml": "yaml",
                "json": "json",
                "sh": "bash",
            }
            lang = lang_map.get(ext, ext)
            files.append(
                {
                    "id": str(uuid4()),
                    "name": key.rsplit("/", 1)[-1],
                    "path": key,
                    "lang": lang,
                    "content": content,
                    "status": "new",
                }
            )
    return files



_OUTPUTS_DIR = Path(__file__).parent.parent.parent / "outputs"


def _write_artifacts_sync(project_id: str, artifacts: dict[str, str]) -> None:
    project_dir = _OUTPUTS_DIR / project_id
    for rel_path, content in artifacts.items():
        if not isinstance(content, str):
            continue
        parts = Path(rel_path).parts
        if ".." in parts:
            logger.warning("Skipping artifact with path traversal: %s", rel_path)
            continue
        dest = project_dir / rel_path
        dest.parent.mkdir(parents=True, exist_ok=True)
        dest.write_text(content, encoding="utf-8")


async def _write_artifacts_to_disk(project_id: str, artifacts: dict[str, str]) -> None:
    try:
        await asyncio.to_thread(_write_artifacts_sync, project_id, artifacts)
    except Exception:
        logger.exception("Failed to write artifacts to disk for project %s", project_id)


# ---------------------------------------------------------------------------
# Routes
# ---------------------------------------------------------------------------


@router.post("/start/{project_id}")
async def start_build(
    project_id: str,
    request: Request,
    user=Depends(get_current_user),
) -> StreamingResponse:
    project = await projects_col().find_one({"_id": ObjectId(project_id)})
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    if str(project["owner_id"]) != str(user["_id"]):
        raise HTTPException(status_code=403, detail="Forbidden")

    arch_doc = await architectures_col().find_one(
        {"project_id": ObjectId(project_id)}
    )
    if not arch_doc or arch_doc.get("status") != "accepted":
        raise HTTPException(
            status_code=409, detail="Architecture not accepted"
        )

    arch_diagram = arch_doc.get("architecture_diagram") or {}
    topology = _arch_diagram_to_topology(arch_diagram)

    thread_id = str(uuid4())

    generate_request = GenerateRequest(
        topology=json.dumps(topology),
        input_format="json",
    )

    config = {"configurable": {"thread_id": thread_id}}
    initial_state = _build_initial_state(generate_request, thread_id)

    build_doc = {
        "project_id": ObjectId(project_id),
        "thread_id": thread_id,
        "status": "in_progress",
        "artifacts": {},
        "generated_files": [],
        "github_commit_sha": None,
        "github_repo": None,
        "created_at": datetime.now(timezone.utc),
        "updated_at": datetime.now(timezone.utc),
    }
    result = await builds_col().insert_one(build_doc)
    build_id = str(result.inserted_id)

    async def _stream():
        async for sse_event in _stream_events(initial_state, config):
            try:
                raw = sse_event
                if raw.startswith("data: "):
                    raw = raw[len("data: "):]
                raw = raw.strip()
                parsed = json.loads(raw)

                if parsed.get("phase") == "complete":
                    artifacts = parsed.get("artifacts", {})
                    generated_files = _artifacts_to_files(artifacts)
                    await builds_col().update_one(
                        {"_id": result.inserted_id},
                        {
                            "$set": {
                                "status": "complete",
                                "artifacts": artifacts,
                                "generated_files": generated_files,
                                "updated_at": datetime.now(timezone.utc),
                            }
                        },
                    )
                    await _write_artifacts_to_disk(project_id, artifacts)
                    await projects_col().update_one(
                        {"_id": ObjectId(project_id)},
                        {
                            "$set": {
                                "build_id": build_id,
                                "stage": "deploy",
                                "updated_at": datetime.now(timezone.utc),
                            }
                        },
                    )
                    parsed["build_id"] = build_id
                    yield f"data: {json.dumps(parsed)}\n\n"
                    continue

                elif parsed.get("phase") == "human_review_required":
                    await builds_col().update_one(
                        {"_id": result.inserted_id},
                        {
                            "$set": {
                                "status": "human_review",
                                "updated_at": datetime.now(timezone.utc),
                            }
                        },
                    )

                elif parsed.get("phase") == "error":
                    await builds_col().update_one(
                        {"_id": result.inserted_id},
                        {
                            "$set": {
                                "status": "error",
                                "updated_at": datetime.now(timezone.utc),
                            }
                        },
                    )

            except Exception as e:
                logger.exception("Error processing build SSE event")
                yield _sse({"phase": "error", "message": "Internal error during build processing"})
                return

            yield sse_event

    return StreamingResponse(
        _stream(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",
            "X-Build-ID": build_id,
        },
    )


@router.get("/status/{project_id}")
async def get_build_status(
    project_id: str,
    user=Depends(get_current_user),
) -> dict:
    project = await projects_col().find_one({"_id": ObjectId(project_id)})
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    if str(project["owner_id"]) != str(user["_id"]):
        raise HTTPException(status_code=403, detail="Forbidden")

    build_doc = await builds_col().find_one(
        {"project_id": ObjectId(project_id)},
        sort=[("created_at", -1)],
    )
    if not build_doc:
        raise HTTPException(status_code=404, detail="No build found for project")

    return serialize_doc(build_doc)


@router.post("/{project_id}/commit")
async def commit_build(
    project_id: str,
    body: BuildCommitRequest,
    user=Depends(get_current_user),
) -> dict:
    project = await projects_col().find_one({"_id": ObjectId(project_id)})
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    if str(project["owner_id"]) != str(user["_id"]):
        raise HTTPException(status_code=403, detail="Forbidden")

    if not user.get("github_token_encrypted"):
        raise HTTPException(
            status_code=400, detail="GitHub account not connected"
        )

    try:
        token = decrypt(user["github_token_encrypted"])
    except Exception:
        raise HTTPException(status_code=400, detail="Failed to decrypt GitHub token. Re-connect your GitHub account.")

    build_doc = await builds_col().find_one({"_id": ObjectId(body.build_id)})
    if not build_doc:
        raise HTTPException(status_code=404, detail="Build not found")

    if "/" not in body.repo:
        raise HTTPException(status_code=400, detail="repo must be 'owner/repo'")
    owner, repo = body.repo.split("/", 1)

    generated_files = build_doc.get("generated_files", [])
    files = [
        {"path": f["path"], "content": f["content"]}
        for f in generated_files
        if f.get("content")
    ]

    if not files:
        raise HTTPException(
            status_code=400, detail="No generated files to commit"
        )

    commit_sha = await commit_files(
        token,
        owner,
        repo,
        files,
        body.commit_message or "feat: add CloudForge scaffold",
        body.branch,
    )

    await builds_col().update_one(
        {"_id": ObjectId(body.build_id)},
        {
            "$set": {
                "github_commit_sha": commit_sha,
                "github_repo": body.repo,
                "updated_at": datetime.now(timezone.utc),
            }
        },
    )

    return {
        "commit_sha": commit_sha,
        "repo_url": f"https://github.com/{body.repo}",
        "files_committed": len(files),
    }


@router.get("/{project_id}/repos")
async def get_repos(
    project_id: str,
    user=Depends(get_current_user),
) -> list[dict]:
    project = await projects_col().find_one({"_id": ObjectId(project_id)})
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    if str(project["owner_id"]) != str(user["_id"]):
        raise HTTPException(status_code=403, detail="Forbidden")

    if not user.get("github_token_encrypted"):
        raise HTTPException(
            status_code=400, detail="GitHub account not connected"
        )

    try:
        token = decrypt(user["github_token_encrypted"])
    except Exception:
        raise HTTPException(status_code=400, detail="Failed to decrypt GitHub token. Re-connect your GitHub account.")
    return await list_repos(token)
