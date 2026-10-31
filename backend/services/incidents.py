import re

from sqlalchemy import text
from sqlalchemy.orm import Session

from backend.kafka.incident_event_outbox import add_incident_event_to_outbox
from backend.kafka.incident_event_schemas import (
    IncidentAssignedEvent,
    IncidentAssignedEventData,
    IncidentSubmittedEvent,
    IncidentSubmittedEventData,
    IncidentUpdatedEvent,
    IncidentUpdatedEventData,
)
from backend.schemas.incidents import IncidentCreate

GET_ACTIVE_REPORTER_ID_QUERY = text(
    """
    SELECT id
    FROM public.users
    WHERE email = :email
      AND role = 'REPORTER'
      AND is_active = true
    """
)

CREATE_INCIDENT_QUERY = text(
    """
    INSERT INTO public.incidents (
        reporter_id,
        title,
        description,
        severity,
        location,
        status
    )
    VALUES (
        :reporter_id,
        :title,
        :description,
        :severity,
        :location,
        'NEW'
    )
    """
)

GET_CREATED_INCIDENT_IDENTITY_QUERY = text(
    """
    SELECT
        id,
        incident_number
    FROM public.incidents
    WHERE incident_number = currval(
        pg_get_serial_sequence(
            'public.incidents',
            'incident_number'
        )
    )
    """
)

GET_REPORTER_INCIDENTS_QUERY = text(
    """
    SELECT
        incidents.incident_number,
        incidents.title,
        incidents.description,
        incidents.severity,
        incidents.location,
        incidents.status,
        incidents.created_at,
        incidents.updated_at,
        incidents.assigned_at,
        incidents.resolved_at,
        incidents.closed_at,
        incidents.cancelled_at,
        incidents.assigned_aid_provider_id,
        incidents.assigned_team_id,
        aid_providers.name AS assigned_provider_name,
        aid_provider_teams.name AS assigned_team_name
    FROM public.incidents
    INNER JOIN public.users
        ON users.id = incidents.reporter_id
    LEFT JOIN public.aid_providers
        ON aid_providers.id = incidents.assigned_aid_provider_id
    LEFT JOIN public.aid_provider_teams
        ON aid_provider_teams.id = incidents.assigned_team_id
    WHERE users.email = :email
      AND users.role = 'REPORTER'
      AND users.is_active = true
    ORDER BY incidents.updated_at DESC
    """
)

GET_REPORTER_INCIDENT_QUERY = text(
    """
    SELECT
        incidents.incident_number,
        incidents.title,
        incidents.description,
        incidents.severity,
        incidents.location,
        incidents.status,
        incidents.created_at,
        incidents.updated_at,
        incidents.assigned_at,
        incidents.resolved_at,
        incidents.closed_at,
        incidents.cancelled_at,
        incidents.assigned_aid_provider_id,
        incidents.assigned_team_id,
        aid_providers.name AS assigned_provider_name,
        aid_provider_teams.name AS assigned_team_name
    FROM public.incidents
    INNER JOIN public.users
        ON users.id = incidents.reporter_id
    LEFT JOIN public.aid_providers
        ON aid_providers.id = incidents.assigned_aid_provider_id
    LEFT JOIN public.aid_provider_teams
        ON aid_provider_teams.id = incidents.assigned_team_id
    WHERE incidents.incident_number = :incident_number
      AND users.email = :email
      AND users.role = 'REPORTER'
      AND users.is_active = true
    """
)

GET_ASSIGNER_INCIDENTS_QUERY = text(
    """
    SELECT
        incidents.incident_number,
        incidents.title,
        incidents.description,
        incidents.severity,
        incidents.location,
        incidents.status,
        incidents.created_at,
        incidents.updated_at,
        incidents.assigned_at,
        incidents.resolved_at,
        incidents.closed_at,
        incidents.cancelled_at,
        incidents.assigned_aid_provider_id,
        incidents.assigned_team_id,
        aid_providers.name AS assigned_provider_name,
        aid_provider_teams.name AS assigned_team_name
    FROM public.incidents
    LEFT JOIN public.aid_providers
        ON aid_providers.id = incidents.assigned_aid_provider_id
    LEFT JOIN public.aid_provider_teams
        ON aid_provider_teams.id = incidents.assigned_team_id
    ORDER BY incidents.updated_at DESC
    """
)

