from __future__ import annotations

import json
import threading
import uuid
from typing import Any, Literal, Union

from langgraph.checkpoint.memory import MemorySaver
from langgraph.errors import GraphInterrupt
from langgraph.graph import END, START, StateGraph
from langgraph.types import Send

from app.agents.agent3.config import MAX_CODEGEN_WORKERS
from app.agents.agent3.nodes.assembler import assembler_node, error_handler_node
from app.agents.agent3.nodes.codegen_collector import codegen_collector_node
from app.agents.agent3.nodes.codegen_worker import codegen_worker_node
from app.agents.agent3.nodes.completeness_checker import completeness_checker_node
from app.agents.agent3.nodes.frontend_codegen_worker import frontend_codegen_worker_node
from app.agents.agent3.nodes.infra_codegen_worker import infra_codegen_worker_node
from app.agents.agent3.nodes.manager_agent import manager_agent_node
from app.agents.agent3.nodes.parse_input import parse_input_node
from app.agents.agent3.nodes.scaffold_node import scaffold_node
from app.agents.agent3.nodes.test_orchestrator import test_orchestrator_node
from app.agents.agent3.nodes.tf_generator import tf_generator_node
from app.agents.agent3.state import AgentState, CodegenWorkerState, TaskGroup
from app.agents.agent3.subgraphs.tf_validation_loop import (
    compile_tf_validation_subgraph,
)
from app.agents.agent3.tools.task_tools import (
    build_architecture_summary,
    describe_service,
    extract_tf_context_for_service,
)


# ---------------------------------------------------------------------------
# State mappers: AgentState <-> TFValidationState
# ---------------------------------------------------------------------------


def _tf_subgraph_input(state: AgentState) -> dict[str, Any]:
    """Slice AgentState into TFValidationState fields."""
    return {
        "tf_files": state.get("tf_files", {}),
        "validation_results": [],
        "fix_attempts": state.get("tf_fix_attempts", 0),
        "max_retries": state.get("tf_max_retries", 3),
        "error_summary": state.get("tf_error_summary"),
        "validated": False,
        "human_review_required": False,
        "human_review_message": None,
    }


def _tf_subgraph_output(sub_result: dict[str, Any]) -> dict[str, Any]:
    """Map TFValidationState output back to AgentState fields."""
    validated: bool = sub_result.get("validated", False)
    human_review: bool = sub_result.get("human_review_required", False)

    if validated:
        phase = "planning"
    elif human_review:
        phase = "tf_validation"  # paused mid-pipeline awaiting human
    else:
        phase = "tf_validation"

    return {
        "tf_files": sub_result.get("tf_files", {}),
        "tf_validation_results": sub_result.get("validation_results", []),
        "tf_validated": validated,
        "tf_fix_attempts": sub_result.get("fix_attempts", 0),
        "tf_error_summary": sub_result.get("error_summary"),
        "human_review_required": human_review,
        "human_review_message": sub_result.get("human_review_message"),
        "current_phase": phase,
    }


_tf_subgraph = compile_tf_validation_subgraph()


def tf_validation_node(state: AgentState) -> dict[str, Any]:
    """Run TF validation subgraph with AgentState ↔ TFValidationState mapping."""
    sub_input = _tf_subgraph_input(state)
    try:
        sub_result = _tf_subgraph.invoke(sub_input)
    except GraphInterrupt:
        sub_result = {
            **sub_input,
            "human_review_required": True,
            "validated": False,
            "human_review_message": (
                f"Terraform validation failed after {sub_input.get('fix_attempts', 0)} "
                f"fix attempts. Errors:\n{sub_input.get('error_summary') or 'unknown'}"
            ),
        }
    return _tf_subgraph_output(sub_result)


# ---------------------------------------------------------------------------
# Worker state builder
# ---------------------------------------------------------------------------


def _build_arch_ctx_json(state: AgentState, service_id: str) -> str:
    """Build a JSON context blob for a single service."""
    services = state.get("services") or []
    connections = state.get("connections") or []
    svc = next((s for s in services if s["id"] == service_id), None)
    if not svc:
        return json.dumps({"service_id": service_id})

    outgoing = [c for c in connections if c["source"] == service_id]
    incoming = [c for c in connections if c["target"] == service_id]

    # Build a lookup so we can enrich connections with the peer service type
    svc_type_by_id: dict[str, str] = {s["id"]: s["service_type"] for s in services}

    return json.dumps(
        {
            "service_id": service_id,
            "service_type": svc["service_type"],
            "label": svc["label"],
            "config": svc["config"],
            "connections": describe_service(svc, connections),
            "incoming": [
                {
                    "from": c["source"],
                    "via": c["relationship"],
                    "service_type": svc_type_by_id.get(c["source"], "unknown"),
                }
                for c in incoming
            ],
            "outgoing": [
                {
                    "to": c["target"],
                    "via": c["relationship"],
                    "service_type": svc_type_by_id.get(c["target"], "unknown"),
                }
                for c in outgoing
            ],
        },
        indent=2,
    )


