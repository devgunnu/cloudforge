from __future__ import annotations

from functools import lru_cache

from langgraph.graph import END, START, StateGraph

from app.agents.agent1.nodes import acceptance_node, acceptance_route, await_user_node, information_gate_node, information_route, plan_node, research_route, research_node, user_input_node, web_search_node
from app.agents.agent1.state import AgentState

@lru_cache(maxsize=1)
def build_graph():
    graph = StateGraph(AgentState)
    graph.add_node("user_input", user_input_node)
    graph.add_node("research", research_node)
    graph.add_node("web_search", web_search_node)
    graph.add_node("information_gate", information_gate_node)
    graph.add_node("await_user", await_user_node)
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
            "await_user": "await_user",
            "plan": "plan",
        },
    )
    graph.add_edge("await_user", END)
    graph.add_edge("plan", "acceptance")
    graph.add_conditional_edges(
        "acceptance",
        acceptance_route,
        {
            "await_user": "await_user",
            "end": END,
        },
    )

    return graph.compile()


def _fallback_mermaid() -> str:
    return """flowchart TD
    S[START] --> A[Initial idea from USER]
    A --Cloud provider, Idea--> B[Research Agent]
    B --Search Queries--> C[Optional web search Tool]
    B --Draft PRD--> E{Is some more information/clarification about usecase or an aspect required from USER?}
    E --YES--> F[Get additional information / clarification from USER]
    E --NO--> G[Plan]
    G --Semifinal PRD--> H{Accept?}
    C --Web Results--> B
    F --Additional Information / Clarification--> B
    H --NO--> F
    H --YES-->I[END]
"""


def mermaid_graph() -> str:
    compiled = build_graph()
    try:
        return compiled.get_graph().draw_mermaid()
    except Exception:
        return _fallback_mermaid()


if __name__ == '__main__':
    mermaid = mermaid_graph()
    print(mermaid)
