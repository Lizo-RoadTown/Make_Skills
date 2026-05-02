"use client";
import { StubPage } from "@/components/StubPage";

export default function CredentialsPage() {
  return (
    <StubPage
      title="Credentials"
      pillar="Manage — per-tenant secrets"
      blurb="Per-tenant API keys and endpoints. Today these live as env vars on the api container; this page becomes the UI surface to register and rotate them. Backed by a tenant_secrets table (Pillar 0 stage 2) with pgcrypto-encrypted columns at rest. Each row is scoped to your tenant via the existing app.tenant_id RLS pattern."
      bullets={[
        "Add / edit / delete: Anthropic, OpenAI, Google, Hugging Face, Together, Groq API keys",
        "BYO Ollama endpoint registration: URL + auth header (lights up Stage 2 of the BYO Ollama path)",
        "Test-connection button per credential (one-shot ping with the key)",
        "Audit: when each credential was added, last used, last rotated",
        "Encrypted at rest via pgcrypto",
      ]}
      references={[
        {
          label: "BYO personal Ollama proposal — Stage 2 description",
          href: "/proposals",
        },
        {
          label: "Pillar 0 tenant abstraction — RLS scoping",
          href: "/proposals",
        },
      ]}
    />
  );
}
