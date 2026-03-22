from __future__ import annotations

import json

from langchain_core.messages import HumanMessage
from langgraph.graph import StateGraph, START, END
from langgraph.types import Command, interrupt
from pydantic import BaseModel

from app.agents.architecture_planner.state import ArchitecturePlannerState, ClarifyingQuestion
from app.agents.architecture_planner.prompts import render_prompt
from app.agents.architecture_planner.llm_utils import API_ERROR_TYPES


# ---------------------------------------------------------------------------
# Module-level Ollama fallback helper
# ---------------------------------------------------------------------------


def _parse_with_fallback(llm, output_model, messages):
    try:
        return llm.with_structured_output(output_model).invoke(messages)
    except API_ERROR_TYPES:
        raise  # API-level error — no point trying raw JSON
    except Exception:
        try:
            raw = llm.invoke(messages).content.strip()
            if raw.startswith("```"):
                parts = raw.split("```")
                raw = parts[1]
                if raw.startswith("json"):
                    raw = raw[4:]
            return output_model.model_validate(json.loads(raw.strip()))
        except Exception:
            raise


# ===========================================================================
# Subgraph A: Info-Gathering
# ===========================================================================


class InfoCheckOutput(BaseModel):
    is_sufficient: bool
    clarifying_questions: list[ClarifyingQuestion]


def make_info_check_node(llm):
    def info_check_node(state: ArchitecturePlannerState) -> Command:
        prompt = render_prompt(
            "info_check",
            budget=state["budget"],
            traffic=state["traffic"],
            availability=state["availability"],
            prd=state["prd"],
            cloud_provider=state["cloud_provider"],
            user_answers=state["user_answers"],
        )
        messages = [HumanMessage(content=prompt)]
        try:
            result: InfoCheckOutput = _parse_with_fallback(llm, InfoCheckOutput, messages)
        except API_ERROR_TYPES as exc:
            return Command(
                update={
                    "is_info_sufficient": True,
                    "error_message": f"LLM API error ({type(exc).__name__}): {exc}",
                    "current_node": "info_check",
                },
                goto=END,
            )

        if result.is_sufficient:
            return Command(
                update={
                    "is_info_sufficient": True,
                    "current_node": "info_check",
                },
                goto=END,
            )

        if state["info_iteration_count"] >= 3:
            return Command(
                update={
                    "is_info_sufficient": True,
                    "error_message": "Max info-gathering iterations (3) reached. Proceeding with available information.",
                    "current_node": "info_check",
                },
                goto=END,
            )

        return Command(
            update={
                "is_info_sufficient": False,
                "clarifying_questions": result.clarifying_questions,
                "info_iteration_count": state["info_iteration_count"] + 1,
                "current_node": "info_check",
            },
            goto="question_suggester",
        )

    return info_check_node


def make_question_suggester_node():
    def question_suggester_node(state: ArchitecturePlannerState) -> Command:
        questions_payload = [
            {
                "question": q.question,
                "choices": q.choices,
                "context": q.context,
            }
            for q in state["clarifying_questions"]
        ]

        # Pause the graph; resumes when the caller does Command(resume=answers)
        answers = interrupt({"questions": questions_payload})

        # answers is a list[str] — one answer per clarifying question
        clarification_lines = []
        for i, (q, a) in enumerate(zip(state["clarifying_questions"], answers), 1):
            clarification_lines.append(f"Q{i}: {q.question}\nA{i}: {a}")

        clarification_block = (
            "\n\n## User Clarifications (Round {n})\n\n".format(n=state["info_iteration_count"])
            + "\n\n".join(clarification_lines)
        )

        updated_prd = state["prd"] + clarification_block
        updated_answers = state["user_answers"] + answers

        return Command(
            update={
                "prd": updated_prd,
                "user_answers": updated_answers,
                "current_node": "question_suggester",
            },
            goto="info_check",
        )

    return question_suggester_node


def build_info_gathering_subgraph(llm):
    builder = StateGraph(ArchitecturePlannerState)
    builder.add_node("info_check", make_info_check_node(llm))
    builder.add_node("question_suggester", make_question_suggester_node())
    builder.add_edge(START, "info_check")
    # routing is handled by Command goto internally
    return builder.compile()


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
            user_answers=state["user_answers"],
        )
        try:
            response = llm.invoke([HumanMessage(content=prompt)])
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


__all__ = ["build_info_gathering_subgraph", "build_query_subgraph"]