GET_ASSIGNED_INCIDENTS_QUERY = text(
    """
    SELECT DISTINCT
        incidents.incident_number,
        incidents.title,
        incidents.description,
        incidents.severity,
        incidents.location,
        incidents.status,
        incidents.created_at,
        incidents.updated_at,
        incidents.assigned_at,
        incidents.resolved_at,
        incidents.closed_at,
        incidents.cancelled_at,
        incidents.assigned_aid_provider_id,
        incidents.assigned_team_id,
        aid_providers.name AS assigned_provider_name,
        aid_provider_teams.name AS assigned_team_name
    FROM public.incidents
    INNER JOIN public.team_members
        ON team_members.team_id = incidents.assigned_team_id
    INNER JOIN public.users
        ON users.id = team_members.user_id
    INNER JOIN public.aid_providers
        ON aid_providers.id = incidents.assigned_aid_provider_id
    INNER JOIN public.aid_provider_teams
        ON aid_provider_teams.id = incidents.assigned_team_id
    WHERE users.email = :email
      AND users.role = 'AID_PROVIDER_TEAM_MEMBER'
      AND users.is_active = true
      AND aid_provider_teams.is_active = true
      AND incidents.status IN ('NEW', 'ASSIGNED', 'IN_PROGRESS')
    ORDER BY incidents.updated_at DESC
    """
)

GET_ASSIGNED_INCIDENT_QUERY = text(
    """
    SELECT DISTINCT
        incidents.incident_number,
        incidents.title,
        incidents.description,
        incidents.severity,
        incidents.location,
        incidents.status,
        incidents.created_at,
        incidents.updated_at,
        incidents.assigned_at,
        incidents.resolved_at,
        incidents.closed_at,
        incidents.assigned_aid_provider_id,
        incidents.assigned_team_id,
        aid_providers.name AS assigned_provider_name,
        aid_provider_teams.name AS assigned_team_name
    FROM public.incidents
    INNER JOIN public.team_members
        ON team_members.team_id = incidents.assigned_team_id
    INNER JOIN public.users
        ON users.id = team_members.user_id
    INNER JOIN public.aid_providers
        ON aid_providers.id = incidents.assigned_aid_provider_id
    INNER JOIN public.aid_provider_teams
        ON aid_provider_teams.id = incidents.assigned_team_id
    WHERE incidents.incident_number = :incident_number
      AND users.email = :email
      AND users.role = 'AID_PROVIDER_TEAM_MEMBER'
      AND users.is_active = true
      AND aid_provider_teams.is_active = true
    """
)

ASSIGN_INCIDENT_QUERY = text(
    """
    UPDATE public.incidents
    SET
        assigned_aid_provider_id = :aid_provider_id,
        assigned_team_id = :team_id,
        status = 'ASSIGNED',
        assigned_at = now(),
        updated_at = now()
    WHERE incident_number = :incident_number
      AND EXISTS (
          SELECT 1
          FROM public.aid_provider_teams
          WHERE id = :team_id
            AND aid_provider_id = :aid_provider_id
            AND is_active = true
      )
    """
)

UPDATE_ASSIGNED_INCIDENT_STATUS_QUERY = text(
    """
    UPDATE public.incidents
    SET
        status = :status,
        updated_at = now()
    WHERE incident_number = :incident_number
      AND assigned_team_id IN (
          SELECT team_members.team_id
          FROM public.team_members
          INNER JOIN public.users
              ON users.id = team_members.user_id
          WHERE users.email = :email
            AND users.role = 'AID_PROVIDER_TEAM_MEMBER'
            AND users.is_active = true
      )
    """
)

UPDATE_STARTED_AT_QUERY = text(
    """
    UPDATE public.incidents
    SET started_at = COALESCE(started_at, now()),
        updated_at = now()
    WHERE incident_number = :incident_number
    """
)

UPDATE_RESOLVED_AT_QUERY = text(
    """
    UPDATE public.incidents
    SET resolved_at = COALESCE(resolved_at, now()),
        updated_at = now()
    WHERE incident_number = :incident_number
    """
)

UPDATE_CLOSED_AT_QUERY = text(
    """
    UPDATE public.incidents
    SET closed_at = COALESCE(closed_at, now()),
        updated_at = now()
    WHERE incident_number = :incident_number
    """
)

UPDATE_CANCELLED_AT_QUERY = text(
    """
    UPDATE public.incidents
    SET cancelled_at = COALESCE(cancelled_at, now()),
        updated_at = now()
    WHERE incident_number = :incident_number
    """
)

