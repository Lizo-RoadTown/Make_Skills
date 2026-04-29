"use client";
import { StubPage } from "@/components/StubPage";

export default function ObservabilityPage() {
  return (
    <StubPage
      title="Observability"
      pillar="Pillar 3 — Full system observability"
      blurb="Three sub-sections: agent comms (multi-agent flow tracing, token cost per skill, context-isolation audit), Grafana dashboards (already iframed at /dashboard), and the knowledge library (PROVES_LIBRARY-style extract → review → canonical knowledge graph — the largest sub-pillar, requires deep design discussion)."
      bullets={[
        "3a. Agent comms — when orchestrator → planner → researcher, where does time go? Token cost per agent / per skill. Verify context isolation contracts.",
        "3b. Grafana — already live at /dashboard. Pre-provisioned dashboards still TBD (skill usage, conversation count, recorder volume).",
        "3c. Knowledge library — your personal knowledge graph that grows from sessions. Records extracted, human review before canonical, graph queries.",
      ]}
      references={[
        { label: "Grafana (live)", href: "/dashboard" },
        { label: "Roadmap — Pillar 3", href: "/roadmap" },
        {
          label: "PROVES_LIBRARY (Liz's reference project)",
          href: "https://github.com/Lizo-RoadTown",
          external: true,
        },
      ]}
    />
  );
}
