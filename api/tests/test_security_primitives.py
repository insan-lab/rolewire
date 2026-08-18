"""Unit tests for signing, presigning, and credential encryption."""

from __future__ import annotations

import time
import uuid
from datetime import UTC, datetime

import pytest

from app.core.crypto import decrypt_json, encrypt_json, hash_ip
from app.services.signatures import SignatureError, sign_outbound, verify_paddle, verify_uddoktapay
from app.services.sigv4 import presign_url
from app.services.storage import object_key, sanitize_filename


def test_paddle_signature_round_trip() -> None:
    body = b'{"event_type":"transaction.completed"}'
    timestamp, signature = sign_outbound("secret", body, int(time.time()))
    verify_paddle(secret="secret", signature_header=f"ts={timestamp};h1={signature}", body=body)


@pytest.mark.parametrize(
    "header",
    ["", "garbage", "ts=abc;h1=def", "h1=onlyhash"],
)
def test_paddle_malformed_headers_are_rejected(header: str) -> None:
    with pytest.raises(SignatureError):
        verify_paddle(secret="secret", signature_header=header or None, body=b"{}")


def test_paddle_verification_fails_closed_without_a_secret() -> None:
    body = b"{}"
    timestamp, signature = sign_outbound("secret", body)
    with pytest.raises(SignatureError):
        verify_paddle(secret="", signature_header=f"ts={timestamp};h1={signature}", body=body)


def test_uddoktapay_verification() -> None:
    verify_uddoktapay(api_key="key", provided_key="key")
    with pytest.raises(SignatureError):
        verify_uddoktapay(api_key="key", provided_key="other")


def test_presigned_url_is_deterministic_for_a_fixed_timestamp() -> None:
    fixed = datetime(2025, 1, 2, 3, 4, 5, tzinfo=UTC)
    kwargs = {
        "method": "PUT",
        "endpoint": "https://fra1.digitaloceanspaces.com",
        "bucket": "rolewire-resumes",
        "key": "applications/a/b/resume.pdf",
        "access_key_id": "AKIAEXAMPLE",
        "secret_access_key": "secret-key",
        "region": "fra1",
        "now": fixed,
    }
    first = presign_url(**kwargs)
    second = presign_url(**kwargs)
    assert first == second
    assert first.startswith(
        "https://fra1.digitaloceanspaces.com/rolewire-resumes/applications/a/b/resume.pdf?"
    )
    assert "X-Amz-Signature=" in first
    assert "X-Amz-Expires=900" in first
    # A different secret must produce a different signature.
    assert presign_url(**{**kwargs, "secret_access_key": "other"}) != first


def test_filenames_are_sanitized_and_keys_are_tenant_scoped() -> None:
    assert sanitize_filename("../../etc/passwd") == "etc_passwd"
    assert sanitize_filename("Résumé (final).pdf") == "Resume_final_.pdf"
    assert sanitize_filename("") == "upload.bin"

    tenant_id, job_id = uuid.uuid4(), uuid.uuid4()
    key = object_key(tenant_id=tenant_id, job_id=job_id, filename="cv.pdf")
    assert key.startswith(f"applications/{tenant_id}/{job_id}/")
    assert key.endswith("-cv.pdf")
    # Keys are unique per upload so two applicants cannot overwrite each other.
    assert key != object_key(tenant_id=tenant_id, job_id=job_id, filename="cv.pdf")


def test_credentials_round_trip_through_encryption() -> None:
    payload = {"access_key_id": "AKIA", "secret_access_key": "s3cr3t"}
    blob = encrypt_json(payload)
    assert b"s3cr3t" not in blob
    assert decrypt_json(blob) == payload


def test_ip_hash_is_salted_and_irreversible() -> None:
    digest = hash_ip("203.0.113.7")
    assert digest and "203.0.113.7" not in digest
    assert digest == hash_ip("203.0.113.7")
    assert digest != hash_ip("203.0.113.8")
    assert hash_ip(None) is None
