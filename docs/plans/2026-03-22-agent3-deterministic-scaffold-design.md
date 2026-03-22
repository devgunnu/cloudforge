# Agent 3 — Deterministic Scaffold + Controlled Code Generation

**Date**: 2026-03-22
**Branch**: `agent3`
**Status**: Approved — pending implementation plan

---

## 1. Problem Statement

Agent 3 currently generates code in an almost entirely free-form manner:

- Each `codegen_worker` produces a single flat file: `services/{service_id}/handler.{ext}`
- No file structure is declared before generation begins — the LLM invents paths
- No completeness check exists — the assembler merges whatever was produced
- No frontend generation path exists
- CDK/IaC infrastructure code is never generated — only Terraform HCL

The result is unpredictable output that varies run-to-run and cannot be reliably deployed.

---

## 2. Design Goals

1. **Deterministic structure**: All file paths are declared before any LLM call
2. **Scaffold-then-fill**: Boilerplate files are written by Python templates; LLM only fills business logic slots
3. **AWS-CDK first**: Generated projects are valid CDK TypeScript apps, deployable with `cdk deploy`
4. **Frontend included**: React + Vite SPA generated when topology includes CloudFront/S3
5. **Java as last resort**: Python is default; Java (KCL/Fargate) only for services that mandate it (e.g., Kinesis KCL)
6. **Completeness enforcement**: Assembler refuses to output if any required file is missing

---

## 3. Tech Choices

| Layer | Technology | Rationale |
|-------|-----------|-----------|
| Frontend | React + Vite (SPA) | Simplest AWS deploy: `aws s3 sync dist/ s3://bucket` + CloudFront |
| Backend (Lambda) | Python 3.12 | Lightweight, Lambda-native, fastest cold start |
| Backend (Java) | Java 21 + KCL 3.x on ECS Fargate | **Last resort only** — Kinesis Enhanced Fan-Out consumers |
| IaC | AWS CDK TypeScript (L2 constructs) | Type-safe, deploy-ready, better than raw HCL for app teams |
| CDK scaffolding | Programmatic Python file generation | No `cdk init` subprocess — avoids Node.js + npm dependency at runtime |

---

## 4. Generated Project Folder Structure

Every CloudForge-generated project will have this canonical shape:

