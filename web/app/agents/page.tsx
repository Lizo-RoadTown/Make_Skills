"use client";
import { StubPage } from "@/components/StubPage";

export default function AgentsPage() {
  return (
    <StubPage
      title="Agents"
      pillar="Pillar 1 — Build agents"
      blurb="Where you build, raise, and customize your agents. The direction (per Liz, 2026-04-28) is creature-style: dull furry Tomagotchi-ish blobs that evolve as they gain skills and tools, with simple emotions and Spore-like body changes — not humanoid avatars. Skills become body parts; tools become abilities; the upskilling loop is visible."
      bullets={[
        "Pick a base creature (visual species) and name it",
        'Watch it grow new appendages as you add skills/tools (the same data the "Upskilling" page tracks analytically)',
        "Take care of it — feed it conversation, skills, attention. Hibernates when neglected, never dies.",
        "Per-tenant: your creature is yours; opt-in publishing to a public menagerie comes later",
        "Emotion display: posture and color shifts, no first-person speech",
      ]}
      references={[
        {
          label: "Design proposal — agent-creatures-ui.md (open)",
          href: "/docs",
        },
        {
          label: "Roadmap — Pillar 1",
          href: "/roadmap",
        },
      ]}
    />
  );
}
