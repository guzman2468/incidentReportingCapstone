from sqlalchemy import text
from sqlalchemy.orm import Session

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

GET_REPORTER_INCIDENTS_QUERY = text(
    """
    SELECT
        incidents.id,
        incidents.incident_number,
        incidents.title,
        incidents.description,
        incidents.severity,
        incidents.location,
        incidents.status,
        incidents.created_at,
        incidents.updated_at
    FROM public.incidents
    INNER JOIN public.users
        ON users.id = incidents.reporter_id
    WHERE users.email = :email
      AND users.role = 'REPORTER'
      AND users.is_active = true
    ORDER BY incidents.created_at DESC
    """
)


class ReporterNotFound(Exception):
    """Raised when the authenticated reporter no longer has an active account."""


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
        db.commit()
    except Exception:
        db.rollback()
        raise

    return {"success": True}


def get_reporter_incidents(
    db: Session,
    email: str,
) -> list[dict[str, object]]:
    """Return incidents belonging only to the authenticated reporter."""

    rows = db.execute(
        GET_REPORTER_INCIDENTS_QUERY,
        {"email": email},
    ).mappings().all()
    return [dict(row) for row in rows]
