"""Platform-wide superadmin panel: cross-tenant lists and stats for Rolewire operators.

Every list/stats query relies on the ``platform_read`` RLS policy (0002_platform_admin) unlocked
by ``get_platform_admin`` for the request's whole transaction — there is no per-tenant filter to
apply here, that is the point of this router.
"""

from __future__ import annotations

import uuid

from fastapi import APIRouter, HTTPException, Query, status
from sqlalchemy import func, select

from app.core.config import get_settings
from app.core.rate_limit import hit
from app.core.security import (
    TokenError,
    create_platform_access_token,
    create_platform_refresh_token,
    decode_token,
    verify_password,
)
from app.models import (
    Application,
    ContactSubmission,
    Invoice,
    Job,
    Plan,
    PlatformAdmin,
    Subscription,
    Tenant,
    User,
)
from app.routers.deps import CurrentPlatformAdmin, DbSession
from app.schemas.common import Page
from app.schemas.contact import ContactSubmissionOut, ContactSubmissionStatusUpdate
from app.schemas.platform import (
    PlatformAdminOut,
    PlatformCompanyOut,
    PlatformInvoiceOut,
    PlatformJobOut,
    PlatformLoginRequest,
    PlatformRefreshRequest,
    PlatformStats,
    PlatformTokenPair,
    PlatformUserOut,
)

router = APIRouter(prefix="/v1/admin/platform", tags=["platform"])


def _token_pair(admin: PlatformAdmin) -> PlatformTokenPair:
    return PlatformTokenPair(
        access_token=create_platform_access_token(admin_id=str(admin.id)),
        refresh_token=create_platform_refresh_token(admin_id=str(admin.id)),
        expires_in=get_settings().access_token_ttl_seconds,
    )


@router.post("/auth/login", response_model=PlatformTokenPair)
async def login(payload: PlatformLoginRequest, session: DbSession) -> PlatformTokenPair:
    throttle = await hit(f"platform-login:{payload.email.lower()}", limit=10, window_seconds=300)
    if not throttle.allowed:
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="too many login attempts",
            headers={"Retry-After": str(throttle.retry_after)},
        )

    admin = await session.scalar(
        select(PlatformAdmin).where(func.lower(PlatformAdmin.email) == payload.email.lower())
    )
    if admin is None or not verify_password(payload.password, admin.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, detail="invalid email or password"
        )
    return _token_pair(admin)


@router.post("/auth/refresh", response_model=PlatformTokenPair)
async def refresh(payload: PlatformRefreshRequest, session: DbSession) -> PlatformTokenPair:
    try:
        claims = decode_token(payload.refresh_token, expected_type="platform_refresh")
    except TokenError as exc:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail=str(exc)) from exc

    admin = await session.scalar(
        select(PlatformAdmin).where(PlatformAdmin.id == uuid.UUID(claims["sub"]))
    )
    if admin is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, detail="token subject no longer exists"
        )
    return _token_pair(admin)


@router.get("/auth/me", response_model=PlatformAdminOut)
async def me(admin: CurrentPlatformAdmin) -> PlatformAdminOut:
    return PlatformAdminOut.model_validate(admin, from_attributes=True)


@router.get("/stats", response_model=PlatformStats)
async def stats(admin: CurrentPlatformAdmin, session: DbSession) -> PlatformStats:
    tenants_total = await session.scalar(select(func.count()).select_from(Tenant)) or 0
    tenants_active = (
        await session.scalar(
            select(func.count()).select_from(Tenant).where(Tenant.status == "active")
        )
        or 0
    )
    users_total = await session.scalar(select(func.count()).select_from(User)) or 0
    jobs_total = await session.scalar(select(func.count()).select_from(Job)) or 0
    jobs_published = (
        await session.scalar(
            select(func.count()).select_from(Job).where(Job.status == "published")
        )
        or 0
    )
    applications_total = await session.scalar(select(func.count()).select_from(Application)) or 0
    subscriptions_active = (
        await session.scalar(
            select(func.count()).select_from(Subscription).where(Subscription.status == "active")
        )
        or 0
    )
    revenue_rows = await session.execute(
        select(Invoice.currency, func.sum(Invoice.amount))
        .where(Invoice.status == "paid")
        .group_by(Invoice.currency)
    )
    revenue_paid_total = dict(revenue_rows.all())

    return PlatformStats(
        tenants_total=tenants_total,
        tenants_active=tenants_active,
        users_total=users_total,
        jobs_total=jobs_total,
        jobs_published=jobs_published,
        applications_total=applications_total,
        subscriptions_active=subscriptions_active,
        revenue_paid_total=revenue_paid_total,
    )


@router.get("/users", response_model=Page[PlatformUserOut])
async def list_users(
    admin: CurrentPlatformAdmin,
    session: DbSession,
    limit: int = Query(default=50, ge=1, le=100),
    offset: int = Query(default=0, ge=0),
) -> Page[PlatformUserOut]:
    total = await session.scalar(select(func.count()).select_from(User)) or 0
    rows = await session.execute(
        select(User, Tenant.name, Tenant.slug)
        .join(Tenant, Tenant.id == User.tenant_id)
        .order_by(User.created_at.desc())
        .limit(limit)
        .offset(offset)
    )
    items = [
        PlatformUserOut(
            id=user.id,
            email=user.email,
            role=user.role,
            email_verified=user.email_verified,
            created_at=user.created_at,
            tenant_id=user.tenant_id,
            tenant_name=tenant_name,
            tenant_slug=tenant_slug,
        )
        for user, tenant_name, tenant_slug in rows.all()
    ]
    return Page[PlatformUserOut](items=items, total=int(total), limit=limit, offset=offset)


