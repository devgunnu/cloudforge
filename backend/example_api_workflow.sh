#!/bin/bash
# Example: Multi-Choice Options Workflow with API Calls
# This demonstrates the full interaction flow with the CloudForge agent

echo "=========================================="
echo "CloudForge Multi-Choice Options Workflow"
echo "=========================================="
echo ""

# Step 1: Start a new workflow
echo "STEP 1: Start new workflow"
echo "POST /workflows/prd/start"
echo ""

START_RESPONSE=$(curl -s -X POST http://localhost:8000/workflows/prd/start \
  -H "Content-Type: application/json" \
  -d '{
    "prd_text": "Build a real-time fraud detection system that processes payment transactions across multiple merchants",
    "cloud_provider": "aws"
  }')

SESSION_ID=$(echo $START_RESPONSE | jq -r '.session_id')
STATUS=$(echo $START_RESPONSE | jq -r '.status')

echo "Response:"
echo $START_RESPONSE | jq .
echo ""
echo "Session ID: $SESSION_ID"
echo "Status: $STATUS"
echo ""

if [ "$STATUS" != "needs_input" ]; then
  echo "❌ Expected status 'needs_input', got '$STATUS'"
  exit 1
fi

echo ""
echo "=========================================="
echo "STEP 2: Display questions with options"
echo "=========================================="
echo ""

QUESTIONS=$(echo $START_RESPONSE | jq '.questions_with_options')
echo "Available questions with options:"
echo $QUESTIONS | jq .
echo ""

# Parse and display in user-friendly format
echo "Questions for user:"
echo $QUESTIONS | jq -r '.[] | "\n\(.original_question)\n" + (.options | map("  [\(.value)] - \(.label)") | join("\n"))'
echo ""

# Step 2: User selects from predefined options
echo "=========================================="
echo "STEP 3: User selects 'medium' traffic option"
echo "=========================================="
echo ""

RESPOND_1=$(curl -s -X POST http://localhost:8000/workflows/prd/respond \
  -H "Content-Type: application/json" \
  -d "{
    \"session_id\": \"$SESSION_ID\",
    \"selected_option_answers\": {
      \"0\": \"medium_traffic_10k_100k\"
    }
  }")

echo "Response:"
echo $RESPOND_1 | jq .
STATUS=$(echo $RESPOND_1 | jq -r '.status')
echo ""

if [ "$STATUS" = "plan_ready" ]; then
  echo "✅ PRD generation complete!"
  echo ""
  echo "Final PRD:"
  echo $RESPOND_1 | jq '.plan_markdown'
  exit 0
fi

echo ""
echo "=========================================="
echo "STEP 4: User provides custom input"
echo "=========================================="
echo ""

RESPOND_2=$(curl -s -X POST http://localhost:8000/workflows/prd/respond \
  -H "Content-Type: application/json" \
  -d "{
    \"session_id\": \"$SESSION_ID\",
    \"selected_option_answers\": {
      \"1\": \"High-availability multi-region with HIPAA compliance required\"
    }
  }")

echo "Response:"
echo $RESPOND_2 | jq .
STATUS=$(echo $RESPOND_2 | jq -r '.status')
echo ""

if [ "$STATUS" = "plan_ready" ]; then
  echo "✅ PRD generation complete!"
  echo ""
  echo "Final PRD:"
  echo $RESPOND_2 | jq '.plan_markdown'
else
  echo "Status: $STATUS (Still needs more clarifications)"
fi

echo ""
echo "=========================================="
echo "Optional: Accept the generated PRD"
echo "=========================================="
echo ""

ACCEPT_RESPONSE=$(curl -s -X POST http://localhost:8000/workflows/prd/accept \
  -H "Content-Type: application/json" \
  -d "{
    \"session_id\": \"$SESSION_ID\",
    \"accepted\": true,
    \"feedback\": \"\"
  }")

echo "Final acceptance response:"
echo $ACCEPT_RESPONSE | jq .
echo ""
echo "✅ Workflow complete!"
