import json
from datetime import datetime, timezone

from bson import ObjectId
from fastapi import APIRouter, Depends, HTTPException, status

from app.core.dependencies import get_current_user
from app.db.encryption import encrypt
from app.db.mongo import (
    architectures_col,
    builds_col,
    deployments_col,
    projects_col,
    prd_conversations_col,
)
from app.schemas.project import CloudCredentials, ProjectCreate, ProjectResponse, ProjectUpdate

router = APIRouter(prefix="/projects", tags=["projects"])


def _doc_to_response(doc: dict) -> ProjectResponse:
    return ProjectResponse(
        id=str(doc["_id"]),
        owner_id=str(doc["owner_id"]),
        name=doc["name"],
        description=doc.get("description"),
        status=doc["status"],
        stage=doc["stage"],
        region=doc.get("region"),
        cloud_provider=doc.get("cloud_provider"),
        prd_session_id=doc.get("prd_session_id"),
        arch_session_id=doc.get("arch_session_id"),
        build_id=doc.get("build_id"),
        deployment_id=doc.get("deployment_id"),
        github_repo=doc.get("github_repo"),
        github_connected=bool(doc.get("github_repo")),
        cloud_verified=bool(doc.get("cloud_credentials_encrypted")),
        created_at=doc["created_at"],
        updated_at=doc["updated_at"],
    )


async def _get_owned_project(project_id: str, user: dict) -> dict:
    try:
        oid = ObjectId(project_id)
    except Exception:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Project not found")

    project = await projects_col().find_one({"_id": oid})
    if project is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Project not found")
    if project.get("owner_id") != ObjectId(str(user["_id"])):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You do not have permission to access this project",
        )
    return project


@router.post("/", response_model=ProjectResponse, status_code=status.HTTP_201_CREATED)
async def create_project(
    body: ProjectCreate,
    user: dict = Depends(get_current_user),
) -> ProjectResponse:
    now = datetime.now(timezone.utc)
    doc = {
        "owner_id": ObjectId(str(user["_id"])),
        "name": body.name,
        "description": body.description,
        "region": body.region,
        "cloud_provider": body.cloud_provider,
        "status": "draft",
        "stage": "prd",
        "prd_session_id": None,
        "arch_session_id": None,
        "build_id": None,
        "deployment_id": None,
        "github_repo": None,
        "cloud_credentials_encrypted": None,
        "cloud_provider_type": None,
        "created_at": now,
        "updated_at": now,
    }
    result = await projects_col().insert_one(doc)
    created = await projects_col().find_one({"_id": result.inserted_id})
    return _doc_to_response(created)


@router.get("/", response_model=list[ProjectResponse])
async def list_projects(
    user: dict = Depends(get_current_user),
) -> list[ProjectResponse]:
    cursor = projects_col().find({"owner_id": ObjectId(str(user["_id"]))})
    docs = await cursor.to_list(length=None)
    return [_doc_to_response(doc) for doc in docs]


@router.get("/{project_id}", response_model=ProjectResponse)
async def get_project(
    project_id: str,
    user: dict = Depends(get_current_user),
) -> ProjectResponse:
    project = await _get_owned_project(project_id, user)
    return _doc_to_response(project)


@router.patch("/{project_id}", response_model=ProjectResponse)
async def update_project(
    project_id: str,
    body: ProjectUpdate,
    user: dict = Depends(get_current_user),
) -> ProjectResponse:
    await _get_owned_project(project_id, user)

    updates: dict = {k: v for k, v in body.model_dump().items() if v is not None}
    updates["updated_at"] = datetime.now(timezone.utc)

    await projects_col().update_one(
        {"_id": ObjectId(project_id)},
        {"$set": updates},
    )
    updated = await projects_col().find_one({"_id": ObjectId(project_id)})
    return _doc_to_response(updated)


@router.delete("/{project_id}")
async def delete_project(
    project_id: str,
    user: dict = Depends(get_current_user),
) -> dict:
    await _get_owned_project(project_id, user)

    oid = ObjectId(project_id)
    await projects_col().delete_one({"_id": oid})
    await prd_conversations_col().delete_many({"project_id": oid})
    await architectures_col().delete_many({"project_id": oid})
    await builds_col().delete_many({"project_id": oid})
    await deployments_col().delete_many({"project_id": oid})

    return {"deleted": True}


@router.post("/{project_id}/credentials")
async def set_cloud_credentials(
    project_id: str,
    body: CloudCredentials,
    user: dict = Depends(get_current_user),
) -> dict:
    await _get_owned_project(project_id, user)

    payload = json.dumps(
        {"provider": body.provider, "role_arn": body.role_arn, "region": body.region}
    )
    encrypted = encrypt(payload)
    now = datetime.now(timezone.utc)

    await projects_col().update_one(
        {"_id": ObjectId(project_id)},
        {
            "$set": {
                "cloud_credentials_encrypted": encrypted,
                "cloud_provider_type": body.provider,
                "updated_at": now,
            }
        },
    )

    return {"cloud_verified": False}
