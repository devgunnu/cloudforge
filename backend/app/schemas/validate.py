from __future__ import annotations
from typing import Any
from pydantic import BaseModel, Field


class ValidateRequest(BaseModel):
    architecture_diagram: dict[str, Any]
    budget: str = ""
    traffic: str = ""
    availability: str = ""


class RequestPathResult(BaseModel):
    path: list[str]
    hops: list[dict[str, Any]]
    total_p50_ms: int
    total_p99_ms: int
    dominant_service: str
    hop_count: int


class SpofResult(BaseModel):
    node_id: str
    service: str
    reason: str
    severity: str
    recommendation: str


class CascadeRiskResult(BaseModel):
    source_id: str
    source_service: str
    chain: list[str]
    chain_services: list[str]
    length: int
    severity: str
    has_queue_breaker: bool


class ValidationSummary(BaseModel):
    node_count: int
    connection_count: int
    spof_count: int
    critical_spof_count: int
    cascade_risk_count: int
    high_cascade_count: int
    max_path_p50_ms: int
    max_path_p99_ms: int


class ValidateResponse(BaseModel):
    request_paths: list[RequestPathResult]
    spofs: list[SpofResult]
    cascade_risks: list[CascadeRiskResult]
    summary: ValidationSummary