@router.get("/companies", response_model=Page[PlatformCompanyOut])
async def list_companies(
    admin: CurrentPlatformAdmin,
    session: DbSession,
    limit: int = Query(default=50, ge=1, le=100),
    offset: int = Query(default=0, ge=0),
) -> Page[PlatformCompanyOut]:
    user_counts = (
        select(User.tenant_id, func.count().label("n")).group_by(User.tenant_id).subquery()
    )
    job_counts = select(Job.tenant_id, func.count().label("n")).group_by(Job.tenant_id).subquery()

    total = await session.scalar(select(func.count()).select_from(Tenant)) or 0
    rows = await session.execute(
        select(Tenant, Plan.name, user_counts.c.n, job_counts.c.n)
        .outerjoin(Plan, Plan.id == Tenant.plan_id)
        .outerjoin(user_counts, user_counts.c.tenant_id == Tenant.id)
        .outerjoin(job_counts, job_counts.c.tenant_id == Tenant.id)
        .order_by(Tenant.created_at.desc())
        .limit(limit)
        .offset(offset)
    )
    items = [
        PlatformCompanyOut(
            id=tenant.id,
            name=tenant.name,
            slug=tenant.slug,
            status=tenant.status,
            region=tenant.region,
            payment_provider=tenant.payment_provider,
            plan_name=plan_name,
            created_at=tenant.created_at,
            user_count=user_count or 0,
            job_count=job_count or 0,
        )
        for tenant, plan_name, user_count, job_count in rows.all()
    ]
    return Page[PlatformCompanyOut](items=items, total=int(total), limit=limit, offset=offset)


@router.get("/jobs", response_model=Page[PlatformJobOut])
async def list_jobs(
    admin: CurrentPlatformAdmin,
    session: DbSession,
    limit: int = Query(default=50, ge=1, le=100),
    offset: int = Query(default=0, ge=0),
) -> Page[PlatformJobOut]:
    application_counts = (
        select(Application.job_id, func.count().label("n"))
        .group_by(Application.job_id)
        .subquery()
    )

    total = await session.scalar(select(func.count()).select_from(Job)) or 0
    rows = await session.execute(
        select(Job, Tenant.name, application_counts.c.n)
        .join(Tenant, Tenant.id == Job.tenant_id)
        .outerjoin(application_counts, application_counts.c.job_id == Job.id)
        .order_by(Job.created_at.desc())
        .limit(limit)
        .offset(offset)
    )
    items = [
        PlatformJobOut(
            id=job.id,
            title=job.title,
            status=job.status,
            created_at=job.created_at,
            tenant_id=job.tenant_id,
            tenant_name=tenant_name,
            application_count=application_count or 0,
        )
        for job, tenant_name, application_count in rows.all()
    ]
    return Page[PlatformJobOut](items=items, total=int(total), limit=limit, offset=offset)


@router.get("/billing", response_model=Page[PlatformInvoiceOut])
async def list_billing(
    admin: CurrentPlatformAdmin,
    session: DbSession,
    limit: int = Query(default=50, ge=1, le=100),
    offset: int = Query(default=0, ge=0),
) -> Page[PlatformInvoiceOut]:
    total = await session.scalar(select(func.count()).select_from(Invoice)) or 0
    rows = await session.execute(
        select(Invoice, Tenant.name)
        .join(Tenant, Tenant.id == Invoice.tenant_id)
        .order_by(Invoice.created_at.desc())
        .limit(limit)
        .offset(offset)
    )
    items = [
        PlatformInvoiceOut(
            id=invoice.id,
            provider=invoice.provider,
            amount=invoice.amount,
            currency=invoice.currency,
            status=invoice.status,
            created_at=invoice.created_at,
            tenant_id=invoice.tenant_id,
            tenant_name=tenant_name,
        )
        for invoice, tenant_name in rows.all()
    ]
    return Page[PlatformInvoiceOut](items=items, total=int(total), limit=limit, offset=offset)


@router.get("/contact-submissions", response_model=Page[ContactSubmissionOut])
async def list_contact_submissions(
    admin: CurrentPlatformAdmin,
    session: DbSession,
    status_filter: str | None = Query(default=None, alias="status"),
    limit: int = Query(default=50, ge=1, le=100),
    offset: int = Query(default=0, ge=0),
) -> Page[ContactSubmissionOut]:
    conditions = []
    if status_filter:
        conditions.append(ContactSubmission.status == status_filter)

    total = (
        await session.scalar(
            select(func.count()).select_from(ContactSubmission).where(*conditions)
        )
        or 0
    )
    rows = await session.scalars(
        select(ContactSubmission)
        .where(*conditions)
        .order_by(ContactSubmission.created_at.desc())
        .limit(limit)
        .offset(offset)
    )
    items = [
        ContactSubmissionOut.model_validate(sub, from_attributes=True)
        for sub in rows
    ]
    return Page[ContactSubmissionOut](items=items, total=int(total), limit=limit, offset=offset)


@router.patch("/contact-submissions/{submission_id}", response_model=ContactSubmissionOut)
async def update_contact_submission_status(
    admin: CurrentPlatformAdmin,
    session: DbSession,
    submission_id: uuid.UUID,
    payload: ContactSubmissionStatusUpdate,
) -> ContactSubmissionOut:
    submission = await session.scalar(
        select(ContactSubmission).where(ContactSubmission.id == submission_id)
    )
    if submission is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="contact submission not found"
        )

    submission.status = payload.status
    await session.flush()
    return ContactSubmissionOut.model_validate(submission, from_attributes=True)


__all__ = ["router"]
