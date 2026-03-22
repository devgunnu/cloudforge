# CloudForge

**Visual AWS infrastructure builder powered by a multi-agent AI pipeline.**

Describe what you want to build in plain English → CloudForge plans your architecture, generates production-grade Terraform + application code, and provisions real AWS resources — all in a single guided workflow.

---

## What it does

CloudForge turns a product description into a running AWS deployment through four stages:

1. **Requirements** — Paste a PRD. Agent 1 (LangGraph + Ollama) asks clarifying questions (traffic patterns, compliance, availability targets), surfaces them as constraint chips, and produces a structured JSON requirements document.
2. **Architecture** — Agent 2 (7-node LangGraph graph) designs an AWS service topology: runs load simulation, failure-mode analysis, compliance mapping, and automated rule-based tests (SPOF detection, cascade risks, latency checks). Pauses for human review before proceeding.
3. **Build** — Agent 3 (multi-subgraph LangGraph) generates Terraform HCL files + application code for every service in the topology. Runs TFLint, Checkov, and TypeScript/Python validation in a retry loop (up to 3 retries per file).
4. **Deploy** — Provisions real AWS resources via CloudFormation. Streams per-resource status events live to the UI. Supports rollback.

---

## Architecture overview

```
┌─────────────────────────────────────────────────────────────┐
│                      Next.js 15 Frontend                     │
│  ┌─────────────┐  ┌───────────────┐  ┌──────────────────┐  │
│  │ Requirements│  │  Architecture │  │  Build + Deploy  │  │
│  │    Panel    │  │    Panel      │  │     Panels       │  │
│  └──────┬──────┘  └──────┬────────┘  └────────┬─────────┘  │
│         │ SSE stream      │ SSE stream          │ SSE stream  │
└─────────┼─────────────────┼─────────────────────┼────────────┘
          │                 │                     │
┌─────────▼─────────────────▼─────────────────────▼────────────┐
│                    FastAPI Backend                             │
│  /workflows/prd/v2   /workflows/architecture/v2   /workflows/build   /workflows/deploy  │
│  ┌───────────┐  ┌──────────────────────┐  ┌──────────────┐  │
│  │  Agent 1  │  │      Agent 2         │  │   Agent 3    │  │
│  │ LangGraph │  │    LangGraph         │  │  LangGraph   │  │
│  │ (Ollama)  │  │  (Claude Sonnet)     │  │  (Claude)    │  │
│  └─────┬─────┘  └──────────┬───────────┘  └──────┬───────┘  │
│        │                   │                      │          │
│  ┌─────▼───────────────────▼──────────────────────▼──────┐  │
│  │                    MongoDB (Motor async)                │  │
│  │  users · projects · prd_conversations                  │  │
│  │  architectures · builds · deployments                  │  │
│  └────────────────────────────────────────────────────────┘  │
│                    ↕ Boto3 / CloudFormation                   │
└───────────────────────────────────────────────────────────────┘
                              ↕
                        AWS Cloud
```

---

## Tech stack

### Frontend

| Layer | Technology |
|-------|------------|
| Framework | Next.js 15 (App Router), React 19, TypeScript strict |
| Canvas | `@xyflow/react` v12 (interactive service graph) |
| State | Zustand v5 with persist middleware |
| Animations | Framer Motion v11 |
| Styling | Tailwind CSS v4 + CSS custom properties |
| Icons | Lucide React |
| Auth tokens | JWT in localStorage (Zustand persist) |
| API layer | Native `fetch` + custom `streamSSE()` for SSE consumption |

### Backend

| Layer | Technology |
|-------|------------|
| Framework | FastAPI 0.135+ (Python 3.12+) |
| Database | MongoDB (Motor async driver) |
| Agent framework | LangGraph v1.1.3+ with subgraphs + interrupt API |
| LLM (local) | Ollama (`codeqwen:latest`) — Agent 1 requirements extraction |
| LLM (cloud) | Claude Sonnet via `langchain-anthropic` — architecture + code gen |
| IaC generation | Terraform HCL (main.tf, variables.tf, outputs.tf) |
| IaC validation | TFLint, Checkov (security/compliance), `terraform validate` |
| Code validation | `tsc`, JSON schema, Python AST checks |
| AWS SDK | Boto3 (credential verification, CloudFormation provisioning) |
| Auth | PyJWT, bcrypt, Fernet (AES) for credential encryption |
| Rate limiting | SlowAPI |
| Web search | DuckDuckGo (`duckduckgo-search`) |
| Package manager | `uv` (Python), `npm` (Node) |

