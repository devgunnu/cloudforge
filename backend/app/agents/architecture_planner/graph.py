from __future__ import annotations

from langgraph.checkpoint.memory import MemorySaver
from langgraph.checkpoint.serde.jsonplus import JsonPlusSerializer
from langgraph.graph import StateGraph, START, END
from langgraph.types import Command, interrupt

from app.agents.architecture_planner.state import (
    ArchitecturePlannerState,
    ClarifyingQuestion,
    ServiceEntry,
    ComplianceGap,
)
from app.agents.architecture_planner.prompts import render_prompt
from app.agents.architecture_planner.query_agent import (
    build_info_gathering_subgraph,
    build_query_subgraph,
)
from app.agents.architecture_planner.kg_traversal_agent import init_kuzu, build_kg_subgraph
from app.agents.architecture_planner.service_discovery_agent import make_service_discovery_node
from app.agents.architecture_planner.architecture_agent import make_architecture_node
from app.agents.architecture_planner.compliance_agent import make_compliance_node
from app.agents.architecture_planner.eval_agent import make_eval_node


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
            eval_score=state["eval_score"],
            eval_feedback=state["eval_feedback"],
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
                "arch_iteration_count": 0,  # reset so arch subgraph can run again
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
# Arch-review subgraph (architecture → compliance → eval, loops up to 3x)
# ---------------------------------------------------------------------------


def build_arch_review_subgraph(llm):
    """Compile the arch-review subgraph."""
    builder = StateGraph(ArchitecturePlannerState)
    builder.add_node("architecture", make_architecture_node(llm))
    builder.add_node("compliance", make_compliance_node(llm))
    builder.add_node("eval", make_eval_node(llm))
    builder.add_edge(START, "architecture")
    builder.add_edge("architecture", "compliance")
    builder.add_edge("compliance", "eval")
    # eval uses Command(goto="architecture"|END) internally to control the loop
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
        max_tokens=16384,
    )


# ---------------------------------------------------------------------------
# Parent graph
# ---------------------------------------------------------------------------


def _route_after_accept(state: ArchitecturePlannerState) -> str:
    """Conditional edge: loop back to arch_review if user requested changes."""
    if state["user_accepted"]:
        return END
    return "arch_review"


def create_graph(
    model_type: str = "anthropic",
    model_name: str | None = None,
    graph_json_path: str | None = None,
    community_summaries_path: str | None = None,
    terraform_mcp_cmd: list[str] | None = None,
):
    """
    Build and compile the full architecture planner graph.

    Args:
        model_type: Ignored — kept for call-site compatibility. All agents use Anthropic.
        model_name: Override the model name. Defaults to settings.llm_model (Haiku).
        graph_json_path: Path to graph.json for KG traversal.
                         Defaults to CLOUDFORGE_GRAPH_JSON env var or "graph.json".
                         KG traversal is silently skipped if the file does not exist.
        community_summaries_path: Path to community_summaries.json.
                                  Defaults to CLOUDFORGE_COMMUNITY_SUMMARIES env var
                                  or "community_summaries.json".
        terraform_mcp_cmd: Command list to launch the Terraform MCP server subprocess.
                           e.g. ["npx", "-y", "@hashicorp/terraform-mcp-server"]
                           When None (default), service_discovery runs LLM-only.
                           The adapter instance is created once and reused for the
                           entire graph run.

    Returns:
        A compiled LangGraph graph. Requires a thread_id in the config dict
        when streaming (needed for interrupt() support).
    """
    import os
    llm = _build_llm(model_type, model_name)

    # Terraform MCP adapter — optional, gracefully absent when not configured
    terraform_adapter = None
    if terraform_mcp_cmd is not None:
        from app.agents.architecture_planner.terraform_mcp import TerraformMCPAdapter
        terraform_adapter = TerraformMCPAdapter(cmd=terraform_mcp_cmd)

    # KG setup — optional; gracefully skips when graph.json is absent or kuzu not installed
    _graph_json = graph_json_path or os.environ.get("CLOUDFORGE_GRAPH_JSON", "graph.json")
    _summaries = community_summaries_path or os.environ.get(
        "CLOUDFORGE_COMMUNITY_SUMMARIES", "community_summaries.json"
    )
    conn = init_kuzu(_graph_json)
    kg_traversal = build_kg_subgraph(llm, conn, _summaries)

    # Build subgraphs
    info_gathering = build_info_gathering_subgraph(llm)
    query = build_query_subgraph(llm)
    arch_review = build_arch_review_subgraph(llm)
    accept = build_accept_subgraph()

    builder = StateGraph(ArchitecturePlannerState)

    # Register nodes
    builder.add_node("info_gathering", info_gathering)
    builder.add_node("query", query)
    builder.add_node("kg_traversal", kg_traversal)
    builder.add_node("service_discovery", make_service_discovery_node(llm, terraform_adapter=terraform_adapter))
    builder.add_node("arch_review", arch_review)
    builder.add_node("accept", accept)

    # Main pipeline edges
    builder.add_edge(START, "info_gathering")
    builder.add_edge("info_gathering", "query")
    builder.add_edge("query", "kg_traversal")
    builder.add_edge("kg_traversal", "service_discovery")
    builder.add_edge("service_discovery", "arch_review")
    builder.add_edge("arch_review", "accept")

    # Conditional edge: after accept, either finish or loop back for changes
    builder.add_conditional_edges("accept", _route_after_accept)

    # MemorySaver is required for interrupt() to work across subgraphs.
    # Register custom Pydantic types to silence "Deserializing unregistered type" warnings.
    checkpointer = MemorySaver(
        serde=JsonPlusSerializer(
            allowed_msgpack_modules=[ClarifyingQuestion, ServiceEntry, ComplianceGap]
        )
    )
    return builder.compile(checkpointer=checkpointer)


__all__ = ["create_graph"]
