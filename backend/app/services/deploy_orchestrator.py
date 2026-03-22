"""
Deployment orchestrator service.

Manages the full lifecycle of an infrastructure deployment:
1. Generate Terraform from architecture spec
2. Write files to a workspace directory
3. Run terraform init → plan → apply
4. Stream progress events back to the caller
5. Track resource provisioning status
"""

import asyncio
import json
import logging
import os
import shutil
import subprocess
import tempfile
import uuid
from datetime import datetime, timezone
from enum import Enum
from pathlib import Path
from typing import Any, AsyncGenerator

from app.services.terraform_generator import TerraformGenerator
from app.services.deploy_state import DeploymentStateManager, DeploymentStatus

logger = logging.getLogger(__name__)


class DeployEventType(str, Enum):
    """Types of events emitted during deployment."""
    LOG = "log"
    NODE_STATUS = "node_status"
    STAGE_CHANGE = "stage_change"
    TERRAFORM_OUTPUT = "terraform_output"
    ERROR = "error"
    COMPLETE = "complete"


class DeployEvent:
    """A single event in the deployment stream."""

    def __init__(
        self,
        event_type: DeployEventType,
        message: str,
        data: dict[str, Any] | None = None,
    ):
        self.event_type = event_type
        self.message = message
        self.data = data or {}
        self.timestamp = datetime.now(timezone.utc).isoformat()

    def to_sse(self) -> str:
        """Format as Server-Sent Event."""
        payload = {
            "type": self.event_type.value,
            "message": self.message,
            "data": self.data,
            "timestamp": self.timestamp,
        }
        return f"data: {json.dumps(payload)}\n\n"


