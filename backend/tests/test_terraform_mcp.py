"""
Tests for Terraform MCP integration.

Coverage:
  1. Pure unit tests  — _parse_resource_list, _infer_category,
                        _extract_text, _format_context_for_prompt
  2. TerraformMCPClient — subprocess spawned with correct args, correct
                          JSON-RPC messages sent, error / closed-pipe handling
  3. TerraformMCPAdapter — correct provider mapping, graceful failure,
                           caching (no unnecessary MCP calls), filtering, caps
  4. service_discovery_node — MCP wiring, prompt injection, fallback,
                               Ollama fallback, LLM API error handling
  5. Prompt template — terraform_context conditional rendering
  6. State fields — terraform_mcp_available present and initialised
  7. graph.py wiring — create_graph signature accepts terraform_mcp_cmd
  8. Protocol conformance — TerraformMCPAdapter satisfies TerraformMCPProvider

Run fast tests only (no subprocess / LLM):
    pytest tests/test_terraform_mcp.py -v -s -m "not slow"

Run everything:
    pytest tests/test_terraform_mcp.py -v -s
"""
from __future__ import annotations

import asyncio
import json
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

# ---------------------------------------------------------------------------
# Helpers shared across all sections
# ---------------------------------------------------------------------------

pytestmark = pytest.mark.filterwarnings("ignore::DeprecationWarning")


def _run(coro):
    """Run a coroutine synchronously — works without pytest-asyncio."""
    return asyncio.run(coro)


# Sample MCP text response matching the HashiCorp terraform-mcp-server format
_SAMPLE_AWS_TEXT = """\
aws_lambda_function - Manages an AWS Lambda Function resource.
aws_rds_cluster - Manages an RDS Aurora Cluster.
aws_s3_bucket - Manages an S3 Bucket resource.
aws_dynamodb_table - Manages a DynamoDB Table.
aws_sqs_queue - Manages an SQS Queue.
aws_cloudwatch_log_group - Manages a CloudWatch Log Group.
aws_iam_role - Manages an IAM Role.
"""

_INIT_RESPONSE = {
    "jsonrpc": "2.0",
    "id": 1,
    "result": {"protocolVersion": "2024-11-05", "capabilities": {}},
}

_TOOL_RESPONSE = {
    "jsonrpc": "2.0",
    "id": 2,
    "result": {"content": [{"type": "text", "text": _SAMPLE_AWS_TEXT}]},
}

_ERROR_RESPONSE = {
    "jsonrpc": "2.0",
    "id": 2,
    "error": {"code": -32601, "message": "Tool not found"},
}


def _mcp_text_result(text: str) -> dict:
    return {"content": [{"type": "text", "text": text}]}


def _make_state(**overrides) -> dict:
    from app.agents.architecture_planner.state import make_initial_state
    base = make_initial_state(
        budget="$30k/month",
        traffic="1k RPS",
        availability="99.9% SLA",
        prd="Web application with REST API and database.",
        cloud_provider="AWS",
    )
    base["query_results"] = "Research about AWS architecture patterns."
    base.update(overrides)
    return base


def _make_mock_process(responses: list[dict]) -> MagicMock:
    """
    Build a mock asyncio.Process whose stdout.readline() streams the given
    JSON-encoded response dicts in order.
    """
    proc = MagicMock()
    proc.returncode = None
    proc.stdin.write = MagicMock()
    proc.stdin.drain = AsyncMock()
    proc.stdin.close = MagicMock()
    proc.stdout.readline = AsyncMock(
        side_effect=[json.dumps(r).encode() + b"\n" for r in responses]
    )
    proc.wait = AsyncMock(return_value=0)
    return proc


def _patch_mcp_client(text_blob: str):
    """
    Return (patcher, mock_client) where mock_client.call() returns text_blob.

    Usage:
        patcher, mock_client = _patch_mcp_client("aws_lambda...")
        with patcher:
            adapter = TerraformMCPAdapter(cmd=["x"])
            ...
    """
    mock_client = AsyncMock()
    mock_client.call.return_value = _mcp_text_result(text_blob)
    mock_ctx = MagicMock()
    mock_ctx.__aenter__ = AsyncMock(return_value=mock_client)
    mock_ctx.__aexit__ = AsyncMock(return_value=None)
    patcher = patch(
        "app.agents.architecture_planner.terraform_mcp.adapter.TerraformMCPClient",
        return_value=mock_ctx,
    )
    return patcher, mock_client


def _make_mock_llm(services=None):
    from app.agents.architecture_planner.state import ServiceEntry
    from app.agents.architecture_planner.service_discovery_agent import ServiceDiscoveryOutput

    if services is None:
        services = [
            ServiceEntry(
                name="aws_lambda_function",
                category="Compute",
                provider="AWS",
                description="Serverless compute.",
                use_case="Handles API requests.",
            ),
            ServiceEntry(
                name="aws_rds_cluster",
                category="Database",
                provider="AWS",
                description="Managed relational database.",
                use_case="Stores application data.",
            ),
        ]
    mock_llm = MagicMock()
    mock_chain = MagicMock()
    mock_llm.with_structured_output.return_value = mock_chain
    mock_chain.invoke.return_value = ServiceDiscoveryOutput(services=services)
    return mock_llm


def _make_mock_adapter(return_value: str | None = "## Terraform Registry: AWS\n- aws_lambda_function [Compute]: Lambda"):
    adapter = AsyncMock()
    adapter.format_for_prompt.return_value = return_value
    return adapter


# ===========================================================================
# Section 1 — Pure unit tests for helper functions
# ===========================================================================


