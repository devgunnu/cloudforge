import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import settings
from app.db.mongo import connect_mongo, disconnect_mongo
from app.routers import agent3, auth, health, projects, workflows
from app.routers.architecture import router as architecture_router
from app.routers.architecture_sse import router as architecture_sse_router
from app.routers.build import router as build_router
from app.routers.deploy import router as deploy_router
from app.routers.prd import router as prd_router

logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    await connect_mongo()
    logger.info("MongoDB connected")

    try:
        from app.agents.architecture_planner.kg_traversal_agent import init_kuzu

        app.state.kuzu_conn = init_kuzu(
            graph_json_path=settings.graph_json_path,
            db_path=settings.kuzu_db_path,
        )
        logger.info("Kuzu loaded")
    except Exception as exc:
        logger.warning("Kuzu init failed: %s", exc)
        app.state.kuzu_conn = None

    yield

    await disconnect_mongo()
    logger.info("MongoDB disconnected")


app = FastAPI(
    title=settings.app_name,
    debug=settings.debug,
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[settings.frontend_url],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(health.router)
app.include_router(auth.router)
app.include_router(projects.router)
app.include_router(workflows.router)
app.include_router(architecture_router)
app.include_router(architecture_sse_router)
app.include_router(agent3.router)
app.include_router(prd_router)
app.include_router(build_router)
app.include_router(deploy_router)


@app.get("/")
def root():
    return {"message": f"Welcome to {settings.app_name}"}
