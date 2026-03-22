from __future__ import annotations

import logging
import uuid
from typing import Any

from langchain_core.messages import HumanMessage, SystemMessage

from app.agents.agent3.config import MANAGER_MAX_REVIEW_ITERATIONS
from app.agents.agent3.llm import get_default_llm, get_structured_llm
from app.agents.agent3.prompts.manager_prompts import (
    manager_planning_system,
    manager_planning_user,
)
from app.agents.agent3.models import ManagerPlanOutput
from app.agents.agent3.state import (
    AgentState,
    APIContract,
    TaskGroup,
    TaskItem,
    WorkerResult,
)
from app.agents.agent3.tools.task_tools import build_architecture_summary
from app.agents.agent3.utils import safe_json_extract

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Required keys for APIContract validation
# ---------------------------------------------------------------------------

_API_CONTRACT_REQUIRED_KEYS = frozenset(
    {"source_service_id", "target_service_id", "relationship", "contract_type"}
)


# ---------------------------------------------------------------------------
# Planning helpers
# ---------------------------------------------------------------------------


def _parse_api_contracts(raw_contracts: list[dict[str, Any]]) -> list[APIContract]:
    """Validate and normalise raw contract dicts from LLM output."""
    contracts: list[APIContract] = []
    for raw in raw_contracts:
        if not isinstance(raw, dict):
            logger.warning("Skipping non-dict API contract entry: %s", type(raw).__name__)
            continue
        if not _API_CONTRACT_REQUIRED_KEYS.issubset(raw.keys()):
            missing = _API_CONTRACT_REQUIRED_KEYS - raw.keys()
            logger.warning("Skipping API contract missing keys %s", missing)
            continue
        contracts.append(
            APIContract(
                source_service_id=raw["source_service_id"],
                target_service_id=raw["target_service_id"],
                relationship=raw["relationship"],
                contract_type=raw["contract_type"],
                payload_schema=raw.get("payload_schema") or {},
                function_signatures=raw.get("function_signatures") or {},
                notes=raw.get("notes", ""),
            )
        )
    return contracts


def _filter_contracts_for_group(
    all_contracts: list[APIContract], service_ids: set[str]
) -> list[APIContract]:
    """Return contracts where at least one endpoint is in the given service set."""
    return [
        c
        for c in all_contracts
        if c["source_service_id"] in service_ids or c["target_service_id"] in service_ids
    ]


def _build_task_groups(
    raw_groups: list[dict[str, Any]],
    code_gen_tasks: list[TaskItem],
    all_contracts: list[APIContract],
) -> list[TaskGroup]:
    """Convert raw LLM group output into fully populated TaskGroup objects."""
    task_groups: list[TaskGroup] = []
    for raw in raw_groups:
        if not isinstance(raw, dict):
            continue
        group_id = raw.get("group_id") or uuid.uuid4().hex[:8]
        service_ids = raw.get("service_ids") or []
        if not service_ids:
            continue

        svc_set = set(service_ids)
        group_tasks = [t for t in code_gen_tasks if t["service_id"] in svc_set]
        group_contracts = _filter_contracts_for_group(all_contracts, svc_set)

        task_groups.append(
            TaskGroup(
                group_id=group_id,
                service_ids=service_ids,
                tasks=group_tasks,
                api_contracts=group_contracts,
                rationale=raw.get("rationale", ""),
            )
        )
    return task_groups


# ---------------------------------------------------------------------------
# Planning mode
# ---------------------------------------------------------------------------


