from __future__ import annotations

import json
import logging
import time
from typing import Any

from app.agents.agent1.llm import get_llm
from app.agents.agent1.prompts import CLARIFIER_PROMPT, PLANNER_PROMPT
from app.agents.agent1.state import AgentState, ClarifierOutput, FinalPRDJson, PlannerOutput, ResearchResult
from app.agents.agent1.tools import web_search
from app.config import settings


logger = logging.getLogger(__name__)


REQUIRED_RESEARCH_AREAS = [
    "identity and access management",
    "network and edge security",
    "compute/runtime architecture",
    "data storage and lifecycle",
    "observability and logging",
    "resilience and disaster recovery",
    "cost optimization and scaling",
]


def _extract_json(text: str) -> dict[str, Any]:
    # The LLM may prepend explanation text; we recover the first JSON object safely.
    text = text.strip()
    try:
        return json.loads(text)
    except json.JSONDecodeError:
        start = text.find("{")
        end = text.rfind("}")
        if start >= 0 and end > start:
            return json.loads(text[start : end + 1])
        raise


def _as_state(state: dict[str, Any] | AgentState) -> AgentState:
    if isinstance(state, AgentState):
        return state
    return AgentState.model_validate(state)


def _dump_state(state: AgentState) -> dict[str, Any]:
    return state.as_graph_state()


def _safe_errors(state: AgentState, message: str) -> AgentState:
    state.add_error(message)
    if message.startswith("search_failed["):
        query = message.split("search_failed[", 1)[1].split("]", 1)[0]
        logger.warning("Could not fetch %s", query)
    else:
        logger.warning("Could not complete step: %s", message)
    return state


def _augment_research_queries(state: AgentState, queries: list[str]) -> list[str]:
    # Ensure research covers all key architecture dimensions, not only user-mentioned terms.
    combined = list(queries)
    existing_text = " ".join(q.lower() for q in queries)
    for area in REQUIRED_RESEARCH_AREAS:
        if area in existing_text:
            continue
        combined.append(f"{state.cloud_provider} official docs best practices for {area}")
    # Keep ordering while deduplicating.
    unique: list[str] = []
    seen: set[str] = set()
    for item in combined:
        key = item.strip().lower()
        if not key or key in seen:
            continue
        seen.add(key)
        unique.append(item.strip())
    return unique[: max(settings.max_research_rounds, len(REQUIRED_RESEARCH_AREAS))]


def user_input_node(state: dict[str, Any] | AgentState) -> dict[str, Any]:
    model_state = _as_state(state)
    logger.info("Processing user input")
    model_state.status = "running"
    return _dump_state(model_state)


def research_node(state: dict[str, Any] | AgentState) -> dict[str, Any]:
    model_state = _as_state(state)
    logger.info("Research agent is analyzing requirements")

    # When returning from the web search node, continue to the information gate.
    if model_state.web_search_done:
        logger.info("Research results collected from trusted sources")
        model_state.web_search_done = False
        model_state.run_web_search = False
        return _dump_state(model_state)

    rounds = model_state.clarification_rounds + 1
    model_state.clarification_rounds = rounds

    llm = get_llm()
    # Include all prior answers to support deep, iterative clarification for natural-language input.
    prompt = (
        f"{CLARIFIER_PROMPT}\n\n"
        f"Cloud provider: {model_state.cloud_provider}\n"
        f"Initial Product Description:\n{model_state.prd_text}\n\n"
        f"User Clarifications:\n{model_state.user_answers}\n"
    )

    try:
        start = time.perf_counter()
        response = llm.invoke(prompt)
        elapsed = time.perf_counter() - start
        logger.info("Research analysis completed in %.2f seconds", elapsed)
        payload = ClarifierOutput.model_validate(_extract_json(str(response.content)))
    except Exception as exc:  # noqa: BLE001
        _safe_errors(model_state, f"clarifier_failed: {exc}")
        model_state.status = "needs_input"
        if not model_state.follow_up_questions:
            model_state.follow_up_questions = [
                "What user personas and core workflows should this product support?",
                "What are target scale, latency, availability, and compliance requirements?",
            ]
        return _dump_state(model_state)

    # CoT is not logged; show a safe reasoning summary from structured model output.
    logger.info(
        "LLM reasoning summary: information_enough=%s, first_question=%s",
        payload.is_information_enough,
        (payload.follow_up_questions[0] if payload.follow_up_questions else "none"),
    )

    model_state.follow_up_questions = payload.follow_up_questions[:8]
    model_state.questions_with_options = payload.questions_with_options[:8]
    model_state.research_queries = _augment_research_queries(model_state, payload.research_queries)
    model_state.is_information_enough = payload.is_information_enough
    logger.info(
        "Requirement clarity check: enough=%s, questions=%s, research_queries=%s",
        model_state.is_information_enough,
        len(model_state.follow_up_questions),
        len(model_state.research_queries),
    )

    # Safeguard against never-ending loops while still allowing deeper clarification rounds.
    if rounds >= settings.max_clarification_rounds:
        model_state.is_information_enough = True

    model_state.run_web_search = bool(settings.enable_web_search and model_state.research_queries)
    model_state.research_results = []
    return _dump_state(model_state)


