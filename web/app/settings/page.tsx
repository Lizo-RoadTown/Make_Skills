"use client";
import { StubPage } from "@/components/StubPage";

export default function SettingsPage() {
  return (
    <StubPage
      title="Settings"
      pillar="Manage — account"
      blurb="Account-level configuration for the signed-in user. Profile basics, notification preferences, billing (when the hosted product introduces paid tiers), and sign-out flow live here. The bottom-pinned profile chip in the sidebar is the entry point; this page is the full surface."
      bullets={[
        "Profile: name, email, avatar (synced from OAuth provider)",
        "Linked accounts: which providers are linked (GitHub, Google), unlink option",
        "Notification preferences: weekly digest, quest milestones, public commons replies",
        "Billing (Phase 2): plan, payment method, invoices",
        "Danger zone: delete account → cascade-deletes tenant data per the GDPR three-state lifecycle in Pillar 0",
      ]}
      references={[
        {
          label: "Pillar 0 — GDPR three-state deletion",
          href: "/proposals",
        },
        {
          label: "Bootstrap-first-user proposal",
          href: "/proposals",
        },
      ]}
    />
  );
}
