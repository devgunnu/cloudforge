from __future__ import annotations

import json
import logging
import time
from typing import Any

from app.agents.agent1.llm import get_llm
from app.agents.agent1.prompts import CLARIFIER_PROMPT, PLANNER_PROMPT
from app.agents.agent1.state import AgentState, ClarifierOutput, FinalPRDJson, PlannerOutput, QuestionOption, QuestionWithOptions, ResearchResult
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


FALLBACK_CLARIFICATION_QUESTIONS = [
    "What user personas and core workflows should this product support?",
    "What are target scale, latency, availability, and compliance requirements?",
    "What are your primary data retention and lifecycle requirements?",
    "Which third-party systems must be integrated at launch?",
    "What are your observability, alerting, and incident response expectations?",
    "What are your budget guardrails and cost optimization constraints?",
]


def _extract_json(text: str) -> dict[str, Any]:
    # The LLM may prepend/append prose or emit multiple JSON blocks.
    # Parse the first JSON object safely and ignore trailing data.
    text = text.strip()
    try:
        return json.loads(text)
    except json.JSONDecodeError:
        start = text.find("{")
        if start >= 0:
            decoder = json.JSONDecoder()
            obj, _ = decoder.raw_decode(text[start:])
            if isinstance(obj, dict):
                return obj
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


def _normalize_options_metadata(payload: ClarifierOutput) -> None:
    for question in payload.questions_with_options:
        for option in question.options:
            if not option.description.strip():
                if option.is_custom:
                    option.description = "Provide your own requirement when presets do not fit."
                else:
                    option.description = f"Choose this when '{option.label}' best matches your use case."
            if not option.impact.strip():
                if option.is_custom:
                    option.impact = "Planner will adapt architecture using your custom guidance."
                else:
                    option.impact = "This choice directly influences service sizing, architecture complexity, and cost."


def _normalize_question(text: str) -> str:
    return " ".join(text.strip().lower().split())


def _extract_answered_question_set(state: AgentState) -> set[str]:
    return {
        _normalize_question(item.get("question", ""))
        for item in state.answered_qa_pairs
        if item.get("question")
    }


def _coerce_clarifier_payload(raw_payload: dict[str, Any]) -> dict[str, Any]:
    """Normalize model output into ClarifierOutput-compatible shape.

    Some local models (e.g. Gemma) return follow_up_questions entries as objects.
    This coercion extracts question strings and preserves option blocks when present.
    """
    normalized = dict(raw_payload)

    followups = normalized.get("follow_up_questions", [])
    qwo = normalized.get("questions_with_options", [])

    normalized_followups: list[str] = []
    normalized_qwo: list[dict[str, Any]] = []

    for item in followups if isinstance(followups, list) else []:
        if isinstance(item, str):
            normalized_followups.append(item)
            continue
        if not isinstance(item, dict):
            continue

        q_text = str(item.get("question", "")).strip()
        if not q_text:
            continue
        normalized_followups.append(q_text)

        options = item.get("options", [])
        if isinstance(options, list) and options:
            normalized_qwo.append(
                {
                    "question": q_text,
                    "original_question": q_text,
                    "options": options,
                }
            )

    for item in qwo if isinstance(qwo, list) else []:
        if not isinstance(item, dict):
            continue
        q_text = str(item.get("original_question") or item.get("question") or "").strip()
        if not q_text:
            continue
        normalized_qwo.append(
            {
                "question": str(item.get("question") or q_text),
                "original_question": q_text,
                "options": item.get("options", []),
            }
        )
        normalized_followups.append(q_text)

    # Keep stable order while deduplicating.
    dedup_followups: list[str] = []
    seen_followups: set[str] = set()
    for q in normalized_followups:
        k = _normalize_question(q)
        if not k or k in seen_followups:
            continue
        seen_followups.add(k)
        dedup_followups.append(q)

    dedup_qwo: list[dict[str, Any]] = []
    seen_qwo: set[str] = set()
    for item in normalized_qwo:
        k = _normalize_question(item.get("original_question", ""))
        if not k or k in seen_qwo:
            continue
        seen_qwo.add(k)
        dedup_qwo.append(item)

    normalized["follow_up_questions"] = dedup_followups
    normalized["questions_with_options"] = dedup_qwo
    return normalized