---

## Agent system

### Agent 1 — Requirements Extraction

**Location:** `backend/app/agents/agent1/`

LangGraph `StateGraph` that turns a free-text PRD into a structured requirements document.

**State** (`AgentState`, Pydantic BaseModel):
- `prd_text`, `follow_up_questions`, `questions_with_options`
- `plan_markdown`, `plan_json` — final output
- `status`: `running | needs_input | plan_ready | accepted`
- `research_results`, `user_answers`

**Graph nodes:**
```
user_input → research → web_search → information_gate →
[if more info needed] → await_user (interrupt) → loop back
[if enough info]      → plan → acceptance
[if rejected]         → loop back to plan
```

**Multi-choice clarification:** Agent generates 2–4 predefined options per question (traffic tiers, compliance frameworks, availability SLAs). Last option always allows freeform custom input — similar to GitHub Copilot planning mode.

**Output:** `FinalPRDJson` with `functional_requirements`, `non_functional_requirements`, `proposed_cloud_services`, `architecture_decisions`.

---

### Agent 2 — Architecture Planner

**Location:** `backend/app/agents/architecture_planner/`

Seven-node LangGraph orchestration that designs, tests, and validates an AWS service topology.

**State** (`ArchitecturePlannerState`, TypedDict):
- `prd`, `budget`, `traffic`, `availability` — NFR inputs
- `architecture_diagram` — computed `ArchitectureDiagram` (nodes + connections)
- `nfr_document`, `component_responsibilities`
- `arch_test_passed`, `arch_test_violations`
- `user_accepted` — set by human review interrupt
- `accept_iteration_count` — auto-accepts after 3 iterations

**Sub-agents and what each does:**

| Sub-agent | Purpose |
|-----------|---------|
| `architecture_agent` | Generates initial service topology |
| `service_discovery_agent` | Maps PRD requirements → concrete AWS services |
| `arch_simulator` | Runs load simulation (throughput, concurrency) |
| `resilience_simulator` | Failure mode analysis (single-service failures, cascade paths) |
| `compliance_agent` | Maps NFRs (HIPAA, SOC2, etc.) to architecture decisions |
| `arch_test_agent` | Rule-based validation: SPOF detection, cascade risk, latency budget |
| `present_architecture_node` | Fires `interrupt()` — pauses graph for human review |

**Graph flow:**
```
START → architecture → service_discovery → arch_simulator →
resilience_simulator → compliance → arch_test →
  [CRITICAL violations, iteration < 3] → architecture (retry)
  [passed OR max iterations] → present_architecture (human interrupt)
  [user_accepted=true] → END
```

**Rule engine** (`analysis/arch_rules.py`): Deterministic checks — SPOF identification, cascade blast radius, latency budget validation, over-provisioning detection.

---

### Agent 3 — Code & Terraform Generator

**Location:** `backend/app/agents/agent3/`

Multi-subgraph LangGraph that generates all infrastructure and application code for a given topology.

**State** (`AgentState`, TypedDict):
- `services`, `connections` — parsed AWS topology
- `tf_files` — generated Terraform HCL (`dict[path → content]`)
- `task_list` — per-service code generation tasks
- `code_files`, `test_files` — generated application code
- `artifacts` — final output bundle
- `current_phase`: `parsing → tf_generation → tf_validation → orchestration → assembly → done`

**Main nodes:**

| Node | Purpose |
|------|---------|
| `parse_input` | Normalise input (JSON/YAML topology) |
| `tf_generator` | Generate Terraform HCL via Claude |
| `tf_validation_loop` | **Subgraph** — runs `terraform fmt/validate`, TFLint, Checkov; retries up to 3× |
| `orchestrator` | **Subgraph** — code_generation_loop per service (max 10 iterations) |
| `assembler` | Bundle all artifacts into final output dict |
| `error_handler` | Capture and surface failures |

