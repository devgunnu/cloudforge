from contextlib import asynccontextmanager

from motor.motor_asyncio import AsyncIOMotorClient, AsyncIOMotorDatabase

from app.config import settings

_client: AsyncIOMotorClient | None = None


def get_client() -> AsyncIOMotorClient:
    if _client is None:
        raise RuntimeError("MongoDB client is not initialized. Call connect_mongo() first.")
    return _client


def get_db() -> AsyncIOMotorDatabase:
    return get_client()[settings.mongodb_db_name]


def users_col():
    return get_db()["users"]


def projects_col():
    return get_db()["projects"]


def prd_conversations_col():
    return get_db()["prd_conversations"]


def architectures_col():
    return get_db()["architectures"]


def builds_col():
    return get_db()["builds"]


def deployments_col():
    return get_db()["deployments"]


async def connect_mongo() -> None:
    global _client
    _client = AsyncIOMotorClient(settings.mongodb_url)
    await _client.admin.command("ping")


async def disconnect_mongo() -> None:
    global _client
    if _client is not None:
        _client.close()
        _client = None


@asynccontextmanager
async def mongo_lifespan():
    await connect_mongo()
    try:
        yield
    finally:
        await disconnect_mongo()
