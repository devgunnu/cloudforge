# Agent 3 — Deterministic Scaffold + Controlled Code Generation

## Status
- [x] Task 1: `state.py` + `config.py` updated (done in main context)
- [ ] Task 2: `scaffold/templates.py` — all template rendering functions
- [ ] Task 3: `nodes/scaffold_node.py` — scaffold_node with _get_language() helper
- [ ] Task 4: Wire `scaffold_node` into `graph.py`
- [ ] Task 5: Update `assembler.py` + fix `handler→index` paths in `codegen_worker.py`
- [ ] Task 6: `nodes/completeness_checker.py` — wire between test_orchestrator and assembler
- [ ] Task 7: `nodes/infra_codegen_worker.py` + CDK prompt templates (j2)
- [ ] Task 8: `nodes/frontend_codegen_worker.py` + frontend prompt templates (j2)

## What Was Already Done (Task 1 — complete)

### `state.py` changes
- Added `FileManifestEntry` TypedDict with fields: `path`, `fill_strategy`, `language`, `service_id`, `required`, `description`
- Added to `TaskItem.task_type` literal: `"infra_gen"`, `"frontend_gen"`
- Added to `AgentState`: `scaffold_files: dict[str, str]`, `file_manifest: list[FileManifestEntry]`, `project_name: str`
- Added `"scaffolding"` to `current_phase` literal

### `config.py` changes
- Added `"amplify"` to `SUPPORTED_SERVICE_TYPES`
- Added `LAMBDA_SERVICE_TYPES`, `JAVA_REQUIRED_SERVICES`, `AMPLIFY_TRIGGER_SERVICE_TYPES`
- Added `RUNTIME_FEATURE_REQUIREMENTS: dict[str, str]`
- Added `STACK_ASSIGNMENT: dict[str, str]`

---

## Context

Agent 3 currently generates code in a free-form, unpredictable manner — each `codegen_worker` produces a single flat file (`services/{id}/handler.py`), no file structure is declared before generation begins, and the assembler merges whatever was produced with no completeness check. There is no frontend generation path and no CDK infrastructure scaffolding. The goal is to add a deterministic `scaffold_node` that declares the full project structure upfront, writes boilerplate files without any LLM calls, and constrains the LLM codegen workers to fill only declared slots — producing a valid, deployable AWS project on every run.

**Key decisions confirmed:**
- Frontend: React + Vite, deployed on **AWS Amplify** (CDK provisions `CfnApp` + `CfnBranch`)
- Backend Lambda: Python 3.12 by default; **language is selected deterministically** based on runtime feature requirements
- Java 21 (KCL 3.x on ECS Fargate) only for Kinesis
- IaC: AWS CDK TypeScript (L2 constructs)
- `buildspec.yaml`: CodeBuild spec for CDK infra compilation and `cdk deploy --all`
- `amplify.yml`: Amplify Hosting build spec for the React/Vite frontend build

### Language Resolution Strategy (no LLM — fully deterministic)

```python
# Priority order:
# 1. language_overrides[service_id]   → explicit user choice wins
# 2. svc.config.get("features", [])   → runtime-specific feature requirement
# 3. svc.service_type in JAVA_REQUIRED_SERVICES → java
# 4. SERVICE_LANGUAGE_MAP[svc.service_type]     → type-level default
# 5. DEFAULT_LANGUAGE                            → "python"

RUNTIME_FEATURE_REQUIREMENTS = {
    "response_streaming": "typescript",
    "websocket_streaming": "typescript",
    "snapstart": "java",
    "kinesis_kcl": "java",
}
```

---

## Generated Project Structure

