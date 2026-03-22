from __future__ import annotations

from typing import Optional
from typing_extensions import TypedDict
from pydantic import BaseModel, Field, ConfigDict


# ---------------------------------------------------------------------------
# Pydantic sub-schemas — used as structured output targets across all agents
# ---------------------------------------------------------------------------


class ArchNode(BaseModel):
    id: str
    service: str
    provider: str
    description: str


class ArchConnection(BaseModel):
    from_: str = Field(..., alias="from", serialization_alias="from")
    to: str
    protocol: str
    description: str
    model_config = ConfigDict(populate_by_name=True)


class ArchitectureDiagram(BaseModel):
    nodes: list[ArchNode]
    connections: list[ArchConnection]


class ServiceEntry(BaseModel):
    name: str
    category: str
    provider: str
    description: str
    use_case: str


class ComplianceGap(BaseModel):
    requirement: str      # the PRD/NFR requirement that is not met
    severity: str         # "CRITICAL" | "MAJOR" | "MINOR"
    description: str      # what is missing or wrong in the architecture
    recommendation: str   # how to fix it


class ArchTestViolation(BaseModel):
    test_name: str
    severity: str         # "CRITICAL" | "MAJOR" | "MINOR"
    component_id: str
    description: str
    remediation: str


# ---------------------------------------------------------------------------
# Main LangGraph state
# ---------------------------------------------------------------------------


class ArchitecturePlannerState(TypedDict):
    # === USER INPUTS (set once, never mutated) ===
    budget: str
    traffic: str
    availability: str
    prd: str
    cloud_provider: str           # "AWS" | "GCP" | "Azure"

    # === RESEARCH ===
    research_results: str

    # === SIMULATION ===
    arch_simulation: Optional[dict]       # ArchSimulationResult dict or None
    resilience_simulation: Optional[dict] # ResilienceSimulationResult dict or None

    # === SERVICE DISCOVERY ===
    relevant_services: list[ServiceEntry]
    mcp_available: bool

    # === ARCHITECTURE (4 deliverables) ===
    architecture_diagram: Optional[ArchitectureDiagram]
    nfr_document: str
    component_responsibilities: str
    extra_context: str
    arch_iteration_count: int

    # === COMPLIANCE (PRD + NFR compliance) ===
    compliance_gaps: list[ComplianceGap]
    compliance_passed: bool

    # === ARCH TEST (replaces eval) ===
    arch_test_passed: bool
    arch_test_feedback: str
    arch_test_violations: list[ArchTestViolation]
    arch_test_iteration_count: int

    # === ACCEPT SUBGRAPH ===
    user_change_requests: str
    user_accepted: bool
    accept_iteration_count: int   # max 3
    query_rejection_count: int

    # === DEBUG ===
    current_node: str
    error_message: Optional[str]


def make_initial_state(
    budget: str,
    traffic: str,
    availability: str,
    prd: str,
    cloud_provider: str,
) -> dict:
    """Return a fully-initialized state dict for graph invocation."""
    return {
        "budget": budget,
        "traffic": traffic,
        "availability": availability,
        "prd": prd,
        "cloud_provider": cloud_provider,
        "research_results": "",
        "arch_simulation": None,
        "resilience_simulation": None,
        "relevant_services": [],
        "mcp_available": False,
        "architecture_diagram": None,
        "nfr_document": "",
        "component_responsibilities": "",
        "extra_context": "",
        "arch_iteration_count": 0,
        "compliance_gaps": [],
        "compliance_passed": False,
        "arch_test_passed": False,
        "arch_test_feedback": "",
        "arch_test_violations": [],
        "arch_test_iteration_count": 0,
        "user_change_requests": "",
        "user_accepted": False,
        "accept_iteration_count": 0,
        "query_rejection_count": 0,
        "current_node": "",
        "error_message": None,
    }
