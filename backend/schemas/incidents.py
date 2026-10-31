"""Schemas for reporter incident submissions."""

from datetime import datetime
from typing import Literal
from uuid import UUID

from pydantic import BaseModel, Field


IncidentSeverity = Literal["LOW", "MEDIUM", "HIGH", "SEVERE", "CRITICAL"]
TeamIncidentStatus = Literal[
    "IN_PROGRESS",
    "RESOLVED",
    "CLOSED",
    "CANCELLED",
]


class IncidentCreate(BaseModel):
    """Fields submitted by a reporter when creating an incident."""

    title: str = Field(min_length=1, max_length=50)
    description: str = Field(min_length=1, max_length=500)
    severity: IncidentSeverity
    location: str = Field(min_length=1, max_length=255)


class IncidentAssignmentCreate(BaseModel):
    """Fields required to assign an incident to an aid provider team."""

    incident_reference: str = Field(pattern=r"^INC-\d{5}$")
    aid_provider_id: UUID
    team_id: UUID


class IncidentStatusUpdate(BaseModel):
    """A status transition submitted by an aid provider team member."""

    status: TeamIncidentStatus


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
    assigned_at: datetime | None = None
    started_at: datetime | None = None
    resolved_at: datetime | None = None
    cancelled_at: datetime | None = None
    assigned_aid_provider_id: UUID | None = None
    assigned_team_id: UUID | None = None
    assigned_provider_name: str | None = None
    assigned_team_name: str | None = None
