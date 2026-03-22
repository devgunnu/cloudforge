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
    detect_diagram_spofs,
    identify_cascade_risks,
)

__all__ = ["make_resilience_simulator_node"]


class ResilienceSimulationResult(BaseModel):
    spof_count: int
    high_cascade_count: int
    resilience_score: int             # 0-10
    critical_vulnerabilities: list[str]
    rpo_rto_feasible: bool
    executive_summary: str


def make_resilience_simulator_node(llm):
    def resilience_simulator_node(state: ArchitecturePlannerState) -> dict:
        logger.info("[resilience_simulator] starting")
        if state.get("architecture_diagram") is None:
            logger.warning("[resilience_simulator] no diagram, skipping")
            return {"resilience_simulation": None, "current_node": "resilience_simulator"}

        diagram_dict = state["architecture_diagram"].model_dump(by_alias=True)
        spofs = detect_diagram_spofs(diagram_dict)
        cascade_risks = identify_cascade_risks(diagram_dict)

        critical_spofs = [s for s in spofs if s["severity"] == "CRITICAL"]
        high_cascades = [c for c in cascade_risks if c["severity"] == "HIGH"]

        # Deterministic score: start at 10, deduct for issues
        det_score = max(0, 10 - len(critical_spofs) * 2 - len(high_cascades) * 1)
        det_vulns = (
            [f"SPOF: {s['service']} — {s['reason']}" for s in critical_spofs]
            + [f"Cascade: {c['source_service']} chain ({c['length']} hops)" for c in high_cascades]
        )

        deterministic_result = ResilienceSimulationResult(
            spof_count=len(spofs),
            high_cascade_count=len(high_cascades),
            resilience_score=det_score,
            critical_vulnerabilities=det_vulns or ["None identified"],
            rpo_rto_feasible=det_score >= 6,
            executive_summary=(
                f"Deterministic analysis: {len(spofs)} SPOFs ({len(critical_spofs)} critical), "
                f"{len(cascade_risks)} cascade risks ({len(high_cascades)} high). "
                f"Score: {det_score}/10."
            ),
        )

        # LLM enrichment
        try:
            prompt = render_prompt(
                "resilience_simulation",
                architecture_diagram=json.dumps(diagram_dict),
                spofs=json.dumps(spofs, indent=2),
                cascade_risks=json.dumps(cascade_risks, indent=2),
                availability=state["availability"],
                nfr_document=state.get("nfr_document", ""),
            )
            messages = [HumanMessage(content=prompt)]

            class ResLLMOutput(BaseModel):
                resilience_score: int
                critical_vulnerabilities: list[str]
                rpo_rto_feasible: bool
                executive_summary: str

            result = invoke_with_retry(
                lambda: llm.with_structured_output(ResLLMOutput).invoke(messages)
            )
            final = ResilienceSimulationResult(
                spof_count=len(spofs),
                high_cascade_count=len(high_cascades),
                resilience_score=result.resilience_score,
                critical_vulnerabilities=result.critical_vulnerabilities,
                rpo_rto_feasible=result.rpo_rto_feasible,
                executive_summary=result.executive_summary,
            )
        except Exception as exc:
            logger.warning("[resilience_simulator] LLM enrichment failed (%s), using deterministic result", exc)
            final = deterministic_result

        logger.info("[resilience_simulator] done — score=%d spofs=%d cascades=%d", final.resilience_score, final.spof_count, final.high_cascade_count)
        return {"resilience_simulation": final.model_dump(), "current_node": "resilience_simulator"}

    return resilience_simulator_node
