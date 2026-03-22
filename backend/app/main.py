from fastapi import FastAPI
from app.config import settings
from app.routers import agent3, health, workflows

app = FastAPI(
    title=settings.app_name,
    debug=settings.debug,
)

app.include_router(health.router)
app.include_router(agent3.router)
app.include_router(workflows.router)


@app.get("/")
def root():
    return {"message": f"Welcome to {settings.app_name}"}
