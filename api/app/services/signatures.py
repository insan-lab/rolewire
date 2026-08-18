"""Webhook signature verification (§12).

These endpoints are excluded from the admin JWT requirement, so signature verification *is* the
authentication. Every verifier is constant-time and fails closed when its secret is unset.
"""

from __future__ import annotations

import hashlib
import hmac
import time


class SignatureError(Exception):
    pass


def _hmac_sha256(secret: str, message: bytes) -> str:
    return hmac.new(secret.encode(), message, hashlib.sha256).hexdigest()


def verify_paddle(
    *, secret: str, signature_header: str | None, body: bytes, tolerance_seconds: int = 300
) -> None:
    """Verify a Paddle Billing ``Paddle-Signature: ts=<unix>;h1=<hex>`` header."""
    if not secret:
        raise SignatureError("paddle webhook secret is not configured")
    if not signature_header:
        raise SignatureError("missing Paddle-Signature header")

    parts: dict[str, str] = {}
    for chunk in signature_header.split(";"):
        key, _, value = chunk.partition("=")
        if key.strip():
            parts[key.strip()] = value.strip()

    timestamp, provided = parts.get("ts"), parts.get("h1")
    if not timestamp or not provided:
        raise SignatureError("malformed Paddle-Signature header")
    try:
        age = abs(time.time() - int(timestamp))
    except ValueError as exc:
        raise SignatureError("malformed Paddle-Signature timestamp") from exc
    if age > tolerance_seconds:
        raise SignatureError("paddle signature timestamp outside tolerance")

    expected = _hmac_sha256(secret, f"{timestamp}:".encode() + body)
    if not hmac.compare_digest(expected, provided):
        raise SignatureError("paddle signature mismatch")


def verify_uddoktapay(*, api_key: str, provided_key: str | None) -> None:
    """UddoktaPay authenticates its callback with the merchant API key header."""
    if not api_key:
        raise SignatureError("uddoktapay api key is not configured")
    if not provided_key or not hmac.compare_digest(api_key, provided_key):
        raise SignatureError("uddoktapay api key mismatch")


def sign_outbound(secret: str, body: bytes, timestamp: int | None = None) -> tuple[int, str]:
    """Sign an application forwarded to a tenant's ATS webhook, Paddle-style."""
    ts = timestamp or int(time.time())
    return ts, _hmac_sha256(secret, f"{ts}:".encode() + body)
