"use client";
import { StubPage } from "@/components/StubPage";

export default function UpskillingPage() {
  return (
    <StubPage
      title="Quests & Upskilling"
      pillar="Pillar 2 — Make skills together"
      blurb="Skill acquisition through real work. Each quest is a self-contained mini-project (build a landing page for a real local business, compose a 30-second loop, reproduce a published methodology) that grants skills to your creature and quietly teaches engineering. Curated library + AI-generated personalized quests + your own user-defined quests. After several completed quests, the observability layer surfaces who's earning their keep — that's where the retirement mechanic kicks in."
      bullets={[
        "Quest categories: music · make money (business) · contribute to science · social impact · custom",
        "Three sources: curated library (20-30 launch quests) / AI-generated personalized / user-defined",
        "Live mechanics: accept → work in chat → progress milestones at 25/50/75% with guidance prompts → verify → reward (XP, skills, body parts, occasional creature evolution)",
        "Skill→tool promotion happens NATURALLY as quest completion repeats the same skill",
        "After ~3-5 quests, Pillar 3 observability becomes meaningful — token cost / speed / quality data per creature, with system guidance on what to optimize",
        "Hardest mechanic: at clan-cap, retire underperformers vs your declared goals. Archive (not delete) — the lifelong-companion promise.",
        "Phase 2 unlocks after solo loop mastery: group quests, shared knowledge observatories, organizations, collective neural networks",
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
          label: "Skill — agentic-upskilling (the skill→tool loop quests drive)",
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
