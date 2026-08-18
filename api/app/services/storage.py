"""Storage adapters for the four destination modes in §6.

Upload flow (§5.1): the client asks for an upload ticket, uploads the file directly to the
destination, then submits the application referencing the returned ``resume_ref``. FastAPI stays
off the file-proxy path for every target that supports presigned URLs. Telegram has no presigned
upload concept, so it falls back to a server-side relay through the Bot API.
"""

from __future__ import annotations

import json
import re
import unicodedata
import uuid
from dataclasses import dataclass
from datetime import UTC, datetime, timedelta
from typing import Any

import httpx
import jwt

from app.core.config import get_settings
from app.core.crypto import decrypt_json
from app.models import Job, StorageConfig
from app.services.sigv4 import presign_url

UPLOAD_TICKET_TTL = 900
TELEGRAM_MAX_BYTES = 50 * 1024 * 1024  # Bot API sendDocument ceiling (open question §14.3)

_SAFE_NAME_RE = re.compile(r"[^A-Za-z0-9._-]+")


class StorageError(RuntimeError):
    pass


class StorageNotConfigured(StorageError):
    pass


@dataclass(frozen=True)
class UploadTicketData:
    mode: str
    resume_ref: str
    upload_url: str | None = None
    fields: dict[str, str] | None = None
    expires_in: int = UPLOAD_TICKET_TTL
    max_bytes: int = 0


def sanitize_filename(filename: str) -> str:
    normalized = unicodedata.normalize("NFKD", filename).encode("ascii", "ignore").decode()
    cleaned = _SAFE_NAME_RE.sub("_", normalized).strip("._")
    return cleaned[:120] or "upload.bin"


def object_key(*, tenant_id: uuid.UUID, job_id: uuid.UUID, filename: str) -> str:
    today = datetime.now(UTC).strftime("%Y/%m/%d")
    return f"applications/{tenant_id}/{job_id}/{today}/{uuid.uuid4().hex}-{sanitize_filename(filename)}"


def _s3_ticket(
    *,
    endpoint: str,
    bucket: str,
    region: str,
    access_key_id: str,
    secret_access_key: str,
    key: str,
    scheme: str,
    max_bytes: int,
) -> UploadTicketData:
    if not (endpoint and bucket and access_key_id and secret_access_key):
        raise StorageNotConfigured("S3 target is missing endpoint/bucket/credentials")
    url = presign_url(
        method="PUT",
        endpoint=endpoint,
        bucket=bucket,
        key=key,
        access_key_id=access_key_id,
        secret_access_key=secret_access_key,
        region=region,
        expires_in=UPLOAD_TICKET_TTL,
    )
    return UploadTicketData(
        mode="presigned",
        resume_ref=f"{scheme}://{bucket}/{key}",
        upload_url=url,
        fields={},
        max_bytes=max_bytes,
    )


async def _gdrive_access_token(credentials: dict[str, Any]) -> str:
    """Exchange a service-account JWT assertion for a Drive access token."""
    raw = credentials.get("service_account_json")
    if isinstance(raw, str):
        try:
            info = json.loads(raw)
        except json.JSONDecodeError as exc:
            raise StorageNotConfigured("service_account_json is not valid JSON") from exc
    elif isinstance(raw, dict):
        info = raw
    else:
        raise StorageNotConfigured("service_account_json is required for gdrive targets")

    now = datetime.now(UTC)
    assertion = jwt.encode(
        {
            "iss": info["client_email"],
            "scope": "https://www.googleapis.com/auth/drive.file",
            "aud": info.get("token_uri", "https://oauth2.googleapis.com/token"),
            "iat": int(now.timestamp()),
            "exp": int((now + timedelta(minutes=30)).timestamp()),
        },
        info["private_key"],
        algorithm="RS256",
    )
    async with httpx.AsyncClient(timeout=15) as client:
        response = await client.post(
            info.get("token_uri", "https://oauth2.googleapis.com/token"),
            data={
                "grant_type": "urn:ietf:params:oauth:grant-type:jwt-bearer",
                "assertion": assertion,
            },
        )
    if response.status_code != 200:
        raise StorageError(f"google token exchange failed: {response.status_code}")
    return response.json()["access_token"]


