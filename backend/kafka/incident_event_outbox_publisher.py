"""Publish unpublished incident outbox rows to Kafka."""

from collections.abc import Mapping
from typing import Any

from sqlalchemy import text
from sqlalchemy.orm import Session

from backend.kafka.incident_event_producer import IncidentEventProducer


GET_UNPUBLISHED_INCIDENT_EVENTS_QUERY = text(
    """
    SELECT
        event_id,
        incident_id,
        event_type,
        actor_id,
        actor_role,
        event_data,
        occurred_at
    FROM public.incident_events
    WHERE published_at IS NULL
    ORDER BY occurred_at, id
    LIMIT :batch_size
    """
)

MARK_INCIDENT_EVENT_ATTEMPTED_QUERY = text(
    """
    UPDATE public.incident_events
    SET publish_attempts = publish_attempts + 1,
        publish_error = NULL
    WHERE event_id = :event_id
      AND published_at IS NULL
    """
)

MARK_INCIDENT_EVENT_PUBLISHED_QUERY = text(
    """
    UPDATE public.incident_events
    SET published_at = now(),
        publish_error = NULL
    WHERE event_id = :event_id
      AND published_at IS NULL
    """
)

RECORD_INCIDENT_EVENT_PUBLISH_ERROR_QUERY = text(
    """
    UPDATE public.incident_events
    SET publish_error = :publish_error
    WHERE event_id = :event_id
      AND published_at IS NULL
    """
)


def get_unpublished_incident_events(
    db: Session,
    batch_size: int = 100,
) -> list[Mapping[str, Any]]:
    """Return the next unpublished outbox rows in occurrence order."""

    return db.execute(
        GET_UNPUBLISHED_INCIDENT_EVENTS_QUERY,
        {"batch_size": batch_size},
    ).mappings().all()


def publish_unpublished_incident_events(
    db: Session,
    producer: IncidentEventProducer,
    batch_size: int = 100,
) -> int:
    """Publish one batch of outbox events and return the success count."""

    events = get_unpublished_incident_events(db, batch_size)
    published_count = 0

    for event in events:
        event_id = event["event_id"]

        try:
            db.execute(
                MARK_INCIDENT_EVENT_ATTEMPTED_QUERY,
                {"event_id": event_id},
            )
            db.commit()

            producer.publish(event)

            db.execute(
                MARK_INCIDENT_EVENT_PUBLISHED_QUERY,
                {"event_id": event_id},
            )
            db.commit()
            published_count += 1
        except Exception as error:
            db.rollback()
            db.execute(
                RECORD_INCIDENT_EVENT_PUBLISH_ERROR_QUERY,
                {
                    "event_id": event_id,
                    "publish_error": str(error),
                },
            )
            db.commit()

    return published_count
