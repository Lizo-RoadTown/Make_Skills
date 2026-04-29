"use client";
import { StubPage } from "@/components/StubPage";

export default function UpskillingPage() {
  return (
    <StubPage
      title="Agentic upskilling"
      pillar="Pillar 2 — Make skills together"
      blurb="The active practice of personalizing your agent over time. The agent observes which skills you invoke repeatedly, surfaces promotion candidates (skill → tool), and once you approve, the function is wired in. Same interface for every user; the content (your skills, your tools, your evolution) is unique to you."
      bullets={[
        "Your skill library — what wisdom your agent has accumulated",
        "Your tool library — what functions your agent can call",
        "Promotion candidates — skills used 3+ times, ready to mechanize",
        "Demotion candidates — tools that aren't earning their slot",
        "Promotion log — the audit trail of decisions",
        "Manual promotion — paste a skill name, click promote, agent generates the tool with two-mode tests",
      ]}
      references={[
        {
          label: "Skill — agentic-upskilling/SKILL.md",
          href: "/skills",
        },
        {
          label: "Skill — agentic-skill-design/SKILL.md (parent)",
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
