from __future__ import annotations

import asyncio
import json
import logging

logger = logging.getLogger(__name__)

_JSONRPC_VERSION = "2.0"
_MCP_PROTOCOL_VERSION = "2024-11-05"


class MCPClientError(Exception):
    """Raised when the MCP subprocess returns a protocol error or is unreachable."""


class TerraformMCPClient:
    """
    Minimal async stdio client for any MCP server launched as a subprocess.

    Manages the subprocess lifecycle within a single async context manager.
    Each call() sends one JSON-RPC request and reads one response.

    Usage::

        async with TerraformMCPClient(cmd=["npx", "-y", "@hashicorp/terraform-mcp-server"]) as client:
            result = await client.call(
                "list_terraform_registry_provider_resources",
                {"provider": "hashicorp/aws"},
            )

    Args:
        cmd:          Command + arguments to launch the MCP server subprocess.
        timeout:      Per-call read timeout in seconds (default: 30).
        init_timeout: Timeout for the MCP initialize handshake (default: 15).
    """

    def __init__(
        self,
        cmd: list[str],
        timeout: float = 30.0,
        init_timeout: float = 15.0,
    ) -> None:
        self._cmd = cmd
        self._timeout = timeout
        self._init_timeout = init_timeout
        self._process: asyncio.subprocess.Process | None = None
        self._next_id: int = 1

    # ------------------------------------------------------------------
    # Context manager
    # ------------------------------------------------------------------

    async def __aenter__(self) -> "TerraformMCPClient":
        await self._start()
        return self

    async def __aexit__(self, *_: object) -> None:
        await self._stop()

    # ------------------------------------------------------------------
    # Public API
    # ------------------------------------------------------------------

    async def call(self, tool_name: str, arguments: dict) -> dict:
        """
        Invoke a single MCP tool and return the parsed result dict.

        Raises:
            MCPClientError: On protocol errors or malformed responses.
        """
        msg_id = self._next_id
        self._next_id += 1
        await self._send({
            "jsonrpc": _JSONRPC_VERSION,
            "id": msg_id,
            "method": "tools/call",
            "params": {"name": tool_name, "arguments": arguments},
        })
        response = await asyncio.wait_for(self._read_response(), timeout=self._timeout)
        if "error" in response:
            raise MCPClientError(
                f"MCP tool error for {tool_name!r}: {response['error']}"
            )
        return response.get("result", {})

    # ------------------------------------------------------------------
    # Internal helpers
    # ------------------------------------------------------------------

    async def _start(self) -> None:
        self._process = await asyncio.create_subprocess_exec(
            *self._cmd,
            stdin=asyncio.subprocess.PIPE,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE,
        )
        await asyncio.wait_for(self._initialize(), timeout=self._init_timeout)

    async def _stop(self) -> None:
        if self._process and self._process.returncode is None:
            try:
                self._process.stdin.close()
                await asyncio.wait_for(self._process.wait(), timeout=5.0)
            except Exception:
                self._process.kill()

    async def _initialize(self) -> None:
        """Perform the MCP initialize / initialized handshake."""
        await self._send({
            "jsonrpc": _JSONRPC_VERSION,
            "id": self._next_id,
            "method": "initialize",
            "params": {
                "protocolVersion": _MCP_PROTOCOL_VERSION,
                "capabilities": {},
                "clientInfo": {"name": "cloudforge", "version": "0.1.0"},
            },
        })
        self._next_id += 1
        await self._read_response()  # consume the initialize response
        # Send initialized notification — no response expected
        await self._send({
            "jsonrpc": _JSONRPC_VERSION,
            "method": "notifications/initialized",
            "params": {},
        })

    async def _send(self, msg: dict) -> None:
        payload = (json.dumps(msg) + "\n").encode()
        self._process.stdin.write(payload)
        await self._process.stdin.drain()

    async def _read_response(self) -> dict:
        line = await self._process.stdout.readline()
        if not line:
            raise MCPClientError("MCP subprocess closed stdout unexpectedly")
        return json.loads(line.decode())


__all__ = ["TerraformMCPClient", "MCPClientError"]