class TestInferCategory:

    def test_lambda_is_compute(self):
        from app.agents.architecture_planner.terraform_mcp.adapter import _infer_category
        assert _infer_category("aws_lambda_function") == "Compute"

    def test_ecs_is_compute(self):
        from app.agents.architecture_planner.terraform_mcp.adapter import _infer_category
        assert _infer_category("aws_ecs_service") == "Compute"

    def test_rds_is_database(self):
        from app.agents.architecture_planner.terraform_mcp.adapter import _infer_category
        assert _infer_category("aws_rds_cluster") == "Database"

    def test_dynamodb_is_database(self):
        from app.agents.architecture_planner.terraform_mcp.adapter import _infer_category
        assert _infer_category("aws_dynamodb_table") == "Database"

    def test_s3_is_storage(self):
        from app.agents.architecture_planner.terraform_mcp.adapter import _infer_category
        assert _infer_category("aws_s3_bucket") == "Storage"

    def test_sqs_is_messaging(self):
        from app.agents.architecture_planner.terraform_mcp.adapter import _infer_category
        assert _infer_category("aws_sqs_queue") == "Messaging"

    def test_cloudfront_is_cdn(self):
        from app.agents.architecture_planner.terraform_mcp.adapter import _infer_category
        assert _infer_category("aws_cloudfront_distribution") == "CDN"

    def test_iam_is_security(self):
        from app.agents.architecture_planner.terraform_mcp.adapter import _infer_category
        assert _infer_category("aws_iam_role") == "Security"

    def test_cloudwatch_is_monitoring(self):
        from app.agents.architecture_planner.terraform_mcp.adapter import _infer_category
        assert _infer_category("aws_cloudwatch_metric_alarm") == "Monitoring"

    def test_vpc_is_networking(self):
        from app.agents.architecture_planner.terraform_mcp.adapter import _infer_category
        assert _infer_category("aws_vpc") == "Networking"

    def test_codebuild_is_devops(self):
        from app.agents.architecture_planner.terraform_mcp.adapter import _infer_category
        assert _infer_category("aws_codebuild_project") == "DevOps"

    def test_cognito_is_identity(self):
        from app.agents.architecture_planner.terraform_mcp.adapter import _infer_category
        assert _infer_category("aws_cognito_user_pool") == "Identity"

    def test_gcp_cloud_run_is_compute(self):
        from app.agents.architecture_planner.terraform_mcp.adapter import _infer_category
        assert _infer_category("google_cloud_run_service") == "Compute"

    def test_gcp_spanner_is_database(self):
        from app.agents.architecture_planner.terraform_mcp.adapter import _infer_category
        assert _infer_category("google_spanner_instance") == "Database"

    def test_azure_cosmosdb_is_database(self):
        from app.agents.architecture_planner.terraform_mcp.adapter import _infer_category
        assert _infer_category("azurerm_cosmosdb_account") == "Database"

    def test_azure_key_vault_is_security(self):
        from app.agents.architecture_planner.terraform_mcp.adapter import _infer_category
        assert _infer_category("azurerm_key_vault") == "Security"

    def test_unknown_prefix_is_other(self):
        from app.agents.architecture_planner.terraform_mcp.adapter import _infer_category
        assert _infer_category("digitalocean_droplet") == "Other"

    def test_completely_unknown_is_other(self):
        from app.agents.architecture_planner.terraform_mcp.adapter import _infer_category
        assert _infer_category("totally_unknown_resource_xyz") == "Other"


class TestParseResourceList:

    def setup_method(self):
        from app.agents.architecture_planner.terraform_mcp.adapter import _parse_resource_list
        self._parse = _parse_resource_list

    def test_parses_name_and_description(self):
        resources = self._parse("aws_lambda_function - Manages an AWS Lambda Function.", None, 100)
        assert len(resources) == 1
        assert resources[0].name == "aws_lambda_function"
        assert resources[0].description == "Manages an AWS Lambda Function."

    def test_parses_bare_name_with_fallback_description(self):
        resources = self._parse("aws_s3_bucket\n", None, 100)
        assert len(resources) == 1
        assert resources[0].name == "aws_s3_bucket"
        assert "aws_s3_bucket" in resources[0].description

    def test_skips_empty_lines(self):
        resources = self._parse("\n\naws_lambda_function - Lambda\n\n", None, 100)
        assert len(resources) == 1

    def test_skips_prose_header_lines(self):
        text = "Available resources for hashicorp/aws:\naws_lambda_function - Lambda\nEnd of list\n"
        resources = self._parse(text, None, 100)
        assert len(resources) == 1
        assert resources[0].name == "aws_lambda_function"

    def test_strips_bullet_prefix(self):
        resources = self._parse("• aws_lambda_function - Lambda\n", None, 100)
        assert len(resources) == 1
        assert resources[0].name == "aws_lambda_function"

    def test_strips_star_prefix(self):
        resources = self._parse("* aws_s3_bucket - S3\n", None, 100)
        assert len(resources) == 1
        assert resources[0].name == "aws_s3_bucket"

    def test_max_resources_cap(self):
        lines = "\n".join(f"aws_resource_{i} - Resource {i}" for i in range(20))
        resources = self._parse(lines, None, 5)
        assert len(resources) == 5

    def test_max_resources_not_exceeded(self):
        lines = "\n".join(f"aws_resource_{i} - Resource {i}" for i in range(3))
        resources = self._parse(lines, None, 100)
        assert len(resources) == 3

    def test_resource_filter_single_keyword(self):
        resources = self._parse(_SAMPLE_AWS_TEXT, ["lambda"], 100)
        assert len(resources) == 1
        assert resources[0].name == "aws_lambda_function"

    def test_resource_filter_multiple_keywords(self):
        resources = self._parse(_SAMPLE_AWS_TEXT, ["lambda", "rds"], 100)
        names = [r.name for r in resources]
        assert "aws_lambda_function" in names
        assert "aws_rds_cluster" in names
        assert len(names) == 2

    def test_resource_filter_no_match_returns_empty(self):
        resources = self._parse(_SAMPLE_AWS_TEXT, ["nonexistent_xyz"], 100)
        assert resources == []

    def test_resource_filter_is_case_insensitive(self):
        resources = self._parse("aws_LAMBDA_function - Lambda\n", ["lambda"], 100)
        assert len(resources) == 1

    def test_category_inferred_correctly_for_all_sample_resources(self):
        resources = self._parse(_SAMPLE_AWS_TEXT, None, 100)
        by_name = {r.name: r.category for r in resources}
        assert by_name["aws_lambda_function"] == "Compute"
        assert by_name["aws_rds_cluster"] == "Database"
        assert by_name["aws_s3_bucket"] == "Storage"
        assert by_name["aws_sqs_queue"] == "Messaging"
        assert by_name["aws_cloudwatch_log_group"] == "Monitoring"
        assert by_name["aws_iam_role"] == "Security"

    def test_full_sample_parses_all_entries(self):
        resources = self._parse(_SAMPLE_AWS_TEXT, None, 100)
        assert len(resources) == 7

    def test_filter_combined_with_max(self):
        # filter allows 3 resources, max allows 2 → 2 returned
        text = "aws_lambda_function - L\naws_lambda_permission - P\naws_lambda_alias - A\n"
        resources = self._parse(text, ["lambda"], 2)
        assert len(resources) == 2


class TestExtractText:

    def setup_method(self):
        from app.agents.architecture_planner.terraform_mcp.adapter import _extract_text
        self._extract = _extract_text

    def test_extracts_text_item(self):
        result = {"content": [{"type": "text", "text": "hello world"}]}
        assert self._extract(result) == "hello world"

    def test_ignores_non_text_items(self):
        result = {"content": [{"type": "image", "data": "base64..."}]}
        assert self._extract(result) == ""

    def test_returns_first_text_item_only(self):
        result = {"content": [
            {"type": "text", "text": "first"},
            {"type": "text", "text": "second"},
        ]}
        assert self._extract(result) == "first"

    def test_empty_content_list(self):
        assert self._extract({"content": []}) == ""

    def test_missing_content_key(self):
        assert self._extract({"other": "data"}) == ""


