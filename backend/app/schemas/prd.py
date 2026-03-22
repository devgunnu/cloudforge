from __future__ import annotations

from pydantic import BaseModel, Field


class PrdStartRequest(BaseModel):
    prd_text: str = Field(..., min_length=10, max_length=50_000)
    cloud_provider: str = Field("aws", max_length=20)


class PrdRespondRequest(BaseModel):
    message: str


class ConstraintChip(BaseModel):
    id: str
    label: str
    category: str  # "performance" | "security" | "cost" | "reliability"
