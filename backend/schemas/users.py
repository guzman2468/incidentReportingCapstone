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

GeneralUserRole = Literal["ADMIN", "REPORTER", "ASSIGNER"]


class UserCreate(BaseModel):
    first_name: str = Field(min_length=0, max_length=50)
    last_name: str = Field(min_length=0, max_length=50)
    email: str = Field(min_length=3, max_length=50, pattern=r"^[^@\s]+@[^@\s]+\.[^@\s]+$")
    password: str = Field(min_length=8, max_length=50)
    role: GeneralUserRole


class UserLogin(BaseModel):
    email: str = Field(min_length=3, max_length=50, pattern=r"^[^@\s]+@[^@\s]+\.[^@\s]+$")
    password: str = Field(min_length=1, max_length=50)


class UserProfile(BaseModel):
    email: str
    first_name: str
    last_name: str
    role: UserRole
    must_change_password: bool


class UserCreated(BaseModel):
    success: bool = True
    email: str


class UserLoggedIn(BaseModel):
    success: bool = True
    role: UserRole
    must_change_password: bool


class PasswordChange(BaseModel):
    current_password: str = Field(min_length=8, max_length=50)
    new_password: str = Field(min_length=8, max_length=50)
