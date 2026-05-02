"use client";
import Link from "next/link";
import { useEffect, useState } from "react";

const AGENT_URL =
  process.env.NEXT_PUBLIC_AGENT_URL || "http://localhost:8001";

type Session = {
  thread_id: string;
  title: string | null;
  created_at: string | null;
  checkpoint_count: number;
  last_checkpoint_id: string | null;
};

export default function SessionsPage() {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`${AGENT_URL}/sessions/list`)
      .then(async (r) => {
        if (!r.ok) throw new Error(`${r.status} ${await r.text()}`);
        return r.json();
      })
      .then((j) => setSessions(j.sessions || []))
      .catch((e) => setError((e as Error).message))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="flex h-full flex-col">
      <header className="border-b border-zinc-800 bg-zinc-900 px-8 py-5">
        <div className="text-xs uppercase tracking-wider text-zinc-500">
          Test · replay-with-trace
        </div>
        <h1 className="text-xl font-semibold text-zinc-100">Sessions</h1>
        <p className="mt-1 max-w-3xl text-sm text-zinc-500">
          Each chat conversation is a session. Click a row to replay the full
          message trace — user input, agent reasoning, tool calls, results.
          Use this to understand what the agent did when something went
          unexpectedly.
        </p>
      </header>

      {error && (
        <div className="mx-8 mt-4 rounded border border-red-900 bg-red-950/40 px-4 py-2 text-sm text-red-300">
          {error}
        </div>
      )}

      <div className="flex-1 overflow-y-auto px-8 py-6">
        {loading && <div className="text-sm text-zinc-500">Loading…</div>}
        {!loading && sessions.length === 0 && !error && (
          <div className="text-sm text-zinc-500">
            No sessions yet. Start a chat from the Build → Chat page or run a
            skill from Build → Skills to populate this list.
          </div>
        )}
        <div className="overflow-hidden rounded-lg border border-zinc-800">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-zinc-800 bg-zinc-900 text-left text-xs uppercase tracking-wider text-zinc-500">
                <th className="px-4 py-2.5 font-medium">Thread</th>
                <th className="px-4 py-2.5 font-medium">Title</th>
                <th className="px-4 py-2.5 font-medium">Started</th>
                <th className="px-4 py-2.5 text-right font-medium">
                  Checkpoints
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800 bg-zinc-950">
              {sessions.map((s) => (
                <tr
                  key={s.thread_id}
                  className="cursor-pointer transition hover:bg-zinc-900"
                >
                  <td className="px-4 py-3">
                    <Link
                      href={`/sessions/${s.thread_id}`}
                      className="block font-mono text-xs text-blue-400 hover:underline"
                    >
                      {s.thread_id.length > 24
                        ? `${s.thread_id.slice(0, 24)}…`
                        : s.thread_id}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-zinc-300">
                    {s.title || (
                      <span className="text-zinc-600 italic">untitled</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-zinc-500">
                    {s.created_at
                      ? new Date(s.created_at).toLocaleString()
                      : "—"}
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums text-zinc-400">
                    {s.checkpoint_count}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
