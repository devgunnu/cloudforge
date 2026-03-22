from __future__ import annotations

import json

from langchain_core.messages import HumanMessage
from pydantic import BaseModel

from app.agents.architecture_planner.state import (
    ArchitecturePlannerState,
    ArchitectureDiagram,
    ArchNode,
)
from app.agents.architecture_planner.prompts import render_prompt
from app.agents.architecture_planner.llm_utils import API_ERROR_TYPES

__all__ = ["make_architecture_node"]


class ArchitectureOutput(BaseModel):
    architecture_diagram: ArchitectureDiagram
    nfr_document: str
    component_responsibilities: str
    extra_context: str


def make_architecture_node(llm):
    """Factory that returns an architecture_node bound to the provided LLM."""

    def architecture_node(state: ArchitecturePlannerState) -> dict:
        prompt = render_prompt(
            "architecture",
            budget=state["budget"],
            traffic=state["traffic"],
            availability=state["availability"],
            prd=state["prd"],
            cloud_provider=state["cloud_provider"],
            query_results=state["query_results"],
            kg_explanation=state["kg_explanation"],
            relevant_services=[s.model_dump() for s in state["relevant_services"]],
            arch_iteration_count=state["arch_iteration_count"],
            compliance_gaps=[g.model_dump() for g in state["compliance_gaps"]],
            eval_feedback=state["eval_feedback"],
            user_change_requests=state["user_change_requests"],
        )
        messages = [HumanMessage(content=prompt)]

        try:
            result = llm.with_structured_output(ArchitectureOutput).invoke(messages)
        except API_ERROR_TYPES as exc:
            dummy_diagram = state.get("architecture_diagram") or ArchitectureDiagram(
                nodes=[
                    ArchNode(
                        id="placeholder",
                        service="Unknown",
                        provider=state["cloud_provider"],
                        description="Placeholder — architecture generation failed.",
                    )
                ],
                connections=[],
            )
            return {
                "architecture_diagram": dummy_diagram,
                "nfr_document": state.get("nfr_document", ""),
                "component_responsibilities": state.get("component_responsibilities", ""),
                "extra_context": state.get("extra_context", ""),
                "arch_iteration_count": state["arch_iteration_count"] + 1,
                "current_node": "architecture",
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
                result = ArchitectureOutput.model_validate(json.loads(raw.strip()))
            except API_ERROR_TYPES as exc:
                dummy_diagram = state.get("architecture_diagram") or ArchitectureDiagram(
                    nodes=[
                        ArchNode(
                            id="placeholder",
                            service="Unknown",
                            provider=state["cloud_provider"],
                            description="Placeholder — architecture generation failed.",
                        )
                    ],
                    connections=[],
                )
                return {
                    "architecture_diagram": dummy_diagram,
                    "nfr_document": state.get("nfr_document", ""),
                    "component_responsibilities": state.get("component_responsibilities", ""),
                    "extra_context": state.get("extra_context", ""),
                    "arch_iteration_count": state["arch_iteration_count"] + 1,
                    "current_node": "architecture",
                    "error_message": f"LLM API error ({type(exc).__name__}): {exc}",
                }
            except Exception as e2:
                # Build a minimal dummy diagram so downstream nodes don't break
                dummy_diagram = state.get("architecture_diagram") or ArchitectureDiagram(
                    nodes=[
                        ArchNode(
                            id="placeholder",
                            service="Unknown",
                            provider=state["cloud_provider"],
                            description="Placeholder — architecture generation failed.",
                        )
                    ],
                    connections=[],
                )
                return {
                    "architecture_diagram": dummy_diagram,
                    "nfr_document": state.get("nfr_document", ""),
                    "component_responsibilities": state.get("component_responsibilities", ""),
                    "extra_context": state.get("extra_context", ""),
                    "arch_iteration_count": state["arch_iteration_count"] + 1,
                    "current_node": "architecture",
                    "error_message": f"Architecture generation failed: {str(e2)}",
                }

        return {
            "architecture_diagram": result.architecture_diagram,
            "nfr_document": result.nfr_document,
            "component_responsibilities": result.component_responsibilities,
            "extra_context": result.extra_context,
            "arch_iteration_count": state["arch_iteration_count"] + 1,
            "current_node": "architecture",
        }

    return architecture_node
