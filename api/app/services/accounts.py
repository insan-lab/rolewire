"""Tenant + user provisioning and lookup.

The "a user must have a password OR at least one linked OAuth identity" rule from §4 is enforced
here, at the application layer, because Postgres CHECK constraints cannot span tables.
"""

from __future__ import annotations

import re
import secrets
import uuid

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.db import set_auth_context, set_tenant_context
from app.core.security import hash_password, verify_password
from app.models import OAuthAccount, Plan, Tenant, User

_SLUG_RE = re.compile(r"[^a-z0-9]+")


class AccountError(Exception):
    pass


class EmailAlreadyRegistered(AccountError):
    pass


class InvalidLoginMethod(AccountError):
    """Raised when an operation would leave a user with no way to log in."""


class IncorrectPassword(AccountError):
    pass


class EmailNotVerified(AccountError):
    """Raised when changing email while the current address is still unverified."""


class SlugAlreadyTaken(AccountError):
    pass


def slugify(value: str) -> str:
    slug = _SLUG_RE.sub("-", value.strip().lower()).strip("-")
    return (slug or "tenant")[:48]


async def _unique_slug(session: AsyncSession, desired: str) -> str:
    base = slugify(desired)
    candidate = base
    for _ in range(5):
        exists = await session.scalar(select(Tenant.id).where(Tenant.slug == candidate))
        if exists is None:
            return candidate
        candidate = f"{base}-{secrets.token_hex(2)}"
    raise AccountError("could not allocate a unique tenant slug")


async def get_user_by_email(session: AsyncSession, email: str) -> User | None:
    """Pre-authentication lookup: runs under the SELECT-only auth RLS context."""
    await set_auth_context(session)
    return await session.scalar(select(User).where(func.lower(User.email) == email.lower()))


async def get_oauth_account(
    session: AsyncSession, *, provider: str, provider_user_id: str
) -> OAuthAccount | None:
    await set_auth_context(session)
    return await session.scalar(
        select(OAuthAccount).where(
            OAuthAccount.provider == provider,
            OAuthAccount.provider_user_id == provider_user_id,
        )
    )


async def get_user_by_id(session: AsyncSession, user_id: uuid.UUID) -> User | None:
    await set_auth_context(session)
    return await session.scalar(select(User).where(User.id == user_id))


async def default_plan(session: AsyncSession) -> Plan | None:
    return await session.scalar(select(Plan).order_by(Plan.monthly_price_usd.asc()).limit(1))


async def create_tenant_with_owner(
    session: AsyncSession,
    *,
    email: str,
    company_name: str,
    slug: str | None = None,
    password: str | None = None,
    oauth: dict[str, object] | None = None,
    email_verified: bool = False,
    avatar_url: str | None = None,
) -> tuple[Tenant, User]:
    """Create a tenant and its first admin user in one transaction."""
    if password is None and oauth is None:
        raise InvalidLoginMethod("a new user needs either a password or a linked OAuth identity")
    if await get_user_by_email(session, email) is not None:
        raise EmailAlreadyRegistered(email)

    plan = await default_plan(session)
    tenant = Tenant(
        id=uuid.uuid4(),
        name=company_name.strip(),
        slug=await _unique_slug(session, slug or company_name),
        plan_id=plan.id if plan else None,
        status="active",
    )
    session.add(tenant)
    await session.flush()
    # Tenant-scoped inserts below are checked by RLS, so bind the context to the new tenant.
    await set_tenant_context(session, tenant.id)

    user = User(
        id=uuid.uuid4(),
        tenant_id=tenant.id,
        email=email.lower(),
        email_verified=email_verified,
        password_hash=hash_password(password) if password else None,
        avatar_url=avatar_url,
        role="admin",
    )
    session.add(user)

    if oauth is not None:
        session.add(
            OAuthAccount(
                id=uuid.uuid4(),
                user_id=user.id,
                provider=str(oauth["provider"]),
                provider_user_id=str(oauth["provider_user_id"]),
                provider_email=oauth.get("provider_email"),  # type: ignore[arg-type]
                raw_profile=oauth.get("raw_profile"),  # type: ignore[arg-type]
            )
        )

    await session.flush()
    return tenant, user


async def link_oauth_account(
    session: AsyncSession,
    *,
    user: User,
    provider: str,
    provider_user_id: str,
    provider_email: str | None = None,
    raw_profile: dict[str, object] | None = None,
) -> OAuthAccount:
    await set_tenant_context(session, user.tenant_id)
    account = OAuthAccount(
        id=uuid.uuid4(),
        user_id=user.id,
        provider=provider,
        provider_user_id=provider_user_id,
        provider_email=provider_email,
        raw_profile=raw_profile,
    )
    session.add(account)
    await session.flush()
    return account


async def linked_providers(session: AsyncSession, user_id: uuid.UUID) -> list[str]:
    rows = await session.scalars(
        select(OAuthAccount.provider).where(OAuthAccount.user_id == user_id)
    )
    return list(rows)


async def change_password(
    session: AsyncSession, *, user: User, current_password: str, new_password: str
) -> None:
    """Set a new password. If one is already set, the current one must verify first."""
    if user.password_hash and not verify_password(current_password, user.password_hash):
        raise IncorrectPassword("current password is incorrect")
    await set_tenant_context(session, user.tenant_id)
    user.password_hash = hash_password(new_password)
    await session.flush()


async def change_email(
    session: AsyncSession, *, user: User, new_email: str, current_password: str
) -> None:
    """Change email. Requires the current address to already be verified (per policy)."""
    if not user.email_verified:
        raise EmailNotVerified("verify your current email before changing it")
    if not verify_password(current_password, user.password_hash):
        raise IncorrectPassword("current password is incorrect")
    new_email = new_email.lower()
    if new_email == user.email:
        return
    existing = await get_user_by_email(session, new_email)
    if existing is not None:
        raise EmailAlreadyRegistered(new_email)
    await set_tenant_context(session, user.tenant_id)
    user.email = new_email
    # ponytail: no re-verification email flow exists yet, so the new address starts unverified.
    user.email_verified = False
    await session.flush()


async def update_tenant(
    session: AsyncSession, *, tenant: Tenant, name: str, slug: str | None = None
) -> None:
    await set_tenant_context(session, tenant.id)
    tenant.name = name.strip()
    if slug is not None and slug != tenant.slug:
        taken = await session.scalar(select(Tenant.id).where(Tenant.slug == slug))
        if taken is not None:
            raise SlugAlreadyTaken(slug)
        tenant.slug = slug
    await session.flush()


async def unlink_provider(session: AsyncSession, user: User, provider: str) -> None:
    account = await session.scalar(
        select(OAuthAccount).where(
            OAuthAccount.user_id == user.id, OAuthAccount.provider == provider
        )
    )
    if account is None:
        raise AccountError(f"no linked {provider} account")
    remaining = [p for p in await linked_providers(session, user.id) if p != provider]
    if not remaining and not user.password_hash:
        raise InvalidLoginMethod(
            "cannot unlink the only login method; set a password first"
        )
    await session.delete(account)
