# CloudForge Backend

FastAPI backend with a LangGraph-based multi-agent workflow in `app/agents/agent1`.

## What Was Added

- PRD refinement workflow powered by local Ollama + Qwen model.
- Optional web research via DuckDuckGo (`langchain-community`).
- **Multi-choice options** for user clarifications (like GitHub Copilot planning mode):
  - Agent generates 2-4 predefined options per question
  - Last option always allows custom user input
  - Supports mixed predefined + freeform responses
- Iterative API loop:
	- submit PRD
	- answer follow-up questions (with options)
	- accept/reject generated plan
- Final plan includes both markdown and structured JSON.

## Environment

Copy `.env.example` to `.env` and adjust values if needed.

Important settings:

- `OLLAMA_BASE_URL` (default: `http://localhost:11434`)
- `QWEN_MODEL` (default: `qwen3.5:latest`)
- `ENABLE_WEB_SEARCH` (`true`/`false`)
- `MAX_CLARIFICATION_ROUNDS`

## Run

Start Ollama and pull your model first:

```bash
ollama pull qwen3.5:latest
```

Install dependencies and run API:

```bash
uv sync
uv run python main.py
```

## Endpoints

- `POST /workflows/prd/start`
- `POST /workflows/prd/respond`
- `POST /workflows/prd/accept`

### 1) Start with PRD

```bash
curl -X POST http://localhost:8000/workflows/prd/start \
	-H "Content-Type: application/json" \
	-d '{
		"prd_text": "Build a SaaS image processing API on AWS with multi-tenant auth and audit logs.",
		"cloud_provider": "aws"
	}'
```

### 2) Respond to Questions (with Multi-Choice Options)

The agent generates questions with predefined options plus a custom input option.

**Option A: Select from predefined options**

```bash
curl -X POST http://localhost:8000/workflows/prd/respond \
	-H "Content-Type: application/json" \
	-d '{
		"session_id": "<session_id>",
		"selected_option_answers": {
			"0": "medium_traffic_10k_100k",
			"1": "soc2_compliance_required"
		}
	}'
```

**Option B: Provide custom input**

```bash
curl -X POST http://localhost:8000/workflows/prd/respond \
	-H "Content-Type: application/json" \
	-d '{
		"session_id": "<session_id>",
		"selected_option_answers": {
			"0": "Variable traffic: 50k baseline, 500k spikes during sales events",
			"1": "Custom: HIPAA + SOC2 + ISO 27001 certification required"
		}
	}'
```

**Option C: Mix freeform and predefined answers**

```bash
curl -X POST http://localhost:8000/workflows/prd/respond \
	-H "Content-Type: application/json" \
	-d '{
		"session_id": "<session_id>",
		"selected_option_answers": {
			"0": "light_traffic_1k_10k",
			"1": "Custom HIPAA and SOC2 with annual audits required"
		},
		"answers": [
			"Additional natural language clarifications if needed"
		]
	}'
```

**Response includes available options:**

```json
{
  "session_id": "abc-123",
  "status": "needs_input",
  "questions_with_options": [
    {
      "question": "What is the expected traffic pattern?",
      "original_question": "What is the expected traffic pattern?",
      "options": [
        {"label": "Light (1K-10K req/min)", "value": "light_traffic_1k_10k", "is_custom": false},
        {"label": "Medium (10K-100K req/min)", "value": "medium_traffic_10k_100k", "is_custom": false},
        {"label": "Heavy (>100K req/min)", "value": "heavy_traffic_100k_plus", "is_custom": false},
        {"label": "Custom", "value": "custom", "is_custom": true}
      ]
    }
  ],
  "follow_up_questions": ["What is the expected traffic pattern?"],
  "plan_markdown": null,
  "errors": []
}
```

### 3) Accept or Reject Plan

```bash
curl -X POST http://localhost:8000/workflows/prd/accept \
	-H "Content-Type: application/json" \
	-d '{
		"session_id": "<session_id>",
		"accepted": false,
		"feedback": "Add DR strategy with explicit RTO/RPO"
	}'
```

Set `accepted` to `true` to complete the flow.

## Multi-Choice Options Feature

Users can now interact with the agent via predefined options (like GitHub Copilot planning mode):

- Agent generates 2-4 contextual options per clarifying question
- Last option always allows **custom freeform input**
- Supports both selection (by value) and custom input
- Automatically converts selections to user_answers for iteration

See [MULTI_CHOICE_OPTIONS_GUIDE.md](./MULTI_CHOICE_OPTIONS_GUIDE.md) for comprehensive examples.

## Testing

**Standalone smoke test** (includes multi-choice option handling):

```bash
python3 -m app.agents.agent1.standalone_smoke_test
```

This runs three scenarios on different cloud providers with option selection.

**Quick validation** (tests options logic without LLM):

```bash
python3 test_options_logic.py
```

**Example API workflow** (bash script with curl):

```bash
bash example_api_workflow.sh
```
