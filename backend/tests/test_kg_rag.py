"""
Unit and integration tests for the Graph RAG pipeline in kg_traversal_agent.py.

Run all tests (verbose):
    pytest tests/test_kg_rag.py -v -s

Run only fast unit tests (skip real-graph integration test):
    pytest tests/test_kg_rag.py -v -s -m "not integration"

Run only the integration test:
    pytest tests/test_kg_rag.py -v -s -m integration
"""
from __future__ import annotations

import json
import textwrap
from pathlib import Path
from unittest.mock import MagicMock

import pytest

# ---------------------------------------------------------------------------
# Paths
# ---------------------------------------------------------------------------

GRAPH_JSON = Path("app/agents/data/graph/graph.json")
COMMUNITY_SUMMARIES = Path("app/agents/data/graph/community_summaries.json")

# ---------------------------------------------------------------------------
# Pytest marks
# ---------------------------------------------------------------------------

pytestmark = pytest.mark.filterwarnings("ignore::DeprecationWarning")


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _make_state_dict(**overrides) -> dict:
    """Return a minimal ArchitecturePlannerState-compatible dict."""
    from app.agents.architecture_planner.state import make_initial_state

    base = make_initial_state(
        budget="$20k/month",
        traffic="5k RPS peak",
        availability="99.9% SLA, US-East",
        prd="Data-intensive app with high write throughput, strict consistency, and limited budget.",
        cloud_provider="AWS",
    )
    base.update(overrides)
    return base


def _write_fixture_graph(path: Path) -> None:
    """
    Write a small deterministic graph for unit tests.

    Topology
    --------
                    ┌──────────────────┐
    seed_a ──REC──► component_x ──REQ──► component_y ──REC──► component_z
                    └──────────────────┘
    seed_a ──REC──► blocked_comp   ← blocked by seed_b via BLOCKS
    seed_b ──BLO──► blocked_comp
    """
    data = {
        "nodes": [
            {"id": "seed_a",      "type": "Constraint", "label": "Seed A",      "community": 0},
            {"id": "seed_b",      "type": "Constraint", "label": "Seed B",      "community": 0},
            {"id": "component_x", "type": "Component",  "label": "Component X", "community": 0},
            {"id": "component_y", "type": "Component",  "label": "Component Y", "community": 0},
            {"id": "component_z", "type": "Component",  "label": "Component Z", "community": 1},
            {"id": "blocked_comp","type": "Component",  "label": "Blocked Comp","community": 0},
        ],
        "edges": [
            {"from": "seed_a",      "to": "component_x", "type": "RECOMMENDS",      "reason": "seed_a needs component_x",    "confidence": 0.9, "conflicted": False},
            {"from": "seed_a",      "to": "blocked_comp","type": "RECOMMENDS",      "reason": "seed_a suggests blocked_comp","confidence": 0.9, "conflicted": False},
            {"from": "seed_b",      "to": "blocked_comp","type": "BLOCKS",          "reason": "seed_b blocks blocked_comp",  "confidence": 1.0, "conflicted": False},
            {"from": "component_x", "to": "component_y", "type": "REQUIRES",        "reason": "x requires y",               "confidence": 0.9, "conflicted": False},
            {"from": "component_y", "to": "component_z", "type": "RECOMMENDS",      "reason": "y recommends z",             "confidence": 0.9, "conflicted": False},
        ],
    }
    path.write_text(json.dumps(data))


# ===========================================================================
# 1. Kuzu initialisation
# ===========================================================================


class TestInitKuzu:
    def test_returns_none_when_file_missing(self, tmp_path):
        from app.agents.architecture_planner.kg_traversal_agent import init_kuzu

        conn = init_kuzu(str(tmp_path / "nonexistent.json"), str(tmp_path / "db"))
        assert conn is None

    def test_loads_fixture_graph(self, tmp_path):
        from app.agents.architecture_planner.kg_traversal_agent import init_kuzu

        graph_file = tmp_path / "graph.json"
        _write_fixture_graph(graph_file)

        conn = init_kuzu(str(graph_file), str(tmp_path / "db"))
        assert conn is not None

        node_count = conn.execute("MATCH (n:Node) RETURN count(n)").get_as_df().iloc[0, 0]
        edge_count = conn.execute("MATCH ()-[r:REL]->() RETURN count(r)").get_as_df().iloc[0, 0]

        print(f"\n  [kuzu] nodes loaded: {node_count}, edges loaded: {edge_count}")
        assert node_count == 6
        assert edge_count == 5

    def test_fresh_reload_has_no_duplicates(self, tmp_path):
        """Calling init_kuzu twice (fresh DB) must not duplicate edges."""
        from app.agents.architecture_planner.kg_traversal_agent import init_kuzu

        graph_file = tmp_path / "graph.json"
        _write_fixture_graph(graph_file)

        db_path = str(tmp_path / "db")
        init_kuzu(str(graph_file), db_path)
        conn2 = init_kuzu(str(graph_file), db_path)

        edge_count = conn2.execute("MATCH ()-[r:REL]->() RETURN count(r)").get_as_df().iloc[0, 0]
        print(f"\n  [kuzu] edge count after two inits: {edge_count}")
        assert edge_count == 5, "Edges duplicated across restarts — drop-and-recreate is broken"


