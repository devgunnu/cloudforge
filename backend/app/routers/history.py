from __future__ import annotations

import logging

from bson import ObjectId
from fastapi import APIRouter, Depends, Query

from app.core.dependencies import get_current_user
from app.db.mongo import builds_col, deployments_col, prd_conversations_col
from app.utils.serialization import serialize_doc

router = APIRouter(prefix="/history", tags=["history"])
logger = logging.getLogger(__name__)


@router.get("/builds")
async def list_user_builds(
    limit: int = Query(default=20, ge=1, le=100),
    user=Depends(get_current_user),
) -> list[dict]:
    pipeline = [
        {
            "$lookup": {
                "from": "projects",
                "localField": "project_id",
                "foreignField": "_id",
                "as": "project",
            }
        },
        {"$unwind": "$project"},
        {
            "$match": {
                "project.owner_id": user["_id"],
            }
        },
        {"$sort": {"created_at": -1}},
        {"$limit": limit},
        {
            "$project": {
                "_id": 0,
                "id": {"$toString": "$_id"},
                "project_id": {"$toString": "$project_id"},
                "project_name": "$project.name",
                "status": 1,
                "created_at": 1,
                "artifacts_count": {
                    "$cond": {
                        "if": {"$isArray": {"$objectToArray": {"$ifNull": ["$artifacts", {}]}}},
                        "then": {"$size": {"$objectToArray": {"$ifNull": ["$artifacts", {}]}}},
                        "else": 0,
                    }
                },
                "generated_files_count": {
                    "$cond": {
                        "if": {"$isArray": "$generated_files"},
                        "then": {"$size": "$generated_files"},
                        "else": 0,
                    }
                },
            }
        },
    ]

    docs = await builds_col().aggregate(pipeline).to_list(length=limit)
    return [serialize_doc(doc) for doc in docs]


@router.get("/deployments")
async def list_user_deployments(
    limit: int = Query(default=20, ge=1, le=100),
    user=Depends(get_current_user),
) -> list[dict]:
    pipeline = [
        {
            "$lookup": {
                "from": "projects",
                "localField": "project_id",
                "foreignField": "_id",
                "as": "project",
            }
        },
        {"$unwind": "$project"},
        {
            "$match": {
                "project.owner_id": user["_id"],
            }
        },
        {"$sort": {"created_at": -1}},
        {"$limit": limit},
        {
            "$project": {
                "_id": 0,
                "id": {"$toString": "$_id"},
                "project_id": {"$toString": "$project_id"},
                "project_name": "$project.name",
                "status": 1,
                "provider": 1,
                "region": 1,
                "created_at": 1,
            }
        },
    ]

    docs = await deployments_col().aggregate(pipeline).to_list(length=limit)
    return [serialize_doc(doc) for doc in docs]


@router.get("/prd")
async def list_user_prd_sessions(
    limit: int = Query(default=20, ge=1, le=100),
    user=Depends(get_current_user),
) -> list[dict]:
    pipeline = [
        {
            "$lookup": {
                "from": "projects",
                "localField": "project_id",
                "foreignField": "_id",
                "as": "project",
            }
        },
        {"$unwind": "$project"},
        {
            "$match": {
                "project.owner_id": user["_id"],
            }
        },
        {"$sort": {"created_at": -1}},
        {"$limit": limit},
        {
            "$project": {
                "_id": 0,
                "id": {"$toString": "$_id"},
                "project_id": {"$toString": "$project_id"},
                "project_name": "$project.name",
                "session_id": 1,
                "status": 1,
                "created_at": 1,
            }
        },
    ]

    docs = await prd_conversations_col().aggregate(pipeline).to_list(length=limit)
    return [serialize_doc(doc) for doc in docs]