class TestFormatContextForPrompt:

    def setup_method(self):
        from app.agents.architecture_planner.terraform_mcp.adapter import _format_context_for_prompt
        from app.agents.architecture_planner.terraform_mcp.models import (
            TerraformProviderContext, TerraformResource,
        )
        self._fmt = _format_context_for_prompt
        self._Ctx = TerraformProviderContext
        self._Res = TerraformResource

    def test_header_contains_cloud_provider(self):
        ctx = self._Ctx(provider="hashicorp/aws", cloud_provider="AWS",
                        resources=[], resource_schema_snippets={})
        assert "AWS" in self._fmt(ctx)

    def test_header_contains_registry_name(self):
        ctx = self._Ctx(provider="hashicorp/aws", cloud_provider="AWS",
                        resources=[], resource_schema_snippets={})
        assert "hashicorp/aws" in self._fmt(ctx)

    def test_each_resource_appears_on_own_line(self):
        resources = [
            self._Res(name="aws_lambda_function", description="Lambda", category="Compute"),
            self._Res(name="aws_s3_bucket", description="S3", category="Storage"),
        ]
        ctx = self._Ctx(provider="hashicorp/aws", cloud_provider="AWS",
                        resources=resources, resource_schema_snippets={})
        output = self._fmt(ctx)
        resource_lines = [l for l in output.splitlines() if l.startswith("- ")]
        assert len(resource_lines) == 2

    def test_resource_line_format(self):
        resources = [self._Res(name="aws_lambda_function", description="Lambda Function", category="Compute")]
        ctx = self._Ctx(provider="hashicorp/aws", cloud_provider="AWS",
                        resources=resources, resource_schema_snippets={})
        output = self._fmt(ctx)
        assert "aws_lambda_function" in output
        assert "[Compute]" in output
        assert "Lambda Function" in output

    def test_empty_resources_gives_only_header(self):
        ctx = self._Ctx(provider="hashicorp/aws", cloud_provider="AWS",
                        resources=[], resource_schema_snippets={})
        output = self._fmt(ctx)
        assert "AWS" in output
        assert "- " not in output


# ===========================================================================
# Section 2 — TerraformMCPClient tests (mock subprocess)
# ===========================================================================


class TestTerraformMCPClient:

    def test_successful_call_returns_result(self):
        from app.agents.architecture_planner.terraform_mcp.client import TerraformMCPClient

        async def run():
            proc = _make_mock_process([_INIT_RESPONSE, _TOOL_RESPONSE])
            with patch("asyncio.create_subprocess_exec", AsyncMock(return_value=proc)):
                async with TerraformMCPClient(cmd=["fake-cmd"]) as client:
                    result = await client.call(
                        "list_terraform_registry_provider_resources",
                        {"provider": "hashicorp/aws"},
                    )
            assert result == _TOOL_RESPONSE["result"]

        _run(run())

    def test_call_sends_tools_call_jsonrpc_message(self):
        from app.agents.architecture_planner.terraform_mcp.client import TerraformMCPClient
        written = []

        async def run():
            proc = _make_mock_process([_INIT_RESPONSE, _TOOL_RESPONSE])
            proc.stdin.write = lambda data: written.append(json.loads(data.decode().strip()))
            with patch("asyncio.create_subprocess_exec", AsyncMock(return_value=proc)):
                async with TerraformMCPClient(cmd=["fake-cmd"]) as client:
                    await client.call("my_tool", {"arg": "val"})

        _run(run())
        tool_msg = written[-1]
        assert tool_msg["method"] == "tools/call"
        assert tool_msg["params"]["name"] == "my_tool"
        assert tool_msg["params"]["arguments"] == {"arg": "val"}
        assert tool_msg["jsonrpc"] == "2.0"

    def test_initialize_sends_handshake_then_notification(self):
        from app.agents.architecture_planner.terraform_mcp.client import TerraformMCPClient
        written = []

        async def run():
            proc = _make_mock_process([_INIT_RESPONSE, _TOOL_RESPONSE])
            proc.stdin.write = lambda data: written.append(json.loads(data.decode().strip()))
            with patch("asyncio.create_subprocess_exec", AsyncMock(return_value=proc)):
                async with TerraformMCPClient(cmd=["fake-cmd"]) as client:
                    await client.call("some_tool", {})

        _run(run())
        # First message: initialize
        assert written[0]["method"] == "initialize"
        assert written[0]["params"]["protocolVersion"] == "2024-11-05"
        assert written[0]["params"]["clientInfo"]["name"] == "cloudforge"
        # Second message: notifications/initialized (no "id" field)
        assert written[1]["method"] == "notifications/initialized"
        assert "id" not in written[1]

    def test_error_response_raises_mcp_client_error(self):
        from app.agents.architecture_planner.terraform_mcp.client import (
            TerraformMCPClient, MCPClientError,
        )

        async def run():
            proc = _make_mock_process([_INIT_RESPONSE, _ERROR_RESPONSE])
            with patch("asyncio.create_subprocess_exec", AsyncMock(return_value=proc)):
                async with TerraformMCPClient(cmd=["fake-cmd"]) as client:
                    with pytest.raises(MCPClientError):
                        await client.call("bad_tool", {})

        _run(run())

    def test_closed_stdout_raises_mcp_client_error(self):
        from app.agents.architecture_planner.terraform_mcp.client import (
            TerraformMCPClient, MCPClientError,
        )

        async def run():
            proc = _make_mock_process([_INIT_RESPONSE])
            # After init response, readline returns empty bytes (closed pipe)
            proc.stdout.readline = AsyncMock(side_effect=[
                json.dumps(_INIT_RESPONSE).encode() + b"\n",
                b"",
            ])
            with patch("asyncio.create_subprocess_exec", AsyncMock(return_value=proc)):
                async with TerraformMCPClient(cmd=["fake-cmd"]) as client:
                    with pytest.raises(MCPClientError, match="closed stdout"):
                        await client.call("some_tool", {})

        _run(run())

    def test_subprocess_launched_with_exact_command(self):
        from app.agents.architecture_planner.terraform_mcp.client import TerraformMCPClient
        cmd = ["npx", "-y", "@hashicorp/terraform-mcp-server"]

        async def run():
            proc = _make_mock_process([_INIT_RESPONSE, _TOOL_RESPONSE])
            with patch("asyncio.create_subprocess_exec", AsyncMock(return_value=proc)) as mock_exec:
                async with TerraformMCPClient(cmd=cmd) as client:
                    await client.call("tool", {})
                # Positional args to create_subprocess_exec should be the cmd parts
                call_args = list(mock_exec.call_args[0])
                assert call_args == cmd

        _run(run())

    def test_message_ids_increment_across_calls(self):
        from app.agents.architecture_planner.terraform_mcp.client import TerraformMCPClient
        ids_seen = []

        async def run():
            proc = _make_mock_process([
                _INIT_RESPONSE,
                {"jsonrpc": "2.0", "id": 2, "result": {"content": []}},
                {"jsonrpc": "2.0", "id": 3, "result": {"content": []}},
            ])

            def capture(data):
                msg = json.loads(data.decode().strip())
                if "id" in msg:
                    ids_seen.append(msg["id"])

            proc.stdin.write = capture
            with patch("asyncio.create_subprocess_exec", AsyncMock(return_value=proc)):
                async with TerraformMCPClient(cmd=["fake"]) as client:
                    await client.call("tool_a", {})
                    await client.call("tool_b", {})

        _run(run())
        assert ids_seen == [1, 2, 3]  # 1=initialize, 2=tool_a, 3=tool_b


