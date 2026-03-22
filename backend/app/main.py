from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import settings
from app.routers import health, workflows, auth


@asynccontextmanager
async def lifespan(app: FastAPI):
    if settings.mongodb_url:
        from app.db.mongo import connect_mongo, disconnect_mongo
        await connect_mongo()
        yield
        await disconnect_mongo()
    else:
        yield


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
app.include_router(auth.router)


@app.get("/")
def root():
    return {"message": f"Welcome to {settings.app_name}"}
