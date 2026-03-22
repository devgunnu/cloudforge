from __future__ import annotations
from abc import ABC, abstractmethod
from typing import Callable, Awaitable, Any


class CloudProvider(ABC):
    @abstractmethod
    async def verify_credentials(self) -> bool:
        """Return True if credentials are valid, raise ValueError on failure."""
        ...

    @abstractmethod
    async def deploy(
        self,
        stack_name: str,
        template_body: str,
        parameters: dict[str, str],
        on_event: Callable[[dict], Awaitable[None]],
    ) -> dict[str, Any]:
        """Deploy resources. Call on_event for each status update. Returns stack outputs."""
        ...

    @abstractmethod
    async def rollback(self, stack_name: str) -> None:
        """Delete/rollback the named stack."""
        ...

    @classmethod
    @abstractmethod
    def from_credentials(cls, credentials: dict) -> "CloudProvider":
        """Construct from a credentials dict (decrypted from DB)."""
        ...
