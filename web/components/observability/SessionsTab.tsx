"use client";
/**
 * Observability — Sessions tab.
 *
 * List of every chat conversation. Clicking a row goes to the
 * replay-with-trace detail at /sessions/[thread_id] (unchanged).
 */
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

export function SessionsTab() {
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
    <div className="px-8 py-6">
      <p className="mb-4 max-w-3xl text-sm text-text-subtle">
        Each chat conversation is a session. Click a row to replay the full
        message trace — user input, agent reasoning, tool calls, results.
      </p>

      {error && (
        <div className="mb-4 rounded border border-invalid-edge bg-invalid-soft px-4 py-2 text-sm text-invalid">
          {error}
        </div>
      )}

      {loading && <div className="text-sm text-text-subtle">Loading…</div>}
      {!loading && sessions.length === 0 && !error && (
        <div className="text-sm text-text-subtle">
          No sessions yet. Start a chat from the home page to populate this.
        </div>
      )}
      {sessions.length > 0 && (
        <div className="overflow-hidden rounded-lg border border-zinc-800">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-zinc-800 bg-zinc-900 text-left text-xs uppercase tracking-wider text-text-subtle">
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
                      className="block font-mono text-xs text-active hover:underline"
                    >
                      {s.thread_id.length > 24
                        ? `${s.thread_id.slice(0, 24)}…`
                        : s.thread_id}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-text-muted">
                    {s.title || (
                      <span className="italic text-text-dim">untitled</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-text-subtle">
                    {s.created_at
                      ? new Date(s.created_at).toLocaleString()
                      : "—"}
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums text-text-muted">
                    {s.checkpoint_count}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
