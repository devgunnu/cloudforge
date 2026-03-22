"""
Deterministic architecture analysis rules.
No LLM calls. All functions take ArchitectureDiagram-compatible dicts.
"""
from __future__ import annotations
from collections import defaultdict, deque
from typing import Any

# ---------------------------------------------------------------------------
# Latency lookup (p50 / p99 in ms) — approximate per service category/keyword
# ---------------------------------------------------------------------------

_LATENCY_TABLE: dict[str, tuple[int, int]] = {
    "api gateway": (10, 30), "apigw": (10, 30), "api gw": (10, 30),
    "cloudfront": (3, 10), "cdn": (3, 10), "front door": (3, 10), "cloud cdn": (3, 10),
    "lambda": (20, 200), "function": (20, 200), "cloud function": (20, 200), "azure function": (20, 200),
    "fargate": (5, 20), "ecs": (5, 20), "cloud run": (5, 20), "container app": (5, 20),
    "ec2": (5, 15), "compute engine": (5, 15), "virtual machine": (5, 15),
    "eks": (5, 15), "aks": (5, 15), "gke": (5, 15),
    "rds": (5, 20), "aurora": (3, 15), "cloud sql": (5, 20), "azure sql": (5, 20),
    "dynamodb": (3, 10), "firestore": (3, 10), "cosmos": (5, 15),
    "elasticache": (1, 5), "redis": (1, 5), "memorystore": (1, 5), "azure cache": (1, 5),
    "s3": (100, 500), "gcs": (100, 500), "blob": (100, 500),
    "sqs": (10, 50), "sns": (5, 20), "pubsub": (5, 20), "service bus": (5, 20), "event hub": (5, 20),
    "kinesis": (70, 200), "kafka": (10, 50),
    "elasticsearch": (10, 50), "opensearch": (10, 50),
    "load balancer": (2, 8), "alb": (2, 8), "nlb": (1, 5),
    "waf": (2, 8), "shield": (1, 5),
    "cognito": (20, 100), "auth0": (20, 100), "entra": (20, 100),
    "secrets manager": (5, 20), "key vault": (5, 20),
    "cloudwatch": (5, 20), "monitoring": (5, 20),
}

_STATEFUL_KEYWORDS = {"rds", "aurora", "dynamodb", "s3", "cosmos", "firestore", "cloud sql",
                       "redis", "elasticache", "blob", "gcs", "elasticsearch", "opensearch",
                       "postgres", "mysql", "mongo", "database", "db", "storage"}
_GATEWAY_KEYWORDS = {"api gateway", "apigw", "api gw", "cloudfront", "cdn", "load balancer",
                      "alb", "nlb", "front door", "cloud cdn", "waf"}
_QUEUE_KEYWORDS = {"sqs", "sns", "pubsub", "service bus", "event hub", "kinesis", "kafka",
                    "queue", "topic", "stream"}
_COMPUTE_KEYWORDS = {"lambda", "fargate", "ecs", "ec2", "cloud run", "container app",
                      "function", "eks", "aks", "gke", "compute"}


def _service_latency(service_name: str) -> tuple[int, int]:
    s = service_name.lower()
    for key, val in _LATENCY_TABLE.items():
        if key in s:
            return val
    return (15, 60)  # default fallback


def _matches_any(service_name: str, keywords: set[str]) -> bool:
    s = service_name.lower()
    return any(k in s for k in keywords)


# ---------------------------------------------------------------------------
# Graph helpers
# ---------------------------------------------------------------------------


def _build_adjacency(nodes: list[dict], connections: list[dict]) -> dict[str, list[str]]:
    adj: dict[str, list[str]] = defaultdict(list)
    node_ids = {n["id"] for n in nodes}
    for c in connections:
        src = c.get("from") or c.get("from_", "")
        dst = c.get("to", "")
        if src in node_ids and dst in node_ids:
            adj[src].append(dst)
    return adj


