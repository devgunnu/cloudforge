from __future__ import annotations

from typing import Any

from langchain_core.messages import HumanMessage, SystemMessage

from app.agents.agent3.llm import get_default_llm, get_structured_llm
from app.agents.agent3.models import TFGeneratorOutput
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

    msgs = [SystemMessage(content=system_msg), HumanMessage(content=user_msg)]
    tf_files: dict[str, str] = {}

    # --- Primary path: structured output (avoids JSON escaping issues) ---
    try:
        result = get_structured_llm(TFGeneratorOutput).invoke(msgs)
        plan: TFGeneratorOutput | None = result.get("parsed")
        if result.get("parsing_error"):
            raise ValueError(f"structured output parse error: {result['parsing_error']}")
        if plan and plan.files:
            tf_files = {f.name: f.content for f in plan.files}
    except Exception as e:
        # --- Fallback: raw LLM call + safe_json_extract ---
        try:
            response = get_default_llm().invoke(msgs)
            data = safe_json_extract(response.content)
            tf_files = {
                f["name"]: f["content"]
                for f in data.get("files", [])
                if isinstance(f, dict) and "name" in f and "content" in f
            }
        except Exception as e2:
            return {
                "current_phase": "error",
                "pipeline_errors": [f"TF generation failed: {e2}"],
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