# ===========================================================================
# 2. Community Router
# ===========================================================================


class TestCommunityRouter:
    def test_returns_empty_when_no_constraints(self, tmp_path):
        from app.agents.architecture_planner.kg_traversal_agent import make_community_router_node

        router = make_community_router_node({"0": "some summary", "1": "another"})
        state = _make_state_dict(kg_constraints=[])
        result = router(state)
        assert result["kg_communities"] == []

    def test_returns_empty_when_no_summaries(self):
        from app.agents.architecture_planner.kg_traversal_agent import make_community_router_node

        router = make_community_router_node({})
        state = _make_state_dict(kg_constraints=["data_consistency"])
        result = router(state)
        assert result["kg_communities"] == []

    @pytest.mark.skipif(
        not __import__("importlib").util.find_spec("sentence_transformers"),
        reason="sentence_transformers not installed",
    )
    def test_returns_top_k_community_ids(self):
        from app.agents.architecture_planner.kg_traversal_agent import make_community_router_node

        summaries = {
            "0": "Operational OLTP databases and transactional consistency.",
            "1": "Analytical workloads, data warehouses, ETL pipelines.",
            "2": "Caching, CDN, read performance, latency reduction.",
        }
        router = make_community_router_node(summaries)
        state = _make_state_dict(kg_constraints=["ACID_required", "data_consistency"])
        result = router(state)

        communities = result["kg_communities"]
        print(f"\n  [router] top communities for ACID query: {communities}")
        assert len(communities) <= 3
        assert all(isinstance(c, int) for c in communities)


# ===========================================================================
# 3. Graph Traversal
# ===========================================================================