def _planning_mode(state: AgentState) -> dict[str, Any]:
    """First invocation: call LLM to produce API contracts and task groups."""
    services = state.get("services") or []
    connections = state.get("connections") or []
    tf_files = state.get("tf_files") or {}
    task_list = state.get("task_list") or []

    arch_summary = build_architecture_summary(services, connections)
    code_gen_tasks = [t for t in task_list if t["task_type"] == "code_gen"]

    # ---- LLM call ----
    sys_msg = manager_planning_system()
    usr_msg = manager_planning_user(
        architecture_summary=arch_summary,
        tf_file_names=list(tf_files.keys()),
        tf_files_content=tf_files,
        services=services,
        connections=connections,
        code_gen_tasks=code_gen_tasks,
    )

    msgs = [SystemMessage(content=sys_msg), HumanMessage(content=usr_msg)]
    plan: ManagerPlanOutput | None = None

    # ---- Structured output (primary path) ----
    try:
        result = get_structured_llm(ManagerPlanOutput).invoke(msgs)
        plan = result.get("parsed")
        if result.get("parsing_error"):
            logger.warning("Manager structured output parse error: %s", result["parsing_error"])
    except Exception:
        logger.warning("Manager structured output call failed — falling back to raw JSON parse")

    # ---- Extract from Pydantic model ----
    if plan is not None:
        api_contracts = _parse_api_contracts([c.model_dump() for c in plan.api_contracts])
        task_groups = _build_task_groups([g.model_dump() for g in plan.task_groups], code_gen_tasks, api_contracts)
        plan_summary = plan.plan_summary
    else:
        # ---- Fallback: raw text JSON extraction ----
        try:
            raw_response = get_default_llm().invoke(msgs)
            parsed = safe_json_extract(raw_response.content)
        except Exception:
            logger.exception("Manager planning fallback LLM call / parse failed")
            parsed = None

        if parsed and isinstance(parsed, dict):
            api_contracts = _parse_api_contracts(parsed.get("api_contracts") or [])
            task_groups = _build_task_groups(parsed.get("task_groups") or [], code_gen_tasks, api_contracts)
            plan_summary = parsed.get("plan_summary", "")
        else:
            api_contracts = []
            task_groups = []
            plan_summary = ""

    # Fallback: if no groups were produced, bundle everything into one group
    if not task_groups and code_gen_tasks:
        all_svc_ids = list({t["service_id"] for t in code_gen_tasks})
        task_groups = [
            TaskGroup(
                group_id=uuid.uuid4().hex[:8],
                service_ids=all_svc_ids,
                tasks=code_gen_tasks,
                api_contracts=api_contracts,
                rationale="Fallback: all services in a single group",
            )
        ]

    logger.info(
        "manager_agent planning: %d contracts, %d groups, %d total code_gen tasks",
        len(api_contracts),
        len(task_groups),
        len(code_gen_tasks),
    )

    return {
        "api_contracts": api_contracts,
        "task_groups": task_groups,
        "task_list": task_list,
        "manager_plan_summary": plan_summary,
        "current_phase": "orchestration",
    }


# ---------------------------------------------------------------------------
# Review mode
# ---------------------------------------------------------------------------


def _review_mode(state: AgentState) -> dict[str, Any]:
    """After collector: decide whether to retry failed tasks or proceed."""
    worker_results: list[WorkerResult] = state.get("worker_results") or []
    manager_review_count = state.get("manager_review_count", 0)
    existing_contracts = state.get("api_contracts") or []

    # Collect completed tasks from all workers
    all_completed: list[TaskItem] = []
    all_code_files: dict[str, str] = dict(state.get("code_files") or {})
    for wr in worker_results:
        all_completed.extend(wr.get("completed_tasks") or [])
        all_code_files.update(wr.get("code_files") or {})

    failed_tasks = [t for t in all_completed if t.get("status") == "failed"]

    if failed_tasks and manager_review_count < MANAGER_MAX_REVIEW_ITERATIONS:
        # Retry: regroup failed tasks and send back through workers
        failed_svc_ids = list({t["service_id"] for t in failed_tasks})

        retry_groups: list[TaskGroup] = []
        # Split into chunks of 3 services max per group
        for i in range(0, len(failed_svc_ids), 3):
            chunk = failed_svc_ids[i : i + 3]
            chunk_set = set(chunk)
            group_tasks = [t for t in failed_tasks if t["service_id"] in chunk_set]
            # Reset task status and bump retry count for retry
            for t in group_tasks:
                t["status"] = "pending"
                t["retry_count"] = t.get("retry_count", 0) + 1
                t["error_message"] = None

            retry_groups.append(
                TaskGroup(
                    group_id=uuid.uuid4().hex[:8],
                    service_ids=chunk,
                    tasks=group_tasks,
                    api_contracts=_filter_contracts_for_group(
                        existing_contracts, chunk_set
                    ),
                    rationale=f"Retry attempt {manager_review_count + 1} for failed services",
                )
            )

        logger.info(
            "manager_agent review: retrying %d failed tasks in %d groups (attempt %d/%d)",
            len(failed_tasks),
            len(retry_groups),
            manager_review_count + 1,
            MANAGER_MAX_REVIEW_ITERATIONS,
        )

        return {
            "task_groups": retry_groups,
            "worker_results": [],
            "manager_review_count": manager_review_count + 1,
        }

    # No failures or max retries exceeded — merge results and move to testing
    if failed_tasks:
        logger.warning(
            "manager_agent review: %d tasks still failed after %d retries — proceeding to testing",
            len(failed_tasks),
            manager_review_count,
        )

    logger.info(
        "manager_agent review: merging %d worker results, moving to testing phase",
        len(worker_results),
    )

    return {
        "code_files": all_code_files,
        "current_phase": "testing",
        "worker_results": [],
    }


# ---------------------------------------------------------------------------
# Node entry-point
# ---------------------------------------------------------------------------


def manager_agent_node(state: AgentState) -> dict[str, Any]:
    """Dual-mode manager: plans task groups on first call, reviews results after workers."""
    worker_results = state.get("worker_results") or []

    if worker_results:
        return _review_mode(state)
    else:
        return _planning_mode(state)
