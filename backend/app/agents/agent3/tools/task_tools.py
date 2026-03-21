from __future__ import annotations

import json

from app.agents.agent3.state import Connection, ServiceNode


def describe_service(service: ServiceNode, connections: list[Connection]) -> str:
    """Human-readable description of a service and its connections."""
    outgoing = [c for c in connections if c["source"] == service["id"]]
    incoming = [c for c in connections if c["target"] == service["id"]]

    lines = [
        f"Service: {service['label']} (id={service['id']}, type={service['service_type']})",
        f"Config: {json.dumps(service['config'], indent=2)}",
    ]
    if incoming:
        lines.append("Receives from:")
        for c in incoming:
            lines.append(f"  - {c['source']} via {c['relationship']}")
    if outgoing:
        lines.append("Calls / triggers:")
        for c in outgoing:
            lines.append(f"  - {c['target']} via {c['relationship']}")
    return "\n".join(lines)


def build_architecture_summary(
    services: list[ServiceNode], connections: list[Connection]
) -> str:
    """Full architecture summary for the orchestrator system prompt."""
    parts = ["=== Architecture Summary ===\n"]
    for svc in services:
        parts.append(describe_service(svc, connections))
        parts.append("")
    if connections:
        parts.append("=== Connections ===")
        for c in connections:
            parts.append(f"  {c['source']} --[{c['relationship']}]--> {c['target']}")
    return "\n".join(parts)


def extract_tf_context_for_service(tf_files: dict[str, str], service_id: str) -> str:
    """
    Extract lines from TF files that reference the given service_id.
    Falls back to the first 3000 chars of main.tf if nothing matches.
    """
    needle = service_id.lower().replace("-", "_")
    relevant_lines: list[str] = []
    for fname, content in tf_files.items():
        hits = [line for line in content.splitlines() if needle in line.lower()]
        if hits:
            relevant_lines.append(f"# From {fname}:")
            relevant_lines.extend(hits)
    if not relevant_lines:
        main = tf_files.get("main.tf", "")
        return main[:3000] if main else ""
    return "\n".join(relevant_lines)
