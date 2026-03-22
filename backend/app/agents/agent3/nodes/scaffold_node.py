from __future__ import annotations

import logging
from typing import Any

from app.agents.agent3.config import (
    AMPLIFY_TRIGGER_SERVICE_TYPES,
    DEFAULT_LANGUAGE,
    EXT_MAP,
    JAVA_REQUIRED_SERVICES,
    LAMBDA_SERVICE_TYPES,
    RUNTIME_FEATURE_REQUIREMENTS,
    SERVICE_LANGUAGE_MAP,
)
from app.agents.agent3.scaffold.templates import (
    render_amplify_yml,
    render_buildspec_yaml,
    render_frontend_index_html,
    render_frontend_main_tsx,
    render_frontend_package_json,
    render_frontend_tsconfig,
    render_gitignore,
    render_kinesis_dockerfile,
    render_lambda_requirements_stub,
    render_layers_requirements,
    render_root_env_example,
    render_vite_config,
)
from app.agents.agent3.state import AgentState, FileManifestEntry

logger = logging.getLogger(__name__)


def _get_language(svc: dict[str, Any], overrides: dict[str, str]) -> str:
    """Resolve the implementation language for a service deterministically.

    Priority order:
    1. Explicit user override for this service id
    2. Runtime-specific feature requirement declared in svc config
    3. Service type is in JAVA_REQUIRED_SERVICES
    4. Service-type-level default from SERVICE_LANGUAGE_MAP
    5. Global DEFAULT_LANGUAGE
    """
    # 1. Explicit override wins unconditionally
    if svc["id"] in overrides:
        return overrides[svc["id"]]

    # 2. Runtime feature requirement (first match wins)
    features: list[str] = svc.get("config", {}).get("features", [])
    for feature in features:
        if feature in RUNTIME_FEATURE_REQUIREMENTS:
            return RUNTIME_FEATURE_REQUIREMENTS[feature]

    # 3. Java-only service types
    if svc["service_type"] in JAVA_REQUIRED_SERVICES:
        return "java"

    # 4. Service-type default
    lang = SERVICE_LANGUAGE_MAP.get(svc["service_type"])
    if lang:
        return lang

    # 5. Global default
    return DEFAULT_LANGUAGE


