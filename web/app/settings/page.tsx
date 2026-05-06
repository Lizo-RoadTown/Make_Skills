"use client";
import Link from "next/link";

const SECTIONS = [
  {
    href: "/settings/keys",
    title: "Provider keys",
    blurb:
      "Paste your own API keys for the LLM providers your agents use. Stored encrypted at rest.",
    status: "live",
  },
  {
    href: "#",
    title: "Profile",
    blurb: "Your name, email, avatar (synced from your sign-in provider).",
    status: "soon",
  },
  {
    href: "#",
    title: "Linked accounts",
    blurb: "Which OAuth providers are linked. Unlink option.",
    status: "soon",
  },
  {
    href: "#",
    title: "Notifications",
    blurb:
      "Weekly digests, quest milestones, replies on the public commons.",
    status: "soon",
  },
  {
    href: "#",
    title: "Export your data",
    blurb:
      "Download everything you've built — agents, skills, integrations, your guide's state. Portable.",
    status: "soon",
  },
  {
    href: "#",
    title: "Danger zone",
    blurb: "Delete your account. Cascades to your tenant data.",
    status: "soon",
  },
];

export default function SettingsPage() {
  return (
    <div className="flex h-full flex-col">
      <header className="border-b border-zinc-800 bg-zinc-900 px-8 py-5">
        <div className="text-xs uppercase tracking-wider text-zinc-500">
          Manage · Account
        </div>
        <h1 className="text-xl font-semibold text-zinc-100">Settings</h1>
        <p className="mt-1 max-w-3xl text-sm text-zinc-500">
          Account-level configuration.
        </p>
      </header>

      <div className="flex-1 overflow-y-auto px-8 py-6">
        <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
          {SECTIONS.map((s) => {
            const isLive = s.status === "live";
            return isLive ? (
              <Link
                key={s.title}
                href={s.href}
                className="rounded-lg border border-zinc-800 bg-zinc-900 p-5 transition hover:border-zinc-700 hover:bg-zinc-900/70"
              >
                <Card section={s} />
              </Link>
            ) : (
              <div
                key={s.title}
                className="rounded-lg border border-zinc-800 bg-zinc-950/50 p-5 opacity-60"
              >
                <Card section={s} />
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function Card({
  section,
}: {
  section: { title: string; blurb: string; status: string };
}) {
  return (
    <>
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="text-base font-semibold text-zinc-100">
          {section.title}
        </h2>
        {section.status === "soon" && (
          <span className="text-[10px] uppercase tracking-wider text-zinc-600">
            soon
          </span>
        )}
      </div>
      <p className="mt-1 text-xs text-zinc-500">{section.blurb}</p>
    </>
  );
}
