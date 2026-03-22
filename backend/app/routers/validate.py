from __future__ import annotations
from fastapi import APIRouter
from app.schemas.validate import (
    ValidateRequest, ValidateResponse, RequestPathResult,
    SpofResult, CascadeRiskResult, ValidationSummary,
)
from app.agents.architecture_planner.analysis.arch_rules import (
    find_request_paths_with_latency,
    detect_diagram_spofs,
    identify_cascade_risks,
)

router = APIRouter(prefix="/workflows/validate", tags=["validate"])


@router.post("", response_model=ValidateResponse)
def validate_architecture(payload: ValidateRequest) -> ValidateResponse:
    """
    Deterministic-only architecture validation. No LLM. Sub-100ms.
    Runs SPOF detection, cascade risk analysis, and request path latency estimation.
    """
    diagram = payload.architecture_diagram
    paths = find_request_paths_with_latency(diagram)
    spofs = detect_diagram_spofs(diagram)
    cascades = identify_cascade_risks(diagram)

    nodes = diagram.get("nodes", [])
    connections = diagram.get("connections", [])

    critical_spofs = [s for s in spofs if s["severity"] == "CRITICAL"]
    high_cascades = [c for c in cascades if c["severity"] == "HIGH"]
    max_p50 = max((p["total_p50_ms"] for p in paths), default=0)
    max_p99 = max((p["total_p99_ms"] for p in paths), default=0)

    return ValidateResponse(
        request_paths=[RequestPathResult(**p) for p in paths],
        spofs=[SpofResult(**s) for s in spofs],
        cascade_risks=[CascadeRiskResult(**c) for c in cascades],
        summary=ValidationSummary(
            node_count=len(nodes),
            connection_count=len(connections),
            spof_count=len(spofs),
            critical_spof_count=len(critical_spofs),
            cascade_risk_count=len(cascades),
            high_cascade_count=len(high_cascades),
            max_path_p50_ms=max_p50,
            max_path_p99_ms=max_p99,
        ),
    )
