"use client";
import { useEffect, useState } from "react";

const AGENT_URL =
  process.env.NEXT_PUBLIC_AGENT_URL || "http://localhost:8001";

type Record = {
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

export default function MemoryPage() {
  const [query, setQuery] = useState("");
  const [activeQuery, setActiveQuery] = useState("");
  const [records, setRecords] = useState<Record[]>([]);
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
    <div className="flex h-full flex-col">
      <header className="flex items-center justify-between border-b border-zinc-800 bg-zinc-900 px-6 py-3">
        <div>
          <h1 className="text-sm font-semibold text-zinc-300">
            Make_Skills · Memory
          </h1>
          <p className="text-xs text-zinc-500">
            {total !== null ? `${total} records` : "loading…"} ·
            agentic semantic memory across sessions
          </p>
        </div>
        <div className="flex items-center gap-3 text-xs">
          <a href="/" className="text-blue-400 hover:underline">
            ← Chat
          </a>
          <a href="/dashboard" className="text-blue-400 hover:underline">
            Dashboard →
          </a>
        </div>
      </header>

      <div className="border-b border-zinc-800 bg-zinc-900 px-6 py-4">
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
            className="flex-1 rounded-xl bg-zinc-800 px-4 py-2 text-zinc-100 placeholder-zinc-500 outline-none focus:ring-2 focus:ring-blue-500"
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
              className="rounded-xl bg-zinc-800 px-4 py-2 text-sm text-zinc-300 hover:bg-zinc-700"
            >
              Clear
            </button>
          )}
        </form>
        <div className="mt-3 flex flex-wrap gap-2 text-xs">
          <select
            value={filterType}
            onChange={(e) => setFilterType(e.target.value)}
            className="rounded bg-zinc-800 px-2 py-1 text-zinc-300"
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
            className="rounded bg-zinc-800 px-2 py-1 text-zinc-300 placeholder-zinc-500"
          />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-6 py-4">
        {error && (
          <div className="mb-4 rounded bg-red-950/50 border border-red-900 px-4 py-2 text-sm text-red-300">
            {error}
          </div>
        )}
        {loading && (
          <div className="text-sm text-zinc-500">loading…</div>
        )}
        {!loading && records.length === 0 && (
          <div className="mt-12 text-center text-sm text-zinc-500">
            {activeQuery
              ? `No records match "${activeQuery}".`
              : "No records yet. Have a chat — they'll start appearing here as the recorder extracts decisions, lessons, and topics."}
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
                    onClick={() => setFilterTag(t)}
                    className="rounded border border-zinc-700 bg-zinc-800 px-2 py-0.5 text-zinc-400 hover:bg-zinc-700"
                  >
                    {t}
                  </button>
                ))}
                <span className="ml-auto text-zinc-600">
                  {new Date(r.ts * 1000).toLocaleString()}
                </span>
              </div>
              <p className="text-sm text-zinc-100">{r.content}</p>
              {r.why && (
                <p className="mt-1 text-xs italic text-zinc-500">
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
