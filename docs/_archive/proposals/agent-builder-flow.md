# Proposal: Agent-builder flow (Pillar 1 onboarding map)

**Status:** Open — design ready, mechanics need her sign-off before implementation
**Date:** 2026-04-29
**Connects:** [`agent-creatures-ui.md`](agent-creatures-ui.md) (the visual layer this flow produces)

## Framing — onboarding IS the curriculum

Per [STEM gamified vision](https://github.com/Lizo-RoadTown/Make_Skills/blob/main/skills/agentic-skill-design/SKILL.md): students build their own AI in early university and carry it with them through life. The first 10 minutes of using Make_Skills should feel like character creation in an RPG — and quietly teach them prompt engineering, tool use, multi-agent orchestration, and observability discipline along the way.

The agent-builder is **not a config form**. It's an immersive walkthrough where each step produces a tangible piece of their creature.

## The map — six steps from zero to a working agent

```
                       ┌──────────────────────┐
                       │ START — landing /    │
                       │  agents               │
                       └──────────┬───────────┘
                                  │
                                  ▼
┌──────────────────────────────────────────────────────────────────┐
│ STEP 1 — Pick your starter species                                │
│   3D species gallery (5–8 base creatures, low-poly cute):         │
│     · slime / blob          · fuzzy fern         · sea-cucumber   │
│     · mossy stone           · cloud-puff         · bramble        │
│   Walkthrough: "Each creature has different starting stats and    │
│   evolves differently as you train it. You can swap later."       │
└──────────────────────────────┬───────────────────────────────────┘
                               │
                               ▼
┌──────────────────────────────────────────────────────────────────┐
│ STEP 2 — Name your creature                                       │
│   Text input + a "name suggestions" button (the agent itself      │
│   suggests 5 names based on the chosen species)                   │
│   Walkthrough: "This name is permanent in your creature's history │
│   but you can give it nicknames later."                           │
└──────────────────────────────┬───────────────────────────────────┘
                               │
                               ▼
┌──────────────────────────────────────────────────────────────────┐
│ STEP 3 — Pick your creature's brain (model provider)              │
│   Three paths laid out side by side:                              │
│                                                                    │
│   ┌─ BYO subscription ─┐  ┌─ Open-weight hosted ─┐  ┌─ Local ──┐ │
│   │ Anthropic (Claude) │  │ HuggingFace          │  │ Ollama   │ │
│   │ OpenAI (GPT)       │  │ Together AI          │  │ LM Studio│ │
│   │ Google (Gemini)    │  │ Groq                 │  │          │ │
│   │                    │  │ Replicate            │  │          │ │
│   │ → paste API key    │  │ Fireworks            │  │ → URL of │ │
│   │ → your bills       │  │                      │  │   local  │ │
│   │                    │  │ → free-tier or paid  │  │   server │ │
│   │ Best for: power    │  │   per request        │  │          │ │
│   │   users            │  │ Best for: students   │  │ Best for:│ │
│   │                    │  │   on a budget        │  │ privacy +│ │
│   │                    │  │                      │  │ no quota │ │
│   └────────────────────┘  └──────────────────────┘  └──────────┘ │
│                                                                    │
│   Walkthrough: "Your creature's brain is the model that powers    │
│   its thinking. Different models have different strengths and     │
│   costs. You can switch later — the personality and skills carry │
│   over."                                                          │
└──────────────────────────────┬───────────────────────────────────┘
                               │
                               ▼
┌──────────────────────────────────────────────────────────────────┐
│ STEP 4 — Pick a class / specialization                            │
│   Cards for each role with what they're good at:                  │
│     · Researcher — finds and synthesizes information              │
│     · Builder — writes code and scaffolds projects                │
│     · Tutor — explains concepts and walks through problems        │
│     · Generalist — does a bit of everything                       │
│     · Custom — define your own (advanced)                         │
│   Walkthrough: "Class determines starting skills and what kinds   │
│   of body parts your creature naturally evolves. You can multi-   │
│   class later — your researcher can also learn to build."         │
└──────────────────────────────┬───────────────────────────────────┘
                               │
                               ▼
┌──────────────────────────────────────────────────────────────────┐
│ STEP 5 — Choose starter skills (3–5)                              │
│   Browse the skill library, with class-recommended picks pre-     │
│   selected. Each skill card shows: name, description, what it    │
│   teaches, and what body part it grants when learned.             │
│   Walkthrough: "Skills are your creature's wisdom — markdown      │
│   instructions it reads when working. You'll add more over time   │
│   and some will graduate into hard-coded tools."                  │
└──────────────────────────────┬───────────────────────────────────┘
                               │
                               ▼
┌──────────────────────────────────────────────────────────────────┐
│ STEP 6 — First conversation                                       │
│   Drop the user into a guided chat. Three suggested first asks:   │
│     · "Tell me about yourself"                                    │
│     · "What can you do for me right now?"                         │
│     · "Help me <something simple from their class>"               │
│   Sidebar shows the creature's stats updating live as the chat    │
│   progresses (XP/mood/energy ticking up).                         │
│   Walkthrough: "This is how you talk to your creature. Type or    │
│   click a suggestion. Watch the right side — that's your          │
│   creature reacting."                                             │
└──────────────────────────────┬───────────────────────────────────┘
                               │
                               ▼
                      ┌──────────────────────┐
                      │ MAIN APP — they're   │
                      │ landed on / (Chat)   │
                      │ with their creature  │
                      │ as the agent         │
                      └──────────────────────┘
```

## Model provider matrix (Step 3 detail)

The three paths students can choose from in Step 3, with concrete integrations:

### A. BYO paid subscription (power users)

| Provider | Auth | Best model for new students |
|----------|------|------------------------------|
| Anthropic | API key (`sk-ant-...`) | Claude Sonnet 4.6 (cost-efficient, smart) |
| OpenAI | API key (`sk-...`) | GPT-4o-mini (cheap), GPT-5 (smart) |
| Google | API key | Gemini 2.5 Flash (free tier exists), Gemini 2.5 Pro |
| Voyage | API key | (embedding-only — for memory) |

Wired through standard provider SDKs (`langchain-anthropic`, `langchain-openai`, etc.). Already partially supported in `deepagents.toml`'s `[model]` section.

### B. Open-weight hosted (free-tier-friendly, no credit card needed)

| Provider | Auth | Models | Free tier |
|----------|------|--------|-----------|
| Hugging Face Inference Providers | HF token | Qwen 3, Llama 3.x, DeepSeek, Mistral — all open weights | ~100 calls/day |
| Together AI | API key | Same open models, fast | Trial credits, then pay |
| Groq | API key | Llama 3.x, Qwen — extremely fast | Generous free tier |
| Replicate | API key | Open models + image/audio | Pay per second |
| Fireworks AI | API key | Open models + fine-tuned | Trial credits |

**Default for students without a budget:** Hugging Face Inference Providers. Their unified API exposes all major open-weight models behind one auth, free tier is generous, and the HF Hub presence makes it discoverable.

### C. Local (privacy + no quota)

| Tool | Auth | Models | Cost |
|------|------|--------|------|
| Ollama | none (localhost) | Llama 3.x, Qwen, Mistral — runs on user's machine | Free, requires GPU/RAM |
| LM Studio | none (localhost) | Same model catalog with a desktop UI | Free, requires GPU/RAM |
| llama.cpp | none (localhost) | GGUF quantized models | Free |

For students with capable laptops. Wired by setting `model.url` to `http://localhost:11434` (Ollama default) or similar.

## What the walkthrough teaches (covertly)

Each step is engineering education in disguise:

| Step | What they think they're doing | What they're actually learning |
|------|-------------------------------|--------------------------------|
| 1 | Picking a cute creature | Recognizing that "agents" have different baselines |
| 2 | Naming their pet | The notion of agent identity / persona |
| 3 | Picking a brain | Model selection, provider trade-offs, cost vs. quality |
| 4 | Picking a class | Specialization, system prompts, role contracts |
| 5 | Picking skills | Composability, prompt engineering, tool use |
| 6 | First conversation | Iterative refinement, observability of agent state |

By the time they're at the main app they've made five real decisions that practitioners make every day. They didn't read a tutorial.

## Customization layer (post-onboarding)

After Step 6 the student lands on the main app with their creature. From `/agents` they can:

- **Add more skills** (browse library, click "teach to my creature")
- **Switch models** (their brain changes; personality stays)
- **Multi-class** (give a researcher building skills too)
- **Visual customization** (swap species, color tweaks, accessories) — cosmetic only
- **Spawn additional creatures** (start their clan — Step 1 again for a new species)
- **Export creature** (download a JSON of state, skills, tools, history — the lifelong-portability promise)

## Two-mode discipline

| Mode | Where the creature lives |
|------|--------------------------|
| Self-host | Local LanceDB + their `subagents/<creature-name>/` directory; export goes to disk |
| Hosted | tenant-scoped postgres + LanceDB; export downloads JSON; future: import to another instance |

Same UX shape both modes. The "lifelong companion" promise requires the export/import path — that's a Pillar 0 concern (data portability).

## Open questions for sign-off

1. **Six steps too many?** Could collapse into 3-4 with sensible defaults. Lean: keep six because each is a teaching moment.
2. **HuggingFace as the default free path?** Their Inference Providers API is the most ecosystem-aligned. Confirm.
3. **Class system rigid or fluid?** Lean: 4 preset classes + Custom; multi-classing always available later.
4. **Visual fidelity for Step 1 species gallery?** 8 base species means 8 3D models to create. Lean: start with 4 (slime, fern, sea-cucumber, mossy-stone), add more as the system matures.
5. **First-conversation suggestions per class?** Need ~3 prompts per class — Liz to draft or curate.

## What this proposal does NOT cover

- The visual aesthetic of the 3D creatures (covered in `agent-creatures-ui.md`)
- The skill→tool promotion mechanic (covered in `agentic-upskilling`)
- The class-specific skill bundles (need to be authored — separate work)
- Multi-creature clan management UX (deferred)

## If accepted, becomes ADR-NNN with these specifics

- Six-step flow as above, sequence locked
- HuggingFace Inference Providers as the default free path
- Initial 4 species, 4 classes, 5–10 starter skills
- Walkthrough copy approved (drafts above as starting point)
- Export/import format specified (Pillar 0 portability)
