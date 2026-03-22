from __future__ import annotations
import asyncio
import json
import time
from typing import Any, Callable, Awaitable
from app.providers.base import CloudProvider


class AWSProvider(CloudProvider):
    def __init__(self, role_arn: str, region: str):
        self.role_arn = role_arn
        self.region = region
        self._session_creds: dict | None = None  # cached STS temp creds

    @classmethod
    def from_credentials(cls, credentials: dict) -> "AWSProvider":
        return cls(role_arn=credentials["role_arn"], region=credentials["region"])

    def _get_sts_creds(self) -> dict:
        """AssumeRole via STS and return temporary credentials."""
        import boto3
        sts = boto3.client("sts", region_name=self.region)
        resp = sts.assume_role(
            RoleArn=self.role_arn,
            RoleSessionName="cloudforge-deploy",
        )
        return resp["Credentials"]

    def _boto3_client(self, service: str):
        import boto3
        creds = self._session_creds or {}
        return boto3.client(
            service,
            region_name=self.region,
            aws_access_key_id=creds.get("AccessKeyId"),
            aws_secret_access_key=creds.get("SecretAccessKey"),
            aws_session_token=creds.get("SessionToken"),
        )

    async def verify_credentials(self) -> bool:
        loop = asyncio.get_event_loop()

        def _verify():
            import boto3
            creds = self._get_sts_creds()
            self._session_creds = creds
            sts = boto3.client(
                "sts",
                region_name=self.region,
                aws_access_key_id=creds["AccessKeyId"],
                aws_secret_access_key=creds["SecretAccessKey"],
                aws_session_token=creds["SessionToken"],
            )
            sts.get_caller_identity()
            return True

        return await loop.run_in_executor(None, _verify)

    async def deploy(
        self,
        stack_name: str,
        template_body: str,
        parameters: dict[str, str],
        on_event: Callable[[dict], Awaitable[None]],
    ) -> dict[str, Any]:
        loop = asyncio.get_event_loop()

        cf_params = [{"ParameterKey": k, "ParameterValue": v} for k, v in parameters.items()]

        def _create_or_update():
            cf = self._boto3_client("cloudformation")
            try:
                cf.describe_stacks(StackName=stack_name)
                cf.update_stack(
                    StackName=stack_name,
                    TemplateBody=template_body,
                    Parameters=cf_params,
                    Capabilities=["CAPABILITY_IAM", "CAPABILITY_NAMED_IAM"],
                )
                return "UPDATE_IN_PROGRESS"
            except cf.exceptions.ClientError as e:
                if "does not exist" in str(e):
                    cf.create_stack(
                        StackName=stack_name,
                        TemplateBody=template_body,
                        Parameters=cf_params,
                        Capabilities=["CAPABILITY_IAM", "CAPABILITY_NAMED_IAM"],
                    )
                    return "CREATE_IN_PROGRESS"
                raise

        status = await loop.run_in_executor(None, _create_or_update)
        await on_event({"type": "log", "line": f"⟳ Stack {status.lower().replace('_', ' ')}…"})

        def _poll_events(seen_event_ids: set) -> tuple[list[dict], str]:
            cf = self._boto3_client("cloudformation")
            stacks = cf.describe_stacks(StackName=stack_name)["Stacks"]
            stack_status = stacks[0]["StackStatus"] if stacks else "UNKNOWN"

            events_resp = cf.describe_stack_events(StackName=stack_name)
            new_events = []
            for evt in reversed(events_resp["StackEvents"]):
                if evt["EventId"] not in seen_event_ids:
                    seen_event_ids.add(evt["EventId"])
                    new_events.append(evt)
            return new_events, stack_status

        seen_ids: set[str] = set()
        terminal_statuses = {
            "CREATE_COMPLETE", "UPDATE_COMPLETE",
            "CREATE_FAILED", "UPDATE_FAILED", "ROLLBACK_COMPLETE",
            "ROLLBACK_FAILED", "UPDATE_ROLLBACK_COMPLETE",
        }

        while True:
            events, stack_status = await loop.run_in_executor(None, _poll_events, seen_ids)

            for evt in events:
                resource_id = evt.get("LogicalResourceId", "")
                res_status = evt.get("ResourceStatus", "")
                reason = evt.get("ResourceStatusReason", "")

                log_line = f"{'✓' if 'COMPLETE' in res_status else '⟳'} {resource_id}: {res_status}"
                if reason and "User Initiated" not in reason:
                    log_line += f" — {reason}"

                await on_event({"type": "log", "line": log_line})

                node_status = None
                if "COMPLETE" in res_status and "FAILED" not in res_status:
                    node_status = "live"
                elif "IN_PROGRESS" in res_status:
                    node_status = "provisioning"

                if node_status and resource_id:
                    await on_event({"type": "node_status", "nodeId": resource_id.lower(), "status": node_status})

            if stack_status in terminal_statuses:
                break

            await asyncio.sleep(5)

        def _get_outputs():
            cf = self._boto3_client("cloudformation")
            stacks = cf.describe_stacks(StackName=stack_name)["Stacks"]
            return stacks[0].get("Outputs", []) if stacks else []

        outputs_raw = await loop.run_in_executor(None, _get_outputs)
        outputs = {o["OutputKey"]: o["OutputValue"] for o in outputs_raw}

        if "FAILED" in stack_status or "ROLLBACK" in stack_status:
            raise ValueError(f"Stack deployment failed with status: {stack_status}")

        return outputs

    async def rollback(self, stack_name: str) -> None:
        loop = asyncio.get_event_loop()

        def _delete():
            cf = self._boto3_client("cloudformation")
            cf.delete_stack(StackName=stack_name)

        await loop.run_in_executor(None, _delete)
