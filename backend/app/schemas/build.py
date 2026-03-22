from __future__ import annotations

from typing import Optional

from pydantic import BaseModel


class BuildCommitRequest(BaseModel):
    build_id: str
    repo: str  # "owner/repo"
    branch: Optional[str] = None
    commit_message: Optional[str] = "feat: add CloudForge scaffold"
