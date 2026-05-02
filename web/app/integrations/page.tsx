"use client";
import { useEffect, useState } from "react";

const AGENT_URL =
  process.env.NEXT_PUBLIC_AGENT_URL || "http://localhost:8001";

type Configured = {
  name: string;
  kind: string;
  url: string | null;
  command: string | null;
  args: string[] | null;
  env_vars: string[];
  description: string;
  category: string;
};

type Recommended = {
  name: string;
  category: string;
  description: string;
  install_hint: string;
  env_vars: string[];
};

const CATEGORY_LABELS: Record<string, string> = {
  docs: "Documentation",
  git: "Source control",
  deploy: "Deploy + hosting",
  test: "Testing",
  db: "Database",
  ml: "Machine learning",
  other: "Other",
};

const CATEGORY_ORDER = ["git", "deploy", "docs", "test", "db", "ml", "other"];

export default function IntegrationsPage() {
  const [configured, setConfigured] = useState<Configured[]>([]);
  const [recommended, setRecommended] = useState<Recommended[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`${AGENT_URL}/mcp/list`)
      .then(async (r) => {
        if (!r.ok) throw new Error(`${r.status} ${await r.text()}`);
        return r.json();
      })
      .then((j) => {
        setConfigured(j.configured || []);
        setRecommended(j.recommended || []);
      })
      .catch((e) => setError((e as Error).message))
      .finally(() => setLoading(false));
  }, []);

  // Group by category
  const grouped = configured.reduce<Record<string, Configured[]>>(
    (acc, s) => {
      (acc[s.category] = acc[s.category] || []).push(s);
      return acc;
    },
    {},
  );

  return (
    <div className="flex h-full flex-col">
      <header className="border-b border-zinc-800 bg-zinc-900 px-8 py-5">
        <div className="text-xs uppercase tracking-wider text-zinc-500">
          Manage · MCP servers + connections
        </div>
        <h1 className="text-xl font-semibold text-zinc-100">Integrations</h1>
        <p className="mt-1 max-w-3xl text-sm text-zinc-500">
          MCP servers the agent has access to, plus recommended additions.
          Configuration lives in
          <code className="mx-1 rounded bg-zinc-800 px-1.5 py-0.5 text-xs text-zinc-300">
            .mcp.json
          </code>
          at the repo root — edit there for now, in-dashboard wiring is a
          future phase.
        </p>
      </header>

      {error && (
        <div className="mx-8 mt-4 rounded border border-red-900 bg-red-950/40 px-4 py-2 text-sm text-red-300">
          {error}
        </div>
      )}

      <div className="flex-1 overflow-y-auto px-8 py-6">
        {loading && <div className="text-sm text-zinc-500">Loading…</div>}

        {/* Configured servers */}
        {!loading && (
          <section className="mb-10">
            <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-zinc-400">
              Configured ({configured.length})
            </h2>
            {configured.length === 0 ? (
              <div className="rounded border border-zinc-800 bg-zinc-900 px-4 py-3 text-sm text-zinc-500">
                No MCP servers wired yet. See the recommended list below.
              </div>
            ) : (
              <div className="space-y-6">
                {CATEGORY_ORDER.filter((c) => grouped[c]?.length).map((cat) => (
                  <div key={cat}>
                    <h3 className="mb-2 text-xs font-medium uppercase tracking-wider text-zinc-500">
                      {CATEGORY_LABELS[cat] || cat}
                    </h3>
                    <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
                      {grouped[cat].map((s) => (
                        <ConfiguredCard key={s.name} server={s} />
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
        )}

        {/* Recommended */}
        {!loading && recommended.length > 0 && (
          <section>
            <h2 className="mb-1 text-sm font-semibold uppercase tracking-wider text-zinc-400">
              Recommended ({recommended.length})
            </h2>
            <p className="mb-3 text-xs text-zinc-500">
              MCP servers that aren&apos;t wired yet. Each has been used in this
              project&apos;s journey or shows up in adjacent project setups.
            </p>
            <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
              {recommended.map((r) => (
                <RecommendedCard key={r.name} server={r} />
              ))}
            </div>
          </section>
        )}
      </div>
    </div>
  );
}

function ConfiguredCard({ server }: { server: Configured }) {
  return (
    <div className="rounded-lg border border-zinc-800 bg-zinc-900 p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-base font-semibold text-zinc-100">
              {server.name}
            </span>
            <span className="rounded bg-emerald-900/40 px-1.5 py-0.5 text-[10px] uppercase tracking-wider text-emerald-200">
              wired
            </span>
          </div>
        </div>
        <span className="shrink-0 rounded border border-zinc-800 bg-zinc-950 px-2 py-0.5 text-xs text-zinc-400">
          {server.kind}
        </span>
      </div>
      {server.description && (
        <p className="mt-2 text-sm text-zinc-300">{server.description}</p>
      )}
      <div className="mt-3 space-y-1 text-xs text-zinc-500">
        {server.url && (
          <div>
            url: <code className="text-zinc-400">{server.url}</code>
          </div>
        )}
        {server.command && (
          <div>
            command: <code className="text-zinc-400">{server.command}</code>{" "}
            {server.args?.join(" ")}
          </div>
        )}
        {server.env_vars.length > 0 && (
          <div>
            env: {server.env_vars.map((e) => (
              <code key={e} className="mr-1 rounded bg-zinc-800 px-1 text-zinc-300">
                {e}
              </code>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function RecommendedCard({ server }: { server: Recommended }) {
  return (
    <div className="rounded-lg border border-zinc-800 bg-zinc-900/60 p-4">
      <div className="flex items-start justify-between gap-3">
        <span className="text-base font-semibold text-zinc-200">
          {server.name}
        </span>
        <span className="shrink-0 rounded border border-zinc-800 bg-zinc-950 px-2 py-0.5 text-xs text-zinc-500">
          {CATEGORY_LABELS[server.category] || server.category}
        </span>
      </div>
      {server.description && (
        <p className="mt-2 text-sm text-zinc-400">{server.description}</p>
      )}
      <details className="mt-3 text-xs text-zinc-500">
        <summary className="cursor-pointer text-zinc-400 hover:text-zinc-200">
          Install hint
        </summary>
        <pre className="mt-2 overflow-x-auto rounded bg-zinc-950 p-2 text-[11px]">
          {server.install_hint}
        </pre>
        {server.env_vars.length > 0 && (
          <p className="mt-2">
            env vars needed:{" "}
            {server.env_vars.map((e) => (
              <code key={e} className="mr-1 rounded bg-zinc-800 px-1 text-zinc-300">
                {e}
              </code>
            ))}
          </p>
        )}
      </details>
    </div>
  );
}
