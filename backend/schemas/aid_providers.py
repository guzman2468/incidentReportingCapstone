"""Schemas for aid providers, provider teams, and provider accounts."""

from uuid import UUID

from pydantic import BaseModel, Field

EMAIL_PATTERN = r"^[^@\s]+@[^@\s]+\.[^@\s]+$"


class AidProvider(BaseModel):
    """An active aid provider available for assignment."""

    id: UUID
    name: str
    description: str | None = None


class AidProviderTeam(BaseModel):
    """An active team belonging to an aid provider."""

    id: UUID
    name: str
    description: str | None = None


class AidProviderTeamCreate(BaseModel):
    """Fields required to create an aid provider team grouping."""

    aid_provider_id: UUID
    name: str = Field(min_length=1, max_length=100)
    description: str = Field(min_length=1, max_length=500)


class AidProviderCreate(BaseModel):
    """Fields required to create an aid provider organization."""

    name: str = Field(min_length=1, max_length=100)
    description: str = Field(min_length=1, max_length=500)


class AidProviderTeamMemberAccountCreate(BaseModel):
    """Fields required to create and assign a provider team member."""

    first_name: str = Field(min_length=1, max_length=50)
    last_name: str = Field(min_length=1, max_length=50)
    email: str = Field(min_length=3, max_length=50, pattern=EMAIL_PATTERN)
    password: str = Field(min_length=8, max_length=50)
    aid_provider_id: UUID
    aid_provider_team_id: UUID


class AidProviderCreated(BaseModel):
    """Response returned after creating an aid provider."""

    success: bool = True


class AidProviderTeamCreated(BaseModel):
    """Response returned after creating an aid provider team."""

    success: bool = True
