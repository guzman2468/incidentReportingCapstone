"""Business logic for creating users."""

from sqlalchemy import text
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from backend.core.security import hash_password, verify_password
from backend.schemas.users import PasswordChange, UserCreate, UserLogin


class EmailAlreadyRegistered(Exception):
    """Raised when a user attempts to register an existing email address."""


class InvalidCredentials(Exception):
    """Raised when login credentials do not match an existing user."""


def create_user(db: Session, user_data: UserCreate) -> dict[str, int | str]:
    """Hash the password and insert a user into the existing public.users table."""
    first_name = user_data.first_name.strip().lower()
    last_name = user_data.last_name.strip().lower()

    statement = text(
        """
        INSERT INTO public.users (
            email, password_hash, first_name, last_name, role, aid_provider_id,
            is_active, must_change_password
        )
        VALUES (
            :email, :password_hash, :first_name, :last_name, :role, :aid_provider_id,
            true, :must_change_password
        )
        RETURNING id
        """
    )

    try:
        user_id = db.execute(
            statement,
            {
                "email": user_data.email,
                "password_hash": hash_password(user_data.password),
                "first_name": first_name,
                "last_name": last_name,
                "role": user_data.role,
                "aid_provider_id": None,
                "must_change_password": user_data.role != "REPORTER",
            },
        ).scalar_one()

        db.commit()
    except IntegrityError as error:
        db.rollback()
        # The table's unique constraint is the authoritative duplicate check.
        if "users_email_key" in str(error.orig) or "duplicate key" in str(error.orig).lower():
            raise EmailAlreadyRegistered from error
        raise

    return {"email": user_data.email}


def authenticate_user(db: Session, login_data: UserLogin) -> dict[str, int | str]:
    """Verify login credentials without exposing whether an email exists."""
    row = db.execute(
        text(
            """
            SELECT email, password_hash, first_name, last_name, role, is_active,
                   must_change_password
            FROM public.users
            WHERE email = :email
            """
        ),
        {"email": login_data.email},
    ).mappings().one_or_none()

    if (
        row is None
        or not row["is_active"]
        or not verify_password(login_data.password, row["password_hash"])
    ):
        raise InvalidCredentials

    return {
        "email": row["email"],
        "first_name": row["first_name"],
        "last_name": row["last_name"],
        "role": row["role"],
        "must_change_password": row["must_change_password"],
    }


def get_user_profile(db: Session, email: str) -> dict[str, str | bool] | None:
    row = db.execute(
        text(
            """
            SELECT email, first_name, last_name, role, must_change_password
            FROM public.users
            WHERE email = :email
              AND is_active = true
            """
        ),
        {"email": email},
    ).mappings().one_or_none()
    return dict(row) if row else None


def change_password(db: Session, email: str, password_data: PasswordChange) -> None:
    row = db.execute(
        text("SELECT password_hash FROM public.users WHERE email = :email AND is_active = true"),
        {"email": email},
    ).mappings().one_or_none()

    if row is None or not verify_password(password_data.current_password, row["password_hash"]):
        raise InvalidCredentials

    db.execute(
        text(
            """
            UPDATE public.users
            SET password_hash = :password_hash,
                must_change_password = false
            WHERE email = :email
            """
        ),
        {"email": email, "password_hash": hash_password(password_data.new_password)},
    )
    db.commit()
