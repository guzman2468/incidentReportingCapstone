"""Persistence helpers for transactional Kafka incident event outbox rows."""

from sqlalchemy import bindparam, text
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Session

from backend.kafka.incident_event_schemas import IncidentEvent


INSERT_INCIDENT_EVENT_QUERY = text(
    """
    INSERT INTO public.incident_events (
        incident_id,
        event_type,
        actor_id,
        actor_role,
        event_data
    )
    VALUES (
        :incident_id,
        :event_type,
        :actor_id,
        :actor_role,
        :event_data
    )
    """
).bindparams(bindparam("event_data", type_=JSONB))


def add_incident_event_to_outbox(
    db: Session,
    event: IncidentEvent,
) -> None:
    """Insert an event into the outbox without committing the transaction."""

    db.execute(
        INSERT_INCIDENT_EVENT_QUERY,
        {
            "incident_id": event.incident_id,
            "event_type": event.event_type,
            "actor_id": event.actor_id,
            "actor_role": event.actor_role,
            "event_data": event.event_data.model_dump(mode="json"),
        },
    )
