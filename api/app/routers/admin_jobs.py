"""Tenant-scoped job and application management (§5.2).

Every query keeps an explicit ``tenant_id`` filter *and* runs under the RLS context set by the
auth dependency — application-layer filtering plus RLS as defense in depth (§12).
"""

from __future__ import annotations

import uuid

from fastapi import APIRouter, HTTPException, Query, Response, status
from sqlalchemy import delete, func, select
from sqlalchemy.orm import selectinload

from app.models import Application, Job, JobQuestion, StorageConfig
from app.routers.deps import AdminPrincipal, CurrentPrincipal, DbSession
from app.schemas.common import Page
from app.schemas.jobs import (
    ApplicationOut,
    JobCreate,
    JobOut,
    JobQuestionOut,
    JobQuestionsReplace,
    JobUpdate,
)

router = APIRouter(prefix="/v1/admin", tags=["admin:jobs"])


async def _get_job(session: DbSession, tenant_id: uuid.UUID, job_id: uuid.UUID) -> Job:
    job = await session.scalar(
        select(Job)
        .options(selectinload(Job.questions))
        .where(Job.id == job_id, Job.tenant_id == tenant_id)
    )
    if job is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="job not found")
    return job


async def _validate_storage_config(
    session: DbSession, tenant_id: uuid.UUID, storage_target: str, storage_config_id: uuid.UUID | None
) -> None:
    if storage_target == "hosted":
        return
    config = await session.scalar(
        select(StorageConfig).where(
            StorageConfig.id == storage_config_id, StorageConfig.tenant_id == tenant_id
        )
    )
    if config is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail="storage_config_id not found"
        )
    if config.type != storage_target:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"storage config is of type '{config.type}', not '{storage_target}'",
        )


@router.get("/jobs", response_model=Page[JobOut])
async def list_jobs(
    principal: CurrentPrincipal,
    session: DbSession,
    status_filter: str | None = Query(default=None, alias="status"),
    limit: int = Query(default=50, ge=1, le=100),
    offset: int = Query(default=0, ge=0),
) -> Page[JobOut]:
    conditions = [Job.tenant_id == principal.tenant_id]
    if status_filter:
        conditions.append(Job.status == status_filter)
    total = await session.scalar(select(func.count()).select_from(Job).where(*conditions)) or 0
    rows = await session.scalars(
        select(Job)
        .options(selectinload(Job.questions))
        .where(*conditions)
        .order_by(Job.created_at.desc())
        .limit(limit)
        .offset(offset)
    )
    return Page[JobOut](
        items=[JobOut.model_validate(job, from_attributes=True) for job in rows],
        total=int(total),
        limit=limit,
        offset=offset,
    )


@router.post("/jobs", response_model=JobOut, status_code=status.HTTP_201_CREATED)
async def create_job(
    payload: JobCreate, principal: AdminPrincipal, session: DbSession
) -> JobOut:
    await _validate_storage_config(
        session, principal.tenant_id, payload.storage_target, payload.storage_config_id
    )
    job = Job(
        id=uuid.uuid4(),
        tenant_id=principal.tenant_id,
        **payload.model_dump(exclude={"questions"}),
    )
    session.add(job)
    for index, question in enumerate(payload.questions):
        session.add(
            JobQuestion(
                id=uuid.uuid4(),
                job_id=job.id,
                tenant_id=principal.tenant_id,
                label=question.label,
                field_key=question.field_key,
                question_type=question.question_type,
                options=question.options,
                required=question.required,
                sort_order=question.sort_order or index,
            )
        )
    await session.flush()
    await session.refresh(job, ["questions"])
    return JobOut.model_validate(job, from_attributes=True)


@router.get("/jobs/{job_id}", response_model=JobOut)
async def get_job(
    job_id: uuid.UUID, principal: CurrentPrincipal, session: DbSession
) -> JobOut:
    job = await _get_job(session, principal.tenant_id, job_id)
    return JobOut.model_validate(job, from_attributes=True)


@router.patch("/jobs/{job_id}", response_model=JobOut)
async def update_job(
    job_id: uuid.UUID, payload: JobUpdate, principal: AdminPrincipal, session: DbSession
) -> JobOut:
    job = await _get_job(session, principal.tenant_id, job_id)
    changes = payload.model_dump(exclude_unset=True)

    target = changes.get("storage_target", job.storage_target)
    config_id = changes.get("storage_config_id", job.storage_config_id)
    if target == "hosted":
        changes["storage_config_id"] = None
    else:
        await _validate_storage_config(session, principal.tenant_id, target, config_id)

    for field, value in changes.items():
        setattr(job, field, value)
    await session.flush()
    await session.refresh(job, ["questions"])
    return JobOut.model_validate(job, from_attributes=True)


@router.delete("/jobs/{job_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_job(
    job_id: uuid.UUID, principal: AdminPrincipal, session: DbSession
) -> Response:
    job = await _get_job(session, principal.tenant_id, job_id)
    received = await session.scalar(
        select(func.count()).select_from(Application).where(Application.job_id == job.id)
    )
    if received:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=(
                f"job has {received} application(s); close it instead of deleting to preserve "
                "applicant records"
            ),
        )
    await session.delete(job)
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.post(
    "/jobs/{job_id}/questions",
    response_model=list[JobQuestionOut],
    summary="Replace a job's question set",
)
async def replace_questions(
    job_id: uuid.UUID,
    payload: JobQuestionsReplace,
    principal: AdminPrincipal,
    session: DbSession,
) -> list[JobQuestionOut]:
    job = await _get_job(session, principal.tenant_id, job_id)
    await session.execute(
        delete(JobQuestion).where(
            JobQuestion.job_id == job.id, JobQuestion.tenant_id == principal.tenant_id
        )
    )
    created: list[JobQuestion] = []
    for index, question in enumerate(payload.questions):
        row = JobQuestion(
            id=uuid.uuid4(),
            job_id=job.id,
            tenant_id=principal.tenant_id,
            label=question.label,
            field_key=question.field_key,
            question_type=question.question_type,
            options=question.options,
            required=question.required,
            sort_order=question.sort_order or index,
        )
        session.add(row)
        created.append(row)
    await session.flush()
    return [JobQuestionOut.model_validate(row, from_attributes=True) for row in created]


@router.get("/applications", response_model=Page[ApplicationOut])
async def list_applications(
    principal: CurrentPrincipal,
    session: DbSession,
    job_id: uuid.UUID | None = None,
    limit: int = Query(default=50, ge=1, le=100),
    offset: int = Query(default=0, ge=0),
) -> Page[ApplicationOut]:
    conditions = [Application.tenant_id == principal.tenant_id]
    if job_id is not None:
        conditions.append(Application.job_id == job_id)
    total = (
        await session.scalar(select(func.count()).select_from(Application).where(*conditions)) or 0
    )
    rows = await session.scalars(
        select(Application)
        .where(*conditions)
        .order_by(Application.created_at.desc())
        .limit(limit)
        .offset(offset)
    )
    return Page[ApplicationOut](
        items=[ApplicationOut.model_validate(row, from_attributes=True) for row in rows],
        total=int(total),
        limit=limit,
        offset=offset,
    )


@router.get("/applications/{application_id}", response_model=ApplicationOut)
async def get_application(
    application_id: uuid.UUID, principal: CurrentPrincipal, session: DbSession
) -> ApplicationOut:
    row = await session.scalar(
        select(Application).where(
            Application.id == application_id, Application.tenant_id == principal.tenant_id
        )
    )
    if row is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="application not found")
    return ApplicationOut.model_validate(row, from_attributes=True)


__all__ = ["router"]
