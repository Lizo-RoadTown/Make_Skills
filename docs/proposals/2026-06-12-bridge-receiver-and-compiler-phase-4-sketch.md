# Bridge receiver + compiler — Phase 4 shape sketch

**Date:** 2026-06-12 (revised same day to incorporate Loom-agent's bridge-spec ratification adjustments — see `loom_agent_skill_bridge_ratification_2026_06_12_evening`)
**Status:** Sketch only. Phases 0-3 have landed in the-loom; Phase 6 (upskilling dashboard) exercised end-to-end on 2026-06-12 evening and confirmed the loop stalls at `status='promoted'` until this receiver exists. Implementation is unblocked — gated only on Liz's go.
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

## Loom-agent's 5 adjustments (2026-06-12 ratification)

Incorporated throughout this sketch:

1. **`tenant_id` is non-nullable UUID** — not `null` for "global." Catalog-scope is a separate `is_global: bool` flag. Today both sides use `SELF_HOST_TENANT_ID = 1d8ec1b3-d62a-5fab-9a52-eb6a3e09f1c8` (the 6-fleet-locations constant). See §"Tenant resolution."
2. **`capability_tags` + `triggers` are derived, not required in source frontmatter** — the-loom's `promote_dispatcher.py` computes these from observer signals (`signals.skill_name`, `evidence_refs[].kind`, repeat-count thresholds) and injects them into the payload. Receiver treats them as authoritative.
3. **Top-level `candidate_kind`** — added for the 9-kind taxonomy (skill / inline_tool / external_tool / architecture_pattern / service / machine_support / process / agent / orchestration). v1.0 receiver handles `kind=skill`; other kinds ack-but-defer (record candidate, return 202, no compile) so the audit chain stays unbroken while handlers are added in v1.1+.
4. **Callback URLs point at Render services**, not the dashboard's Vercel hostname. `loom-architecture-registry.onrender.com` (skill-registered), `loom-telemetry-ingestion.onrender.com` (skill-used). Env-var configurable.
5. **Engine side is NOT blocked** — Loom-agent's original adjustment cited the MVP layout migration as a blocker, but phases 2/3/5 have all merged (commits `ff0d206`, `2050128`, `e0ed6fb`); `services/skill_making/bridge_receiver.py` already exists as a stub. The build is unblocked on both sides; sequencing is Liz's call.

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
3. **Schema validate** — pydantic model `PromotionCandidatePayload`; per the wire spec's field set. Top-level fields include `schema_version`, `promotion_id`, `tenant_id` (non-nullable UUID), `candidate_kind` (one of the 9-kind taxonomy), `pattern_signature`, `source` (with frontmatter `{name, description}` only; `capability_tags` + `triggers` are derived and injected by the-loom's promote_dispatcher.py per adjustment #2), `evidence_refs`, `signals`, `is_global` (default `false`), `callbacks`. `400` with field-level errors on failure (helpful for the-loom to fix and retry).
4. **Tenant resolution** — `payload["tenant_id"]` is always a UUID (per adjustment #1). Engine reads the existing `core/auth/tenant_context.py`'s tenancy machinery to scope downstream storage. Catalog-scope is a separate `is_global` flag; if true, the row is visible cross-tenant via a system-tenant UUID owner (still a real UUID, not null).
5. **Kind dispatch** — branch on `candidate_kind`:
   - `skill` → continue to step 6 (full compile + persist + ack flow below)
   - Any other kind (inline_tool, external_tool, architecture_pattern, service, machine_support, process, agent, orchestration) → record candidate row with `status="kind_not_yet_handled"`, return 202 with `outcome="ack_deferred"`, no compile dispatch. v1.0 supports `kind=skill`; v1.1+ extends to additional kinds. Preserves audit chain; makes the gap loud-but-not-broken.
6. **Persist as queued** — write the candidate to a `promoted_skills` table with `status="queued"` keyed by `promotion_id`. This row is what later compile/ack callbacks reference.
7. **Return 202 immediately** — `{"promotion_id": "...", "status": "queued"}`. Compilation runs out-of-band.
8. **Dispatch to compiler** — async task. Three outcomes:
   - **Compiled** → `status="compiled"`, `skill_id` minted, ack sent.
   - **Rejected** → `status="rejected"`, reason recorded, ack sent with `outcome="rejected"`.
   - **Queued for human review** → `status="queued_human_review"`, ack sent with `outcome="queued_human_review"`.
9. **Telemetry callback** — when the compiled skill is first invoked by a real agent turn (later, in the runtime), `services/skill_making/` emits a `TelemetryCallback` per the bridge spec's message type 3 to `https://loom-telemetry-ingestion.onrender.com/skill-used` (env-var configurable: `LOOM_TELEMETRY_CALLBACK_URL`). The ack from step 8 goes to `https://loom-architecture-registry.onrender.com/skill-registered` (env-var: `LOOM_REGISTRATION_ACK_URL`).

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
| `candidate_kind` not in 9-kind taxonomy | 400, field error on `candidate_kind` | n/a | n/a |
| `candidate_kind` valid but not yet handled (v1.0: anything ≠ `skill`) | 202, candidate row written | `kind_not_yet_handled` | `outcome="ack_deferred"`, `reason="kind not supported in receiver vN"` |
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
2. **`is_global=true` semantics** (reframed per adjustment #1) — when a candidate sets `is_global: true`, does the row land under a designated system-tenant UUID with cross-tenant read visibility (single source of truth), OR get copied per-tenant at promote time (independent rows)? Affects RLS policy on `promoted_skills`. Lean: system-tenant ownership + cross-tenant read grant for queryable global catalog.
3. **Version bumps** — when the-loom POSTs an updated version of an existing skill (same `pattern_signature`, new content), do we bump `version` automatically or require a different `promotion_id`?
4. **Compiler model selection** — `compile_from_bridge_candidate` is model-agnostic (no LLM call at promote time), but `compile_skill_to_tool` needs a model. When a runtime instance loads a promoted skill, which model does it use — the agent's configured model, or one specified in the candidate's frontmatter? (Probably the agent's; candidate frontmatter shouldn't dictate runtime choices.)
5. **What happens to the rejection rate** — if the compiler rejects > X% of incoming candidates, that's signal the-loom's stability detection is too loose. Worth emitting as a telemetry callback so the-loom can tune its detection threshold.
6. **Non-skill kinds — ack-defer vs hard-501** (new per adjustment #3) — v1.0 currently sketched as ack-defer (record candidate, return 202 with `outcome="ack_deferred"`). Alternative: return 501 Not Implemented, no row written. Ack-defer preserves the audit chain and lets the-loom show "queued for handler" to the operator; hard-501 makes the gap loud. Lean: ack-defer.

## What's NOT in scope here

- The Atelier page in `loom-platform` (formerly referred to as "the Pillar 2 page" before the 2026-06-12 rename). Phase 6. Not until the candidate flow is real.
- The candidate registry's full ontology (just-enough fields per Loom-agent's Phase 1 plan).
- The seven-signal compute. Lives in the local observer + cross-project pattern detection (Phases 2-3).
- The agentic-upskilling skill body changes. Phase 0 forcing-function may reveal them; sketch them when they surface.

## Related

- [`2026-05-25-skill-making-bridge.md`](2026-05-25-skill-making-bridge.md) — wire contract (canonical for the message shapes)
- [`2026-05-31-three-layer-engine-spec.md`](2026-05-31-three-layer-engine-spec.md) — where these modules live in the three-layer model
- [`2026-06-01-mvp-migration.md`](../plans/2026-06-01-mvp-migration.md) — the migration that landed `services/skill_making/` and `core/skill_making/`
