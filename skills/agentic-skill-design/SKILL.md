---
name: agentic-skill-design
description: Meta-skill for designing skills that DECIDE and EXECUTE rather than ask the user permission for every choice. Use when authoring a new skill or rewriting an existing skill that asks too many questions. Captures the PROBE → DECIDE → ACT → REPORT pattern Liz wants for stack-with-conditions requests.
---

# Agentic skill design

A skill is **agentic** when invoking it produces *work done* and *a report*, not *a checklist for the user to execute*.

The wrong shape (passive form):
> "I'll need to know: 1) your domain, 2) your DNS provider, 3) your hosting choice. Once you tell me these I can proceed."

The right shape (agentic):
> "Built the Next.js chat UI at `web/`. Local dev tested. Deployed preview to https://make-skills-abc.vercel.app. Used your authenticated Vercel account; defaulted to a Vercel-generated subdomain since no custom domain was found in `vercel domains ls`. To attach a custom domain, run `vercel domains add chat.example.com` and tell me to continue."

## The four stages

Every agentic skill body has these sections, in this order:

### 1. PROBE — read context before deciding

Anything you'd ask the user, try to read first. Common probes:

- Repo state: `find`, `ls`, reading config files
- Authenticated tools: `vercel whoami`, `gh auth status`, `aws sts get-caller-identity`, `docker ps`
- Memory files: `~/.claude/projects/.../memory/` — captured preferences from prior runs
- Existing presets in the skill's own `references/` directory
- Environment: env vars, OS, shell, installed package versions

Treat probes as cheap and questions as expensive. Spend probe budget liberally; spend question budget rarely.

### 1b. INVENTORY — consider ALL available tools, don't stop at first thought

Before picking implementation tools, **list what you have available** and pick deliberately:

- **Built-in tools** — Edit, Write, Read, Bash, Grep, Glob
- **MCP servers** active for this project — list them via the configured `.mcp.json` and any user-scoped servers (Vercel, GitHub, Context7 for live docs, etc.)
- **Subagents** — Plan, Explore, general-purpose, plus any specialist agents (vercel:*, claude-code-guide, etc.)
- **Skills** — both this repo's `skills/` and the upstream `claude/anthropics-skills/skills/`
- **Scheduled / background tools** — `ScheduleWakeup`, `Monitor`, `CronCreate` for delayed work

For each, ask: **does it materially fit this task?** Common forks the inventory step catches:

- "I need current docs for library X" → Context7 MCP exists, use it instead of guessing or fetching from the web
- "I need to do parallel independent searches" → general-purpose / Explore agent fits, not 10 sequential Greps
- "I need careful architectural reasoning" → Plan agent before diving into code
- "I'm about to write a runbook for the user" → that's the anti-pattern; pick an Action tool instead

Document the inventory in the response or commit message — both for the user's review and so the next agent learns which tools you considered and rejected. **Don't default to the boring obvious tools without explicitly considering the others.**

The cost of inventory is tiny (one minute of thinking); the cost of *missing* a better-fitted tool is real (slower, lower quality, more turns).

### 2. DECIDE — defensible defaults, reasoning recorded

For every decision, name the default and what would disconfirm it. Don't hand the choice to the user. The skill body should look like:

```
| Decision | Default | Disconfirm if |
|----------|---------|---------------|
| Frontend framework | Next.js | Existing project uses Astro/etc. |
| ...
```

Reasoning gets recorded in the **final report**, not in a question. ("Chose Next.js because it matches the user's other Vercel projects.")

### 3. ACT — run the actual work

Local-only and reversible actions don't need permission. Specifically:

- Generating files in a fresh directory
- Running `npm install`, `pip install` in a venv, etc.
- Starting / killing local dev servers
- Committing to a feature branch
- Deploying to a preview / staging environment if the credentials are already there

Don't generate runbooks for the user to follow. Run the commands.

### 4. STOP CONDITIONS — and only these

A skill should stop and ask ONLY when:

- **Auth is missing** that requires interactive login (`vercel login`, `gh auth login`)
- **Cost** would be incurred that wasn't pre-authorized (paid tiers, domain purchases, GPU minutes)
- **Irreversible** action (force-push, drop database, registrar changes, account deletion)
- **Genuine ambiguity** — probing genuinely couldn't resolve which of two paths to take

For everything else: decide, do, report.

### 5. REPORT — single concise summary at end

```
Built: <one-line description>
Live at: <URL or "local only">
Code at: <path>

Decisions made:
- <only non-default decisions, with reason>

Not yet wired:
- <thing>: <one-line action to do it>

Next: <ONE concrete action or "nothing — it's done">
```

No checklists. No "want me to X?" — if X is the obvious next step, record it as Next; if you can do X autonomously, just do it next time without announcing.

## How to write an agentic skill

When authoring or rewriting a skill, audit the body for these anti-patterns:

| Anti-pattern | Replace with |
|-------------|--------------|
| "First, ask the user X" | "Probe X by reading Y. Default to Z if probe fails." |
| Bulleted list of questions | Decision table with defaults + disconfirmers |
| "Confirm with user before continuing" | Stop conditions list (and "before continuing" should NOT be on it) |
| "I could do A or B" | Pick one with reasoning. Mention the other in the report. |
| Step-by-step runbook for the user | Steps the SKILL executes, in actor-perspective |
| Open-ended "what would you like next?" | One concrete Next or nothing |

## Memory loop (skills get sharper over time)

After a successful execution, write the durable knowledge somewhere persistent:

- **A new preset** — if the same combination might come up again, save the recipe to `references/preset-<name>.md` so the SECOND run is one-shot.
- **A user preference** — if the user accepted a non-default, that's a signal. Append to a `feedback_*.md` memory file or a `user_preferences.md`.
- **A domain / project mapping** — if the user authorized a particular target (Vercel team, GCP project, AWS account), save it.

The goal is that invocation N+1 makes fewer decisions than invocation N. After enough runs, the skill stops "deciding" altogether — it's just executing a recipe the system has learned.

## When NOT to make a skill agentic

Some skills genuinely require human judgment at every step — typically:

- **Creative writing** where the user's voice is the input
- **Personal communication drafts** (email, LinkedIn, etc.) where tone is non-negotiable
- **Strategic decisions** with non-obvious trade-offs (e.g., "should we adopt X framework?")

These skills can stay conversational. The pattern in this doc is for *executable* tasks: scaffolds, deploys, builds, lint passes, refactors with clear scope.

## Reference implementation

[`web-app-scaffold/SKILL.md`](../web-app-scaffold/SKILL.md) is the canonical example of this pattern in this repo. Read it as the worked-through template.
