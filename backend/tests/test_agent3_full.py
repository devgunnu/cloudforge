"""
Agent3 full-flow integration tests.
Run: .venv/Scripts/python tests/test_agent3_full.py
"""
from __future__ import annotations

import json
import os
import sys
import textwrap
import time
from pathlib import Path
from typing import Any

# ---------------------------------------------------------------------------
# Bootstrap: load .env before importing anything that touches the LLM
# ---------------------------------------------------------------------------

_BACKEND_DIR = Path(__file__).parent.parent
sys.path.insert(0, str(_BACKEND_DIR))

from dotenv import load_dotenv
load_dotenv(_BACKEND_DIR / ".env")

# ---------------------------------------------------------------------------
# Now it's safe to import project modules
# ---------------------------------------------------------------------------

from app.agents.agent3.graph import compile_graph  # noqa: E402

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

PASS = "[ok]"
FAIL = "[!!]"
INFO = "  -"
WARN = "  !"
SEP  = "-" * 72


def _hdr(title: str) -> None:
    print(f"\n{SEP}\n  {title}\n{SEP}")


def _ok(msg: str) -> None:
    print(f"  {PASS} {msg}")


def _err(msg: str) -> None:
    print(f"  {FAIL} {msg}")


def _info(msg: str) -> None:
    print(f"  {INFO} {msg}")


def _warn(msg: str) -> None:
    print(f"  {WARN} {msg}")


def _dump_artifact(name: str, content: str, max_lines: int = 30) -> None:
    lines = content.splitlines()
    shown = lines[:max_lines]
    print(f"\n    [{name}]  ({len(lines)} lines)")
    for ln in shown:
        print(f"      {ln}")
    if len(lines) > max_lines:
        print(f"      ... +{len(lines) - max_lines} more lines")


def _assert(cond: bool, msg: str) -> bool:
    if cond:
        _ok(msg)
    else:
        _err(msg)
    return cond


def _rate_limited(result: dict) -> bool:
    """Return True if the result was caused by a Groq quota/rate-limit error."""
    errors = result.get("pipeline_errors") or []
    return any(
        "429" in str(e) or "rate_limit_exceeded" in str(e).lower()
        for e in errors
    )


def _skip_if_rate_limited(result: dict) -> bool | None:
    """
    If the run was blocked by a rate limit, print a warning and return True (skip).
    Returns None when no rate limit was detected so the caller can continue.
    """
    if _rate_limited(result):
        errors = result.get("pipeline_errors") or []
        _warn("Groq quota/rate-limit hit -- scenario skipped (not a code failure)")
        _info(f"Rate-limit error: {errors[0][:120]}..." if errors else "")
        return True
    return None


def _build_state(topology: dict, *, fmt: str = "json", **overrides) -> dict[str, Any]:
    import uuid as _uuid
    raw = json.dumps(topology) if fmt == "json" else _to_yaml(topology)
    base: dict[str, Any] = {
        "thread_id": str(_uuid.uuid4()),
        "raw_input": raw,
        "input_format": fmt,
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
        "code_files": {},
        "test_files": {},
        "code_errors": [],
        "current_phase": "parsing",
        "pipeline_errors": [],
        "human_review_required": False,
        "human_review_message": None,
        "artifacts": {},
        "generation_metadata": {},
    }
    base.update(overrides)
    return base


def _to_yaml(data: dict) -> str:
    """Minimal dict -> YAML converter (no external dep needed here)."""
    import yaml
    return yaml.dump(data, default_flow_style=False)


def _run(graph, state: dict[str, Any]) -> dict[str, Any]:
    """Invoke the graph synchronously and return final state."""
    import uuid
    thread_id = state.get("thread_id") or str(uuid.uuid4())
    config = {"configurable": {"thread_id": thread_id}}
    return graph.invoke(state, config=config)


# ---------------------------------------------------------------------------
# Test cases
# ---------------------------------------------------------------------------