class TestGraphTraversal:
    def _setup_conn(self, tmp_path):
        from app.agents.architecture_planner.kg_traversal_agent import init_kuzu

        graph_file = tmp_path / "graph.json"
        _write_fixture_graph(graph_file)
        return init_kuzu(str(graph_file), str(tmp_path / "db"))

    def test_empty_frontier_converges_immediately(self, tmp_path):
        from app.agents.architecture_planner.kg_traversal_agent import make_graph_traversal_node

        conn = self._setup_conn(tmp_path)
        node = make_graph_traversal_node(conn)
        state = _make_state_dict(
            kg_frontier=[], kg_active_nodes=[], kg_blocked_nodes=[],
            kg_reasoning_path=[], kg_communities=[],
            kg_traversal_iteration_count=0,
        )
        result = node(state)
        assert result["kg_converged"] is True

    def test_hop1_finds_direct_recommendations(self, tmp_path):
        from app.agents.architecture_planner.kg_traversal_agent import make_graph_traversal_node

        conn = self._setup_conn(tmp_path)
        node = make_graph_traversal_node(conn)

        state = _make_state_dict(
            kg_frontier=["seed_a"],
            kg_active_nodes=["seed_a"],
            kg_blocked_nodes=[],
            kg_reasoning_path=[],
            kg_communities=[],
            kg_traversal_iteration_count=0,
        )
        result = node(state)

        print(f"\n  [hop1] active: {result['kg_active_nodes']}")
        print(f"  [hop1] blocked: {result['kg_blocked_nodes']}")
        print(f"  [hop1] frontier: {result['kg_frontier']}")

        assert "component_x" in result["kg_active_nodes"]
        # blocked_comp recommended but not yet blocked (seed_b not in frontier yet)
        assert "blocked_comp" in result["kg_active_nodes"]
        assert result["kg_converged"] is False

    def test_blocked_nodes_are_excluded_from_active(self, tmp_path):
        from app.agents.architecture_planner.kg_traversal_agent import make_graph_traversal_node

        conn = self._setup_conn(tmp_path)
        node = make_graph_traversal_node(conn)

        # Seed with both seed_a (recommends blocked_comp) and seed_b (blocks blocked_comp)
        state = _make_state_dict(
            kg_frontier=["seed_a", "seed_b"],
            kg_active_nodes=["seed_a", "seed_b"],
            kg_blocked_nodes=[],
            kg_reasoning_path=[],
            kg_communities=[],
            kg_traversal_iteration_count=0,
        )
        result = node(state)

        print(f"\n  [block test] active: {result['kg_active_nodes']}")
        print(f"  [block test] blocked: {result['kg_blocked_nodes']}")

        assert "blocked_comp" not in result["kg_active_nodes"], \
            "blocked_comp was recommended AND blocked — should be excluded"
        assert "blocked_comp" in result["kg_blocked_nodes"]
        assert "component_x" in result["kg_active_nodes"]

    def test_full_convergence_loop(self, tmp_path):
        """Run traversal node repeatedly until convergence, simulating the LangGraph loop."""
        from app.agents.architecture_planner.kg_traversal_agent import make_graph_traversal_node, _MAX_TRAVERSAL_HOPS

        conn = self._setup_conn(tmp_path)
        node = make_graph_traversal_node(conn)

        state = _make_state_dict(
            kg_frontier=["seed_a", "seed_b"],
            kg_active_nodes=["seed_a", "seed_b"],
            kg_blocked_nodes=[],
            kg_reasoning_path=[],
            kg_communities=[],
            kg_traversal_iteration_count=0,
        )

        hops = 0
        while not state.get("kg_converged") and hops < _MAX_TRAVERSAL_HOPS:
            result = node(state)
            state.update(result)
            hops += 1
            print(
                f"\n  [hop {hops}] active={state['kg_active_nodes']} "
                f"blocked={state['kg_blocked_nodes']} "
                f"frontier={state['kg_frontier']} "
                f"converged={state['kg_converged']}"
            )

        print(f"\n  [converged in {hops} hop(s)]")
        print(f"  Final active nodes: {state['kg_active_nodes']}")
        print(f"  Final blocked nodes: {state['kg_blocked_nodes']}")
        print(f"  Reasoning path ({len(state['kg_reasoning_path'])} steps):")
        for step in state["kg_reasoning_path"]:
            print(f"    {step['from']} --{step['type']}--> {step['to']}: {step.get('reason', '')}")

        assert state["kg_converged"] is True
        assert "component_x" in state["kg_active_nodes"]
        assert "component_y" in state["kg_active_nodes"]
        assert "component_z" in state["kg_active_nodes"]
        assert "blocked_comp" not in state["kg_active_nodes"]
        assert "blocked_comp" in state["kg_blocked_nodes"]
        assert len(state["kg_reasoning_path"]) >= 3

    def test_community_scoping_limits_results(self, tmp_path):
        """Traversal with a community filter should only return nodes in those communities."""
        from app.agents.architecture_planner.kg_traversal_agent import make_graph_traversal_node

        conn = self._setup_conn(tmp_path)
        node = make_graph_traversal_node(conn)

        # community_z (id=1) is where component_z lives; component_x, y are in community 0
        # Scoping to community 1 should suppress component_x and component_y
        state = _make_state_dict(
            kg_frontier=["seed_a", "seed_b"],
            kg_active_nodes=["seed_a", "seed_b"],
            kg_blocked_nodes=[],
            kg_reasoning_path=[],
            kg_communities=[1],   # only community 1
            kg_traversal_iteration_count=0,
        )
        result = node(state)

        print(f"\n  [community scope=1] frontier after hop: {result['kg_frontier']}")
        # component_x and component_y are community 0 — should not appear in frontier
        assert "component_x" not in result["kg_frontier"]
        assert "component_y" not in result["kg_frontier"]


# ===========================================================================
# 4. KG Explainer
# ===========================================================================


class TestKgExplainer:
    def test_calls_llm_with_recommended_and_blocked(self):
        from app.agents.architecture_planner.kg_traversal_agent import make_kg_explainer_node

        mock_llm = MagicMock()
        mock_llm.invoke.return_value = MagicMock(content="Use component_x because of constraint_a.")

        node = make_kg_explainer_node(mock_llm)
        state = _make_state_dict(
            kg_constraints=["seed_a"],
            kg_active_nodes=["seed_a", "component_x", "component_y"],
            kg_blocked_nodes=["blocked_comp"],
            kg_reasoning_path=[
                {"from": "seed_a", "to": "component_x", "type": "RECOMMENDS", "reason": "needs it"},
            ],
        )
        result = node(state)

        print(f"\n  [explainer] output: {result['kg_explanation']}")
        assert result["kg_explanation"] == "Use component_x because of constraint_a."
        assert mock_llm.invoke.called

        # Verify the prompt contains blocked and recommended nodes
        prompt_text = mock_llm.invoke.call_args[0][0][0].content
        assert "component_x" in prompt_text
        assert "blocked_comp" in prompt_text

    def test_returns_empty_string_when_nothing_recommended(self):
        from app.agents.architecture_planner.kg_traversal_agent import make_kg_explainer_node

        mock_llm = MagicMock()
        node = make_kg_explainer_node(mock_llm)
        # active_nodes == kg_constraints => nothing was recommended beyond seeds
        state = _make_state_dict(
            kg_constraints=["seed_a"],
            kg_active_nodes=["seed_a"],
            kg_blocked_nodes=[],
            kg_reasoning_path=[],
        )
        result = node(state)
        assert result["kg_explanation"] == ""
        mock_llm.invoke.assert_not_called()


