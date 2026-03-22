from __future__ import annotations

import ast
import json
import subprocess
import tempfile
from pathlib import Path

from app.agents.agent3.config import TSC_TIMEOUT


def check_python_syntax(code: str) -> list[str]:
    """
    Check Python syntax using ast.parse.
    Returns a list of error strings (empty = no errors).
    """
    try:
        ast.parse(code)
        return []
    except SyntaxError as e:
        return [f"SyntaxError at line {e.lineno}: {e.msg}"]
    except Exception as e:
        return [f"Parse error: {e}"]


def check_typescript_syntax(code: str, filename: str = "handler.ts") -> list[str]:
    """
    Check TypeScript syntax by writing to a temp file and running tsc --noEmit.
    Returns a list of error strings (empty = no errors).
    """
    try:
        with tempfile.TemporaryDirectory() as tmpdir:
            ts_file = Path(tmpdir) / filename
            ts_file.write_text(code, encoding="utf-8")

            # Minimal tsconfig to avoid needing @types packages
            tsconfig = {
                "compilerOptions": {
                    "target": "ES2020",
                    "module": "commonjs",
                    "strict": True,
                    "noEmit": True,
                    "skipLibCheck": True,
                }
            }
            (Path(tmpdir) / "tsconfig.json").write_text(
                json.dumps(tsconfig), encoding="utf-8"
            )

            result = subprocess.run(
                ["tsc", "--noEmit", "--project", str(Path(tmpdir) / "tsconfig.json")],
                cwd=tmpdir,
                capture_output=True,
                text=True,
                timeout=TSC_TIMEOUT,
            )
            if result.returncode == 0:
                return []
            # Parse tsc output: "file.ts(line,col): error TSxxxx: message"
            errors: list[str] = []
            for line in (result.stdout + result.stderr).splitlines():
                if "error TS" in line:
                    errors.append(line.strip())
            return errors or [result.stdout + result.stderr]
    except FileNotFoundError:
        # tsc not installed — fall back to basic bracket matching
        return _basic_ts_check(code)
    except subprocess.TimeoutExpired:
        return ["tsc timed out — syntax check skipped"]
    except Exception as e:
        return [f"TypeScript check error: {e}"]


def _basic_ts_check(code: str) -> list[str]:
    """Minimal fallback syntax check when tsc is not available."""
    errors: list[str] = []
    open_braces = code.count("{") - code.count("}")
    open_parens = code.count("(") - code.count(")")
    open_brackets = code.count("[") - code.count("]")
    if open_braces != 0:
        errors.append(f"Unbalanced braces: {open_braces:+d}")
    if open_parens != 0:
        errors.append(f"Unbalanced parentheses: {open_parens:+d}")
    if open_brackets != 0:
        errors.append(f"Unbalanced brackets: {open_brackets:+d}")
    return errors


def check_syntax(code: str, language: str, filename: str | None = None) -> list[str]:
    """Dispatch to the appropriate syntax checker based on language."""
    if language == "python":
        return check_python_syntax(code)
    elif language == "typescript":
        fname = filename or "handler.ts"
        return check_typescript_syntax(code, fname)
    else:
        # Unknown language — no check
        return []
