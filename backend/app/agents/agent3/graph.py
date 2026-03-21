from __future__ import annotations

import threading
from typing import Any, Literal

from langgraph.checkpoint.memory import MemorySaver
from langgraph.graph import END, START, StateGraph

from app.agents.agent3.nodes.assembler import assembler_node, error_handler_node
from app.agents.agent3.nodes.orchestrator import make_orchestrator_node
from app.agents.agent3.nodes.parse_input import parse_input_node
from app.agents.agent3.nodes.tf_generator import tf_generator_node
from app.agents.agent3.state import AgentState
from app.agents.agent3.subgraphs.code_generation_loop import compile_code_generation_subgraph
from app.agents.agent3.subgraphs.tf_validation_loop import compile_tf_validation_subgraph


# ---------------------------------------------------------------------------
# State mappers: AgentState <-> TFValidationState
# ---------------------------------------------------------------------------


def _tf_subgraph_input(state: AgentState) -> dict[str, Any]:
    """Slice AgentState into TFValidationState fields."""
    return {
        "tf_files": state.get("tf_files", {}),
        "validation_results": [],
        "fix_attempts": state.get("tf_fix_attempts", 0),
        "max_retries": state.get("tf_max_retries", 3),
        "error_summary": state.get("tf_error_summary"),
        "validated": False,
        "human_review_required": False,
        "human_review_message": None,
    }


def _tf_subgraph_output(sub_result: dict[str, Any]) -> dict[str, Any]:
    """Map TFValidationState output back to AgentState fields."""
    validated: bool = sub_result.get("validated", False)
    human_review: bool = sub_result.get("human_review_required", False)

    if validated:
        phase = "orchestration"
    elif human_review:
        phase = "tf_validation"  # paused mid-pipeline awaiting human
    else:
        phase = "tf_validation"

    return {
        "tf_files": sub_result.get("tf_files", {}),
        "tf_validation_results": sub_result.get("validation_results", []),
        "tf_validated": validated,
        "tf_fix_attempts": sub_result.get("fix_attempts", 0),
        "tf_error_summary": sub_result.get("error_summary"),
        "human_review_required": human_review,
        "human_review_message": sub_result.get("human_review_message"),
        "current_phase": phase,
    }


def _make_tf_validation_node(compiled_tf_subgraph: Any):
    """Wrap the TF validation subgraph with input/output transformers."""

    def tf_validation_node(state: AgentState) -> dict[str, Any]:
        sub_input = _tf_subgraph_input(state)
        sub_result = compiled_tf_subgraph.invoke(sub_input)
        return _tf_subgraph_output(sub_result)

    return tf_validation_node


# ---------------------------------------------------------------------------
# Top-level routing
# ---------------------------------------------------------------------------


def _route_after_parsing(state: AgentState) -> Literal["tf_generator", "error_handler"]:
    return "error_handler" if state.get("current_phase") == "error" else "tf_generator"


def _route_after_tf_generation(state: AgentState) -> Literal["tf_validation_loop", "error_handler"]:
    return "error_handler" if state.get("current_phase") == "error" else "tf_validation_loop"


def _route_after_tf_validation(
    state: AgentState,
) -> Literal["orchestrator", "assembler", "error_handler"]:
    if state.get("human_review_required"):
        return "assembler"  # partial output with human_review flag
    if state.get("current_phase") == "error":
        return "error_handler"
    if state.get("tf_validated"):
        return "orchestrator"
    # TF never validated and no human flag means something odd — assemble partial
    return "assembler"


def _route_after_orchestration(state: AgentState) -> Literal["assembler"]:
    return "assembler"


# ---------------------------------------------------------------------------
# Graph factory
# ---------------------------------------------------------------------------


def compile_graph(checkpointer=None):
    """Compile and return the top-level agent3 StateGraph."""
    tf_subgraph = compile_tf_validation_subgraph()
    code_subgraph = compile_code_generation_subgraph()

    builder = StateGraph(AgentState)

    builder.add_node("parse_input", parse_input_node)
    builder.add_node("tf_generator", tf_generator_node)
    builder.add_node("tf_validation_loop", _make_tf_validation_node(tf_subgraph))
    builder.add_node("orchestrator", make_orchestrator_node(code_subgraph))
    builder.add_node("assembler", assembler_node)
    builder.add_node("error_handler", error_handler_node)

    builder.add_edge(START, "parse_input")

    builder.add_conditional_edges(
        "parse_input",
        _route_after_parsing,
        {"tf_generator": "tf_generator", "error_handler": "error_handler"},
    )

    builder.add_conditional_edges(
        "tf_generator",
        _route_after_tf_generation,
        {"tf_validation_loop": "tf_validation_loop", "error_handler": "error_handler"},
    )

    builder.add_conditional_edges(
        "tf_validation_loop",
        _route_after_tf_validation,
        {
            "orchestrator": "orchestrator",
            "assembler": "assembler",
            "error_handler": "error_handler",
        },
    )

    builder.add_conditional_edges(
        "orchestrator",
        _route_after_orchestration,
        {"assembler": "assembler"},
    )

    builder.add_edge("assembler", END)
    builder.add_edge("error_handler", END)

    cp = checkpointer if checkpointer is not None else MemorySaver()
    return builder.compile(checkpointer=cp)


# ---------------------------------------------------------------------------
# Singleton accessor
# ---------------------------------------------------------------------------

_graph = None
_graph_lock = threading.Lock()


def get_graph():
    """Return the compiled agent3 graph singleton. Thread-safe initialisation."""
    global _graph
    if _graph is None:
        with _graph_lock:
            if _graph is None:
                _graph = compile_graph()
    return _graph