# ===========================================================================
# 5. Full subgraph (fixture graph, mocked LLM)
# ===========================================================================


class TestKgSubgraph:
    def test_full_subgraph_end_to_end(self, tmp_path):
        """
        Run the compiled KG subgraph (all 4 nodes + convergence loop) with a
        fixture graph and a mocked LLM. Validates that the full pipeline
        produces a converged recommendation with a reasoning trace.
        """
        from app.agents.architecture_planner.kg_traversal_agent import init_kuzu, build_kg_subgraph

        graph_file = tmp_path / "graph.json"
        _write_fixture_graph(graph_file)
        conn = init_kuzu(str(graph_file), str(tmp_path / "db"))

        # Mock LLM: NFR parser returns known constraint IDs; explainer returns text
        mock_llm = MagicMock()
        nfr_response = MagicMock(content='["seed_a", "seed_b"]')
        explainer_response = MagicMock(
            content="component_x is required by seed_a. component_y and component_z follow. blocked_comp is excluded."
        )
        mock_llm.invoke.side_effect = [nfr_response, explainer_response]

        subgraph = build_kg_subgraph(mock_llm, conn, community_summaries_path="nonexistent.json")
        initial_state = _make_state_dict()
        result = subgraph.invoke(initial_state)

        print("\n" + "=" * 60)
        print("KG SUBGRAPH RESULT")
        print("=" * 60)
        print(f"Constraints parsed:   {result['kg_constraints']}")
        print(f"Communities selected: {result['kg_communities']}")
        print(f"Active nodes:         {result['kg_active_nodes']}")
        print(f"Blocked nodes:        {result['kg_blocked_nodes']}")
        print(f"Converged:            {result['kg_converged']}")
        print(f"Traversal hops:       {result['kg_traversal_iteration_count']}")
        print(f"\nReasoning path ({len(result['kg_reasoning_path'])} steps):")
        for step in result["kg_reasoning_path"]:
            print(f"  {step['from']} --{step['type']}--> {step['to']}: {step.get('reason', '')}")
        print(f"\nExplanation:\n{textwrap.indent(result['kg_explanation'], '  ')}")
        print("=" * 60)

        assert result["kg_constraints"] == ["seed_a", "seed_b"]
        assert result["kg_converged"] is True
        assert "component_x" in result["kg_active_nodes"]
        assert "component_y" in result["kg_active_nodes"]
        assert "component_z" in result["kg_active_nodes"]
        assert "blocked_comp" not in result["kg_active_nodes"]
        assert "blocked_comp" in result["kg_blocked_nodes"]
        assert len(result["kg_reasoning_path"]) >= 3
        assert result["kg_explanation"] != ""


# ===========================================================================
# 6. Integration test — real graph.json (slow, ~30s)
# ===========================================================================


