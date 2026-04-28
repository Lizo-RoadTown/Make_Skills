"use client";

const GRAFANA_URL =
  process.env.NEXT_PUBLIC_GRAFANA_URL || "http://localhost:3001";

export default function DashboardPage() {
  return (
    <div className="flex h-full flex-col">
      <header className="flex items-center justify-between border-b border-zinc-800 bg-zinc-900 px-6 py-3">
        <div>
          <h1 className="text-sm font-semibold text-zinc-300">
            Make_Skills · Dashboard
          </h1>
          <p className="text-xs text-zinc-500">
            Grafana — query postgres for conversation activity, token usage,
            thread metrics
          </p>
        </div>
        <div className="flex items-center gap-3 text-xs">
          <a href="/" className="text-blue-400 hover:underline">
            ← Chat
          </a>
          <a href="/memory" className="text-blue-400 hover:underline">
            Memory
          </a>
          <a
            href={GRAFANA_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="text-blue-400 hover:underline"
          >
            Open in new tab ↗
          </a>
        </div>
      </header>
      <iframe
        src={GRAFANA_URL}
        className="flex-1 w-full border-0"
        title="Grafana"
      />
    </div>
  );
}
