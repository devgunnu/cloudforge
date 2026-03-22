from __future__ import annotations

import asyncio
import json
import logging

from langchain_core.messages import HumanMessage
from pydantic import BaseModel

from app.agents.architecture_planner.state import (
    ArchitecturePlannerState,
    ServiceEntry,
)
from app.agents.architecture_planner.prompts import render_prompt
from app.agents.architecture_planner.llm_utils import API_ERROR_TYPES, invoke_with_retry

logger = logging.getLogger(__name__)

__all__ = ["make_service_discovery_node"]


class ServiceDiscoveryOutput(BaseModel):
    services: list[ServiceEntry]


def make_service_discovery_node(llm, terraform_adapter=None):
    """
    Factory returning a service_discovery_node bound to the provided LLM.

    Args:
        llm:               Any LangChain chat model.
        terraform_adapter: Optional object satisfying the TerraformMCPProvider
                           Protocol. When provided, the node fetches real
                           Terraform resource data from the MCP server and
                           injects it into the prompt before calling the LLM.
                           When None (default), the node falls back to LLM-only
                           behaviour identical to the original implementation.
    """

    def service_discovery_node(state: ArchitecturePlannerState) -> dict:
        logger.info("[service_discovery] starting — mcp_adapter=%s", terraform_adapter is not None)
        # ------------------------------------------------------------------
        # Step 1: Fetch MCP context via adapter (async, cached, never raises)
        # ------------------------------------------------------------------
        mcp_context: str | None = None
        if terraform_adapter is not None:
            mcp_context = asyncio.run(terraform_adapter.format_for_prompt(
                cloud_provider=state["cloud_provider"],
            ))

        # ------------------------------------------------------------------
        # Step 2: Render prompt — mcp_context may be None (Jinja handles it)
        # ------------------------------------------------------------------
        prompt = render_prompt(
            "service_discovery",
            cloud_provider=state["cloud_provider"],
            research_results=state.get("research_results", ""),
            budget=state["budget"],
            traffic=state["traffic"],
            availability=state["availability"],
            terraform_context=mcp_context,
        )
        messages = [HumanMessage(content=prompt)]

        # ------------------------------------------------------------------
        # Step 3: LLM invocation with structured output + JSON parse fallback
        # ------------------------------------------------------------------
        try:
            result = invoke_with_retry(
                lambda: llm.with_structured_output(ServiceDiscoveryOutput).invoke(messages)
            )
        except API_ERROR_TYPES as exc:
            return {
                "relevant_services": [],
                "mcp_available": mcp_context is not None,
                "current_node": "service_discovery",
                "error_message": f"LLM API error ({type(exc).__name__}): {exc}",
            }
        except Exception:
            # Structured output fallback: attempt raw JSON parse
            try:
                raw = invoke_with_retry(lambda: llm.invoke(messages)).content
                raw = raw.strip()
                if raw.startswith("```"):
                    raw = raw.split("```")[1]
                    if raw.startswith("json"):
                        raw = raw[4:]
                result = ServiceDiscoveryOutput.model_validate(json.loads(raw.strip()))
            except API_ERROR_TYPES as exc:
                return {
                    "relevant_services": [],
                    "mcp_available": mcp_context is not None,
                    "current_node": "service_discovery",
                    "error_message": f"LLM API error ({type(exc).__name__}): {exc}",
                }
            except Exception as e2:
                return {
                    "relevant_services": [],
                    "mcp_available": mcp_context is not None,
                    "current_node": "service_discovery",
                    "error_message": f"Service discovery failed: {str(e2)}",
                }

        logger.info("[service_discovery] done — %d services", len(result.services))
        return {
            "relevant_services": result.services,
            "mcp_available": mcp_context is not None,
            "current_node": "service_discovery",
        }

    return service_discovery_node
