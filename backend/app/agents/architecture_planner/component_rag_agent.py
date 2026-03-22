# UNPLUGGED — replaced by research_agent.py. Component RAG pipeline removed.
# Not imported by graph.py. Kept for reference.
# from __future__ import annotations

import json
from pathlib import Path
from typing import Optional

from langchain_core.messages import HumanMessage

from app.agents.architecture_planner.state import ArchitecturePlannerState
from app.agents.architecture_planner.prompts import render_prompt
from app.agents.architecture_planner.llm_utils import API_ERROR_TYPES, invoke_with_retry

# Optional FAISS/embeddings — gracefully degraded when not installed
try:
    from langchain_community.vectorstores import FAISS
    from langchain_community.embeddings import HuggingFaceEmbeddings
    _FAISS_AVAILABLE = True
except ImportError:
    _FAISS_AVAILABLE = False


def init_component_rag(graph_json_path: str) -> Optional[object]:
    """
    Build a FAISS vector store from the graph.json node/edge descriptions.

    Returns the FAISS vector store, or None if:
    - FAISS/sentence-transformers are not installed
    - The graph.json file does not exist
    - Any other exception is raised during initialisation
    """
    if not _FAISS_AVAILABLE:
        return None

    try:
        path = Path(graph_json_path)
        if not path.exists():
            return None

        with path.open("r", encoding="utf-8") as fh:
            graph_data = json.load(fh)

        nodes = graph_data.get("nodes", [])
        edges = graph_data.get("edges", [])

        # Build per-node edge-reason index for enrichment
        node_edge_reasons: dict[str, list[str]] = {}
        for edge in edges:
            src = edge.get("from") or edge.get("source") or ""
            tgt = edge.get("to") or edge.get("target") or ""
            reason = edge.get("reason") or edge.get("label") or ""
            if reason:
                for node_id in (src, tgt):
                    if node_id:
                        node_edge_reasons.setdefault(node_id, []).append(reason)

        # Build text chunks — one per node
        texts: list[str] = []
        for node in nodes:
            node_id = node.get("id", "")
            label = node.get("label") or node.get("name") or node_id
            node_type = node.get("type", "")
            description = node.get("description") or node.get("desc") or ""

            chunk = f"{label} ({node_type}): {description}"

            reasons = node_edge_reasons.get(node_id, [])
            if reasons:
                chunk += " | Related: " + "; ".join(reasons[:5])

            texts.append(chunk)

        if not texts:
            return None

        embeddings = HuggingFaceEmbeddings(model_name="all-MiniLM-L6-v2")
        vector_store = FAISS.from_texts(texts, embeddings)
        return vector_store

    except Exception:
        return None


def make_component_rag_node(vector_store):
    """
    Returns a component_rag_node function. When vector_store is None the node
    is a passthrough that sets component_rag_results to an empty string.
    """

    def component_rag_node(state: ArchitecturePlannerState) -> dict:
        if vector_store is None:
            return {
                "component_rag_results": "",
                "current_node": "component_rag",
            }

        try:
            query = (
                state["budget"]
                + " "
                + state["traffic"]
                + " "
                + state["availability"]
                + " "
                + state["prd"][:500]
            )
            docs = vector_store.similarity_search(query, k=12)
            result_text = "\n".join(doc.page_content for doc in docs)
            return {
                "component_rag_results": result_text,
                "current_node": "component_rag",
            }
        except Exception:
            return {
                "component_rag_results": "",
                "current_node": "component_rag",
            }

    return component_rag_node


def make_component_synthesizer_node(llm):
    """
    Returns a component_synthesizer_node that calls the LLM to synthesize
    the RAG results into a structured component recommendation.
    """

    def component_synthesizer_node(state: ArchitecturePlannerState) -> dict:
        if not state.get("component_rag_results"):
            return {
                "component_synthesis": "",
                "current_node": "component_synthesizer",
            }

        try:
            prompt = render_prompt(
                "component_rag_synthesis",
                component_rag_results=state["component_rag_results"],
                prd=state["prd"],
                budget=state["budget"],
                traffic=state["traffic"],
                availability=state["availability"],
                cloud_provider=state["cloud_provider"],
            )
            response = invoke_with_retry(lambda: llm.invoke([HumanMessage(content=prompt)]))
            return {
                "component_synthesis": response.content,
                "current_node": "component_synthesizer",
            }
        except API_ERROR_TYPES as exc:
            return {
                "component_synthesis": "",
                "current_node": "component_synthesizer",
                "error_message": f"LLM API error ({type(exc).__name__}): {exc}",
            }
        except Exception:
            return {
                "component_synthesis": "",
                "current_node": "component_synthesizer",
            }

    return component_synthesizer_node


__all__ = ["init_component_rag", "make_component_rag_node", "make_component_synthesizer_node"]