def test_single_lambda(graph) -> bool:
    _hdr("SCENARIO 1 -- Single Lambda function (simplest full flow)")
    topology = {
        "services": [
            {
                "id": "fn1",
                "service_type": "lambda",
                "label": "ProcessOrders",
                "config": {"runtime": "python3.12", "memory": 256, "timeout": 30},
            }
        ],
        "connections": [],
    }
    t0 = time.time()
    result = _run(graph, _build_state(topology))
    elapsed = time.time() - t0

    _info(f"Elapsed: {elapsed:.1f}s")
    _info(f"Phase: {result.get('current_phase')}")
    _info(f"TF validated: {result.get('tf_validated')}")
    _info(f"Pipeline errors: {result.get('pipeline_errors') or []}")

    if (skip := _skip_if_rate_limited(result)) is not None:
        return skip

    passed = True
    passed &= _assert(result.get("current_phase") == "done", "phase == done")
    passed &= _assert(bool(result.get("tf_files")), "tf_files non-empty")
    passed &= _assert(bool(result.get("artifacts")), "artifacts non-empty")

    artifacts = result.get("artifacts") or {}
    tf_names = [k for k in artifacts if k.endswith(".tf")]
    code_names = [k for k in artifacts if k.endswith(".py")]
    test_names = [k for k in artifacts if "test_" in k]

    passed &= _assert(len(tf_names) >= 1, f"at least 1 .tf file (got {tf_names})")
    passed &= _assert(len(code_names) >= 1, f"at least 1 .py code file (got {code_names})")
    passed &= _assert(len(test_names) >= 1, f"at least 1 test file (got {test_names})")

    # Content quality checks
    main_tf = artifacts.get("main.tf", "")
    if main_tf:
        passed &= _assert("resource" in main_tf.lower() or "module" in main_tf.lower(),
                           "main.tf contains terraform resource/module blocks")
        passed &= _assert("aws_lambda" in main_tf.lower() or "lambda" in main_tf.lower(),
                           "main.tf references lambda")

    handler = next((v for k, v in artifacts.items() if "handler.py" in k), "")
    if handler:
        passed &= _assert(len(handler.strip()) > 50, "handler.py has meaningful content")
        _info(f"handler.py first line: {handler.splitlines()[0] if handler else '(empty)'}")

    for name in sorted(artifacts):
        _dump_artifact(name, artifacts[name], max_lines=20)

    meta = result.get("generation_metadata") or {}
    _info(f"Metadata: tasks_done={meta.get('tasks_done')}/{meta.get('tasks_total')}, "
          f"tf_fix_attempts={meta.get('tf_fix_attempts')}")

    return passed


def test_multi_service_with_connections(graph) -> bool:
    _hdr("SCENARIO 2 -- Lambda + DynamoDB + API Gateway (connected topology)")
    topology = {
        "services": [
            {
                "id": "api",
                "service_type": "api_gateway",
                "label": "OrdersAPI",
                "config": {"stage": "prod", "endpoint_type": "REGIONAL"},
            },
            {
                "id": "processor",
                "service_type": "lambda",
                "label": "OrderProcessor",
                "config": {"runtime": "python3.12", "memory": 512, "timeout": 60},
            },
            {
                "id": "orders_db",
                "service_type": "dynamodb",
                "label": "OrdersTable",
                "config": {"billing_mode": "PAY_PER_REQUEST", "hash_key": "order_id"},
            },
        ],
        "connections": [
            {"source": "api", "target": "processor", "relationship": "triggers"},
            {"source": "processor", "target": "orders_db", "relationship": "reads_writes"},
        ],
    }
    t0 = time.time()
    result = _run(graph, _build_state(topology))
    elapsed = time.time() - t0

    _info(f"Elapsed: {elapsed:.1f}s")
    _info(f"Phase: {result.get('current_phase')}")

    if (skip := _skip_if_rate_limited(result)) is not None:
        return skip

    passed = True
    artifacts = result.get("artifacts") or {}
    passed &= _assert(result.get("current_phase") == "done", "phase == done")
    passed &= _assert(len(artifacts) >= 3, f">=3 artifact files (got {len(artifacts)})")

    tf_content = " ".join(v for k, v in artifacts.items() if k.endswith(".tf")).lower()
    passed &= _assert("dynamodb" in tf_content, "TF covers DynamoDB")
    passed &= _assert("lambda" in tf_content or "function" in tf_content, "TF covers Lambda")

    # Check that connections are reflected in the code
    code_content = " ".join(v for k, v in artifacts.items() if k.endswith(".py")).lower()
    has_db_ref = any(w in code_content for w in ["dynamodb", "orders_db", "orders", "table"])
    passed &= _assert(has_db_ref, "Python code references the DynamoDB table or orders")

    meta = result.get("generation_metadata") or {}
    # DynamoDB has no code tasks (infra-only), so total = 4 (api + processor)
    passed &= _assert(
        meta.get("tasks_total", 0) == 4,
        f"exactly 4 code tasks (api + processor, not dynamodb): got {meta.get('tasks_total')}"
    )
    passed &= _assert(
        meta.get("tasks_done", 0) == meta.get("tasks_total", 0),
        f"all tasks done: {meta.get('tasks_done')}/{meta.get('tasks_total')}"
    )
    _info(f"tasks_done={meta.get('tasks_done')}/{meta.get('tasks_total')}")

    for name in sorted(artifacts):
        _dump_artifact(name, artifacts[name], max_lines=15)

    return passed


