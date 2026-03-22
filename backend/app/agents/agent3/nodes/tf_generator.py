from __future__ import annotations

from typing import Any

from langchain_core.messages import HumanMessage, SystemMessage

from app.agents.agent3.llm import get_default_llm
from app.agents.agent3.prompts.tf_prompts import tf_generation_system, tf_generation_user
from app.agents.agent3.state import AgentState
from app.agents.agent3.utils import safe_json_extract


def tf_generator_node(state: AgentState) -> dict[str, Any]:
    """Call Claude to generate Terraform HCL files from the parsed topology."""
    services = state.get("services", [])
    connections = state.get("connections", [])
    cloud_provider = state.get("cloud_provider", "aws")

    # Decide if a modules structure is warranted (>= 3 services)
    use_modules = len(services) >= 3

    system_msg = tf_generation_system(use_modules=use_modules)
    user_msg = tf_generation_user(
        cloud_provider=cloud_provider,
        services=[dict(s) for s in services],
        connections=[dict(c) for c in connections],
    )

    try:
        response = get_default_llm().invoke(
            [SystemMessage(content=system_msg), HumanMessage(content=user_msg)]
        )
        data = safe_json_extract(response.content)

        tf_files: dict[str, str] = {
            f["name"]: f["content"]
            for f in data.get("files", [])
            if isinstance(f, dict) and "name" in f and "content" in f
        }

        if not tf_files:
            return {
                "current_phase": "error",
                "pipeline_errors": ["TF generator returned no files — LLM response was empty or malformed"],
            }

        return {
            "tf_files": tf_files,
            "current_phase": "tf_validation",
        }
    except ValueError as e:
        return {
            "current_phase": "error",
            "pipeline_errors": [f"TF generator JSON parse error: {e}"],
        }
    except Exception as e:
        return {
            "current_phase": "error",
            "pipeline_errors": [f"TF generation failed: {e}"],
        }
