"use client";
import Link from "next/link";

/**
 * Public landing page for unauthenticated visitors. Shows what
 * Make_Skills is in plain language plus a sign-in CTA. Authenticated
 * users see the Chat surface instead (page.tsx switches based on
 * useSession status).
 */
export function Landing() {
  return (
    <div className="flex min-h-full items-center justify-center bg-zinc-950 px-6 py-16">
      <div className="w-full max-w-3xl">
        <header className="text-center">
          <p className="text-sm uppercase tracking-[0.2em] text-zinc-500">
            humancensys.com
          </p>
          <h1 className="mt-3 text-4xl font-semibold tracking-tight text-zinc-100 sm:text-5xl">
            Make_Skills
          </h1>
          <p className="mx-auto mt-4 max-w-2xl text-base text-zinc-400">
            An academic agentic-AI multiplayer world-building tool. Students
            build their own AI in early university and carry it through their
            studies, taking it on real-world quests, and contributing to
            online neural-network building with their classmates.
          </p>
        </header>

        <div className="mt-10 flex flex-col items-center gap-3">
          <Link
            href="/auth/signin"
            className="rounded-md bg-blue-600 px-6 py-3 text-base font-medium text-white transition hover:bg-blue-500"
          >
            Sign in
          </Link>
          <p className="text-xs text-zinc-500">
            Sign in with GitHub or Google.
          </p>
        </div>

        <div className="mt-16 grid grid-cols-1 gap-4 sm:grid-cols-3">
          <Card
            title="Build agents"
            body="Configure a clan of specialist subagents — researcher, planner, builder, custom. Each picks its own model and skill set."
          />
          <Card
            title="Make skills together"
            body="Skills are markdown wisdom your agents read. Some graduate into hard-coded tools as you use them more."
          />
          <Card
            title="Observe everything"
            body="Token cost, latency, agent activity, semantic memory — all surfaced in the dashboard, not buried in logs."
          />
        </div>

        <footer className="mt-16 flex justify-center gap-4 text-xs text-zinc-600">
          <a
            href="https://github.com/Lizo-RoadTown/Make_Skills"
            target="_blank"
            rel="noopener noreferrer"
            className="hover:text-zinc-400"
          >
            GitHub →
          </a>
          <span>·</span>
          <span>Apache 2.0</span>
          <span>·</span>
          <Link href="/docs" className="hover:text-zinc-400">
            Docs
          </Link>
        </footer>
      </div>
    </div>
  );
}

function Card({ title, body }: { title: string; body: string }) {
  return (
    <div className="rounded-lg border border-zinc-800 bg-zinc-900 p-5">
      <div className="text-sm font-semibold text-zinc-100">{title}</div>
      <p className="mt-2 text-xs leading-relaxed text-zinc-400">{body}</p>
    </div>
  );
}