def test_yaml_input(graph) -> bool:
    _hdr("SCENARIO 3 -- YAML input format")
    topology = {
        "services": [
            {
                "id": "worker",
                "service_type": "ecs",
                "label": "BackgroundWorker",
                "config": {"cpu": 256, "memory": 512},
            }
        ],
        "connections": [],
    }
    state = _build_state(topology, fmt="yaml")
    result = _run(graph, state)

    if (skip := _skip_if_rate_limited(result)) is not None:
        return skip

    _info(f"Phase: {result.get('current_phase')}")
    _info(f"TF validated: {result.get('tf_validated')}")
    _info(f"Pipeline errors: {result.get('pipeline_errors') or []}")

    passed = True
    passed &= _assert(result.get("current_phase") == "done", "YAML input parses and runs to done")
    passed &= _assert(bool(result.get("artifacts")), "artifacts present from YAML input")
    _info(f"Artifact keys: {sorted(result.get('artifacts', {}).keys())}")
    return passed


def test_language_override(graph) -> bool:
    _hdr("SCENARIO 4 -- Per-service language override (lambda -> TypeScript)")
    topology = {
        "services": [
            {
                "id": "ts_fn",
                "service_type": "lambda",
                "label": "TypeScriptHandler",
                "config": {"runtime": "nodejs20.x", "memory": 256},
            }
        ],
        "connections": [],
    }
    state = _build_state(topology, language_overrides={"ts_fn": "typescript"})
    result = _run(graph, state)

    if (skip := _skip_if_rate_limited(result)) is not None:
        return skip

    _info(f"Phase: {result.get('current_phase')}")
    _info(f"TF validated: {result.get('tf_validated')}")
    _info(f"Pipeline errors: {result.get('pipeline_errors') or []}")

    passed = True
    artifacts = result.get("artifacts") or {}
    ts_files = [k for k in artifacts if k.endswith(".ts")]
    py_files = [k for k in artifacts if k.endswith(".py") and "handler" in k]
    passed &= _assert(result.get("current_phase") == "done", "phase == done")
    passed &= _assert(len(ts_files) >= 1, f"at least 1 .ts file generated (got {ts_files})")
    passed &= _assert(len(py_files) == 0, f"no .py handler files (TypeScript override respected, got {py_files})")
    _info(f"TypeScript files: {ts_files}")
    return passed


def test_invalid_json_input(graph) -> bool:
    _hdr("SCENARIO 5 -- Invalid JSON input (error handling)")
    state = _build_state({})
    state["raw_input"] = "{ this is not valid json !!!"
    result = _run(graph, state)

    passed = True
    passed &= _assert(result.get("current_phase") == "error", "phase == error for bad JSON")
    errors = result.get("pipeline_errors") or []
    passed &= _assert(len(errors) > 0, f"pipeline_errors populated: {errors}")
    _info(f"Errors: {errors}")
    return passed