async def _gdrive_ticket(
    *, credentials: dict[str, Any], config: dict[str, Any], filename: str, content_type: str
) -> UploadTicketData:
    folder_id = config.get("folder_id")
    if not folder_id:
        raise StorageNotConfigured("gdrive target is missing folder_id")
    token = await _gdrive_access_token(credentials)
    safe_name = sanitize_filename(filename)
    async with httpx.AsyncClient(timeout=15) as client:
        response = await client.post(
            "https://www.googleapis.com/upload/drive/v3/files?uploadType=resumable",
            headers={
                "Authorization": f"Bearer {token}",
                "X-Upload-Content-Type": content_type,
            },
            json={"name": safe_name, "parents": [folder_id]},
        )
    session_url = response.headers.get("location")
    if response.status_code not in (200, 201) or not session_url:
        raise StorageError(f"google drive session creation failed: {response.status_code}")
    return UploadTicketData(
        mode="presigned",
        resume_ref=f"gdrive://{folder_id}/{safe_name}",
        upload_url=session_url,
        fields={},
        max_bytes=get_settings().max_upload_bytes,
    )


async def create_upload_ticket(
    *,
    job: Job,
    storage_config: StorageConfig | None,
    filename: str,
    content_type: str,
    size_bytes: int,
) -> UploadTicketData:
    settings = get_settings()
    if size_bytes > settings.max_upload_bytes:
        raise StorageError(
            f"file exceeds the {settings.max_upload_bytes} byte cap for this plan"
        )

    target = job.storage_target
    key = object_key(tenant_id=job.tenant_id, job_id=job.id, filename=filename)

    if target == "hosted":
        return _s3_ticket(
            endpoint=settings.hosted_s3_endpoint,
            bucket=settings.hosted_s3_bucket,
            region=settings.hosted_s3_region,
            access_key_id=settings.hosted_s3_access_key,
            secret_access_key=settings.hosted_s3_secret_key,
            key=key,
            scheme="hosted",
            max_bytes=settings.max_upload_bytes,
        )

    if storage_config is None:
        raise StorageNotConfigured(f"job storage_target '{target}' has no storage config attached")
    credentials = decrypt_json(storage_config.encrypted_credentials)
    config = storage_config.config or {}

    if target == "s3":
        return _s3_ticket(
            endpoint=str(config.get("endpoint") or "https://s3.amazonaws.com"),
            bucket=str(config["bucket"]),
            region=str(config.get("region") or "us-east-1"),
            access_key_id=credentials["access_key_id"],
            secret_access_key=credentials["secret_access_key"],
            key=key,
            scheme="s3",
            max_bytes=settings.max_upload_bytes,
        )

    if target == "gdrive":
        return await _gdrive_ticket(
            credentials=credentials, config=config, filename=filename, content_type=content_type
        )

    if target == "telegram":
        if size_bytes > TELEGRAM_MAX_BYTES:
            raise StorageError(
                f"Telegram storage caps uploads at {TELEGRAM_MAX_BYTES // (1024 * 1024)}MB"
            )
        return UploadTicketData(
            mode="server_relay",
            resume_ref="",
            upload_url=f"/v1/public/jobs/{job.id}/uploads",
            fields={},
            max_bytes=min(settings.max_upload_bytes, TELEGRAM_MAX_BYTES),
        )

    raise StorageError(f"unsupported storage target '{target}'")  # pragma: no cover


async def relay_to_telegram(
    *, storage_config: StorageConfig, filename: str, content: bytes, caption: str
) -> str:
    """Upload a file to the tenant's private channel and return its ``telegram://`` ref."""
    credentials = decrypt_json(storage_config.encrypted_credentials)
    chat_id = (storage_config.config or {}).get("chat_id")
    bot_token = credentials.get("bot_token")
    if not chat_id or not bot_token:
        raise StorageNotConfigured("telegram target is missing chat_id/bot_token")
    async with httpx.AsyncClient(timeout=60) as client:
        response = await client.post(
            f"https://api.telegram.org/bot{bot_token}/sendDocument",
            data={"chat_id": str(chat_id), "caption": caption[:1024]},
            files={"document": (sanitize_filename(filename), content)},
        )
    if response.status_code != 200 or not response.json().get("ok"):
        raise StorageError(f"telegram upload failed: {response.status_code}")
    document = response.json()["result"]["document"]
    return f"telegram://{chat_id}/{document['file_id']}"