# ===========================================================================
# Section 3 — TerraformMCPAdapter tests
# ===========================================================================


class TestTerraformMCPAdapterProviderMapping:

    def test_aws_calls_hashicorp_aws(self):
        from app.agents.architecture_planner.terraform_mcp.adapter import TerraformMCPAdapter
        patcher, mock_client = _patch_mcp_client(_SAMPLE_AWS_TEXT)
        with patcher:
            _run(TerraformMCPAdapter(cmd=["x"]).get_provider_context("AWS"))
        mock_client.call.assert_called_once_with(
            "list_terraform_registry_provider_resources",
            {"provider": "hashicorp/aws"},
        )

    def test_gcp_calls_hashicorp_google(self):
        from app.agents.architecture_planner.terraform_mcp.adapter import TerraformMCPAdapter
        gcp_text = "google_cloud_run_service - Cloud Run\n"
        patcher, mock_client = _patch_mcp_client(gcp_text)
        with patcher:
            _run(TerraformMCPAdapter(cmd=["x"]).get_provider_context("GCP"))
        mock_client.call.assert_called_once_with(
            "list_terraform_registry_provider_resources",
            {"provider": "hashicorp/google"},
        )

    def test_azure_calls_hashicorp_azurerm(self):
        from app.agents.architecture_planner.terraform_mcp.adapter import TerraformMCPAdapter
        az_text = "azurerm_function_app - Azure Function\n"
        patcher, mock_client = _patch_mcp_client(az_text)
        with patcher:
            _run(TerraformMCPAdapter(cmd=["x"]).get_provider_context("Azure"))
        mock_client.call.assert_called_once_with(
            "list_terraform_registry_provider_resources",
            {"provider": "hashicorp/azurerm"},
        )

    def test_unmapped_provider_returns_none_without_mcp_call(self):
        from app.agents.architecture_planner.terraform_mcp.adapter import TerraformMCPAdapter
        patcher, mock_client = _patch_mcp_client("")
        with patcher:
            result = _run(TerraformMCPAdapter(cmd=["x"]).get_provider_context("DigitalOcean"))
        assert result is None
        mock_client.call.assert_not_called()


class TestTerraformMCPAdapterResults:

    def test_returns_provider_context_with_correct_fields(self):
        from app.agents.architecture_planner.terraform_mcp.adapter import TerraformMCPAdapter
        patcher, _ = _patch_mcp_client(_SAMPLE_AWS_TEXT)
        with patcher:
            ctx = _run(TerraformMCPAdapter(cmd=["x"]).get_provider_context("AWS"))
        assert ctx is not None
        assert ctx.cloud_provider == "AWS"
        assert ctx.provider == "hashicorp/aws"
        assert len(ctx.resources) > 0

    def test_resources_have_valid_categories(self):
        from app.agents.architecture_planner.terraform_mcp.adapter import TerraformMCPAdapter
        valid = {"Compute", "Storage", "Database", "Networking", "Messaging",
                 "Security", "Monitoring", "CDN", "Identity", "DevOps", "Other"}
        patcher, _ = _patch_mcp_client(_SAMPLE_AWS_TEXT)
        with patcher:
            ctx = _run(TerraformMCPAdapter(cmd=["x"]).get_provider_context("AWS"))
        for r in ctx.resources:
            assert r.category in valid, f"{r.name} has invalid category {r.category!r}"

    def test_resources_have_non_empty_names_and_descriptions(self):
        from app.agents.architecture_planner.terraform_mcp.adapter import TerraformMCPAdapter
        patcher, _ = _patch_mcp_client(_SAMPLE_AWS_TEXT)
        with patcher:
            ctx = _run(TerraformMCPAdapter(cmd=["x"]).get_provider_context("AWS"))
        for r in ctx.resources:
            assert r.name, "Resource name must not be empty"
            assert r.description, "Resource description must not be empty"

    def test_max_resources_is_respected(self):
        from app.agents.architecture_planner.terraform_mcp.adapter import TerraformMCPAdapter
        patcher, _ = _patch_mcp_client(_SAMPLE_AWS_TEXT)
        with patcher:
            ctx = _run(TerraformMCPAdapter(cmd=["x"]).get_provider_context("AWS", max_resources=3))
        assert len(ctx.resources) <= 3

    def test_resource_filter_applied(self):
        from app.agents.architecture_planner.terraform_mcp.adapter import TerraformMCPAdapter
        patcher, _ = _patch_mcp_client(_SAMPLE_AWS_TEXT)
        with patcher:
            ctx = _run(TerraformMCPAdapter(cmd=["x"]).get_provider_context("AWS", resource_filter=["lambda"]))
        assert all("lambda" in r.name for r in ctx.resources)
        assert len(ctx.resources) == 1