GET_CURRENT_ASSIGNER_ID_QUERY = text(
    """
    SELECT id
    FROM public.users
    WHERE email = :email
      AND role = 'ASSIGNER'
      AND is_active = true
    """
)

GET_INCIDENT_ASSIGNMENT_CONTEXT_QUERY = text(
    """
    SELECT
        id,
        assigned_aid_provider_id,
        assigned_team_id
    FROM public.incidents
    WHERE incident_number = :incident_number
    FOR UPDATE
    """
)

GET_ASSIGNED_INCIDENT_STATUS_CONTEXT_QUERY = text(
    """
    SELECT
        incidents.id,
        incidents.status,
        users.id AS actor_id
    FROM public.incidents
    INNER JOIN public.team_members
        ON team_members.team_id = incidents.assigned_team_id
    INNER JOIN public.users
        ON users.id = team_members.user_id
    WHERE incidents.incident_number = :incident_number
      AND users.email = :email
      AND users.role = 'AID_PROVIDER_TEAM_MEMBER'
      AND users.is_active = true
    FOR UPDATE OF incidents
    """
)

class ReporterNotFound(Exception):
    """Raised when the authenticated reporter no longer has an active account."""


class InvalidIncidentAssignment(Exception):
    """Raised when an incident cannot be assigned to the selected team."""


def _add_incident_reference(row: dict[str, object]) -> dict[str, object]:
    """Convert the database incident number into its display reference."""

    incident_number = int(row.pop("incident_number"))
    row["incident_reference"] = f"INC-{incident_number:05d}"
    return row


def create_incident(
    db: Session,
    email: str,
    incident_data: IncidentCreate,
) -> dict[str, object]:
    """Insert a new incident for the authenticated reporter."""

    reporter_id = db.execute(
        GET_ACTIVE_REPORTER_ID_QUERY,
        {"email": email},
    ).scalar_one_or_none()

    if reporter_id is None:
        raise ReporterNotFound

    try:
        db.execute(
            CREATE_INCIDENT_QUERY,
            {
                "reporter_id": reporter_id,
                "title": incident_data.title.strip(),
                "description": incident_data.description.strip(),
                "severity": incident_data.severity,
                "location": incident_data.location.strip(),
            },
        )

        created_incident = db.execute(
            GET_CREATED_INCIDENT_IDENTITY_QUERY,
        ).mappings().one()

        incident_reference = (
            f"INC-{int(created_incident['incident_number']):05d}"
        )
        submitted_event = IncidentSubmittedEvent(
            incident_id=created_incident["id"],
            event_type="IncidentSubmitted",
            actor_id=reporter_id,
            actor_role="REPORTER",
            event_data=IncidentSubmittedEventData(
                incident_reference=incident_reference,
                title=incident_data.title.strip(),
                description=incident_data.description.strip(),
                severity=incident_data.severity,
                location=incident_data.location.strip(),
                status="NEW",
            ),
        )
        add_incident_event_to_outbox(db, submitted_event)
        db.commit()
    except Exception:
        db.rollback()
        raise

    return {
        "success": True,
        "incident_id": str(created_incident["id"]),
        "incident_reference": incident_reference,
    }


def get_reporter_incidents(
    db: Session,
    email: str,
) -> list[dict[str, object]]:
    """Return incidents belonging only to the authenticated reporter."""

    rows = db.execute(
        GET_REPORTER_INCIDENTS_QUERY,
        {"email": email},
    ).mappings().all()
    return [_add_incident_reference(dict(row)) for row in rows]


def get_assigner_incidents(db: Session) -> list[dict[str, object]]:
    """Return incidents available to the assigner workspace."""

    rows = db.execute(GET_ASSIGNER_INCIDENTS_QUERY).mappings().all()
    return [_add_incident_reference(dict(row)) for row in rows]


def get_assigned_incidents(
    db: Session,
    email: str,
) -> list[dict[str, object]]:
    """Return incidents assigned to any team containing the authenticated member."""

    rows = db.execute(
        GET_ASSIGNED_INCIDENTS_QUERY,
        {"email": email},
    ).mappings().all()
    return [_add_incident_reference(dict(row)) for row in rows]


