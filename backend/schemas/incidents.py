"""Schemas for reporter incident submissions."""

from datetime import datetime
from typing import Literal

from pydantic import BaseModel, Field


IncidentSeverity = Literal["LOW", "MEDIUM", "HIGH", "SEVERE", "CRITICAL"]


class IncidentCreate(BaseModel):
    """Fields submitted by a reporter when creating an incident."""

    title: str = Field(min_length=1, max_length=50)
    description: str = Field(min_length=1, max_length=500)
    severity: IncidentSeverity
    location: str = Field(min_length=1, max_length=255)


class IncidentSubmitted(BaseModel):
    """Response returned after a successful incident insert."""

    success: bool = True


class IncidentSummary(BaseModel):
    """Incident fields needed by the reporter dashboard."""

    incident_reference: str
    title: str
    description: str
    severity: IncidentSeverity
    location: str
    status: str
    created_at: datetime
    updated_at: datetime
    resolved_at: datetime | None = None
