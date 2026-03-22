"""
Deployment state manager.

In-memory state tracking for deployments with async event streaming.
In production, swap with Redis or a database backend.
"""

import asyncio
import logging
from datetime import datetime, timezone
from enum import Enum
from typing import Any, AsyncGenerator

logger = logging.getLogger(__name__)


class DeploymentStatus(str, Enum):
    """Deployment lifecycle states."""
    PENDING = "pending"
    GENERATING = "generating"
    INITIALIZING = "initializing"
    PLANNING = "planning"
    APPLYING = "applying"
    COMPLETE = "complete"
    FAILED = "failed"
    CANCELLED = "cancelled"
    ROLLED_BACK = "rolled_back"


class DeploymentStateManager:
    """
    In-memory deployment state manager with event streaming.

    Each deployment has:
    - Status and metadata
    - Node-level provisioning status
    - An asyncio.Queue for event streaming
    - Generated terraform files
    - Terraform outputs (after apply)
    """

    def __init__(self):
        self._deployments: dict[str, dict[str, Any]] = {}
        self._queues: dict[str, list[asyncio.Queue]] = {}
        self._events: dict[str, list[Any]] = {}

    async def create_deployment(
        self,
        deployment_id: str,
        project_name: str,
        region: str,
        environment: str,
        architecture_data: dict[str, Any],
        is_rollback: bool = False,
        parent_deployment_id: str | None = None,
    ) -> dict[str, Any]:
        """Create a new deployment record."""
        deployment = {
            "deployment_id": deployment_id,
            "project_name": project_name,
            "region": region,
            "environment": environment,
            "architecture_data": architecture_data,
            "status": DeploymentStatus.PENDING,
            "node_statuses": {},
            "workspace_dir": None,
            "terraform_files": [],
            "outputs": {},
            "is_rollback": is_rollback,
            "parent_deployment_id": parent_deployment_id,
            "created_at": datetime.now(timezone.utc).isoformat(),
            "updated_at": datetime.now(timezone.utc).isoformat(),
        }
        self._deployments[deployment_id] = deployment
        self._queues[deployment_id] = []
        self._events[deployment_id] = []
        return deployment

    async def get_deployment(self, deployment_id: str) -> dict[str, Any] | None:
        """Get deployment by ID."""
        return self._deployments.get(deployment_id)

    async def list_deployments(self) -> list[dict[str, Any]]:
        """List all deployments (summary view)."""
        return [
            {
                "deployment_id": d["deployment_id"],
                "project_name": d["project_name"],
                "status": d["status"],
                "region": d["region"],
                "environment": d["environment"],
                "is_rollback": d["is_rollback"],
                "created_at": d["created_at"],
            }
            for d in self._deployments.values()
        ]

    async def update_status(
        self, deployment_id: str, status: DeploymentStatus
    ) -> None:
        """Update deployment status."""
        if deployment_id in self._deployments:
            self._deployments[deployment_id]["status"] = status
            self._deployments[deployment_id]["updated_at"] = (
                datetime.now(timezone.utc).isoformat()
            )

    async def set_node_status(
        self, deployment_id: str, node_id: str, status: str
    ) -> None:
        """Update a specific node's deployment status."""
        if deployment_id in self._deployments:
            self._deployments[deployment_id]["node_statuses"][node_id] = status

    async def set_workspace(self, deployment_id: str, workspace_dir: str) -> None:
        """Set the workspace directory for a deployment."""
        if deployment_id in self._deployments:
            self._deployments[deployment_id]["workspace_dir"] = workspace_dir

    async def store_terraform_files(
        self, deployment_id: str, files: list[dict]
    ) -> None:
        """Store generated Terraform files."""
        if deployment_id in self._deployments:
            self._deployments[deployment_id]["terraform_files"] = files

    async def store_outputs(
        self, deployment_id: str, outputs: dict[str, Any]
    ) -> None:
        """Store Terraform outputs after apply."""
        if deployment_id in self._deployments:
            self._deployments[deployment_id]["outputs"] = outputs

    async def emit(self, deployment_id: str, event: Any) -> None:
        """Emit an event to all subscribers of a deployment."""
        # Store event for replay
        if deployment_id in self._events:
            self._events[deployment_id].append(event)

        # Push to all active subscriber queues
        queues = self._queues.get(deployment_id, [])
        for queue in queues:
            try:
                queue.put_nowait(event)
            except asyncio.QueueFull:
                logger.warning(
                    "Event queue full for deployment %s, dropping event",
                    deployment_id,
                )

    async def subscribe(
        self, deployment_id: str, replay: bool = True
    ) -> AsyncGenerator[Any, None]:
        """
        Subscribe to deployment events.

        If replay=True, first yields all past events, then streams new ones.
        Yields a sentinel None when the deployment is terminal.
        """
        queue: asyncio.Queue = asyncio.Queue(maxsize=1000)

        # Register subscriber
        if deployment_id not in self._queues:
            self._queues[deployment_id] = []
        self._queues[deployment_id].append(queue)

        try:
            # Replay past events
            if replay and deployment_id in self._events:
                for event in self._events[deployment_id]:
                    yield event

            # Stream new events
            while True:
                try:
                    event = await asyncio.wait_for(queue.get(), timeout=30.0)
                    yield event

                    # Check if this is a terminal event
                    if hasattr(event, "event_type"):
                        from app.services.deploy_orchestrator import DeployEventType
                        if event.event_type in (
                            DeployEventType.COMPLETE,
                            DeployEventType.ERROR,
                        ):
                            # Check if the deployment is in a terminal state
                            deployment = self._deployments.get(deployment_id)
                            if deployment and deployment["status"] in (
                                DeploymentStatus.COMPLETE,
                                DeploymentStatus.FAILED,
                                DeploymentStatus.CANCELLED,
                                DeploymentStatus.ROLLED_BACK,
                            ):
                                return

                except asyncio.TimeoutError:
                    # Send keepalive — check if deployment is still active
                    deployment = self._deployments.get(deployment_id)
                    if not deployment:
                        return
                    if deployment["status"] in (
                        DeploymentStatus.COMPLETE,
                        DeploymentStatus.FAILED,
                        DeploymentStatus.CANCELLED,
                        DeploymentStatus.ROLLED_BACK,
                    ):
                        return
                    # Yield a keepalive comment (SSE comment)
                    continue

        finally:
            # Unsubscribe
            queues = self._queues.get(deployment_id, [])
            if queue in queues:
                queues.remove(queue)

    async def get_events(self, deployment_id: str) -> list[Any]:
        """Get all stored events for a deployment."""
        return self._events.get(deployment_id, [])

    async def cleanup(self, deployment_id: str) -> None:
        """Clean up deployment state (call after TTL or manual cleanup)."""
        self._deployments.pop(deployment_id, None)
        self._queues.pop(deployment_id, None)
        self._events.pop(deployment_id, None)
