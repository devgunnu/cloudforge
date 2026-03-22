# Multi-Choice Options Feature Guide

## Overview

The agent now provides **multiple-choice options** (similar to GitHub Copilot Chat in planning mode) when asking clarifying questions about your product requirements. Users can either:

1. **Select from predefined options** (e.g., "Light traffic", "Medium traffic", "Heavy traffic")
2. **Provide custom input** as the final option (e.g., "Bursty pattern with 300k req/min peaks")

If a user provides an answer irrelevant to the question, the agent will ask more clarifying questions in the next iteration.

---

## How It Works

### 1. Agent Generates Options

When the agent needs clarification, it generates questions with concrete predefined options:

```
Question 1: What is the expected peak traffic pattern?
  [0] - Light (1K-10K req/min)
  [1] - Medium (10K-100K req/min)
  [2] - Heavy (>100K req/min)
  [3] - Custom input: (you can type your own answer)
```

The **Custom** option (last one) always allows freeform text input for users to express unique requirements.

### 2. User Selection Options

Users can respond in several ways:

- **Select by index**: `"0"` → Use "Light (1K-10K req/min)"
- **Select by index**: `"2"` → Use "Heavy (>100K req/min)"
- **Custom input**: `"Highly variable: 50k baseline, 500k spikes during sales"` → Use freeform answer

### 3. Agent Processes Response

- **Valid option selected**: Option label is appended to user_answers
- **Custom input**: Freeform text is appended as-is
- **Irrelevant response**: Agent detects mismatch and asks clarifying questions again

---

## API Usage

### Starting a Workflow

```bash
POST /workflows/prd/start
{
  "prd_text": "Build a multi-tenant SaaS analytics platform",
  "cloud_provider": "aws"
}

Response:
{
  "session_id": "abc-123",
  "status": "needs_input",
  "questions_with_options": [
    {
      "question": "What is the expected peak traffic?",
      "original_question": "What is the expected peak traffic?",
      "options": [
        {
          "label": "Light (1K-10K req/min)",
          "value": "light_traffic_1k_10k",
          "is_custom": false
        },
        {
          "label": "Custom",
          "value": "custom",
          "is_custom": true
        }
      ]
    }
  ],
  "follow_up_questions": ["What is the expected peak traffic?"],
  "plan_markdown": null,
  "errors": []
}
```

### Responding with Option Selection

#### Option 1: Select Predefined Option (by index)

```bash
POST /workflows/prd/respond
{
  "session_id": "abc-123",
  "selected_option_answers": {
    0: "light_traffic_1k_10k"
  }
}
```

#### Option 2: Provide Custom Input

```bash
POST /workflows/prd/respond
{
  "session_id": "abc-123",
  "selected_option_answers": {
    0: "Highly variable pattern: baseline 50k req/min, peaks to 300k during campaigns"
  }
}
```

#### Option 3: Mix of Predefined and Custom

```bash
POST /workflows/prd/respond
{
  "session_id": "abc-123",
  "selected_option_answers": {
    0: "medium_traffic_10k_100k",  # Predefined option
    1: "HIPAA and SOC2 compliance required, PII encryption mandatory"  # Custom answer
  },
  "answers": [
    "Additional clarification in natural language if needed"
  ]
}
```

---

## Standalone Test Example

Run the test to see options in action:

```bash
cd backend
python3 -m app.agents.agent1.standalone_smoke_test
```

The test demonstrates three cloud provider scenarios with multi-choice option handling:
- **AWS Streaming Commerce**: Traffic scaling options
- **Azure Claims Processing**: Availability & compliance options
- **GCP IoT Fleet**: Ingestion pattern & security options

---

## Example Q&A Flow

### Round 1:

**Agent:** "What is the expected peak traffic pattern?"

```
  [0] - Light (1K-10K req/min)
  [1] - Medium (10K-100K req/min)
  [2] - Heavy (>100K req/min)
  [3] - Custom input
```

**User:** `"1"` → Selects "Medium"

**Agent adds to clarifications:** "Medium (10K-100K req/min)"

### Round 2:

**Agent:** "What compliance requirements apply?"

```
  [0] - SOC2 Type II
  [1] - HIPAA with encryption
  [2] - GDPR only
  [3] - Custom input
```

**User:** `"HIPAA, SOC2, and ISO 27001 certification required"` → Custom input

**Agent adds to clarifications:** "HIPAA, SOC2, and ISO 27001 certification required"

### Round 3:

**Agent:** "What is the geographic distribution strategy?"

```
  [0] - Single region (US East)
  [1] - Multi-region active-active
  [2] - Primary + DR standby
  [3] - Custom input
```

**User:** `"0"` → Selects single region

**Agent continues refinement...**

---

## Validation & Handling

### Valid Responses:
- ✅ Selecting by index (0, 1, 2, 3)
- ✅ Custom freeform text for any question
- ✅ Selecting option that matches to natural language

### Invalid/Irrelevant Responses:
- ❌ "Hello" when asked about traffic patterns → Agent re-asks with clarifications
- ❌ Out-of-range index (e.g., "5" when only 4 options exist) → Error message + re-ask
- ❌ Complete non-sequiturs → Agent detects and loops back

---

## Development Notes

### Key Files:

1. **state.py**: Defines `QuestionOption`, `QuestionWithOptions`, `ClarifierOutput`
2. **prompts.py**: CLARIFIER_PROMPT requests LLM to generate options
3. **nodes.py**: `information_gate_node` converts selections to user answers
4. **standalone_smoke_test.py**: UI for displaying options and gathering answers
5. **schemas/workflow.py**: API request/response schemas with options
6. **routers/workflows.py**: FastAPI endpoints handling option selection

### LLM Prompt Structure:

The clarifier prompt instructs the LLM to return:

```json
{
  "is_information_enough": boolean,
  "follow_up_questions": ["q1", "q2"],
  "questions_with_options": [
    {
      "question": "...",
      "original_question": "...",
      "options": [
        {"label": "option 1", "value": "value1", "is_custom": false},
        {"label": "Custom", "value": "custom", "is_custom": true}
      ]
    }
  ],
  "research_queries": ["query1", "query2"]
}
```

---

## Benefits

| Feature | Benefit |
|---------|---------|
| **Predefined Options** | Guides users toward standard architectural patterns |
| **Custom Option** | Allows expression of unique/atypical requirements |
| **Multiple Rounds** | Iteratively refines understanding without batch input |
| **Option Validation** | Reduces invalid/off-topic responses |
| **LLM Grounding** | Agent generates contextually relevant options |

---

## Future Enhancements

- [ ] Smart filtering: Hide irrelevant options based on cloud provider
- [ ] Dependent options: "If traffic is Heavy, then do you need auto-scaling?" 
- [ ] Option analytics: Track which options users select (A/B testing)
- [ ] Confidence scoring: LLM rates confidence in recommended options
- [ ] Option explanations: Hover-text explaining why each option is offered
