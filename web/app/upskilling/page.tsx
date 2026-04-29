"use client";
import { StubPage } from "@/components/StubPage";

export default function UpskillingPage() {
  return (
    <StubPage
      title="Quests & Upskilling"
      pillar="Pillar 2 — Make skills together"
      blurb="Quests are self-contained mini-projects (a landing page for a local business, a 30-second music loop, a reproduction of a published methodology) that grant skills to a creature. Three sources: a curated library, AI-generated personalized quests, and user-defined quests. Quest completion data feeds the observability layer and the clan-cap retirement mechanic."
      bullets={[
        "Quest categories: music, business, science, social impact, custom",
        "Three sources: curated library (20-30 launch quests), AI-generated, user-defined",
        "Mechanics: accept → work in chat → progress milestones at 25/50/75% → verify → reward (XP, skills, body parts, occasional evolution)",
        "Skill→tool promotion fires when a skill is repeated across quests",
        "After ~3-5 quests, Pillar 3 observability has enough data per creature for optimization guidance",
        "At clan-cap, retire underperformers against declared goals. Archive, not delete.",
        "Phase 2 (post-MVP): group quests, shared knowledge observatories, organizations, collective neural networks",
      ]}
      references={[
        {
          label: "Design proposal — quest-system.md",
          href: "/docs",
        },
        {
          label: "Design proposal — agent-retirement-and-clan-optimization.md",
          href: "/docs",
        },
        {
          label: "Skill — agentic-upskilling",
          href: "/skills",
        },
        {
          label: "Roadmap — Pillar 2",
          href: "/roadmap",
        },
      ]}
    />
  );
}
