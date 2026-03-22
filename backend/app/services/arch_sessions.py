from __future__ import annotations

from threading import Lock
from typing import Any, Literal
from uuid import uuid4


ArchStatus = Literal["needs_clarification", "review_ready", "accepted", "error"]


class ArchSessionStore:
    """In-memory store that tracks Architecture Planner (Agent 2) sessions.

    Each session record holds:
    - arch_session_id  : unique session identifier (also used as thread_id for
                         the LangGraph MemorySaver so checkpoints are isolated)
    - prd_session_id   : reference to the originating Agent 1 session
    - status           : current lifecycle state
    - interrupt_type   : "questions" | "review" | None  (last interrupt kind)
    - interrupt_payload: raw value passed to interrupt()
    """

    def __init__(self) -> None:
        self._items: dict[str, dict[str, Any]] = {}
        self._lock = Lock()

    def create(self, prd_session_id: str) -> str:
        """Allocate a new session; returns the arch_session_id (= thread_id)."""
        arch_session_id = str(uuid4())
        with self._lock:
            self._items[arch_session_id] = {
                "arch_session_id": arch_session_id,
                "prd_session_id": prd_session_id,
                "thread_id": arch_session_id,
                "status": "running",
                "interrupt_type": None,
                "interrupt_payload": None,
            }
        return arch_session_id

    def get(self, arch_session_id: str) -> dict[str, Any] | None:
        with self._lock:
            item = self._items.get(arch_session_id)
            return dict(item) if item else None

    def update(self, arch_session_id: str, **kwargs: Any) -> None:
        with self._lock:
            if arch_session_id in self._items:
                self._items[arch_session_id].update(kwargs)


arch_session_store = ArchSessionStore()