```
{project_name}/
│
├── frontend/                          # React + Vite SPA
│   │                                  # ONLY generated if cloudfront/s3 in topology
│   ├── src/
│   │   ├── main.tsx                   # [TEMPLATE] Vite entry point
│   │   ├── App.tsx                    # [LLM] App shell with routing + API calls
│   │   └── components/                # [LLM] Service-driven UI components
│   ├── index.html                     # [TEMPLATE]
│   ├── vite.config.ts                 # [TEMPLATE]
│   ├── tsconfig.json                  # [TEMPLATE]
│   ├── package.json                   # [TEMPLATE] react@18, vite@5, @vitejs/plugin-react
│   └── .env.local                     # [TEMPLATE] VITE_API_URL=placeholder
│
├── services/                          # Lambda runtime code (Python or TS)
│   │                                  # One subfolder per compute ServiceNode
│   ├── {service_id}/
│   │   ├── index.py                   # [LLM] Lambda handler — PythonFunction entry
│   │   ├── requirements.txt           # [LLM] Runtime deps (stub seeded from template)
│   │   └── test_handler.py            # [LLM] Unit tests
│   └── layers/
│       └── common/
│           └── requirements.txt       # [TEMPLATE] aws-lambda-powertools, pydantic, boto3
│
├── consumers/                         # Long-running ECS/Fargate workers
│   │                                  # ONLY generated if kinesis in topology
│   └── {service_id}/
│       ├── src/main/java/com/cloudforge/
│       │   ├── App.java               # [LLM] KCL 3.x main class
│       │   └── RecordProcessor.java   # [LLM] ShardRecordProcessor
│       ├── pom.xml                    # [LLM] Maven deps: amazon-kinesis-client 3.x
│       └── Dockerfile                 # [TEMPLATE] Amazon Linux 2 + Java 21
│
├── infrastructure/                    # AWS CDK TypeScript project
│   ├── bin/
│   │   └── app.ts                     # [TEMPLATE] CDK App entry — instantiates stacks
│   ├── lib/
│   │   ├── stages/
│   │   │   └── application-stage.ts   # [TEMPLATE] Dev/prod stage wrapper
│   │   ├── stacks/                    # One file per logical CloudFormation stack
│   │   │   ├── network-stack.ts       # [LLM] VPC, subnets, security groups
│   │   │   ├── data-stack.ts          # [LLM] RDS, DynamoDB, S3 buckets
│   │   │   ├── api-stack.ts           # [LLM] Lambda fns, API Gateway, IAM
│   │   │   ├── streaming-stack.ts     # [LLM] Kinesis, ECS Fargate task
│   │   │   └── frontend-stack.ts      # [LLM] S3 bucket, CloudFront distribution
│   │   ├── constructs/
│   │   │   └── python-lambda.ts       # [LLM] Reusable PythonFunction L2 construct
│   │   └── utils/
│   │       └── naming.ts              # [TEMPLATE] Stack/resource naming helper
│   ├── parameters/
│   │   ├── dev.json                   # [TEMPLATE] { "environment": "dev" }
│   │   └── prod.json                  # [TEMPLATE] { "environment": "prod" }
│   ├── cdk.json                       # [TEMPLATE] CDK v2 feature flags
│   ├── package.json                   # [TEMPLATE] aws-cdk-lib@2.x, constructs@10.x
│   └── tsconfig.json                  # [TEMPLATE] ES2020, strict, commonjs
│
├── docker-compose.yml                 # [TEMPLATE] Local dev: db + backend + frontend
├── docker-compose.override.yml        # [TEMPLATE] Dev overrides (hot reload)
├── .env.example                       # [TEMPLATE] All required env vars
└── .gitignore                         # [TEMPLATE] CDK + Python + Node standard
```

### Stack Assignment Rules

| Service Type | CDK Stack | Notes |
|-------------|-----------|-------|
| `vpc` | `network-stack` | Created first; others reference its outputs |
| `rds`, `dynamodb`, `s3` | `data-stack` | Stateful — `RemovalPolicy.RETAIN` |
| `lambda`, `api_gateway`, `sns`, `sqs`, `step_functions` | `api-stack` | Stateless — `RemovalPolicy.DESTROY` in dev |
| `kinesis` | `streaming-stack` | Includes ECS Fargate KCL consumer task |
| `cloudfront` (frontend) | `frontend-stack` | S3 + CloudFront + BucketDeployment |

---

## 5. File Manifest Pattern

### 5.1 FileManifestEntry Schema

```python
class FileManifestEntry(TypedDict):
    path: str             # Relative POSIX path from project root
    fill_strategy: str    # "template" | "llm_handler" | "llm_cdk" | "llm_test"
    language: str         # "python" | "typescript" | "java"
    service_id: str | None
    required: bool        # assembler rejects output if True and file missing
    description: str      # what the LLM should generate (for llm_* entries)
```

### 5.2 Fill Strategy Classification

| Strategy | Files | Who generates |
|----------|-------|---------------|
| `template` | cdk.json, tsconfig.json, package.json, bin/app.ts, vite.config.ts, docker-compose.yml, Dockerfiles, .gitignore, requirements.txt stubs | Python `scaffold_node` — no LLM |
| `llm_handler` | `services/{id}/index.py`, `services/{id}/test_handler.py` | `codegen_worker` (existing, updated path) |
| `llm_cdk` | `infrastructure/lib/stacks/*.ts`, `infrastructure/lib/constructs/*.ts` | NEW `infra_codegen_worker` |
| `llm_frontend` | `frontend/src/App.tsx`, `frontend/src/components/*.tsx` | NEW `frontend_codegen_worker` |
| `llm_java` | `consumers/{id}/pom.xml`, `consumers/{id}/src/**/*.java` | NEW Java codegen path |