def web_search_node(state: dict[str, Any] | AgentState) -> dict[str, Any]:
    model_state = _as_state(state)
    logger.info("Running web research on official cloud documentation")
    results: list[ResearchResult] = []

    # Fetch only trusted official docs, preserving query/source provenance.
    for query in model_state.research_queries:
        try:
            query_start = time.perf_counter()
            items = web_search(
                query=query,
                cloud_provider=model_state.cloud_provider,
                max_results=4,
            )
            logger.info(
                "Fetched %s result(s) for %s in %.2f seconds",
                len(items),
                query,
                time.perf_counter() - query_start,
            )
            for item in items:
                item["query"] = query
                results.append(ResearchResult.model_validate(item))
        except Exception as exc:  # noqa: BLE001
            _safe_errors(model_state, f"search_failed[{query}]: {exc}")

    model_state.research_results = results
    logger.info(
        "Research collection finished with %s trusted source(s)",
        len(model_state.research_results),
    )
    if model_state.run_web_search and not model_state.research_results:
        _safe_errors(model_state, "research_failed: no trusted provider documentation found")
    model_state.web_search_done = True
    return _dump_state(model_state)


def information_gate_node(state: dict[str, Any] | AgentState) -> dict[str, Any]:
    model_state = _as_state(state)
    logger.info("Checking if product requirements are clear enough")
    
    # If user provided selected option answers, convert them to natural language user answers.
    if model_state.selected_option_answers:
        for q_idx, selected_value in model_state.selected_option_answers.items():
            if q_idx < len(model_state.questions_with_options):
                question_obj = model_state.questions_with_options[q_idx]
                # Find matching option to create a natural language response
                matched_option = None
                for opt in question_obj.options:
                    if opt.value == selected_value:
                        matched_option = opt
                        break
                
                if matched_option:
                    # Predefined option: use label for display
                    response = matched_option.label if not matched_option.is_custom else selected_value
                    logger.info("User selected option for '%s': %s", question_obj.original_question, response)
                    model_state.user_answers.append(response)
                else:
                    # No matching option found - treat as custom freeform input
                    # (user bypassed option selection and provided direct text)
                    logger.info("User provided custom input for '%s': %s", question_obj.original_question, selected_value)
                    model_state.user_answers.append(selected_value)
        model_state.selected_option_answers = {}  # Clear after processing
    
    if not model_state.is_information_enough:
        model_state.status = "needs_input"
        questions = model_state.follow_up_questions
        if not questions:
            model_state.follow_up_questions = [
                "What are your expected monthly active users and peak RPS?",
                "Which data compliance requirements must be met (e.g., SOC2, HIPAA)?",
            ]
        logger.info(
            "Some requirements are not clear, asking user via multiple-choice options",
        )
        
        # Log available questions with options
        if model_state.questions_with_options:
            for idx, q in enumerate(model_state.questions_with_options):
                options_str = ", ".join([f"{opt.label}" for opt in q.options])
                logger.info("Question %d: %s [Options: %s]", idx, q.original_question, options_str)
        else:
            logger.info("Agent asked the following to the user: %s", model_state.follow_up_questions)
        return _dump_state(model_state)

    model_state.status = "running"
    return _dump_state(model_state)


