from __future__ import annotations
import logging
from langgraph.types import Command
from app.agents.architecture_planner.state import ArchitecturePlannerState, ArchTestViolation

logger = logging.getLogger(__name__)
from app.agents.architecture_planner.analysis.arch_rules import (
    detect_diagram_spofs,
    identify_cascade_risks,
)

__all__ = ["make_arch_test_node"]


def make_arch_test_node(_llm=None):
    """
    Factory for arch_test_node. Fully deterministic — no LLM calls.
    _llm parameter accepted for interface compatibility but not used.
    """

    def arch_test_node(state: ArchitecturePlannerState) -> Command:
        iteration = state.get("arch_test_iteration_count", 0)
        logger.info("[arch_test] starting")

        if state.get("architecture_diagram") is None:
            return Command(
                update={
                    "arch_test_passed": True,
                    "arch_test_violations": [],
                    "arch_test_feedback": "No diagram to test — skipping.",
                    "arch_test_iteration_count": iteration + 1,
                    "current_node": "arch_test",
                },
                goto="accept",
            )

        diagram_dict = state["architecture_diagram"].model_dump(by_alias=True)

        # Run deterministic checks
        spofs = detect_diagram_spofs(diagram_dict)
        cascades = identify_cascade_risks(diagram_dict)

        violations: list[ArchTestViolation] = []

        for spof in spofs:
            violations.append(ArchTestViolation(
                test_name="spof_detection",
                severity=spof["severity"],
                component_id=spof["node_id"],
                description=spof["reason"],
                remediation=spof["recommendation"],
            ))

        for cascade in cascades:
            if cascade["severity"] == "HIGH":
                violations.append(ArchTestViolation(
                    test_name="cascade_risk",
                    severity="CRITICAL",
                    component_id=cascade["source_id"],
                    description=f"High cascade risk: failure propagates {cascade['length']} hops ({' → '.join(cascade['chain_services'][:4])})",
                    remediation="Add a queue or circuit breaker to interrupt the failure chain",
                ))

        # Carry forward unresolved CRITICAL compliance gaps
        for gap in state.get("compliance_gaps") or []:
            if hasattr(gap, "severity"):
                sev, req, desc = gap.severity, gap.requirement, gap.description
            else:
                sev, req, desc = gap.get("severity", ""), gap.get("requirement", ""), gap.get("description", "")
            if sev == "CRITICAL":
                violations.append(ArchTestViolation(
                    test_name="compliance_gap",
                    severity="CRITICAL",
                    component_id="system",
                    description=f"Unresolved compliance gap: {req} — {desc}",
                    remediation=gap.recommendation if hasattr(gap, "recommendation") else gap.get("recommendation", ""),
                ))

        critical = [v for v in violations if v.severity == "CRITICAL"]
        max_reached = iteration >= 1

        feedback_parts = []
        if not violations:
            feedback_parts.append("All deterministic tests passed.")
        else:
            feedback_parts.append(f"{len(violations)} issue(s): {len(critical)} critical.")
        if spofs:
            feedback_parts.append(f"SPOFs: {', '.join(s['service'] for s in spofs[:3])}.")
        if cascades:
            feedback_parts.append(f"Cascade risks: {len(cascades)} chain(s).")

        update = {
            "arch_test_violations": violations,
            "arch_test_feedback": " ".join(feedback_parts),
            "arch_test_iteration_count": iteration + 1,
            "current_node": "arch_test",
        }

        # Always route to accept — violations are surfaced in the review summary
        # so the user can request changes. Auto-looping back to architecture just
        # burns extra LLM calls and hits rate limits without reliably fixing issues.
        if critical:
            update["arch_test_passed"] = False
            logger.warning("[arch_test] %d CRITICAL violation(s) — surfacing in review (no auto-regen)", len(critical))
        else:
            update["arch_test_passed"] = True
            logger.info("[arch_test] passed (violations=%d) — routing to accept", len(violations))
        return Command(update=update, goto="accept")

    return arch_test_node