---

## 6. Updated Agent 3 Graph

```
parse_input
    ↓
scaffold_node          ← NEW: zero LLM calls, writes all [TEMPLATE] files,
    │                         emits FileManifest, sets current_phase
    ↓
tf_generator           ← unchanged (still generates Terraform HCL)
    ↓
tf_validation_loop     ← unchanged
    ↓
manager_agent          ← reads FileManifest, plans task_groups for all
    │                    fill_strategy types: handler + cdk + frontend
    ↓
[Send() fan-out] ──────────────────────────────────────────────┐
    ├─ backend_codegen_worker(s)   ← updated: path = services/{id}/index.py
    ├─ infra_codegen_worker(s)     ← NEW: generates CDK stack TypeScript
    └─ frontend_codegen_worker     ← NEW: generates React components
    ↓ [all converge]
codegen_collector      ← unchanged
    ↓
manager_agent review   ← unchanged
    ↓
test_orchestrator      ← unchanged (runs pytest on services/)
    ↓
completeness_checker   ← NEW: validates all required FileManifest entries present
    ↓
assembler              ← updated: merges scaffold_files + tf_files + code_files
```

---

## 7. New Nodes

### 7.1 `scaffold_node`

**File**: `backend/app/agents/agent3/nodes/scaffold_node.py`

**Inputs** (from AgentState): `services`, `connections`, `cloud_provider`, `language_overrides`
**Outputs** (to AgentState): `scaffold_files: dict[str, str]`, `file_manifest: list[FileManifestEntry]`

**Behaviour**:
1. Infer which CDK stacks are needed from `_STACK_ASSIGNMENT[service_type]`
2. Detect `has_frontend` (cloudfront or s3 in topology)
3. Detect `has_kinesis` (kinesis in topology)
4. Write all `[TEMPLATE]` files into `scaffold_files` using Jinja2 templates
5. Create `FileManifestEntry` for every expected file (template + LLM)
6. Emit `file_manifest` — this is the contract for completeness_checker

**Java decision logic** (deterministic — no LLM):
```python
JAVA_REQUIRED_SERVICES = {"kinesis_consumer", "kinesis_kcl"}
# If service_type in JAVA_REQUIRED_SERVICES → java
# All others → python (default) or language_overrides[service_id]
```

**Path convention change**: `services/{id}/handler.py` → `services/{id}/index.py`
Matches `PythonFunction` CDK construct default (`index='index.py'`).

### 7.2 `completeness_checker_node`

**File**: `backend/app/agents/agent3/nodes/completeness_checker.py`

**Behaviour**:
1. Read `file_manifest` from state
2. Read all `required=True` entries
3. Check each path exists in merged artifact keys (`scaffold_files` + `tf_files` + `code_files`)
4. If any missing → set `human_review_required=True`, list missing files in error message
5. If all present → set `current_phase = "assembly"`

### 7.3 `infra_codegen_worker` (CDK stack generation)

**File**: `backend/app/agents/agent3/nodes/infra_codegen_worker.py`

**Inputs**: task_group with `task_type = "infra_gen"`, full topology context, Terraform outputs (for cross-referencing)
**Behaviour**: LLM generates CDK TypeScript stack file. Uses `with_structured_output` to return `{"path": str, "content": str}`. Constrained output — no free-form file creation.

### 7.4 `frontend_codegen_worker`

**File**: `backend/app/agents/agent3/nodes/frontend_codegen_worker.py`

**Inputs**: topology services + API Gateway outputs + connections
**Behaviour**: LLM generates React components and App shell. Receives existing template scaffold as context (main.tsx, package.json already written). Fills only `llm_frontend` slots from manifest.