class TestTerraformMCPAdapterErrorHandling:

    def test_mcp_subprocess_not_found_returns_none(self):
        from app.agents.architecture_planner.terraform_mcp.adapter import TerraformMCPAdapter
        mock_ctx = MagicMock()
        mock_ctx.__aenter__ = AsyncMock(side_effect=FileNotFoundError("cmd not found"))
        mock_ctx.__aexit__ = AsyncMock(return_value=None)
        with patch("app.agents.architecture_planner.terraform_mcp.adapter.TerraformMCPClient",
                   return_value=mock_ctx):
            result = _run(TerraformMCPAdapter(cmd=["nonexistent"]).get_provider_context("AWS"))
        assert result is None

    def test_mcp_runtime_error_returns_none(self):
        from app.agents.architecture_planner.terraform_mcp.adapter import TerraformMCPAdapter
        mock_ctx = MagicMock()
        mock_ctx.__aenter__ = AsyncMock(side_effect=RuntimeError("connection refused"))
        mock_ctx.__aexit__ = AsyncMock(return_value=None)
        with patch("app.agents.architecture_planner.terraform_mcp.adapter.TerraformMCPClient",
                   return_value=mock_ctx):
            result = _run(TerraformMCPAdapter(cmd=["x"]).get_provider_context("AWS"))
        assert result is None

    def test_mcp_failure_does_not_raise(self):
        from app.agents.architecture_planner.terraform_mcp.adapter import TerraformMCPAdapter
        mock_ctx = MagicMock()
        mock_ctx.__aenter__ = AsyncMock(side_effect=Exception("catastrophic"))
        mock_ctx.__aexit__ = AsyncMock(return_value=None)
        with patch("app.agents.architecture_planner.terraform_mcp.adapter.TerraformMCPClient",
                   return_value=mock_ctx):
            # Must not raise
            result = _run(TerraformMCPAdapter(cmd=["x"]).get_provider_context("AWS"))
        assert result is None

    def test_format_for_prompt_returns_none_on_failure(self):
        from app.agents.architecture_planner.terraform_mcp.adapter import TerraformMCPAdapter
        mock_ctx = MagicMock()
        mock_ctx.__aenter__ = AsyncMock(side_effect=RuntimeError("fail"))
        mock_ctx.__aexit__ = AsyncMock(return_value=None)
        with patch("app.agents.architecture_planner.terraform_mcp.adapter.TerraformMCPClient",
                   return_value=mock_ctx):
            result = _run(TerraformMCPAdapter(cmd=["x"]).format_for_prompt("AWS"))
        assert result is None

    def test_format_for_prompt_returns_none_for_unmapped_provider(self):
        from app.agents.architecture_planner.terraform_mcp.adapter import TerraformMCPAdapter
        patcher, _ = _patch_mcp_client("")
        with patcher:
            result = _run(TerraformMCPAdapter(cmd=["x"]).format_for_prompt("Alibaba"))
        assert result is None


class TestTerraformMCPAdapterCaching:
    """
    Caching correctness: no unnecessary MCP calls.

    The adapter must call the MCP subprocess exactly once per
    (cloud_provider, resource_filter) combination, regardless of how many
    times the method is called.
    """

    def test_second_call_same_provider_hits_cache_no_extra_mcp_call(self):
        from app.agents.architecture_planner.terraform_mcp.adapter import TerraformMCPAdapter
        patcher, mock_client = _patch_mcp_client(_SAMPLE_AWS_TEXT)

        async def run():
            adapter = TerraformMCPAdapter(cmd=["x"])
            with patcher:
                ctx1 = await adapter.get_provider_context("AWS")
                ctx2 = await adapter.get_provider_context("AWS")
            return ctx1, ctx2

        ctx1, ctx2 = _run(run())
        # MCP called once only
        assert mock_client.call.call_count == 1
        # Same cached object returned
        assert ctx1 is ctx2

    def test_different_providers_each_call_mcp_once(self):
        from app.agents.architecture_planner.terraform_mcp.adapter import TerraformMCPAdapter
        patcher, mock_client = _patch_mcp_client(
            "aws_lambda_function - Lambda\ngoogle_cloud_run_service - Cloud Run\n"
        )

        async def run():
            adapter = TerraformMCPAdapter(cmd=["x"])
            with patcher:
                await adapter.get_provider_context("AWS")
                await adapter.get_provider_context("GCP")
                # Third call: AWS again — should hit cache
                await adapter.get_provider_context("AWS")

        _run(run())
        # Two distinct providers → two MCP calls (not three)
        assert mock_client.call.call_count == 2

    def test_different_filters_are_distinct_cache_entries(self):
        from app.agents.architecture_planner.terraform_mcp.adapter import TerraformMCPAdapter
        patcher, mock_client = _patch_mcp_client(_SAMPLE_AWS_TEXT)

        async def run():
            adapter = TerraformMCPAdapter(cmd=["x"])
            with patcher:
                await adapter.get_provider_context("AWS", resource_filter=["lambda"])
                await adapter.get_provider_context("AWS", resource_filter=["rds"])

        _run(run())
        assert mock_client.call.call_count == 2

    def test_same_filter_different_calls_hits_cache(self):
        from app.agents.architecture_planner.terraform_mcp.adapter import TerraformMCPAdapter
        patcher, mock_client = _patch_mcp_client(_SAMPLE_AWS_TEXT)

        async def run():
            adapter = TerraformMCPAdapter(cmd=["x"])
            with patcher:
                await adapter.get_provider_context("AWS", resource_filter=["lambda"])
                await adapter.get_provider_context("AWS", resource_filter=["lambda"])

        _run(run())
        assert mock_client.call.call_count == 1

    def test_five_calls_same_provider_one_mcp_call(self):
        from app.agents.architecture_planner.terraform_mcp.adapter import TerraformMCPAdapter
        patcher, mock_client = _patch_mcp_client(_SAMPLE_AWS_TEXT)

        async def run():
            adapter = TerraformMCPAdapter(cmd=["x"])
            with patcher:
                for _ in range(5):
                    await adapter.get_provider_context("AWS")

        _run(run())
        assert mock_client.call.call_count == 1


class TestTerraformMCPAdapterFormatForPrompt:

    def test_returns_string_with_content(self):
        from app.agents.architecture_planner.terraform_mcp.adapter import TerraformMCPAdapter
        patcher, _ = _patch_mcp_client(_SAMPLE_AWS_TEXT)
        with patcher:
            result = _run(TerraformMCPAdapter(cmd=["x"]).format_for_prompt("AWS"))
        assert isinstance(result, str) and len(result) > 0

    def test_contains_provider_header(self):
        from app.agents.architecture_planner.terraform_mcp.adapter import TerraformMCPAdapter
        patcher, _ = _patch_mcp_client(_SAMPLE_AWS_TEXT)
        with patcher:
            result = _run(TerraformMCPAdapter(cmd=["x"]).format_for_prompt("AWS"))
        assert "AWS" in result
        assert "hashicorp/aws" in result

    def test_contains_resource_entries(self):
        from app.agents.architecture_planner.terraform_mcp.adapter import TerraformMCPAdapter
        patcher, _ = _patch_mcp_client(_SAMPLE_AWS_TEXT)
        with patcher:
            result = _run(TerraformMCPAdapter(cmd=["x"]).format_for_prompt("AWS"))
        assert "aws_lambda_function" in result
        assert "[Compute]" in result

    def test_format_for_prompt_uses_same_cache_as_get_provider_context(self):
        from app.agents.architecture_planner.terraform_mcp.adapter import TerraformMCPAdapter
        patcher, mock_client = _patch_mcp_client(_SAMPLE_AWS_TEXT)

        async def run():
            adapter = TerraformMCPAdapter(cmd=["x"])
            with patcher:
                await adapter.get_provider_context("AWS")   # warms cache
                await adapter.format_for_prompt("AWS")       # should hit cache

        _run(run())
        assert mock_client.call.call_count == 1


# ===========================================================================
# Section 4 — service_discovery_node tests
# ===========================================================================