```
{project_name}/
├── frontend/
│   ├── src/
│   │   ├── main.tsx                   # [TEMPLATE]
│   │   └── App.tsx                    # [LLM]
│   ├── index.html                     # [TEMPLATE]
│   ├── vite.config.ts                 # [TEMPLATE]
│   ├── tsconfig.json                  # [TEMPLATE]
│   ├── package.json                   # [TEMPLATE] react@18, vite@5
│   └── amplify.yml                    # [TEMPLATE] Amplify Hosting build spec
├── services/
│   ├── {service_id}/
│   │   ├── index.py                   # [LLM] Lambda handler (NOT handler.py)
│   │   ├── requirements.txt           # [LLM] stub seeded by template
│   │   └── test_handler.py            # [LLM] unit tests
│   └── layers/common/requirements.txt # [TEMPLATE]
├── consumers/                         # only if kinesis in topology
│   └── {service_id}/
│       ├── Dockerfile                 # [TEMPLATE]
│       ├── pom.xml                    # [LLM]
│       └── src/main/java/com/cloudforge/
│           ├── App.java               # [LLM]
│           └── RecordProcessor.java   # [LLM]
├── infrastructure/
│   ├── bin/app.ts                     # [TEMPLATE]
│   ├── lib/
│   │   ├── stages/application-stage.ts # [TEMPLATE]
│   │   ├── stacks/
│   │   │   ├── network-stack.ts       # [LLM] VPC
│   │   │   ├── data-stack.ts          # [LLM] RDS, DynamoDB, S3
│   │   │   ├── api-stack.ts           # [LLM] Lambda fns, API Gateway
│   │   │   ├── streaming-stack.ts     # [LLM] Kinesis + ECS Fargate
│   │   │   └── frontend-stack.ts      # [LLM] Amplify CfnApp + CfnBranch
│   │   └── utils/naming.ts            # [TEMPLATE]
│   ├── parameters/dev.json            # [TEMPLATE]
│   ├── parameters/prod.json           # [TEMPLATE]
│   ├── cdk.json                       # [TEMPLATE]
│   ├── package.json                   # [TEMPLATE]
│   └── tsconfig.json                  # [TEMPLATE]
├── buildspec.yaml                     # [TEMPLATE]
├── .env.example                       # [TEMPLATE]
└── .gitignore                         # [TEMPLATE]
```

---

## Task 2: `scaffold/templates.py`

File: `backend/app/agents/agent3/scaffold/templates.py`
Note: `backend/app/agents/agent3/scaffold/__init__.py` already exists (empty).

Implement these functions (all return `str`):

| Function | Purpose |
|----------|---------|
| `render_cdk_json(project_name)` | CDK v2 cdk.json with feature flags |
| `render_infra_package_json(project_name)` | aws-cdk-lib@2.x, constructs@10.x |
| `render_infra_tsconfig()` | ES2020, strict, commonjs |
| `render_bin_app_ts(project_pascal, stacks)` | App entry with per-stack imports |
| `render_application_stage_ts(stacks)` | Stage wrapper |
| `render_naming_utils_ts()` | resourceName() helper |
| `render_frontend_package_json(project_name)` | react@18, vite@5 |
| `render_vite_config()` | Vite config with /api proxy |
| `render_frontend_tsconfig()` | strict, ESNext, bundler resolution |
| `render_frontend_index_html(project_name)` | Vite entry HTML |
| `render_frontend_main_tsx()` | ReactDOM.createRoot entry |
| `render_amplify_yml()` | Amplify Hosting build spec |
| `render_buildspec_yaml()` | CodeBuild spec: cd infrastructure && npm ci && npx cdk deploy --all |
| `render_lambda_requirements_stub(service_id)` | boto3 stub |
| `render_layers_requirements()` | powertools, pydantic, boto3 |
| `render_kinesis_dockerfile(service_id)` | amazoncorretto:21-alpine |
| `render_gitignore(layer)` | "root" | "cdk" | "frontend" |
| `render_root_env_example(service_ids, has_rds)` | All env vars |

Key content for `render_amplify_yml()`:
```yaml
version: 1
frontend:
  phases:
    preBuild:
      commands:
        - cd frontend && npm ci
    build:
      commands:
        - npm run build
  artifacts:
    baseDirectory: frontend/dist
    files:
      - '**/*'
  cache:
    paths:
      - frontend/node_modules/**/*
```

