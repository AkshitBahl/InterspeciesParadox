"""Passwords (Argon2) and JWT tokens.

Step by step:
1. On register we hash the password with Argon2 and only store the hash.
2. On login we verify the password against that hash.
3. If it matches we hand out two JWTs:
   - an *access* token (short lived, sent as `Authorization: Bearer <token>`),
   - a *refresh* token (longer lived, only used to get a new access token).
"""

import uuid
from datetime import timedelta
from typing import Any, Literal

import jwt
from argon2 import PasswordHasher
from argon2.exceptions import InvalidHashError, VerificationError, VerifyMismatchError

from app.core import clock
from app.core.config import settings

_hasher = PasswordHasher()

TokenType = Literal["access", "refresh"]


def hash_password(password: str) -> str:
    return _hasher.hash(password)


def verify_password(password: str, hashed: str) -> bool:
    try:
        return _hasher.verify(hashed, password)
    except (VerifyMismatchError, VerificationError, InvalidHashError):
        return False


def create_token(subject: uuid.UUID | str, token_type: TokenType = "access") -> str:
    issued = clock.now()
    if token_type == "access":
        expires = issued + timedelta(minutes=settings.access_token_expire_minutes)
    else:
        expires = issued + timedelta(days=settings.refresh_token_expire_days)
    payload: dict[str, Any] = {
        "sub": str(subject),
        "type": token_type,
        "iat": issued,
        "exp": expires,
        "jti": uuid.uuid4().hex,
    }
    return jwt.encode(payload, settings.jwt_secret_key, algorithm=settings.jwt_algorithm)


class TokenError(Exception):
    pass


def decode_token(token: str, expected_type: TokenType = "access") -> uuid.UUID:
    """Return the user id inside a valid token, or raise TokenError."""
    try:
        payload = jwt.decode(token, settings.jwt_secret_key, algorithms=[settings.jwt_algorithm])
    except jwt.ExpiredSignatureError as exc:
        raise TokenError("Token has expired") from exc
    except jwt.InvalidTokenError as exc:
        raise TokenError("Invalid token") from exc
    if payload.get("type") != expected_type:
        raise TokenError(f"Expected a {expected_type} token")
    try:
        return uuid.UUID(payload["sub"])
    except (KeyError, ValueError) as exc:
        raise TokenError("Invalid token subject") from exc
