"""Worker tasks: ATS forwarding, usage flush, renewal sweep."""

from __future__ import annotations

import json
import uuid

import httpx
import pytest
from httpx import AsyncClient
from sqlalchemy import select

from app.core.db import get_sessionmaker
from app.models import Application
from app.services import dispatch
from app.worker import forward_application
from tests.conftest import PUBLISHED_JOB, auth_headers

ANSWERS = {
    "full_name": "Jane Doe",
    "email": "jane@example.org",
    "years_experience": 6,
    "notice_period": "Immediate",
}


async def _job_with_webhook(client: AsyncClient, headers: dict[str, str], url: str) -> dict:
    response = await client.post(
        "/v1/admin/jobs", json={**PUBLISHED_JOB, "ats_webhook_url": url}, headers=headers
    )
    assert response.status_code == 201, response.text
    return response.json()


async def _apply(client: AsyncClient, job_id: str) -> str:
    response = await client.post(f"/v1/public/jobs/{job_id}/apply", json={"answers": ANSWERS})
    assert response.status_code == 201
    return response.json()["id"]


async def test_forward_application_signs_and_marks_forwarded(
    client: AsyncClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    headers = await auth_headers(client, email="forward@acmecorp.io")
    me = await client.get("/v1/admin/auth/me", headers=headers)
    tenant_id = me.json()["tenant_id"]
    job = await _job_with_webhook(client, headers, "https://ats.customer.example/hook")
    application_id = await _apply(client, job["id"])

    seen: dict[str, object] = {}

    class _Client:
        def __init__(self, *args, **kwargs) -> None:
            pass

        async def __aenter__(self):
            return self

        async def __aexit__(self, *exc) -> None:
            return None

        async def post(self, url, content=None, headers=None):
            seen["url"] = url
            seen["body"] = content
            seen["headers"] = headers
            return httpx.Response(202, request=httpx.Request("POST", url))

    monkeypatch.setattr(dispatch.httpx, "AsyncClient", _Client)

    result = await forward_application({}, application_id, tenant_id)
    assert result == "forwarded"
    assert seen["url"] == "https://ats.customer.example/hook"
    signature = str(dict(seen["headers"])["rolewire-signature"])  # type: ignore[arg-type]
    assert signature.startswith("ts=") and ";h1=" in signature
    body = json.loads(seen["body"])  # type: ignore[arg-type]
    assert body["event"] == "application.received"
    assert body["application"]["answers"]["years_experience"] == 6

    async with get_sessionmaker()() as session:
        stored = await session.scalar(
            select(Application).where(Application.id == uuid.UUID(application_id))
        )
    assert stored is not None and stored.status == "forwarded"


async def test_forward_application_marks_failed_and_reraises(
    client: AsyncClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    headers = await auth_headers(client, email="failhook@acmecorp.io")
    tenant_id = (await client.get("/v1/admin/auth/me", headers=headers)).json()["tenant_id"]
    job = await _job_with_webhook(client, headers, "https://ats.customer.example/hook")
    application_id = await _apply(client, job["id"])

    async def _boom(**kwargs):
        raise dispatch.DeliveryError("ats webhook returned 500")

    monkeypatch.setattr(dispatch, "deliver", _boom)

    with pytest.raises(dispatch.DeliveryError):
        await forward_application({}, application_id, tenant_id)

    async with get_sessionmaker()() as session:
        stored = await session.scalar(
            select(Application).where(Application.id == uuid.UUID(application_id))
        )
    # Status records the failure; arq retries the job.
    assert stored is not None and stored.status == "failed"


async def test_forward_application_without_a_webhook_is_a_noop(client: AsyncClient) -> None:
    headers = await auth_headers(client, email="nohook@acmecorp.io")
    tenant_id = (await client.get("/v1/admin/auth/me", headers=headers)).json()["tenant_id"]
    created = await client.post("/v1/admin/jobs", json=PUBLISHED_JOB, headers=headers)
    application_id = await _apply(client, created.json()["id"])

    assert await forward_application({}, application_id, tenant_id) == "no-webhook"


async def test_forward_application_handles_missing_row(client: AsyncClient) -> None:
    headers = await auth_headers(client, email="missing@acmecorp.io")
    tenant_id = (await client.get("/v1/admin/auth/me", headers=headers)).json()["tenant_id"]
    assert await forward_application({}, str(uuid.uuid4()), tenant_id) == "missing"


async def test_plain_http_ats_urls_are_refused_by_the_dispatcher() -> None:
    with pytest.raises(dispatch.DeliveryError):
        await dispatch.deliver(url="http://insecure.example/hook", payload={})
