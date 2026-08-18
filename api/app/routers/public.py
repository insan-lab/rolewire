"""Public, unauthenticated endpoints (§5.1).

No tenant identifier is ever accepted from the caller. Tenancy is resolved server-side from the
non-guessable ``job_id`` (or a company ``slug``), and the RLS context is set from the resolved job
record before anything is written.
"""

from __future__ import annotations

import uuid
from typing import Annotated

from fastapi import (
    APIRouter,
    Depends,
    File,
    Form,
    HTTPException,
    Request,
    Response,
    UploadFile,
    status,
)
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.config import get_settings
from app.core.crypto import hash_ip
from app.core.db import get_db, set_public_context, set_tenant_context
from app.core.rate_limit import hit
from app.models import Application, Job, StorageConfig, Tenant
from app.routers.deps import client_ip
from app.schemas.jobs import (
    ApplicationAccepted,
    ApplicationSubmit,
    PublicJob,
    PublicJobList,
    PublicJobSummary,
    PublicQuestion,
    UploadTicket,
    UploadTicketRequest,
)
from app.services import storage, usage
from app.services.answers import (
    AnswerValidationError,
    resume_ref_from_answers,
    validate_answers,
)
from app.services.queue import enqueue

router = APIRouter(prefix="/v1/public", tags=["public"])

DbSession = Annotated[AsyncSession, Depends(get_db)]

SUSPENDED_DETAIL = (
    "This job board is temporarily unavailable. The employer needs to renew their Rolewire plan."
)


async def _rate_limit(request: Request, *, key: str, limit: int, window: int) -> None:
    result = await hit(key, limit=limit, window_seconds=window)
    if not result.allowed:
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="rate limit exceeded",
            headers={"Retry-After": str(result.retry_after)},
        )


async def _resolve_published_job(session: AsyncSession, job_id: uuid.UUID) -> tuple[Job, Tenant]:
    """Look up a published job and its owning tenant, then pin the RLS tenant context."""
    await set_public_context(session)
    job = await session.scalar(
        select(Job)
        .options(selectinload(Job.questions), selectinload(Job.storage_config))
        .where(Job.id == job_id, Job.status == "published")
    )
    if job is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="job not found")

    tenant = await session.scalar(select(Tenant).where(Tenant.id == job.tenant_id))
    if tenant is None:  # pragma: no cover - FK guarantees this
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="job not found")
    if tenant.status == "suspended":
        raise HTTPException(status_code=status.HTTP_410_GONE, detail=SUSPENDED_DETAIL)

    await set_tenant_context(session, job.tenant_id)
    return job, tenant


def _public_questions(job: Job) -> list[PublicQuestion]:
    return [
        PublicQuestion(
            field_key=question.field_key,
            label=question.label,
            type=question.question_type,  # type: ignore[arg-type]
            options=question.options,
            required=question.required,
        )
        for question in sorted(job.questions, key=lambda q: (q.sort_order, q.label))
    ]


@router.get("/jobs", response_model=PublicJobList, summary="List published jobs")
async def list_jobs(
    request: Request,
    session: DbSession,
    slug: str | None = None,
    limit: int = 50,
    offset: int = 0,
) -> PublicJobList:
    settings = get_settings()
    await _rate_limit(
        request,
        key=f"public:list:{hash_ip(client_ip(request))}",
        limit=settings.public_read_rate_limit,
        window=settings.public_read_rate_window_seconds,
    )
    limit = max(1, min(limit, 100))
    offset = max(0, offset)

    await set_public_context(session)
    tenant_id: uuid.UUID | None = None
    if slug:
        tenant = await session.scalar(select(Tenant).where(Tenant.slug == slug))
        if tenant is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="company not found")
        if tenant.status == "suspended":
            raise HTTPException(status_code=status.HTTP_410_GONE, detail=SUSPENDED_DETAIL)
        tenant_id = tenant.id
        await set_tenant_context(session, tenant_id)

    conditions = [Job.status == "published"]
    if tenant_id is not None:
        conditions.append(Job.tenant_id == tenant_id)

    total = await session.scalar(select(func.count()).select_from(Job).where(*conditions)) or 0
    rows = await session.scalars(
        select(Job).where(*conditions).order_by(Job.created_at.desc()).limit(limit).offset(offset)
    )
    return PublicJobList(
        items=[PublicJobSummary.model_validate(job, from_attributes=True) for job in rows],
        total=int(total),
    )


@router.get("/jobs/{job_id}", response_model=PublicJob, summary="Job post with its questions")
async def get_job(request: Request, job_id: uuid.UUID, session: DbSession) -> PublicJob:
    settings = get_settings()
    await _rate_limit(
        request,
        key=f"public:get:{hash_ip(client_ip(request))}",
        limit=settings.public_read_rate_limit,
        window=settings.public_read_rate_window_seconds,
    )
    job, tenant = await _resolve_published_job(session, job_id)
    return PublicJob(
        id=job.id,
        title=job.title,
        description=job.description,
        location=job.location,
        employment_type=job.employment_type,
        department=job.department,
        created_at=job.created_at,
        company=tenant.name,
        questions=_public_questions(job),
    )