def get_assigned_incident(
    db: Session,
    email: str,
    incident_reference: str,
) -> dict[str, object] | None:
    """Return one assigned incident visible to the authenticated member."""

    reference_match = re.fullmatch(r"INC-(\d{5})", incident_reference.upper())
    if reference_match is None:
        return None

    row = db.execute(
        GET_ASSIGNED_INCIDENT_QUERY,
        {
            "incident_number": int(reference_match.group(1)),
            "email": email,
        },
    ).mappings().one_or_none()
    return _add_incident_reference(dict(row)) if row else None


def assign_incident(
    db: Session,
    email: str,
    incident_reference: str,
    aid_provider_id: str,
    team_id: str,
) -> None:
    """Assign an incident to an active team belonging to the selected provider."""

    incident_number = int(incident_reference.removeprefix("INC-"))

    try:
        assigner_id = db.execute(
            GET_CURRENT_ASSIGNER_ID_QUERY,
            {"email": email},
        ).scalar_one_or_none()

        if assigner_id is None:
            raise InvalidIncidentAssignment(
                "The assigner account is not active."
            )

        incident = db.execute(
            GET_INCIDENT_ASSIGNMENT_CONTEXT_QUERY,
            {"incident_number": incident_number},
        ).mappings().one_or_none()

        if incident is None:
            raise InvalidIncidentAssignment("The incident does not exist.")

        result = db.execute(
            ASSIGN_INCIDENT_QUERY,
            {
                "incident_number": incident_number,
                "aid_provider_id": aid_provider_id,
                "team_id": team_id,
            },
        )

        if result.rowcount == 0:
            raise InvalidIncidentAssignment(
                "The incident or selected aid provider team is invalid."
            )

        assigned_event = IncidentAssignedEvent(
            incident_id=incident["id"],
            event_type="IncidentAssigned",
            actor_id=assigner_id,
            actor_role="ASSIGNER",
            event_data=IncidentAssignedEventData(
                incident_reference=incident_reference.upper(),
                aid_provider_id=aid_provider_id,
                team_id=team_id,
                status="ASSIGNED",
            ),
        )
        add_incident_event_to_outbox(db, assigned_event)
        db.commit()
    except Exception:
        db.rollback()
        raise


def update_assigned_incident_status(
    db: Session,
    email: str,
    incident_reference: str,
    incident_status: str,
) -> None:
    """Update an assigned incident only when the member belongs to its team."""

    incident_number = int(incident_reference.removeprefix("INC-"))

    try:
        incident = db.execute(
            GET_ASSIGNED_INCIDENT_STATUS_CONTEXT_QUERY,
            {
                "email": email,
                "incident_number": incident_number,
            },
        ).mappings().one_or_none()

        if incident is None:
            raise InvalidIncidentAssignment(
                "The incident is not assigned to one of your teams."
            )

        result = db.execute(
            UPDATE_ASSIGNED_INCIDENT_STATUS_QUERY,
            {
                "email": email,
                "incident_number": incident_number,
                "status": incident_status,
            },
        )

        if result.rowcount == 0:
            raise InvalidIncidentAssignment(
                "The incident is not assigned to one of your teams."
            )

        timestamp_queries = {
            "IN_PROGRESS": UPDATE_STARTED_AT_QUERY,
            "RESOLVED": UPDATE_RESOLVED_AT_QUERY,
            "CLOSED": UPDATE_CLOSED_AT_QUERY,
            "CANCELLED": UPDATE_CANCELLED_AT_QUERY,
        }
        timestamp_query = timestamp_queries[incident_status]
        db.execute(timestamp_query, {"incident_number": incident_number})

        updated_event = IncidentUpdatedEvent(
            incident_id=incident["id"],
            event_type="IncidentUpdated",
            actor_id=incident["actor_id"],
            actor_role="AID_PROVIDER_TEAM_MEMBER",
            event_data=IncidentUpdatedEventData(
                incident_reference=incident_reference.upper(),
                old_status=incident["status"],
                new_status=incident_status,
            ),
        )
        add_incident_event_to_outbox(db, updated_event)
        db.commit()
    except Exception:
        db.rollback()
        raise


def get_reporter_incident(
    db: Session,
    email: str,
    incident_reference: str,
) -> dict[str, object] | None:
    """Return one incident by display reference for the authenticated reporter."""

    reference_match = re.fullmatch(r"INC-(\d{5})", incident_reference.upper())
    if reference_match is None:
        return None

    incident_number = int(reference_match.group(1))
    row = db.execute(
        GET_REPORTER_INCIDENT_QUERY,
        {"email": email, "incident_number": incident_number},
    ).mappings().one_or_none()
    return _add_incident_reference(dict(row)) if row else None
