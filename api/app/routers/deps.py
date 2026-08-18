"""Shared FastAPI dependencies: authentication and the RLS tenant context."""

from __future__ import annotations

import uuid
from dataclasses import dataclass
from typing import Annotated

from fastapi import Depends, HTTPException, Request, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.db import get_db, set_platform_context, set_tenant_context
from app.core.security import TokenError, decode_token
from app.models import PlatformAdmin, Tenant, User

bearer_scheme = HTTPBearer(auto_error=False, description="Admin panel access token")

DbSession = Annotated[AsyncSession, Depends(get_db)]


@dataclass(frozen=True)
class Principal:
    user: User
    tenant: Tenant

    @property
    def tenant_id(self) -> uuid.UUID:
        return self.tenant.id

    @property
    def is_admin(self) -> bool:
        return self.user.role == "admin"


def _unauthorized(detail: str) -> HTTPException:
    return HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail=detail,
        headers={"WWW-Authenticate": "Bearer"},
    )


async def get_principal(
    session: DbSession,
    credentials: Annotated[HTTPAuthorizationCredentials | None, Depends(bearer_scheme)] = None,
) -> Principal:
    """Verify the access token, then pin the transaction to the token's tenant for RLS."""
    if credentials is None or not credentials.credentials:
        raise _unauthorized("missing bearer token")
    try:
        claims = decode_token(credentials.credentials, expected_type="access")
    except TokenError as exc:
        raise _unauthorized(str(exc)) from exc

    try:
        tenant_id = uuid.UUID(claims["tenant_id"])
        user_id = uuid.UUID(claims["sub"])
    except (ValueError, KeyError) as exc:
        raise _unauthorized("malformed token claims") from exc

    # RLS context must be established before any tenant-scoped query runs.
    await set_tenant_context(session, tenant_id)

    user = await session.scalar(select(User).where(User.id == user_id))
    if user is None or user.tenant_id != tenant_id:
        raise _unauthorized("token subject no longer exists")

    tenant = await session.scalar(select(Tenant).where(Tenant.id == tenant_id))
    if tenant is None:
        raise _unauthorized("tenant no longer exists")

    return Principal(user=user, tenant=tenant)


CurrentPrincipal = Annotated[Principal, Depends(get_principal)]


async def require_admin(principal: CurrentPrincipal) -> Principal:
    if not principal.is_admin:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN, detail="admin role required"
        )
    return principal


AdminPrincipal = Annotated[Principal, Depends(require_admin)]


async def get_platform_admin(
    session: DbSession,
    credentials: Annotated[HTTPAuthorizationCredentials | None, Depends(bearer_scheme)] = None,
) -> PlatformAdmin:
    """Verify a platform token and unlock the cross-tenant ``platform_read`` RLS policies."""
    if credentials is None or not credentials.credentials:
        raise _unauthorized("missing bearer token")
    try:
        claims = decode_token(credentials.credentials, expected_type="platform_access")
    except TokenError as exc:
        raise _unauthorized(str(exc)) from exc

    try:
        admin_id = uuid.UUID(claims["sub"])
    except ValueError as exc:
        raise _unauthorized("malformed token claims") from exc

    await set_platform_context(session)

    admin = await session.scalar(select(PlatformAdmin).where(PlatformAdmin.id == admin_id))
    if admin is None:
        raise _unauthorized("token subject no longer exists")
    return admin


CurrentPlatformAdmin = Annotated[PlatformAdmin, Depends(get_platform_admin)]


def client_ip(request: Request) -> str | None:
    """Left-most X-Forwarded-For entry when behind the reverse proxy, else the socket peer."""
    forwarded = request.headers.get("x-forwarded-for")
    if forwarded:
        return forwarded.split(",")[0].strip()
    return request.client.host if request.client else None
