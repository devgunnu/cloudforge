from __future__ import annotations

import json
import subprocess
import tempfile
from pathlib import Path

from app.agents.agent3.state import TestResult

try:
    from app.agents.agent3.config import PYTEST_TIMEOUT, JEST_TIMEOUT
except ImportError:
    PYTEST_TIMEOUT = 60
    JEST_TIMEOUT = 60


def run_python_tests(
    service_code: str, test_code: str, service_id: str
) -> TestResult:
    """
    Execute Python tests by writing service code and test code to a temp
    directory and running pytest.  Returns a structured TestResult.
    """
    try:
        with tempfile.TemporaryDirectory() as tmpdir:
            tmp = Path(tmpdir)

            # Write the service module
            (tmp / "index.py").write_text(service_code, encoding="utf-8")

            # Write the test module
            (tmp / "test_index.py").write_text(test_code, encoding="utf-8")

            # Minimal conftest so imports resolve within the temp dir
            (tmp / "conftest.py").write_text(
                "import sys\nimport os\n"
                "sys.path.insert(0, os.path.dirname(__file__))\n",
                encoding="utf-8",
            )

            result = subprocess.run(
                [
                    "python",
                    "-m",
                    "pytest",
                    "test_index.py",
                    "-v",
                    "--tb=short",
                    "--no-header",
                    "-q",
                ],
                cwd=tmpdir,
                capture_output=True,
                text=True,
                timeout=PYTEST_TIMEOUT,
            )

            output = (result.stdout + result.stderr).strip()
            errors = _parse_test_errors(output)

            return TestResult(
                service_id=service_id,
                passed=result.returncode == 0,
                output=output,
                errors=errors,
            )
    except FileNotFoundError:
        return TestResult(
            service_id=service_id,
            passed=False,
            output="",
            errors=["pytest not found"],
        )
    except subprocess.TimeoutExpired:
        return TestResult(
            service_id=service_id,
            passed=False,
            output="",
            errors=["pytest timed out"],
        )
    except Exception as e:
        return TestResult(
            service_id=service_id,
            passed=False,
            output="",
            errors=[str(e)],
        )


def run_typescript_tests(
    service_code: str, test_code: str, service_id: str
) -> TestResult:
    """
    Execute TypeScript tests by writing service code and test code to a temp
    directory and running jest via npx.  Returns a structured TestResult.
    """
    try:
        with tempfile.TemporaryDirectory() as tmpdir:
            tmp = Path(tmpdir)

            # Write the service module
            (tmp / "index.ts").write_text(service_code, encoding="utf-8")

            # Write the test module
            (tmp / "index.test.ts").write_text(test_code, encoding="utf-8")

            # Minimal tsconfig for ts-jest
            tsconfig = {
                "compilerOptions": {
                    "target": "ES2020",
                    "module": "commonjs",
                    "strict": True,
                    "esModuleInterop": True,
                    "skipLibCheck": True,
                    "outDir": "./dist",
                }
            }
            (tmp / "tsconfig.json").write_text(
                json.dumps(tsconfig), encoding="utf-8"
            )

            # Minimal jest config using ts-jest preset
            jest_config = (
                "module.exports = {\n"
                "  preset: 'ts-jest',\n"
                "  testEnvironment: 'node',\n"
                "};\n"
            )
            (tmp / "jest.config.js").write_text(jest_config, encoding="utf-8")

            result = subprocess.run(
                [
                    "npx",
                    "jest",
                    "--no-cache",
                    "--forceExit",
                    "--detectOpenHandles",
                ],
                cwd=tmpdir,
                capture_output=True,
                text=True,
                timeout=JEST_TIMEOUT,
            )

            output = (result.stdout + result.stderr).strip()
            errors = _parse_test_errors(output)

            return TestResult(
                service_id=service_id,
                passed=result.returncode == 0,
                output=output,
                errors=errors,
            )
    except FileNotFoundError:
        return TestResult(
            service_id=service_id,
            passed=False,
            output="",
            errors=["jest / npx not found"],
        )
    except subprocess.TimeoutExpired:
        return TestResult(
            service_id=service_id,
            passed=False,
            output="",
            errors=["jest timed out"],
        )
    except Exception as e:
        return TestResult(
            service_id=service_id,
            passed=False,
            output="",
            errors=[str(e)],
        )


def run_tests(
    service_code: str, test_code: str, language: str, service_id: str
) -> TestResult:
    """Dispatch to the appropriate test runner based on language."""
    if language == "python":
        return run_python_tests(service_code, test_code, service_id)
    elif language == "typescript":
        return run_typescript_tests(service_code, test_code, service_id)
    else:
        return TestResult(
            service_id=service_id,
            passed=False,
            output="",
            errors=[f"Unsupported language for test execution: {language}"],
        )


def _parse_test_errors(output: str) -> list[str]:
    """
    Extract error/failure lines from test runner output.
    Looks for common failure indicators across pytest and jest output.
    """
    errors: list[str] = []
    for line in output.splitlines():
        stripped = line.strip()
        # pytest markers: FAILED, ERROR, lines starting with E (assertion detail)
        if stripped.startswith("FAILED ") or stripped.startswith("ERROR "):
            errors.append(stripped)
        elif stripped.startswith("E ") and len(stripped) > 2:
            errors.append(stripped)
        # jest markers
        elif stripped.startswith("\u25CF "):  # bullet character jest uses
            errors.append(stripped)
        elif "FAIL " in stripped and stripped.startswith("FAIL"):
            errors.append(stripped)
    return errors