Key content for `render_buildspec_yaml()`:
```yaml
version: 0.2
phases:
  install:
    runtime-versions:
      nodejs: 20
    commands:
      - cd infrastructure && npm ci
  build:
    commands:
      - npx cdk synth
      - npx cdk deploy --all --require-approval never
  post_build:
    commands:
      - echo "CDK deployment complete at $(date)"
artifacts:
  files:
    - infrastructure/cdk.out/**/*
```

---

## Task 3: `nodes/scaffold_node.py`

File: `backend/app/agents/agent3/nodes/scaffold_node.py`

```python
def _get_language(svc: ServiceNode, overrides: dict[str, str]) -> str:
    # 1. Explicit override
    if svc["id"] in overrides:
        return overrides[svc["id"]]
    # 2. Runtime-specific feature requirement
    features = svc.get("config", {}).get("features", [])
    for feature in features:
        if feature in RUNTIME_FEATURE_REQUIREMENTS:
            return RUNTIME_FEATURE_REQUIREMENTS[feature]
    # 3. Java-only service types
    if svc["service_type"] in JAVA_REQUIRED_SERVICES:
        return "java"
    # 4. Type-level default
    if svc["service_type"] in SERVICE_LANGUAGE_MAP:
        return SERVICE_LANGUAGE_MAP[svc["service_type"]]
    # 5. Global default
    return DEFAULT_LANGUAGE
```

Node logic:
1. Read `services`, `language_overrides`, `generation_metadata.project_name`
2. `stacks_needed = {STACK_ASSIGNMENT[svc["service_type"]] for svc in services if svc["service_type"] in STACK_ASSIGNMENT}`
3. `has_frontend = any(svc["service_type"] in AMPLIFY_TRIGGER_SERVICE_TYPES for svc in services)`
4. `has_kinesis = any(svc["service_type"] == "kinesis" for svc in services)`
5. Write all [TEMPLATE] files into `scaffold_files` dict using `scaffold/templates.py`
6. Build `file_manifest: list[FileManifestEntry]` for every file (both template and LLM slots)
7. Return `{"scaffold_files": ..., "file_manifest": ..., "project_name": ..., "current_phase": "tf_generation"}`

**Important**: Lambda handler path is `services/{id}/index.{ext}` (NOT `handler.{ext}`)

---

## Task 4: Wire `scaffold_node` into `graph.py`

Changes to `backend/app/agents/agent3/graph.py`:
```python
from app.agents.agent3.nodes.scaffold_node import scaffold_node

builder.add_node("scaffold_node", scaffold_node)

# Change _route_after_parsing to route to scaffold_node instead of tf_generator
def _route_after_parsing(state: AgentState) -> Literal["scaffold_node", "error_handler"]:
    return "error_handler" if state.get("current_phase") == "error" else "scaffold_node"

# Add edge: scaffold_node -> tf_generator
builder.add_edge("scaffold_node", "tf_generator")
```

Update conditional edges for parse_input to use `"scaffold_node"` instead of `"tf_generator"`.

---

## Task 5: Update `assembler.py` + Fix `handler→index` in `codegen_worker.py`

### `assembler.py`
Add `scaffold_files` merge as the **first** operation (lowest priority, LLM output wins on conflicts):
```python
artifacts: dict[str, str] = {}
artifacts.update(state.get("scaffold_files") or {})   # ADD THIS LINE FIRST
artifacts.update(state.get("tf_files") or {})
artifacts.update(state.get("code_files") or {})
artifacts.update(state.get("test_files") or {})
```

### `codegen_worker.py`
Replace all 3 occurrences of `handler.{ext}` with `index.{ext}`:
- Line ~135: `file=f"services/{service_id}/handler.{ext}"` → `file=f"services/{service_id}/index.{ext}"`
- Line ~153: `file_path = f"services/{service_id}/handler.{ext}"` → `file_path = f"services/{service_id}/index.{ext}"`
- Line ~174: `file=f"services/{service_id}/handler.{ext}"` → `file=f"services/{service_id}/index.{ext}"`

---

## Task 6: `nodes/completeness_checker.py`

File: `backend/app/agents/agent3/nodes/completeness_checker.py`

