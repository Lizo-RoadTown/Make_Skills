"use client";
import Link from "next/link";
import { useEffect, useState } from "react";

const AGENT_URL =
  process.env.NEXT_PUBLIC_AGENT_URL || "http://localhost:8001";

type Subagent = {
  slug: string;
  name: string;
  description: string;
  skills: string[];
  model: { provider: string | null; name: string | null };
  persona_excerpt: string;
};

export default function AgentsPage() {
  const [subagents, setSubagents] = useState<Subagent[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`${AGENT_URL}/subagents/list`)
      .then((r) => r.json())
      .then((j) => setSubagents(j.subagents || []))
      .catch((e) => setError((e as Error).message))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="flex h-full flex-col">
      <header className="border-b border-zinc-800 bg-zinc-900 px-8 py-5">
        <div className="text-xs uppercase tracking-wider text-zinc-500">
          Build · Pillar 1B
        </div>
        <h1 className="text-xl font-semibold text-zinc-100">Agents</h1>
        <p className="mt-1 max-w-3xl text-sm text-zinc-500">
          Specialist subagents the orchestrator delegates to. Each runs its
          own persona, model, and scoped skill list. Configurations live in
          <code className="mx-1 rounded bg-zinc-800 px-1.5 py-0.5 text-xs text-zinc-300">
            subagents/&lt;slug&gt;/
          </code>
          on the filesystem — edit the AGENTS.md and deepagents.toml in your
          IDE for now; in-dashboard editing arrives with Pillar 1B v2.
        </p>
      </header>

      {error && (
        <div className="mx-8 mt-4 rounded border border-red-900 bg-red-950/40 px-4 py-2 text-sm text-red-300">
          {error}
        </div>
      )}

      <div className="flex-1 overflow-y-auto px-8 py-6">
        {loading && <div className="text-sm text-zinc-500">Loading…</div>}
        {!loading && subagents.length === 0 && !error && (
          <div className="text-sm text-zinc-500">
            No subagents found in <code>subagents/</code>.
          </div>
        )}
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          {subagents.map((sub) => (
            <Link
              key={sub.slug}
              href={`/agents/${sub.slug}`}
              className="block rounded-lg border border-zinc-800 bg-zinc-900 p-5 transition hover:border-zinc-700 hover:bg-zinc-900/70"
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="text-base font-semibold text-zinc-100">
                    {sub.name}
                  </div>
                  <div className="mt-0.5 text-xs text-zinc-500">
                    <code>subagents/{sub.slug}/</code>
                  </div>
                </div>
                {sub.model.name && (
                  <span className="shrink-0 rounded border border-zinc-800 bg-zinc-950 px-2 py-0.5 text-xs text-zinc-400">
                    {sub.model.provider}/{sub.model.name}
                  </span>
                )}
              </div>
              <p className="mt-3 line-clamp-3 text-sm text-zinc-300">
                {sub.description}
              </p>
              {sub.persona_excerpt && (
                <p className="mt-3 line-clamp-2 text-xs italic text-zinc-500">
                  {sub.persona_excerpt}
                </p>
              )}
              {sub.skills.length > 0 && (
                <div className="mt-4 flex flex-wrap gap-1.5">
                  {sub.skills.map((s) => (
                    <span
                      key={s}
                      className="rounded bg-zinc-800 px-2 py-0.5 text-[11px] text-zinc-400"
                    >
                      {s.split("/").pop() || s}
                    </span>
                  ))}
                </div>
              )}
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
