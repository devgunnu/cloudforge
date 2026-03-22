from __future__ import annotations

from typing import Any
from threading import Lock
from uuid import uuid4


class WorkflowSessionStore:
    def __init__(self) -> None:
        self._items: dict[str, dict[str, Any]] = {}
        self._lock = Lock()

    def create(self, initial_state: dict[str, Any]) -> dict[str, Any]:
        with self._lock:
            session_id = str(uuid4())
            state = dict(initial_state)
            state["session_id"] = session_id
            self._items[session_id] = state
            return state

    def get(self, session_id: str) -> dict[str, Any] | None:
        with self._lock:
            state = self._items.get(session_id)
            return dict(state) if state else None

    def save(self, state: dict[str, Any]) -> dict[str, Any]:
        session_id = state["session_id"]
        with self._lock:
            self._items[session_id] = dict(state)
            return state


session_store = WorkflowSessionStore()
