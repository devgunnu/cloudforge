from datetime import datetime
from typing import Optional

from pydantic import BaseModel, Field


class ProjectCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=255)
    description: Optional[str] = Field(None, max_length=2000)
    region: Optional[str] = Field(None, max_length=50)
    cloud_provider: Optional[str] = Field(None, max_length=20)


class ProjectUpdate(BaseModel):
    name: Optional[str] = Field(None, min_length=1, max_length=255)
    description: Optional[str] = Field(None, max_length=2000)
    github_repo: Optional[str] = Field(None, max_length=200)


class CloudCredentials(BaseModel):
    provider: str
    role_arn: str
    region: str


class ProjectResponse(BaseModel):
    id: str
    owner_id: str
    name: str
    description: Optional[str] = None
    status: str
    stage: str
    region: Optional[str] = None
    cloud_provider: Optional[str] = None
    prd_session_id: Optional[str] = None
    arch_session_id: Optional[str] = None
    build_id: Optional[str] = None
    deployment_id: Optional[str] = None
    github_repo: Optional[str] = None
    github_connected: bool = False
    cloud_verified: bool = False
    created_at: datetime
    updated_at: datetime