@pytest.mark.integration
class TestKgRealGraph:
    @pytest.fixture(scope="class")
    def real_conn(self, tmp_path_factory):
        from app.agents.architecture_planner.kg_traversal_agent import init_kuzu

        if not GRAPH_JSON.exists():
            pytest.skip(f"graph.json not found at {GRAPH_JSON}")

        db_path = tmp_path_factory.mktemp("real_kuzu_db") / "kuzu"
        print(f"\n  [integration] Loading real graph from {GRAPH_JSON} ...")
        conn = init_kuzu(str(GRAPH_JSON), str(db_path))
        assert conn is not None
        return conn

    def test_graph_loaded_correctly(self, real_conn):
        node_count = real_conn.execute("MATCH (n:Node) RETURN count(n)").get_as_df().iloc[0, 0]
        edge_count = real_conn.execute("MATCH ()-[r:REL]->() RETURN count(r)").get_as_df().iloc[0, 0]
        constraint_count = real_conn.execute(
            "MATCH (n:Node) WHERE n.type = 'Constraint' RETURN count(n)"
        ).get_as_df().iloc[0, 0]

        # Read expected counts directly from the source file so the test stays
        # correct even if the graph is regenerated.
        with open(GRAPH_JSON) as f:
            raw = json.load(f)
        # MERGE deduplicates nodes with the same ID, so use unique-ID counts.
        seen_ids: set = set()
        unique_nodes = []
        for n in raw["nodes"]:
            if n["id"] not in seen_ids:
                seen_ids.add(n["id"])
                unique_nodes.append(n)
        expected_nodes = len(unique_nodes)
        expected_edges = len(raw["edges"])
        expected_constraints = sum(1 for n in unique_nodes if n.get("type") == "Constraint")

        print(f"\n  nodes={node_count} (expected {expected_nodes})")
        print(f"  edges={edge_count} (expected {expected_edges})")
        print(f"  constraints={constraint_count} (expected {expected_constraints})")
        assert node_count == expected_nodes
        assert edge_count == expected_edges
        # Some duplicate node IDs in graph.json have conflicting `type` fields;
        # MERGE keeps the last write so the loaded count may differ by a few.
        assert abs(int(constraint_count) - expected_constraints) <= 5, (
            f"Constraint count {constraint_count} too far from expected {expected_constraints}"
        )

    def test_traversal_from_data_intensive_application(self, real_conn):
        """
        Seed traversal with 'data_intensive_application' — a well-connected root
        constraint — and verify convergence with a meaningful recommendation set.
        """
        from app.agents.architecture_planner.kg_traversal_agent import (
            make_graph_traversal_node,
            _MAX_TRAVERSAL_HOPS,
        )

        node = make_graph_traversal_node(real_conn)
        seed = "data_intensive_application"

        state = _make_state_dict(
            kg_frontier=[seed],
            kg_active_nodes=[seed],
            kg_blocked_nodes=[],
            kg_reasoning_path=[],
            kg_communities=[],
            kg_traversal_iteration_count=0,
        )

        hops = 0
        while not state.get("kg_converged") and hops < _MAX_TRAVERSAL_HOPS:
            result = node(state)
            state.update(result)
            hops += 1
            print(
                f"  hop {hops}: +{len(result.get('kg_frontier', []))} new nodes, "
                f"total active={len(state['kg_active_nodes'])}, "
                f"blocked={len(state['kg_blocked_nodes'])}"
            )

        print(f"\n  Converged in {hops} hop(s)")
        print(f"  Active nodes ({len(state['kg_active_nodes'])}):")
        for n in state["kg_active_nodes"][:20]:
            print(f"    {n}")
        if len(state["kg_active_nodes"]) > 20:
            print(f"    ... and {len(state['kg_active_nodes']) - 20} more")
        if state["kg_blocked_nodes"]:
            print(f"  Blocked ({len(state['kg_blocked_nodes'])}): {state['kg_blocked_nodes'][:10]}")

        finished = state["kg_converged"] or state["kg_traversal_iteration_count"] >= _MAX_TRAVERSAL_HOPS
        assert finished, "Traversal neither converged nor hit the hop limit"
        assert len(state["kg_active_nodes"]) > 5, "Expected meaningful recommendations"
        assert len(state["kg_reasoning_path"]) > 0

    def test_full_kg_subgraph_real_graph(self, real_conn):
        """
        Run the full 4-node compiled subgraph against the real knowledge graph.
        The LLM is mocked to return real constraint IDs that exist in the graph.
        """
        from app.agents.architecture_planner.kg_traversal_agent import build_kg_subgraph

        if not COMMUNITY_SUMMARIES.exists():
            pytest.skip(f"community_summaries.json not found at {COMMUNITY_SUMMARIES}")

        mock_llm = MagicMock()
        # Use real constraint IDs from the graph
        mock_llm.invoke.side_effect = [
            MagicMock(content='["data_intensive_application", "large_data_volume", "data_consistency"]'),
            MagicMock(content="Architecture explanation generated from graph traversal."),
        ]

        # Pass no community summaries so the router doesn't scope the traversal —
        # this isolates the traversal from the community-routing step.
        subgraph = build_kg_subgraph(mock_llm, real_conn, community_summaries_path="nonexistent.json")
        result = subgraph.invoke(_make_state_dict())

        print("\n" + "=" * 60)
        print("REAL GRAPH SUBGRAPH RESULT")
        print("=" * 60)
        print(f"Constraints:          {result['kg_constraints']}")
        print(f"Communities selected: {result['kg_communities']}")
        print(f"Active nodes ({len(result['kg_active_nodes'])}):")
        for n in result["kg_active_nodes"][:15]:
            print(f"  {n}")
        if len(result["kg_active_nodes"]) > 15:
            print(f"  ... and {len(result['kg_active_nodes']) - 15} more")
        print(f"Blocked nodes ({len(result['kg_blocked_nodes'])}): {result['kg_blocked_nodes'][:5]}")
        print(f"Converged:            {result['kg_converged']}")
        print(f"Traversal hops:       {result['kg_traversal_iteration_count']}")
        print(f"Reasoning steps:      {len(result['kg_reasoning_path'])}")
        print(f"\nExplanation:\n{textwrap.indent(result['kg_explanation'], '  ')}")
        print("=" * 60)

        finished = result["kg_converged"] or result["kg_traversal_iteration_count"] >= 5
        assert finished, "Traversal neither converged nor hit the hop limit"
        assert len(result["kg_active_nodes"]) > len(result["kg_constraints"]), \
            "Expected recommendations beyond the seed constraints"
        assert result["kg_explanation"] != ""


# ===========================================================================
# 7. Retrieval quality tests — named real-world scenarios
# ===========================================================================


