from __future__ import annotations

import json
import os
from pathlib import Path
from typing import Optional

from langchain_core.messages import HumanMessage
from langgraph.graph import StateGraph, START, END

from app.agents.architecture_planner.state import ArchitecturePlannerState
from app.agents.architecture_planner.prompts import render_prompt
from app.agents.architecture_planner.llm_utils import API_ERROR_TYPES


# ---------------------------------------------------------------------------
# Optional dependency guards
# ---------------------------------------------------------------------------

try:
    import kuzu as _kuzu
    _KUZU_AVAILABLE = True
except ImportError:
    _KUZU_AVAILABLE = False

try:
    from sentence_transformers import SentenceTransformer as _SentenceTransformer
    import numpy as _np
    from sklearn.metrics.pairwise import cosine_similarity as _cosine_similarity
    _EMBEDDINGS_AVAILABLE = True
except ImportError:
    _EMBEDDINGS_AVAILABLE = False


_MAX_TRAVERSAL_HOPS = 5


# ---------------------------------------------------------------------------
# Kuzu initialisation
# ---------------------------------------------------------------------------


def init_kuzu(
    graph_json_path: str = "graph.json",
    db_path: str = "./cloudforge_db",
) -> Optional[object]:
    """
    Load graph.json into an embedded Kuzu database and return a connection.
    Returns None if graph.json does not exist or kuzu is not installed.
    """
    if not _KUZU_AVAILABLE:
        return None
    if not Path(graph_json_path).exists():
        return None

    import kuzu

    db = kuzu.Database(db_path)
    conn = kuzu.Connection(db)

    conn.execute(
        "CREATE NODE TABLE IF NOT EXISTS Node("
        "id STRING, label STRING, type STRING, community INT64, "
        "PRIMARY KEY(id))"
    )
    conn.execute(
        "CREATE REL TABLE IF NOT EXISTS REL("
        "FROM Node TO Node, "
        "type STRING, reason STRING, confidence DOUBLE, conflicted BOOL)"
    )

    with open(graph_json_path) as f:
        data = json.load(f)

    for node in data["nodes"]:
        conn.execute(
            "MERGE (n:Node {id: $id}) "
            "SET n.label = $label, n.type = $type, n.community = $community",
            {
                "id": node["id"],
                "label": node["label"],
                "type": node["type"],
                "community": node.get("community", -1),
            },
        )

    for edge in data["edges"]:
        conn.execute(
            "MATCH (a:Node {id: $from_id}), (b:Node {id: $to_id}) "
            "CREATE (a)-[:REL {type: $type, reason: $reason, "
            "confidence: $confidence, conflicted: $conflicted}]->(b)",
            {
                "from_id": edge["from"],
                "to_id": edge["to"],
                "type": edge["type"],
                "reason": edge.get("reason", ""),
                "confidence": edge.get("confidence", 1.0),
                "conflicted": edge.get("conflicted", False),
            },
        )

    return conn


def _get_all_constraint_ids(conn) -> list[str]:
    """Return all Constraint node IDs from Kuzu."""
    result = conn.execute(
        "MATCH (n:Node) WHERE n.type = 'Constraint' RETURN n.id"
    )
    return [row[0] for row in result.get_as_df().values.tolist()]


# ---------------------------------------------------------------------------
# Node 1: NFR Parser
# ---------------------------------------------------------------------------


def make_nfr_parser_node(llm, conn):
    def nfr_parser_node(state: ArchitecturePlannerState) -> dict:
        all_constraints = _get_all_constraint_ids(conn)
        prompt = render_prompt(
            "kg_nfr_parser",
            constraint_list=all_constraints,
            budget=state["budget"],
            traffic=state["traffic"],
            availability=state["availability"],
            prd=state["prd"],
        )
        try:
            response = llm.invoke([HumanMessage(content=prompt)])
            raw = response.content.strip()
            if raw.startswith("```"):
                parts = raw.split("```")
                raw = parts[1]
                if raw.startswith("json"):
                    raw = raw[4:]
            constraints = json.loads(raw.strip())
            if not isinstance(constraints, list):
                constraints = []
            # Filter to only approved IDs
            approved_set = set(all_constraints)
            constraints = [c for c in constraints if c in approved_set]
        except API_ERROR_TYPES as exc:
            return {
                "kg_constraints": [],
                "kg_frontier": [],
                "kg_active_nodes": [],
                "kg_converged": True,
                "current_node": "kg_nfr_parser",
                "error_message": f"KG NFR parser API error: {exc}",
            }
        except Exception:
            constraints = []

        return {
            "kg_constraints": constraints,
            "kg_frontier": constraints,
            "kg_active_nodes": constraints,
            "current_node": "kg_nfr_parser",
        }

    return nfr_parser_node


