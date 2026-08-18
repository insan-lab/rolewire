"""Cross-tenant isolation at the application layer (§3, §12).

The RLS policies are the second line of defense and are exercised against real Postgres in
``test_rls_postgres.py``; these tests assert the API itself never serves one tenant another
tenant's rows even though both requests hit the same pooled connection.
"""

from __future__ import annotations

from httpx import AsyncClient

from tests.conftest import PUBLISHED_JOB, auth_headers


async def _job_for(client: AsyncClient, headers: dict[str, str], title: str) -> dict:
    response = await client.post(
        "/v1/admin/jobs", json={**PUBLISHED_JOB, "title": title}, headers=headers
    )
    assert response.status_code == 201, response.text
    return response.json()


async def test_tenants_only_see_their_own_jobs(client: AsyncClient) -> None:
    alpha = await auth_headers(client, email="alpha@acmecorp.io", company="Alpha Inc")
    beta = await auth_headers(client, email="beta@betacorp.io", company="Beta LLC")
    alpha_job = await _job_for(client, alpha, "Alpha Role")
    await _job_for(client, beta, "Beta Role")

    alpha_list = await client.get("/v1/admin/jobs", headers=alpha)
    assert [item["title"] for item in alpha_list.json()["items"]] == ["Alpha Role"]

    # Direct id access across tenants is a 404, not a 403 — no existence disclosure.
    assert (await client.get(f"/v1/admin/jobs/{alpha_job['id']}", headers=beta)).status_code == 404
    assert (
        await client.patch(
            f"/v1/admin/jobs/{alpha_job['id']}", json={"title": "hijacked"}, headers=beta
        )
    ).status_code == 404
    assert (
        await client.delete(f"/v1/admin/jobs/{alpha_job['id']}", headers=beta)
    ).status_code == 404
    assert (
        await client.post(
            f"/v1/admin/jobs/{alpha_job['id']}/questions",
            json={"questions": []},
            headers=beta,
        )
    ).status_code == 404


async def test_applications_are_not_visible_across_tenants(client: AsyncClient) -> None:
    alpha = await auth_headers(client, email="alpha2@acmecorp.io", company="Alpha Inc")
    beta = await auth_headers(client, email="beta2@betacorp.io", company="Beta LLC")
    job = await _job_for(client, alpha, "Alpha Role")

    submitted = await client.post(
        f"/v1/public/jobs/{job['id']}/apply",
        json={
            "answers": {
                "full_name": "Jane Doe",
                "email": "jane@example.org",
                "years_experience": 3,
                "notice_period": "Immediate",
            }
        },
    )
    assert submitted.status_code == 201
    application_id = submitted.json()["id"]

    assert (
        await client.get(f"/v1/admin/applications/{application_id}", headers=alpha)
    ).status_code == 200
    assert (
        await client.get(f"/v1/admin/applications/{application_id}", headers=beta)
    ).status_code == 404

    beta_list = await client.get(
        "/v1/admin/applications", params={"job_id": job["id"]}, headers=beta
    )
    assert beta_list.json()["total"] == 0


async def test_storage_config_cannot_be_attached_across_tenants(client: AsyncClient) -> None:
    alpha = await auth_headers(client, email="alpha3@acmecorp.io", company="Alpha Inc")
    beta = await auth_headers(client, email="beta3@betacorp.io", company="Beta LLC")

    created = await client.post(
        "/v1/admin/storage-configs",
        json={
            "name": "Alpha bucket",
            "type": "s3",
            "credentials": {"access_key_id": "AKIA", "secret_access_key": "secret"},
            "config": {"bucket": "alpha-resumes", "region": "us-east-1"},
        },
        headers=alpha,
    )
    assert created.status_code == 201
    config_id = created.json()["id"]
    # Secrets are never echoed back.
    assert "credentials" not in created.json()

    assert (await client.get("/v1/admin/storage-configs", headers=beta)).json() == []

    hijack = await client.post(
        "/v1/admin/jobs",
        json={
            **PUBLISHED_JOB,
            "title": "Beta Role",
            "storage_target": "s3",
            "storage_config_id": config_id,
        },
        headers=beta,
    )
    assert hijack.status_code == 400
