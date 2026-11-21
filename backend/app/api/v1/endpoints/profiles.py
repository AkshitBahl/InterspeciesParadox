"""Step 1: the human profile and preferences."""

import uuid

from fastapi import APIRouter, HTTPException

from app.api.deps import CurrentUser, DbSession, get_or_404
from app.models import HumanProfile, MapFeature, User
from app.schemas.user import ProfileFields, ProfileRead, ProfileUpdate, PublicProfile

router = APIRouter(prefix="/profiles", tags=["profiles"])


def _ensure_profile(db: DbSession, user: User) -> HumanProfile:
    if user.profile is None:
        user.profile = HumanProfile()
        db.flush()
    return user.profile


def _apply(db: DbSession, profile: HumanProfile, data: dict) -> None:
    if data.get("home_building_id"):
        building = db.get(MapFeature, data["home_building_id"])
        if building is None or building.layer != "building":
            raise HTTPException(status_code=422, detail="home_building_id must be a 'building' map feature")
    for key, value in data.items():
        setattr(profile, key, value)


@router.get("/me", response_model=ProfileRead)
def get_my_profile(user: CurrentUser, db: DbSession) -> HumanProfile:
    profile = _ensure_profile(db, user)
    db.commit()
    return profile


@router.put("/me", response_model=ProfileRead)
def replace_my_profile(body: ProfileFields, user: CurrentUser, db: DbSession) -> HumanProfile:
    """Fill in (or completely replace) your profile."""
    profile = _ensure_profile(db, user)
    _apply(db, profile, body.model_dump())
    db.commit()
    db.refresh(profile)
    return profile


@router.patch("/me", response_model=ProfileRead)
def update_my_profile(body: ProfileUpdate, user: CurrentUser, db: DbSession) -> HumanProfile:
    """Change only the fields you send."""
    profile = _ensure_profile(db, user)
    data = body.model_dump(exclude_unset=True)
    if "priorities" in data and data["priorities"] is not None:
        data["priorities"] = {**(profile.priorities or {}), **data["priorities"]}
    _apply(db, profile, data)
    db.commit()
    db.refresh(profile)
    return profile


@router.get("/{user_id}", response_model=PublicProfile)
def get_public_profile(user_id: uuid.UUID, db: DbSession, _: CurrentUser) -> PublicProfile:
    """What neighbours can see about each other (no allergies, budgets or schedules)."""
    user = get_or_404(db, User, user_id, "User")
    p = user.profile
    return PublicProfile(
        user_id=user.id,
        display_name=user.display_name,
        home_unit=p.home_unit if p else None,
        home_building_id=p.home_building_id if p else None,
        wildlife_comfort=p.wildlife_comfort if p else None,
        bio=p.bio if p else None,
    )
