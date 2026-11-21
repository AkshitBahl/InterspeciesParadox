"""Register, log in, refresh tokens, who am I."""

from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy import select

from app.api.deps import CurrentUser, DbSession
from app.core.config import settings
from app.core.security import (
    TokenError,
    create_token,
    decode_token,
    hash_password,
    verify_password,
)
from app.models import HumanProfile, User
from app.schemas.user import (
    LoginRequest,
    RefreshRequest,
    RegisterRequest,
    TokenPair,
    UserRead,
)

router = APIRouter(prefix="/auth", tags=["auth"])


def _tokens(user: User) -> TokenPair:
    return TokenPair(
        access_token=create_token(user.id, "access"),
        refresh_token=create_token(user.id, "refresh"),
        expires_in=settings.access_token_expire_minutes * 60,
    )


def _authenticate(db: DbSession, email: str, password: str) -> User:
    user = db.scalars(select(User).where(User.email == email.lower())).first()
    if user is None or not verify_password(password, user.hashed_password):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Wrong email or password")
    if not user.is_active:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Account disabled")
    return user


@router.post("/register", response_model=UserRead, status_code=status.HTTP_201_CREATED)
def register(body: RegisterRequest, db: DbSession) -> User:
    """Create an account. An empty human profile is created too (fill it with PUT /profiles/me)."""
    email = body.email.lower()
    if db.scalars(select(User).where(User.email == email)).first():
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Email already registered")
    user = User(email=email, display_name=body.display_name, hashed_password=hash_password(body.password))
    user.profile = HumanProfile()
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


@router.post("/login", response_model=TokenPair)
def login(body: LoginRequest, db: DbSession) -> TokenPair:
    """JSON login for the frontend."""
    return _tokens(_authenticate(db, body.email, body.password))


@router.post("/token", response_model=TokenPair, include_in_schema=True)
def token(form: Annotated[OAuth2PasswordRequestForm, Depends()], db: DbSession) -> TokenPair:
    """OAuth2 form login (used by the 'Authorize' button in /docs). Username = email."""
    return _tokens(_authenticate(db, form.username, form.password))


@router.post("/refresh", response_model=TokenPair)
def refresh(body: RefreshRequest, db: DbSession) -> TokenPair:
    try:
        user_id = decode_token(body.refresh_token, "refresh")
    except TokenError as exc:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail=str(exc)) from exc
    user = db.get(User, user_id)
    if user is None or not user.is_active:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="User not found")
    return _tokens(user)


@router.get("/me", response_model=UserRead)
def me(user: CurrentUser) -> User:
    return user
