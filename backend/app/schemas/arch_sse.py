from __future__ import annotations

from typing import Optional

from pydantic import BaseModel


class ArchSSEStartRequest(BaseModel):
    budget: Optional[str] = None
    traffic: Optional[str] = None
    availability: Optional[str] = None


class ArchSSERespondRequest(BaseModel):
    answers: list[str]


class ArchSSEReviewRequest(BaseModel):
    accepted: bool
    changes: Optional[str] = None