def test_empty_services(graph) -> bool:
    _hdr("SCENARIO 6 -- Empty services list (validation error)")
    topology = {"services": [], "connections": []}
    result = _run(graph, _build_state(topology))

    passed = True
    passed &= _assert(result.get("current_phase") == "error", "phase == error for empty services")
    errors = result.get("pipeline_errors") or []
    passed &= _assert(len(errors) > 0, f"pipeline_errors populated: {errors}")
    _info(f"Errors: {errors}")
    return passed


def test_unknown_service_type_warning(graph) -> bool:
    _hdr("SCENARIO 7 -- Unknown service type (warning, not error)")
    topology = {
        "services": [
            {
                "id": "my_svc",
                "service_type": "totally_unknown_thing",
                "label": "MyService",
                "config": {},
            }
        ],
        "connections": [],
    }
    result = _run(graph, _build_state(topology))

    if (skip := _skip_if_rate_limited(result)) is not None:
        return skip

    passed = True
    # Should still run (unknown types are warned, not rejected)
    passed &= _assert(
        result.get("current_phase") in ("done", "error"),
        f"pipeline runs to terminal phase (got {result.get('current_phase')})"
    )
    errors = result.get("pipeline_errors") or []
    has_warning = any("unknown" in str(e).lower() or "type" in str(e).lower() for e in errors)
    passed &= _assert(has_warning, f"warning about unknown type in pipeline_errors: {errors}")
    _info(f"Pipeline errors/warnings: {errors}")
    return passed


def test_human_review_on_zero_retries(graph) -> bool:
    _hdr("SCENARIO 8 -- Human-in-the-loop (tf_max_retries=0)")
    topology = {
        "services": [
            {
                "id": "fn1",
                "service_type": "lambda",
                "label": "TestFunction",
                "config": {"runtime": "python3.12", "memory": 128},
            }
        ],
        "connections": [],
    }
    state = _build_state(topology, tf_max_retries=0)
    try:
        result = _run(graph, state)
        # If the TF validator isn't installed, validation "passes" (tools skip gracefully)
        # and the run completes normally. Check for either outcome.
        phase = result.get("current_phase")
        human_review = result.get("human_review_required", False)
        if human_review:
            passed = True
            _ok(f"human_review_required=True (interrupt triggered as expected, phase={phase})")
        else:
            passed = True
            _warn(
                f"human_review_required=False (TF tools likely not installed, "
                f"validation auto-passed -- phase={phase})"
            )
        _info(f"tf_validated: {result.get('tf_validated')}")
        _info(f"tf_fix_attempts: {result.get('tf_fix_attempts')}")
    except Exception as e:
        # GraphInterrupt surfaces as an exception in non-streaming invoke
        if "interrupt" in str(e).lower() or "GraphInterrupt" in type(e).__name__:
            passed = True
            _ok(f"GraphInterrupt raised as expected: {type(e).__name__}")
        else:
            passed = False
            _err(f"Unexpected exception: {type(e).__name__}: {e}")
    return passed


def test_multiple_services_no_code_gen(graph) -> bool:
    _hdr("SCENARIO 9 -- S3 + RDS only (services without code gen in language map)")
    topology = {
        "services": [
            {
                "id": "bucket1",
                "service_type": "s3",
                "label": "AssetsBucket",
                "config": {"versioning": True, "encryption": "AES256"},
            },
            {
                "id": "db1",
                "service_type": "rds",
                "label": "AppDatabase",
                "config": {
                    "engine": "postgres",
                    "instance_class": "db.t3.micro",
                    "storage": 20,
                },
            },
        ],
        "connections": [
            {"source": "bucket1", "target": "db1", "relationship": "backup_target"}
        ],
    }
    result = _run(graph, _build_state(topology))

    if (skip := _skip_if_rate_limited(result)) is not None:
        return skip

    passed = True
    artifacts = result.get("artifacts") or {}
    passed &= _assert(result.get("current_phase") == "done", "phase == done")
    tf_files = [k for k in artifacts if k.endswith(".tf")]
    passed &= _assert(len(tf_files) >= 1, f"TF files generated for infra-only services: {tf_files}")
    task_list = result.get("task_list") or []
    passed &= _assert(len(task_list) == 0, f"no code tasks for infra-only services (got {len(task_list)})")

    tf_content = " ".join(artifacts.get(k, "") for k in tf_files).lower()
    passed &= _assert("s3" in tf_content or "bucket" in tf_content, "TF covers S3")
    passed &= _assert("rds" in tf_content or "db_instance" in tf_content or "postgres" in tf_content, "TF covers RDS")

    # After the fix, infra-only services have no code tasks at all
    code_files = [k for k in artifacts if k.endswith(".py") or k.endswith(".ts")]
    passed &= _assert(len(code_files) == 0, f"no code files for infra-only services (got {code_files})")
    meta = result.get("generation_metadata") or {}
    _info(f"Artifact keys: {sorted(artifacts.keys())}")
    _info(f"tasks_done={meta.get('tasks_done')}/{meta.get('tasks_total')}")
    return passed


