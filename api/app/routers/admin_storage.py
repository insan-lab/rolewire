"""Storage destination management (§6).

Credentials are envelope-encrypted before they touch Postgres and are never returned by the API —
responses expose only the non-secret ``config`` envelope.
"""

from __future__ import annotations

import uuid

from fastapi import APIRouter, HTTPException, Response, status
from sqlalchemy import func, select

from app.core.crypto import EncryptionNotConfigured, encrypt_json
from app.models import Job, StorageConfig
from app.routers.deps import AdminPrincipal, CurrentPrincipal, DbSession
from app.schemas.billing import StorageConfigCreate, StorageConfigOut

router = APIRouter(prefix="/v1/admin/storage-configs", tags=["admin:storage"])


@router.get("", response_model=list[StorageConfigOut])
async def list_storage_configs(
    principal: CurrentPrincipal, session: DbSession
) -> list[StorageConfigOut]:
    rows = await session.scalars(
        select(StorageConfig)
        .where(StorageConfig.tenant_id == principal.tenant_id)
        .order_by(StorageConfig.created_at.desc())
    )
    return [StorageConfigOut.model_validate(row, from_attributes=True) for row in rows]


@router.post("", response_model=StorageConfigOut, status_code=status.HTTP_201_CREATED)
async def create_storage_config(
    payload: StorageConfigCreate, principal: AdminPrincipal, session: DbSession
) -> StorageConfigOut:
    try:
        encrypted = encrypt_json(dict(payload.credentials))
    except EncryptionNotConfigured as exc:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="credential encryption is not configured on this deployment",
        ) from exc

    row = StorageConfig(
        id=uuid.uuid4(),
        tenant_id=principal.tenant_id,
        name=payload.name,
        type=payload.type,
        encrypted_credentials=encrypted,
        config=payload.config,
    )
    session.add(row)
    await session.flush()
    return StorageConfigOut.model_validate(row, from_attributes=True)


@router.delete("/{config_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_storage_config(
    config_id: uuid.UUID, principal: AdminPrincipal, session: DbSession
) -> Response:
    row = await session.scalar(
        select(StorageConfig).where(
            StorageConfig.id == config_id, StorageConfig.tenant_id == principal.tenant_id
        )
    )
    if row is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="storage config not found")
    in_use = await session.scalar(
        select(func.count()).select_from(Job).where(Job.storage_config_id == row.id)
    )
    if in_use:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"storage config is still used by {in_use} job(s)",
        )
    await session.delete(row)
    return Response(status_code=status.HTTP_204_NO_CONTENT)


__all__ = ["router"]
