from __future__ import annotations
import json
import logging
from langchain_core.messages import HumanMessage

logger = logging.getLogger(__name__)
from pydantic import BaseModel
from app.agents.architecture_planner.state import ArchitecturePlannerState
from app.agents.architecture_planner.prompts import render_prompt
from app.agents.architecture_planner.llm_utils import API_ERROR_TYPES, invoke_with_retry
from app.agents.architecture_planner.analysis.arch_rules import (
    find_request_paths_with_latency,
    detect_diagram_spofs,
    identify_cascade_risks,
)

__all__ = ["make_arch_simulator_node"]


class ServiceThroughput(BaseModel):
    node_id: str
    service: str
    estimated_rps: int
    utilization_pct: int
    bottleneck: bool


class ArchSimulationResult(BaseModel):
    request_paths: list[dict]          # from arch_rules (already computed)
    spofs: list[dict]                  # from arch_rules
    cascade_risks: list[dict]          # from arch_rules
    service_throughput: list[ServiceThroughput]
    overall_bottleneck: str
    capacity_headroom_pct: int         # 0-100
    executive_summary: str


def make_arch_simulator_node(llm):
    def arch_simulator_node(state: ArchitecturePlannerState) -> dict:
        logger.info("[arch_simulator] starting deterministic pre-compute")
        if state.get("architecture_diagram") is None:
            logger.warning("[arch_simulator] no diagram, skipping")
            return {"arch_simulation": None, "current_node": "arch_simulator"}

        diagram_dict = state["architecture_diagram"].model_dump(by_alias=True)

        # Deterministic pre-computation
        paths = find_request_paths_with_latency(diagram_dict)
        spofs = detect_diagram_spofs(diagram_dict)
        cascade_risks = identify_cascade_risks(diagram_dict)

        # Build deterministic fallback result
        nodes = diagram_dict.get("nodes", [])
        fallback_throughput = [
            ServiceThroughput(
                node_id=n["id"],
                service=n.get("service", n["id"]),
                estimated_rps=0,
                utilization_pct=0,
                bottleneck=False,
            )
            for n in nodes
        ]
        deterministic_result = {
            "request_paths": paths,
            "spofs": spofs,
            "cascade_risks": cascade_risks,
            "service_throughput": [t.model_dump() for t in fallback_throughput],
            "overall_bottleneck": spofs[0]["service"] if spofs else "None identified",
            "capacity_headroom_pct": 50,
            "executive_summary": f"Deterministic analysis: {len(paths)} request paths, {len(spofs)} SPOFs, {len(cascade_risks)} cascade risks identified.",
        }

        # LLM enrichment (optional — fallback to deterministic on failure)
        try:
            prompt = render_prompt(
                "arch_simulation",
                architecture_diagram=json.dumps(diagram_dict),
                request_paths=json.dumps(paths, indent=2),
                spofs=json.dumps(spofs, indent=2),
                cascade_risks=json.dumps(cascade_risks, indent=2),
                budget=state["budget"],
                traffic=state["traffic"],
                availability=state["availability"],
                nodes=nodes,
            )
            messages = [HumanMessage(content=prompt)]

            class SimLLMOutput(BaseModel):
                service_throughput: list[ServiceThroughput]
                overall_bottleneck: str
                capacity_headroom_pct: int
                executive_summary: str

            result = invoke_with_retry(
                lambda: llm.with_structured_output(SimLLMOutput).invoke(messages)
            )
            final = {
                "request_paths": paths,
                "spofs": spofs,
                "cascade_risks": cascade_risks,
                "service_throughput": [t.model_dump() for t in result.service_throughput],
                "overall_bottleneck": result.overall_bottleneck,
                "capacity_headroom_pct": result.capacity_headroom_pct,
                "executive_summary": result.executive_summary,
            }
        except Exception as exc:
            logger.warning("[arch_simulator] LLM enrichment failed (%s), using deterministic result", exc)
            final = deterministic_result

        logger.info("[arch_simulator] done — spofs=%d cascades=%d paths=%d", len(spofs), len(cascade_risks), len(paths))
        return {"arch_simulation": final, "current_node": "arch_simulator"}

    return arch_simulator_node
