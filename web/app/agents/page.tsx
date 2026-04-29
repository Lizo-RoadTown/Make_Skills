"use client";
import { StubPage } from "@/components/StubPage";

export default function AgentsPage() {
  return (
    <StubPage
      title="Your clan"
      pillar="Pillar 1 — Build agents"
      blurb="A six-step character-creation flow: pick a species, name the creature, pick a model provider (Anthropic, OpenAI, Google, Hugging Face, Together, Groq, or Ollama), pick a class, select starter skills, and complete a first guided conversation. The same flow runs for each subagent added later. Agents are exportable and portable across deployments."
      bullets={[
        "Step 1 — Pick a starter species (slime, fern, sea-cucumber, mossy-stone)",
        "Step 2 — Name the creature (suggestions based on species)",
        "Step 3 — Pick a model provider: BYO subscription, open-weight hosted (HuggingFace default), or local Ollama",
        "Step 4 — Pick a class (researcher, builder, tutor, generalist, custom)",
        "Step 5 — Pick 3-5 starter skills",
        "Step 6 — First conversation with three suggested prompts; creature stats update live",
        "Post-onboarding: add skills, switch models, multi-class, spawn clan members, export/import",
      ]}
      references={[
        {
          label: "Design proposal — agent-builder-flow.md",
          href: "/docs",
        },
        {
          label: "Design proposal — agent-creatures-ui.md",
          href: "/docs",
        },
        {
          label: "Skill — agentic-upskilling",
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
