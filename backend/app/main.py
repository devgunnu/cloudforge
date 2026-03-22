from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.config import settings
from app.routers import health, workflows, deploy

app = FastAPI(
    title=settings.app_name,
    debug=settings.debug,
)

# CORS — allow the Next.js frontend to reach the API
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(health.router)
app.include_router(workflows.router)
app.include_router(deploy.router)


@app.get("/")
def root():
    return {"message": f"Welcome to {settings.app_name}"}
