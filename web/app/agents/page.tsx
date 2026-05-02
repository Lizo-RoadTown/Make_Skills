"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { EvolvedAvatar } from "@/components/wizard/EvolvedAvatar";
import type { StarterSlug } from "@/components/wizard/StarterSilhouette";

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

type StoredAgent = {
  id: string;
  name: string;
  starter: StarterSlug | null;
  provider?: string;
  model?: string;
  persona?: string;
  skill?: { name: string; description: string; body: string };
  tools?: string[];
  integrations?: string[];
  savedAt: number;
};

const AGENTS_KEY = "make_skills.agents.v1";

export default function AgentsPage() {
  const [subagents, setSubagents] = useState<Subagent[]>([]);
  const [stable, setStable] = useState<StoredAgent[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`${AGENT_URL}/subagents/list`)
      .then((r) => r.json())
      .then((j) => setSubagents(j.subagents || []))
      .catch((e) => setError((e as Error).message))
      .finally(() => setLoading(false));

    try {
      const raw = window.localStorage.getItem(AGENTS_KEY);
      if (raw) setStable(JSON.parse(raw));
    } catch {}
  }, []);

  return (
    <div className="flex h-full flex-col">
      <header className="border-b border-zinc-800 bg-zinc-900 px-8 py-5">
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="text-xs uppercase tracking-wider text-zinc-500">
              Section 1 · Your stable
            </div>
            <h1 className="text-xl font-semibold text-zinc-100">Agents</h1>
            <p className="mt-1 max-w-3xl text-sm text-zinc-500">
              Your team. The agents you&apos;ve hatched live up top; the
              presets bundled with the workspace are below as examples to
              learn from or fork.
            </p>
          </div>
          <Link
            href="/agents/build"
            className="shrink-0 rounded-md bg-blue-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-blue-500"
          >
            + Hatch new
          </Link>
        </div>
      </header>

      {error && (
        <div className="mx-8 mt-4 rounded border border-red-900 bg-red-950/40 px-4 py-2 text-sm text-red-300">
          {error}
        </div>
      )}

      <div className="flex-1 overflow-y-auto px-8 py-6">
        {/* Student-built stable */}
        <section className="mb-8">
          <div className="mb-3 flex items-baseline justify-between">
            <h2 className="text-sm font-semibold uppercase tracking-wider text-zinc-400">
              Your stable
            </h2>
            <div className="text-xs text-zinc-600">
              {stable.length} hatched
            </div>
          </div>
          {stable.length === 0 ? (
            <div className="rounded-lg border border-dashed border-zinc-800 bg-zinc-950 px-6 py-10 text-center">
              <p className="text-sm text-zinc-500">
                Empty. Hatch your first agent to start your stable.
              </p>
              <Link
                href="/agents/build"
                className="mt-3 inline-block text-sm text-blue-400 hover:text-blue-300"
              >
                Build one →
              </Link>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {stable.map((a) => (
                <div
                  key={a.id}
                  className="flex flex-col gap-3 rounded-lg border border-zinc-800 bg-zinc-900 p-4"
                >
                  <div className="flex items-center gap-3">
                    <EvolvedAvatar
                      starter={a.starter}
                      skills={a.skill ? [{ name: a.skill.name }] : []}
                      size={48}
                    />
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm font-semibold text-zinc-100">
                        {a.name}
                      </div>
                      {a.provider && (
                        <div className="font-mono text-[10px] text-zinc-500">
                          {a.provider}
                          {a.model ? ` · ${a.model}` : ""}
                        </div>
                      )}
                    </div>
                  </div>
                  {a.persona && (
                    <p className="line-clamp-2 text-xs italic text-zinc-500">
                      &ldquo;{a.persona}&rdquo;
                    </p>
                  )}
                  <div className="flex flex-wrap gap-1.5">
                    {a.skill && (
                      <span className="rounded bg-blue-950 px-2 py-0.5 font-mono text-[10px] text-blue-300">
                        {a.skill.name}
                      </span>
                    )}
                    {a.tools && a.tools.length > 1 && (
                      <span className="rounded bg-zinc-800 px-2 py-0.5 text-[10px] text-zinc-400">
                        +{a.tools.length - 1} tools
                      </span>
                    )}
                    {a.integrations && a.integrations.length > 0 && (
                      <span className="rounded bg-zinc-800 px-2 py-0.5 text-[10px] text-zinc-400">
                        {a.integrations.length} integrations
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Bundled presets */}
        <section>
          <div className="mb-3 flex items-baseline justify-between">
            <h2 className="text-sm font-semibold uppercase tracking-wider text-zinc-400">
              Presets
            </h2>
            <div className="text-xs text-zinc-600">bundled examples</div>
          </div>
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
        </section>
      </div>
    </div>
  );
}