# ---------------------------------------------------------------------------
# Node 2: Community Router
# ---------------------------------------------------------------------------


def make_community_router_node(community_summaries: dict):
    def community_router_node(state: ArchitecturePlannerState) -> dict:
        if not community_summaries or not _EMBEDDINGS_AVAILABLE:
            return {"kg_communities": [], "current_node": "kg_community_router"}

        query_text = " ".join(state["kg_constraints"])
        if not query_text.strip():
            return {"kg_communities": [], "current_node": "kg_community_router"}

        model = _SentenceTransformer("all-MiniLM-L6-v2")
        query_embedding = model.encode([query_text])
        ids = list(community_summaries.keys())
        summaries = list(community_summaries.values())
        summary_embeddings = model.encode(summaries)
        scores = _cosine_similarity(query_embedding, summary_embeddings)[0]
        top_k = min(3, len(ids))
        top_indices = _np.argsort(scores)[-top_k:][::-1].tolist()
        top_communities = [int(ids[i]) for i in top_indices]

        return {"kg_communities": top_communities, "current_node": "kg_community_router"}

    return community_router_node


# ---------------------------------------------------------------------------
# Node 3: Graph Traversal (Kuzu)
# ---------------------------------------------------------------------------


def make_graph_traversal_node(conn):
    def graph_traversal_node(state: ArchitecturePlannerState) -> dict:
        frontier = state["kg_frontier"]
        all_active = state["kg_active_nodes"]
        all_blocked = state["kg_blocked_nodes"]
        path = list(state["kg_reasoning_path"])

        if not frontier:
            return {
                "kg_converged": True,
                "kg_traversal_iteration_count": state["kg_traversal_iteration_count"] + 1,
                "current_node": "kg_traversal",
            }

        new_nodes: list[str] = []
        new_blocked: list[str] = []

        # ---- RECOMMENDS + REQUIRES + ENABLES ----
        try:
            rec_result = conn.execute(
                "MATCH (a:Node)-[r:REL]->(b:Node) "
                "WHERE a.id IN $frontier "
                "AND r.type IN ['RECOMMENDS', 'REQUIRES', 'ENABLES'] "
                "AND r.confidence >= 0.75 "
                "AND r.conflicted = false "
                "RETURN a.id, b.id, b.label, r.type, r.reason",
                {"frontier": frontier},
            )
            for row in rec_result.get_as_df().to_dict("records"):
                b_id = row["b.id"]
                if b_id not in all_active and b_id not in all_blocked:
                    new_nodes.append(b_id)
                    path.append({
                        "from": row["a.id"],
                        "to": b_id,
                        "label": row.get("b.label", b_id),
                        "type": row["r.type"],
                        "reason": row["r.reason"],
                    })
        except Exception as exc:
            return {
                "kg_converged": True,
                "kg_traversal_iteration_count": state["kg_traversal_iteration_count"] + 1,
                "current_node": "kg_traversal",
                "error_message": f"KG traversal error: {exc}",
            }

        # ---- BLOCKS + CONFLICTS_WITH + MUTUALLY_EXCLUSIVE ----
        try:
            block_result = conn.execute(
                "MATCH (a:Node)-[r:REL]->(b:Node) "
                "WHERE a.id IN $frontier "
                "AND r.type IN ['BLOCKS', 'CONFLICTS_WITH', 'MUTUALLY_EXCLUSIVE'] "
                "RETURN a.id, b.id, r.type, r.reason",
                {"frontier": frontier},
            )
            for row in block_result.get_as_df().to_dict("records"):
                b_id = row["b.id"]
                new_blocked.append(b_id)
                path.append({
                    "from": row["a.id"],
                    "to": b_id,
                    "type": row["r.type"],
                    "reason": row["r.reason"],
                })
        except Exception:
            pass

        # Remove newly blocked from new_nodes; deduplicate
        blocked_set = set(all_blocked) | set(new_blocked)
        seen = set(all_active)
        filtered_new_nodes = [
            n for n in new_nodes
            if n not in blocked_set and n not in seen
        ]

        return {
            "kg_frontier": filtered_new_nodes,
            "kg_active_nodes": all_active + filtered_new_nodes,
            "kg_blocked_nodes": list(set(all_blocked) | set(new_blocked)),
            "kg_reasoning_path": path,
            "kg_converged": len(filtered_new_nodes) == 0,
            "kg_traversal_iteration_count": state["kg_traversal_iteration_count"] + 1,
            "current_node": "kg_traversal",
        }

    return graph_traversal_node


