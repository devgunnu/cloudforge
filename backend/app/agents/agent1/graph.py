from __future__ import annotations

from functools import lru_cache

from langgraph.graph import END, START, StateGraph

from app.agents.agent1.nodes import acceptance_node, acceptance_route, information_gate_node, information_route, plan_node, research_route, research_node, user_input_node, web_search_node

@lru_cache(maxsize=1)
def build_graph():
    # Graph keeps a plain dict state; node functions perform pydantic validation.
    graph = StateGraph(dict)
    graph.add_node("user_input", user_input_node)
    graph.add_node("research", research_node)
    graph.add_node("web_search", web_search_node)
    graph.add_node("information_gate", information_gate_node)
    graph.add_node("plan", plan_node)
    graph.add_node("acceptance", acceptance_node)

    graph.add_edge(START, "user_input")
    graph.add_edge("user_input", "research")
    graph.add_conditional_edges(
        "research",
        research_route,
        {
            "web_search": "web_search",
            "information_gate": "information_gate",
        },
    )
    graph.add_edge("web_search", "research")
    graph.add_conditional_edges(
        "information_gate",
        information_route,
        {
            "await_user": END,
            "plan": "plan",
        },
    )
    graph.add_edge("plan", "acceptance")
    graph.add_conditional_edges(
        "acceptance",
        acceptance_route,
        {
            "user_input": "user_input",
            "end": END,
        },
    )

    return graph.compile()
