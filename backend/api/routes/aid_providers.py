"""API routes for aid providers, teams, and provider accounts."""

from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from backend.api.routes.users import get_active_profile, require_session
from backend.database import get_db
from backend.schemas.aid_providers import (
    AidProvider,
    AidProviderCreate,
    AidProviderCreated,
    AidProviderTeam,
    AidProviderTeamCreate,
    AidProviderTeamCreated,
    AidProviderTeamMemberAccountCreate,
)
from backend.schemas.users import UserCreated
from backend.services.aid_providers import (
    InvalidAidProviderAssignment,
    create_aid_provider,
    create_aid_provider_team,
    create_aid_provider_team_member_account,
    get_active_aid_providers,
    get_active_aid_provider_teams,
)

router = APIRouter(prefix="/api/aidProviders", tags=["aid-providers"])


def require_admin(email: str, db: Session) -> None:
    """Allow only authenticated administrators to use provider management routes."""
    profile = get_active_profile(db, email)
    if profile["role"] != "ADMIN":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Admin access required")


@router.get("", response_model=list[AidProvider])
def list_active_aid_providers(
    email: str = Depends(require_session),
    db: Session = Depends(get_db),
) -> list[AidProvider]:
    require_admin(email, db)
    return get_active_aid_providers(db)


@router.get("/{aid_provider_id}/teams", response_model=list[AidProviderTeam])
def list_active_aid_provider_teams(
    aid_provider_id: UUID,
    email: str = Depends(require_session),
    db: Session = Depends(get_db),
) -> list[AidProviderTeam]:
    require_admin(email, db)
    return get_active_aid_provider_teams(db, str(aid_provider_id))


@router.post("", response_model=AidProviderCreated, status_code=status.HTTP_201_CREATED)
def create_provider(
    provider_data: AidProviderCreate,
    email: str = Depends(require_session),
    db: Session = Depends(get_db),
) -> AidProviderCreated:
    require_admin(email, db)
    try:
        return create_aid_provider(db, provider_data)
    except IntegrityError as error:
        if _is_duplicate_provider_name(error):
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="An aid provider with that name already exists.",
            ) from error
        raise


@router.post("/teams", response_model=AidProviderTeamCreated, status_code=status.HTTP_201_CREATED)
def create_provider_team(
    team_data: AidProviderTeamCreate,
    email: str = Depends(require_session),
    db: Session = Depends(get_db),
) -> AidProviderTeamCreated:
    require_admin(email, db)
    try:
        return create_aid_provider_team(db, team_data)
    except InvalidAidProviderAssignment as error:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(error)) from error
    except IntegrityError as error:
        if _is_duplicate_team_name(error):
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="An aid provider team with that name already exists.",
            ) from error
        raise


@router.post("/teamMembers", response_model=UserCreated, status_code=status.HTTP_201_CREATED)
def create_team_member_account(
    account_data: AidProviderTeamMemberAccountCreate,
    email: str = Depends(require_session),
    db: Session = Depends(get_db),
) -> UserCreated:
    require_admin(email, db)
    try:
        return create_aid_provider_team_member_account(db, account_data)
    except InvalidAidProviderAssignment as error:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(error)) from error
    except IntegrityError as error:
        if _is_duplicate_email(error):
            raise _duplicate_email_error() from error
        raise


def _is_duplicate_email(error: IntegrityError) -> bool:
    """Identify the users table's duplicate-email constraint violation."""
    message = str(error.orig).lower()
    return "users_email_key" in message


def _is_duplicate_provider_name(error: IntegrityError) -> bool:
    """Identify the aid provider name uniqueness violation."""
    return "aid_providers_name_unique" in str(error.orig).lower()


def _is_duplicate_team_name(error: IntegrityError) -> bool:
    """Identify the aid provider team name uniqueness violation."""
    message = str(error.orig).lower()
    return "aid_provider_teams_name_unique" in message


def _duplicate_email_error() -> HTTPException:
    """Build the shared duplicate-email API response."""
    return HTTPException(
        status_code=status.HTTP_409_CONFLICT,
        detail="An account with that email already exists.",
    )