class TestServiceDiscoveryNodeWithoutAdapter:

    def test_returns_services_llm_only(self):
        from app.agents.architecture_planner.service_discovery_agent import make_service_discovery_node
        node = make_service_discovery_node(_make_mock_llm())
        result = _run(node(_make_state()))
        assert len(result["relevant_services"]) > 0
        assert result["current_node"] == "service_discovery"

    def test_terraform_mcp_available_is_false(self):
        from app.agents.architecture_planner.service_discovery_agent import make_service_discovery_node
        node = make_service_discovery_node(_make_mock_llm())
        result = _run(node(_make_state()))
        assert result["terraform_mcp_available"] is False

    def test_llm_is_called_once(self):
        from app.agents.architecture_planner.service_discovery_agent import make_service_discovery_node
        mock_llm = _make_mock_llm()
        node = make_service_discovery_node(mock_llm)
        _run(node(_make_state()))
        mock_llm.with_structured_output.assert_called_once()


class TestServiceDiscoveryNodeWithAdapter:

    def test_format_for_prompt_called_with_correct_cloud_provider(self):
        from app.agents.architecture_planner.service_discovery_agent import make_service_discovery_node
        mock_adapter = _make_mock_adapter()
        node = make_service_discovery_node(_make_mock_llm(), terraform_adapter=mock_adapter)
        _run(node(_make_state(cloud_provider="GCP")))
        mock_adapter.format_for_prompt.assert_called_once_with(cloud_provider="GCP")

    def test_adapter_called_exactly_once_per_node_invocation(self):
        from app.agents.architecture_planner.service_discovery_agent import make_service_discovery_node
        mock_adapter = _make_mock_adapter()
        node = make_service_discovery_node(_make_mock_llm(), terraform_adapter=mock_adapter)
        _run(node(_make_state()))
        assert mock_adapter.format_for_prompt.call_count == 1

    def test_terraform_mcp_available_true_when_adapter_returns_data(self):
        from app.agents.architecture_planner.service_discovery_agent import make_service_discovery_node
        mock_adapter = _make_mock_adapter("## Terraform Registry: AWS\n- aws_lambda_function [Compute]: Lambda")
        node = make_service_discovery_node(_make_mock_llm(), terraform_adapter=mock_adapter)
        result = _run(node(_make_state()))
        assert result["terraform_mcp_available"] is True

    def test_services_populated_from_llm_when_adapter_present(self):
        from app.agents.architecture_planner.service_discovery_agent import make_service_discovery_node
        mock_adapter = _make_mock_adapter()
        node = make_service_discovery_node(_make_mock_llm(), terraform_adapter=mock_adapter)
        result = _run(node(_make_state()))
        assert len(result["relevant_services"]) > 0

    def test_adapter_returning_none_sets_terraform_mcp_available_false(self):
        from app.agents.architecture_planner.service_discovery_agent import make_service_discovery_node
        mock_adapter = _make_mock_adapter(None)
        node = make_service_discovery_node(_make_mock_llm(), terraform_adapter=mock_adapter)
        result = _run(node(_make_state()))
        assert result["terraform_mcp_available"] is False

    def test_adapter_returning_none_still_calls_llm(self):
        from app.agents.architecture_planner.service_discovery_agent import make_service_discovery_node
        mock_llm = _make_mock_llm()
        mock_adapter = _make_mock_adapter(None)
        node = make_service_discovery_node(mock_llm, terraform_adapter=mock_adapter)
        result = _run(node(_make_state()))
        mock_llm.with_structured_output.assert_called_once()
        assert len(result["relevant_services"]) > 0

    def test_adapter_not_called_when_terraform_adapter_is_none(self):
        from app.agents.architecture_planner.service_discovery_agent import make_service_discovery_node
        mock_adapter = _make_mock_adapter()
        # Pass terraform_adapter=None explicitly
        node = make_service_discovery_node(_make_mock_llm(), terraform_adapter=None)
        _run(node(_make_state()))
        mock_adapter.format_for_prompt.assert_not_called()


class TestServiceDiscoveryNodePromptContent:
    """Verify terraform_context is injected into the LLM prompt correctly."""

    def _capture_prompt(self, mock_llm, mock_adapter=None) -> str:
        from app.agents.architecture_planner.service_discovery_agent import (
            make_service_discovery_node, ServiceDiscoveryOutput,
        )
        from app.agents.architecture_planner.state import ServiceEntry
        captured = []
        mock_chain = MagicMock()
        mock_llm.with_structured_output.return_value = mock_chain

        def capture_invoke(messages):
            captured.extend(messages)
            return ServiceDiscoveryOutput(services=[
                ServiceEntry(name="aws_lambda_function", category="Compute",
                             provider="AWS", description="Lambda", use_case="API")
            ])

        mock_chain.invoke.side_effect = capture_invoke
        node = make_service_discovery_node(mock_llm, terraform_adapter=mock_adapter)
        _run(node(_make_state()))
        return captured[0].content

    def test_prompt_has_terraform_section_when_adapter_returns_data(self):
        mock_llm = MagicMock()
        mock_adapter = _make_mock_adapter(
            "## Terraform Registry: Available AWS Resources (hashicorp/aws)\n"
            "- aws_lambda_function [Compute]: Lambda"
        )
        prompt = self._capture_prompt(mock_llm, mock_adapter)
        assert "Real Infrastructure Data" in prompt
        assert "aws_lambda_function" in prompt

    def test_prompt_has_no_terraform_section_without_adapter(self):
        mock_llm = MagicMock()
        prompt = self._capture_prompt(mock_llm)
        assert "Real Infrastructure Data" not in prompt
        assert "Terraform Registry" not in prompt

    def test_prompt_has_no_terraform_section_when_adapter_returns_none(self):
        mock_llm = MagicMock()
        prompt = self._capture_prompt(mock_llm, _make_mock_adapter(None))
        assert "Real Infrastructure Data" not in prompt

    def test_prompt_contains_cloud_provider_from_state(self):
        mock_llm = MagicMock()
        prompt = self._capture_prompt(mock_llm)
        assert "AWS" in prompt

    def test_prompt_contains_query_results(self):
        mock_llm = MagicMock()
        mock_adapter = _make_mock_adapter()
        from app.agents.architecture_planner.service_discovery_agent import (
            make_service_discovery_node, ServiceDiscoveryOutput,
        )
        from app.agents.architecture_planner.state import ServiceEntry
        captured = []
        mock_chain = MagicMock()
        mock_llm.with_structured_output.return_value = mock_chain

        def capture_invoke(messages):
            captured.extend(messages)
            return ServiceDiscoveryOutput(services=[
                ServiceEntry(name="aws_lambda_function", category="Compute",
                             provider="AWS", description="Lambda", use_case="API")
            ])

        mock_chain.invoke.side_effect = capture_invoke
        node = make_service_discovery_node(mock_llm, terraform_adapter=mock_adapter)
        _run(node(_make_state(query_results="Unique_Query_Content_XYZ789")))
        assert "Unique_Query_Content_XYZ789" in captured[0].content


