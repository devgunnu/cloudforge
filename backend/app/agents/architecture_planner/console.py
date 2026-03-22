#!/usr/bin/env python3
"""
CloudForge Architecture Planner — Console Testing Utility

Usage (interactive prompts for any missing inputs):
    python -m app.agents.architecture_planner.console

Usage (fully non-interactive):
    python -m app.agents.architecture_planner.console \\
        --budget "$50k/year" \\
        --traffic "100k MAU, 500 RPS peak" \\
        --availability "US + EU, 99.9% SLA" \\
        --prd-file /path/to/prd.txt \\
        --cloud AWS \\
        --model anthropic

Flags:
    --budget TEXT           Budget description
    --traffic TEXT          Traffic expectations
    --availability TEXT     Availability / region requirements
    --prd TEXT              PRD inline text
    --prd-file PATH         Path to PRD file (alternative to --prd)
    --cloud AWS|GCP|Azure   Cloud provider
    --model-name NAME       Override default model name (default: claude-haiku-4-5-20251001)
"""
from __future__ import annotations

import argparse
import json
import os
import sys
import uuid
from datetime import datetime
from pathlib import Path
from typing import Any


# ---------------------------------------------------------------------------
# Argument parsing
# ---------------------------------------------------------------------------


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="CloudForge Architecture Planner — Console Utility",
        formatter_class=argparse.RawDescriptionHelpFormatter,
    )
    parser.add_argument("--budget", type=str, help="Budget (e.g. '$50k/year')")
    parser.add_argument("--traffic", type=str, help="Traffic (e.g. '100k MAU, 500 RPS peak')")
    parser.add_argument("--availability", type=str, help="Availability (e.g. 'US + EU, 99.9% SLA')")
    parser.add_argument("--prd", type=str, help="PRD text (inline)")
    parser.add_argument("--prd-file", type=str, help="Path to PRD file")
    parser.add_argument("--cloud", type=str, choices=["AWS", "GCP", "Azure"], help="Cloud provider")
    parser.add_argument("--model-name", type=str, default=None, help="Override default model name")
    parser.add_argument(
        "--terraform-mcp-cmd",
        type=str,
        default=None,
        dest="terraform_mcp_cmd",
        help=(
            "Shell command to launch the Terraform MCP server, as a single string. "
            "e.g. 'npx -y @hashicorp/terraform-mcp-server' or "
            "'docker run --rm -i hashicorp/terraform-mcp-server'. "
            "When omitted, service discovery runs LLM-only (default behavior)."
        ),
    )
    return parser.parse_args()


# ---------------------------------------------------------------------------
# Interactive input collection
# ---------------------------------------------------------------------------


def _read_multiline(prompt: str) -> str:
    """Read multi-line input terminated by two consecutive blank lines."""
    print(prompt)
    print("(Press Enter twice when done)")
    lines: list[str] = []
    while True:
        line = input()
        if line == "" and lines and lines[-1] == "":
            break
        lines.append(line)
    # Strip trailing blank line
    if lines and lines[-1] == "":
        lines = lines[:-1]
    return "\n".join(lines)


def collect_inputs(args: argparse.Namespace) -> dict[str, str]:
    """Prompt for any inputs not supplied via CLI flags."""
    inputs: dict[str, str] = {}

    inputs["budget"] = args.budget or input("Budget (e.g. '$50k/year'): ").strip()
    inputs["traffic"] = (
        args.traffic or input("Traffic (e.g. '100k MAU, 500 RPS peak'): ").strip()
    )
    inputs["availability"] = (
        args.availability
        or input("Availability (e.g. 'US + EU, 99.9% SLA, global CDN'): ").strip()
    )

    if args.prd:
        inputs["prd"] = args.prd
    elif args.prd_file:
        prd_path = Path(args.prd_file)
        if not prd_path.exists():
            print(f"Error: PRD file not found: {prd_path}", file=sys.stderr)
            sys.exit(1)
        inputs["prd"] = prd_path.read_text(encoding="utf-8")
    else:
        inputs["prd"] = _read_multiline("\nPaste your PRD / project requirements:")

    if args.cloud:
        inputs["cloud_provider"] = args.cloud
    else:
        raw = input("Cloud provider [AWS / GCP / Azure]: ").strip()
        normalized = raw.upper()
        if normalized == "AZURE":
            normalized = "Azure"
        if normalized not in ("AWS", "GCP", "Azure"):
            print(f"Error: cloud_provider must be AWS, GCP, or Azure. Got: {raw}", file=sys.stderr)
            sys.exit(1)
        inputs["cloud_provider"] = normalized

    return inputs


# ---------------------------------------------------------------------------
# Progress printing
# ---------------------------------------------------------------------------

_NODE_LABELS: dict[str, str] = {
    "architecture":         "Generating architecture diagram & documents (iteration {iter})...",
    "service_discovery":    "Discovering platform services...",
    "arch_simulator":       "  ↳ Simulating load & capacity...",
    "resilience_simulator": "  ↳ Analysing resilience & failure modes...",
    "compliance":           "  ↳ Checking PRD / NFR compliance...",
    "arch_test":            "  ↳ Running structural architecture tests...",
    "accept":               "Presenting architecture for review...",
    "present_architecture": "  ↳ Awaiting your decision...",
}


def print_progress(event: dict, state: dict) -> None:
    ts = datetime.now().strftime("%H:%M:%S")
    for node_name in event:
        if node_name.startswith("__"):
            continue
        label = _NODE_LABELS.get(node_name, f"Running {node_name}...")
        if "{iter}" in label:
            label = label.format(iter=state.get("arch_iteration_count", "?"))
        print(f"[{ts}] {label}")


