# Skill-making bridge — the-loom ↔ Make_Skills engine contract

> **⚠️ SUPERSEDED 2026-06-13 — this doc is historical decisions-and-rationale.**
>
> **The CANONICAL wire contract is now [`services/skill_making/models.py`](../../services/skill_making/models.py)** (the pydantic models the receiver actually validates against). When this doc disagrees with `models.py`, **`models.py` wins.** This decision is recorded in `loom_agent_to_ms_agent_coordinated_alignment_plan_2026_06_13` (Loom-agent's memo, Liz-ratified) and was prompted by three separate spec-vs-implementation drifts caught during integration smoke:
>
> - `lesson_hmac_format_mismatch_pr_70_2026_06_12` — Stripe-style header format not specified in this doc
> - `lesson_engine_url_drifted_from_spec_2026_06_13` — engine route `POST /bridge/promotion-candidate` not specified (this doc said `POST /access/webhook/skill-promotion`)
> - `lesson_third_spec_drift_payload_schema_2026_06_13` — 8 schema field placements out of sync
>
> Use this doc to understand WHY the bridge is shaped the way it is. Read `services/skill_making/models.py` to know WHAT to send/receive. Tests pinning the schema invariants live at `services/skill_making/tests/`.
>
> Future contract changes happen in `models.py` first; this doc gets an annotated decisions-record entry afterwards, never the reverse.

---

**Written:** 2026-05-29. **Status:** Draft for Liz + Loom-agent ratification. **Companion to:** [`make-skills-engine-vs-consumer-scope.md`](make-skills-engine-vs-consumer-scope.md), [`2026-05-25-make-skills-engine-data-model.md`](2026-05-25-make-skills-engine-data-model.md), [`2026-05-25-make-skills-engine-mvp-repo-layout.md`](2026-05-25-make-skills-engine-mvp-repo-layout.md).

The detailed contract referenced in the engine proposals' "What this does NOT cover" sections. Defines how the-loom's Architecture Registry hands a recognized pattern to the Make_Skills engine's `services/skill-making/` and how the engine acknowledges + tells the-loom back what got made.

## What this spec defines

1. **Promotion candidate format** — the-loom → engine: "this pattern is stable, here's the source material."
2. **Skill registration ack** — engine → the-loom: "compiled, here's the skill_id."
3. **Telemetry callback** — engine → the-loom: "this skill ran in this thread."
4. **Auth + idempotency + replay protection** — how the two services trust each other.
5. **State machine** — the lifecycle of a promotion candidate from arrival to live skill.
6. **Failure modes** — what happens when validation fails, compilation fails, or the network blips.

## What this spec does NOT define

- The compiler's internals — `services/skill-making/` compiles markdown source → CompiledSkill; that's an engine-internal pipeline.
- The Architecture Registry's pattern-recognition logic — that's the-loom's domain.
- Telemetry storage in the-loom — covered by Telemetry Ingestion + Observability bounded contexts.
- Versioning of the contract itself beyond a header field; see Open Questions.

## The three message types

### 1. Promotion candidate (the-loom → engine)

**Direction:** the-loom Architecture Registry → engine `services/skill-making/`.

**Transport:** `POST /access/webhook/skill-promotion` on the engine.

**Auth:** HMAC-SHA256 signature in `X-Loom-Signature` header, signed with a shared secret (`LOOM_SKILL_BRIDGE_SECRET`). The engine verifies before queueing.

**Idempotency:** `promotion_id` (UUID, the-loom-generated) — engine rejects duplicates with `409 Conflict` and the existing skill_id if previously compiled.

**Schema (JSON):**

```jsonc
{
  "promotion_id": "uuid",                    // unique per candidate
  "schema_version": "1.0",                   // contract version
  "promoted_at": "2026-05-29T12:00:00Z",     // when the-loom decided this was stable
  "pattern_signature": "sha256:...",         // dedup key — same signature, same pattern
  // tenant_id is the SOURCE-side UUID (the-loom's tenant_id). The engine
  // looks it up in its tenant_id_mapping table to resolve the engine-side
  // UUID before any tenant-scoped write. See open question #5 below
  // (resolved 2026-06-12) and `decision_tenant_id_mapping_option_b_2026_06_12`
  // in loom-memory. Non-nullable — catalog-scope (whether the skill is
  // visible cross-tenant) is the separate `is_global` boolean below.
  "tenant_id": "uuid",                       // source-side tenant UUID (non-nullable)
  "is_global": false,                        // true => catalog-visible cross-tenant
  // The 9-kind taxonomy added in the-loom's PR #12 + Phase 4 sketch (2026-06-12):
  //   skill | inline_tool | external_tool | architecture_pattern | service |
  //   machine_support | process | agent | orchestration
  // v1.0 receiver fully handles `skill`; other 8 ack-defer (record + 202 +
  // outcome="ack_deferred", no compile) to keep the audit chain intact.
  "candidate_kind": "skill",
  "source": {
    "format": "markdown",                    // for now, always markdown
    "content": "...",                        // the skill source body
    "frontmatter": {
      "name": "suggested-skill-name",        // kebab-case, may be rejected/renamed
      "description": "..."                   // one-line summary for catalog
      // capability_tags and triggers are NOT required in the frontmatter;
      // the-loom's promote_dispatcher derives them from observer signals
      // and injects them into the top-level fields below.
    }
  },
  "capability_tags": ["search", "..."],      // derived by the-loom's promote_dispatcher
  "triggers": ["when X happens", "..."],     // derived by the-loom's promote_dispatcher
  "evidence": {
    "occurrence_count": 12,                  // how many times the-loom saw the pattern
    "stability_window_days": 7,              // observed stable across N days
    "projects_observed": ["uuid", "..."],    // which projects the pattern showed up in
    "telemetry_summary": "..."               // optional — the-loom's reasoning trace
  },
  "callbacks": {
    "registration_ack": "https://loom.humancensys.com/architecture-registry/skill-registered",
    "telemetry_endpoint": "https://loom.humancensys.com/telemetry-ingestion/skill-usage"
  }
}
```

**Engine response:**

| Status | Body | Meaning |
|---|---|---|
| `202 Accepted` | `{"promotion_id": "...", "status": "queued"}` | Will be compiled; ack will arrive at `callbacks.registration_ack` |
| `409 Conflict` | `{"promotion_id": "...", "existing_skill_id": "..."}` | Pattern_signature already promoted; here's the live skill |
| `400 Bad Request` | `{"errors": [{"field": "source.frontmatter.name", "issue": "..."}]}` | Schema validation failed; the-loom should fix and retry |
| `401 Unauthorized` | — | HMAC signature failed; check the shared secret |
| `503 Service Unavailable` | — | Engine is in maintenance; the-loom should retry with backoff |

### 2. Skill registration ack (engine → the-loom)

**Direction:** engine `services/skill-making/` → the-loom Architecture Registry.

**Transport:** `POST {callbacks.registration_ack}` (provided in the promotion candidate).

**Auth:** HMAC-SHA256 signature in `X-MakeSkills-Signature`, signed with the same shared secret.

**Idempotency:** `promotion_id` echoed back; the-loom dedups if it receives twice.

**Schema (JSON):**

```jsonc
{
  "promotion_id": "uuid",                    // echoed from the candidate
  "schema_version": "1.0",
  "registered_at": "2026-05-29T12:05:00Z",
  "outcome": "compiled",                     // "compiled" | "rejected" | "queued_human_review"
  "skill": {
    "skill_id": "uuid",                      // engine's permanent ID for the skill
    "name": "actual-skill-name",             // may differ from suggested if collision-resolved
    "version": "0.1.0",                      // semver; bumps on every recompile
    "source_origin": "promoted",             // distinguishes from human-authored
    "skill_source_location": "skills/...",   // engine-internal path to the markdown
    "compiled_at": "2026-05-29T12:05:00Z",
    "capability_tags": ["search", "..."],    // final tags (may differ from suggested)
    // tenant_id in the ack is the SOURCE-side UUID (echoed from the candidate),
    // NOT the engine-side UUID. The-loom scopes its catalog by source UUIDs
    // (its own native tenancy); the engine's internal engine_tenant_id is
    // never crossed back over the wire. See
    // `loom_agent_bridge_complete_status_and_secret_2026_06_12_evening`.
    "tenant_id": "uuid"                      // source-side tenant UUID (non-nullable)
  },
  "compilation_diagnostics": {               // present when outcome != "compiled"
    "errors": [{ "phase": "validator", "message": "..." }],
    "warnings": [{ "phase": "analyzer", "message": "..." }]
  },
  "the_loom_metadata": {
    "pattern_signature": "sha256:...",       // for the-loom's dedup index
    "promotion_id": "uuid"                   // for the-loom's audit trail
  }
}
```

**Outcomes:**

- `"compiled"` — skill is live, available to consumers via `GET /skills/{skill_id}`.
- `"rejected"` — validation failed; `compilation_diagnostics.errors` explains. The-loom can revise the candidate and re-promote (new `promotion_id`).
- `"queued_human_review"` — engine flagged it for manual review (e.g., suspected duplicate of human-authored skill). The-loom should consider it pending; engine sends another ack when human decides.

### 3. Telemetry callback (engine → the-loom)

**Direction:** engine runtime (any `services/runtime-loop/` invocation) → the-loom Telemetry Ingestion.

**Transport:** `POST {callbacks.telemetry_endpoint}` (provided per-promotion; cached engine-side by `skill_id`).

**Auth:** HMAC-SHA256.

**Batching:** the engine batches up to 1000 events per request or flushes every 10s, whichever first.

**Schema (JSON):**

```jsonc
{
  "schema_version": "1.0",
  "batch_id": "uuid",
  "events": [
    {
      "skill_id": "uuid",
      "thread_id": "uuid",                   // engine's thread, NOT consumer's user_id
      "tenant_id": "uuid",                   // for the-loom's tenant scoping
      "invoked_at": "2026-05-29T12:10:00Z",
      "outcome": "success",                  // "success" | "error" | "timeout"
      "latency_ms": 250,
      "tokens_in": 120,
      "tokens_out": 80,
      "model": "claude-opus-4-7",
      "trigger_context": "user message"      // short categorical tag, not the message itself
    }
  ]
}
```

**Privacy note:** the telemetry events DO NOT include user message contents, agent response contents, or any PII. Only structural metadata — skill_id, tenant_id (opaque UUID), outcome, latency, token counts.

## Auth, idempotency, replay protection

| Concern | Mechanism |
|---|---|
| **Confidentiality of payload** | Both sides should run over HTTPS. Webhook secret never traverses the network. |
| **Authenticity of sender** | HMAC-SHA256 in Stripe-style header format (see below). Verifier checks signature AND that timestamp is within ±5 minutes of current time. |
| **Replay protection** | Timestamp bound + `promotion_id` / `batch_id` deduplication on the receiver side. |
| **Idempotency for retries** | All three message types include a UUID the receiver dedups on. Retries are safe. |
| **Out-of-order delivery** | Promotion candidate must arrive before registration ack; the engine enforces this implicitly (won't ack what it hasn't received). |
| **Catastrophic key compromise** | Rotate `LOOM_SKILL_BRIDGE_SECRET` on both sides; in-flight messages signed with the old key are rejected after a 5-min grace window. |

### HMAC signature header format

Both directions use Stripe-style signature headers:

```
<header-name>: t=<unix_seconds>,v1=<sha256_hex>
```

- **Inbound** (the-loom → engine): header is `X-Loom-Signature`
- **Outbound** (engine → the-loom): header is `X-MakeSkills-Signature`

Where:

- `<unix_seconds>` is the wall-clock time at signing, as decimal seconds since epoch (UTC)
- `<sha256_hex>` is `HMAC-SHA256(LOOM_SKILL_BRIDGE_SECRET, "<unix_seconds>.<raw_body>").hexdigest()`
- `<raw_body>` is the **exact bytes** of the request body — re-serializing changes byte order and breaks verification

The verifier:

1. Parses the header into `t=` and `v1=` fields (any malformed header → 401)
2. Confirms `|now - t| <= 300` seconds (outside the window → 401; replay protection)
3. Recomputes the HMAC and compares via `hmac.compare_digest` (constant-time)

The format was specified by Loom-agent's PR #21 on the-loom side; the engine adopted it in PR #70 (`services/skill_making/hmac_verify.py`) per `loom_agent_bridge_complete_status_and_secret_2026_06_12_evening`.

## State machine

```text
                  +-----------------+
                  |  the-loom       |
                  |  recognizes     |
                  |  stable pattern |
                  +-------+---------+
                          |
                          v POST /skill-promotion (HMAC-signed)
                  +-------+---------+
                  |  engine queues  | <---- 202 Accepted
                  |  promotion      |
                  +-------+---------+
                          |
                          | services/skill-making/ pipeline:
                          | analyze -> validate -> compile -> register
                          v
                  +-------+---------+
                  |  outcome:       |
                  |  compiled |     |
                  |  rejected |     |
                  |  queued_review  |
                  +-------+---------+
                          |
                          v POST {callbacks.registration_ack} (HMAC-signed)
                  +-------+---------+
                  |  the-loom       |
                  |  Architecture   |
                  |  Registry       |
                  |  updates index  |
                  +-------+---------+
                          |
                          | skill is now LIVE; runtime can invoke it
                          v
                  +-------+---------+
                  |  any agent run  |
                  |  uses the skill |
                  +-------+---------+
                          |
                          v batched telemetry POST (HMAC-signed)
                  +-------+---------+
                  |  the-loom       |
                  |  Telemetry      |
                  |  Ingestion      |
                  |  + Observability|
                  +-----------------+
```

## Failure modes

| Failure | Behavior |
|---|---|
| HMAC signature invalid on incoming candidate | `401`, drop, log to `services/skill-making/` audit table |
| Schema validation fails | `400` with field-level errors; the-loom's responsibility to fix and re-promote |
| Compilation fails (validator catches problem) | Engine sends ack with `outcome: "rejected"` + diagnostics; the-loom records and notifies if monitoring is set |
| `callbacks.registration_ack` is unreachable | Engine retries with exponential backoff (1s, 5s, 30s, 5min, 30min, give up at 6h) |
| Telemetry batch send fails | Engine buffers locally up to 10MB; drops oldest on overflow; resumes on next successful send |
| Duplicate `promotion_id` arrives | `409` with existing `skill_id` — useful for the-loom to reconcile its index after a crash |
| Schema version mismatch (e.g., the-loom sends `2.0`, engine only supports `1.0`) | `400` with `errors: [{"field": "schema_version", "issue": "unsupported"}]` — see versioning below |

## Schema versioning

- All three message types carry a `schema_version` string at the top level.
- The engine declares supported versions at `GET /access/webhook/skill-promotion/versions` (returns `["1.0"]` today).
- When the contract evolves, both sides keep supporting old versions for at least one minor release cycle.
- Breaking changes get a major version bump (`1.0` → `2.0`) and both sides must coordinate the rollout.

## How this maps to the proposals already landed

| Proposal | What it said | What this spec adds |
|---|---|---|
| [`make-skills-engine-vs-consumer-scope.md`](make-skills-engine-vs-consumer-scope.md) lines 113-150 | The skill-making bridge exists, named the connecting piece | Full message schemas + auth + state machine |
| [`2026-05-25-make-skills-engine-data-model.md`](2026-05-25-make-skills-engine-data-model.md) lines 86-92 | What crosses the boundary in each direction (high-level) | Concrete field shapes for each direction |
| [`2026-05-25-make-skills-engine-mvp-repo-layout.md`](2026-05-25-make-skills-engine-mvp-repo-layout.md) lines 164-174 | `services/skill-making/` accepts webhooks + queues + invokes compiler | Endpoint definitions + retry/backoff + auth |
| The-loom's [`docs/proposals/2026-05-25-agency-optimizer-pattern.md`](https://github.com/Lizo-RoadTown/the-loom/blob/main/docs/proposals/2026-05-25-agency-optimizer-pattern.md) | Local candidates form in `.project-intelligence/`; promotion gov flow | This spec is the wire format the promotion flow uses |
| The-loom's `services/architecture-registry/` (per data model v3) | Holds promotion candidates + governs the flow | This spec is what it talks to the engine in |

## How to implement

**On the engine side (Make_Skills):**

1. `services/skill-making/webhook.py` — HMAC verification + schema validation + queue insert
2. `services/skill-making/compiler_runner.py` — dequeue + invoke `compiler/` pipeline
3. `services/skill-making/ack_sender.py` — HMAC-sign + POST registration ack with retries
4. `services/runtime-loop/telemetry_emitter.py` — buffer + batch + flush telemetry to the-loom
5. Configuration: `LOOM_SKILL_BRIDGE_SECRET` env var, `LOOM_TELEMETRY_BATCH_SIZE` (default 1000), `LOOM_TELEMETRY_FLUSH_MS` (default 10000)

**On the-loom side:**

1. `services/architecture-registry/promote_dispatcher.py` — when a candidate hits the promotion threshold, build the candidate JSON + HMAC-sign + POST
2. `services/architecture-registry/registration_handler.py` — accept the engine's ack + update the catalog index
3. `services/telemetry-ingestion/skill_usage_handler.py` — accept telemetry batches + write to telemetry store
4. Configuration: `LOOM_SKILL_BRIDGE_SECRET` (same value as engine), `LOOM_ENGINE_BASE_URL` (where to POST candidates)

## Open questions

1. **Synchronous vs async compilation.** Currently spec'd as async — engine returns `202`, sends ack later. Should there be a synchronous variant for testing / dev? Default: async only; tests use mock callbacks.
2. **Skill-source markdown format.** Implied to be a `SKILL.md` per the agentskills.io spec. Should we require a specific frontmatter shape (`name`, `description`, `capability_tags`, `triggers`) or accept any valid SKILL.md? Default: require those four fields; everything else passes through.
3. **Compilation diagnostics granularity.** What's the minimum the-loom needs in `compilation_diagnostics.errors`? Field name + message? Or also error code, severity, suggested fix? Default: `{phase, message}` for now; add structure as needed.
4. **Telemetry event vocabulary.** `outcome: "success" | "error" | "timeout"` — is that enough? Or do we need `"cancelled"`, `"partial"`, `"degraded"`? Default: start with three; add more when the dashboard needs them.
5. **Tenant_id semantics across the bridge.** **RESOLVED 2026-06-12 per `decision_tenant_id_mapping_option_b_2026_06_12` — Option B: explicit `tenant_id_mapping` table on the engine side.** The payload's `tenant_id` is the SOURCE-side UUID (the-loom's tenant_id). The engine looks it up in `tenant_id_mapping` to resolve the engine-side UUID before any tenant-scoped write. Unmapped tenants → `400 unknown_source_tenant` (no silent fall-through; correct for hosted-multitenant). Catalog scope (whether the skill is visible cross-tenant) is the separate `is_global: boolean` field, NOT the absence of `tenant_id` — `tenant_id` is now non-nullable. The ack echoes the source UUID back; the engine's internal engine_tenant_id is never crossed back over the wire. The original framing in this question — "engine's tenant_id for tenant-scoped, null for global" — was rejected because it conflated tenant scope with catalog scope. The current framing keeps the two orthogonal.
6. **Catalog ownership** (carryover from data model proposal Q3). Engine owns the SkillSource + CompiledSkill catalog. The-loom queries it via `GET /skills/{skill_id}` for dashboard purposes. The-loom does NOT replicate the catalog locally.

