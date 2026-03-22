from __future__ import annotations

import logging
from urllib.parse import urlparse

from app.agents.agent1 import run_until_interrupt
from app.agents.agent1.nodes import acceptance_node
from app.agents.agent1.state import AgentState
from app.agents.agent1.tools import trusted_doc_domains


logger = logging.getLogger(__name__)

WHITE = "\033[97m"
GREY = "\033[90m"
YELLOW = "\033[93m"
PINK = "\033[95m"
GREEN = "\033[92m"
RESET = "\033[0m"


class YellowFormatter(logging.Formatter):
    def format(self, record: logging.LogRecord) -> str:
        msg = super().format(record)
        return f"{YELLOW}{msg}{RESET}"


def print_white(message: str) -> None:
    print(f"{WHITE}{message}{RESET}")


def print_grey(message: str) -> None:
    print(f"{GREY}{message}{RESET}")


def print_pink(message: str) -> None:
    print(f"{PINK}{message}{RESET}")


def print_green(message: str) -> None:
    print(f"{GREEN}{message}{RESET}")


def print_prd_snapshot(state: AgentState, stage: str) -> None:
    print_pink(f"PRD snapshot ({stage})")
    print_pink(f"- status: {state.status}")
    print_pink(f"- clarification_rounds: {state.clarification_rounds}")
    print_pink(f"- user_clarifications_count: {len(state.user_answers)}")
    print_pink(f"- pending_questions: {state.follow_up_questions[:3]}")
    print_pink(f"- research_sources_collected: {len(state.research_results)}")
    if state.plan_markdown:
        first_line = state.plan_markdown.splitlines()[0] if state.plan_markdown.splitlines() else "(empty)"
        print_pink(f"- plan_preview: {first_line}")
    else:
        print_pink("- plan_preview: not generated yet")


def _trusted_count(cloud_provider: str, refs: list[str]) -> int:
    trusted = trusted_doc_domains(cloud_provider)
    count = 0
    for ref in refs:
        domain = (urlparse(ref).netloc or "").lower()
        if any(domain == d or domain.endswith(f".{d}") for d in trusted):
            count += 1
    return count


def display_questions_with_options(state: AgentState) -> None:
    """Display questions with multiple-choice options to the user."""
    if not state.questions_with_options:
        # Fallback to plain-text questions
        if state.follow_up_questions:
            print_white("Agent questions:")
            for i, q in enumerate(state.follow_up_questions):
                print_white(f"  {i + 1}. {q}")
        return

    print_white("Agent questions (select option or provide custom input):")
    for idx, question in enumerate(state.questions_with_options):
        print_white(f"\n{idx + 1}. {question.original_question}")
        for opt_idx, option in enumerate(question.options):
            if option.is_custom:
                print_white(f"   - Custom input: (type your own answer)")
                if option.description:
                    print_white(f"     Description: {option.description}")
                if option.impact:
                    print_white(f"     Impact: {option.impact}")
            else:
                print_white(f"   - {option.label}")
                if option.description:
                    print_white(f"     Description: {option.description}")
                if option.impact:
                    print_white(f"     Impact: {option.impact}")


def _normalize(value: str) -> str:
    return " ".join(value.strip().lower().split())


def process_option_selection_by_text(state: AgentState, question_idx: int, user_input: str) -> None:
    """Map user input to an option value when possible, otherwise treat it as custom input."""
    question = state.questions_with_options[question_idx]
    normalized_input = _normalize(user_input)

    for option in question.options:
        option_label = _normalize(option.label)
        option_value = _normalize(option.value)
        if (
            option_label == normalized_input
            or option_value == normalized_input
            or normalized_input in option_label
            or option_label in normalized_input
        ):
            state.selected_option_answers[question_idx] = option.value
            logger.info("User matched option text for question %s: %s", question_idx + 1, option.label)
            return

    # No exact option match -> preserve as custom free-form input.
    state.selected_option_answers[question_idx] = user_input
    logger.info("User provided custom input for question %s", question_idx + 1)


def capture_user_answers(state: AgentState) -> None:
    if state.questions_with_options:
        display_questions_with_options(state)
        for idx, question in enumerate(state.questions_with_options):
            while True:
                user_input = input(f"Answer for Q{idx + 1} (option text/value or custom): ").strip()
                if not user_input:
                    print_white("Input cannot be empty. Please answer the question.")
                    continue
                process_option_selection_by_text(state, idx, user_input)
                break
        return

    if state.follow_up_questions:
        print_white("Agent questions:")
        for idx, question in enumerate(state.follow_up_questions):
            while True:
                user_input = input(f"Answer for Q{idx + 1}: {question}\n> ").strip()
                if not user_input:
                    print_white("Input cannot be empty. Please answer the question.")
                    continue
                state.user_answers.append(user_input)
                break