@router.post(
    "/jobs/{job_id}/upload-ticket",
    response_model=UploadTicket,
    summary="Request a direct-to-storage upload ticket for a file question",
)
async def create_upload_ticket(
    request: Request,
    job_id: uuid.UUID,
    payload: UploadTicketRequest,
    session: DbSession,
) -> UploadTicket:
    await _rate_limit(
        request,
        key=f"public:ticket:{job_id}:{hash_ip(client_ip(request))}",
        limit=10,
        window=600,
    )
    job, _ = await _resolve_published_job(session, job_id)

    question = next(
        (q for q in job.questions if q.field_key == payload.field_key), None
    )
    if question is None or question.question_type != "file":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"'{payload.field_key}' is not a file question on this job",
        )

    try:
        ticket = await storage.create_upload_ticket(
            job=job,
            storage_config=job.storage_config,
            filename=payload.filename,
            content_type=payload.content_type,
            size_bytes=payload.size_bytes,
        )
    except storage.StorageNotConfigured as exc:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(exc)) from exc
    except storage.StorageError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc

    return UploadTicket(
        mode=ticket.mode,  # type: ignore[arg-type]
        upload_url=ticket.upload_url,
        fields=ticket.fields or {},
        resume_ref=ticket.resume_ref,
        expires_in=ticket.expires_in,
        max_bytes=ticket.max_bytes,
    )


@router.post(
    "/jobs/{job_id}/uploads",
    summary="Server-relayed upload (Telegram targets, which have no presigned URLs)",
)
async def relay_upload(
    request: Request,
    job_id: uuid.UUID,
    session: DbSession,
    field_key: Annotated[str, Form()],
    file: Annotated[UploadFile, File()],
) -> dict[str, str]:
    await _rate_limit(
        request,
        key=f"public:relay:{job_id}:{hash_ip(client_ip(request))}",
        limit=10,
        window=600,
    )
    job, _ = await _resolve_published_job(session, job_id)
    if job.storage_target != "telegram":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="this job uses direct-to-storage uploads; request an upload ticket instead",
        )
    question = next((q for q in job.questions if q.field_key == field_key), None)
    if question is None or question.question_type != "file":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"'{field_key}' is not a file question on this job",
        )

    max_bytes = min(get_settings().max_upload_bytes, storage.TELEGRAM_MAX_BYTES)
    content = await file.read(max_bytes + 1)
    if len(content) > max_bytes:
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail=f"file exceeds the {max_bytes} byte limit for this destination",
        )

    storage_config: StorageConfig | None = job.storage_config
    if storage_config is None:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="job storage target has no storage config attached",
        )
    try:
        ref = await storage.relay_to_telegram(
            storage_config=storage_config,
            filename=file.filename or "upload.bin",
            content=content,
            caption=f"{job.title} — application upload",
        )
    except storage.StorageError as exc:
        raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail=str(exc)) from exc

    await usage.record(job.tenant_id, "storage_mb", len(content) / (1024 * 1024))
    return {"resume_ref": ref}


@router.post(
    "/jobs/{job_id}/apply",
    response_model=ApplicationAccepted,
    status_code=status.HTTP_201_CREATED,
    summary="Submit an application",
)
async def apply(
    request: Request,
    response: Response,
    job_id: uuid.UUID,
    payload: ApplicationSubmit,
    session: DbSession,
) -> ApplicationAccepted:
    settings = get_settings()
    ip_digest = hash_ip(client_ip(request))
    await _rate_limit(
        request,
        key=f"public:apply:{job_id}:{ip_digest}",
        limit=settings.public_apply_rate_limit,
        window=settings.public_apply_rate_window_seconds,
    )
    job, _ = await _resolve_published_job(session, job_id)

    try:
        cleaned = validate_answers(list(job.questions), payload.answers)
    except AnswerValidationError as exc:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail={"message": "answer validation failed", "errors": exc.errors},
        ) from exc

    application = Application(
        id=uuid.uuid4(),
        job_id=job.id,
        tenant_id=job.tenant_id,
        answers=cleaned,
        resume_ref=payload.resume_ref or resume_ref_from_answers(list(job.questions), cleaned),
        applicant_email=(payload.applicant_email or _email_from_answers(job, cleaned)),
        ip_hash=ip_digest,
        status="received",
    )
    session.add(application)
    await session.flush()

    await usage.record(job.tenant_id, "application_received", 1)
    if job.ats_webhook_url or job.opencats_sync:
        await enqueue("forward_application", str(application.id), str(job.tenant_id))
    if application.applicant_email:
        await enqueue(
            "send_application_receipt", str(application.id), str(job.tenant_id)
        )

    response.headers["Location"] = f"/v1/admin/applications/{application.id}"
    return ApplicationAccepted(
        id=application.id, status=application.status, received_at=application.created_at
    )


def _email_from_answers(job: Job, cleaned: dict[str, object]) -> str | None:
    for question in sorted(job.questions, key=lambda q: q.sort_order):
        if question.question_type == "email" and cleaned.get(question.field_key):
            return str(cleaned[question.field_key])
    return None
