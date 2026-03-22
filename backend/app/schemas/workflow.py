from __future__ import annotations

from typing import Any, Literal

from pydantic import BaseModel, Field


WorkflowStatus = Literal["needs_input", "plan_ready", "accepted"]


class QuestionOptionSchema(BaseModel):
    """Schema for a single option in a clarifying question."""
    label: str
    value: str
    is_custom: bool = False


class QuestionWithOptionsSchema(BaseModel):
    """Schema for a clarifying question with multiple-choice options."""
    question: str
    options: list[QuestionOptionSchema] = Field(default_factory=list)
    original_question: str


class StartWorkflowRequest(BaseModel):
    prd_text: str = Field(min_length=20)
    cloud_provider: str = Field(default="aws")


class RespondWorkflowRequest(BaseModel):
    session_id: str
    answers: list[str] = Field(default_factory=list)
    selected_option_answers: dict[int, str] = Field(
        default_factory=dict,
        description="Map of question index to selected option value"
    )


class AcceptWorkflowRequest(BaseModel):
    session_id: str
    accepted: bool
    feedback: str | None = None


class WorkflowResponse(BaseModel):
    session_id: str
    status: WorkflowStatus
    follow_up_questions: list[str] = Field(default_factory=list)
    questions_with_options: list[QuestionWithOptionsSchema] = Field(default_factory=list)
    plan_markdown: str | None = None
    plan_json: dict[str, Any] | None = None
    errors: list[str] = Field(default_factory=list)