class DeploymentOrchestrator:
    """
    Orchestrates the full deployment pipeline.

    Usage:
        orchestrator = DeploymentOrchestrator()
        deployment_id = await orchestrator.start_deployment(arch_data, project_name)
        async for event in orchestrator.stream_events(deployment_id):
            # Send to client via SSE
            yield event.to_sse()
    """

    def __init__(self):
        self.terraform_generator = TerraformGenerator()
        self.state_manager = DeploymentStateManager()
        self._active_deployments: dict[str, asyncio.Task] = {}

    async def start_deployment(
        self,
        architecture_data: dict[str, Any],
        project_name: str = "cloudforge-project",
        region: str = "us-east-1",
        environment: str = "prod",
        aws_credentials: dict[str, str] | None = None,
    ) -> str:
        """
        Initialize and start a new deployment.

        Returns the deployment_id for tracking.
        """
        deployment_id = f"dep_{uuid.uuid4().hex[:12]}"

        # Create deployment record
        await self.state_manager.create_deployment(
            deployment_id=deployment_id,
            project_name=project_name,
            region=region,
            environment=environment,
            architecture_data=architecture_data,
        )

        # Extract node IDs for status tracking
        nodes = architecture_data.get("nodes", [])
        for node in nodes:
            await self.state_manager.set_node_status(
                deployment_id, node["id"], "queued"
            )

        # Start the deployment pipeline as a background task
        task = asyncio.create_task(
            self._run_pipeline(
                deployment_id,
                architecture_data,
                project_name,
                region,
                environment,
                aws_credentials,
            )
        )
        self._active_deployments[deployment_id] = task

        return deployment_id

    async def stream_events(
        self, deployment_id: str
    ) -> AsyncGenerator[DeployEvent, None]:
        """Stream deployment events as they occur."""
        async for event in self.state_manager.subscribe(deployment_id):
            yield event

    async def get_deployment_status(self, deployment_id: str) -> dict[str, Any]:
        """Get current deployment status."""
        return await self.state_manager.get_deployment(deployment_id)

    async def cancel_deployment(self, deployment_id: str) -> bool:
        """Cancel a running deployment."""
        task = self._active_deployments.get(deployment_id)
        if task and not task.done():
            task.cancel()
            await self.state_manager.update_status(
                deployment_id, DeploymentStatus.CANCELLED
            )
            await self.state_manager.emit(
                deployment_id,
                DeployEvent(
                    DeployEventType.LOG,
                    "Deployment cancelled by user",
                ),
            )
            return True
        return False

    async def rollback_deployment(self, deployment_id: str) -> str:
        """
        Rollback a completed or failed deployment using terraform destroy.
        Returns a new deployment_id for the rollback operation.
        """
        deployment = await self.state_manager.get_deployment(deployment_id)
        if not deployment:
            raise ValueError(f"Deployment {deployment_id} not found")

        rollback_id = f"rb_{uuid.uuid4().hex[:12]}"
        workspace = deployment.get("workspace_dir")

        if not workspace or not Path(workspace).exists():
            raise ValueError("Workspace not found — cannot rollback")

        await self.state_manager.create_deployment(
            deployment_id=rollback_id,
            project_name=deployment["project_name"],
            region=deployment["region"],
            environment=deployment["environment"],
            architecture_data=deployment["architecture_data"],
            is_rollback=True,
            parent_deployment_id=deployment_id,
        )

        task = asyncio.create_task(
            self._run_rollback(rollback_id, workspace, deployment_id)
        )
        self._active_deployments[rollback_id] = task

        return rollback_id

    # ── Pipeline stages ───────────────────────────────────────────────

    async def _run_pipeline(
        self,
        deployment_id: str,
        architecture_data: dict[str, Any],
        project_name: str,
        region: str,
        environment: str,
        aws_credentials: dict[str, str] | None,
    ) -> None:
        """Execute the full deployment pipeline."""
        workspace = None
        try:
            # Stage 1: Generate Terraform
            await self._emit(deployment_id, DeployEventType.STAGE_CHANGE, "Generating Terraform", {"stage": "generate"})
            await self._emit(deployment_id, DeployEventType.LOG, "Generating Terraform HCL from architecture spec...")
            await self.state_manager.update_status(deployment_id, DeploymentStatus.GENERATING)

            tf_result = await self.terraform_generator.generate(
                architecture_data, project_name, region, environment
            )

            if not tf_result.get("files"):
                await self._emit(deployment_id, DeployEventType.ERROR, "No Terraform files generated")
                await self.state_manager.update_status(deployment_id, DeploymentStatus.FAILED)
                return

            for warning in tf_result.get("warnings", []):
                await self._emit(deployment_id, DeployEventType.LOG, f"Warning: {warning}")

            await self._emit(
                deployment_id,
                DeployEventType.LOG,
                f"Generated {len(tf_result['files'])} Terraform files ({tf_result.get('estimated_resources', 0)} resources)",
            )

            # Stage 2: Write to workspace
            await self._emit(deployment_id, DeployEventType.STAGE_CHANGE, "Preparing workspace", {"stage": "workspace"})
            workspace = self._create_workspace(deployment_id, tf_result["files"])
            await self.state_manager.set_workspace(deployment_id, workspace)
            await self._emit(deployment_id, DeployEventType.LOG, f"Workspace ready: {Path(workspace).name}")

            # Store generated terraform for reference
            await self.state_manager.store_terraform_files(deployment_id, tf_result["files"])

            # Stage 3: Terraform init
            await self._emit(deployment_id, DeployEventType.STAGE_CHANGE, "Initializing Terraform", {"stage": "init"})
            await self.state_manager.update_status(deployment_id, DeploymentStatus.INITIALIZING)
            await self._emit(deployment_id, DeployEventType.LOG, "Running terraform init...")

            init_ok = await self._run_terraform_command(
                deployment_id, workspace, ["init", "-no-color", "-input=false"],
                aws_credentials,
            )
            if not init_ok:
                await self.state_manager.update_status(deployment_id, DeploymentStatus.FAILED)
                return

            await self._emit(deployment_id, DeployEventType.LOG, "Terraform initialized successfully")

            # Stage 4: Terraform plan
            await self._emit(deployment_id, DeployEventType.STAGE_CHANGE, "Planning infrastructure", {"stage": "plan"})
            await self.state_manager.update_status(deployment_id, DeploymentStatus.PLANNING)
            await self._emit(deployment_id, DeployEventType.LOG, "Running terraform plan...")

            plan_ok = await self._run_terraform_command(
                deployment_id,
                workspace,
                ["plan", "-no-color", "-input=false", "-out=tfplan"],
                aws_credentials,
            )
            if not plan_ok:
                await self.state_manager.update_status(deployment_id, DeploymentStatus.FAILED)
                return

            await self._emit(deployment_id, DeployEventType.LOG, "Terraform plan complete — reviewing changes")

            # Stage 5: Terraform apply
            await self._emit(deployment_id, DeployEventType.STAGE_CHANGE, "Provisioning infrastructure", {"stage": "apply"})
            await self.state_manager.update_status(deployment_id, DeploymentStatus.APPLYING)

            nodes = architecture_data.get("nodes", [])

            # Update node statuses to provisioning as apply starts
            for node in nodes:
                await self._emit(
                    deployment_id,
                    DeployEventType.NODE_STATUS,
                    f"Provisioning {node['label']}...",
                    {"nodeId": node["id"], "status": "provisioning"},
                )
                await self.state_manager.set_node_status(
                    deployment_id, node["id"], "provisioning"
                )
                await self._emit(
                    deployment_id,
                    DeployEventType.LOG,
                    f"Provisioning {node['label']} ({node.get('terraformResource', 'unknown')})...",
                )
                # Small delay between nodes for realistic streaming
                await asyncio.sleep(0.3)

            apply_ok = await self._run_terraform_command(
                deployment_id,
                workspace,
                ["apply", "-no-color", "-input=false", "-auto-approve", "tfplan"],
                aws_credentials,
            )

            if apply_ok:
                # Mark all nodes as live
                for node in nodes:
                    await self._emit(
                        deployment_id,
                        DeployEventType.NODE_STATUS,
                        f"{node['label']} is live",
                        {"nodeId": node["id"], "status": "live"},
                    )
                    await self.state_manager.set_node_status(
                        deployment_id, node["id"], "live"
                    )
                    await asyncio.sleep(0.2)

                # Get outputs
                outputs = await self._get_terraform_outputs(workspace, aws_credentials)
                await self.state_manager.store_outputs(deployment_id, outputs)

                await self._emit(deployment_id, DeployEventType.LOG, "All resources provisioned successfully")
                await self._emit(deployment_id, DeployEventType.LOG, f"Terraform state stored in workspace")
                await self.state_manager.update_status(deployment_id, DeploymentStatus.COMPLETE)
                await self._emit(
                    deployment_id,
                    DeployEventType.COMPLETE,
                    "Deployment complete",
                    {"outputs": outputs},
                )
            else:
                # Partial failure — check which resources were created
                await self.state_manager.update_status(deployment_id, DeploymentStatus.FAILED)
                await self._emit(
                    deployment_id,
                    DeployEventType.ERROR,
                    "Terraform apply failed. Some resources may have been created. Check logs and consider rollback.",
                )

        except asyncio.CancelledError:
            logger.info("Deployment %s cancelled", deployment_id)
            await self.state_manager.update_status(deployment_id, DeploymentStatus.CANCELLED)
            raise
        except Exception as e:
            logger.exception("Deployment %s failed: %s", deployment_id, str(e))
            await self._emit(deployment_id, DeployEventType.ERROR, f"Deployment failed: {str(e)}")
            await self.state_manager.update_status(deployment_id, DeploymentStatus.FAILED)
        finally:
            self._active_deployments.pop(deployment_id, None)

    async def _run_rollback(
        self, rollback_id: str, workspace: str, original_deployment_id: str
    ) -> None:
        """Run terraform destroy for rollback."""
        try:
            await self.state_manager.update_status(rollback_id, DeploymentStatus.APPLYING)
            await self._emit(rollback_id, DeployEventType.LOG, f"Rolling back deployment {original_deployment_id}...")
            await self._emit(rollback_id, DeployEventType.LOG, "Running terraform destroy...")

            ok = await self._run_terraform_command(
                rollback_id,
                workspace,
                ["destroy", "-no-color", "-input=false", "-auto-approve"],
                None,
            )

            if ok:
                await self.state_manager.update_status(rollback_id, DeploymentStatus.COMPLETE)
                await self.state_manager.update_status(original_deployment_id, DeploymentStatus.ROLLED_BACK)
                await self._emit(rollback_id, DeployEventType.COMPLETE, "Rollback complete — all resources destroyed")
            else:
                await self.state_manager.update_status(rollback_id, DeploymentStatus.FAILED)
                await self._emit(rollback_id, DeployEventType.ERROR, "Rollback failed — manual cleanup may be needed")

        except Exception as e:
            logger.exception("Rollback %s failed: %s", rollback_id, str(e))
            await self._emit(rollback_id, DeployEventType.ERROR, f"Rollback error: {str(e)}")
            await self.state_manager.update_status(rollback_id, DeploymentStatus.FAILED)
        finally:
            self._active_deployments.pop(rollback_id, None)

    # ── Helpers ───────────────────────────────────────────────────────

    def _create_workspace(self, deployment_id: str, files: list[dict]) -> str:
        """Create a temporary workspace directory and write Terraform files."""
        workspace = os.path.join(tempfile.gettempdir(), "cloudforge", deployment_id)
        infra_dir = os.path.join(workspace, "infra")
        os.makedirs(infra_dir, exist_ok=True)

        for file_info in files:
            file_path = os.path.join(workspace, file_info["path"])
            os.makedirs(os.path.dirname(file_path), exist_ok=True)
            with open(file_path, "w") as f:
                f.write(file_info["content"])

        return workspace

    async def _run_terraform_command(
        self,
        deployment_id: str,
        workspace: str,
        args: list[str],
        aws_credentials: dict[str, str] | None,
    ) -> bool:
        """Run a terraform command and stream output."""
        infra_dir = os.path.join(workspace, "infra")

        env = os.environ.copy()
        if aws_credentials:
            env["AWS_ACCESS_KEY_ID"] = aws_credentials.get("access_key_id", "")
            env["AWS_SECRET_ACCESS_KEY"] = aws_credentials.get("secret_access_key", "")
            if aws_credentials.get("session_token"):
                env["AWS_SESSION_TOKEN"] = aws_credentials["session_token"]
            if aws_credentials.get("region"):
                env["AWS_DEFAULT_REGION"] = aws_credentials["region"]

        # Check if terraform is available
        terraform_bin = shutil.which("terraform") or shutil.which("tofu")
        if not terraform_bin:
            await self._emit(
                deployment_id,
                DeployEventType.LOG,
                "Terraform binary not found — running in dry-run mode",
            )
            # Simulate terraform execution for demo/development
            return await self._simulate_terraform(deployment_id, args)

        cmd = [terraform_bin] + args
        try:
            process = await asyncio.create_subprocess_exec(
                *cmd,
                cwd=infra_dir,
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.STDOUT,
                env=env,
            )

            async for line in process.stdout:
                text = line.decode("utf-8", errors="replace").rstrip()
                if text:
                    await self._emit(
                        deployment_id,
                        DeployEventType.TERRAFORM_OUTPUT,
                        text,
                    )

            await process.wait()
            return process.returncode == 0

        except FileNotFoundError:
            await self._emit(deployment_id, DeployEventType.ERROR, "Terraform command not found")
            return False
        except Exception as e:
            await self._emit(deployment_id, DeployEventType.ERROR, f"Command error: {str(e)}")
            return False

    async def _simulate_terraform(self, deployment_id: str, args: list[str]) -> bool:
        """Simulate terraform commands for development/demo without real terraform."""
        command = args[0] if args else "unknown"

        simulations = {
            "init": [
                "Initializing the backend...",
                "Initializing provider plugins...",
                "- Finding hashicorp/aws versions matching \"~> 5.0\"...",
                "- Installing hashicorp/aws v5.82.2...",
                "- Installed hashicorp/aws v5.82.2 (signed by HashiCorp)",
                "Terraform has been successfully initialized!",
            ],
            "plan": [
                "Terraform used the selected providers to generate the following execution plan.",
                "Resource actions are indicated with the following symbols:",
                "  + create",
                "",
                "Plan: 5 to add, 0 to change, 0 to destroy.",
            ],
            "apply": [
                "aws_apigatewayv2_api.apigw: Creating...",
                "aws_apigatewayv2_api.apigw: Creation complete after 2s [id=abc123]",
                "aws_lambda_function.lambda: Creating...",
                "aws_lambda_function.lambda: Creation complete after 8s [id=auth-function]",
                "aws_elasticache_cluster.redis: Creating...",
                "aws_elasticache_cluster.redis: Still creating... [10s elapsed]",
                "aws_elasticache_cluster.redis: Creation complete after 15s",
                "aws_db_instance.rds: Creating...",
                "aws_db_instance.rds: Still creating... [20s elapsed]",
                "aws_db_instance.rds: Creation complete after 25s",
                "aws_secretsmanager_secret.secrets: Creating...",
                "aws_secretsmanager_secret.secrets: Creation complete after 1s",
                "",
                "Apply complete! Resources: 5 added, 0 changed, 0 destroyed.",
            ],
            "destroy": [
                "aws_apigatewayv2_api.apigw: Destroying...",
                "aws_apigatewayv2_api.apigw: Destruction complete after 1s",
                "aws_lambda_function.lambda: Destroying...",
                "aws_lambda_function.lambda: Destruction complete after 3s",
                "aws_elasticache_cluster.redis: Destroying...",
                "aws_elasticache_cluster.redis: Destruction complete after 5s",
                "aws_db_instance.rds: Destroying...",
                "aws_db_instance.rds: Destruction complete after 10s",
                "aws_secretsmanager_secret.secrets: Destroying...",
                "aws_secretsmanager_secret.secrets: Destruction complete after 1s",
                "",
                "Destroy complete! Resources: 5 destroyed.",
            ],
        }

        lines = simulations.get(command, [f"Simulating terraform {command}..."])
        for line in lines:
            await self._emit(deployment_id, DeployEventType.TERRAFORM_OUTPUT, line)
            await asyncio.sleep(0.15 + (0.3 if "Creating" in line or "Destroying" in line else 0))

        return True

    async def _get_terraform_outputs(
        self, workspace: str, aws_credentials: dict[str, str] | None
    ) -> dict[str, Any]:
        """Retrieve terraform outputs after successful apply."""
        infra_dir = os.path.join(workspace, "infra")
        terraform_bin = shutil.which("terraform") or shutil.which("tofu")

        if not terraform_bin:
            # Return simulated outputs
            return {
                "api_endpoint": {"value": "https://abc123.execute-api.us-east-1.amazonaws.com"},
                "lambda_arn": {"value": "arn:aws:lambda:us-east-1:123456789:function:cloudforge-auth"},
                "rds_endpoint": {"value": "cloudforge-db.cluster-xyz.us-east-1.rds.amazonaws.com:5432"},
                "redis_endpoint": {"value": "cloudforge-cache.abc123.use1.cache.amazonaws.com:6379"},
            }

        env = os.environ.copy()
        if aws_credentials:
            env["AWS_ACCESS_KEY_ID"] = aws_credentials.get("access_key_id", "")
            env["AWS_SECRET_ACCESS_KEY"] = aws_credentials.get("secret_access_key", "")

        try:
            result = await asyncio.create_subprocess_exec(
                terraform_bin, "output", "-json", "-no-color",
                cwd=infra_dir,
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.PIPE,
                env=env,
            )
            stdout, _ = await result.communicate()
            if result.returncode == 0:
                return json.loads(stdout.decode())
        except Exception as e:
            logger.warning("Failed to get terraform outputs: %s", str(e))

        return {}

    async def _emit(
        self,
        deployment_id: str,
        event_type: DeployEventType,
        message: str,
        data: dict[str, Any] | None = None,
    ) -> None:
        """Emit a deployment event."""
        event = DeployEvent(event_type, message, data)
        await self.state_manager.emit(deployment_id, event)
