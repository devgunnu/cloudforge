# CloudForge

![Python](https://img.shields.io/badge/Python-3.12+-blue?logo=python&logoColor=white)
![FastAPI](https://img.shields.io/badge/FastAPI-0.135+-009688?logo=fastapi&logoColor=white)
![Next.js](https://img.shields.io/badge/Next.js-15-black?logo=next.js&logoColor=white)
![LangGraph](https://img.shields.io/badge/LangGraph-1.1+-orange)
![Terraform](https://img.shields.io/badge/Terraform-IaC-7B42BC?logo=terraform&logoColor=white)
![AWS](https://img.shields.io/badge/AWS-CloudFormation-FF9900?logo=amazon-aws&logoColor=white)
![MongoDB](https://img.shields.io/badge/MongoDB-Motor-47A248?logo=mongodb&logoColor=white)

**Knowledge-graph-driven AWS infrastructure builder. Describe what you want to build — CloudForge derives the architecture from validated cloud patterns, generates production-grade Terraform, and provisions real resources with zero persistent cloud credentials.**

> Built for a hackathon. Shipped end-to-end

---

## How it actually works

Most "AI infrastructure" tools send your requirements to an LLM and hope the output is reasonable. CloudForge doesn't do that.

Architecture decisions are derived from a **knowledge graph of validated cloud patterns**. Your PRD is processed through a RAG pipeline — NFRs are extracted, relevant patterns are retrieved from the graph, ranked, and validated via graph traversal. The LLM is the **last step**: it explains a graph-derived answer. It never invents one.

---

## The pipeline

```
User PRD
  ↓
[Agent 1 — PRD Refinement]
  Extracts NFRs, asks clarifying questions (traffic tiers, compliance, SLAs)
  Multi-choice options + freeform input. Persists structured requirements JSON.
  ↓
[Agent 2 — Architecture Planner: 7-node LangGraph]
  RAG retrieval from knowledge graph of cloud patterns
  Graph community routing → Kuzu graph traversal → ranked pattern selection
  Load simulation, failure-mode analysis, compliance mapping
  Rule-based test suite (SPOF detection, cascade risk, latency budget)
  Human-in-the-loop interrupt before proceeding (uses LangGraph interrupt() API)
  LLM explains the graph-derived architecture — never generates it blindly
  ↓
[Agent 3 — Code & Terraform Generator: multi-subgraph LangGraph]
  Generates Terraform HCL (main.tf, variables.tf, outputs.tf) per service
  Generates application code (Python/TypeScript) per service
  Validation loop: terraform fmt → terraform validate → TFLint → Checkov
  LLM-driven fix loop (up to 3 retries per file)
  Subgraph: code_generation_loop → tsc/AST validation → test generation
  ↓
[Deploy — CloudFormation provisioning]
  Intermediate infrastructure representation → cloud-specific template render
  Temporary credentials via IAM role assumption (AWS STS AssumeRole)
  Streams per-resource events live via SSE
  Generated code committed directly to user's GitHub repo via GitHub App OAuth
```

---

## Core technical differentiators

### Knowledge graph + RAG architecture recommendations

Architecture decisions are never free-form LLM outputs. The system maintains a graph of validated cloud patterns. When a PRD comes in:

1. NFRs are extracted and embedded
2. Relevant patterns are retrieved from the graph based on semantic similarity to the NFR set
3. Graph traversal validates pattern compatibility (no conflicting services, no SPOF introduced, latency budget respected)
4. Only after graph validation does the LLM run — to explain the architecture in human language

The rule engine (`analysis/arch_rules.py`) runs deterministic checks: SPOF identification, cascade blast radius, latency budget, over-provisioning. These gates are not probabilistic.

### Multi-node agentic pipeline (LangGraph)

Five specialised agents, each with its own state, context, and tools:

| Agent | Role |
|-------|------|
| PRD Refinement | Extracts NFRs, disambiguates requirements via multi-choice Q&A |
| Service Discovery | Maps NFRs to concrete AWS services |
| Architecture Planner | Graph traversal + simulation |
| Resilience Simulator | Per-failure-mode blast radius analysis |
| Code Generator | Terraform HCL + application code with validation loops |

State is typed (Pydantic / TypedDict) and passed through the full pipeline. Each stage is persisted to MongoDB per session. No single monolithic prompt.

### Multi-cloud Terraform generation

Generated infrastructure is provider-agnostic by design. An intermediate infrastructure representation (topology graph) is built from the architecture recommendation. At deploy time this is rendered into cloud-specific Terraform templates.

Supports AWS today. Architected to extend to GCP and Azure without changing the generation pipeline — the `providers/factory.py` factory handles provider dispatch, and the agent pipeline never references AWS directly.

### Zero persistent cloud credentials

CloudForge never stores long-term cloud credentials.

- At deploy time, temporary credentials are obtained via **IAM role assumption** (AWS STS `AssumeRole`)
- Credentials that do need to be stored (for user-initiated deployments) are encrypted at rest with **Fernet (AES-128-CBC)** and decrypted only at deploy time
- All credentials are discarded after use — zero persistent access

### Real-time agentic streaming

Every agent stage streams output via **Server-Sent Events**. Users see PRD refinement, architecture reasoning, file-by-file code generation, and live deploy logs as they happen — not after.

```json
// NFR extracted
{"type": "constraint", "chip": {"label": "99.9% uptime", "category": "availability"}}

// Architecture derived from graph
{"type": "complete", "architecture_diagram": {"nodes": [...], "connections": [...]}}

// File generated
{"type": "file", "path": "main.tf", "content": "...", "language": "hcl"}

// Resource live
{"type": "node_status", "nodeId": "lambda-1", "status": "live"}
```

### GitHub-native code delivery

Generated scaffolds are committed directly to the user's own GitHub repository under their identity via **GitHub App OAuth**. No intermediary storage — code goes from generation straight into the user's repo.

---

## Tech stack

### Frontend

| | |
|--|--|
| Framework | Next.js 15 (App Router), React 19, TypeScript strict |
| Canvas | `@xyflow/react` v12 |
| State | Zustand v5 with persist middleware |
| Animations | Framer Motion v11 |
| Styling | Tailwind CSS v4 |
| API layer | Native `fetch` + custom `streamSSE()` for SSE |

### Backend

| | |
|--|--|
| Framework | FastAPI 0.135+ (Python 3.12+) |
| Database | MongoDB (Motor async driver) |
| Agent framework | LangGraph v1.1.3+ with subgraphs + `interrupt()` API |
| LLM (local) | Ollama (`codeqwen:latest`) — requirements extraction |
| LLM (cloud) | Claude Sonnet via `langchain-anthropic` — architecture + code |
| IaC validation | TFLint, Checkov (CIS AWS Benchmark), `terraform validate` |
| Cloud SDK | Boto3 (STS AssumeRole, CloudFormation) |
| Auth | PyJWT, bcrypt, Fernet encryption |

---

## Agent system

### Agent 1 — PRD Refinement

**State** (`AgentState`, Pydantic): `prd_text`, `follow_up_questions`, `questions_with_options`, `plan_markdown`, `plan_json`, `status`, `research_results`, `user_answers`

**Graph:**
```
user_input → research → web_search → information_gate →
  [needs clarification] → await_user (interrupt) → loop
  [enough info] → plan → acceptance → END
```

Multi-choice clarification: 2–4 predefined options per question (traffic tiers, compliance frameworks, availability SLAs) + freeform custom input. Selections are normalised to `user_answers` for next-iteration context.

---

### Agent 2 — Architecture Planner

**State** (`ArchitecturePlannerState`, TypedDict): `prd`, NFR fields, `architecture_diagram`, `arch_test_passed`, `arch_test_violations`, `user_accepted`, `accept_iteration_count`

**Graph:**
```
START → architecture → service_discovery → arch_simulator →
resilience_simulator → compliance → arch_test →
  [CRITICAL violations, iteration < 3] → architecture (retry)
  [passed OR max iterations] → present_architecture (human interrupt)
  [user_accepted] → END
```

Seven sub-agents: `architecture_agent`, `service_discovery_agent`, `arch_simulator`, `resilience_simulator`, `compliance_agent`, `arch_test_agent`, `present_architecture_node`.

---

### Agent 3 — Code & Terraform Generator

**State** (`AgentState`, TypedDict): `services`, `connections`, `tf_files`, `task_list`, `code_files`, `test_files`, `artifacts`, `current_phase`

**Phases:** `parsing → tf_generation → tf_validation → orchestration → assembly → done`

**Subgraphs:**
- `tf_validation_loop` — parallel validators, error extraction, LLM fix, re-validate (3 retries)
- `code_generation_loop` — per-service: generate → validate → test → fix

---

## API

All long-running workflows return SSE streams. Auth via Bearer JWT.

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/auth/register` | Register (5/min rate limit) |
| `POST` | `/auth/login` | Login → access + refresh tokens |
| `POST` | `/auth/refresh` | Refresh access token |
| `GET` | `/auth/github/login` | GitHub OAuth |
| `POST` | `/projects/` | Create project |
| `GET` | `/projects/` | List projects |
| `POST` | `/workflows/prd/v2/start/{id}` | **SSE** — Agent 1 |
| `POST` | `/workflows/prd/v2/respond/{id}` | Submit answers |
| `POST` | `/workflows/prd/v2/accept/{id}` | Accept PRD |
| `POST` | `/workflows/architecture/v2/start/{id}` | **SSE** — Agent 2 |
| `POST` | `/workflows/architecture/v2/accept/{id}` | Accept architecture |
| `POST` | `/workflows/build/start/{id}` | **SSE** — Agent 3 |
| `POST` | `/workflows/deploy/start/{id}` | **SSE** — Deploy |
| `POST` | `/workflows/deploy/{deployment_id}/rollback` | Rollback |
| `GET/PUT` | `/files/{project_id}/content` | Read / write generated files |
| `GET` | `/history/builds` | Build history |
| `GET` | `/history/deployments` | Deployment history |

---

## Database (MongoDB)

| Collection | Purpose |
|-----------|---------|
| `users` | Accounts — bcrypt passwords, encrypted GitHub tokens |
| `projects` | Project metadata, stage, encrypted cloud credentials |
| `prd_conversations` | Agent 1 sessions — full message history, plan JSON |
| `architectures` | Agent 2 sessions — diagram, test results, violations |
| `builds` | Agent 3 outputs — all generated artifacts |
| `deployments` | CloudFormation stacks — logs, resource statuses, outputs |

---

## Local setup

```bash
# Backend
cd backend
uv sync
ollama pull codeqwen:latest && ollama serve
uv run uvicorn app.main:app --reload --port 8000

# Frontend
cd frontend
npm install && npm run dev
```

Required env vars: `JWT_SECRET_KEY`, `FERNET_KEY`, `ANTHROPIC_API_KEY`. See `backend/.env.sample`.

---

## Security model

- JWT access tokens (24h) + refresh tokens (30d)
- bcrypt password hashing
- Fernet (AES-128-CBC) for cloud credential storage
- IAM role assumption — no persistent AWS access keys
- Rate limiting on all auth endpoints (SlowAPI)
- Server refuses to start with default `JWT_SECRET_KEY`