def _in_degree(nodes: list[dict], connections: list[dict]) -> dict[str, int]:
    deg: dict[str, int] = {n["id"]: 0 for n in nodes}
    for c in connections:
        dst = c.get("to", "")
        if dst in deg:
            deg[dst] += 1
    return deg


def _out_degree(nodes: list[dict], connections: list[dict]) -> dict[str, int]:
    deg: dict[str, int] = {n["id"]: 0 for n in nodes}
    for c in connections:
        src = c.get("from") or c.get("from_", "")
        if src in deg:
            deg[src] += 1
    return deg


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------


def find_request_paths_with_latency(diagram: dict) -> list[dict]:
    """
    DFS from gateway/CDN entry nodes to stateful/queue terminals.
    Returns up to 4 paths with aggregated p50/p99 latency.
    """
    nodes = diagram.get("nodes", [])
    connections = diagram.get("connections", [])
    node_map = {n["id"]: n for n in nodes}
    adj = _build_adjacency(nodes, connections)
    in_deg = _in_degree(nodes, connections)

    # Entry nodes: gateways with low in-degree or explicit gateway type
    entry_nodes = [
        n["id"] for n in nodes
        if _matches_any(n.get("service", ""), _GATEWAY_KEYWORDS) or in_deg[n["id"]] == 0
    ]
    if not entry_nodes:
        entry_nodes = [n["id"] for n in nodes[:1]]  # fallback: first node

    terminal_keywords = _STATEFUL_KEYWORDS | _QUEUE_KEYWORDS
    paths: list[dict] = []

    def dfs(node_id: str, path: list[str], visited: set[str]) -> None:
        if len(paths) >= 4:
            return
        if node_id in visited:
            return
        visited = visited | {node_id}
        path = path + [node_id]
        node = node_map.get(node_id, {})
        service = node.get("service", node_id)

        is_terminal = _matches_any(service, terminal_keywords)
        has_no_children = not adj.get(node_id)

        if (is_terminal or has_no_children) and len(path) > 1:
            p50_total, p99_total = 0, 0
            hops = []
            dominant_p99 = ("", 0)
            for nid in path:
                svc = node_map.get(nid, {}).get("service", nid)
                p50, p99 = _service_latency(svc)
                p50_total += p50
                p99_total += p99
                hops.append({"node_id": nid, "service": svc, "p50_ms": p50, "p99_ms": p99})
                if p99 > dominant_p99[1]:
                    dominant_p99 = (svc, p99)
            paths.append({
                "path": path,
                "hops": hops,
                "total_p50_ms": p50_total,
                "total_p99_ms": p99_total,
                "dominant_service": dominant_p99[0],
                "hop_count": len(path),
            })
            return

        for child in adj.get(node_id, []):
            dfs(child, path, visited)

    for entry in entry_nodes:
        dfs(entry, [], set())
        if len(paths) >= 4:
            break

    return paths