def handle_plan_acceptance(state: AgentState) -> AgentState:
    print_green("Plan is ready. Review below:")
    print_green(state.plan_markdown or "No PRD markdown generated")

    while True:
        decision = input("Do you accept this PRD? (yes/no): ").strip().lower()
        if decision in {"yes", "y"}:
            state.accepted = True
            state = AgentState.model_validate(acceptance_node(state))
            print_green("User accepted the PRD")
            return state
        if decision in {"no", "n"}:
            feedback = input("Please share feedback for revision: ").strip()
            state.accepted = False
            state.acceptance_feedback = feedback
            state = AgentState.model_validate(acceptance_node(state))
            print_white("PRD rejected. Continuing refinement with your feedback.")
            if feedback:
                state.user_answers.append(feedback)
            state.status = "running"
            return state
        print_white("Please answer with 'yes' or 'no'.")


def run_interactive_session() -> None:
    cloud_provider = input("Cloud provider (aws/azure/gcp) [aws]: ").strip().lower() or "aws"
    prd_text = input("Enter initial PRD text: ").strip()
    while not prd_text:
        prd_text = input("PRD cannot be empty. Enter initial PRD text: ").strip()

    state = AgentState(cloud_provider=cloud_provider, prd_text=prd_text)
    logger.info("Starting interactive standalone smoke session (%s)", cloud_provider)
    print_white(f"User input: {prd_text}")

    for i in range(1, 13):
        print_grey(f"Agent thinking step: round {i}, current status={state.status}")
        logger.info("Running round %s", i)
        state = run_until_interrupt(state)
        logger.info("Round %s completed: status=%s, errors=%s", i, state.status, len(state.errors))
        print_prd_snapshot(state, f"after round {i}")

        if state.status == "plan_ready":
            state = handle_plan_acceptance(state)
            if state.status == "accepted":
                break
            continue

        if state.status == "needs_input":
            capture_user_answers(state)
            state.status = "running"
            continue

        if state.status == "accepted":
            break

    refs = state.plan_json.references if state.plan_json else []
    trusted_refs = _trusted_count(state.cloud_provider, refs)

    print_white("---")
    print_white("INTERACTIVE SESSION SUMMARY")
    print_white(f"CLOUD_PROVIDER: {state.cloud_provider}")
    print_white(f"FINAL_STATUS: {state.status}")
    print_white(f"CLARIFICATION_ROUNDS: {state.clarification_rounds}")
    print_white(f"QUESTIONS_ASKED: {len(state.follow_up_questions)}")
    print_white(f"HAS_MARKDOWN_PLAN: {bool(state.plan_markdown)}")
    print_white(f"HAS_STRUCTURED_PRD: {state.plan_json is not None}")
    print_white(f"REFERENCE_COUNT: {len(refs)}")
    print_white(f"TRUSTED_REFERENCE_COUNT: {trusted_refs}")
    print_white(f"ERROR_COUNT: {len(state.errors)}")


if __name__ == "__main__":
    handler = logging.StreamHandler()
    handler.setFormatter(YellowFormatter("%(asctime)s | %(levelname)s | %(message)s"))
    root_logger = logging.getLogger()
    root_logger.handlers.clear()
    root_logger.setLevel(logging.INFO)
    root_logger.addHandler(handler)

    # Keep external library logs minimal.
    logging.getLogger("httpx").setLevel(logging.WARNING)
    logging.getLogger("httpx._client").setLevel(logging.WARNING)
    logging.getLogger("ddgs").setLevel(logging.WARNING)
    logging.getLogger("ddgs.ddgs").setLevel(logging.WARNING)
    logging.getLogger("primp").setLevel(logging.WARNING)
    logging.getLogger("urllib3").setLevel(logging.WARNING)

    print_grey("Agent thinking steps will be shown in grey")
    print_white("Agent outputs and user inputs will be shown in white")
    print_pink("Updated PRD snapshots will be shown in pink")
    print_green("Final user-accepted PRD will be shown in green")
    logger.info("Logs and intermediate steps are shown in yellow")
    logger.info("Raw chain-of-thought is not displayed; safe reasoning summaries are logged instead")

    run_interactive_session()