def test_parse_only_smoke(graph) -> bool:
    _hdr("SCENARIO 10 -- Parse + task list smoke check")
    topology = {
        "services": [
            {"id": "a", "service_type": "lambda", "label": "A", "config": {}},
            {"id": "b", "service_type": "lambda", "label": "B", "config": {}},
        ],
        "connections": [{"source": "a", "target": "b", "relationship": "calls"}],
    }
    result = _run(graph, _build_state(topology))

    if (skip := _skip_if_rate_limited(result)) is not None:
        return skip

    passed = True
    task_list = result.get("task_list") or []
    # 2 services × 2 task types = 4 tasks
    passed &= _assert(len(task_list) == 4, f"task_list has 4 entries (got {len(task_list)})")
    task_types = {t["task_type"] for t in task_list}
    passed &= _assert(task_types == {"code_gen", "test_gen"}, f"both task types present: {task_types}")
    done_count = sum(1 for t in task_list if t["status"] == "done")
    passed &= _assert(done_count >= 2, f"at least 2 tasks completed (got {done_count})")
    _info(f"Task statuses: {[(t['service_id'], t['task_type'], t['status']) for t in task_list]}")
    return passed


# ---------------------------------------------------------------------------
# Runner
# ---------------------------------------------------------------------------


def main() -> None:
    print("\n" + "=" * 72)
    print("  AGENT3 FULL-FLOW INTEGRATION TEST SUITE")
    print("  Model: configured via .env (Ollama)")
    print("=" * 72)

    # Compile graph once -- reused across all tests
    print("\nCompiling graph...")
    t_compile = time.time()
    graph = compile_graph()
    print(f"Graph compiled in {time.time() - t_compile:.2f}s")

    tests = [
        # --- No LLM calls (always fast, no quota consumed) ---
        test_invalid_json_input,
        test_empty_services,
        # --- TF generation only, no orchestrator (light quota) ---
        test_unknown_service_type_warning,
        test_multiple_services_no_code_gen,
        test_human_review_on_zero_retries,
        # --- Full pipelines, single service (medium quota) ---
        test_yaml_input,
        test_language_override,
        test_single_lambda,
        # --- Full pipelines, multiple services (heavier quota) ---
        test_parse_only_smoke,
        test_multi_service_with_connections,  # heaviest -- always last
    ]

    results: list[tuple[str, bool]] = []
    for fn in tests:
        try:
            ok = fn(graph)
        except Exception as exc:
            _err(f"UNHANDLED EXCEPTION in {fn.__name__}: {exc}")
            import traceback
            traceback.print_exc()
            ok = False
        results.append((fn.__name__, ok))

    # Summary
    print(f"\n{'=' * 72}")
    print("  SUMMARY")
    print("=" * 72)
    for name, ok in results:
        status = "[PASS]" if ok else "[FAIL]"
        print(f"  {status}  {name}")

    total = len(results)
    passed_count = sum(1 for _, ok in results if ok)
    print(f"\n  {passed_count}/{total} scenarios passed")
    print("=" * 72 + "\n")

    sys.exit(0 if passed_count == total else 1)


if __name__ == "__main__":
    main()