Logic:
- Build `generated_keys = set()` from `scaffold_files`, `tf_files`, `code_files`, `test_files`
- For every `FileManifestEntry` in `file_manifest` where `required=True`:
  - If `entry["path"] not in generated_keys` → add to missing list
- If missing: `human_review_required=True`, `human_review_message="Missing required files: ..."`
- Always returns `current_phase="assembly"`

Wire in graph: `test_orchestrator → completeness_checker → assembler`
(Change the existing `test_orchestrator → assembler` edge.)

---

## Task 7: `infra_codegen_worker` + CDK prompt templates

### `nodes/infra_codegen_worker.py`
- Handles `TaskItem` with `task_type == "infra_gen"`
- Each task corresponds to one CDK stack file (e.g., `infrastructure/lib/stacks/api-stack.ts`)
- Uses `cdk_stack_system.j2` + `cdk_stack_user.j2` to prompt LLM
- Returns `{"tf_files": {stack_path: stack_content}}` (reusing tf_files dict for CDK stacks)

### `prompts/templates/cdk_stack_system.j2`
Rules for LLM:
- Use L2 constructs only
- `RemovalPolicy.RETAIN` for stateful resources (RDS, DynamoDB, S3)
- Reference Lambda via `path.join(__dirname, '../../../services/<id>')`
- For Amplify stack: use `aws_amplify.CfnApp` + `aws_amplify.CfnBranch`
- Import everything from `aws-cdk-lib`

### `prompts/templates/cdk_stack_user.j2`
Variables: `stack_name`, `stack_file_path`, `services_in_stack`, `all_services`, `connections`, `project_name`

### Update `manager_agent.py`
In `_planning_mode`, after building `code_gen_tasks`, also build `infra_gen` tasks from
`file_manifest` entries where `fill_strategy == "llm_cdk"`:
```python
infra_gen_tasks = [
    TaskItem(
        task_id=uuid.uuid4().hex[:8],
        service_id=entry["path"],   # stack file path as service_id
        task_type="infra_gen",
        language="typescript",
        status="pending",
        retry_count=0,
        error_message=None,
    )
    for entry in (state.get("file_manifest") or [])
    if entry["fill_strategy"] == "llm_cdk"
]
```

### Wire in `graph.py`
Add `infra_codegen_worker` node. Dispatch via parallel `Send()` alongside `codegen_worker`:
```python
from app.agents.agent3.nodes.infra_codegen_worker import infra_codegen_worker_node
builder.add_node("infra_codegen_worker", infra_codegen_worker_node)
# In _route_after_manager, add infra_gen Send() dispatches alongside code_gen
```

---

## Task 8: `frontend_codegen_worker` + frontend prompt templates

### `nodes/frontend_codegen_worker.py`
- Handles `TaskItem` with `task_type == "frontend_gen"`
- Generates `frontend/src/App.tsx` and similar LLM frontend files
- Uses `frontend_system.j2` + `frontend_user.j2`
- Returns generated content into `code_files`

### `prompts/templates/frontend_system.j2`
Rules:
- React 18, TypeScript strict
- Fetch from `import.meta.env.VITE_API_URL`
- Always handle loading + error states
- Use functional components + hooks only

### `prompts/templates/frontend_user.j2`
Variables: `file_path`, `project_name`, `api_endpoints`, `services`, `connections`

### Wire in `graph.py`
Add `frontend_codegen_worker` node. Dispatch via parallel `Send()` for `frontend_gen` task type.

---

## Verification

```bash
# Verify no handler.py paths remain
grep -rn "handler\.py\|handler\.ts" backend/app/agents/agent3/ --include="*.py"

# Run unit tests
cd backend && python -m pytest tests/ -v -k "agent3"
```

Expected artifact keys after Lambda + API Gateway + Amplify topology run:
- `infrastructure/cdk.json` ✓
- `infrastructure/lib/stacks/api-stack.ts` ✓
- `infrastructure/lib/stacks/frontend-stack.ts` ✓ (Amplify CfnApp)
- `services/{id}/index.py` ✓ (not handler.py)
- `frontend/amplify.yml` ✓
- `buildspec.yaml` ✓
