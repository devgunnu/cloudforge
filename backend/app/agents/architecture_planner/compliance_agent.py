from __future__ import annotations

import json
import logging

from langchain_core.messages import HumanMessage
from pydantic import BaseModel

from app.agents.architecture_planner.state import (
    ArchitecturePlannerState,
    ComplianceGap,
)
from app.agents.architecture_planner.prompts import render_prompt
from app.agents.architecture_planner.llm_utils import API_ERROR_TYPES

logger = logging.getLogger(__name__)

__all__ = ["make_compliance_node"]


class ComplianceOutput(BaseModel):
    gaps: list[ComplianceGap]
    passed: bool


def make_compliance_node(llm):
    """Factory that returns a compliance_node bound to the provided LLM."""

    def compliance_node(state: ArchitecturePlannerState) -> dict:
        logger.info("[compliance] starting")
        if state["architecture_diagram"] is None:
            return {
                "compliance_gaps": [],
                "compliance_passed": False,
                "current_node": "compliance",
                "error_message": "Cannot run compliance check: architecture diagram is missing.",
            }

        cost_data: str | None = None
        # Cost data enrichment removed — use compliance MCP when configured

        architecture_diagram_json = state["architecture_diagram"].model_dump_json(by_alias=True)

        prompt = render_prompt(
            "compliance",
            prd=state["prd"],
            nfr_document=state["nfr_document"],
            architecture_diagram=architecture_diagram_json,
            extra_context=state["extra_context"],
            budget=state["budget"],
            traffic=state["traffic"],
            availability=state["availability"],
            cost_data=cost_data,
        )
        messages = [HumanMessage(content=prompt)]

        try:
            result = llm.with_structured_output(ComplianceOutput).invoke(messages)
        except API_ERROR_TYPES as exc:
            return {
                "compliance_gaps": [],
                "compliance_passed": False,
                "current_node": "compliance",
                "error_message": f"LLM API error ({type(exc).__name__}): {exc}",
            }
        except Exception:
            # Structured output fallback: attempt raw JSON parse
            try:
                raw = llm.invoke(messages).content
                raw = raw.strip()
                if raw.startswith("```"):
                    raw = raw.split("```")[1]
                    if raw.startswith("json"):
                        raw = raw[4:]
                result = ComplianceOutput.model_validate(json.loads(raw.strip()))
            except API_ERROR_TYPES as exc:
                return {
                    "compliance_gaps": [],
                    "compliance_passed": False,
                    "current_node": "compliance",
                    "error_message": f"LLM API error ({type(exc).__name__}): {exc}",
                }
            except Exception as e2:
                return {
                    "compliance_gaps": [],
                    "compliance_passed": False,
                    "current_node": "compliance",
                    "error_message": f"Compliance check failed: {str(e2)}",
                }

        critical = sum(1 for g in result.gaps if getattr(g, "severity", None) == "CRITICAL")
        logger.info("[compliance] done — gaps=%d critical=%d passed=%s", len(result.gaps), critical, result.passed)
        return {
            "compliance_gaps": result.gaps,
            "compliance_passed": result.passed,
            "current_node": "compliance",
        }

    return compliance_node
