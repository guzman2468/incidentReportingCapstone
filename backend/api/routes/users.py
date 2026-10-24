"""User account API routes."""

from fastapi import APIRouter, Cookie, Depends, HTTPException, Response, status
from sqlalchemy.orm import Session

from backend.core.security import (
    SESSION_COOKIE,
    SESSION_MAX_AGE,
    create_session_token,
    get_session_email,
)
from backend.database import get_db
from backend.schemas.users import (
    PasswordChange,
    UserCreate,
    UserCreated,
    UserLogin,
    UserLoggedIn,
    UserProfile,
)
from backend.services.users import (
    EmailAlreadyRegistered,
    InvalidCredentials,
    authenticate_user,
    change_password,
    create_user,
    get_user_profile,
)

router = APIRouter(prefix="/api/users", tags=["users"])


def set_session_cookie(response: Response, email: str) -> None:
    """Create the session token and attach it to the response."""
    session_token = create_session_token(email)
    response.set_cookie(
        key=SESSION_COOKIE,
        value=session_token,
        max_age=SESSION_MAX_AGE,
        httponly=True,
        samesite="lax",
        secure=False,
    )


def get_active_profile(db: Session, email: str) -> dict[str, str | bool]:
    """Return the active user's profile or raise an authentication error."""
    profile = get_user_profile(db, email)
    if not profile:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Not authenticated",
        )
    return profile


@router.post("/createUser", response_model=UserCreated, status_code=status.HTTP_201_CREATED)
def register_user(user_data: UserCreate, db: Session = Depends(get_db)) -> UserCreated:
    try:
        return create_user(db, user_data)
    except EmailAlreadyRegistered as error:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="An account with that email already exists.",
        ) from error


@router.post("/login", response_model=UserLoggedIn)
def login_user(
    login_data: UserLogin,
    response: Response,
    db: Session = Depends(get_db),
) -> UserLoggedIn:
    try:
        user = authenticate_user(db, login_data)
    except InvalidCredentials as error:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password.",
        ) from error

    set_session_cookie(response, user["email"])
    return {
        "success": True,
        "role": user["role"],
        "must_change_password": user["must_change_password"],
    }


def require_session(session: str | None = Cookie(default=None, alias=SESSION_COOKIE)) -> str:
    email = get_session_email(session)
    if not email:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Not authenticated")
    return email


@router.get("/currentUser", response_model=UserProfile)
def current_user(
    email: str = Depends(require_session),
    db: Session = Depends(get_db),
) -> UserProfile:
    return get_active_profile(db, email)


@router.post("/changePassword")
def update_password(
    password_data: PasswordChange,
    email: str = Depends(require_session),
    db: Session = Depends(get_db),
) -> dict[str, bool]:
    try:
        change_password(db, email, password_data)
    except InvalidCredentials as error:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Incorrect password.",
        ) from error
    return {"success": True}


@router.post("/logout")
def logout_user(response: Response) -> dict[str, str]:
    response.delete_cookie(key=SESSION_COOKIE)
    return {"message": "Logged out"}