class TestServiceDiscoveryNodeErrorHandling:

    def test_llm_api_rate_limit_error_returns_empty_services(self):
        import anthropic
        from app.agents.architecture_planner.service_discovery_agent import make_service_discovery_node
        mock_llm = MagicMock()
        mock_chain = MagicMock()
        mock_llm.with_structured_output.return_value = mock_chain
        mock_chain.invoke.side_effect = anthropic.RateLimitError(
            message="rate limit",
            response=MagicMock(status_code=429, headers={}),
            body={},
        )
        node = make_service_discovery_node(mock_llm)
        result = _run(node(_make_state()))
        assert result["relevant_services"] == []
        assert result["error_message"] is not None
        assert "RateLimitError" in result["error_message"]
        assert result["current_node"] == "service_discovery"

    def test_llm_api_error_with_adapter_reports_terraform_mcp_available_correctly(self):
        import anthropic
        from app.agents.architecture_planner.service_discovery_agent import make_service_discovery_node
        mock_llm = MagicMock()
        mock_chain = MagicMock()
        mock_llm.with_structured_output.return_value = mock_chain
        mock_chain.invoke.side_effect = anthropic.RateLimitError(
            message="rate limit",
            response=MagicMock(status_code=429, headers={}),
            body={},
        )
        # Adapter has data → terraform_mcp_available should be True even on LLM error
        mock_adapter = _make_mock_adapter("some terraform data")
        node = make_service_discovery_node(mock_llm, terraform_adapter=mock_adapter)
        result = _run(node(_make_state()))
        assert result["terraform_mcp_available"] is True
        assert result["relevant_services"] == []

    def test_generic_llm_error_triggers_ollama_json_fallback(self):
        from app.agents.architecture_planner.service_discovery_agent import make_service_discovery_node
        from app.agents.architecture_planner.state import ServiceEntry
        services_json = json.dumps({
            "services": [
                {"name": "aws_lambda_function", "category": "Compute",
                 "provider": "AWS", "description": "Lambda", "use_case": "API"}
            ]
        })
        mock_llm = MagicMock()
        mock_chain = MagicMock()
        mock_llm.with_structured_output.return_value = mock_chain
        mock_chain.invoke.side_effect = ValueError("structured output failed")
        mock_llm.invoke.return_value = MagicMock(content=services_json)

        node = make_service_discovery_node(mock_llm)
        result = _run(node(_make_state()))
        assert len(result["relevant_services"]) == 1
        assert result["relevant_services"][0].name == "aws_lambda_function"

    def test_complete_llm_failure_returns_error_dict(self):
        from app.agents.architecture_planner.service_discovery_agent import make_service_discovery_node
        mock_llm = MagicMock()
        mock_chain = MagicMock()
        mock_llm.with_structured_output.return_value = mock_chain
        mock_chain.invoke.side_effect = ValueError("structured output failed")
        mock_llm.invoke.return_value = MagicMock(content="not valid json !!!")

        node = make_service_discovery_node(mock_llm)
        result = _run(node(_make_state()))
        assert result["relevant_services"] == []
        assert result["error_message"] is not None
        assert result["current_node"] == "service_discovery"


class TestServiceDiscoveryNodeResultStructure:

    def test_result_contains_all_required_keys(self):
        from app.agents.architecture_planner.service_discovery_agent import make_service_discovery_node
        node = make_service_discovery_node(_make_mock_llm())
        result = _run(node(_make_state()))
        assert "relevant_services" in result
        assert "terraform_mcp_available" in result
        assert "current_node" in result

    def test_current_node_is_service_discovery(self):
        from app.agents.architecture_planner.service_discovery_agent import make_service_discovery_node
        node = make_service_discovery_node(_make_mock_llm())
        result = _run(node(_make_state()))
        assert result["current_node"] == "service_discovery"

    def test_service_entries_have_all_fields(self):
        from app.agents.architecture_planner.service_discovery_agent import make_service_discovery_node
        node = make_service_discovery_node(_make_mock_llm())
        result = _run(node(_make_state()))
        for svc in result["relevant_services"]:
            assert svc.name
            assert svc.category
            assert svc.provider
            assert svc.description
            assert svc.use_case

    def test_node_is_async_callable(self):
        import inspect
        from app.agents.architecture_planner.service_discovery_agent import make_service_discovery_node
        node = make_service_discovery_node(_make_mock_llm())
        assert inspect.iscoroutinefunction(node)


# ===========================================================================
# Section 5 — Prompt template rendering
# ===========================================================================


class TestServiceDiscoveryPromptTemplate:

    def _render(self, terraform_context=None, **kw):
        from app.agents.architecture_planner.prompts import render_prompt
        defaults = dict(
            cloud_provider="AWS",
            query_results="Research about AWS.",
            budget="$10k",
            traffic="100 RPS",
            availability="99%",
            terraform_context=terraform_context,
        )
        defaults.update(kw)
        return render_prompt("service_discovery", **defaults)

    def test_without_terraform_context_no_registry_section(self):
        rendered = self._render(terraform_context=None)
        assert "Real Infrastructure Data" not in rendered
        assert "Terraform Registry data" not in rendered

    def test_with_terraform_context_registry_section_present(self):
        rendered = self._render(
            terraform_context="## Terraform Registry: Available AWS Resources (hashicorp/aws)\n- aws_lambda_function [Compute]: Lambda"
        )
        assert "Real Infrastructure Data" in rendered
        assert "aws_lambda_function" in rendered

    def test_instructions_reference_terraform_data_when_context_present(self):
        rendered = self._render(terraform_context="some data")
        assert "Terraform Registry data" in rendered

    def test_instructions_do_not_reference_terraform_when_absent(self):
        rendered = self._render(terraform_context=None)
        assert "Terraform Registry data" not in rendered

    def test_cloud_provider_variable_injected(self):
        rendered = self._render(cloud_provider="GCP", terraform_context=None)
        assert "GCP" in rendered

    def test_query_results_injected(self):
        rendered = self._render(query_results="UNIQUE_MARKER_9x7k")
        assert "UNIQUE_MARKER_9x7k" in rendered

    def test_output_json_schema_present(self):
        rendered = self._render()
        assert '"services"' in rendered
        assert '"name"' in rendered
        assert '"category"' in rendered

    def test_terraform_content_appears_before_instructions(self):
        tf_context = "TERRAFORM_CONTENT_MARKER"
        rendered = self._render(terraform_context=tf_context)
        tf_pos = rendered.index("TERRAFORM_CONTENT_MARKER")
        instr_pos = rendered.index("## Instructions")
        assert tf_pos < instr_pos


