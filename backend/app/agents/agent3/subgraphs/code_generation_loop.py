from __future__ import annotations

from typing import Literal

from langgraph.graph import END, START, StateGraph
from langgraph.types import interrupt

from app.agents.agent3.nodes.code_fixer import code_fixer_node
from app.agents.agent3.nodes.code_generator import code_generator_node
from app.agents.agent3.nodes.code_validator import code_validator_node
from app.agents.agent3.nodes.test_generator import test_generator_node
from app.agents.agent3.state import CodeGenState


# ---------------------------------------------------------------------------
# Routing
# ---------------------------------------------------------------------------


def _route_entry(state: CodeGenState) -> Literal["code_gen", "test_gen"]:
    """Route to code generation or test generation based on the task type."""
    return state["task"]["task_type"]


def _route_after_validation(state: CodeGenState) -> Literal["passed", "fix", "human"]:
    if state.get("done"):
        return "passed"
    # syntax_errors is an append-only Annotated list; check if the last entry is non-empty
    errors = state.get("syntax_errors") or []
    has_errors = bool(errors)
    if has_errors and state.get("fix_attempts", 0) >= state.get("max_retries", 3):
        return "human"
    if has_errors:
        return "fix"
    # done=False but no errors yet — shouldn't normally happen; treat as passed
    return "passed"


def _human_interrupt_node(state: CodeGenState) -> dict:
    """
    Signal that human intervention is needed for code generation.
    `interrupt()` pauses the graph; on resume, this return dict is merged.
    """
    task = state["task"]
    errors = state.get("syntax_errors") or []
    msg = (
        f"Code generation for service '{task['service_id']}' ({task['task_type']}) "
        f"failed after {state.get('fix_attempts', 0)} fix attempts.\n"
        f"Errors: {'; '.join(errors[-5:])}\n\n"
        "Please review the errors and resume with corrected code via the resume endpoint."
    )
    interrupt(msg)
    # After resumption, mark that we need human review and stop retrying
    return {
        "human_review_required": True,
        "human_review_message": msg,
        "done": False,
    }


# ---------------------------------------------------------------------------
# Graph assembly
# ---------------------------------------------------------------------------


def compile_code_generation_subgraph():
    builder = StateGraph(CodeGenState)

    builder.add_node("code_gen", code_generator_node)
    builder.add_node("test_gen", test_generator_node)
    builder.add_node("validate_syntax", code_validator_node)
    builder.add_node("fix_code", code_fixer_node)
    builder.add_node("human_interrupt", _human_interrupt_node)

    # Entry: route to code_gen or test_gen based on task type
    builder.add_conditional_edges(
        START,
        _route_entry,
        {"code_gen": "code_gen", "test_gen": "test_gen"},
    )

    builder.add_edge("code_gen", "validate_syntax")
    builder.add_edge("test_gen", "validate_syntax")

    builder.add_conditional_edges(
        "validate_syntax",
        _route_after_validation,
        {
            "passed": END,
            "fix": "fix_code",
            "human": "human_interrupt",
        },
    )

    # After fixing, re-validate
    builder.add_edge("fix_code", "validate_syntax")
    builder.add_edge("human_interrupt", END)

    return builder.compile()
