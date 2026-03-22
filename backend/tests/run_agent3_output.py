"""
Runs the Agent 3 e2e pipeline against sample_topology.json using real Ollama
LLM calls and writes all generated artifacts to:
    %TEMP%/cloudforge-test-output/

Usage:
    cd cloudforge/backend
    uv run python tests/run_agent3_output.py
"""
from __future__ import annotations

import json
import sys
import uuid
from pathlib import Path
from typing import Any

# ---------------------------------------------------------------------------
# Sys-path bootstrap
# ---------------------------------------------------------------------------

_BACKEND_DIR = Path("c:/Users/aadit/Projects/CloudForge/cloudforge/backend")
sys.path.insert(0, str(_BACKEND_DIR))

# ---------------------------------------------------------------------------
# Import graph (real LLM, real tools — no patches)
# ---------------------------------------------------------------------------

import app.agents.agent3.graph as _graph_mod

# ---------------------------------------------------------------------------
# Build initial state
# ---------------------------------------------------------------------------


def _build_state(topology: dict[str, Any]) -> dict[str, Any]:
    return {
        "thread_id": str(uuid.uuid4()),
        "raw_input": json.dumps(topology),
        "input_format": "json",
        "language_overrides": {},
        "tf_max_retries": 3,
        "tf_fix_attempts": 0,
        "tf_validated": False,
        "tf_files": {},
        "tf_validation_results": [],
        "tf_error_summary": None,
        "services": [],
        "connections": [],
        "cloud_provider": "aws",
        "task_list": [],
        "orchestrator_messages": [],
        "orchestrator_iterations": 0,
        "orchestrator_max_iterations": 10,
        "api_contracts": [],
        "task_groups": [],
        "manager_plan_summary": "",
        "worker_results": [],
        "manager_review_count": 0,
        "code_files": {},
        "test_files": {},
        "code_errors": [],
        "scaffold_files": {},
        "file_manifest": [],
        "project_name": topology.get("project_name", "cloudforge-app"),
        "current_phase": "parsing",
        "pipeline_errors": [],
        "human_review_required": False,
        "human_review_message": None,
        "artifacts": {},
        "generation_metadata": {"project_name": topology.get("project_name", "cloudforge-app")},
    }


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

OUT_DIR = Path.home() / "AppData" / "Local" / "Temp" / "cloudforge-test-output"


def main() -> None:
    fixture = _BACKEND_DIR / "tests" / "fixtures" / "sample_topology.json"
    with open(fixture) as fh:
        topology = json.load(fh)

    print(f"Topology : {[s['id'] for s in topology['services']]}")
    print(f"Model    : {__import__('app.config', fromlist=['settings']).settings.agent3_model}")
    print(f"Output   : {OUT_DIR}\n")

    graph = _graph_mod.compile_graph()
    state = _build_state(topology)
    cfg = {"configurable": {"thread_id": state["thread_id"]}}
    result = graph.invoke(state, config=cfg)

    phase = result.get("current_phase", "?")
    artifacts: dict[str, str] = result.get("artifacts") or {}
    scaffold_files: dict[str, str] = result.get("scaffold_files") or {}
    human_review: bool = result.get("human_review_required", False)
    pipeline_errors: list = result.get("pipeline_errors") or []
    code_errors: list = result.get("code_errors") or []

    print(f"Phase            : {phase}")
    print(f"human_review     : {human_review}")
    print(f"pipeline_errors  : {pipeline_errors}")
    print(f"code_errors      : {code_errors}")
    print(f"scaffold_files   : {len(scaffold_files)}")
    print(f"artifacts        : {len(artifacts)}\n")

    OUT_DIR.mkdir(parents=True, exist_ok=True)
    written: list[str] = []
    for rel_path, content in sorted(artifacts.items()):
        out_path = OUT_DIR / rel_path
        out_path.parent.mkdir(parents=True, exist_ok=True)
        out_path.write_text(content, encoding="utf-8")
        written.append(rel_path)

    print("Files written:")
    for p in written:
        out_path = OUT_DIR / p
        print(f"  {p}  ({out_path.stat().st_size} bytes)")

    print(f"\nTotal: {len(written)} files → {OUT_DIR}")


if __name__ == "__main__":
    main()
