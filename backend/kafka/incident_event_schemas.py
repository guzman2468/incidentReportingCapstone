"""Schemas for Kafka incident events published by the backend."""

from typing import Annotated, Literal, Union
from uuid import UUID

from pydantic import BaseModel, Field

from backend.schemas.incidents import IncidentSeverity
from backend.schemas.users import UserRole


IncidentEventType = Literal[
    "IncidentSubmitted",
    "IncidentAssigned",
    "IncidentUpdated",
]

IncidentStatus = Literal[
    "NEW",
    "ASSIGNED",
    "IN_PROGRESS",
    "RESOLVED",
    "CLOSED",
    "CANCELLED",
]


class IncidentSubmittedEventData(BaseModel):
    """Incident data published after a reporter submits an incident."""

    incident_reference: str
    title: str
    description: str
    severity: IncidentSeverity
    location: str
    status: Literal["NEW"]


class IncidentAssignedEventData(BaseModel):
    """Assignment data published after an incident is assigned to a team."""

    incident_reference: str
    aid_provider_id: UUID
    team_id: UUID
    status: Literal["ASSIGNED"]


class IncidentUpdatedEventData(BaseModel):
    """Status transition data published after an incident is updated."""

    incident_reference: str
    old_status: IncidentStatus
    new_status: IncidentStatus


class IncidentSubmittedEvent(BaseModel):
    """Kafka event emitted after a new incident is committed."""

    incident_id: UUID
    event_type: Literal["IncidentSubmitted"]
    actor_id: UUID | None = None
    actor_role: UserRole | None = None
    event_data: IncidentSubmittedEventData


class IncidentAssignedEvent(BaseModel):
    """Kafka event emitted after an incident assignment is committed."""

    incident_id: UUID
    event_type: Literal["IncidentAssigned"]
    actor_id: UUID | None = None
    actor_role: UserRole | None = None
    event_data: IncidentAssignedEventData


class IncidentUpdatedEvent(BaseModel):
    """Kafka event emitted after an incident status update is committed."""

    incident_id: UUID
    event_type: Literal["IncidentUpdated"]
    actor_id: UUID | None = None
    actor_role: UserRole | None = None
    event_data: IncidentUpdatedEventData


IncidentEvent = Annotated[
    Union[
        IncidentSubmittedEvent,
        IncidentAssignedEvent,
        IncidentUpdatedEvent,
    ],
    Field(discriminator="event_type"),
]