# ===========================================================================
# Section 6 — State fields
# ===========================================================================


class TestStateFields:

    def test_make_initial_state_includes_terraform_mcp_available(self):
        from app.agents.architecture_planner.state import make_initial_state
        state = make_initial_state(
            budget="$10k", traffic="100 RPS", availability="99%",
            prd="Test PRD", cloud_provider="AWS",
        )
        assert "terraform_mcp_available" in state
        assert state["terraform_mcp_available"] is False

    def test_architecture_planner_state_type_annotation_exists(self):
        from app.agents.architecture_planner.state import ArchitecturePlannerState
        assert "terraform_mcp_available" in ArchitecturePlannerState.__annotations__


# ===========================================================================
# Section 7 — graph.py wiring
# ===========================================================================


class TestCreateGraphWiring:

    def test_create_graph_accepts_terraform_mcp_cmd_param(self):
        import inspect
        from app.agents.architecture_planner.graph import create_graph
        sig = inspect.signature(create_graph)
        assert "terraform_mcp_cmd" in sig.parameters

    def test_terraform_mcp_cmd_defaults_to_none(self):
        import inspect
        from app.agents.architecture_planner.graph import create_graph
        param = inspect.signature(create_graph).parameters["terraform_mcp_cmd"]
        assert param.default is None

    def test_adapter_instantiated_and_passed_to_service_discovery_when_cmd_provided(self):
        """
        When terraform_mcp_cmd is given, TerraformMCPAdapter must be constructed with
        that cmd and passed as terraform_adapter to make_service_discovery_node.

        TerraformMCPAdapter is a lazy local import inside create_graph, so we patch
        at the source module (app.agents.architecture_planner.terraform_mcp).
        """
        from app.agents.architecture_planner.terraform_mcp import TerraformMCPAdapter

        cmd = ["npx", "-y", "@hashicorp/terraform-mcp-server"]
        captured_node_kwargs = {}

        def capture_make_node(llm, terraform_adapter=None):
            captured_node_kwargs["terraform_adapter"] = terraform_adapter
            return MagicMock()

        mock_adapter_instance = MagicMock(spec=TerraformMCPAdapter)
        MockAdapter = MagicMock(return_value=mock_adapter_instance)

        with patch("app.agents.architecture_planner.terraform_mcp.TerraformMCPAdapter", MockAdapter), \
             patch("app.agents.architecture_planner.graph._build_llm", return_value=MagicMock()), \
             patch("app.agents.architecture_planner.graph.init_kuzu", return_value=None), \
             patch("app.agents.architecture_planner.graph.build_kg_subgraph", return_value=MagicMock()), \
             patch("app.agents.architecture_planner.graph.build_info_gathering_subgraph", return_value=MagicMock()), \
             patch("app.agents.architecture_planner.graph.build_query_subgraph", return_value=MagicMock()), \
             patch("app.agents.architecture_planner.graph.build_arch_review_subgraph", return_value=MagicMock()), \
             patch("app.agents.architecture_planner.graph.build_accept_subgraph", return_value=MagicMock()), \
             patch("app.agents.architecture_planner.graph.make_service_discovery_node", side_effect=capture_make_node), \
             patch("app.agents.architecture_planner.graph.StateGraph") as MockStateGraph, \
             patch("app.agents.architecture_planner.graph.MemorySaver"):

            mock_builder = MagicMock()
            MockStateGraph.return_value = mock_builder
            mock_builder.compile.return_value = MagicMock()

            from importlib import reload
            import app.agents.architecture_planner.graph as graph_mod
            graph_mod.create_graph(terraform_mcp_cmd=cmd)

        # Adapter was constructed with the provided cmd
        MockAdapter.assert_called_once_with(cmd=cmd)
        # Adapter instance was passed to make_service_discovery_node
        assert captured_node_kwargs.get("terraform_adapter") is mock_adapter_instance

    def test_no_adapter_when_cmd_is_none(self):
        """When terraform_mcp_cmd=None, make_service_discovery_node gets terraform_adapter=None."""
        captured_node_kwargs = {}

        def capture_make_node(llm, terraform_adapter=None):
            captured_node_kwargs["terraform_adapter"] = terraform_adapter
            return MagicMock()

        with patch("app.agents.architecture_planner.graph._build_llm", return_value=MagicMock()), \
             patch("app.agents.architecture_planner.graph.init_kuzu", return_value=None), \
             patch("app.agents.architecture_planner.graph.build_kg_subgraph", return_value=MagicMock()), \
             patch("app.agents.architecture_planner.graph.build_info_gathering_subgraph", return_value=MagicMock()), \
             patch("app.agents.architecture_planner.graph.build_query_subgraph", return_value=MagicMock()), \
             patch("app.agents.architecture_planner.graph.build_arch_review_subgraph", return_value=MagicMock()), \
             patch("app.agents.architecture_planner.graph.build_accept_subgraph", return_value=MagicMock()), \
             patch("app.agents.architecture_planner.graph.make_service_discovery_node", side_effect=capture_make_node), \
             patch("app.agents.architecture_planner.graph.StateGraph") as MockStateGraph, \
             patch("app.agents.architecture_planner.graph.MemorySaver"):

            mock_builder = MagicMock()
            MockStateGraph.return_value = mock_builder
            mock_builder.compile.return_value = MagicMock()

            import app.agents.architecture_planner.graph as graph_mod
            graph_mod.create_graph(terraform_mcp_cmd=None)

        assert captured_node_kwargs.get("terraform_adapter") is None


# ===========================================================================
# Section 8 — Protocol conformance
# ===========================================================================


class TestTerraformMCPProviderProtocol:

    def test_adapter_satisfies_provider_protocol(self):
        from app.agents.architecture_planner.terraform_mcp import (
            TerraformMCPAdapter, TerraformMCPProvider,
        )
        adapter = TerraformMCPAdapter(cmd=["fake-cmd"])
        assert isinstance(adapter, TerraformMCPProvider)

    def test_protocol_exposes_get_provider_context(self):
        from app.agents.architecture_planner.terraform_mcp.base import TerraformMCPProvider
        assert hasattr(TerraformMCPProvider, "get_provider_context")

    def test_protocol_exposes_format_for_prompt(self):
        from app.agents.architecture_planner.terraform_mcp.base import TerraformMCPProvider
        assert hasattr(TerraformMCPProvider, "format_for_prompt")

    def test_async_mock_duck_types_as_provider(self):
        """A minimal duck-typed stub also satisfies the Protocol."""
        from app.agents.architecture_planner.terraform_mcp.base import TerraformMCPProvider

        class _Stub:
            async def get_provider_context(self, cloud_provider, resource_filter=None, max_resources=50):
                return None

            async def format_for_prompt(self, cloud_provider, resource_filter=None, max_resources=50):
                return None

        assert isinstance(_Stub(), TerraformMCPProvider)
