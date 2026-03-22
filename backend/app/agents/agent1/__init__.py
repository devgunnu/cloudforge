from typing import Any
import logging
import time

from app.agents.agent1.state import AgentState, AgentStatus


logger = logging.getLogger(__name__)


def run_until_interrupt(state: AgentState | dict[str, Any]) -> AgentState:
    """Run the graph until it reaches a user-interruptible status."""
    # Lazy import avoids package-level graph module initialization side effects.
    from app.agents.agent1.graph import build_graph

    graph = build_graph()
    initial_state = AgentState.model_validate(state)
    logger.info("Starting agent run")
    start = time.perf_counter()
    result = graph.invoke(initial_state.as_graph_state())
    final_state = AgentState.model_validate(result)
    logger.info(
        "Agent run finished: status=%s, clarification_rounds=%s, elapsed_sec=%.2f",
        final_state.status,
        final_state.clarification_rounds,
        time.perf_counter() - start,
    )
    return final_state


__all__ = ["AgentState", "AgentStatus", "run_until_interrupt"]
