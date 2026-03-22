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


class ClarifyingQuestion(BaseModel):
    question: str
    choices: list[str]  # exactly 3 choices
    context: str        # why this info is needed


class ComplianceGap(BaseModel):
    requirement: str      # the PRD/NFR requirement that is not met
    severity: str         # "CRITICAL" | "MAJOR" | "MINOR"
    description: str      # what is missing or wrong in the architecture
    recommendation: str   # how to fix it


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

    # === INFO-GATHERING SUBGRAPH ===
    is_info_sufficient: bool
    clarifying_questions: list[ClarifyingQuestion]
    user_answers: list[str]       # accumulated answers across MCQ sessions
    info_iteration_count: int     # max 3

    # === QUERY SUBGRAPH ===
    query_results: str
    query_results_sufficient: bool
    query_iteration_count: int    # max 2

    # === KG TRAVERSAL SUBGRAPH ===
    kg_constraints: list[str]           # parsed constraint node IDs from NFRs
    kg_frontier: list[str]              # nodes to expand in next hop
    kg_active_nodes: list[str]          # all recommended nodes (grows each hop)
    kg_blocked_nodes: list[str]         # all blocked nodes (grows each hop)
    kg_reasoning_path: list[dict]       # full traversal trace
    kg_communities: list[int]           # relevant community IDs
    kg_converged: bool                  # traversal converged flag
    kg_explanation: str                 # KG-validated recommendation text
    kg_traversal_iteration_count: int   # hop guard (max 5)

    # === SERVICE DISCOVERY ===
    relevant_services: list[ServiceEntry]
    terraform_mcp_available: bool         # True if terraform MCP returned data this run

    # === ARCHITECTURE (4 deliverables) ===
    architecture_diagram: Optional[ArchitectureDiagram]
    nfr_document: str
    component_responsibilities: str
    extra_context: str

    # === COMPLIANCE (PRD + NFR compliance) ===
    compliance_gaps: list[ComplianceGap]
    compliance_passed: bool

    # === EVAL ===
    eval_score: float             # 0.0 – 10.0
    eval_feedback: str
    eval_passed: bool
    arch_iteration_count: int     # max 3

    # === ACCEPT SUBGRAPH ===
    user_change_requests: str
    user_accepted: bool
    accept_iteration_count: int   # max 3

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
        "is_info_sufficient": False,
        "clarifying_questions": [],
        "user_answers": [],
        "info_iteration_count": 0,
        "query_results": "",
        "query_results_sufficient": False,
        "query_iteration_count": 0,
        "kg_constraints": [],
        "kg_frontier": [],
        "kg_active_nodes": [],
        "kg_blocked_nodes": [],
        "kg_reasoning_path": [],
        "kg_communities": [],
        "kg_converged": False,
        "kg_explanation": "",
        "kg_traversal_iteration_count": 0,
        "relevant_services": [],
        "terraform_mcp_available": False,
        "architecture_diagram": None,
        "nfr_document": "",
        "component_responsibilities": "",
        "extra_context": "",
        "compliance_gaps": [],
        "compliance_passed": False,
        "eval_score": 0.0,
        "eval_feedback": "",
        "eval_passed": False,
        "arch_iteration_count": 0,
        "user_change_requests": "",
        "user_accepted": False,
        "accept_iteration_count": 0,
        "current_node": "",
        "error_message": None,
    }
