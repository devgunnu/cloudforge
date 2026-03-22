from __future__ import annotations

import json
import subprocess
import tempfile
from pathlib import Path

from app.agents.agent3.config import CHECKOV_TIMEOUT, TERRAFORM_TIMEOUT, TFLINT_TIMEOUT
from app.agents.agent3.state import ValidationResult


def _write_tf_files(tmpdir: str, tf_files: dict[str, str]) -> None:
    """Write tf_files dict to a temporary directory, creating subdirs as needed."""
    for fname, content in tf_files.items():
        fpath = Path(tmpdir) / fname
        fpath.parent.mkdir(parents=True, exist_ok=True)
        fpath.write_text(content, encoding="utf-8")


def run_terraform_fmt(tf_files: dict[str, str]) -> ValidationResult:
    """Run `terraform fmt -check -recursive` against the provided HCL files."""
    tool = "terraform_fmt"
    try:
        with tempfile.TemporaryDirectory() as tmpdir:
            _write_tf_files(tmpdir, tf_files)
            result = subprocess.run(
                ["terraform", "fmt", "-check", "-recursive", "-diff"],
                cwd=tmpdir,
                capture_output=True,
                text=True,
                timeout=TERRAFORM_TIMEOUT,
            )
            passed = result.returncode == 0
            output = result.stdout + result.stderr
            errors = [output] if not passed and output.strip() else []
            return ValidationResult(
                tool=tool,
                passed=passed,
                output=output,
                errors=errors,
            )
    except FileNotFoundError:
        return ValidationResult(
            tool=tool,
            passed=True,  # skip gracefully if terraform not installed
            output="terraform CLI not found — fmt check skipped",
            errors=[],
        )
    except subprocess.TimeoutExpired:
        return ValidationResult(
            tool=tool,
            passed=False,
            output="terraform fmt timed out",
            errors=["terraform fmt timed out"],
        )


def run_terraform_validate(tf_files: dict[str, str]) -> ValidationResult:
    """Run `terraform init` + `terraform validate -json` against the provided HCL files."""
    tool = "terraform_validate"
    try:
        with tempfile.TemporaryDirectory() as tmpdir:
            _write_tf_files(tmpdir, tf_files)
            # Init without backend to avoid network calls
            subprocess.run(
                ["terraform", "init", "-backend=false", "-input=false", "-no-color"],
                cwd=tmpdir,
                capture_output=True,
                text=True,
                timeout=TERRAFORM_TIMEOUT,
            )
            result = subprocess.run(
                ["terraform", "validate", "-json", "-no-color"],
                cwd=tmpdir,
                capture_output=True,
                text=True,
                timeout=TERRAFORM_TIMEOUT,
            )
            try:
                data = json.loads(result.stdout)
                passed = data.get("valid", False)
                diagnostics = data.get("diagnostics", [])
                errors = [
                    f"{d.get('severity','error').upper()}: {d.get('summary','')} — {d.get('detail','')}"
                    for d in diagnostics
                    if d.get("severity") in ("error", "warning")
                ]
            except json.JSONDecodeError:
                passed = result.returncode == 0
                errors = [result.stdout + result.stderr] if not passed else []
            return ValidationResult(
                tool=tool,
                passed=passed,
                output=result.stdout + result.stderr,
                errors=errors,
            )
    except FileNotFoundError:
        return ValidationResult(
            tool=tool,
            passed=True,
            output="terraform CLI not found — validate skipped",
            errors=[],
        )
    except subprocess.TimeoutExpired:
        return ValidationResult(
            tool=tool,
            passed=False,
            output="terraform validate timed out",
            errors=["terraform validate timed out"],
        )


def run_tflint(tf_files: dict[str, str]) -> ValidationResult:
    """Run tflint with JSON output against the provided HCL files."""
    tool = "tflint"
    try:
        with tempfile.TemporaryDirectory() as tmpdir:
            _write_tf_files(tmpdir, tf_files)
            result = subprocess.run(
                ["tflint", "--format=json", "--no-color"],
                cwd=tmpdir,
                capture_output=True,
                text=True,
                timeout=TFLINT_TIMEOUT,
            )
            try:
                data = json.loads(result.stdout)
                issues = data.get("issues", [])
                errors = [
                    f"{i.get('rule',{}).get('name','unknown')} [{i.get('rule',{}).get('severity','warning')}]: "
                    f"{i.get('message','')} at {i.get('range',{}).get('filename','?')}:"
                    f"{i.get('range',{}).get('start',{}).get('line','?')}"
                    for i in issues
                    if i.get("rule", {}).get("severity") == "error"
                ]
                passed = len(errors) == 0
            except json.JSONDecodeError:
                passed = result.returncode == 0
                errors = [result.stdout + result.stderr] if not passed else []
            return ValidationResult(
                tool=tool,
                passed=passed,
                output=result.stdout + result.stderr,
                errors=errors,
            )
    except FileNotFoundError:
        return ValidationResult(
            tool=tool,
            passed=True,
            output="tflint not found — lint check skipped",
            errors=[],
        )
    except subprocess.TimeoutExpired:
        return ValidationResult(
            tool=tool,
            passed=False,
            output="tflint timed out",
            errors=["tflint timed out"],
        )


def run_checkov(tf_files: dict[str, str]) -> ValidationResult:
    """Run checkov security scan against the provided HCL files."""
    tool = "checkov"
    try:
        with tempfile.TemporaryDirectory() as tmpdir:
            _write_tf_files(tmpdir, tf_files)
            result = subprocess.run(
                [
                    "checkov",
                    "-d",
                    tmpdir,
                    "--framework",
                    "terraform",
                    "--output",
                    "json",
                    "--quiet",
                    "--compact",
                ],
                cwd=tmpdir,
                capture_output=True,
                text=True,
                timeout=CHECKOV_TIMEOUT,
            )
            try:
                raw = result.stdout.strip()
                # checkov may prepend non-JSON lines; find the first '{'
                json_start = raw.find("{")
                data = json.loads(raw[json_start:]) if json_start >= 0 else {}
                summary = data.get("summary", {})
                failed = summary.get("failed", 0)
                passed_count = summary.get("passed", 0)
                passed = failed == 0
                errors: list[str] = []
                for check in data.get("results", {}).get("failed_checks", []):
                    errors.append(
                        f"FAILED [{check.get('check_id')}] {check.get('check_type','')} — "
                        f"{check.get('resource','')} in {check.get('file_path','')}"
                    )
            except (json.JSONDecodeError, ValueError):
                passed = result.returncode == 0
                errors = [result.stdout[:2000]] if not passed else []
                passed_count = 0
                failed = 0
            output = f"passed={passed_count} failed={failed}\n{result.stdout[:500]}"
            return ValidationResult(
                tool=tool,
                passed=passed,
                output=output,
                errors=errors,
            )
    except FileNotFoundError:
        return ValidationResult(
            tool=tool,
            passed=True,
            output="checkov not found — security scan skipped",
            errors=[],
        )
    except subprocess.TimeoutExpired:
        return ValidationResult(
            tool=tool,
            passed=False,
            output="checkov timed out",
            errors=["checkov timed out"],
        )


def aggregate_validation_errors(results: list[ValidationResult]) -> str:
    """Build a consolidated human-readable error summary from multiple ValidationResult items."""
    lines: list[str] = []
    for r in results:
        if not r["passed"] and r["errors"]:
            lines.append(f"=== {r['tool'].upper()} ===")
            lines.extend(r["errors"])
    return "\n".join(lines) if lines else ""
