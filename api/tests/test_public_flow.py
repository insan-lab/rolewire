"""End-to-end public job board flow: publish → read → apply."""

from __future__ import annotations

import uuid

from httpx import AsyncClient
from sqlalchemy import select

from app.core.db import get_sessionmaker
from app.models import Application, Tenant
from tests.conftest import PUBLISHED_JOB, auth_headers

VALID_ANSWERS = {
    "full_name": "Jane Doe",
    "email": "jane@example.org",
    "years_experience": 4,
    "notice_period": "1 month",
}


async def _create_job(client: AsyncClient, headers: dict[str, str], **overrides) -> dict:
    payload = {**PUBLISHED_JOB, **overrides}
    response = await client.post("/v1/admin/jobs", json=payload, headers=headers)
    assert response.status_code == 201, response.text
    return response.json()


async def test_public_job_detail_exposes_questions_and_types(client: AsyncClient) -> None:
    headers = await auth_headers(client, email="hiring@acmecorp.io", company="Acme Ltd")
    job = await _create_job(client, headers)

    response = await client.get(f"/v1/public/jobs/{job['id']}")
    assert response.status_code == 200
    body = response.json()
    assert body["title"] == "Backend Engineer"
    assert body["company"] == "Acme Ltd"
    by_key = {question["field_key"]: question for question in body["questions"]}
    assert by_key["notice_period"]["type"] == "select"
    assert by_key["notice_period"]["options"] == ["Immediate", "2 weeks", "1 month"]
    assert by_key["resume"]["required"] is False
    # Internal routing details must never leak to the public payload.
    assert "storage_target" not in body
    assert "ats_webhook_url" not in body


async def test_draft_jobs_are_not_public(client: AsyncClient) -> None:
    headers = await auth_headers(client, email="draft@acmecorp.io")
    job = await _create_job(client, headers, status="draft")

    assert (await client.get(f"/v1/public/jobs/{job['id']}")).status_code == 404
    listing = await client.get("/v1/public/jobs")
    assert listing.json()["total"] == 0


async def test_listing_can_be_filtered_by_company_slug(client: AsyncClient) -> None:
    headers_a = await auth_headers(client, email="a@acmecorp.io", company="Alpha Inc")
    headers_b = await auth_headers(client, email="b@betacorp.io", company="Beta LLC")
    await _create_job(client, headers_a, title="Alpha Role")
    await _create_job(client, headers_b, title="Beta Role")

    all_jobs = await client.get("/v1/public/jobs")
    assert all_jobs.json()["total"] == 2

    alpha_only = await client.get("/v1/public/jobs", params={"slug": "alpha-inc"})
    assert alpha_only.status_code == 200
    assert [item["title"] for item in alpha_only.json()["items"]] == ["Alpha Role"]

    assert (await client.get("/v1/public/jobs", params={"slug": "nope"})).status_code == 404


async def test_apply_stores_application_with_hashed_ip(client: AsyncClient) -> None:
    headers = await auth_headers(client, email="apply@acmecorp.io")
    job = await _create_job(client, headers)

    response = await client.post(
        f"/v1/public/jobs/{job['id']}/apply",
        json={"answers": VALID_ANSWERS, "applicant_email": "jane@example.org"},
        headers={"X-Forwarded-For": "203.0.113.7"},
    )
    assert response.status_code == 201, response.text
    assert response.json()["status"] == "received"

    async with get_sessionmaker()() as session:
        stored = await session.scalar(
            select(Application).where(Application.id == uuid.UUID(response.json()["id"]))
        )
    assert stored is not None
    assert stored.answers["years_experience"] == 4
    assert stored.applicant_email == "jane@example.org"
    # Raw IPs are never persisted (§12).
    assert stored.ip_hash and "203.0.113.7" not in stored.ip_hash

    listed = await client.get(
        "/v1/admin/applications", params={"job_id": job["id"]}, headers=headers
    )
    assert listed.json()["total"] == 1


async def test_apply_rejects_bad_answers_with_field_errors(client: AsyncClient) -> None:
    headers = await auth_headers(client, email="bad@acmecorp.io")
    job = await _create_job(client, headers)

    response = await client.post(
        f"/v1/public/jobs/{job['id']}/apply",
        json={
            "answers": {
                "full_name": "Jane",
                "email": "not-an-email",
                "notice_period": "Whenever",
                "unexpected": "x",
            }
        },
    )
    assert response.status_code == 422
    errors = response.json()["detail"]["errors"]
    assert errors["email"].startswith("must be a valid email")
    assert errors["notice_period"].startswith("must be one of")
    assert errors["years_experience"] == "this field is required"
    assert "unexpected" in errors


async def test_apply_is_rate_limited_per_job_and_ip(client: AsyncClient, settings) -> None:
    headers = await auth_headers(client, email="ratelimit@acmecorp.io")
    job = await _create_job(client, headers)
    original = settings.public_apply_rate_limit
    settings.public_apply_rate_limit = 1
    try:
        first = await client.post(
            f"/v1/public/jobs/{job['id']}/apply",
            json={"answers": VALID_ANSWERS},
            headers={"X-Forwarded-For": "198.51.100.9"},
        )
        assert first.status_code == 201
        second = await client.post(
            f"/v1/public/jobs/{job['id']}/apply",
            json={"answers": VALID_ANSWERS},
            headers={"X-Forwarded-For": "198.51.100.9"},
        )
        assert second.status_code == 429
        assert second.headers["Retry-After"]
        # A different applicant IP is unaffected.
        other = await client.post(
            f"/v1/public/jobs/{job['id']}/apply",
            json={"answers": VALID_ANSWERS},
            headers={"X-Forwarded-For": "198.51.100.10"},
        )
        assert other.status_code == 201
    finally:
        settings.public_apply_rate_limit = original


async def test_suspended_tenant_returns_410_gone(client: AsyncClient) -> None:
    headers = await auth_headers(client, email="suspended@acmecorp.io")
    job = await _create_job(client, headers)

    async with get_sessionmaker()() as session:
        tenant = await session.scalar(select(Tenant).where(Tenant.slug == "acme-ltd"))
        assert tenant is not None
        tenant.status = "suspended"
        await session.commit()

    detail = await client.get(f"/v1/public/jobs/{job['id']}")
    assert detail.status_code == 410
    apply_response = await client.post(
        f"/v1/public/jobs/{job['id']}/apply", json={"answers": VALID_ANSWERS}
    )
    assert apply_response.status_code == 410


async def test_public_responses_allow_any_origin(client: AsyncClient) -> None:
    headers = await auth_headers(client, email="cors@acmecorp.io")
    job = await _create_job(client, headers)
    response = await client.get(
        f"/v1/public/jobs/{job['id']}", headers={"Origin": "https://careers.customer.example"}
    )
    assert response.headers["access-control-allow-origin"] == "*"


async def test_admin_endpoints_do_not_allow_arbitrary_origins(client: AsyncClient) -> None:
    headers = await auth_headers(client, email="origin@acmecorp.io")
    response = await client.get(
        "/v1/admin/jobs",
        headers={**headers, "Origin": "https://evil.example"},
    )
    assert response.status_code == 200
    assert "access-control-allow-origin" not in response.headers
