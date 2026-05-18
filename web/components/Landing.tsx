"use client";
import Image from "next/image";
import Link from "next/link";

/**
 * Public landing page for unauthenticated visitors. Shows what
 * Make_Skills is in plain language plus a sign-in CTA. Authenticated
 * users see the Chat surface instead (page.tsx switches based on
 * useSession status).
 */
export function Landing() {
  return (
    <div className="flex min-h-full flex-col bg-zinc-950">
      {/* Hero — split layout, image left, text right on desktop */}
      <section className="px-6 pb-16 pt-12 sm:pt-20 lg:pb-24">
        <div className="mx-auto grid max-w-6xl items-center gap-10 lg:grid-cols-12 lg:gap-12">
          {/* Image — 7/12 columns on desktop, full width on mobile */}
          <div className="relative aspect-video w-full overflow-hidden rounded-2xl ring-1 ring-zinc-800 shadow-2xl shadow-blue-900/30 lg:col-span-7">
            <Image
              src="/illustrations/agents-hero.jpg"
              alt="Four translucent crystalline geometric forms — a glowing sphere, a faceted cube, a multi-pointed star, and a luminous lattice — suspended in formation against a deep navy background with cyan and violet light traces"
              fill
              priority
              className="object-cover"
              sizes="(min-width: 1024px) 56vw, 100vw"
            />
          </div>

          {/* Text — 5/12 columns on desktop */}
          <header className="lg:col-span-5">
            <p className="text-sm uppercase tracking-[0.2em] text-zinc-500">
              humancensys.com
            </p>
            <h1 className="mt-3 text-4xl font-semibold tracking-tight text-zinc-100 sm:text-5xl">
              Make_Skills
            </h1>
            <p className="mt-5 text-base text-zinc-300 sm:text-lg">
              An academic agentic-AI multiplayer world-building tool. Students
              build their own AI in early university and carry it through
              their studies, take it on real-world quests, and contribute to
              online neural-network building with their classmates.
            </p>
            <div className="mt-8 flex flex-col items-start gap-2 sm:flex-row sm:items-center sm:gap-4">
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
          </header>
        </div>
      </section>

      {/* Cards section */}
      <section className="border-t border-zinc-900 px-6 pb-20">
        <div className="mx-auto mt-12 grid max-w-6xl grid-cols-1 gap-4 sm:grid-cols-3">
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

        <footer className="mx-auto mt-16 flex max-w-6xl justify-center gap-4 text-xs text-zinc-600">
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
      </section>
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
