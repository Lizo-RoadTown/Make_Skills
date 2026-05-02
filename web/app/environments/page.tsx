"use client";
import { StubPage } from "@/components/StubPage";

export default function EnvironmentsPage() {
  return (
    <StubPage
      title="Environments"
      pillar="Manage — deployment context"
      blurb="A single workspace can run in multiple environments: your laptop's self-host stack, a humancensys.com hosted account, and (when classrooms ship) a shared classroom workspace. This page surfaces which environment you're currently looking at and lets you switch between them — same agents, same memory, different runtime context."
      bullets={[
        "Current environment: shows PLATFORM_MODE (self_host / hosted) and active tenant",
        "Switcher: jump between Local self-host, Hosted personal, future Classroom contexts",
        "Per-environment status: api healthcheck, postgres reachable, Vercel/Render deploy state",
        "Diff view: shows which env vars are set in each environment (without revealing secrets)",
      ]}
      references={[
        {
          label: "Two-mode commitment in ARCHITECTURE.md",
          href: "/docs",
        },
        {
          label: "Sidebar architecture proposal",
          href: "/proposals",
        },
      ]}
    />
  );
}