def scaffold_node(state: AgentState) -> dict[str, Any]:
    """Produce the full deterministic project scaffold without any LLM calls.

    Writes all [TEMPLATE] files into scaffold_files and registers every
    project file (template and LLM slot) in file_manifest so downstream
    nodes know exactly what must be generated.
    """
    services: list[dict[str, Any]] = state.get("services") or []
    language_overrides: dict[str, str] = state.get("language_overrides") or {}
    project_name: str = (state.get("generation_metadata") or {}).get(
        "project_name", "cloudforge-app"
    )

    # Determine topology characteristics
    has_frontend = any(
        svc["service_type"] in AMPLIFY_TRIGGER_SERVICE_TYPES for svc in services
    )
    has_rds = any(svc["service_type"] == "rds" for svc in services)
    lambda_services = [s for s in services if s["service_type"] in LAMBDA_SERVICE_TYPES]
    kinesis_services = [s for s in services if s["service_type"] == "kinesis"]

    scaffold_files: dict[str, str] = {}
    manifest: list[FileManifestEntry] = []

    def add_template(
        path: str,
        content: str,
        description: str,
        required: bool = True,
        language: str = "",
    ) -> None:
        scaffold_files[path] = content
        manifest.append(
            FileManifestEntry(
                path=path,
                fill_strategy="template",
                language=language,
                service_id=None,
                required=required,
                description=description,
            )
        )

    def add_llm_slot(
        path: str,
        fill_strategy: str,
        language: str,
        service_id: str | None,
        required: bool,
        description: str,
    ) -> None:
        # LLM slots are not written to scaffold_files — they must be filled later
        manifest.append(
            FileManifestEntry(
                path=path,
                fill_strategy=fill_strategy,
                language=language,
                service_id=service_id,
                required=required,
                description=description,
            )
        )

    # -----------------------------------------------------------------------
    # Root scaffold templates
    # -----------------------------------------------------------------------
    add_template(".gitignore", render_gitignore("root"), "Root gitignore")
    add_template("buildspec.yaml", render_buildspec_yaml(), "CodeBuild spec")
    add_template(
        ".env.example",
        render_root_env_example([s["id"] for s in lambda_services], has_rds),
        "Env example",
    )

    # LLM slots for infrastructure artifacts
    add_llm_slot(
        "docker-compose.yml",
        "llm_infra",
        "yaml",
        None,
        required=False,
        description="Local development docker-compose",
    )
    for svc in services:
        if svc["service_type"] in ("ecs", "fargate"):
            sid = svc["id"]
            add_llm_slot(
                f"services/{sid}/Dockerfile",
                "llm_infra",
                "dockerfile",
                sid,
                required=False,
                description=f"{sid} Dockerfile",
            )

    # -----------------------------------------------------------------------
    # Lambda service files
    # -----------------------------------------------------------------------
    add_template(
        "services/layers/common/requirements.txt",
        render_layers_requirements(),
        "Shared Lambda layer deps",
    )

    for svc in lambda_services:
        lang = _get_language(svc, language_overrides)
        ext = EXT_MAP.get(lang, lang)
        sid = svc["id"]

        add_template(
            f"services/{sid}/requirements.txt",
            render_lambda_requirements_stub(sid),
            f"{sid} deps stub",
            language=lang,
        )
        add_llm_slot(
            f"services/{sid}/index.{ext}",
            "llm_handler",
            lang,
            sid,
            required=True,
            description=f"{sid} Lambda handler",
        )
        add_llm_slot(
            f"services/{sid}/test_handler.{ext}",
            "llm_test",
            lang,
            sid,
            required=False,
            description=f"{sid} unit tests",
        )

    # -----------------------------------------------------------------------
    # Kinesis consumer files (Java KCL on ECS Fargate)
    # -----------------------------------------------------------------------
    for svc in kinesis_services:
        sid = svc["id"]
        add_template(
            f"consumers/{sid}/Dockerfile",
            render_kinesis_dockerfile(sid),
            f"{sid} KCL Dockerfile",
        )
        add_llm_slot(
            f"consumers/{sid}/pom.xml",
            "llm_java",
            "java",
            sid,
            required=True,
            description=f"{sid} Maven POM",
        )
        add_llm_slot(
            f"consumers/{sid}/src/main/java/com/cloudforge/App.java",
            "llm_java",
            "java",
            sid,
            required=True,
            description=f"{sid} KCL App",
        )
        add_llm_slot(
            f"consumers/{sid}/src/main/java/com/cloudforge/RecordProcessor.java",
            "llm_java",
            "java",
            sid,
            required=True,
            description=f"{sid} KCL processor",
        )

    # -----------------------------------------------------------------------
    # Frontend files (only when Amplify is in the topology)
    # -----------------------------------------------------------------------
    if has_frontend:
        add_template(
            "frontend/package.json",
            render_frontend_package_json(project_name),
            "Frontend package.json",
            language="typescript",
        )
        add_template(
            "frontend/tsconfig.json",
            render_frontend_tsconfig(),
            "Frontend tsconfig",
            language="typescript",
        )
        add_template(
            "frontend/vite.config.ts",
            render_vite_config(),
            "Vite config",
            language="typescript",
        )
        add_template(
            "frontend/index.html",
            render_frontend_index_html(project_name),
            "Vite entry HTML",
        )
        add_template(
            "frontend/src/main.tsx",
            render_frontend_main_tsx(),
            "React entry point",
            language="typescript",
        )
        add_template(
            "frontend/amplify.yml",
            render_amplify_yml(),
            "Amplify build spec",
        )
        add_llm_slot(
            "frontend/src/App.tsx",
            "llm_frontend",
            "typescript",
            None,
            required=True,
            description="Main React App component",
        )

    template_count = len(scaffold_files)
    llm_slot_count = len(manifest) - template_count

    logger.info(
        "scaffold_node: project=%s, %d template files, %d llm slots, frontend=%s",
        project_name,
        template_count,
        llm_slot_count,
        has_frontend,
    )

    return {
        "scaffold_files": scaffold_files,
        "file_manifest": manifest,
        "project_name": project_name,
        "current_phase": "tf_generation",
    }
