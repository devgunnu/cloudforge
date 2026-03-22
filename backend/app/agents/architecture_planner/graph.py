# flowchart TD
#     START --> architecture
#     architecture --> service_discovery
#     service_discovery --> arch_simulator
#     arch_simulator --> resilience_simulator
#     resilience_simulator --> compliance
#     compliance --> arch_test
#     arch_test -->|CRITICAL violations and count < 3| architecture
#     arch_test -->|passed or max iterations| accept
#     accept -->|user_accepted| END
#     accept -->|rejected and query_rejection_count < 2| architecture
#     accept -->|rejected and query_rejection_count >= 2| END

from __future__ import annotations

from langgraph.checkpoint.memory import MemorySaver
from langgraph.checkpoint.serde.jsonplus import JsonPlusSerializer
from langgraph.graph import StateGraph, START, END
from langgraph.types import Command, interrupt

from app.agents.architecture_planner.state import (
    ArchitectureDiagram,
    ArchNode,
    ArchConnection,
    ArchitecturePlannerState,
    ArchTestViolation,
    ServiceEntry,
    ComplianceGap,
)
from app.agents.architecture_planner.prompts import render_prompt
# make_research_node is unplugged — PRD fed directly into architecture node
# from app.agents.architecture_planner.research_agent import make_research_node
from app.agents.architecture_planner.service_discovery_agent import make_service_discovery_node
from app.agents.architecture_planner.architecture_agent import make_architecture_node
from app.agents.architecture_planner.arch_simulator import make_arch_simulator_node
from app.agents.architecture_planner.resilience_simulator import make_resilience_simulator_node
from app.agents.architecture_planner.compliance_agent import make_compliance_node
from app.agents.architecture_planner.arch_test_agent import make_arch_test_node


# ---------------------------------------------------------------------------
# Accept subgraph
# ---------------------------------------------------------------------------


def make_present_architecture_node():
    """Factory for present_architecture_node (no LLM needed — uses interrupt)."""

    def present_architecture_node(state: ArchitecturePlannerState) -> Command:
        # Auto-accept when max iterations reached
        if state["accept_iteration_count"] >= 3:
            return Command(
                update={
                    "user_accepted": True,
                    "accept_iteration_count": state["accept_iteration_count"],
                    "error_message": "Max accept/change iterations (3) reached. Auto-accepting best architecture.",
                    "current_node": "present_architecture",
                },
                goto=END,
            )

        # Serialize diagram for the template (use by_alias=True so "from" key is correct)
        diagram_dict = (
            state["architecture_diagram"].model_dump(by_alias=True)
            if state["architecture_diagram"]
            else {"nodes": [], "connections": []}
        )

        summary = render_prompt(
            "accept_review",
            architecture_diagram=diagram_dict,
            nfr_document=state["nfr_document"],
            component_responsibilities=state["component_responsibilities"],
            extra_context=state["extra_context"],
            arch_test_passed=state["arch_test_passed"],
            arch_test_feedback=state["arch_test_feedback"],
            arch_test_violations=[v.model_dump() for v in (state.get("arch_test_violations") or [])],
        )

        # Pause for human review — resumes with Command(resume={"accepted": bool, "changes": str})
        response = interrupt({
            "summary": summary,
            "iteration": state["accept_iteration_count"] + 1,
        })

        accepted = response.get("accepted", False) if isinstance(response, dict) else False
        changes = response.get("changes", "") if isinstance(response, dict) else str(response)

        if accepted:
            return Command(
                update={
                    "user_accepted": True,
                    "accept_iteration_count": state["accept_iteration_count"] + 1,
                    "current_node": "present_architecture",
                },
                goto=END,
            )

        # User requested changes — reset arch loop and return to parent graph
        return Command(
            update={
                "user_accepted": False,
                "user_change_requests": changes,
                "accept_iteration_count": state["accept_iteration_count"] + 1,
                "arch_iteration_count": 0,
                "arch_test_iteration_count": 0,
                "query_rejection_count": state["query_rejection_count"] + 1,
                "current_node": "present_architecture",
            },
            goto=END,
        )

    return present_architecture_node


