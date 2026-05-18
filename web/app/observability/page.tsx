"use client";
/**
 * Observability — the one place to see what happened.
 *
 * Replaces the previous four separate pages (/observability, /sessions,
 * /memory, /test-runs) with a single tabbed surface. Per docs/UX_CONTRACT
 * "Navigation — one place per concern."
 *
 * Old routes (/sessions, /memory, /test-runs) redirect here with the
 * matching ?tab= query param. /sessions/[thread_id] is preserved
 * separately for replay-with-trace detail.
 */
import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { MemoryTab } from "@/components/observability/MemoryTab";
import { OverviewTab } from "@/components/observability/OverviewTab";
import { SessionsTab } from "@/components/observability/SessionsTab";
import { TestRunsTab } from "@/components/observability/TestRunsTab";

type TabKey = "overview" | "sessions" | "memory" | "test-runs";

const TABS: { key: TabKey; label: string; blurb: string }[] = [
  {
    key: "overview",
    label: "Overview",
    blurb: "Counts, trends, recent activity.",
  },
  {
    key: "sessions",
    label: "Sessions",
    blurb: "Every chat conversation, replayable with full trace.",
  },
  {
    key: "memory",
    label: "Memory",
    blurb: "Semantic memory: decisions, lessons, preferences, topics.",
  },
  {
    key: "test-runs",
    label: "Test runs",
    blurb: "Friction-surface logs from real end-to-end runs.",
  },
];

function isTabKey(s: string | null): s is TabKey {
  return s === "overview" || s === "sessions" || s === "memory" || s === "test-runs";
}

function ObservabilityPageInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const tabParam = searchParams.get("tab");
  const [tab, setTab] = useState<TabKey>(
    isTabKey(tabParam) ? tabParam : "overview",
  );

  // Sync URL when tab changes (without a page reload).
  useEffect(() => {
    const current = searchParams.get("tab");
    if (current !== tab) {
      const next = new URLSearchParams(searchParams.toString());
      next.set("tab", tab);
      router.replace(`/observability?${next.toString()}`, { scroll: false });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab]);

  return (
    <div className="flex h-full flex-col">
      <header className="border-b border-zinc-800 bg-zinc-900 px-8 py-5">
        <div className="text-xs uppercase tracking-wider text-text-subtle">
          Observe
        </div>
        <h1 className="text-xl font-semibold text-text">Observability</h1>
        <p className="mt-1 max-w-3xl text-sm text-text-subtle">
          One place to see what happened — counts, trends, conversations,
          memory, and friction-surface logs from real runs.
        </p>
      </header>

      <nav
        className="flex shrink-0 gap-1 border-b border-zinc-800 bg-zinc-900 px-6"
        aria-label="Observability sections"
      >
        {TABS.map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => setTab(t.key)}
            aria-current={tab === t.key ? "page" : undefined}
            title={t.blurb}
            className={`relative px-4 py-2.5 text-sm transition ${
              tab === t.key
                ? "text-text"
                : "text-text-subtle hover:text-text-muted"
            }`}
          >
            {t.label}
            {tab === t.key && (
              <span className="absolute inset-x-3 -bottom-px h-0.5 rounded-full bg-active" />
            )}
          </button>
        ))}
      </nav>

      <div className="flex-1 overflow-y-auto">
        {tab === "overview" && <OverviewTab />}
        {tab === "sessions" && <SessionsTab />}
        {tab === "memory" && <MemoryTab />}
        {tab === "test-runs" && <TestRunsTab />}
      </div>
    </div>
  );
}

export default function ObservabilityPage() {
  return (
    <Suspense
      fallback={
        <div className="flex h-full items-center justify-center text-sm text-text-subtle">
          Loading…
        </div>
      }
    >
      <ObservabilityPageInner />
    </Suspense>
  );
}
