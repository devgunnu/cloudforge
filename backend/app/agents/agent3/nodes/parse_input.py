from __future__ import annotations

import json
import uuid
from typing import Any

import yaml

from app.agents.agent3.config import (
    DEFAULT_LANGUAGE,
    ORCHESTRATOR_MAX_ITERATIONS,
    SERVICE_LANGUAGE_MAP,
    SUPPORTED_SERVICE_TYPES,
    TF_MAX_RETRIES,
)
from app.agents.agent3.state import AgentState, Connection, ServiceNode, TaskItem

# Maximum raw input size (bytes) to protect against accidental huge payloads
_MAX_INPUT_BYTES = 512 * 1024  # 512 KB


def _infer_language(
    service_type: str,
    overrides: dict[str, str],
    service_id: str,
) -> str:
    """Determine the target language for a service, respecting per-service overrides."""
    if service_id in overrides:
        return overrides[service_id]
    return SERVICE_LANGUAGE_MAP.get(service_type, DEFAULT_LANGUAGE)


def parse_input_node(state: AgentState) -> dict[str, Any]:
    """
    Parse raw JSON/YAML topology input into structured services + connections.
    Initialises all phase-specific fields and builds the task_list.
    """
    raw = state.get("raw_input", "")

    # Guard against excessively large inputs
    if len(raw.encode()) > _MAX_INPUT_BYTES:
        return {
            "current_phase": "error",
            "pipeline_errors": [
                f"Input too large ({len(raw.encode())} bytes, max {_MAX_INPUT_BYTES})"
            ],
        }

    fmt = state.get("input_format", "json")

    try:
        if fmt == "yaml":
            data = yaml.safe_load(raw)
        else:
            data = json.loads(raw)
    except Exception as e:
        return {
            "current_phase": "error",
            "pipeline_errors": [f"Failed to parse input ({fmt}): {e}"],
        }

    if not isinstance(data, dict):
        return {
            "current_phase": "error",
            "pipeline_errors": ["Input must be a JSON/YAML object (not a list or scalar)"],
        }

    raw_services = data.get("services", [])
    if not isinstance(raw_services, list):
        return {
            "current_phase": "error",
            "pipeline_errors": ["'services' must be a list"],
        }
    if not raw_services:
        return {
            "current_phase": "error",
            "pipeline_errors": ["'services' list is empty — nothing to generate"],
        }

    raw_connections: list[dict] = data.get("connections", []) or []
    cloud_provider: str = data.get("cloud_provider", "aws")

    # Merge language overrides: topology-embedded overrides < request-level overrides
    # (request-level take precedence)
    topology_overrides: dict[str, str] = data.get("language_overrides", {}) or {}
    request_overrides: dict[str, str] = state.get("language_overrides", {}) or {}
    lang_overrides: dict[str, str] = {**topology_overrides, **request_overrides}

    # Build ServiceNode list with input validation
    services: list[ServiceNode] = []
    parse_warnings: list[str] = []

    for raw_svc in raw_services:
        if not isinstance(raw_svc, dict):
            parse_warnings.append(f"Skipping non-dict service entry: {raw_svc!r}")
            continue
        svc_id = raw_svc.get("id")
        if not svc_id:
            parse_warnings.append("Skipping service with missing 'id'")
            continue
        svc_type = raw_svc.get("service_type", "lambda")
        if svc_type not in SUPPORTED_SERVICE_TYPES:
            parse_warnings.append(
                f"Service '{svc_id}' has unknown type '{svc_type}' — proceeding anyway"
            )
        services.append(
            ServiceNode(
                id=str(svc_id),
                service_type=svc_type,
                label=str(raw_svc.get("label", svc_id)),
                config=raw_svc.get("config") or {},
            )
        )

    if not services:
        return {
            "current_phase": "error",
            "pipeline_errors": ["No valid services found after parsing"],
        }

    # Build Connection list
    connections: list[Connection] = []
    svc_ids = {s["id"] for s in services}
    for raw_conn in raw_connections:
        if not isinstance(raw_conn, dict):
            continue
        src = raw_conn.get("source")
        tgt = raw_conn.get("target")
        if not src or not tgt:
            continue
        if src not in svc_ids or tgt not in svc_ids:
            parse_warnings.append(
                f"Connection {src!r} -> {tgt!r} references unknown service(s) — skipped"
            )
            continue
        connections.append(
            Connection(
                source=str(src),
                target=str(tgt),
                relationship=str(raw_conn.get("relationship", "connects_to")),
            )
        )

    # Build task_list: one code_gen + one test_gen per service
    task_list: list[TaskItem] = []
    for svc in services:
        lang = _infer_language(svc["service_type"], lang_overrides, svc["id"])
        task_list.append(
            TaskItem(
                task_id=str(uuid.uuid4()),
                service_id=svc["id"],
                task_type="code_gen",
                language=lang,
                status="pending",
                retry_count=0,
                error_message=None,
            )
        )
        task_list.append(
            TaskItem(
                task_id=str(uuid.uuid4()),
                service_id=svc["id"],
                task_type="test_gen",
                language=lang,
                status="pending",
                retry_count=0,
                error_message=None,
            )
        )

    update: dict[str, Any] = {
        "services": services,
        "connections": connections,
        "cloud_provider": cloud_provider,
        "task_list": task_list,
        "tf_fix_attempts": 0,
        "tf_max_retries": state.get("tf_max_retries") or TF_MAX_RETRIES,
        "tf_validated": False,
        "tf_files": {},
        "code_files": {},
        "test_files": {},
        "artifacts": {},
        "orchestrator_iterations": 0,
        "orchestrator_max_iterations": (
            state.get("orchestrator_max_iterations") or ORCHESTRATOR_MAX_ITERATIONS
        ),
        "human_review_required": False,
        "current_phase": "tf_generation",
    }
    if parse_warnings:
        update["pipeline_errors"] = parse_warnings
    return update
