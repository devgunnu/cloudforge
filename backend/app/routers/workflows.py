from __future__ import annotations

from fastapi import APIRouter, HTTPException

from app.agents.agent1 import run_until_interrupt
from app.agents.agent1.state import AgentState
from app.schemas.workflow import (
    AcceptWorkflowRequest,
    RespondWorkflowRequest,
    StartWorkflowRequest,
    WorkflowResponse,
)
from app.services.workflow_sessions import session_store

router = APIRouter(prefix="/workflows/prd", tags=["workflows"])


def _to_response(state: AgentState) -> WorkflowResponse:
    status = state.status
    if status not in {"needs_input", "plan_ready", "accepted"}:
        status = "needs_input"
    
    # Convert questions_with_options to schema
    from app.schemas.workflow import QuestionWithOptionsSchema, QuestionOptionSchema
    questions_with_options = [
        QuestionWithOptionsSchema(
            question=q.question,
            original_question=q.original_question,
            options=[
                QuestionOptionSchema(
                    label=opt.label,
                    value=opt.value,
                    description=opt.description,
                    impact=opt.impact,
                    is_custom=opt.is_custom,
                )
                for opt in q.options
            ]
        )
        for q in state.questions_with_options
    ]
    
    return WorkflowResponse(
        session_id=state.session_id or "",
        status=status,
        follow_up_questions=state.follow_up_questions,
        questions_with_options=questions_with_options,
        plan_markdown=state.plan_markdown,
        plan_json=state.plan_json.model_dump(mode="json") if state.plan_json else None,
        errors=state.errors,
    )


@router.post("/start", response_model=WorkflowResponse)
def start_workflow(payload: StartWorkflowRequest) -> WorkflowResponse:
    initial_state = AgentState(
        cloud_provider=payload.cloud_provider.lower().strip(),
        prd_text=payload.prd_text,
        status="running",
    )
    raw_state = session_store.create(initial_state.as_graph_state())
    result = run_until_interrupt(raw_state)
    session_store.save(result.as_graph_state())
    return _to_response(result)


@router.post("/respond", response_model=WorkflowResponse)
def respond_workflow(payload: RespondWorkflowRequest) -> WorkflowResponse:
    state_data = session_store.get(payload.session_id)
    if not state_data:
        raise HTTPException(status_code=404, detail="Invalid session_id")

    state = AgentState.model_validate(state_data)
    state.user_answers = list(state.user_answers) + payload.answers
    state.selected_option_answers = payload.selected_option_answers
    state.accepted = None
    state.status = "running"

    result = run_until_interrupt(state)
    session_store.save(result.as_graph_state())
    return _to_response(result)


@router.post("/accept", response_model=WorkflowResponse)
def accept_workflow(payload: AcceptWorkflowRequest) -> WorkflowResponse:
    state_data = session_store.get(payload.session_id)
    if not state_data:
        raise HTTPException(status_code=404, detail="Invalid session_id")

    state = AgentState.model_validate(state_data)

    if payload.accepted and state.status != "plan_ready":
        raise HTTPException(
            status_code=409,
            detail="Plan is not ready yet. Continue clarification rounds before accepting.",
        )

    state.accepted = payload.accepted
    state.acceptance_feedback = payload.feedback or ""
    if payload.accepted:
        state.status = "accepted"
    else:
        state.status = "needs_input"
        question = "What should change in the plan before approval?"
        if payload.feedback:
            question = (
                "Please provide any additional constraints while revising this feedback: "
                f"{payload.feedback}"
            )
        state.follow_up_questions = [question]

    session_store.save(state.as_graph_state())
    return _to_response(state)
