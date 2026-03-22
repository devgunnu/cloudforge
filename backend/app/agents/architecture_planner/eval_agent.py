# UNPLUGGED — replaced by arch_test_agent.py (deterministic rules, zero LLM calls).
# Not imported by graph.py. Kept for reference.
# from __future__ import annotations

import json

from langchain_core.messages import HumanMessage
from langgraph.types import Command
from langgraph.graph import END
from pydantic import BaseModel

from app.agents.architecture_planner.state import ArchitecturePlannerState
from app.agents.architecture_planner.prompts import render_prompt
from app.agents.architecture_planner.llm_utils import API_ERROR_TYPES

__all__ = ["make_eval_node"]


class EvalOutput(BaseModel):
    score: float
    feedback: str
    passed: bool


def make_eval_node(llm):
    """Factory that returns an eval_node bound to the provided LLM.

    This node is the architectural linchpin: it controls the arch-review loop
    via Command(goto=...), routing back to 'architecture' or terminating at END.
    """

    def eval_node(state: ArchitecturePlannerState) -> Command:
        # Guard: cannot evaluate without a diagram
        if state["architecture_diagram"] is None:
            return Command(
                update={
                    "eval_score": 0.0,
                    "eval_feedback": "No architecture diagram to evaluate.",
                    "eval_passed": False,
                    "error_message": "Evaluation skipped: architecture diagram is missing.",
                    "current_node": "eval",
                },
                goto=END,
            )

        architecture_diagram_json = state["architecture_diagram"].model_dump_json(by_alias=True)

        prompt = render_prompt(
            "eval",
            prd=state["prd"],
            nfr_document=state["nfr_document"],
            architecture_diagram=architecture_diagram_json,
            component_responsibilities=state["component_responsibilities"],
            extra_context=state["extra_context"],
            budget=state["budget"],
            traffic=state["traffic"],
            availability=state["availability"],
        )
        messages = [HumanMessage(content=prompt)]

        try:
            result = llm.with_structured_output(EvalOutput).invoke(messages)
        except API_ERROR_TYPES as exc:
            return Command(
                update={
                    "eval_score": 0.0,
                    "eval_feedback": "Evaluation failed due to an LLM API error.",
                    "eval_passed": False,
                    "error_message": f"LLM API error ({type(exc).__name__}): {exc}",
                    "current_node": "eval",
                },
                goto=END,
            )
        except Exception:
            # Structured output fallback: attempt raw JSON parse
            try:
                raw = llm.invoke(messages).content
                raw = raw.strip()
                if raw.startswith("```"):
                    raw = raw.split("```")[1]
                    if raw.startswith("json"):
                        raw = raw[4:]
                result = EvalOutput.model_validate(json.loads(raw.strip()))
            except API_ERROR_TYPES as exc:
                return Command(
                    update={
                        "eval_score": 0.0,
                        "eval_feedback": "Evaluation failed due to an LLM API error.",
                        "eval_passed": False,
                        "error_message": f"LLM API error ({type(exc).__name__}): {exc}",
                        "current_node": "eval",
                    },
                    goto=END,
                )
            except Exception as e2:
                # On total failure: surface error and terminate the loop
                return Command(
                    update={
                        "eval_score": 0.0,
                        "eval_feedback": "Evaluation failed due to an LLM error.",
                        "eval_passed": False,
                        "error_message": f"Evaluation failed: {str(e2)}",
                        "current_node": "eval",
                    },
                    goto=END,
                )

        # ------------------------------------------------------------------ #
        # Routing logic
        # ------------------------------------------------------------------ #
        both_passed = result.passed and state["compliance_passed"]
        max_reached = state["arch_iteration_count"] >= 3

        update = {
            "eval_score": result.score,
            "eval_feedback": result.feedback,
            "eval_passed": result.passed,
            "current_node": "eval",
        }

        if both_passed or max_reached:
            if max_reached and not both_passed:
                update["error_message"] = (
                    f"Max architecture iterations (3) reached. "
                    f"Outputting best result (score: {result.score:.1f}/10)."
                )
            return Command(update=update, goto=END)
        else:
            return Command(update=update, goto="architecture")

    return eval_node
