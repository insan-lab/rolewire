"""Password hashing and JWT issuance/verification for the admin panel."""

from __future__ import annotations

import uuid
from datetime import UTC, datetime, timedelta
from typing import Any, Literal

import jwt
from argon2 import PasswordHasher
from argon2.exceptions import InvalidHashError, VerificationError, VerifyMismatchError

from app.core.config import get_settings

_hasher = PasswordHasher()

TokenType = Literal["access", "refresh"]


class TokenError(Exception):
    """Raised when a token is missing, malformed, expired or of the wrong type."""


def hash_password(password: str) -> str:
    return _hasher.hash(password)


def verify_password(password: str, password_hash: str | None) -> bool:
    if not password_hash:
        return False
    try:
        return _hasher.verify(password_hash, password)
    except (VerifyMismatchError, VerificationError, InvalidHashError):
        return False


def needs_rehash(password_hash: str) -> bool:
    try:
        return _hasher.check_needs_rehash(password_hash)
    except InvalidHashError:  # pragma: no cover - defensive
        return False


def _encode(
    *,
    subject: str,
    tenant_id: str,
    token_type: TokenType,
    ttl_seconds: int,
    extra: dict[str, Any] | None = None,
) -> str:
    settings = get_settings()
    now = datetime.now(UTC)
    payload: dict[str, Any] = {
        "sub": subject,
        "tenant_id": tenant_id,
        "type": token_type,
        "iat": int(now.timestamp()),
        "exp": int((now + timedelta(seconds=ttl_seconds)).timestamp()),
        "jti": uuid.uuid4().hex,
    }
    if extra:
        payload.update(extra)
    return jwt.encode(payload, settings.jwt_secret, algorithm=settings.jwt_algorithm)


def create_access_token(*, user_id: str, tenant_id: str, role: str) -> str:
    return _encode(
        subject=user_id,
        tenant_id=tenant_id,
        token_type="access",
        ttl_seconds=get_settings().access_token_ttl_seconds,
        extra={"role": role},
    )


def create_refresh_token(*, user_id: str, tenant_id: str) -> str:
    return _encode(
        subject=user_id,
        tenant_id=tenant_id,
        token_type="refresh",
        ttl_seconds=get_settings().refresh_token_ttl_seconds,
    )


def decode_token(token: str, *, expected_type: TokenType) -> dict[str, Any]:
    settings = get_settings()
    try:
        claims = jwt.decode(token, settings.jwt_secret, algorithms=[settings.jwt_algorithm])
    except jwt.PyJWTError as exc:
        raise TokenError(str(exc)) from exc
    if claims.get("type") != expected_type:
        raise TokenError(f"expected a {expected_type} token")
    if not claims.get("sub") or not claims.get("tenant_id"):
        raise TokenError("token is missing required claims")
    return claims
