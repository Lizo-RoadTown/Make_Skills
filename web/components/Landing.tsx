"use client";
import Image from "next/image";
import Link from "next/link";

/**
 * Public landing page for unauthenticated visitors.
 *
 * Uses `fixed inset-0 z-50` to cover the sidebar entirely — visitors
 * who haven't signed in have no business seeing the authenticated nav,
 * and the hero gets the full viewport for a proper marketing-style
 * first impression. Once signed in, page.tsx swaps in Chat which
 * renders normally next to the sidebar.
 */
export function Landing() {
  return (
    <div
      className="fixed inset-0 z-50 flex flex-col overflow-y-auto bg-zinc-950 text-zinc-100"
      role="region"
      aria-label="Make_Skills landing"
    >
      {/* Hero — image fills the viewport, text overlaid with gradient mask */}
      <section className="relative flex min-h-[100svh] w-full flex-col justify-center overflow-hidden">
        {/* Background image */}
        <Image
          src="/illustrations/agents-hero.jpg"
          alt="Four translucent crystalline geometric forms — a glowing sphere, a faceted cube, a multi-pointed star, and a luminous lattice — suspended in formation against a deep navy background with cyan and violet light traces"
          fill
          priority
          quality={90}
          sizes="100vw"
          className="object-cover"
        />

        {/* Dark gradient mask — readable text over the image */}
        <div className="absolute inset-0 bg-gradient-to-r from-zinc-950/95 via-zinc-950/60 to-zinc-950/10" />
        <div className="absolute inset-0 bg-gradient-to-t from-zinc-950 via-transparent to-zinc-950/30" />

        {/* Text overlay */}
        <div className="relative z-10 px-6 py-16 sm:px-12 lg:px-20">
          <div className="max-w-2xl">
            <p className="text-xs uppercase tracking-[0.25em] text-zinc-400 sm:text-sm">
              humancensys.com
            </p>
            <h1 className="mt-4 text-5xl font-semibold tracking-tight text-zinc-50 sm:text-6xl lg:text-7xl">
              Make_Skills
            </h1>
            <p className="mt-6 max-w-xl text-base text-zinc-200 sm:text-lg">
              An academic agentic-AI multiplayer world-building tool. Students
              build their own AI in early university and carry it through
              their studies, take it on real-world quests, and contribute to
              online neural-network building with their classmates.
            </p>
            <div className="mt-10 flex flex-col items-start gap-3 sm:flex-row sm:items-center sm:gap-5">
              <Link
                href="/auth/signin"
                className="rounded-md bg-blue-600 px-8 py-3.5 text-base font-medium text-white shadow-2xl shadow-blue-900/50 transition hover:bg-blue-500"
              >
                Sign in
              </Link>
              <p className="text-xs text-zinc-400">
                Sign in with GitHub or Google.
              </p>
            </div>
          </div>
        </div>

        {/* Subtle scroll hint at bottom */}
        <div className="absolute inset-x-0 bottom-6 z-10 flex justify-center">
          <div className="flex flex-col items-center gap-1 text-[10px] uppercase tracking-[0.2em] text-zinc-500">
            <span>more below</span>
            <span aria-hidden="true">↓</span>
          </div>
        </div>
      </section>

      {/* What it is — three concepts */}
      <section className="bg-zinc-950 px-6 py-20 sm:px-12 lg:px-20">
        <div className="mx-auto max-w-5xl">
          <h2 className="text-2xl font-semibold tracking-tight text-zinc-100 sm:text-3xl">
            What you do here
          </h2>
          <p className="mt-3 max-w-2xl text-sm text-zinc-400 sm:text-base">
            Three things, in order. Each one builds on the last.
          </p>

          <div className="mt-10 grid grid-cols-1 gap-6 sm:grid-cols-3">
            <Card
              step="01"
              title="Build agents"
              body="Configure a clan of specialist subagents — researcher, planner, builder, custom. Each picks its own model and skill set."
            />
            <Card
              step="02"
              title="Make skills together"
              body="Skills are markdown wisdom your agents read. Some graduate into hard-coded tools as you use them more."
            />
            <Card
              step="03"
              title="Observe everything"
              body="Token cost, latency, agent activity, semantic memory — all surfaced in one dashboard, not buried in logs."
            />
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-zinc-900 bg-zinc-950 px-6 py-8 sm:px-12 lg:px-20">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-4 text-xs text-zinc-600">
          <span>humancensys.com · Apache 2.0</span>
          <div className="flex items-center gap-4">
            <a
              href="https://github.com/Lizo-RoadTown/Make_Skills"
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-zinc-400"
            >
              GitHub →
            </a>
            <Link href="/docs" className="hover:text-zinc-400">
              Docs
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}

function Card({
  step,
  title,
  body,
}: {
  step: string;
  title: string;
  body: string;
}) {
  return (
    <div className="rounded-lg border border-zinc-800 bg-zinc-900/60 p-6 backdrop-blur-sm transition hover:border-zinc-700">
      <div className="font-mono text-xs tracking-wider text-zinc-600">
        {step}
      </div>
      <div className="mt-3 text-base font-semibold text-zinc-100">{title}</div>
      <p className="mt-2 text-sm leading-relaxed text-zinc-400">{body}</p>
    </div>
  );
}