**Subgraphs:**
- `tf_validation_loop` — Parallel validators, error extraction, LLM-driven fix, re-validate
- `code_generation_loop` — Per task: `parse_input → code_generator → code_validator → test_generator → code_fixer → assembler`

**Generated artifacts per service:**
- `main.tf`, `variables.tf`, `outputs.tf`
- Application code (Python/TypeScript based on service type)
- Unit test files

---

## Database schema (MongoDB)

| Collection | Key fields |
|-----------|-----------|
| `users` | `email` (unique), `username` (unique), `hashed_password`, `github_token_encrypted`, `created_at` |
| `projects` | `owner_id`, `name`, `stage`, `status`, `prd_session_id`, `arch_session_id`, `build_id`, `deployment_id`, `cloud_credentials_encrypted` |
| `prd_conversations` | `session_id` (unique), `project_id`, `status`, `plan_markdown`, `plan_json`, `messages[]` |
| `architectures` | `session_id` (unique), `project_id`, `architecture_diagram`, `arch_test_passed`, `arch_test_violations[]` |
| `builds` | `project_id`, `status` (`running|complete`), `artifacts{}`, `generated_files[]` |
| `deployments` | `project_id`, `build_id`, `status`, `log_lines[]`, `resource_statuses{}`, `stack_outputs{}` |

**Indexes** (compound where appropriate):
- `users.email` (unique), `users.username` (unique)
- `prd_conversations.session_id` (unique), `(project_id, created_at)`
- `architectures.session_id` (unique), `(project_id, created_at DESC)`
- `builds.(project_id, created_at)`, `builds.(project_id, status)`
- `deployments.(project_id, created_at)`

---

## API endpoints

| Method | Path | Purpose |
|--------|------|---------|
| `POST` | `/auth/register` | Register (rate-limited: 5/min) |
| `POST` | `/auth/login` | Login, returns access + refresh tokens |
| `POST` | `/auth/refresh` | Refresh access token (10/min) |
| `GET` | `/auth/me` | Current user profile |
| `GET` | `/auth/github/login` | GitHub OAuth initiation |
| `GET` | `/auth/github/callback` | GitHub OAuth callback |
| `POST` | `/projects/` | Create project |
| `GET` | `/projects/` | List user's projects |
| `GET/PUT/DELETE` | `/projects/{id}` | Project CRUD |
| `PUT` | `/projects/{id}/cloud-credentials` | Store encrypted AWS credentials |
| `POST` | `/workflows/prd/v2/start/{project_id}` | **SSE** — Run Agent 1 |
| `POST` | `/workflows/prd/v2/respond/{project_id}` | Submit clarification answers |
| `POST` | `/workflows/prd/v2/accept/{project_id}` | Accept/reject PRD plan |
| `POST` | `/workflows/architecture/v2/start/{project_id}` | **SSE** — Run Agent 2 |
| `POST` | `/workflows/architecture/v2/accept/{project_id}` | Accept architecture (resume interrupt) |
| `POST` | `/workflows/build/start/{project_id}` | **SSE** — Run Agent 3 |
| `POST` | `/workflows/deploy/start/{project_id}` | **SSE** — Deploy via CloudFormation |
| `POST` | `/workflows/deploy/{deployment_id}/rollback` | Rollback deployment |
| `GET` | `/files/{project_id}` | List generated files |
| `GET/PUT` | `/files/{project_id}/content` | Read / write file content |
| `GET` | `/history/builds` | Build history |
| `GET` | `/history/deployments` | Deployment history |
| `POST` | `/workflows/validate` | Deterministic architecture validation (no LLM) |
| `GET` | `/health` | Health check |

---

## Authentication

- **Email/password**: bcrypt hashing, JWT access token (24h) + refresh token (30d)
- **GitHub OAuth**: Exchange code → GitHub token → create/link user → return JWT pair
- **Token refresh**: Frontend auto-detects 401, calls `/auth/refresh`, retries original request
- **Credential encryption**: AWS cloud credentials encrypted with Fernet (AES-128-CBC) before storing in MongoDB
- **Startup validation**: Server refuses to start if `JWT_SECRET_KEY` is `"changeme"` or `FERNET_KEY` is missing

---

## Frontend state management

