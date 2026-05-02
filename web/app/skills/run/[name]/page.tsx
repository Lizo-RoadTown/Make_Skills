"use client";
import Link from "next/link";
import { use, useEffect, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeHighlight from "rehype-highlight";

const AGENT_URL =
  process.env.NEXT_PUBLIC_AGENT_URL || "http://localhost:8001";

type Skill = {
  name: string;
  description: string;
  path: string;
};

type Result = {
  thread_id: string;
  response: string;
  skill: string;
};

export default function SkillRunPage({
  params,
}: {
  params: Promise<{ name: string }>;
}) {
  const { name } = use(params);

  const [skill, setSkill] = useState<Skill | null>(null);
  const [body, setBody] = useState<string>("");
  const [showBody, setShowBody] = useState(false);

  const [userInput, setUserInput] = useState("");
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<Result | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Load skill metadata + body for the side panel.
  useEffect(() => {
    fetch(`${AGENT_URL}/skills/list`)
      .then((r) => r.json())
      .then((j) => {
        const found = (j.skills || []).find(
          (s: Skill) => s.name === name || s.path.startsWith(`${name}/`),
        );
        if (found) setSkill(found);
      });
    fetch(`${AGENT_URL}/skills/file?path=${encodeURIComponent(`${name}/SKILL.md`)}`)
      .then((r) => r.json())
      .then((j) => setBody(j.content || ""))
      .catch(() => {});
  }, [name]);

  async function run() {
    if (!userInput.trim()) return;
    setRunning(true);
    setError(null);
    setResult(null);
    try {
      const res = await fetch(`${AGENT_URL}/skills/run`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          skill_name: name,
          user_input: userInput,
        }),
      });
      if (!res.ok) {
        const errBody = await res.text();
        throw new Error(`${res.status} ${errBody}`);
      }
      const data: Result = await res.json();
      setResult(data);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setRunning(false);
    }
  }

  return (
    <div className="flex h-full flex-col">
      <header className="border-b border-zinc-800 bg-zinc-900 px-8 py-5">
        <div className="text-xs uppercase tracking-wider text-zinc-500">
          Skills · Run
        </div>
        <div className="flex items-center gap-3">
          <h1 className="text-xl font-semibold text-zinc-100">
            {skill?.name || name}
          </h1>
          <Link
            href="/skills"
            className="text-xs text-zinc-500 hover:text-zinc-300"
          >
            ← back to library
          </Link>
        </div>
        {skill?.description && (
          <p className="mt-1 max-w-3xl text-sm text-zinc-400">
            {skill.description}
          </p>
        )}
      </header>

      <div className="flex flex-1 min-h-0">
        {/* Form pane */}
        <section className="flex w-full max-w-2xl flex-col border-r border-zinc-800 bg-zinc-950 px-6 py-6">
          <label
            htmlFor="user-input"
            className="text-sm font-medium text-zinc-200"
          >
            Apply this skill to:
          </label>
          <p className="mt-1 text-xs text-zinc-500">
            Describe the topic, the question, or the artifact you want the
            agent to produce. The skill's PROBE / DECIDE / ACT / REPORT
            structure runs against your input.
          </p>
          <textarea
            id="user-input"
            value={userInput}
            onChange={(e) => setUserInput(e.target.value)}
            placeholder={
              "e.g. 'Write a proposal for adding a `tenant_secrets` table for storing per-tenant API keys'"
            }
            className="mt-3 min-h-[160px] flex-1 rounded border border-zinc-800 bg-zinc-900 px-3 py-2 font-mono text-sm text-zinc-100 placeholder-zinc-600 focus:border-zinc-600 focus:outline-none"
          />

          <div className="mt-4 flex items-center gap-3">
            <button
              type="button"
              onClick={run}
              disabled={running || !userInput.trim()}
              className="rounded bg-blue-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-blue-500 disabled:cursor-not-allowed disabled:bg-zinc-800 disabled:text-zinc-500"
            >
              {running ? "Running…" : "Run skill"}
            </button>
            <button
              type="button"
              onClick={() => setShowBody((v) => !v)}
              className="text-xs text-zinc-500 hover:text-zinc-300"
            >
              {showBody ? "Hide" : "Show"} skill body
            </button>
          </div>

          {showBody && body && (
            <article className="prose prose-invert prose-zinc mt-6 max-w-none overflow-y-auto rounded border border-zinc-800 bg-zinc-900 px-4 py-3 text-xs">
              <ReactMarkdown remarkPlugins={[remarkGfm]}>{body}</ReactMarkdown>
            </article>
          )}
        </section>

        {/* Result pane */}
        <main className="flex-1 min-w-0 overflow-y-auto px-8 py-6">
          {error && (
            <div className="rounded border border-red-900 bg-red-950/40 px-4 py-2 text-sm text-red-300">
              {error}
            </div>
          )}
          {!result && !error && !running && (
            <div className="text-sm text-zinc-500">
              The agent's response appears here once you click Run skill.
            </div>
          )}
          {running && (
            <div className="text-sm text-zinc-500">
              Agent is working — typically 10-60 seconds depending on the
              skill. The agent's tools (recall, query_db, file writes) run
              in this window.
            </div>
          )}
          {result && (
            <article className="prose prose-invert prose-zinc max-w-3xl">
              <div className="not-prose mb-4 flex items-center gap-2 text-xs text-zinc-500">
                <span>Thread:</span>
                <code className="rounded bg-zinc-800 px-1.5 py-0.5 text-zinc-300">
                  {result.thread_id.slice(0, 8)}…
                </code>
              </div>
              <ReactMarkdown
                remarkPlugins={[remarkGfm]}
                rehypePlugins={[rehypeHighlight]}
              >
                {result.response}
              </ReactMarkdown>
            </article>
          )}
        </main>
      </div>
    </div>
  );
}
