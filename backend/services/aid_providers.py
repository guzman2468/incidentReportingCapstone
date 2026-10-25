"""Business logic for aid providers, teams, and provider accounts."""

from sqlalchemy import text
from sqlalchemy.orm import Session

from backend.core.security import hash_password
from backend.schemas.aid_providers import (
    AidProviderAccountCreate,
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
    RETURNING id
    """
)

CREATE_PROVIDER_ACCOUNT_QUERY = text(
    """
    INSERT INTO public.users (
        email, password_hash, first_name, last_name, role, aid_provider_id,
        is_active, must_change_password
    )
    VALUES (
        :email, :password_hash, '', '', 'AID_PROVIDER', :aid_provider_id,
        true, true
    )
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
    RETURNING id
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
    RETURNING team_id
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


def create_aid_provider_account(
    db: Session,
    account_data: AidProviderAccountCreate,
) -> dict[str, str]:
    """Create an aid provider organization and its provider account together."""
    try:
        provider_id = db.execute(
            CREATE_PROVIDER_QUERY,
            {
                "name": account_data.aid_provider_name.strip().lower(),
                "description": (
                    account_data.aid_provider_description.strip()
                    if account_data.aid_provider_description
                    else None
                ),
            },
        ).scalar_one()

        db.execute(
            CREATE_PROVIDER_ACCOUNT_QUERY,
            {
                "email": account_data.email,
                "password_hash": hash_password(account_data.password),
                "aid_provider_id": provider_id,
            },
        )
        db.commit()
    except Exception:
        db.rollback()
        raise

    return {"email": account_data.email, "aid_provider_id": str(provider_id)}


def create_aid_provider_team_member_account(
    db: Session,
    account_data: AidProviderTeamMemberAccountCreate,
) -> dict[str, str]:
    """Create a team member and assign them to a team under the selected provider."""
    try:
        user_id = db.execute(
            CREATE_TEAM_MEMBER_QUERY,
            {
                "email": account_data.email,
                "password_hash": hash_password(account_data.password),
                "first_name": account_data.first_name.strip().lower(),
                "last_name": account_data.last_name.strip().lower(),
                "aid_provider_id": account_data.aid_provider_id,
            },
        ).scalar_one()

        membership = db.execute(
            ASSIGN_TEAM_MEMBER_QUERY,
            {
                "user_id": user_id,
                "team_id": account_data.aid_provider_team_id,
                "aid_provider_id": account_data.aid_provider_id,
            },
        ).scalar_one_or_none()
        if membership is None:
            raise InvalidAidProviderAssignment(
                "The selected team does not belong to the selected aid provider."
            )

        db.commit()
    except Exception:
        db.rollback()
        raise

    return {"email": account_data.email}
