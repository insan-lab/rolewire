"""Admin job/question management rules."""

from __future__ import annotations

from httpx import AsyncClient

from tests.conftest import PUBLISHED_JOB, auth_headers

MINIMAL_JOB = {"title": "Ops Lead", "status": "draft"}


async def test_job_lifecycle_draft_to_published_to_closed(client: AsyncClient) -> None:
    headers = await auth_headers(client, email="lifecycle@acmecorp.io")
    created = await client.post("/v1/admin/jobs", json=MINIMAL_JOB, headers=headers)
    assert created.status_code == 201
    job_id = created.json()["id"]
    assert created.json()["status"] == "draft"
    assert created.json()["storage_target"] == "hosted"

    published = await client.patch(
        f"/v1/admin/jobs/{job_id}", json={"status": "published"}, headers=headers
    )
    assert published.status_code == 200
    assert (await client.get(f"/v1/public/jobs/{job_id}")).status_code == 200

    closed = await client.patch(
        f"/v1/admin/jobs/{job_id}", json={"status": "closed"}, headers=headers
    )
    assert closed.status_code == 200
    assert (await client.get(f"/v1/public/jobs/{job_id}")).status_code == 404


async def test_invalid_status_is_rejected(client: AsyncClient) -> None:
    headers = await auth_headers(client, email="badstatus@acmecorp.io")
    response = await client.post(
        "/v1/admin/jobs", json={"title": "X", "status": "archived"}, headers=headers
    )
    assert response.status_code == 422


async def test_select_questions_require_options(client: AsyncClient) -> None:
    headers = await auth_headers(client, email="options@acmecorp.io")
    response = await client.post(
        "/v1/admin/jobs",
        json={
            "title": "X",
            "questions": [
                {"label": "Notice", "field_key": "notice", "question_type": "select"}
            ],
        },
        headers=headers,
    )
    assert response.status_code == 422
    assert "options" in response.text


async def test_duplicate_field_keys_are_rejected(client: AsyncClient) -> None:
    headers = await auth_headers(client, email="dupkeys@acmecorp.io")
    response = await client.post(
        f"/v1/admin/jobs",
        json={
            "title": "X",
            "questions": [
                {"label": "A", "field_key": "same", "question_type": "text"},
                {"label": "B", "field_key": "same", "question_type": "text"},
            ],
        },
        headers=headers,
    )
    assert response.status_code == 422


async def test_field_keys_must_be_machine_readable(client: AsyncClient) -> None:
    headers = await auth_headers(client, email="keys@acmecorp.io")
    response = await client.post(
        "/v1/admin/jobs",
        json={
            "title": "X",
            "questions": [{"label": "A", "field_key": "Full Name", "question_type": "text"}],
        },
        headers=headers,
    )
    assert response.status_code == 422


async def test_questions_endpoint_replaces_the_whole_set(client: AsyncClient) -> None:
    headers = await auth_headers(client, email="replace@acmecorp.io")
    created = await client.post("/v1/admin/jobs", json=PUBLISHED_JOB, headers=headers)
    job_id = created.json()["id"]
    assert len(created.json()["questions"]) == 5

    replaced = await client.post(
        f"/v1/admin/jobs/{job_id}/questions",
        json={
            "questions": [
                {"label": "Full Name", "field_key": "full_name", "question_type": "text"},
                {
                    "label": "Portfolio",
                    "field_key": "portfolio",
                    "question_type": "text",
                    "required": False,
                },
            ]
        },
        headers=headers,
    )
    assert replaced.status_code == 200
    assert [q["field_key"] for q in replaced.json()] == ["full_name", "portfolio"]

    public_view = await client.get(f"/v1/public/jobs/{job_id}")
    assert [q["field_key"] for q in public_view.json()["questions"]] == [
        "full_name",
        "portfolio",
    ]


async def test_non_hosted_storage_target_requires_a_config(client: AsyncClient) -> None:
    headers = await auth_headers(client, email="storage@acmecorp.io")
    response = await client.post(
        "/v1/admin/jobs",
        json={"title": "X", "storage_target": "s3"},
        headers=headers,
    )
    assert response.status_code == 422


async def test_ats_webhook_must_be_https(client: AsyncClient) -> None:
    headers = await auth_headers(client, email="webhook@acmecorp.io")
    response = await client.post(
        "/v1/admin/jobs",
        json={"title": "X", "ats_webhook_url": "http://insecure.example/hook"},
        headers=headers,
    )
    assert response.status_code == 422


async def test_jobs_with_applications_cannot_be_deleted(client: AsyncClient) -> None:
    headers = await auth_headers(client, email="delete@acmecorp.io")
    created = await client.post("/v1/admin/jobs", json=PUBLISHED_JOB, headers=headers)
    job_id = created.json()["id"]
    submitted = await client.post(
        f"/v1/public/jobs/{job_id}/apply",
        json={
            "answers": {
                "full_name": "Jane",
                "email": "jane@example.org",
                "years_experience": 2,
                "notice_period": "Immediate",
            }
        },
    )
    assert submitted.status_code == 201

    response = await client.delete(f"/v1/admin/jobs/{job_id}", headers=headers)
    assert response.status_code == 409
    assert "close it instead" in response.text


async def test_empty_job_can_be_deleted(client: AsyncClient) -> None:
    headers = await auth_headers(client, email="deleteok@acmecorp.io")
    created = await client.post("/v1/admin/jobs", json=MINIMAL_JOB, headers=headers)
    job_id = created.json()["id"]
    assert (await client.delete(f"/v1/admin/jobs/{job_id}", headers=headers)).status_code == 204
    assert (await client.get(f"/v1/admin/jobs/{job_id}", headers=headers)).status_code == 404
