"use client";
import Link from "next/link";
import { use, useEffect, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeHighlight from "rehype-highlight";

const AGENT_URL =
  process.env.NEXT_PUBLIC_AGENT_URL || "http://localhost:8001";

type Message = {
  type: string | null;
  content: string;
  tool_calls: unknown[];
  name: string | null;
};

type SessionDetail = {
  thread_id: string;
  title: string | null;
  created_at: string | null;
  checkpoint_count: number;
  checkpoints: { checkpoint_id: string; type: string | null; metadata: unknown }[];
  messages: Message[];
};

const ROLE_BADGE: Record<string, { label: string; color: string }> = {
  human: { label: "User", color: "bg-blue-900/40 text-blue-200" },
  ai: { label: "Agent", color: "bg-emerald-900/40 text-emerald-200" },
  tool: { label: "Tool", color: "bg-amber-900/40 text-amber-200" },
  system: { label: "System", color: "bg-zinc-800 text-zinc-300" },
};

export default function SessionDetailPage({
  params,
}: {
  params: Promise<{ thread_id: string }>;
}) {
  const { thread_id } = use(params);

  const [session, setSession] = useState<SessionDetail | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch(`${AGENT_URL}/sessions/${thread_id}`)
      .then(async (r) => {
        if (!r.ok) throw new Error(`${r.status} ${await r.text()}`);
        return r.json();
      })
      .then(setSession)
      .catch((e) => setError((e as Error).message));
  }, [thread_id]);

  if (error) {
    return (
      <div className="p-8 text-sm text-red-300">
        Error loading session: {error}
      </div>
    );
  }
  if (!session) {
    return <div className="p-8 text-sm text-zinc-500">Loading…</div>;
  }

  return (
    <div className="flex h-full flex-col">
      <header className="border-b border-zinc-800 bg-zinc-900 px-8 py-5">
        <div className="text-xs uppercase tracking-wider text-zinc-500">
          Test · session detail
        </div>
        <div className="flex items-center gap-3">
          <h1 className="text-xl font-semibold text-zinc-100">
            {session.title || "Untitled session"}
          </h1>
          <Link
            href="/sessions"
            className="text-xs text-zinc-500 hover:text-zinc-300"
          >
            ← all sessions
          </Link>
        </div>
        <div className="mt-2 flex flex-wrap items-center gap-3 text-xs text-zinc-500">
          <span>
            thread:{" "}
            <code className="rounded bg-zinc-800 px-1.5 py-0.5 text-zinc-300">
              {session.thread_id}
            </code>
          </span>
          <span>checkpoints: {session.checkpoint_count}</span>
          {session.created_at && (
            <span>started: {new Date(session.created_at).toLocaleString()}</span>
          )}
          <span>messages: {session.messages.length}</span>
        </div>
      </header>

      <main className="flex-1 overflow-y-auto px-8 py-6">
        {session.messages.length === 0 ? (
          <div className="text-sm text-zinc-500">
            No messages found in the latest checkpoint. The session may have
            been closed before any turns completed.
          </div>
        ) : (
          <div className="mx-auto max-w-3xl space-y-4">
            {session.messages.map((m, i) => {
              const role = m.type || "system";
              const badge = ROLE_BADGE[role] || ROLE_BADGE.system;
              return (
                <div
                  key={i}
                  className="rounded-lg border border-zinc-800 bg-zinc-950 p-4"
                >
                  <div className="mb-2 flex items-center gap-2">
                    <span
                      className={`rounded px-2 py-0.5 text-[11px] font-medium ${badge.color}`}
                    >
                      {badge.label}
                    </span>
                    {m.name && (
                      <span className="text-xs text-zinc-500">
                        ({m.name})
                      </span>
                    )}
                  </div>
                  <article className="prose prose-invert prose-zinc prose-sm max-w-none">
                    <ReactMarkdown
                      remarkPlugins={[remarkGfm]}
                      rehypePlugins={[rehypeHighlight]}
                    >
                      {m.content || "_(empty)_"}
                    </ReactMarkdown>
                  </article>
                  {m.tool_calls.length > 0 && (
                    <div className="mt-3 rounded bg-zinc-900 px-3 py-2 text-xs text-zinc-400">
                      <div className="font-medium text-zinc-300">
                        Tool calls ({m.tool_calls.length})
                      </div>
                      <pre className="mt-1 overflow-x-auto text-[11px]">
                        {JSON.stringify(m.tool_calls, null, 2)}
                      </pre>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}
