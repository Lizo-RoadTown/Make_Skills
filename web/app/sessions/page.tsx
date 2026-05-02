"use client";
import { StubPage } from "@/components/StubPage";

export default function SessionsPage() {
  return (
    <StubPage
      title="Sessions"
      pillar="Test — replay-with-trace"
      blurb="Each chat conversation is a session. This page becomes a list-and-replay surface: pick a past session, see the full message trace plus tool calls, token cost, latency, and which subagents got delegated to. Sessions are the unit of learning when something goes wrong — failure forensics, not just dashboards. Backed by the LangGraph checkpoint store + the conversations sidecar table that already maps thread_id to tenant_id."
      bullets={[
        "List of sessions (filterable by date, agent, status)",
        "Replay-with-trace: full message history + tool call timeline",
        "Per-session token cost and latency breakdown",
        "Subagent delegation graph (Pillar 3a — agent comms tracing)",
        "Forkable: clone any session into a new chat to retry from a checkpoint",
        "Shareable URL (within tenant) for peer review",
      ]}
      references={[
        {
          label: "Sidebar architecture proposal",
          href: "/proposals",
        },
        {
          label: "Pillar 0 — conversations table maps thread_id → tenant_id",
          href: "/proposals",
        },
        {
          label: "Roadmap — Pillar 3a agent comms",
          href: "/roadmap",
        },
      ]}
    />
  );
}