### `forgeStore.ts`
Central Zustand store for the entire Forge workflow:
- Stage tracking (`activeStage`, `stageStatus` per stage: `locked | processing | done`)
- Per-stage chat history (`ForgeChatMessage[]`)
- Constraint chips from Agent 1, architecture diagram from Agent 2, generated files from Agent 3
- `hydrateProject(projectId)` — async fetch of all stage data from backend on project load
- `saveFile()` — PUT to `/files/{projectId}/content` with dirty-state tracking

### `canvasStore.ts`
React Flow canvas state:
- Nodes (AWS services) + edges (connections)
- `deployStatus` state machine: `idle → generating → deploying → live`
- `getTopology()` — exports `CloudForgeTopology` for Agent 3 input

### `forge-agents.ts`
Centralized API layer — all agent calls go here:
- `streamSSE(url, body, onEvent)` — generic SSE consumer with JSON event parsing
- `authHeaders()` + `refreshAccessToken()` — JWT lifecycle management
- `runAgent1/2/3()`, `runDeploy()` — stage-specific agent callers
- File CRUD: `getProjectFiles()`, `getFileContent()`, `saveFileContent()`

---

## Project structure

```
cloudforge/
├── frontend/
│   ├── src/
│   │   ├── app/
│   │   │   ├── (landing)/              # Marketing site
│   │   │   ├── (app)/
│   │   │   │   ├── dashboard/          # Project list
│   │   │   │   ├── history/            # Build + deployment history
│   │   │   │   ├── billing/            # Billing page
│   │   │   │   └── app/[id]/           # Per-project app shell
│   │   │   └── (auth)/
│   │   │       ├── login/              # Login page
│   │   │       ├── signup/             # Sign-up page
│   │   │       └── callback/           # GitHub OAuth callback
│   │   ├── components/
│   │   │   ├── forge/                  # Forge panel components
│   │   │   │   ├── ForgeChatPanel.tsx  # Chat + SSE event rendering
│   │   │   │   ├── RequirementsPanel.tsx
│   │   │   │   ├── ArchitecturePanel.tsx
│   │   │   │   ├── BuildPanel.tsx      # File list + editor
│   │   │   │   ├── DeployPanel.tsx     # Live log + resource status
│   │   │   │   ├── ForgeTopNav.tsx     # Stage nav + project switcher
│   │   │   │   ├── ForgeDeployModal.tsx
│   │   │   │   └── SuggestedCommands.tsx
│   │   │   ├── cloudforge/
│   │   │   │   ├── AppSidebar.tsx
│   │   │   │   └── ArchDiagram.tsx     # Architecture diagram renderer
│   │   │   └── landing/                # Landing page sections
│   │   ├── store/
│   │   │   ├── forgeStore.ts           # Main workflow state
│   │   │   ├── canvasStore.ts          # React Flow canvas state
│   │   │   ├── projectStore.ts         # Project list management
│   │   │   └── authStore.ts            # Auth token storage
│   │   └── lib/
│   │       ├── forge-agents.ts         # All API calls + SSE streaming
│   │       └── aws-icons.ts            # AWS service icon mapping
│   └── public/                         # AWS service icons (PNG)
└── backend/
    └── app/
        ├── agents/
        │   ├── agent1/                 # Requirements extraction (Ollama)
        │   ├── agent3/                 # Code + Terraform generation (Claude)
        │   │   ├── nodes/              # Individual graph nodes
        │   │   ├── subgraphs/          # tf_validation_loop, code_generation_loop
        │   │   ├── prompts/            # Jinja2 prompt templates
        │   │   └── tools/              # terraform, tflint, checkov, tsc wrappers
        │   └── architecture_planner/   # Architecture planning (Claude)
        │       ├── analysis/           # Deterministic rule engine
        │       └── prompts/            # Jinja2 prompt templates
        ├── routers/                    # FastAPI routers (one per domain)
        ├── schemas/                    # Pydantic request/response models
        ├── db/
        │   ├── mongo.py                # MongoDB connection + collection accessors
        │   └── encryption.py           # Fernet encrypt/decrypt
        ├── core/
        │   ├── security.py             # JWT creation/validation, bcrypt
        │   └── dependencies.py         # FastAPI get_current_user dependency
        ├── providers/
        │   ├── base.py                 # Cloud provider base class
        │   ├── aws.py                  # Boto3 + CloudFormation provisioning
        │   └── factory.py              # Provider factory (AWS / GCP / Azure)
        ├── services/
        │   ├── github.py               # GitHub OAuth + API integration
        │   └── arch_sessions.py        # Architecture session helpers
        └── config.py                   # Settings (env vars, validated at startup)
```