---

## 8. State Changes

Add to `AgentState` in `state.py`:

```python
scaffold_files: dict[str, str]          # template-written files from scaffold_node
file_manifest: list[FileManifestEntry]  # all expected files (template + LLM)
project_name: str                       # used for CDK project naming
```

Update `assembler_node` merge order:
```python
artifacts = {}
artifacts.update(state.get("scaffold_files") or {})   # templates first
artifacts.update(state.get("tf_files") or {})         # terraform
artifacts.update(state.get("code_files") or {})       # LLM-generated code
artifacts.update(state.get("test_files") or {})       # LLM-generated tests
```

---

## 9. Breaking Changes

| Change | Affected Files | Migration |
|--------|---------------|-----------|
| `services/{id}/handler.py` → `services/{id}/index.py` | `codegen_worker.py:153`, `orchestrator.py:159`, `test_generator.py`, `test_tools.py` | Global find-replace `handler.{ext}` → `index.{ext}` |
| `task_type` adds `"infra_gen"` and `"frontend_gen"` values | `state.py` TaskItem TypedDict, `manager_agent.py` task planner | Update TaskItem literal type |
| `AgentState` gains 3 new fields | `state.py` | Non-breaking additive change |
| `assembler_node` merges `scaffold_files` | `assembler.py` | Additive — no existing keys conflict |

---

## 10. Implementation Phases

### Phase 1 — Structural Foundation (scaffold + path rename)
1. Create `backend/app/agents/agent3/scaffold/` package:
   - `manifest.py` — `FileManifestEntry`, `FileManifest` TypedDicts
   - `templates.py` — all Jinja2 template rendering functions
   - `templates/` — Jinja2 `jinja2` files for each deterministic file
2. Create `nodes/scaffold_node.py`
3. Update `state.py` — add `scaffold_files`, `file_manifest`, `project_name`
4. Update `graph.py` — wire scaffold_node between parse_input and tf_generator
5. Update `assembler.py` — merge scaffold_files
6. Rename path convention: `handler.{ext}` → `index.{ext}` across all affected nodes

### Phase 2 — Completeness Enforcement
7. Create `nodes/completeness_checker.py`
8. Update `graph.py` — wire completeness_checker before assembler

### Phase 3 — CDK Infrastructure Codegen
9. Add `task_type = "infra_gen"` to `TaskItem` TypedDict
10. Update `manager_agent.py` planning mode to produce `infra_gen` tasks from manifest
11. Create `nodes/infra_codegen_worker.py`
12. Add CDK Jinja2 prompt templates in `prompts/templates/`
13. Wire `infra_codegen_worker` as parallel Send() branch

### Phase 4 — Frontend Codegen
14. Add `task_type = "frontend_gen"` to `TaskItem`
15. Create `nodes/frontend_codegen_worker.py`
16. Add frontend prompt templates
17. Wire `frontend_codegen_worker` as parallel Send() branch

---

## 11. Gotchas

- **Do NOT run `cdk init` via subprocess** — requires empty directory + npm install + Node.js on agent host. Generate CDK boilerplate files directly in Python.
- **Do NOT use `projen`** — it enforces that synthesized files cannot be manually edited, which breaks LLM fill-in.
- **`index.py` not `handler.py`** — CDK `PythonFunction` defaults to `entry/index.py:handler`. Use this convention everywhere.
- **Stack separation**: stateful (RDS, DynamoDB, S3) → `RETAIN` removal policy; stateless (Lambda, API GW) → `DESTROY` in dev. Never mix in one stack.
- **`cdk.context.json` must be committed** — it pins provider metadata for deterministic `cdk synth`. Add it to generated `.gitignore` exclusions list carefully (include it, not ignore it).
- **Scaffold node runs before tf_generator** — if tf_generator fails, scaffold files are already in state. The assembler will still output them. Treat scaffold output as always-succeeds.
