"""Business logic for aid providers, teams, and provider accounts."""

from sqlalchemy import text
from sqlalchemy.orm import Session

from backend.core.security import hash_password
from backend.schemas.aid_providers import (
    AidProviderCreate,
    AidProviderTeamCreate,
    AidProviderTeamMemberAccountCreate,
)

ACTIVE_PROVIDERS_QUERY = text(
    """
    SELECT id, name, description
    FROM public.aid_providers
    WHERE is_active = true
    ORDER BY name ASC
    """
)

ACTIVE_TEAMS_QUERY = text(
    """
    SELECT id, name, description
    FROM public.aid_provider_teams
    WHERE aid_provider_id = :aid_provider_id
      AND is_active = true
    ORDER BY name ASC
    """
)

CREATE_PROVIDER_QUERY = text(
    """
    INSERT INTO public.aid_providers (name, description)
    VALUES (:name, :description)
    """
)

CREATE_TEAM_QUERY = text(
    """
    INSERT INTO public.aid_provider_teams (aid_provider_id, name, description)
    SELECT id, :name, :description
    FROM public.aid_providers
    WHERE id = :aid_provider_id
      AND is_active = true
    """
)

CREATE_TEAM_MEMBER_QUERY = text(
    """
    INSERT INTO public.users (
        email, password_hash, first_name, last_name, role, aid_provider_id,
        is_active, must_change_password
    )
    VALUES (
        :email, :password_hash, :first_name, :last_name,
        'AID_PROVIDER_TEAM_MEMBER', :aid_provider_id, true, true
    )
    """
)

GET_CREATED_TEAM_MEMBER_ID_QUERY = text(
    """
    SELECT id
    FROM public.users
    WHERE email = :email
    """
)

ASSIGN_TEAM_MEMBER_QUERY = text(
    """
    INSERT INTO public.team_members (team_id, user_id)
    SELECT apt.id, :user_id
    FROM public.aid_provider_teams apt
    WHERE apt.id = :team_id
      AND apt.aid_provider_id = :aid_provider_id
      AND apt.is_active = true
    """
)


class InvalidAidProviderAssignment(Exception):
    """Raised when a team member is assigned to an invalid provider/team."""


def get_active_aid_providers(db: Session) -> list[dict[str, object]]:
    """Return active aid providers for account provisioning."""
    rows = db.execute(ACTIVE_PROVIDERS_QUERY).mappings().all()
    return [dict(row) for row in rows]


def get_active_aid_provider_teams(db: Session, aid_provider_id: str) -> list[dict[str, object]]:
    """Return active teams belonging to a selected aid provider."""
    rows = db.execute(
        ACTIVE_TEAMS_QUERY,
        {"aid_provider_id": aid_provider_id},
    ).mappings().all()
    return [dict(row) for row in rows]


def create_aid_provider(
    db: Session,
    provider_data: AidProviderCreate,
) -> dict[str, bool]:
    """Create an aid provider organization without creating a user account."""
    try:
        db.execute(
            CREATE_PROVIDER_QUERY,
            {
                "name": provider_data.name.strip().lower(),
                "description": (
                    provider_data.description.strip()
                    if provider_data.description
                    else None
                ),
            },
        )
        db.commit()
    except Exception:
        db.rollback()
        raise

    return {"success": True}


def create_aid_provider_team(
    db: Session,
    team_data: AidProviderTeamCreate,
) -> dict[str, bool]:
    """Create a team grouping under an active aid provider."""
    try:
        team_insert = db.execute(
            CREATE_TEAM_QUERY,
            {
                "aid_provider_id": team_data.aid_provider_id,
                "name": team_data.name.strip().lower(),
                "description": team_data.description.strip(),
            },
        )
        if team_insert.rowcount == 0:
            raise InvalidAidProviderAssignment(
                "The selected aid provider does not exist or is inactive."
            )
        db.commit()
    except Exception:
        db.rollback()
        raise

    return {"success": True}


def create_aid_provider_team_member_account(
    db: Session,
    account_data: AidProviderTeamMemberAccountCreate,
) -> dict[str, str]:
    """Create a team member and assign them to a team under the selected provider."""
    try:
        db.execute(
            CREATE_TEAM_MEMBER_QUERY,
            {
                "email": account_data.email,
                "password_hash": hash_password(account_data.password),
                "first_name": account_data.first_name.strip().lower(),
                "last_name": account_data.last_name.strip().lower(),
                "aid_provider_id": account_data.aid_provider_id,
            },
        )
        user_id = db.execute(
            GET_CREATED_TEAM_MEMBER_ID_QUERY,
            {"email": account_data.email},
        ).scalar_one()
        membership = db.execute(
            ASSIGN_TEAM_MEMBER_QUERY,
            {
                "user_id": user_id,
                "team_id": account_data.aid_provider_team_id,
                "aid_provider_id": account_data.aid_provider_id,
            },
        )
        if membership.rowcount == 0:
            raise InvalidAidProviderAssignment(
                "The selected team does not belong to the selected aid provider."
            )

        db.commit()
    except Exception:
        db.rollback()
        raise

    return {"email": account_data.email}