---

## Environment variables

```bash
# Required
JWT_SECRET_KEY=<random 32+ char string>
FERNET_KEY=<base64-encoded Fernet key>

# MongoDB
MONGODB_URL=mongodb://localhost:27017
MONGODB_DB_NAME=cloudforge

# Local LLM (Agent 1)
OLLAMA_BASE_URL=http://localhost:11434
QWEN_MODEL=codeqwen:latest
LLM_TEMPERATURE=0.2
LLM_TIMEOUT_SECONDS=90

# GitHub OAuth (optional)
GITHUB_CLIENT_ID=
GITHUB_CLIENT_SECRET=

# Feature flags
ENABLE_WEB_SEARCH=true
MAX_CLARIFICATION_ROUNDS=3
```

---

## Local development

### Backend

```bash
cd backend

# Install dependencies
uv sync

# Start MongoDB (or use Atlas)
mongod --dbpath ./data

# Start Ollama + pull model (for Agent 1)
ollama pull codeqwen:latest
ollama serve

# Run API
uv run uvicorn app.main:app --reload --port 8000
```

### Frontend

```bash
cd frontend
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

---

## SSE streaming protocol

All long-running agent workflows stream Server-Sent Events. Event shapes:

```json
// Agent 1 — constraint chip
{"type": "constraint", "chip": {"id": "...", "label": "...", "category": "..."}}

// Agent 1 — needs clarification
{"type": "needs_input", "questions_with_options": [...]}

// Agent 2 — architecture ready
{"type": "complete", "architecture_diagram": {"nodes": [...], "connections": [...]}}

// Agent 2 — human review interrupt
{"type": "interrupt", "message": "Review the proposed architecture"}

// Agent 3 — file generated
{"type": "file", "path": "main.tf", "content": "...", "language": "hcl"}

// Agent 3 — progress update
{"type": "progress", "current": 4, "total": 12, "phase": "tf_validation"}

// Deploy — log line
{"type": "log", "line": "Creating stack cloudforge-abc12345..."}

// Deploy — resource status
{"type": "node_status", "nodeId": "lambda-1", "status": "live"}

// Any — error
{"type": "error", "message": "..."}
```

---

## IaC validation pipeline (Agent 3)

Every generated Terraform file goes through this chain before being accepted:

```
terraform fmt     →  format HCL
terraform validate →  syntax + provider checks
tflint            →  linting (best practices, deprecated attrs)
checkov           →  security / compliance (CIS AWS Benchmark)
  ↓ if any errors
[LLM fix attempt] →  Claude re-generates with error context
  ↓ up to 3 retries
[human_review_required flag if still failing]
```

Application code (TypeScript/Python) goes through a separate loop:
```
tsc --noEmit      →  TypeScript type checking
AST validation    →  syntax checks
[test generation] →  unit tests generated alongside source
```

---

## Cloud provider abstraction

```python
# factory.py
provider = get_provider("aws", credentials)
provider.deploy(topology)     # → CloudFormation
provider.verify_credentials() # → STS GetCallerIdentity
provider.rollback(stack_id)   # → CloudFormation DeleteStack
```

AWS credentials are encrypted with Fernet before storage and decrypted only at deploy time.

---

## Key design decisions

| Decision | Rationale |
|----------|-----------|
| LangGraph for all agents | Native subgraph support, `interrupt()` API for human-in-the-loop, built-in state persistence |
| SSE over WebSockets | Simpler server implementation; agent workflows are unidirectional (server → client) |
| Separate LLMs per agent | Ollama (local, fast) for requirements; Claude Sonnet (powerful) for Terraform + code gen |
| MongoDB over relational DB | Schema flexibility during rapid iteration; BSON natively stores agent state dicts |
| Zustand over Redux | Minimal boilerplate; `persist` middleware handles auth token storage without extra config |
| Fernet for credential storage | Symmetric encryption is sufficient; keys never leave the server environment |
| Factory pattern for cloud providers | AWS-first now, clean extension point for GCP/Azure without touching agent code |
