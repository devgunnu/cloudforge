from __future__ import annotations

import json

from langchain_core.messages import HumanMessage
from pydantic import BaseModel

from app.agents.architecture_planner.state import (
    ArchitecturePlannerState,
    ServiceEntry,
)
from app.agents.architecture_planner.prompts import render_prompt
from app.agents.architecture_planner.llm_utils import API_ERROR_TYPES

__all__ = ["make_service_discovery_node"]


class ServiceDiscoveryOutput(BaseModel):
    services: list[ServiceEntry]


def make_service_discovery_node(llm):
    """Factory that returns a service_discovery_node bound to the provided LLM."""

    def service_discovery_node(state: ArchitecturePlannerState) -> dict:
        prompt = render_prompt(
            "service_discovery",
            cloud_provider=state["cloud_provider"],
            query_results=state["query_results"],
            budget=state["budget"],
            traffic=state["traffic"],
            availability=state["availability"],
        )
        messages = [HumanMessage(content=prompt)]

        try:
            result = llm.with_structured_output(ServiceDiscoveryOutput).invoke(messages)
        except API_ERROR_TYPES as exc:
            return {
                "relevant_services": [],
                "current_node": "service_discovery",
                "error_message": f"LLM API error ({type(exc).__name__}): {exc}",
            }
        except Exception:
            # Ollama / plain-text LLM fallback: attempt raw JSON parse
            try:
                raw = llm.invoke(messages).content
                raw = raw.strip()
                if raw.startswith("```"):
                    raw = raw.split("```")[1]
                    if raw.startswith("json"):
                        raw = raw[4:]
                result = ServiceDiscoveryOutput.model_validate(json.loads(raw.strip()))
            except API_ERROR_TYPES as exc:
                return {
                    "relevant_services": [],
                    "current_node": "service_discovery",
                    "error_message": f"LLM API error ({type(exc).__name__}): {exc}",
                }
            except Exception as e2:
                return {
                    "relevant_services": [],
                    "current_node": "service_discovery",
                    "error_message": f"Service discovery failed: {str(e2)}",
                }

        return {
            "relevant_services": result.services,
            "current_node": "service_discovery",
        }

    return service_discovery_node
