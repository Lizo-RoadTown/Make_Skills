"use client";
import Image from "next/image";
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

type StableAgent = {
  id: string;
  name: string;
  starter: StarterSlug | null;
  provider: string;
  model: string | null;
  persona: string | null;
  created_at: string | null;
  updated_at: string | null;
  skill_count: number;
  integration_count: number;
};

export default function AgentsPage() {
  const [subagents, setSubagents] = useState<Subagent[]>([]);
  const [stable, setStable] = useState<StableAgent[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Preset subagents (file-baked) + the student's stable (DB).
    Promise.all([
      fetch(`${AGENT_URL}/subagents/list`)
        .then((r) => r.json())
        .then((j) => setSubagents(j.subagents || []))
        .catch((e) => setError((e as Error).message)),
      fetch(`${AGENT_URL}/agents/list`)
        .then((r) => (r.ok ? r.json() : { agents: [] }))
        .then((j) => setStable(j.agents || []))
        .catch(() => {
          // Backend not reachable — leave stable empty; don't break the page.
        }),
    ]).finally(() => setLoading(false));
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
            <div className="relative overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-950">
              <div className="relative aspect-[16/7] w-full">
                <Image
                  src="/illustrations/agents-hero.jpg"
                  alt="Four crystalline geometric forms — sphere, cube, faceted star, and luminous lattice — suspended in glowing formation against a dark background"
                  fill
                  className="object-cover"
                  sizes="(min-width: 1024px) 64rem, 100vw"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-zinc-950 via-zinc-950/40 to-transparent" />
              </div>
              <div className="relative -mt-12 flex flex-col items-center gap-4 px-6 pb-10 text-center">
                <h3 className="text-xl font-semibold text-zinc-100 sm:text-2xl">
                  Your stable is empty
                </h3>
                <p className="max-w-md text-sm text-zinc-400">
                  Hatch your first agent — name it, pick a brain, write its
                  idea, give it a skill. About five minutes.
                </p>
                <Link
                  href="/agents/build"
                  className="mt-2 rounded-md bg-blue-600 px-6 py-2.5 text-sm font-medium text-white shadow-lg shadow-blue-900/40 transition hover:bg-blue-500"
                >
                  Hatch your first →
                </Link>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {stable.map((a) => (
                <Link
                  key={a.id}
                  href={`/chat/${a.id}`}
                  className="flex flex-col gap-3 rounded-lg border border-zinc-800 bg-zinc-900 p-4 transition hover:border-zinc-600 hover:bg-zinc-900/70"
                >
                  <div className="flex items-center gap-3">
                    <EvolvedAvatar
                      starter={a.starter}
                      skills={
                        a.skill_count > 0
                          ? Array.from({ length: a.skill_count }, (_, i) => ({
                              name: `${a.id}-skill-${i}`,
                            }))
                          : []
                      }
                      size={48}
                    />
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm font-semibold text-zinc-100">
                        {a.name}
                      </div>
                      <div className="font-mono text-[10px] text-zinc-500">
                        {a.provider}
                        {a.model ? ` · ${a.model}` : ""}
                      </div>
                    </div>
                  </div>
                  {a.persona && (
                    <p className="line-clamp-2 text-xs italic text-zinc-500">
                      &ldquo;{a.persona}&rdquo;
                    </p>
                  )}
                  <div className="flex flex-wrap gap-1.5">
                    {a.skill_count > 0 && (
                      <span className="rounded bg-blue-950 px-2 py-0.5 text-[10px] text-blue-300">
                        {a.skill_count} skill{a.skill_count === 1 ? "" : "s"}
                      </span>
                    )}
                    {a.integration_count > 0 && (
                      <span className="rounded bg-zinc-800 px-2 py-0.5 text-[10px] text-zinc-400">
                        {a.integration_count} integration
                        {a.integration_count === 1 ? "" : "s"}
                      </span>
                    )}
                    <span className="ml-auto text-[10px] uppercase tracking-wider text-zinc-600">
                      chat →
                    </span>
                  </div>
                </Link>
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
