"""
Scaffold smoke test — validates the deterministic scaffold phase without any LLM calls.

Run: cd backend && uv run python3 -m pytest tests/test_scaffold_smoke.py -v
  or: cd backend && uv run python3 tests/test_scaffold_smoke.py
"""
from __future__ import annotations

import json
import sys
from pathlib import Path

_BACKEND_DIR = Path(__file__).parent.parent
sys.path.insert(0, str(_BACKEND_DIR))

from dotenv import load_dotenv
load_dotenv(_BACKEND_DIR / ".env")

from app.agents.agent3.nodes.scaffold_node import scaffold_node
from app.agents.agent3.nodes.parse_input import parse_input_node

FIXTURE = Path(__file__).parent / "fixtures" / "sample_topology.json"

SEP = "-" * 72
PASS = "[ok]"
FAIL = "[!!]"


def _ok(msg):  print(f"  {PASS} {msg}")
def _err(msg): print(f"  {FAIL} {msg}")
def _info(msg): print(f"       {msg}")


def _assert(cond: bool, msg: str) -> bool:
    if cond: _ok(msg)
    else: _err(msg)
    return cond


def _build_initial_state(topology: dict) -> dict:
    import uuid
    return {
        "thread_id": str(uuid.uuid4()),
        "raw_input": json.dumps(topology),
        "input_format": "json",
        "language_overrides": {},
        "tf_max_retries": 1,
        "orchestrator_max_iterations": 10,
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
        "current_phase": "parsing",
        "pipeline_errors": [],
        "human_review_required": False,
        "human_review_message": None,
        "artifacts": {},
        "generation_metadata": {"project_name": topology.get("project_name", "test-app")},
        # New scaffold fields
        "scaffold_files": {},
        "file_manifest": [],
        "project_name": "",
    }


def test_parse_then_scaffold():
    print(f"\n{SEP}")
    print("  SCAFFOLD SMOKE TEST — sample_topology.json (Lambda + API GW + DynamoDB + Amplify)")
    print(SEP)

    topology = json.loads(FIXTURE.read_text())
    state = _build_initial_state(topology)

    # ── Step 1: parse_input ──────────────────────────────────────────────────
    print("\n[1] parse_input_node")
    parsed = parse_input_node(state)
    state.update(parsed)

    passed = True
    passed &= _assert(state["current_phase"] != "error", "parse_input: no error")
    passed &= _assert(len(state["services"]) == 4, f"4 services parsed (got {len(state['services'])})")
    passed &= _assert(len(state["connections"]) == 3, f"3 connections parsed (got {len(state['connections'])})")

    svc_ids = {s["id"] for s in state["services"]}
    passed &= _assert("frontend" in svc_ids, "amplify service present")
    passed &= _assert("todo_fn" in svc_ids, "lambda service present")

    # ── Step 2: scaffold_node ────────────────────────────────────────────────
    print("\n[2] scaffold_node")
    scaffold_out = scaffold_node(state)
    state.update(scaffold_out)

    scaffold_files: dict = state.get("scaffold_files", {})
    file_manifest: list = state.get("file_manifest", [])
    project_name: str = state.get("project_name", "")

    passed &= _assert(state["current_phase"] == "tf_generation",
                      f"phase == tf_generation (got {state['current_phase']})")
    passed &= _assert(project_name == "todo-app",
                      f"project_name == todo-app (got {project_name!r})")
    passed &= _assert(len(scaffold_files) > 0,
                      f"scaffold_files non-empty (got {len(scaffold_files)} files)")
    passed &= _assert(len(file_manifest) > 0,
                      f"file_manifest non-empty (got {len(file_manifest)} entries)")

    print(f"\n       scaffold_files ({len(scaffold_files)} files):")
    for path in sorted(scaffold_files):
        _info(path)

    # ── Step 3: Required template files present ─────────────────────────────
    print("\n[3] Required template files")

    required_templates = [
        "infrastructure/cdk.json",
        "infrastructure/package.json",
        "infrastructure/tsconfig.json",
        "infrastructure/bin/app.ts",
        "infrastructure/lib/stages/application-stage.ts",
        "infrastructure/lib/utils/naming.ts",
        "buildspec.yaml",
        ".gitignore",
        ".env.example",
        "services/layers/common/requirements.txt",
        # Frontend (amplify service present)
        "frontend/package.json",
        "frontend/tsconfig.json",
        "frontend/vite.config.ts",
        "frontend/index.html",
        "frontend/src/main.tsx",
        "frontend/amplify.yml",
    ]
    for path in required_templates:
        passed &= _assert(path in scaffold_files, f"scaffold: {path}")

    # ── Step 4: Lambda service files ─────────────────────────────────────────
    print("\n[4] Lambda service boilerplate")
    passed &= _assert("services/todo_fn/requirements.txt" in scaffold_files,
                      "todo_fn requirements.txt stub")

    # handler path uses index.py, NOT handler.py
    passed &= _assert(not any("handler.py" in p for p in scaffold_files),
                      "no handler.py paths in scaffold_files (all use index.py)")

    # ── Step 5: LLM slots in manifest ────────────────────────────────────────
    print("\n[5] LLM slots in file_manifest")
    llm_slots = [e for e in file_manifest if e["fill_strategy"] != "template"]
    required_llm_slots = [
        "services/todo_fn/index.py",
        "frontend/src/App.tsx",
    ]
    # CDK stacks (api-stack and frontend-stack at minimum)
    cdk_slots = [e["path"] for e in llm_slots if "stacks/" in e["path"]]
    passed &= _assert(len(cdk_slots) >= 2,
                      f"at least 2 CDK stack LLM slots (got {cdk_slots})")
    for slot in required_llm_slots:
        present = any(e["path"] == slot for e in llm_slots)
        passed &= _assert(present, f"LLM slot: {slot}")

    # ── Step 6: Content spot-checks ─────────────────────────────────────────
    print("\n[6] Content spot-checks")
    amplify_yml = scaffold_files.get("frontend/amplify.yml", "")
    passed &= _assert("frontend/dist" in amplify_yml,
                      "amplify.yml: baseDirectory: frontend/dist")

    buildspec = scaffold_files.get("buildspec.yaml", "")
    passed &= _assert("cdk deploy --all" in buildspec,
                      "buildspec.yaml: cdk deploy --all present")

    cdk_json = scaffold_files.get("infrastructure/cdk.json", "")
    passed &= _assert('"app"' in cdk_json,
                      "infrastructure/cdk.json: has app entry")

    main_tsx = scaffold_files.get("frontend/src/main.tsx", "")
    passed &= _assert("ReactDOM" in main_tsx or "createRoot" in main_tsx,
                      "frontend/src/main.tsx: ReactDOM/createRoot present")

    # ── Summary ──────────────────────────────────────────────────────────────
    print(f"\n{SEP}")
    if passed:
        print("  RESULT: ALL CHECKS PASSED")
    else:
        print("  RESULT: SOME CHECKS FAILED")
    print(SEP)
    return passed


if __name__ == "__main__":
    ok = test_parse_then_scaffold()
    sys.exit(0 if ok else 1)