def _build_worker_state(state: AgentState, group: TaskGroup) -> CodegenWorkerState:
    """Construct a CodegenWorkerState for a single task group."""
    tf_files = state.get("tf_files") or {}
    services = state.get("services") or []
    connections = state.get("connections") or []

    tf_context_map: dict[str, str] = {}
    arch_context_map: dict[str, str] = {}
    for sid in group["service_ids"]:
        tf_context_map[sid] = extract_tf_context_for_service(tf_files, sid)
        arch_context_map[sid] = _build_arch_ctx_json(state, sid)

    # Combine the manager's plan summary with the full topology so each worker
    # has complete context (all service types and connections) when generating code.
    arch_summary = build_architecture_summary(services, connections)
    plan_summary = state.get("manager_plan_summary") or ""
    architecture_overview = f"{arch_summary}\n\n{plan_summary}".strip() if plan_summary else arch_summary

    return CodegenWorkerState(
        group_id=group["group_id"],
        tasks=group["tasks"],
        api_contracts=group["api_contracts"],
        tf_context_map=tf_context_map,
        architecture_context_map=arch_context_map,
        architecture_overview=architecture_overview,
        code_files={},
        code_errors=[],
        completed_task_list=[],
    )


# ---------------------------------------------------------------------------
# Top-level routing
# ---------------------------------------------------------------------------


def _route_after_parsing(state: AgentState) -> Literal["scaffold_node", "error_handler"]:
    return "error_handler" if state.get("current_phase") == "error" else "scaffold_node"


def _route_after_tf_generation(state: AgentState) -> Literal["tf_validation_loop", "error_handler"]:
    return "error_handler" if state.get("current_phase") == "error" else "tf_validation_loop"


def _route_after_tf_validation(
    state: AgentState,
) -> Literal["manager_agent", "assembler", "error_handler"]:
    if state.get("current_phase") == "error":
        return "error_handler"
    # Proceed to manager whenever there are pending code tasks.
    task_list = state.get("task_list") or []
    if task_list:
        return "manager_agent"
    return "assembler"


def _route_after_manager(
    state: AgentState,
) -> Union[list[Send], Literal["test_orchestrator", "assembler"]]:
    """Route after manager agent: fan-out to workers, or proceed to tests.

    - Planning mode returns task_groups + current_phase='orchestration'
      → dispatch codegen_worker, infra_codegen_worker, and frontend_codegen_worker
        sends in parallel
    - Review mode (retry) returns new task_groups + clears worker_results
      → dispatch workers again
    - Review mode (proceed) returns current_phase='testing'
      → route to test_orchestrator
    """
    phase = state.get("current_phase")

    if phase == "testing":
        return "test_orchestrator"

    if phase == "orchestration":
        task_groups = state.get("task_groups") or []
        services = state.get("services") or []
        connections = state.get("connections") or []
        project_name = state.get("project_name") or "cloudforge-app"
        file_manifest = state.get("file_manifest") or []

        sends: list[Send] = []

        # Fan-out application codegen workers (one per task group, capped)
        if task_groups:
            sends.extend(
                Send("codegen_worker", _build_worker_state(state, group))
                for group in task_groups[:MAX_CODEGEN_WORKERS]
            )

        # Fan-out one infra_codegen_worker per CDK stack file (from file_manifest)
        for entry in file_manifest:
            if entry["fill_strategy"] == "llm_infra":
                sends.append(
                    Send("infra_codegen_worker", {
                        "infra_task": {
                            "task_id": uuid.uuid4().hex[:8],
                            "service_id": entry["path"],
                            "task_type": "infra_gen",
                            "language": "typescript",
                            "status": "pending",
                            "retry_count": 0,
                            "error_message": None,
                        },
                        "services": services,
                        "connections": connections,
                        "project_name": project_name,
                    })
                )
            elif entry["fill_strategy"] == "llm_frontend":
                sends.append(
                    Send("frontend_codegen_worker", {
                        "frontend_task": {
                            "task_id": uuid.uuid4().hex[:8],
                            "service_id": entry["path"],
                            "task_type": "frontend_gen",
                            "language": "typescript",
                            "status": "pending",
                            "retry_count": 0,
                            "error_message": None,
                        },
                        "services": services,
                        "connections": connections,
                        "project_name": project_name,
                        "api_endpoints": [],
                    })
                )

        if sends:
            return sends

    # Fallback: no tasks to generate, skip to assembler
    return "assembler"


