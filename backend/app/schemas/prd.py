from __future__ import annotations

from pydantic import BaseModel


class PrdStartRequest(BaseModel):
    prd_text: str
    cloud_provider: str = "aws"


class PrdRespondRequest(BaseModel):
    message: str


class ConstraintChip(BaseModel):
    id: str
    label: str
    category: str  # "performance" | "security" | "cost" | "reliability"
