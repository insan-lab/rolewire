"""Outbound delivery of applications to a tenant's ATS (§7).

``ats_webhook_url`` is the ship-first path: any ATS (their own OpenCATS, Greenhouse, Ashby) can
receive applications without Rolewire hosting anything. Payloads are signed with the tenant's
webhook secret so the receiver can verify origin.
"""

from __future__ import annotations

import json
from typing import Any

import httpx

from app.core.config import get_settings
from app.services.signatures import sign_outbound

DELIVERY_TIMEOUT = 20


class DeliveryError(RuntimeError):
    """Raised on a non-2xx response so the worker's retry policy takes over."""


def build_payload(*, application: dict[str, Any], job: dict[str, Any]) -> dict[str, Any]:
    return {
        "event": "application.received",
        "application": application,
        "job": job,
    }


async def deliver(*, url: str, payload: dict[str, Any], secret: str | None = None) -> int:
    if not url.startswith("https://"):
        raise DeliveryError("ats_webhook_url must be https")
    body = json.dumps(payload, separators=(",", ":"), default=str).encode()
    headers = {"content-type": "application/json", "user-agent": "rolewire-webhook/1"}
    signing_secret = secret or get_settings().jwt_secret
    timestamp, signature = sign_outbound(signing_secret, body)
    headers["rolewire-signature"] = f"ts={timestamp};h1={signature}"

    async with httpx.AsyncClient(timeout=DELIVERY_TIMEOUT, follow_redirects=False) as client:
        response = await client.post(url, content=body, headers=headers)
    if response.status_code >= 300:
        raise DeliveryError(f"ats webhook returned {response.status_code}")
    return response.status_code
