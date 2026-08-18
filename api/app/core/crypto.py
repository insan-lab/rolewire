"""Envelope encryption helpers for credentials stored at rest.

`storage_configs.encrypted_credentials` and the OAuth token columns are encrypted with a
Fernet data key. The key itself never lives in Postgres or the repo — it is injected via
1Password/KMS as ``ROLEWIRE_ENCRYPTION_KEY``.
"""

from __future__ import annotations

import base64
import hashlib
import hmac
import json
from functools import lru_cache
from typing import Any

from cryptography.fernet import Fernet, InvalidToken

from app.core.config import get_settings


class EncryptionNotConfigured(RuntimeError):
    pass


@lru_cache
def _fernet() -> Fernet:
    key = get_settings().encryption_key
    if not key:
        raise EncryptionNotConfigured(
            "encryption_key is not configured; cannot encrypt/decrypt credentials"
        )
    return Fernet(key.encode())


def generate_key() -> str:
    """Generate a new Fernet key (used by ops tooling, not at runtime)."""
    return Fernet.generate_key().decode()


def encrypt_json(payload: dict[str, Any]) -> bytes:
    return _fernet().encrypt(json.dumps(payload, separators=(",", ":")).encode())


def decrypt_json(blob: bytes) -> dict[str, Any]:
    try:
        return json.loads(_fernet().decrypt(bytes(blob)))
    except InvalidToken as exc:  # pragma: no cover - defensive
        raise ValueError("credential blob could not be decrypted") from exc


def encrypt_str(value: str | None) -> bytes | None:
    if value is None:
        return None
    return _fernet().encrypt(value.encode())


def decrypt_str(blob: bytes | None) -> str | None:
    if blob is None:
        return None
    return _fernet().decrypt(bytes(blob)).decode()


def hash_ip(ip: str | None) -> str | None:
    """Salted hash of a client IP — stored instead of the raw address (§12)."""
    if not ip:
        return None
    salt = get_settings().ip_hash_salt.encode()
    digest = hmac.new(salt, ip.encode(), hashlib.sha256).digest()
    return base64.urlsafe_b64encode(digest).decode().rstrip("=")