# ---------------------------------------------------------------------------
# Architecture review interrupt handler
# ---------------------------------------------------------------------------


def handle_accept_interrupt(summary: str, iteration: int) -> dict[str, Any]:
    """Display architecture summary and ask user to accept or request changes."""
    print("\n" + "═" * 66)
    print(summary)
    print("═" * 66)
    print(f"\n[Review round {iteration}/3]")
    print("Options:")
    print("  1. Accept this architecture")
    print("  2. Request changes")

    while True:
        sel = input("Select [1/2]: ").strip()
        if sel == "1":
            return {"accepted": True, "changes": ""}
        elif sel == "2":
            changes = input("Describe the changes you want:\n> ").strip()
            return {"accepted": False, "changes": changes}
        print("Please enter 1 or 2.")


# ---------------------------------------------------------------------------
# Output saving
# ---------------------------------------------------------------------------


def save_outputs(final_state: dict, output_dir: Path) -> None:
    output_dir.mkdir(parents=True, exist_ok=True)

    # 1. architecture_diagram.json
    diagram = final_state.get("architecture_diagram")
    if diagram is not None:
        diagram_dict = (
            diagram.model_dump(by_alias=True)
            if hasattr(diagram, "model_dump")
            else diagram
        )
        (output_dir / "architecture_diagram.json").write_text(
            json.dumps(diagram_dict, indent=2), encoding="utf-8"
        )

    # 2. Non_Functional_Requirements.md
    if nfr := final_state.get("nfr_document"):
        (output_dir / "Non_Functional_Requirements.md").write_text(nfr, encoding="utf-8")

    # 3. Component_Responsibilities.md
    if comp := final_state.get("component_responsibilities"):
        (output_dir / "Component_Responsibilities.md").write_text(comp, encoding="utf-8")

    # 4. Extra_Context.md
    if extra := final_state.get("extra_context"):
        (output_dir / "Extra_Context.md").write_text(extra, encoding="utf-8")

    # 5. Debug dump (full state, JSON-serialisable subset)
    safe_state: dict[str, Any] = {}
    for k, v in final_state.items():
        try:
            json.dumps(v, default=str)
            safe_state[k] = v
        except TypeError:
            safe_state[k] = str(v)

    (output_dir / "run_state.json").write_text(
        json.dumps(safe_state, indent=2, default=str), encoding="utf-8"
    )

    print(f"\nOutputs saved to: {output_dir.resolve()}")


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------


def main() -> None:
    args = parse_args()

    # Validate API key early
    if not os.environ.get("ANTHROPIC_API_KEY"):
        print(
            "Error: ANTHROPIC_API_KEY environment variable is not set.\n"
            "Set ANTHROPIC_API_KEY before running.",
            file=sys.stderr,
        )
        sys.exit(1)

    inputs = collect_inputs(args)

    print(f"\nBuilding architecture planner graph ({args.model})...")
    from app.agents.architecture_planner.graph import create_graph
    from app.agents.architecture_planner.state import make_initial_state

    import shlex
    terraform_mcp_cmd = shlex.split(args.terraform_mcp_cmd) if args.terraform_mcp_cmd else None
    graph = create_graph(model_type=args.model, model_name=args.model_name, terraform_mcp_cmd=terraform_mcp_cmd)
    initial_state = make_initial_state(**inputs)
    thread_id = str(uuid.uuid4())
    config = {"configurable": {"thread_id": thread_id}}

    print("\nStarting architecture planning...\n" + "═" * 66)

    current_input: Any = initial_state
    final_state: dict = {}

    while True:
        interrupted = False

        for event in graph.stream(current_input, config=config, stream_mode="updates"):
            # Check for interrupt signal
            if "__interrupt__" in event:
                interrupts = event["__interrupt__"]
                # Take the first interrupt
                interrupt_data = interrupts[0].value if hasattr(interrupts[0], "value") else interrupts[0]

                if "summary" in interrupt_data:
                    # Architecture review
                    response = handle_accept_interrupt(
                        interrupt_data["summary"],
                        interrupt_data.get("iteration", 1),
                    )
                    from langgraph.types import Command as LGCommand
                    current_input = LGCommand(resume=response)
                else:
                    # Unknown interrupt — just resume with the raw data
                    from langgraph.types import Command as LGCommand
                    current_input = LGCommand(resume=interrupt_data)

                interrupted = True
                break  # break the inner for-loop; outer while resumes graph

            # Print progress for normal node updates
            current_full = graph.get_state(config).values
            print_progress(event, current_full)
            final_state = current_full

        if not interrupted:
            # Graph reached END without interrupting
            break

    # Ensure we have the final state
    try:
        final_state = graph.get_state(config).values
    except Exception:
        pass  # use whatever we collected above

    print("\n" + "═" * 66)
    print("Architecture planning complete!")

    # Summary
    arch_test_passed = final_state.get("arch_test_passed", False)
    violations_count = len(final_state.get("arch_test_violations") or [])
    print(f"Architecture tests: {'PASSED' if arch_test_passed else 'FAILED'} ({violations_count} violation(s))")
    if warn := final_state.get("error_message"):
        print(f"\nWarning: {warn}")

    # Save outputs
    ts = datetime.now().strftime("%Y%m%d_%H%M%S")
    output_dir = Path("outputs") / f"run_{ts}"
    save_outputs(final_state, output_dir)


if __name__ == "__main__":
    main()
