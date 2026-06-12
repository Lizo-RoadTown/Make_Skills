# Bridge receiver + compiler — Phase 4 shape sketch

**Date:** 2026-06-12
**Status:** Sketch only. Not for implementation until Phase 4 of the ratified upskilling sequence ([`loom_agent_to_ms_agent_pillar_2_sequence_ratified_2026_06_12`](https://loom-agent-context.onrender.com)) is reached. Phases 0-3 (Stop-hook enforcement, candidate registry slice, local observer, cross-project pattern detection) must land in the-loom first.
**Companion to:** [`2026-05-25-skill-making-bridge.md`](2026-05-25-skill-making-bridge.md) (wire contract), [`2026-05-31-three-layer-engine-spec.md`](2026-05-31-three-layer-engine-spec.md) (engine layout).

## Why this exists

Loom-agent asked, on 2026-06-12, that MS-agent sketch the bridge_receiver + compiler shape during spare cycles so when Phase 4 arrives we're not starting cold. This document is that sketch. It is **not** a plan; nothing here is committed code. It captures the shape so Phase 4's first session opens with the design already in working memory.

## What's there today

| File | State |
|---|---|
| [`services/skill_making/bridge_receiver.py`](../../services/skill_making/bridge_receiver.py) | Stub. Single function `receive_promotion_candidate(payload)` raises `BridgeReceiverNotImplemented`. |
| [`core/skill_making/compiler.py`](../../core/skill_making/compiler.py) | Working. `compile_skill_to_tool(skill, model)` takes a `StudentSkill` (with `name`, `description`, `body_md`) and returns a langchain `StructuredTool`. Used today by the runtime agent loop when building per-(tenant, agent_id) instances. |
| [Bridge wire spec](2026-05-25-skill-making-bridge.md) | Ratified. Defines the 3 message types (`PromotionCandidate`, `RegistrationAck`, `TelemetryCallback`), HMAC-SHA256 auth, idempotency-by-`promotion_id`, the engine's state machine. |

## What changes at Phase 4

The receiver becomes a real endpoint that consumes candidates from the-loom's candidate registry (built in Loom-agent's Phase 1) AFTER the local observer (Phase 2) and pattern detection (Phase 3) have populated it with stable candidates. The compiler extends to accept receiver-delivered skill source (not just the existing in-runtime path) and emits the registration ack + telemetry callbacks.

## Receiver shape

### Module surface

```python
# services/skill_making/bridge_receiver.py

async def receive_promotion_candidate(
    payload: PromotionCandidatePayload,
    signature: str,                          # X-Loom-Signature header
    *,
    secret: str = None,                      # defaults to env LOOM_SKILL_BRIDGE_SECRET
    idempotency_store: IdempotencyStore,
    compiler: SkillCompilerProtocol,
    ack_sender: AckSenderProtocol,
) -> ReceiverResponse:
    """
    Phase 4 entry point. The FastAPI route in services/api/ wraps this with
    HTTP plumbing; the function itself is transport-agnostic so it can be
    unit-tested against a fake idempotency store + fake compiler.
    """
```

### Per-candidate flow (deterministic, no LLM in the hot path)

1. **HMAC verify** — `hmac.compare_digest(expected, signature)` against `secret`. 401 on mismatch. No further work.
2. **Idempotency check** — lookup `payload["promotion_id"]` in `idempotency_store`. If present: return `409 Conflict` with the stored `existing_skill_id`. Move on.
3. **Schema validate** — pydantic model `PromotionCandidatePayload`; per the wire spec's field set. `400` with field-level errors on failure (helpful for the-loom to fix and retry).
4. **Tenant resolution** — `payload["tenant_id"]` is `null` (global) or a UUID. Engine reads the existing `core/auth/tenant_context.py`'s tenancy machinery to scope downstream storage. Global candidates go to a shared catalog row.
5. **Persist as queued** — write the candidate to a `promoted_skills` table with `status="queued"` keyed by `promotion_id`. This row is what later compile/ack callbacks reference.
6. **Return 202 immediately** — `{"promotion_id": "...", "status": "queued"}`. Compilation runs out-of-band.
7. **Dispatch to compiler** — async task. Three outcomes:
   - **Compiled** → `status="compiled"`, `skill_id` minted, ack sent.
   - **Rejected** → `status="rejected"`, reason recorded, ack sent with `outcome="rejected"`.
   - **Queued for human review** → `status="queued_human_review"`, ack sent with `outcome="queued_human_review"`.
8. **Telemetry callback** — when the compiled skill is first invoked by a real agent turn (later, in the runtime), `services/skill_making/` emits a `TelemetryCallback` per the bridge spec's message type 3.

### Status transitions (engine side)

```
queued → compiled → live
       ↘ rejected
       ↘ queued_human_review → compiled → live
                              ↘ rejected
```

Engine-side `status` values are distinct from the-loom-side candidate registry `status` values (`draft → observed → recurring → stable → promotion_requested → promoted | rejected`). The transition from `promotion_requested` (the-loom side) to `queued` (engine side) is the bridge handoff. The transition from `compiled` (engine side) to `promoted` (the-loom side) is the registration ack.

### Failure modes

| What | How | Engine status | Ack content |
|---|---|---|---|
| HMAC mismatch | 401, no row written, no work | n/a | n/a |
| Duplicate `promotion_id` | 409, return stored `existing_skill_id` | unchanged | n/a |
| Schema validation fail | 400, field errors | n/a | n/a |
| Compiler error (markdown malformed, frontmatter missing required field) | n/a | `rejected` | `outcome="rejected"`, `error.field`, `error.issue` |
| Compiler timeout / engine overload | 503 + Retry-After header on the inbound POST | n/a (no row) | n/a |
| Ack callback POST fails | engine state stays at `compiled`; retry queue picks it up; the-loom dedups by `promotion_id` | `compiled` | (resent) |

## Compiler shape extensions

The existing `compile_skill_to_tool` takes an in-process `StudentSkill` row + a `BaseChatModel`. Phase 4 extends with:

### A new entry point for bridge-sourced candidates

```python
# core/skill_making/compiler.py — Phase 4 additions

def compile_from_bridge_candidate(
    candidate: PromotionCandidatePayload,
    *,
    name_collision_resolver: Callable[[str], str] = default_collision_resolver,
) -> CompiledSkillResult:
    """
    Takes a bridge-delivered candidate, materializes it into a StudentSkill
    shape, runs collision resolution on the suggested name (the-loom doesn't
    know the engine's existing catalog), and returns a CompiledSkillResult.

    Does NOT call compile_skill_to_tool directly; that runs at AGENT BUILD
    TIME against a specific model. This function persists the source +
    metadata; tool compilation happens later when an agent runtime needs
    the skill loaded.

    Returns:
      CompiledSkillResult(
          outcome="compiled" | "rejected" | "queued_human_review",
          skill_id=uuid or None,
          name=str or None,
          version="0.1.0",
          reason=str or None,
      )
    """
```

### Why two compile entry points

- `compile_skill_to_tool` — runtime, per-agent, per-model. Existing. Builds the langchain `StructuredTool` that the agent actually invokes.
- `compile_from_bridge_candidate` — catalog-write, model-agnostic. New. Persists the skill source + metadata; chooses a final name; emits the result.

The runtime path stays as-is. The bridge path feeds into the same catalog the runtime loads from.

### Collision resolution

The-loom suggests a `name` in the candidate's frontmatter. The engine's catalog may already have that name (from a human-authored skill, or a previous promotion). The resolver:

- Same `pattern_signature` already promoted → return `409 Conflict` upstream in the receiver (not a collision; it's an idempotency hit).
- Same `name`, different content → append `-promoted-N` suffix; record the rename in the ack so the-loom updates its display.
- Same `name`, exact content → return `409 Conflict` (the same skill was promoted via a different `promotion_id` — shouldn't happen but handle).

## Where each piece lives

| Concern | Module | Layer |
|---|---|---|
| HTTP route + HMAC verification + idempotency check | `services/skill_making/bridge_receiver.py` (post-Phase-5 location) | services |
| Schema models | `services/skill_making/models.py` (new) | services |
| Tenant scoping | `core/auth/tenant_context.py` (existing) | core |
| Catalog persistence | `core/skill_making/catalog.py` (new — promoted_skills table) | core |
| Compilation entry point | `core/skill_making/compiler.py` (extend existing) | core |
| Ack sender (HMAC-sign + POST back to callbacks.registration_ack) | `services/skill_making/ack_sender.py` (new) | services |
| Telemetry callback emission | `core/observability/` helpers + a hook in the runtime loop | core |

## Dependencies on Phases 0-3 (why this can't ship today)

- **Phase 0** (Stop-hook upskilling pass): the candidate source. Without the agent actually running the pass, the local observer has nothing to observe.
- **Phase 1** (candidate registry slice): the upstream the receiver consumes from. Without it, there are no candidates to POST.
- **Phase 2** (local observer): generates Path A candidates from .project-intelligence/ state. Without it, Path A doesn't exist.
- **Phase 3** (cross-project pattern detection): generates Path B candidates. Without it, only Path A exists.

The receiver only matters when candidates are being POST'd at it. The compiler-extension only matters when the receiver is delivering candidates. Building Phase 4 before 0-3 is the Potemkin failure mode this sketch explicitly avoids.

## Open questions for Phase-4-time decision

1. **`promoted_skills` table schema** — should this be a separate table from human-authored skills, a discriminator column on the existing skills table, or a polymorphic `source_origin` field? Affects how the runtime catalog query looks.
2. **Tenant scoping for global candidates (`tenant_id: null`)** — does a global candidate become a shared row visible to every tenant, or a per-tenant copy at promote time? Affects RLS policy on `promoted_skills`.
3. **Version bumps** — when the-loom POSTs an updated version of an existing skill (same `pattern_signature`, new content), do we bump `version` automatically or require a different `promotion_id`?
4. **Compiler model selection** — `compile_from_bridge_candidate` is model-agnostic (no LLM call at promote time), but `compile_skill_to_tool` needs a model. When a runtime instance loads a promoted skill, which model does it use — the agent's configured model, or one specified in the candidate's frontmatter? (Probably the agent's; candidate frontmatter shouldn't dictate runtime choices.)
5. **What happens to the rejection rate** — if the compiler rejects > X% of incoming candidates, that's signal the-loom's stability detection is too loose. Worth emitting as a telemetry callback so the-loom can tune its detection threshold.

## What's NOT in scope here

- The Atelier page in `loom-platform` (formerly referred to as "the Pillar 2 page" before the 2026-06-12 rename). Phase 6. Not until the candidate flow is real.
- The candidate registry's full ontology (just-enough fields per Loom-agent's Phase 1 plan).
- The seven-signal compute. Lives in the local observer + cross-project pattern detection (Phases 2-3).
- The agentic-upskilling skill body changes. Phase 0 forcing-function may reveal them; sketch them when they surface.

## Related

- [`2026-05-25-skill-making-bridge.md`](2026-05-25-skill-making-bridge.md) — wire contract (canonical for the message shapes)
- [`2026-05-31-three-layer-engine-spec.md`](2026-05-31-three-layer-engine-spec.md) — where these modules live in the three-layer model
- [`2026-06-01-mvp-migration.md`](../plans/2026-06-01-mvp-migration.md) — the migration that landed `services/skill_making/` and `core/skill_making/`
