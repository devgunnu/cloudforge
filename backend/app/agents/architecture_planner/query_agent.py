# UNPLUGGED — replaced by research_agent.py. Query subgraph removed.
# Not imported by graph.py. Kept for reference.
# from __future__ import annotations

import json

from langchain_core.messages import HumanMessage
from langgraph.graph import StateGraph, START, END
from langgraph.types import Command
from pydantic import BaseModel

from app.agents.architecture_planner.state import ArchitecturePlannerState
from app.agents.architecture_planner.prompts import render_prompt
from app.agents.architecture_planner.llm_utils import API_ERROR_TYPES, invoke_with_retry


# ---------------------------------------------------------------------------
# Module-level LLM fallback helper
# ---------------------------------------------------------------------------


def _parse_with_fallback(llm, output_model, messages):
    try:
        return invoke_with_retry(
            lambda: llm.with_structured_output(output_model).invoke(messages)
        )
    except API_ERROR_TYPES:
        raise  # API-level error — no point trying raw JSON
    except Exception:
        try:
            raw = invoke_with_retry(lambda: llm.invoke(messages)).content.strip()
            if raw.startswith("```"):
                parts = raw.split("```")
                raw = parts[1]
                if raw.startswith("json"):
                    raw = raw[4:]
            return output_model.model_validate(json.loads(raw.strip()))
        except Exception:
            raise


# ===========================================================================
# Subgraph B: Query Research
# ===========================================================================


class QueryEvalOutput(BaseModel):
    sufficient: bool
    reason: str


def make_query_research_node(llm):
    def query_research_node(state: ArchitecturePlannerState) -> dict:
        prompt = render_prompt(
            "query_research",
            budget=state["budget"],
            traffic=state["traffic"],
            availability=state["availability"],
            prd=state["prd"],
            cloud_provider=state["cloud_provider"],
        )
        try:
            response = invoke_with_retry(lambda: llm.invoke([HumanMessage(content=prompt)]))
        except API_ERROR_TYPES as exc:
            return {
                "query_results": "",
                "query_iteration_count": state["query_iteration_count"] + 1,
                "current_node": "query_research",
                "error_message": f"LLM API error ({type(exc).__name__}): {exc}",
            }
        return {
            "query_results": response.content,
            "query_iteration_count": state["query_iteration_count"] + 1,
            "current_node": "query_research",
        }

    return query_research_node


def make_query_eval_node(llm):
    def query_eval_node(state: ArchitecturePlannerState) -> Command:
        prompt = render_prompt(
            "query_eval",
            query_results=state["query_results"],
            budget=state["budget"],
            traffic=state["traffic"],
            prd=state["prd"],
        )
        messages = [HumanMessage(content=prompt)]
        try:
            result: QueryEvalOutput = _parse_with_fallback(llm, QueryEvalOutput, messages)
        except API_ERROR_TYPES as exc:
            return Command(
                update={
                    "query_results_sufficient": True,
                    "error_message": f"LLM API error ({type(exc).__name__}): {exc}",
                    "current_node": "query_eval",
                },
                goto=END,
            )

        if result.sufficient:
            return Command(
                update={
                    "query_results_sufficient": True,
                    "current_node": "query_eval",
                },
                goto=END,
            )

        if state["query_iteration_count"] >= 2:
            return Command(
                update={
                    "query_results_sufficient": True,
                    "error_message": "Max query iterations (2) reached. Proceeding with available research.",
                    "current_node": "query_eval",
                },
                goto=END,
            )

        return Command(
            update={
                "query_results_sufficient": False,
                "current_node": "query_eval",
            },
            goto="query_research",
        )

    return query_eval_node


def build_query_subgraph(llm):
    builder = StateGraph(ArchitecturePlannerState)
    builder.add_node("query_research", make_query_research_node(llm))
    builder.add_node("query_eval", make_query_eval_node(llm))
    builder.add_edge(START, "query_research")
    builder.add_edge("query_research", "query_eval")
    # query_eval uses Command(goto=...) internally
    return builder.compile()


__all__ = ["build_query_subgraph"]