def _fallback_unanswered_questions(state: AgentState, limit: int = 2) -> list[str]:
    answered = _extract_answered_question_set(state)
    questions = [q for q in FALLBACK_CLARIFICATION_QUESTIONS if _normalize_question(q) not in answered]
    return questions[:limit]


def _coerce_planner_payload(raw_payload: dict[str, Any]) -> dict[str, Any]:
    """Normalize planner payload shape for fields where local models may emit dicts."""
    payload = dict(raw_payload)
    plan_json = payload.get("plan_json")
    if not isinstance(plan_json, dict):
        return payload

    normalized_plan = dict(plan_json)
    list_fields = [
        "functional_requirements",
        "non_functional_requirements",
        "proposed_cloud_services",
        "architecture_decisions",
        "deployment_plan",
        "risks_and_mitigations",
        "assumptions",
        "open_questions",
        "references",
    ]

    for field in list_fields:
        value = normalized_plan.get(field)
        if isinstance(value, list):
            continue
        if isinstance(value, dict):
            # Preserve deterministic order by key when model emits phase_1/phase_2 maps.
            normalized_plan[field] = [str(value[k]) for k in sorted(value)]
        elif value is None:
            normalized_plan[field] = []
        else:
            normalized_plan[field] = [str(value)]

    payload["plan_json"] = normalized_plan
    return payload


def _ingest_selected_answers(state: AgentState) -> None:
    """Convert selected answers into stable Q&A history before research mutates questions."""
    if not state.selected_option_answers:
        return

    for q_idx, selected_value in state.selected_option_answers.items():
        if q_idx >= len(state.questions_with_options):
            continue

        question_obj = state.questions_with_options[q_idx]
        question_text = question_obj.original_question or question_obj.question

        matched_option = None
        for opt in question_obj.options:
            if opt.value == selected_value:
                matched_option = opt
                break

        if matched_option:
            answer_text = matched_option.label if not matched_option.is_custom else selected_value
            logger.info("User selected option for '%s': %s", question_text, answer_text)
        else:
            answer_text = selected_value
            logger.info("User provided custom input for '%s': %s", question_text, answer_text)

        state.user_answers.append(answer_text)
        state.answered_qa_pairs.append({"question": question_text, "answer": answer_text})

    state.selected_option_answers = {}


