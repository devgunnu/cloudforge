from __future__ import annotations

from typing import Literal

from langgraph.graph import END, START, StateGraph
from langgraph.types import interrupt

from app.agents.agent3.nodes.tf_fixer import tf_fixer_node
from app.agents.agent3.state import TFValidationState, ValidationResult
from app.agents.agent3.tools.tf_tools import (
    aggregate_validation_errors,
    run_checkov,
    run_terraform_fmt,
    run_terraform_validate,
    run_tflint,
)


# ---------------------------------------------------------------------------
# Validation runner nodes
# ---------------------------------------------------------------------------


def _run_fmt_node(state: TFValidationState) -> dict:
    return {"validation_results": [run_terraform_fmt(state["tf_files"])]}


def _run_validate_node(state: TFValidationState) -> dict:
    return {"validation_results": [run_terraform_validate(state["tf_files"])]}


def _run_tflint_node(state: TFValidationState) -> dict:
    return {"validation_results": [run_tflint(state["tf_files"])]}


def _run_checkov_node(state: TFValidationState) -> dict:
    return {"validation_results": [run_checkov(state["tf_files"])]}


def _get_latest_per_tool(all_results: list[ValidationResult]) -> list[ValidationResult]:
    """
    Return the most recent result for each unique tool name.
    This is robust to any number of tools — no magic number needed.
    """
    seen: dict[str, ValidationResult] = {}
    for r in reversed(all_results):
        if r["tool"] not in seen:
            seen[r["tool"]] = r
    return list(seen.values())


def _aggregate_errors_node(state: TFValidationState) -> dict:
    """
    Find the latest result per tool and decide whether this pass succeeded.
    Works regardless of how many validation tools are registered.
    """
    all_results: list[ValidationResult] = state.get("validation_results") or []
    latest = _get_latest_per_tool(all_results)

    all_passed = bool(latest) and all(r["passed"] for r in latest)
    error_summary = aggregate_validation_errors(latest) if not all_passed else None

    return {
        "validated": all_passed,
        "error_summary": error_summary,
    }


# ---------------------------------------------------------------------------
# Routing
# ---------------------------------------------------------------------------


def _route_after_validation(state: TFValidationState) -> Literal["passed", "fix", "human"]:
    if state.get("validated"):
        return "passed"
    if state.get("fix_attempts", 0) >= state.get("max_retries", 3):
        return "human"
    return "fix"


def _human_interrupt_node(state: TFValidationState) -> dict:
    """
    Signal that human intervention is needed.
    `interrupt()` pauses the graph; when resumed, this function's return dict
    is merged into state. We set human_review_required and a descriptive message.
    """
    msg = (
        f"Terraform validation failed after {state.get('fix_attempts', 0)} fix attempts.\n"
        f"Last errors:\n{state.get('error_summary') or '(none captured)'}\n\n"
        "Please review and correct the Terraform files manually, then resume this run "
        "via POST /agent3/resume/{thread_id} with corrected_files."
    )
    interrupt(msg)
    # Returned after resumption — mark state clearly so the parent graph can route correctly
    return {
        "human_review_required": True,
        "human_review_message": msg,
        "validated": False,
    }


# ---------------------------------------------------------------------------
# Graph assembly
# ---------------------------------------------------------------------------


def compile_tf_validation_subgraph():
    builder = StateGraph(TFValidationState)

    builder.add_node("run_fmt", _run_fmt_node)
    builder.add_node("run_validate", _run_validate_node)
    builder.add_node("run_tflint", _run_tflint_node)
    builder.add_node("run_checkov", _run_checkov_node)
    builder.add_node("aggregate_errors", _aggregate_errors_node)
    builder.add_node("llm_fixer", tf_fixer_node)
    builder.add_node("human_interrupt", _human_interrupt_node)

    builder.add_edge(START, "run_fmt")
    builder.add_edge("run_fmt", "run_validate")
    builder.add_edge("run_validate", "run_tflint")
    builder.add_edge("run_tflint", "run_checkov")
    builder.add_edge("run_checkov", "aggregate_errors")

    builder.add_conditional_edges(
        "aggregate_errors",
        _route_after_validation,
        {
            "passed": END,
            "fix": "llm_fixer",
            "human": "human_interrupt",
        },
    )

    # After fixing, restart the full validation chain
    builder.add_edge("llm_fixer", "run_fmt")
    builder.add_edge("human_interrupt", END)

    return builder.compile()