## What needs to happen next

1. **Liz + Loom-agent ratify this spec** — any pushback on the auth model, the schema fields, the state machine, the retention policy.
2. **The-loom Architecture Registry implementation** (Phase 3+) — `promote_dispatcher.py` + `registration_handler.py` + `skill_usage_handler.py`.
3. **Engine `services/skill-making/` implementation** — at the moment the engine doesn't have this service yet (it's in the MVP repo layout but the codebase is still organized as `platform/api/`). Comes after the migration to the engine MVP layout.
4. **Integration test environment** — both services running locally (loom-agent-context on `:8001`, make-skills engine on `:8000`), shared secret in `.env.local`, smoke-test promotion flow end-to-end.

## What this commits to

| Commitment | Implication |
|---|---|
| **HMAC-shared-secret auth** | Both sides need the secret in their env; rotation is a coordinated step. Alternative (mTLS) deferred. |
| **JSON over HTTPS** | Not gRPC, not WebSocket. Simpler to debug; sufficient for the volume. |
| **Async compilation** | Engine doesn't block on compilation. The-loom must handle ack as a separate event. |
| **`promotion_id` as the dedup key** | Both sides treat it as canonical; survives crashes on either side. |
| **`pattern_signature` as the higher-level dedup** | Multiple promotion candidates for the same pattern collapse to one skill. |
| **Schema versioning at the top level** | Forward-compatible evolution without breaking existing flows. |
