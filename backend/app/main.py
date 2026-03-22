from fastapi import FastAPI
from app.config import settings
from app.routers import agent3, health, workflows
from app.routers.architecture import router as architecture_router

app = FastAPI(
    title=settings.app_name,
    debug=settings.debug,
)

app.include_router(health.router)
app.include_router(workflows.router)
app.include_router(architecture_router)
app.include_router(agent3.router)


@app.get("/")
def root():
    return {"message": f"Welcome to {settings.app_name}"}