def detect_diagram_spofs(diagram: dict) -> list[dict]:
    """
    Flags single points of failure:
    - Single stateful node with high fan-in (>= 2 compute inputs)
    - High fan-in compute (>= 3 inputs, no upstream gateway)
    - Sole gateway with single downstream
    Returns list of {node_id, service, reason, severity}.
    """
    nodes = diagram.get("nodes", [])
    connections = diagram.get("connections", [])
    node_map = {n["id"]: n for n in nodes}
    in_deg = _in_degree(nodes, connections)
    adj = _build_adjacency(nodes, connections)

    # Build reverse adjacency for upstream lookups
    reverse: dict[str, list[str]] = defaultdict(list)
    for c in connections:
        src = c.get("from") or c.get("from_", "")
        dst = c.get("to", "")
        reverse[dst].append(src)

    spofs: list[dict] = []
    seen: set[str] = set()

    for node in nodes:
        nid = node["id"]
        service = node.get("service", nid)

        # Rule 1: stateful node with 2+ compute inputs and no replica sibling
        if _matches_any(service, _STATEFUL_KEYWORDS):
            compute_inputs = [
                s for s in reverse[nid]
                if _matches_any(node_map.get(s, {}).get("service", ""), _COMPUTE_KEYWORDS)
            ]
            same_type_siblings = [
                n for n in nodes
                if n["id"] != nid and _matches_any(n.get("service", ""), _STATEFUL_KEYWORDS)
            ]
            if len(compute_inputs) >= 2 and not same_type_siblings and nid not in seen:
                spofs.append({
                    "node_id": nid,
                    "service": service,
                    "reason": f"Sole stateful node receiving {len(compute_inputs)} compute inputs with no redundant peer",
                    "severity": "CRITICAL",
                    "recommendation": "Add a read replica or standby instance",
                })
                seen.add(nid)

        # Rule 2: sole gateway
        if _matches_any(service, _GATEWAY_KEYWORDS):
            gateway_peers = [
                n for n in nodes
                if n["id"] != nid and _matches_any(n.get("service", ""), _GATEWAY_KEYWORDS)
            ]
            downstream = adj.get(nid, [])
            if not gateway_peers and len(downstream) == 1 and nid not in seen:
                spofs.append({
                    "node_id": nid,
                    "service": service,
                    "reason": "Sole gateway/CDN entry point with only one downstream target",
                    "severity": "MAJOR",
                    "recommendation": "Add a secondary entry point or enable multi-AZ for the gateway",
                })
                seen.add(nid)

        # Rule 3: high fan-in compute with no upstream gateway
        if _matches_any(service, _COMPUTE_KEYWORDS) and in_deg.get(nid, 0) >= 3:
            upstream_gateways = [
                s for s in reverse[nid]
                if _matches_any(node_map.get(s, {}).get("service", ""), _GATEWAY_KEYWORDS)
            ]
            if not upstream_gateways and nid not in seen:
                spofs.append({
                    "node_id": nid,
                    "service": service,
                    "reason": f"Compute node with {in_deg[nid]} inputs and no upstream load balancer/gateway",
                    "severity": "MAJOR",
                    "recommendation": "Add a load balancer upstream to distribute traffic",
                })
                seen.add(nid)

    return spofs


def identify_cascade_risks(diagram: dict) -> list[dict]:
    """
    BFS failure propagation detection.
    Returns list of {source, chain, length, severity, has_queue_breaker}.
    Severity HIGH if chain length >= 3.
    """
    nodes = diagram.get("nodes", [])
    connections = diagram.get("connections", [])
    node_map = {n["id"]: n for n in nodes}
    adj = _build_adjacency(nodes, connections)

    risks: list[dict] = []

    for node in nodes:
        start = node["id"]
        # BFS from this node to find failure propagation depth
        visited: set[str] = set()
        queue: deque = deque([(start, [start])])
        has_queue_breaker = False
        max_chain: list[str] = [start]

        while queue:
            current, chain = queue.popleft()
            if current in visited:
                continue
            visited.add(current)
            if len(chain) > len(max_chain):
                max_chain = chain

            for child in adj.get(current, []):
                child_service = node_map.get(child, {}).get("service", "")
                if _matches_any(child_service, _QUEUE_KEYWORDS):
                    has_queue_breaker = True
                    continue  # queues act as circuit breakers
                if child not in visited:
                    queue.append((child, chain + [child]))

        if len(max_chain) >= 3:
            severity = "HIGH" if len(max_chain) >= 4 else "MEDIUM"
            risks.append({
                "source_id": start,
                "source_service": node.get("service", start),
                "chain": max_chain,
                "chain_services": [node_map.get(n, {}).get("service", n) for n in max_chain],
                "length": len(max_chain),
                "severity": severity,
                "has_queue_breaker": has_queue_breaker,
            })

    # Deduplicate: keep longest chain per source
    seen_sources: set[str] = set()
    deduped: list[dict] = []
    for r in sorted(risks, key=lambda x: -x["length"]):
        if r["source_id"] not in seen_sources:
            deduped.append(r)
            seen_sources.add(r["source_id"])

    return deduped
