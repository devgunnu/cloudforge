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


def waitlist_col():
    return get_db()["waitlist"]


async def ensure_indexes() -> None:
    """Create all required indexes. Safe to call on every startup (no-op if already exist)."""
    await users_col().create_index("email", unique=True, background=True)
    await users_col().create_index("username", unique=True, background=True)
    await projects_col().create_index("owner_id", background=True)
    await prd_conversations_col().create_index("session_id", unique=True, background=True)
    await prd_conversations_col().create_index("project_id", background=True)
    await architectures_col().create_index(
        [("project_id", 1), ("created_at", -1)], background=True
    )
    await architectures_col().create_index("session_id", unique=True, background=True)
    await builds_col().create_index(
        [("project_id", 1), ("created_at", -1)], background=True
    )
    await builds_col().create_index(
        [("project_id", 1), ("status", 1)], background=True
    )
    await deployments_col().create_index(
        [("project_id", 1), ("created_at", -1)], background=True
    )
    await waitlist_col().create_index("email", unique=True, background=True)


async def connect_mongo() -> None:
    global _client
    _client = AsyncIOMotorClient(settings.mongodb_url)
    await _client.admin.command("ping")
    await ensure_indexes()


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
