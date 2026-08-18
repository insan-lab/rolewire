"""Transactional email via Brevo (§11).

Templates live in Brevo (referenced by numeric template id) so copy changes do not need a
redeploy. Sends are fire-and-forget from the caller's perspective — the worker owns retries.
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Any

import httpx

from app.core.config import get_settings

BREVO_ENDPOINT = "https://api.brevo.com/v3/smtp/email"


class EmailError(RuntimeError):
    pass


@dataclass(frozen=True)
class Template:
    key: str
    env_default_id: int | None = None


# Template ids are configured per-environment in Brevo; keys are what the code refers to.
TEMPLATES = {
    "application_received_applicant": Template("application_received_applicant"),
    "application_received_tenant": Template("application_received_tenant"),
    "renewal_reminder": Template("renewal_reminder"),
    "payment_failed": Template("payment_failed"),
    "plan_upgraded": Template("plan_upgraded"),
    "welcome": Template("welcome"),
}


async def send_template(
    *,
    template_id: int,
    to_email: str,
    params: dict[str, Any] | None = None,
    to_name: str | None = None,
    tags: list[str] | None = None,
) -> str:
    """Send a Brevo template email; returns the provider message id."""
    settings = get_settings()
    if not settings.brevo_api_key:
        raise EmailError("brevo_api_key is not configured")

    payload: dict[str, Any] = {
        "templateId": template_id,
        "to": [{"email": to_email, **({"name": to_name} if to_name else {})}],
        "params": params or {},
    }
    if tags:
        payload["tags"] = tags

    async with httpx.AsyncClient(timeout=20) as client:
        response = await client.post(
            BREVO_ENDPOINT,
            headers={"api-key": settings.brevo_api_key, "content-type": "application/json"},
            json=payload,
        )
    if response.status_code >= 300:
        raise EmailError(f"brevo send failed ({response.status_code}): {response.text[:200]}")
    return str(response.json().get("messageId", ""))