def _fallback_options_for_question(question: str) -> list[QuestionOption]:
    q = question.lower()

    if any(key in q for key in ["persona", "user", "workflow", "audience"]):
        return [
            QuestionOption(
                label="Internal security and compliance teams",
                value="internal_security_compliance_teams",
                description="Focused on governance, policy checks, and enterprise controls.",
                impact="Prioritizes auditability, RBAC, and policy automation.",
            ),
            QuestionOption(
                label="IT operations and platform engineering",
                value="it_ops_platform_engineering",
                description="Focused on operational visibility and lifecycle workflows.",
                impact="Drives integration with automation pipelines and incident tooling.",
            ),
            QuestionOption(
                label="Mixed stakeholders (security + ops + leadership)",
                value="mixed_enterprise_stakeholders",
                description="Supports cross-functional reporting and decision-making.",
                impact="Requires role-specific views and stronger data model flexibility.",
            ),
            QuestionOption(
                label="Custom",
                value="custom",
                description="Provide your own persona/workflow details.",
                impact="Planner will adapt features and user journeys to your custom needs.",
                is_custom=True,
            ),
        ]

    if any(key in q for key in ["scale", "latency", "availability", "sla", "slo", "rps", "throughput"]):
        return [
            QuestionOption(
                label="Moderate scale, standard latency",
                value="moderate_scale_standard_latency",
                description="Good for initial enterprise rollout with predictable load.",
                impact="Lower baseline cost and simpler architecture at launch.",
            ),
            QuestionOption(
                label="High scale, near-real-time response",
                value="high_scale_near_realtime",
                description="Designed for larger tenant activity and frequent analysis runs.",
                impact="Needs autoscaling, partitioning, and tighter observability.",
            ),
            QuestionOption(
                label="Mission-critical, strict SLO/HA",
                value="mission_critical_strict_slo_ha",
                description="For regulated workloads with strict uptime/latency targets.",
                impact="Requires multi-region resilience and higher operational cost.",
            ),
            QuestionOption(
                label="Custom",
                value="custom",
                description="Provide custom scale and SLO targets.",
                impact="Planner will tune architecture and capacity to your explicit targets.",
                is_custom=True,
            ),
        ]

    if any(key in q for key in ["compliance", "regulation", "audit", "security", "gdpr", "hipaa", "soc2", "pii"]):
        return [
            QuestionOption(
                label="Baseline enterprise controls (SOC2-aligned)",
                value="baseline_soc2_aligned",
                description="Standard enterprise baseline with IAM and auditability.",
                impact="Enforces centralized logging and retention policies.",
            ),
            QuestionOption(
                label="Regulated controls (GDPR/PII)",
                value="regulated_gdpr_pii",
                description="Adds data locality and privacy governance constraints.",
                impact="Introduces stronger encryption and lifecycle requirements.",
            ),
            QuestionOption(
                label="Highly regulated (HIPAA/financial-grade)",
                value="highly_regulated_hipaa_finance",
                description="For strict compliance and formal control evidence.",
                impact="Needs immutable audit trails and stronger segmentation.",
            ),
            QuestionOption(
                label="Custom",
                value="custom",
                description="Provide your own compliance requirements.",
                impact="Planner will align architecture and controls to your obligations.",
                is_custom=True,
            ),
        ]

    return [
        QuestionOption(
            label="Lean baseline approach",
            value="lean_baseline_approach",
            description="Start with minimal capabilities and iterate quickly.",
            impact="Faster delivery and lower initial complexity.",
        ),
        QuestionOption(
            label="Balanced enterprise approach",
            value="balanced_enterprise_approach",
            description="Balance reliability, governance, and implementation effort.",
            impact="Moderate cost with good scalability and compliance readiness.",
        ),
        QuestionOption(
            label="Robust future-proof approach",
            value="robust_future_proof_approach",
            description="Design for high scale and strict governance from day one.",
            impact="Higher initial cost but fewer redesigns later.",
        ),
        QuestionOption(
            label="Custom",
            value="custom",
            description="Provide your own preferred direction.",
            impact="Planner will tailor architecture to your priorities.",
            is_custom=True,
        ),
    ]


def _ensure_questions_have_options(payload: ClarifierOutput) -> None:
    question_to_options: dict[str, QuestionWithOptions] = {}

    for item in payload.questions_with_options:
        q = item.original_question or item.question
        if not q:
            continue
        question_to_options[_normalize_question(q)] = item

    for question in payload.follow_up_questions:
        key = _normalize_question(question)
        if key in question_to_options:
            continue
        question_to_options[key] = QuestionWithOptions(
            question=question,
            original_question=question,
            options=_fallback_options_for_question(question),
        )

    payload.questions_with_options = list(question_to_options.values())