# ---------------------------------------------------------------------------
# Graph factory
# ---------------------------------------------------------------------------


def compile_graph(checkpointer=None):
    """Compile and return the top-level agent3 StateGraph.

    Graph topology:
        parse_input → scaffold_node → tf_generator → tf_validation_loop
        → manager_agent (plan)
            ├── Send → codegen_worker_1        ─┐
            ├── Send → codegen_worker_2        ─┤
            ├── Send → codegen_worker_3        ─┼→ codegen_collector → manager_agent (review)
            ├── Send → infra_codegen_worker_1  ─┤
            └── Send → frontend_codegen_worker ─┘
        → test_orchestrator → completeness_checker → assembler

    The manager_agent ↔ codegen_collector form a loop (bounded by
    MANAGER_MAX_REVIEW_ITERATIONS).  On each review the manager either
    re-dispatches failed tasks or moves to the testing phase.

    The TF validation subgraph is compiled eagerly at module level so that
    LangGraph's xray visualisation can introspect it.  Code generation
    subgraphs are compiled inside their respective node functions.
    """
    builder = StateGraph(AgentState)

    # --- Nodes ---
    builder.add_node("parse_input", parse_input_node)
    builder.add_node("scaffold_node", scaffold_node)
    builder.add_node("tf_generator", tf_generator_node)
    builder.add_node("tf_validation_loop", tf_validation_node)
    builder.add_node("manager_agent", manager_agent_node)
    builder.add_node("codegen_worker", codegen_worker_node)
    builder.add_node("infra_codegen_worker", infra_codegen_worker_node)
    builder.add_node("frontend_codegen_worker", frontend_codegen_worker_node)
    builder.add_node("codegen_collector", codegen_collector_node)
    builder.add_node("test_orchestrator", test_orchestrator_node)
    builder.add_node("completeness_checker", completeness_checker_node)
    builder.add_node("assembler", assembler_node)
    builder.add_node("error_handler", error_handler_node)

    # --- Edges ---
    builder.add_edge(START, "parse_input")

    builder.add_conditional_edges(
        "parse_input",
        _route_after_parsing,
        {"scaffold_node": "scaffold_node", "error_handler": "error_handler"},
    )

    builder.add_edge("scaffold_node", "tf_generator")

    builder.add_conditional_edges(
        "tf_generator",
        _route_after_tf_generation,
        {"tf_validation_loop": "tf_validation_loop", "error_handler": "error_handler"},
    )

    builder.add_conditional_edges(
        "tf_validation_loop",
        _route_after_tf_validation,
        {
            "manager_agent": "manager_agent",
            "assembler": "assembler",
            "error_handler": "error_handler",
        },
    )

    # Manager → fan-out to workers OR proceed to tests/assembler
    builder.add_conditional_edges(
        "manager_agent",
        _route_after_manager,
        ["codegen_worker", "infra_codegen_worker", "frontend_codegen_worker", "test_orchestrator", "assembler"],
    )

    # All worker types → collector (fan-in after all Send targets complete)
    builder.add_edge("codegen_worker", "codegen_collector")
    builder.add_edge("infra_codegen_worker", "codegen_collector")
    builder.add_edge("frontend_codegen_worker", "codegen_collector")

    # Collector → manager (review loop)
    builder.add_edge("codegen_collector", "manager_agent")

    # Test orchestrator → completeness_checker → assembler
    builder.add_edge("test_orchestrator", "completeness_checker")
    builder.add_edge("completeness_checker", "assembler")

    # Terminal nodes
    builder.add_edge("assembler", END)
    builder.add_edge("error_handler", END)

    cp = checkpointer if checkpointer is not None else MemorySaver()
    return builder.compile(checkpointer=cp)


# ---------------------------------------------------------------------------
# Singleton accessor
# ---------------------------------------------------------------------------

_graph = None
_graph_lock = threading.Lock()


def get_graph():
    """Return the compiled agent3 graph singleton. Thread-safe initialisation."""
    global _graph
    if _graph is None:
        with _graph_lock:
            if _graph is None:
                _graph = compile_graph()
    return _graph

if __name__ == "__main__":
    # Get the graph
    graph = get_graph()
    print("Graph compiled successfully.")

    # Get the graph with xray
    xray_graph = graph.get_graph(xray=True)

    # Get the mermaid diagram
    mermaid_string = xray_graph.draw_mermaid()
    
    # Print the mermaid diagram
    print(mermaid_string) 