# ---------------------------------------------------------------------------
# Node 4: KG Explainer
# ---------------------------------------------------------------------------


def make_kg_explainer_node(llm):
    def kg_explainer_node(state: ArchitecturePlannerState) -> dict:
        constraints = set(state["kg_constraints"])
        recommended = [n for n in state["kg_active_nodes"] if n not in constraints]
        blocked = list(set(state["kg_blocked_nodes"]))
        path_text = "\n".join(
            f"  {e['from']} --{e['type']}--> {e['to']}: {e.get('reason', '')}"
            for e in state["kg_reasoning_path"]
        )

        if not recommended:
            return {"kg_explanation": "", "current_node": "kg_explainer"}

        prompt = render_prompt(
            "kg_explainer",
            recommended=recommended,
            blocked=blocked,
            reasoning_path=path_text,
        )
        try:
            response = llm.invoke([HumanMessage(content=prompt)])
            explanation = response.content
        except API_ERROR_TYPES as exc:
            explanation = f"(KG explainer unavailable: {exc})"
        except Exception as exc:
            explanation = f"(KG explainer error: {exc})"

        return {"kg_explanation": explanation, "current_node": "kg_explainer"}

    return kg_explainer_node


# ---------------------------------------------------------------------------
# Subgraph assembly
# ---------------------------------------------------------------------------


def _route_after_traversal(state: ArchitecturePlannerState) -> str:
    if state["kg_converged"] or state["kg_traversal_iteration_count"] >= _MAX_TRAVERSAL_HOPS:
        return "kg_explainer"
    return "kg_traversal"


def build_kg_subgraph(
    llm,
    conn,
    community_summaries_path: str = "community_summaries.json",
):
    """
    Build the KG traversal subgraph.
    If conn is None (graph not loaded), returns a lightweight pass-through subgraph.
    """
    if conn is None:
        def _passthrough(state: ArchitecturePlannerState) -> dict:
            return {"kg_explanation": "", "current_node": "kg_traversal"}

        builder = StateGraph(ArchitecturePlannerState)
        builder.add_node("kg_passthrough", _passthrough)
        builder.add_edge(START, "kg_passthrough")
        return builder.compile()

    # Load community summaries if available
    community_summaries: dict = {}
    if Path(community_summaries_path).exists():
        with open(community_summaries_path) as f:
            community_summaries = json.load(f)

    builder = StateGraph(ArchitecturePlannerState)
    builder.add_node("nfr_parser", make_nfr_parser_node(llm, conn))
    builder.add_node("community_router", make_community_router_node(community_summaries))
    builder.add_node("kg_traversal", make_graph_traversal_node(conn))
    builder.add_node("kg_explainer", make_kg_explainer_node(llm))

    builder.add_edge(START, "nfr_parser")
    builder.add_edge("nfr_parser", "community_router")
    builder.add_edge("community_router", "kg_traversal")
    builder.add_conditional_edges(
        "kg_traversal",
        _route_after_traversal,
        {"kg_traversal": "kg_traversal", "kg_explainer": "kg_explainer"},
    )
    builder.add_edge("kg_explainer", END)
    return builder.compile()


__all__ = ["init_kuzu", "build_kg_subgraph"]
