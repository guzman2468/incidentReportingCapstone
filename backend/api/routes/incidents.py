"""Incident submission API routes."""

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from backend.api.routes.users import get_active_profile, require_session
from backend.database import get_db
from backend.schemas.incidents import IncidentCreate, IncidentSubmitted, IncidentSummary
from backend.services.incidents import ReporterNotFound, create_incident
from backend.services.incidents import (
    get_assigner_incidents,
    get_reporter_incident,
    get_reporter_incidents,
)

router = APIRouter(prefix="/api/incidents", tags=["incidents"])


def require_reporter(
    email: str = Depends(require_session),
    db: Session = Depends(get_db),
) -> str:
    """Allow only active reporter accounts to submit incidents."""

    profile = get_active_profile(db, email)
    if profile["role"] != "REPORTER":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Reporter access required",
        )

    return email


def require_assigner(
    email: str = Depends(require_session),
    db: Session = Depends(get_db),
) -> str:
    """Allow only active assigner accounts to view the incident queue."""

    profile = get_active_profile(db, email)
    if profile["role"] != "ASSIGNER":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Assigner access required",
        )

    return email


@router.post("", response_model=IncidentSubmitted, status_code=status.HTTP_201_CREATED)
def submit_incident(
    incident_data: IncidentCreate,
    email: str = Depends(require_reporter),
    db: Session = Depends(get_db),
) -> IncidentSubmitted:
    """Create a new incident with NEW status for the authenticated reporter."""

    try:
        return create_incident(db, email, incident_data)
    except ReporterNotFound as error:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Reporter account is not active",
        ) from error


@router.get("/mine", response_model=list[IncidentSummary])
def list_my_incidents(
    email: str = Depends(require_reporter),
    db: Session = Depends(get_db),
) -> list[IncidentSummary]:
    """Return incidents submitted by the authenticated reporter."""

    return get_reporter_incidents(db, email)


@router.get("/assigner", response_model=list[IncidentSummary])
def list_assigner_incidents(
    _email: str = Depends(require_assigner),
    db: Session = Depends(get_db),
) -> list[IncidentSummary]:
    """Return the incident queue for the authenticated assigner."""

    return get_assigner_incidents(db)


@router.get("/reference/{incident_reference}", response_model=IncidentSummary)
def get_my_incident(
    incident_reference: str,
    email: str = Depends(require_reporter),
    db: Session = Depends(get_db),
) -> IncidentSummary:
    """Return one incident by its human-readable number."""

    incident = get_reporter_incident(db, email, incident_reference)
    if incident is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Incident not found",
        )

    return incident
