"""AWS SigV4 presigned URL generation (query-string variant).

Implemented directly rather than pulling in boto3: Rolewire only ever needs presigned PUT/GET
URLs for S3-compatible endpoints, and the tenant's credentials are already in memory decrypted.
"""

from __future__ import annotations

import hashlib
import hmac
from datetime import UTC, datetime
from urllib.parse import quote, urlencode, urlsplit

_UNSIGNED = "UNSIGNED-PAYLOAD"
_ALGORITHM = "AWS4-HMAC-SHA256"


def _sign(key: bytes, message: str) -> bytes:
    return hmac.new(key, message.encode(), hashlib.sha256).digest()


def _signing_key(secret_key: str, date_stamp: str, region: str, service: str) -> bytes:
    key = _sign(f"AWS4{secret_key}".encode(), date_stamp)
    key = _sign(key, region)
    key = _sign(key, service)
    return _sign(key, "aws4_request")


def _canonical_uri(path: str) -> str:
    return "/" + "/".join(quote(segment, safe="~") for segment in path.lstrip("/").split("/"))


def presign_url(
    *,
    method: str,
    endpoint: str,
    bucket: str,
    key: str,
    access_key_id: str,
    secret_access_key: str,
    region: str,
    expires_in: int = 900,
    now: datetime | None = None,
    service: str = "s3",
) -> str:
    """Return a presigned URL for ``method`` on ``bucket/key``.

    ``endpoint`` is the S3-compatible base URL (e.g. ``https://fra1.digitaloceanspaces.com``).
    Path-style addressing is used because it works with every S3-compatible provider.
    """
    if not endpoint.startswith(("http://", "https://")):
        endpoint = f"https://{endpoint}"
    parts = urlsplit(endpoint)
    host = parts.netloc
    stamp = (now or datetime.now(UTC)).strftime("%Y%m%dT%H%M%SZ")
    date_stamp = stamp[:8]
    credential_scope = f"{date_stamp}/{region}/{service}/aws4_request"

    canonical_uri = _canonical_uri(f"{parts.path.rstrip('/')}/{bucket}/{key}")
    query = {
        "X-Amz-Algorithm": _ALGORITHM,
        "X-Amz-Credential": f"{access_key_id}/{credential_scope}",
        "X-Amz-Date": stamp,
        "X-Amz-Expires": str(expires_in),
        "X-Amz-SignedHeaders": "host",
    }
    canonical_query = urlencode(sorted(query.items()), quote_via=quote, safe="~")
    canonical_request = "\n".join(
        [
            method.upper(),
            canonical_uri,
            canonical_query,
            f"host:{host}\n",
            "host",
            _UNSIGNED,
        ]
    )
    string_to_sign = "\n".join(
        [
            _ALGORITHM,
            stamp,
            credential_scope,
            hashlib.sha256(canonical_request.encode()).hexdigest(),
        ]
    )
    signature = hmac.new(
        _signing_key(secret_access_key, date_stamp, region, service),
        string_to_sign.encode(),
        hashlib.sha256,
    ).hexdigest()
    return f"{parts.scheme}://{host}{canonical_uri}?{canonical_query}&X-Amz-Signature={signature}"
