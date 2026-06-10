"""Skill-making bridge receiver — STUB.

Receives Path A promotion candidates from the-loom's Architecture Registry
over the wire contract defined at
`docs/proposals/2026-05-25-skill-making-bridge.md`.

This is a deliberate stub for Phase 3 of the MVP migration. The full
implementation arrives post-Phase-5, when:

  - `services/api/` owns the FastAPI app (currently at `platform/api/main.py`)
  - the-loom's Architecture Registry has a promotion-dispatcher
  - the bridge HMAC + idempotency machinery from the spec is wired

What the real implementation will do (per the spec):

  1. Receive a `PromotionCandidate` POST from the-loom (HMAC-signed,
     idempotency-keyed).
  2. Verify HMAC against the shared `SKILL_MAKING_BRIDGE_SECRET`.
  3. Check idempotency cache; ack-only if already seen.
  4. Dispatch the candidate to `core.skill_making.compiler` for compilation.
  5. POST a `RegistrationAck` back to the-loom (success or failure).
  6. Stream telemetry callbacks during long-running compilation
     (per the spec's three message types).

Until that ships, this module exposes a placeholder so the routing
layout is documented and `services.skill_making` is a valid package.
"""
from __future__ import annotations

from typing import Any


class BridgeReceiverNotImplemented(NotImplementedError):
    """Raised when the bridge receiver is called before its Phase-3+
    implementation lands."""


async def receive_promotion_candidate(payload: dict[str, Any]) -> dict[str, Any]:
    """Receive a promotion candidate from the-loom. STUB.

    Real implementation pending — see module docstring + the bridge spec.
    """
    raise BridgeReceiverNotImplemented(
        "services.skill_making.bridge_receiver is a Phase 3 stub. "
        "Full implementation arrives post-Phase-5 of the MVP migration. "
        "See docs/proposals/2026-05-25-skill-making-bridge.md for the spec."
    )
