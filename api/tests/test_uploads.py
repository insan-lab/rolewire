"""Two-step upload flow for file questions (§5.1, §6)."""

from __future__ import annotations

from urllib.parse import parse_qs, urlsplit

from httpx import AsyncClient

from tests.conftest import PUBLISHED_JOB, auth_headers

TICKET_REQUEST = {
    "field_key": "resume",
    "filename": "jane-cv.pdf",
    "content_type": "application/pdf",
    "size_bytes": 120_000,
}


async def _published_job(client: AsyncClient, headers: dict[str, str], **overrides) -> dict:
    response = await client.post(
        "/v1/admin/jobs", json={**PUBLISHED_JOB, **overrides}, headers=headers
    )
    assert response.status_code == 201, response.text
    return response.json()


async def test_hosted_target_returns_a_presigned_put_url(
    client: AsyncClient, settings
) -> None:
    headers = await auth_headers(client, email="hosted@acmecorp.io")
    job = await _published_job(client, headers)

    settings.hosted_s3_endpoint = "https://fra1.digitaloceanspaces.com"
    settings.hosted_s3_bucket = "rolewire-resumes"
    settings.hosted_s3_access_key = "AKIAEXAMPLE"
    settings.hosted_s3_secret_key = "secret"
    try:
        response = await client.post(
            f"/v1/public/jobs/{job['id']}/upload-ticket", json=TICKET_REQUEST
        )
    finally:
        settings.hosted_s3_endpoint = ""
        settings.hosted_s3_bucket = ""
        settings.hosted_s3_access_key = ""
        settings.hosted_s3_secret_key = ""

    assert response.status_code == 200, response.text
    ticket = response.json()
    assert ticket["mode"] == "presigned"
    query = parse_qs(urlsplit(ticket["upload_url"]).query)
    assert query["X-Amz-Algorithm"] == ["AWS4-HMAC-SHA256"]
    assert "X-Amz-Signature" in query
    assert ticket["resume_ref"].startswith("hosted://rolewire-resumes/applications/")
    # The applicant-supplied filename is sanitized into the object key.
    assert ticket["resume_ref"].endswith("-jane-cv.pdf")


async def test_hosted_target_without_configuration_is_409(client: AsyncClient) -> None:
    headers = await auth_headers(client, email="unconfigured@acmecorp.io")
    job = await _published_job(client, headers)
    response = await client.post(
        f"/v1/public/jobs/{job['id']}/upload-ticket", json=TICKET_REQUEST
    )
    assert response.status_code == 409


async def test_ticket_requires_a_file_question(client: AsyncClient) -> None:
    headers = await auth_headers(client, email="notfile@acmecorp.io")
    job = await _published_job(client, headers)
    response = await client.post(
        f"/v1/public/jobs/{job['id']}/upload-ticket",
        json={**TICKET_REQUEST, "field_key": "full_name"},
    )
    assert response.status_code == 400
    assert "not a file question" in response.text


async def test_oversized_files_are_refused_before_upload(
    client: AsyncClient, settings
) -> None:
    headers = await auth_headers(client, email="toobig@acmecorp.io")
    job = await _published_job(client, headers)
    response = await client.post(
        f"/v1/public/jobs/{job['id']}/upload-ticket",
        json={**TICKET_REQUEST, "size_bytes": settings.max_upload_bytes + 1},
    )
    assert response.status_code == 400
    assert "exceeds" in response.text


async def test_telegram_target_uses_server_relay_mode(client: AsyncClient) -> None:
    headers = await auth_headers(client, email="telegram@acmecorp.io")
    config = await client.post(
        "/v1/admin/storage-configs",
        json={
            "name": "Careers channel",
            "type": "telegram",
            "credentials": {"bot_token": "123:ABC"},
            "config": {"chat_id": "-100999"},
        },
        headers=headers,
    )
    assert config.status_code == 201
    job = await _published_job(
        client,
        headers,
        storage_target="telegram",
        storage_config_id=config.json()["id"],
    )

    response = await client.post(
        f"/v1/public/jobs/{job['id']}/upload-ticket", json=TICKET_REQUEST
    )
    assert response.status_code == 200
    ticket = response.json()
    # Telegram has no presigned upload concept, so the client posts back through the API.
    assert ticket["mode"] == "server_relay"
    assert ticket["upload_url"] == f"/v1/public/jobs/{job['id']}/uploads"
    assert ticket["max_bytes"] <= 50 * 1024 * 1024


async def test_relay_endpoint_rejects_non_telegram_jobs(client: AsyncClient) -> None:
    headers = await auth_headers(client, email="relay@acmecorp.io")
    job = await _published_job(client, headers)
    response = await client.post(
        f"/v1/public/jobs/{job['id']}/uploads",
        data={"field_key": "resume"},
        files={"file": ("cv.pdf", b"%PDF-1.4", "application/pdf")},
    )
    assert response.status_code == 400
    assert "request an upload ticket" in response.text


async def test_applying_with_an_upload_reference(client: AsyncClient) -> None:
    headers = await auth_headers(client, email="withfile@acmecorp.io")
    job = await _published_job(client, headers)
    response = await client.post(
        f"/v1/public/jobs/{job['id']}/apply",
        json={
            "answers": {
                "full_name": "Jane Doe",
                "email": "jane@example.org",
                "years_experience": 5,
                "notice_period": "2 weeks",
                "resume": "hosted://rolewire-resumes/applications/x/y/z-cv.pdf",
            }
        },
    )
    assert response.status_code == 201

    application_id = response.json()["id"]
    stored = await client.get(f"/v1/admin/applications/{application_id}", headers=headers)
    assert stored.json()["resume_ref"] == "hosted://rolewire-resumes/applications/x/y/z-cv.pdf"