def user_input_node(state: dict[str, Any] | AgentState) -> dict[str, Any]:
    model_state = _as_state(state)
    logger.info("Processing user input")
    _ingest_selected_answers(model_state)
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
    
    # Build Q&A history from answered pairs for clarity.
    qa_history = ""
    if model_state.answered_qa_pairs:
        qa_history = "Previously Answered Questions:\n"
        for qa_pair in model_state.answered_qa_pairs:
            q = qa_pair.get("question", "")
            a = qa_pair.get("answer", "")
            qa_history += f"Q: {q}\nA: {a}\n\n"
        qa_history += "\n"
    
    # Include all prior answers and structured Q&A history to support deep, iterative clarification.
    prompt = (
        f"{CLARIFIER_PROMPT}\n\n"
        f"Cloud provider: {model_state.cloud_provider}\n"
        f"Initial Product Description:\n{model_state.prd_text}\n\n"
        f"{qa_history}"
        f"User Clarifications:\n{model_state.user_answers}\n"
    )

    try:
        start = time.perf_counter()
        response = llm.invoke(prompt)
        elapsed = time.perf_counter() - start
        logger.info("Research analysis completed in %.2f seconds", elapsed)
        raw_payload = _extract_json(str(response.content))
        payload = ClarifierOutput.model_validate(_coerce_clarifier_payload(raw_payload))
        _ensure_questions_have_options(payload)
        _normalize_options_metadata(payload)
    except Exception as exc:  # noqa: BLE001
        _safe_errors(model_state, f"clarifier_failed: {exc}")
        model_state.status = "needs_input"
        next_questions = _fallback_unanswered_questions(model_state, limit=2)
        if not next_questions:
            model_state.is_information_enough = True
            model_state.follow_up_questions = []
            model_state.questions_with_options = []
            model_state.run_web_search = False
            return _dump_state(model_state)

        model_state.follow_up_questions = next_questions
        fallback_payload = ClarifierOutput(
            is_information_enough=False,
            follow_up_questions=model_state.follow_up_questions,
            research_queries=[],
        )
        _ensure_questions_have_options(fallback_payload)
        _normalize_options_metadata(fallback_payload)
        model_state.questions_with_options = fallback_payload.questions_with_options
        return _dump_state(model_state)

    # CoT is not logged; show a safe reasoning summary from structured model output.
    logger.info(
        "LLM reasoning summary: information_enough=%s, first_question=%s",
        payload.is_information_enough,
        (payload.follow_up_questions[0] if payload.follow_up_questions else "none"),
    )

    answered_questions = _extract_answered_question_set(model_state)

    filtered_qwo: list[QuestionWithOptions] = []
    for qwo in payload.questions_with_options:
        q_text = qwo.original_question or qwo.question
        if _normalize_question(q_text) in answered_questions:
            continue
        filtered_qwo.append(qwo)

    filtered_followups = [
        q for q in payload.follow_up_questions if _normalize_question(q) not in answered_questions
    ]

    model_state.is_information_enough = payload.is_information_enough
    model_state.follow_up_questions = filtered_followups[:8]
    model_state.questions_with_options = filtered_qwo[:8]

    if not model_state.is_information_enough and not model_state.follow_up_questions:
        next_questions = _fallback_unanswered_questions(model_state, limit=2)
        if next_questions:
            model_state.follow_up_questions = next_questions
            fallback_payload = ClarifierOutput(
                is_information_enough=False,
                follow_up_questions=next_questions,
                research_queries=payload.research_queries,
            )
            _ensure_questions_have_options(fallback_payload)
            _normalize_options_metadata(fallback_payload)
            model_state.questions_with_options = fallback_payload.questions_with_options
        else:
            model_state.is_information_enough = True

    model_state.research_queries = _augment_research_queries(model_state, payload.research_queries)
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
            # Trim overly long queries — DuckDuckGo site: searches work better under ~8 words
            trimmed_query = ' '.join(query.split()[:8])
            query_start = time.perf_counter()
            items = web_search(
                query=trimmed_query,
                cloud_provider=model_state.cloud_provider,
                max_results=4,
            )
            logger.info(
                "Fetched %s result(s) for '%s' in %.2f seconds",
                len(items),
                trimmed_query,
                time.perf_counter() - query_start,
            )
            for item in items:
                item["query"] = trimmed_query
                results.append(ResearchResult.model_validate(item))
        except Exception as exc:  # noqa: BLE001
            _safe_errors(model_state, f"search_failed[{trimmed_query}]: {exc}")

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
    
    if not model_state.is_information_enough:
        model_state.status = "needs_input"
        if not model_state.follow_up_questions:
            next_questions = _fallback_unanswered_questions(model_state, limit=2)
            if next_questions:
                model_state.follow_up_questions = next_questions
                fallback_payload = ClarifierOutput(
                    is_information_enough=False,
                    follow_up_questions=next_questions,
                    research_queries=[],
                )
                _ensure_questions_have_options(fallback_payload)
                _normalize_options_metadata(fallback_payload)
                model_state.questions_with_options = fallback_payload.questions_with_options
            else:
                model_state.is_information_enough = True
                model_state.status = "running"
                return _dump_state(model_state)
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
        raw_payload = _extract_json(str(response.content))
        payload = PlannerOutput.model_validate(_coerce_planner_payload(raw_payload))

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


def await_user_node(state: dict[str, Any] | AgentState) -> dict[str, Any]:
    model_state = _as_state(state)
    model_state.status = "needs_input"
    logger.info("Waiting for user clarification input")
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
        return "await_user"
    return "end"
