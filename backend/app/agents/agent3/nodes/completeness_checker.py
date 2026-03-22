from __future__ import annotations

import logging
from typing import Any

from app.agents.agent3.state import AgentState, FileManifestEntry

logger = logging.getLogger(__name__)


def completeness_checker_node(state: AgentState) -> dict[str, Any]:
    """Verify all required LLM-filled files have been generated before assembly.

    Template files are excluded from the check because they are always
    written deterministically by scaffold_node. Only slots whose
    fill_strategy is NOT "template" and whose required flag is True are
    checked here.
    """
    file_manifest: list[FileManifestEntry] = state.get("file_manifest") or []

    # Build the union of all generated file paths
    generated_keys: set[str] = set()
    generated_keys.update((state.get("scaffold_files") or {}).keys())
    generated_keys.update((state.get("tf_files") or {}).keys())
    generated_keys.update((state.get("code_files") or {}).keys())
    generated_keys.update((state.get("test_files") or {}).keys())

    missing: list[str] = [
        entry["path"]
        for entry in file_manifest
        if entry["required"]
        and entry["fill_strategy"] != "template"
        and entry["path"] not in generated_keys
    ]

    if missing:
        logger.warning(
            "completeness_checker: %d required files missing: %s",
            len(missing),
            missing,
        )
        return {
            "current_phase": "assembly",
            "human_review_required": True,
            "human_review_message": (
                f"Missing {len(missing)} required file(s): " + ", ".join(missing)
            ),
        }

    logger.info(
        "completeness_checker: all required files present (%d total)",
        len(generated_keys),
    )
    return {"current_phase": "assembly"}