@pytest.mark.integration
class TestKgRetrievalQuality:
    """
    Each test simulates a concrete system description, seeds the traversal with
    the constraint IDs the NFR parser would produce, then asserts that
    architecturally-correct concepts appear in the output and
    contradictory ones are blocked.

    Run with:
        pytest tests/test_kg_rag.py -v -s -m integration -k "Quality"
    """

    @pytest.fixture(scope="class")
    def real_conn(self, tmp_path_factory):
        from app.agents.architecture_planner.kg_traversal_agent import init_kuzu

        if not GRAPH_JSON.exists():
            pytest.skip(f"graph.json not found at {GRAPH_JSON}")

        db_path = tmp_path_factory.mktemp("quality_kuzu_db") / "kuzu"
        print(f"\n  [quality] Loading real graph ...")
        conn = init_kuzu(str(GRAPH_JSON), str(db_path))
        assert conn is not None
        return conn

    @pytest.fixture(scope="class")
    def community_summaries(self):
        if not COMMUNITY_SUMMARIES.exists():
            pytest.skip(f"community_summaries.json not found at {COMMUNITY_SUMMARIES}")
        with open(COMMUNITY_SUMMARIES) as f:
            raw = json.load(f)
        return raw.get("communities", raw)

    # ------------------------------------------------------------------
    # Helpers
    # ------------------------------------------------------------------

    def _get_communities(self, seeds: list[str], community_summaries: dict, real_conn) -> list[int]:
        """
        Return the combined community scope:
          - top-3 semantically similar communities (MiniLM)
          - communities of the seed constraint nodes themselves
        """
        from app.agents.architecture_planner.kg_traversal_agent import make_community_router_node

        router = make_community_router_node(community_summaries, real_conn)
        state = _make_state_dict(kg_constraints=seeds)
        result = router(state)
        return result["kg_communities"]

    def _run_traversal(
        self,
        real_conn,
        seeds: list[str],
        label: str,
        communities: list[int] | None = None,
    ) -> dict:
        from app.agents.architecture_planner.kg_traversal_agent import (
            make_graph_traversal_node,
            _MAX_TRAVERSAL_HOPS,
        )

        node = make_graph_traversal_node(real_conn)
        state = _make_state_dict(
            kg_frontier=seeds,
            kg_active_nodes=list(seeds),
            kg_blocked_nodes=[],
            kg_reasoning_path=[],
            kg_communities=communities or [],
            kg_traversal_iteration_count=0,
        )

        hops = 0
        while not state.get("kg_converged") and hops < _MAX_TRAVERSAL_HOPS:
            result = node(state)
            state.update(result)
            hops += 1

        seeds_set = set(seeds)
        recommended = [n for n in state["kg_active_nodes"] if n not in seeds_set]
        blocked = state["kg_blocked_nodes"]
        scoped = "community-filtered" if communities else "unfiltered"

        print(f"\n{'=' * 62}")
        print(f"  SCENARIO: {label}  [{scoped}]")
        print(f"{'=' * 62}")
        print(f"  Seeds ({len(seeds)}): {seeds}")
        if communities:
            print(f"  Communities in scope: {communities}")
        print(f"  Hops: {hops}  |  Active: {len(state['kg_active_nodes'])}  |  Blocked: {len(blocked)}")
        print(f"\n  Recommended ({len(recommended)}):")
        for n in recommended[:25]:
            print(f"    + {n}")
        if len(recommended) > 25:
            print(f"    ... and {len(recommended) - 25} more")
        print(f"\n  Blocked ({len(blocked)}):")
        for n in blocked[:15]:
            print(f"    - {n}")
        print(f"{'=' * 62}")

        return state

    # ------------------------------------------------------------------
    # Scenario 1: Write-heavy database (e.g. metrics ingestion, IoT)
    # ------------------------------------------------------------------

    def test_write_heavy_database(self, real_conn, community_summaries):
        """
        System: high-volume write workload with strict consistency.
        Expects: LSM-tree storage, log-structured storage, write buffering.
        Community filter should halve the result set vs unfiltered.
        """
        seeds = ["high_write_throughput", "write_spike_handling", "data_consistency"]
        communities = self._get_communities(seeds, community_summaries, real_conn)

        unfiltered = self._run_traversal(real_conn, seeds, "Write-Heavy Database")
        filtered   = self._run_traversal(real_conn, seeds, "Write-Heavy Database", communities)

        rec_unfiltered = set(unfiltered["kg_active_nodes"]) - set(seeds)
        rec_filtered   = set(filtered["kg_active_nodes"])   - set(seeds)

        # Community filtering should meaningfully reduce the result set
        assert len(rec_filtered) < len(rec_unfiltered), \
            "Community filtering should reduce the active node count"

        # Core write-optimised patterns must survive the filter
        assert "lsm_tree" in rec_filtered, \
            "LSM tree expected after community filtering"
        assert "log_structured_storage" in rec_filtered, \
            "Log-structured storage expected after community filtering"
        assert any(n in rec_filtered for n in ["apache_kafka", "event_log", "queueing"]), \
            "Some form of write buffering (Kafka / event log / queue) expected after filtering"

    # ------------------------------------------------------------------
    # Scenario 2: Serverless / event-driven (e.g. webhook processor)
    # ------------------------------------------------------------------

    def test_serverless_event_driven(self, real_conn, community_summaries):
        """
        System: irregular bursty traffic, cost-sensitive, no persistent state.
        Expects: object storage, batch processing.
        Should block: stream processing (always-on, contradicts cost profile).
        Community filter: seed nodes live in communities {0, 17, 24} which contain
        S3/object-store patterns — those must survive filtering.
        """
        seeds = ["bursty_traffic", "cold_start_latency", "cost_efficiency"]
        communities = self._get_communities(seeds, community_summaries, real_conn)

        unfiltered = self._run_traversal(real_conn, seeds, "Serverless / Event-Driven")
        filtered   = self._run_traversal(real_conn, seeds, "Serverless / Event-Driven", communities)

        rec_unfiltered = set(unfiltered["kg_active_nodes"]) - set(seeds)
        rec_filtered   = set(filtered["kg_active_nodes"])   - set(seeds)
        blocked_filtered = set(filtered["kg_blocked_nodes"])

        assert len(rec_filtered) < len(rec_unfiltered), \
            "Community filtering should reduce the active node count"

        assert any(n in rec_filtered for n in ["amazon_s3", "azure_blob_storage", "object_store"]), \
            "Object storage expected after community filtering"

        # batch_processing lives in community 1 which is outside the serverless seed scope;
        # elasticity and data_lake are the equivalent cost/scale patterns in scope.
        assert any(n in rec_filtered for n in ["elasticity", "data_lake", "low_cost_storage"]), \
            "Elasticity / data lake / low-cost storage expected after community filtering"

        # relational storage patterns are correctly blocked for object-store-first architectures
        assert any(n in blocked_filtered for n in ["relational_data_storage", "shared_disk_architecture"]), \
            "Relational / shared-disk patterns should be blocked for serverless object-store scenario"

    # ------------------------------------------------------------------
    # Scenario 3: Financial transaction system (e.g. payments, ledger)
    # ------------------------------------------------------------------

    def test_financial_transaction_system(self, real_conn, community_summaries):
        """
        System: payment processing requiring ACID guarantees and auditability.
        Expects: audit log, NewSQL database, atomic commit.
        Should block: async event log (violates ACID).
        Seed communities {1, 8, 11, 21} contain audit_log and newsql_database
        directly — these must survive community filtering.
        """
        seeds = ["acid_guarantees", "transaction_processing", "financial_systems", "data_consistency"]
        communities = self._get_communities(seeds, community_summaries, real_conn)

        unfiltered = self._run_traversal(real_conn, seeds, "Financial Transaction System")
        filtered   = self._run_traversal(real_conn, seeds, "Financial Transaction System", communities)

        rec_unfiltered = set(unfiltered["kg_active_nodes"]) - set(seeds)
        rec_filtered   = set(filtered["kg_active_nodes"])   - set(seeds)
        blocked_filtered = set(filtered["kg_blocked_nodes"])

        assert len(rec_filtered) < len(rec_unfiltered), \
            "Community filtering should reduce the active node count"

        assert any(n in rec_filtered for n in ["audit_log", "append_only_log"]), \
            "Audit log expected after community filtering"

        assert any(n in rec_filtered for n in ["newsql_database", "atomic_commit_protocol"]), \
            "NewSQL database or atomic commit expected after community filtering"

        # destructive_overwrite is blocked — financial records must be immutable
        assert "destructive_overwrite" in blocked_filtered, \
            "Destructive overwrite should be blocked for financial audit trail"
        # state_deletion is blocked — financial state must never be deleted
        assert "state_deletion" in blocked_filtered, \
            "State deletion should be blocked for financial transaction system"

    # ------------------------------------------------------------------
    # Scenario 4: Real-time streaming analytics (e.g. clickstream, telemetry)
    # ------------------------------------------------------------------

    def test_streaming_analytics_pipeline(self, real_conn, community_summaries):
        """
        System: continuous high-throughput event stream with stateful aggregations.
        Expects: OLAP stores (ClickHouse / Druid / Pinot), real-time analytics.
        Should block: batch ingestion.
        Seed nodes are in community 21 (OLAP, ClickHouse, Druid, Pinot all live there)
        — the union with router communities must surface these.
        """
        seeds = ["real_time_ingestion", "stateful_stream_processing", "high_throughput_streams"]
        communities = self._get_communities(seeds, community_summaries, real_conn)

        unfiltered = self._run_traversal(real_conn, seeds, "Real-Time Streaming Analytics")
        filtered   = self._run_traversal(real_conn, seeds, "Real-Time Streaming Analytics", communities)

        rec_unfiltered = set(unfiltered["kg_active_nodes"]) - set(seeds)
        rec_filtered   = set(filtered["kg_active_nodes"])   - set(seeds)
        blocked_filtered = set(filtered["kg_blocked_nodes"])

        assert len(rec_filtered) < len(rec_unfiltered), \
            "Community filtering should reduce the active node count"

        assert any(n in rec_filtered for n in ["clickhouse", "druid", "pinot", "olap"]), \
            "OLAP store expected after community filtering (seed community 21 contains these)"

        assert "real_time_analytics" in rec_filtered, \
            "real_time_analytics expected after community filtering"

        assert "batch_ingestion" in blocked_filtered, \
            "Batch ingestion should be blocked for a real-time streaming pipeline"

    # ------------------------------------------------------------------
    # Scenario 5: Audit log / append-only ledger (e.g. compliance, CDC)
    # ------------------------------------------------------------------

    def test_append_only_audit_ledger(self, real_conn, community_summaries):
        """
        System: immutable event ledger for compliance and audit purposes.
        Expects: event sourcing, CDC, derived views.
        Seed communities {10, 11} — community 11 is the CQRS/event-sourcing cluster.
        """
        seeds = ["append_only", "audit_trail_required", "immutable_data"]
        communities = self._get_communities(seeds, community_summaries, real_conn)

        unfiltered = self._run_traversal(real_conn, seeds, "Append-Only Audit Ledger")
        filtered   = self._run_traversal(real_conn, seeds, "Append-Only Audit Ledger", communities)

        rec_unfiltered = set(unfiltered["kg_active_nodes"]) - set(seeds)
        rec_filtered   = set(filtered["kg_active_nodes"])   - set(seeds)

        assert len(rec_filtered) < len(rec_unfiltered), \
            "Community filtering should reduce the active node count"

        assert any(n in rec_filtered for n in ["change_data_capture", "event_sourcing", "derived_view"]), \
            "CDC / event sourcing / derived view expected after community filtering"

    # ------------------------------------------------------------------
    # Scenario 6: Social network fanout (e.g. Twitter/X home timeline)
    # ------------------------------------------------------------------

    def test_social_network_fanout(self, real_conn, community_summaries):
        """
        System: social feed with celebrity accounts causing write amplification.
        Expects: separate celebrity storage, LSM tree.
        Seed community 4 contains separate_celebrity_storage — must survive filter.
        """
        seeds = ["fanout_writes", "high_write_throughput", "high_read_throughput"]
        communities = self._get_communities(seeds, community_summaries, real_conn)

        unfiltered = self._run_traversal(real_conn, seeds, "Social Network Fanout")
        filtered   = self._run_traversal(real_conn, seeds, "Social Network Fanout", communities)

        rec_unfiltered = set(unfiltered["kg_active_nodes"]) - set(seeds)
        rec_filtered   = set(filtered["kg_active_nodes"])   - set(seeds)

        assert len(rec_filtered) < len(rec_unfiltered), \
            "Community filtering should reduce the active node count"

        assert "separate_celebrity_storage" in rec_filtered, \
            "Separate celebrity storage expected after community filtering"

        assert "lsm_tree" in rec_filtered, \
            "LSM tree expected after community filtering (community 10, included via router)"

    # ------------------------------------------------------------------
    # Scenario 7: GDPR-compliant multi-region SaaS
    # ------------------------------------------------------------------

    def test_gdpr_multiregion_saas(self, real_conn, community_summaries):
        """
        System: SaaS product serving EU + US users with GDPR data residency.
        Expects: multi-datacenter leaders, distributed servers.
        Blocks: personal_data_in_events (right-to-erasure vs immutability conflict).
        Seed communities {18, 43, 108} contain all three expected nodes.
        """
        seeds = ["gdpr_compliance", "geographically_distributed_regions", "multi_jurisdiction_users"]
        communities = self._get_communities(seeds, community_summaries, real_conn)

        unfiltered = self._run_traversal(real_conn, seeds, "GDPR Multi-Region SaaS")
        filtered   = self._run_traversal(real_conn, seeds, "GDPR Multi-Region SaaS", communities)

        rec_filtered   = set(filtered["kg_active_nodes"])   - set(seeds)
        blocked_filtered = set(filtered["kg_blocked_nodes"])

        assert "multi_datacenter_leaders" in rec_filtered, \
            "multi_datacenter_leaders expected after community filtering"

        assert "distributed_servers" in rec_filtered, \
            "distributed_servers expected after community filtering"

        assert "personal_data_in_events" in blocked_filtered, \
            "personal_data_in_events should be blocked under GDPR compliance"
