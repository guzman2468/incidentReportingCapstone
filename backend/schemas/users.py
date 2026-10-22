from typing import Literal
from uuid import UUID

from pydantic import BaseModel, Field


UserRole = Literal[
    "ADMIN",
    "REPORTER",
    "ASSIGNER",
    "AID_PROVIDER",
    "AID_PROVIDER_TEAM_MEMBER",
]


class UserCreate(BaseModel):
    first_name: str = Field(min_length=1, max_length=50)
    last_name: str = Field(min_length=1, max_length=50)
    email: str = Field(min_length=3, max_length=50, pattern=r"^[^@\s]+@[^@\s]+\.[^@\s]+$")
    password: str = Field(min_length=8, max_length=50)
    role: UserRole
    aid_provider_id: UUID | None = None


class UserLogin(BaseModel):
    email: str = Field(min_length=3, max_length=50, pattern=r"^[^@\s]+@[^@\s]+\.[^@\s]+$")
    password: str = Field(min_length=1, max_length=50)


class UserProfile(BaseModel):
    email: str
    first_name: str
    last_name: str
    role: UserRole


class UserCreated(BaseModel):
    success: bool = True
    email: str


class UserLoggedIn(BaseModel):
    success: bool = True
    email: str
    first_name: str
    last_name: str
    role: UserRole
