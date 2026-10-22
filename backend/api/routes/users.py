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
from backend.schemas.users import UserCreate, UserCreated, UserLogin, UserLoggedIn, UserProfile
from backend.services.users import (
    EmailAlreadyRegistered,
    InvalidCredentials,
    authenticate_user,
    create_user,
    get_user_profile,
)

router = APIRouter(prefix="/api/users", tags=["users"])


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

    response.set_cookie(
        key=SESSION_COOKIE,
        value=create_session_token(user["email"]),
        max_age=SESSION_MAX_AGE,
        httponly=True,
        samesite="lax",
        secure=False,
    )
    return {"success": True, **user}


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
    profile = get_user_profile(db, email)
    if not profile:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Not authenticated")
    return profile


@router.post("/logout")
def logout_user(response: Response) -> dict[str, str]:
    response.delete_cookie(key=SESSION_COOKIE)
    return {"message": "Logged out"}
