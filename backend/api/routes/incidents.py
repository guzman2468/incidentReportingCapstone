"""Incident submission API routes."""

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from backend.api.routes.users import get_active_profile, require_session
from backend.database import get_db
from backend.schemas.incidents import (
    IncidentAssignmentCreate,
    IncidentCreate,
    IncidentSubmitted,
    IncidentStatusUpdate,
    IncidentSummary,
)
from backend.services.incidents import (
    InvalidIncidentAssignment,
    ReporterNotFound,
    assign_incident,
    create_incident,
    get_assigned_incident,
    get_assigned_incidents,
    update_assigned_incident_status,
)
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


def require_team_member(
    email: str = Depends(require_session),
    db: Session = Depends(get_db),
) -> str:
    """Allow only active aid provider team members to view assigned incidents."""

    profile = get_active_profile(db, email)
    if profile["role"] != "AID_PROVIDER_TEAM_MEMBER":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Aid provider team member access required",
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


@router.post("/assign")
def assign_incident_to_team(
    assignment: IncidentAssignmentCreate,
    _email: str = Depends(require_assigner),
    db: Session = Depends(get_db),
) -> dict[str, bool]:
    """Assign an incident to an active aid provider team."""

    try:
        assign_incident(
            db,
            assignment.incident_reference,
            str(assignment.aid_provider_id),
            str(assignment.team_id),
        )
    except InvalidIncidentAssignment as error:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(error),
        ) from error

    return {"success": True}


@router.get("/assigned-to-me", response_model=list[IncidentSummary])
def list_assigned_incidents(
    email: str = Depends(require_team_member),
    db: Session = Depends(get_db),
) -> list[IncidentSummary]:
    """Return incidents assigned to any team containing the authenticated member."""

    return get_assigned_incidents(db, email)


@router.get("/assigned-to-me/{incident_reference}", response_model=IncidentSummary)
def get_assigned_incident_details(
    incident_reference: str,
    email: str = Depends(require_team_member),
    db: Session = Depends(get_db),
) -> IncidentSummary:
    """Return one incident assigned to a team containing the authenticated member."""

    incident = get_assigned_incident(db, email, incident_reference)
    if incident is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Assigned incident not found",
        )

    return incident


@router.patch("/assigned-to-me/{incident_reference}/status")
def update_incident_status(
    incident_reference: str,
    status_update: IncidentStatusUpdate,
    email: str = Depends(require_team_member),
    db: Session = Depends(get_db),
) -> dict[str, bool]:
    """Update an assigned incident status for the authenticated team member."""

    try:
        update_assigned_incident_status(
            db,
            email,
            incident_reference,
            status_update.status,
        )
    except InvalidIncidentAssignment as error:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(error),
        ) from error

    return {"success": True}


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
