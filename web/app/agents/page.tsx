"use client";
import { StubPage } from "@/components/StubPage";

export default function AgentsPage() {
  return (
    <StubPage
      title="Your clan"
      pillar="Pillar 1 — Build agents (multiplayer 3D clan management)"
      blurb="Each agent is a 3D creature in your clan. The orchestrator is your main creature; each subagent (planner, researcher, writer, custom specialists) is a related creature with its own board — its own status, mood, equipped skills, equipped tools, training focus. Tomagotchi-Spore-MMO mashup: cute low-poly creatures that evolve as you train them, each specializing for different work. You usually start with one or two specialists. Multiplayer means other users' clans are visible (scope TBD)."
      bullets={[
        "Each creature has its own board — a 3D viewport + stats + skills + tools + recent activity",
        "Skills become body parts on the specific creature that learned them — your researcher and your writer evolve different anatomies",
        "Cute low-poly 3D (think Crossy Road / Slime Rancher), built with three.js + react-three-fiber, mirroring the curation_dashboard precedent",
        "Specialize creatures for specific purposes — onboarding spawns 1-2 starting creatures with chosen roles",
        "Hibernate when neglected, never die. Optionally retire to a memento.",
        "Multiplayer (later): cross-clan visibility, federation of specialist creatures via MCP",
      ]}
      references={[
        {
          label: "Design proposal — agent-creatures-ui.md",
          href: "/docs",
        },
        {
          label: "Skill — agentic-upskilling (the growth loop)",
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
