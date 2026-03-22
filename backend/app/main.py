from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import settings

from app.db.mongo import connect_mongo, disconnect_mongo
from app.routers import agent3, auth, health, projects, workflows
from app.routers.architecture import router as architecture_router
from app.routers.architecture_sse import router as architecture_sse_router
from app.routers.validate import router as validate_router
from app.routers.build import router as build_router
from app.routers.deploy import router as deploy_router
from app.routers.files import router as files_router
from app.routers.history import router as history_router
from app.routers.prd import router as prd_router

logger = logging.getLogger(__name__)

limiter = Limiter(key_func=get_remote_address)
from app.routers import auth


@asynccontextmanager
async def lifespan(app: FastAPI):
    await connect_mongo()
    logger.info("MongoDB connected")

    # Validate critical secrets — fail fast rather than serve broken crypto
    if not settings.jwt_secret_key or settings.jwt_secret_key == "changeme":
        raise RuntimeError(
            "JWT_SECRET_KEY is not set or is using the insecure default. "
            "Set a strong secret in your .env file."
        )
    if not settings.fernet_key:
        raise RuntimeError(
            "FERNET_KEY is not set. "
            "Generate one with: python -c \"from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())\""
        )
    try:
        from cryptography.fernet import Fernet
        Fernet(settings.fernet_key.encode())
    except Exception as exc:
        raise RuntimeError(f"FERNET_KEY is invalid: {exc}") from exc

    yield

    await disconnect_mongo()
    logger.info("MongoDB disconnected")


app = FastAPI(
    title=settings.app_name,
    debug=settings.debug,
    lifespan=lifespan,
)

# CORS configuration
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],  # Frontend URL
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(health.router)
app.include_router(workflows.router)
app.include_router(architecture_router)
app.include_router(architecture_sse_router)
app.include_router(validate_router)
app.include_router(agent3.router)
app.include_router(prd_router)
app.include_router(build_router)
app.include_router(deploy_router)
app.include_router(files_router)
app.include_router(history_router)
app.include_router(auth.router)


@app.get("/")
def root():
    return {"message": f"Welcome to {settings.app_name}"}
