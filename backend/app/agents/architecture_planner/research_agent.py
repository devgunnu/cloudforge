from __future__ import annotations
import logging
from langchain_core.messages import HumanMessage
from app.agents.architecture_planner.state import ArchitecturePlannerState
from app.agents.architecture_planner.prompts import render_prompt
from app.agents.architecture_planner.llm_utils import API_ERROR_TYPES, invoke_with_retry

logger = logging.getLogger(__name__)

__all__ = ["make_research_node"]


def make_research_node(llm):
    def research_node(state: ArchitecturePlannerState) -> dict:
        logger.info("[research] starting — provider=%s budget=%s", state.get("cloud_provider"), state.get("budget"))
        prompt = render_prompt(
            "research",
            budget=state["budget"],
            traffic=state["traffic"],
            availability=state["availability"],
            prd=state["prd"],
            cloud_provider=state["cloud_provider"],
            user_change_requests=state.get("user_change_requests", ""),
        )
        # Research only needs a short output — cap at 1024 tokens to avoid
        # inheriting the 48k default from the shared LLM instance.
        research_llm = llm.bind(max_tokens=2048)
        try:
            response = invoke_with_retry(lambda: research_llm.invoke([HumanMessage(content=prompt)]))
            logger.info("[research] done — %d chars", len(response.content))
            return {"research_results": response.content, "current_node": "research"}
        except API_ERROR_TYPES as exc:
            return {
                "research_results": "",
                "current_node": "research",
                "error_message": f"Research failed: {exc}",
            }
        except Exception as exc:
            return {"research_results": "", "current_node": "research", "error_message": str(exc)}
    return research_node
