"use client";
import { StubPage } from "@/components/StubPage";

export default function AgentsPage() {
  return (
    <StubPage
      title="Your clan"
      pillar="Pillar 1 — Build agents"
      blurb="The character-creation flow for your AI. Six guided steps that double as STEM education in disguise: pick a starter creature, name it, choose a brain (Anthropic/OpenAI/Google subscriptions OR Hugging Face/Together/Groq for free open-weight access OR local Ollama), pick a class (researcher / builder / tutor / generalist / custom), select starter skills, and have your first guided conversation. Each subagent in your clan goes through the same creation flow when you spawn it later. The creature is yours for years — exportable, portable, upgradable like a phone."
      bullets={[
        "Step 1 — Pick your starter species (4 to start: slime, fern, sea-cucumber, mossy-stone)",
        "Step 2 — Name your creature (the agent suggests names based on species)",
        "Step 3 — Pick the brain — three paths: BYO subscription / open-weight hosted (HuggingFace Inference Providers default for students) / local Ollama",
        "Step 4 — Pick a class (researcher / builder / tutor / generalist / custom)",
        "Step 5 — Pick 3-5 starter skills from the library",
        "Step 6 — First conversation with three suggested prompts; creature stats update live",
        "After onboarding: add more skills, switch models, multi-class, spawn clan members, export/import",
      ]}
      references={[
        {
          label: "Design proposal — agent-builder-flow.md (the map)",
          href: "/docs",
        },
        {
          label: "Design proposal — agent-creatures-ui.md (the visual layer)",
          href: "/docs",
        },
        {
          label: "Skill — agentic-upskilling (lifelong skill growth)",
          href: "/skills",
        },
        {
          label: "Roadmap — Pillar 1",
          href: "/roadmap",
        },
      ]}
    />
  );
}
