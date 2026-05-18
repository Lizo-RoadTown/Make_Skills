"use client";
/**
 * Observability — Memory tab.
 *
 * Semantic search + browse over the agent's LanceDB memory store.
 * Same body as the old /memory page minus the outer page header.
 */
import { useEffect, useState } from "react";

const AGENT_URL =
  process.env.NEXT_PUBLIC_AGENT_URL || "http://localhost:8001";

type MemoryRecord = {
  id: string;
  type: string;
  content: string;
  project_tags: string[];
  source_thread_id: string;
  ts: number;
  why: string;
};

const TYPES = [
  "decision",
  "lesson",
  "preference",
  "skill_idea",
  "topic",
  "fact",
] as const;

const TYPE_COLORS: Record<string, string> = {
  decision: "bg-blue-900/40 text-blue-300 border-blue-800",
  lesson: "bg-emerald-900/40 text-emerald-300 border-emerald-800",
  preference: "bg-purple-900/40 text-purple-300 border-purple-800",
  skill_idea: "bg-amber-900/40 text-amber-300 border-amber-800",
  topic: "bg-zinc-800 text-zinc-300 border-zinc-700",
  fact: "bg-pink-900/40 text-pink-300 border-pink-800",
};

export function MemoryTab() {
  const [query, setQuery] = useState("");
  const [activeQuery, setActiveQuery] = useState("");
  const [records, setRecords] = useState<MemoryRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [filterType, setFilterType] = useState<string>("");
  const [filterTag, setFilterTag] = useState<string>("");
  const [total, setTotal] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function fetchTotal() {
    try {
      const r = await fetch(`${AGENT_URL}/memory/stats`);
      if (r.ok) {
        const j = await r.json();
        setTotal(j.total);
      }
    } catch {
      /* swallow */
    }
  }

  async function loadList() {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      params.set("limit", "100");
      if (filterType) params.set("record_type", filterType);
      if (filterTag) params.set("project_tag", filterTag);
      const r = await fetch(`${AGENT_URL}/memory/records?${params.toString()}`);
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const j = await r.json();
      setRecords(j.results || []);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }

  async function runSearch(q: string) {
    setLoading(true);
    setError(null);
    setActiveQuery(q);
    try {
      const r = await fetch(`${AGENT_URL}/memory/search`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          query: q,
          limit: 25,
          record_type: filterType || null,
          project_tag: filterTag || null,
        }),
      });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const j = await r.json();
      setRecords(j.results || []);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchTotal();
    loadList();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (activeQuery) {
      runSearch(activeQuery);
    } else {
      loadList();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filterType, filterTag]);

  return (
    <div>
      <div className="border-b border-zinc-800 bg-zinc-900 px-6 py-4">
        <div className="mb-3 text-xs text-text-subtle">
          {total !== null ? `${total} records` : "loading…"} ·
          semantic memory across sessions
        </div>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (query.trim()) runSearch(query.trim());
            else {
              setActiveQuery("");
              loadList();
            }
          }}
          className="flex gap-2"
        >
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search memory semantically — e.g. 'how did we deploy to vercel'"
            className="flex-1 rounded-xl bg-zinc-800 px-4 py-2 text-text placeholder-text-dim outline-none focus:ring-2 focus:ring-active"
          />
          <button
            type="submit"
            disabled={loading}
            className="rounded-xl bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-500 disabled:opacity-50"
          >
            Search
          </button>
          {activeQuery && (
            <button
              type="button"
              onClick={() => {
                setQuery("");
                setActiveQuery("");
                loadList();
              }}
              className="rounded-xl bg-zinc-800 px-4 py-2 text-sm text-text-muted hover:bg-zinc-700"
            >
              Clear
            </button>
          )}
        </form>
        <div className="mt-3 flex flex-wrap gap-2 text-xs">
          <select
            value={filterType}
            onChange={(e) => setFilterType(e.target.value)}
            aria-label="Filter records by type"
            title="Filter records by type"
            className="rounded bg-zinc-800 px-2 py-1 text-text-muted"
          >
            <option value="">all types</option>
            {TYPES.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
          <input
            type="text"
            value={filterTag}
            onChange={(e) => setFilterTag(e.target.value)}
            placeholder="filter by project_tag (e.g. agents)"
            className="rounded bg-zinc-800 px-2 py-1 text-text-muted placeholder-text-dim"
          />
        </div>
      </div>

      <div className="px-6 py-4">
        {error && (
          <div className="mb-4 rounded border border-invalid-edge bg-invalid-soft px-4 py-2 text-sm text-invalid">
            {error}
          </div>
        )}
        {loading && <div className="text-sm text-text-subtle">loading…</div>}
        {!loading && records.length === 0 && (
          <div className="mt-12 text-center text-sm text-text-subtle">
            {activeQuery
              ? `No records match "${activeQuery}".`
              : "No records yet. Have a chat — they'll appear here as the recorder extracts decisions, lessons, and topics."}
          </div>
        )}
        <div className="mx-auto flex max-w-4xl flex-col gap-3">
          {records.map((r) => (
            <article
              key={r.id}
              className="rounded-xl border border-zinc-800 bg-zinc-900 px-4 py-3"
            >
              <div className="mb-2 flex items-center gap-2 text-xs">
                <span
                  className={`rounded border px-2 py-0.5 font-mono ${
                    TYPE_COLORS[r.type] || TYPE_COLORS.topic
                  }`}
                >
                  {r.type}
                </span>
                {r.project_tags?.map((t) => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => setFilterTag(t)}
                    className="rounded border border-zinc-700 bg-zinc-800 px-2 py-0.5 text-text-muted hover:bg-zinc-700"
                  >
                    {t}
                  </button>
                ))}
                <span className="ml-auto text-text-dim">
                  {new Date(r.ts * 1000).toLocaleString()}
                </span>
              </div>
              <p className="text-sm text-text">{r.content}</p>
              {r.why && (
                <p className="mt-1 text-xs italic text-text-subtle">
                  why: {r.why}
                </p>
              )}
            </article>
          ))}
        </div>
      </div>
    </div>
  );
}
