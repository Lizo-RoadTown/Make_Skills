"use client";
import Link from "next/link";
import { use, useEffect, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeHighlight from "rehype-highlight";

const AGENT_URL =
  process.env.NEXT_PUBLIC_AGENT_URL || "http://localhost:8001";

type SubagentDetail = {
  slug: string;
  name: string;
  description: string;
  skills: string[];
  model: { provider: string | null; name: string | null };
  persona: string;
  raw_toml: string;
};

export default function AgentDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = use(params);

  const [agent, setAgent] = useState<SubagentDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<"persona" | "config">("persona");

  useEffect(() => {
    fetch(`${AGENT_URL}/subagents/${slug}`)
      .then(async (r) => {
        if (!r.ok) throw new Error(`${r.status} ${await r.text()}`);
        return r.json();
      })
      .then(setAgent)
      .catch((e) => setError((e as Error).message));
  }, [slug]);

  if (error) {
    return (
      <div className="p-8 text-sm text-red-300">
        Error loading agent: {error}
      </div>
    );
  }
  if (!agent) {
    return <div className="p-8 text-sm text-zinc-500">Loading…</div>;
  }

  return (
    <div className="flex h-full flex-col">
      <header className="border-b border-zinc-800 bg-zinc-900 px-8 py-5">
        <div className="text-xs uppercase tracking-wider text-zinc-500">
          Build · Pillar 1B
        </div>
        <div className="flex items-center gap-3">
          <h1 className="text-xl font-semibold text-zinc-100">{agent.name}</h1>
          <Link
            href="/agents"
            className="text-xs text-zinc-500 hover:text-zinc-300"
          >
            ← all agents
          </Link>
        </div>
        <p className="mt-1 max-w-3xl text-sm text-zinc-400">
          {agent.description}
        </p>
        <div className="mt-3 flex flex-wrap items-center gap-3 text-xs text-zinc-500">
          <span>
            <code className="rounded bg-zinc-800 px-1.5 py-0.5 text-zinc-300">
              subagents/{agent.slug}/
            </code>
          </span>
          {agent.model.name && (
            <span>
              model: <code className="text-zinc-300">{agent.model.provider}/{agent.model.name}</code>
            </span>
          )}
          {agent.skills.length > 0 && (
            <span>
              skills:{" "}
              {agent.skills.map((s, i) => (
                <span key={s}>
                  <code className="text-zinc-300">{s.split("/").pop() || s}</code>
                  {i < agent.skills.length - 1 && ", "}
                </span>
              ))}
            </span>
          )}
        </div>
      </header>

      <div className="border-b border-zinc-800 px-8">
        <div className="flex gap-1">
          {(["persona", "config"] as const).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setTab(t)}
              className={`px-3 py-2 text-sm transition ${
                tab === t
                  ? "border-b-2 border-blue-500 text-zinc-100"
                  : "text-zinc-500 hover:text-zinc-300"
              }`}
            >
              {t === "persona" ? "Persona (AGENTS.md)" : "Config (deepagents.toml)"}
            </button>
          ))}
        </div>
      </div>

      <main className="flex-1 overflow-y-auto px-8 py-6">
        {tab === "persona" && (
          <article className="prose prose-invert prose-zinc max-w-3xl">
            <ReactMarkdown
              remarkPlugins={[remarkGfm]}
              rehypePlugins={[rehypeHighlight]}
            >
              {agent.persona}
            </ReactMarkdown>
          </article>
        )}
        {tab === "config" && (
          <pre className="max-w-3xl rounded border border-zinc-800 bg-zinc-950 px-4 py-3 text-xs text-zinc-300">
            <code>{agent.raw_toml}</code>
          </pre>
        )}
      </main>
    </div>
  );
}
