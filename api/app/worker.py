"""arq worker: webhook delivery, applicant receipts, usage flush, renewal sweep (§2, §8, §9.4)."""

from __future__ import annotations

import logging
from datetime import UTC, datetime, timedelta
from typing import Any
from uuid import UUID

from sqlalchemy import select

from app.core.config import get_settings
from app.core.db import dispose_engine, get_sessionmaker, tenant_session
from app.models import Application, Job, Subscription, Tenant, User
from app.services import billing, dispatch, email, usage
from app.services.queue import redis_settings

logger = logging.getLogger("rolewire.worker")

RETRY_DELAYS = (60, 300, 1800)


async def forward_application(ctx: dict[str, Any], application_id: str, tenant_id: str) -> str:
    """Forward a received application to the tenant's ATS webhook."""
    delivery_error: dispatch.DeliveryError | None = None
    async with tenant_session(UUID(tenant_id)) as session:
        application = await session.scalar(
            select(Application).where(Application.id == UUID(application_id))
        )
        if application is None:
            return "missing"
        job = await session.scalar(select(Job).where(Job.id == application.job_id))
        if job is None or not job.ats_webhook_url:
            return "no-webhook"

        payload = dispatch.build_payload(
            application={
                "id": str(application.id),
                "job_id": str(application.job_id),
                "answers": application.answers,
                "resume_ref": application.resume_ref,
                "applicant_email": application.applicant_email,
                "created_at": application.created_at,
            },
            job={
                "id": str(job.id),
                "title": job.title,
                "department": job.department,
                "location": job.location,
            },
        )
        try:
            await dispatch.deliver(url=job.ats_webhook_url, payload=payload)
            application.status = "forwarded"
        except dispatch.DeliveryError as exc:
            # Persist the failure before re-raising: raising inside the session would roll the
            # status change back, leaving no trace of the failed delivery.
            application.status = "failed"
            delivery_error = exc
            logger.warning("ats delivery failed for %s: %s", application_id, exc)

    if delivery_error is not None:
        raise delivery_error  # arq retries with backoff
    return "forwarded"


async def send_application_receipt(
    ctx: dict[str, Any], application_id: str, tenant_id: str
) -> str:
    """Email the applicant a receipt, if the tenant's plan includes applicant email."""
    if not get_settings().smtp_host:
        return "no-smtp"
    async with tenant_session(UUID(tenant_id)) as session:
        application = await session.scalar(
            select(Application).where(Application.id == UUID(application_id))
        )
        if application is None or not application.applicant_email:
            return "skipped"
        job = await session.scalar(select(Job).where(Job.id == application.job_id))
        tenant = await session.scalar(select(Tenant).where(Tenant.id == UUID(tenant_id)))
        await email.send_template(
            key="application_received_applicant",
            to_email=application.applicant_email,
            params={
                "job_title": job.title if job else "",
                "company": tenant.name if tenant else "",
            },
        )
    return "sent"


async def flush_usage(ctx: dict[str, Any]) -> int:
    """Hourly: move Redis usage counters into ``usage_events`` for billing reconciliation."""
    async with get_sessionmaker()() as session:
        written = await usage.flush_counters(session)
        await session.commit()
    return written


async def sweep_renewals(ctx: dict[str, Any]) -> dict[str, int]:
    """Daily: emulate recurring billing for the UddoktaPay rail and apply grace-period rules."""
    settings = get_settings()
    now = datetime.now(UTC)
    reminders = 0

    async with get_sessionmaker()() as session:
        due_soon = await session.scalars(
            select(Subscription).where(
                Subscription.provider == "uddoktapay",
                Subscription.status.in_(("active", "past_due")),
                Subscription.current_period_end.is_not(None),
                Subscription.current_period_end < now + timedelta(days=3),
            )
        )
        for subscription in due_soon:
            user = await session.scalar(
                select(User)
                .where(User.tenant_id == subscription.tenant_id, User.role == "admin")
                .limit(1)
            )
            if user is None or not settings.smtp_host:
                continue
            try:
                await email.send_template(
                    key="renewal_reminder",
                    to_email=user.email,
                    params={
                        "renew_url": f"{settings.app_base_url.rstrip('/')}/billing",
                        "period_end": subscription.current_period_end.isoformat()
                        if subscription.current_period_end
                        else "",
                    },
                )
                reminders += 1
            except email.EmailError as exc:
                logger.warning("renewal reminder failed for %s: %s", user.email, exc)

        result = await billing.apply_grace_period_rules(session, now=now)
        await session.commit()

    return {"reminders": reminders, **result}


async def startup(ctx: dict[str, Any]) -> None:
    logging.basicConfig(level=get_settings().log_level.upper())


async def shutdown(ctx: dict[str, Any]) -> None:
    await dispose_engine()


class WorkerSettings:
    functions = [forward_application, send_application_receipt, flush_usage, sweep_renewals]
    on_startup = startup
    on_shutdown = shutdown
    redis_settings = redis_settings()
    max_tries = len(RETRY_DELAYS) + 1
    retry_jobs = True
    cron_jobs: list[Any] = []


def _build_cron_jobs() -> list[Any]:
    from arq import cron

    return [
        cron(flush_usage, minute=5),
        cron(sweep_renewals, hour=3, minute=0),
    ]


WorkerSettings.cron_jobs = _build_cron_jobs()
