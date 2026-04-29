"use client";
import { useEffect, useState } from "react";
import ReactMarkdown from "react-markdown";
import rehypeHighlight from "rehype-highlight";
import remarkGfm from "remark-gfm";

const AGENT_URL =
  process.env.NEXT_PUBLIC_AGENT_URL || "http://localhost:8001";

export default function RoadmapPage() {
  const [content, setContent] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<string>("");
  const [saving, setSaving] = useState(false);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const r = await fetch(`${AGENT_URL}/roadmap`);
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const j = await r.json();
      setContent(j.content || "");
      setDraft(j.content || "");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function save() {
    setSaving(true);
    setError(null);
    try {
      const r = await fetch(`${AGENT_URL}/roadmap/overwrite`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: draft }),
      });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      setContent(draft);
      setEditing(false);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="flex h-full flex-col">
      <header className="flex items-center justify-between border-b border-zinc-800 bg-zinc-900 px-6 py-3">
        <div>
          <h1 className="text-sm font-semibold text-zinc-300">
            Make_Skills · Roadmap
          </h1>
          <p className="text-xs text-zinc-500">
            File-backed (ROADMAP.md) · agents update statuses as work ships ·
            you can amend at any time
          </p>
        </div>
        <nav className="flex items-center gap-3 text-xs">
          <a href="/" className="text-blue-400 hover:underline">
            ← Chat
          </a>
          <a href="/memory" className="text-blue-400 hover:underline">
            Memory
          </a>
          <a href="/dashboard" className="text-blue-400 hover:underline">
            Dashboard
          </a>
          {!editing ? (
            <button
              type="button"
              onClick={() => {
                setDraft(content);
                setEditing(true);
              }}
              className="rounded bg-zinc-800 px-3 py-1 text-xs text-zinc-300 hover:bg-zinc-700"
            >
              Edit
            </button>
          ) : (
            <>
              <button
                type="button"
                onClick={() => setEditing(false)}
                className="rounded bg-zinc-800 px-3 py-1 text-xs text-zinc-300 hover:bg-zinc-700"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={save}
                disabled={saving}
                className="rounded bg-blue-600 px-3 py-1 text-xs text-white hover:bg-blue-500 disabled:opacity-50"
              >
                {saving ? "Saving…" : "Save"}
              </button>
            </>
          )}
          <button
            type="button"
            onClick={load}
            disabled={loading}
            className="rounded bg-zinc-800 px-3 py-1 text-xs text-zinc-400 hover:bg-zinc-700 disabled:opacity-50"
            title="Reload from disk"
            aria-label="Reload roadmap from disk"
          >
            ↻
          </button>
        </nav>
      </header>

      {error && (
        <div className="border-b border-red-900 bg-red-950/40 px-6 py-2 text-sm text-red-300">
          {error}
        </div>
      )}

      <div className="flex-1 overflow-y-auto">
        {loading && (
          <div className="p-6 text-sm text-zinc-500">loading…</div>
        )}
        {!loading && editing && (
          <textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            aria-label="Edit ROADMAP.md content"
            placeholder="ROADMAP.md content (markdown)"
            className="h-full w-full resize-none bg-zinc-950 p-6 font-mono text-sm text-zinc-100 outline-none"
          />
        )}
        {!loading && !editing && (
          <article className="roadmap-md mx-auto max-w-4xl px-6 py-8 text-zinc-100">
            <ReactMarkdown
              remarkPlugins={[remarkGfm]}
              rehypePlugins={[rehypeHighlight]}
            >
              {content || "ROADMAP.md is empty."}
            </ReactMarkdown>
          </article>
        )}
      </div>
    </div>
  );
}
