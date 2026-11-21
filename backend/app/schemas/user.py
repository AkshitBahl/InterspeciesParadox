import uuid
from datetime import datetime
from typing import Any, Literal

from pydantic import BaseModel, EmailStr, Field, computed_field

from app.schemas.common import ORMModel


class RegisterRequest(BaseModel):
    email: EmailStr
    password: str = Field(min_length=8, max_length=128)
    display_name: str = Field(min_length=1, max_length=120)


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class RefreshRequest(BaseModel):
    refresh_token: str


class TokenPair(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"
    expires_in: int = Field(description="Access token lifetime in seconds")


class UserRead(ORMModel):
    id: uuid.UUID
    email: EmailStr
    display_name: str
    is_admin: bool
    created_at: datetime


class Priorities(BaseModel):
    """How much each concern matters to this person, from 1 (not at all) to 5 (a lot)."""

    safety: int = Field(3, ge=1, le=5)
    convenience: int = Field(3, ge=1, le=5)
    cost: int = Field(3, ge=1, le=5)
    nature: int = Field(3, ge=1, le=5)
    quiet: int = Field(3, ge=1, le=5)


class ProfileFields(BaseModel):
    home_building_id: uuid.UUID | None = Field(None, description="A 'building' map feature")
    home_unit: str | None = Field(None, max_length=40)
    age_group: Literal["child", "adult", "senior"] | None = None
    household_size: int = Field(1, ge=1, le=20)
    mobility_needs: list[str] = Field(default_factory=list, examples=[["wheelchair", "stroller"]])
    allergies: list[str] = Field(default_factory=list, examples=[["bee_sting"]])
    pets: list[str] = Field(default_factory=list, examples=[["cat"]])
    wildlife_comfort: int = Field(3, ge=1, le=5, description="1 = nervous around animals, 5 = loves wildlife")
    noise_tolerance: int = Field(3, ge=1, le=5)
    needs_night_lighting: bool = False
    daily_schedule: dict[str, Any] = Field(default_factory=dict, examples=[{"leave_home": "07:45", "return_home": "18:00"}])
    priorities: Priorities = Field(default_factory=Priorities)
    budget_eur: int | None = Field(None, ge=0)
    preferred_language: str = Field("en", max_length=8)
    bio: str | None = Field(None, max_length=2000)


class ProfileUpdate(BaseModel):
    """Every field is optional: only the ones you send are changed."""

    home_building_id: uuid.UUID | None = None
    home_unit: str | None = Field(None, max_length=40)
    age_group: Literal["child", "adult", "senior"] | None = None
    household_size: int | None = Field(None, ge=1, le=20)
    mobility_needs: list[str] | None = None
    allergies: list[str] | None = None
    pets: list[str] | None = None
    wildlife_comfort: int | None = Field(None, ge=1, le=5)
    noise_tolerance: int | None = Field(None, ge=1, le=5)
    needs_night_lighting: bool | None = None
    daily_schedule: dict[str, Any] | None = None
    priorities: Priorities | None = None
    budget_eur: int | None = Field(None, ge=0)
    preferred_language: str | None = Field(None, max_length=8)
    bio: str | None = Field(None, max_length=2000)


class ProfileRead(ORMModel):
    id: uuid.UUID
    user_id: uuid.UUID
    home_building_id: uuid.UUID | None
    home_unit: str | None
    age_group: str | None
    household_size: int
    mobility_needs: list[str]
    allergies: list[str]
    pets: list[str]
    wildlife_comfort: int
    noise_tolerance: int
    needs_night_lighting: bool
    daily_schedule: dict[str, Any]
    priorities: dict[str, Any]
    budget_eur: int | None
    preferred_language: str
    bio: str | None
    created_at: datetime
    updated_at: datetime

    @computed_field  # type: ignore[prop-decorator]
    @property
    def completeness(self) -> float:
        """Share of the optional profile questions answered (0-1), handy for a progress bar."""
        answered = [
            self.home_building_id is not None,
            self.age_group is not None,
            bool(self.daily_schedule),
            bool(self.priorities),
            self.budget_eur is not None,
            bool(self.bio),
        ]
        return round(sum(answered) / len(answered), 2)


class PublicProfile(BaseModel):
    user_id: uuid.UUID
    display_name: str
    home_unit: str | None
    home_building_id: uuid.UUID | None
    wildlife_comfort: int | None
    bio: str | None
