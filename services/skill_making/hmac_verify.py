"""HMAC-SHA256 verification for bridge POSTs.

Per the wire contract at `docs/proposals/2026-05-25-skill-making-bridge.md`:
the-loom HMAC-signs the raw POST body with the shared secret
`LOOM_SKILL_BRIDGE_SECRET` (env var on both sides) and sends the hex
digest in the `X-Loom-Signature` header. The receiver verifies via
`hmac.compare_digest` (constant-time) before doing any other work.

Constant-time comparison matters: a non-constant-time check leaks
timing info that lets an attacker recover the secret one byte at a time.
"""
from __future__ import annotations

import hmac
import os
from hashlib import sha256


class HmacVerificationError(Exception):
    """Raised when the signature does not match the computed HMAC. The
    receiver translates this to a 401 response — no candidate row
    written, no audit-log entry, no further work."""


def verify_signature(
    raw_body: bytes,
    signature: str,
    *,
    secret: str | None = None,
) -> None:
    """Verify the HMAC-SHA256 signature of `raw_body` against `signature`.

    Args:
        raw_body: The exact bytes of the POST body. Must be the raw
            bytes received over the wire — re-serializing pydantic
            objects would change the byte ordering and break verification.
        signature: The hex digest from the `X-Loom-Signature` header.
        secret: The shared HMAC secret. Defaults to the
            `LOOM_SKILL_BRIDGE_SECRET` env var.

    Raises:
        HmacVerificationError: If the secret isn't configured, the
            signature is missing/empty, or the digests don't match.
    """
    if secret is None:
        secret = os.environ.get("LOOM_SKILL_BRIDGE_SECRET")
    if not secret:
        raise HmacVerificationError(
            "LOOM_SKILL_BRIDGE_SECRET env var not set on the engine side; "
            "cannot verify bridge POSTs."
        )
    if not signature:
        raise HmacVerificationError("missing X-Loom-Signature header")

    expected = hmac.new(secret.encode("utf-8"), raw_body, sha256).hexdigest()
    if not hmac.compare_digest(expected, signature):
        raise HmacVerificationError("signature mismatch")