def build_accept_subgraph():
    """Compile the accept subgraph (one node, uses interrupt for human-in-the-loop)."""
    builder = StateGraph(ArchitecturePlannerState)
    builder.add_node("present_architecture", make_present_architecture_node())
    builder.add_edge(START, "present_architecture")
    return builder.compile()


# ---------------------------------------------------------------------------
# LLM factory
# ---------------------------------------------------------------------------


def _build_llm(model_type: str, model_name: str | None):
    """Instantiate the chat model. All agents use Anthropic Claude."""
    from langchain_anthropic import ChatAnthropic
    from app.config import settings
    return ChatAnthropic(
        model=model_name or settings.llm_model,
        api_key=settings.anthropic_api_key,
        temperature=0,
        max_tokens=48000,
    )


# ---------------------------------------------------------------------------
# Parent graph
# ---------------------------------------------------------------------------


def _route_after_accept(state: ArchitecturePlannerState) -> str:
    """Conditional edge: loop back to research if user requested changes, else END."""
    if state["user_accepted"]:
        return END
    if state.get("query_rejection_count", 0) >= 2:
        return END  # auto-accept after 2 full rejections
    return "architecture"


def create_graph(
    model_type: str = "anthropic",
    model_name: str | None = None,
    graph_json_path: str | None = None,
    community_summaries_path: str | None = None,
    terraform_mcp_cmd: list[str] | None = None,
    kuzu_conn=None,
    rag_vector_store=None,
):
    """
    Build and compile the full architecture planner graph.

    Args:
        model_type:              Ignored — kept for call-site compatibility.
        model_name:              Override the model name. Defaults to settings.llm_model.
        graph_json_path:         Ignored — kept for backward compatibility.
        community_summaries_path: Ignored — kept for backward compatibility.
        terraform_mcp_cmd:       Command list to launch the Terraform MCP server subprocess.
                                 When None (default), service_discovery runs LLM-only.
        kuzu_conn:               Ignored — kept for backward compatibility.
        rag_vector_store:        Ignored — kept for backward compatibility.

    Returns:
        A compiled LangGraph graph. Requires a thread_id in the config dict
        when streaming (needed for interrupt() support).
    """
    llm = _build_llm(model_type, model_name)

    # Terraform MCP adapter — optional, gracefully absent when not configured
    terraform_adapter = None
    if terraform_mcp_cmd is not None:
        from app.agents.architecture_planner.terraform_mcp import TerraformMCPAdapter
        terraform_adapter = TerraformMCPAdapter(cmd=terraform_mcp_cmd)

    # Build subgraphs and node factories
    accept = build_accept_subgraph()

    builder = StateGraph(ArchitecturePlannerState)

    # Register nodes — research node unplugged; PRD flows directly into architecture
    builder.add_node("architecture", make_architecture_node(llm))
    builder.add_node("service_discovery", make_service_discovery_node(llm, terraform_adapter=terraform_adapter))
    builder.add_node("arch_simulator", make_arch_simulator_node(llm))
    builder.add_node("resilience_simulator", make_resilience_simulator_node(llm))
    builder.add_node("compliance", make_compliance_node(llm))
    builder.add_node("arch_test", make_arch_test_node(llm))
    builder.add_node("accept", accept)

    # Main pipeline edges — research node skipped, START goes directly to architecture
    builder.add_edge(START, "architecture")
    builder.add_edge("architecture", "service_discovery")
    builder.add_edge("service_discovery", "arch_simulator")
    builder.add_edge("arch_simulator", "resilience_simulator")
    builder.add_edge("resilience_simulator", "compliance")
    builder.add_edge("compliance", "arch_test")
    # arch_test uses Command(goto="architecture"|"accept") internally — no static edge needed

    # Conditional edge: after accept, either finish or loop back to research for a full re-run
    builder.add_conditional_edges("accept", _route_after_accept)

    # MemorySaver is required for interrupt() to work across subgraphs.
    # Register custom Pydantic types to silence "Deserializing unregistered type" warnings.
    checkpointer = MemorySaver(
        serde=JsonPlusSerializer(
            allowed_msgpack_modules=[
                ArchTestViolation, ServiceEntry, ComplianceGap,
                ArchitectureDiagram, ArchNode, ArchConnection,
            ]
        )
    )
    return builder.compile(checkpointer=checkpointer)


__all__ = ["create_graph"]