def plan_node(state: dict[str, Any] | AgentState) -> dict[str, Any]:
    model_state = _as_state(state)
    logger.info("Generating final PRD from user input, clarifications, and official docs")
    llm = get_llm()

    # The final PRD is grounded only on vetted official sources.
    official_results = [item.model_dump(mode="json") for item in model_state.research_results if item.is_official_source]
    official_links = [item["link"] for item in official_results if item.get("link")]

    prompt = (
        f"{PLANNER_PROMPT}\n\n"
        f"Cloud provider: {model_state.cloud_provider}\n"
        f"Initial Product Description:\n{model_state.prd_text}\n\n"
        f"User Clarifications:\n{model_state.user_answers}\n\n"
        f"Official Research Results:\n{official_results}\n"
    )

    try:
        start = time.perf_counter()
        response = llm.invoke(prompt)
        logger.info(
            "PRD generation completed in %.2f seconds",
            time.perf_counter() - start,
        )
        payload = PlannerOutput.model_validate(_extract_json(str(response.content)))

        # CoT is not logged; show a safe reasoning summary from structured model output.
        logger.info(
            "LLM reasoning summary: proposed_services=%s, open_questions=%s",
            len(payload.plan_json.proposed_cloud_services),
            len(payload.plan_json.open_questions),
        )

        # Ensure references always include collected official evidence.
        merged_refs = list(dict.fromkeys([*payload.plan_json.references, *official_links]))
        payload.plan_json.references = merged_refs

        model_state.plan_markdown = payload.plan_markdown
        model_state.plan_json = payload.plan_json
        model_state.errors = []
        logger.info(
            "Final PRD is structured: references=%s, open_questions=%s",
            len(model_state.plan_json.references),
            len(model_state.plan_json.open_questions),
        )
    except Exception as exc:  # noqa: BLE001
        _safe_errors(model_state, f"planner_failed: {exc}")
        model_state.plan_markdown = (
            f"# Draft {model_state.cloud_provider.upper()} Product Requirement Document\n\n"
            "Unable to generate validated PRD output. Please retry with additional clarifications."
        )
        model_state.plan_json = FinalPRDJson(
            scope=f"{model_state.cloud_provider.upper()} cloud product architecture",
            product_summary="Fallback PRD because planner output was invalid.",
            open_questions=model_state.follow_up_questions,
            references=official_links,
            risks_and_mitigations=["Planner failed to produce valid structured output"],
        )

    model_state.status = "plan_ready"
    model_state.accepted = None
    return _dump_state(model_state)


def acceptance_node(state: dict[str, Any] | AgentState) -> dict[str, Any]:
    model_state = _as_state(state)
    accepted = model_state.accepted
    if accepted is True:
        logger.info("User accepted the PRD")
        model_state.status = "accepted"
    elif accepted is False:
        logger.info("User rejected the PRD")
        model_state.status = "needs_input"
        if model_state.acceptance_feedback:
            logger.info("User suggested %s", model_state.acceptance_feedback)
            questions = list(model_state.follow_up_questions)
            questions.append(
                f"Incorporate this feedback into a revised plan: {model_state.acceptance_feedback}"
            )
            model_state.follow_up_questions = questions
    return _dump_state(model_state)


def information_route(state: dict[str, Any] | AgentState) -> str:
    model_state = _as_state(state)
    return "plan" if model_state.is_information_enough else "await_user"


def research_route(state: dict[str, Any] | AgentState) -> str:
    model_state = _as_state(state)
    return "web_search" if model_state.run_web_search else "information_gate"


def acceptance_route(state: dict[str, Any] | AgentState) -> str:
    model_state = _as_state(state)
    accepted = model_state.accepted
    if accepted is True:
        return "end"
    if accepted is False:
        return "user_input"
    return "end"
