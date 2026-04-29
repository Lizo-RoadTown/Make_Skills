"use client";
import { useEffect, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

const AGENT_URL =
  process.env.NEXT_PUBLIC_AGENT_URL || "http://localhost:8001";

const TYPE_COLORS: Record<string, string> = {
  decision: "#3b82f6",
  lesson: "#10b981",
  preference: "#a855f7",
  skill_idea: "#f59e0b",
  topic: "#71717a",
  fact: "#ec4899",
  unknown: "#52525b",
};

type Summary = {
  total_records: number;
  total_threads: number;
  by_type: { type: string; count: number }[];
};
type SeriesPoint = { day: string; count: number };
type TagRow = { tag: string; count: number };
type RecordItem = {
  id: string;
  type: string;
  content: string;
  project_tags: string[];
  ts: number;
  why: string;
};

export default function ObservabilityPage() {
  const [summary, setSummary] = useState<Summary | null>(null);
  const [byDay, setByDay] = useState<SeriesPoint[]>([]);
  const [byTag, setByTag] = useState<TagRow[]>([]);
  const [recent, setRecent] = useState<RecordItem[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([
      fetch(`${AGENT_URL}/observability/summary`).then((r) => r.json()),
      fetch(`${AGENT_URL}/observability/records-by-day?days=30`).then((r) =>
        r.json(),
      ),
      fetch(`${AGENT_URL}/observability/records-by-tag?top=10`).then((r) =>
        r.json(),
      ),
      fetch(`${AGENT_URL}/observability/recent?limit=10`).then((r) => r.json()),
    ])
      .then(([s, d, t, r]) => {
        setSummary(s);
        setByDay(d.data || []);
        setByTag(t.data || []);
        setRecent(r.data || []);
      })
      .catch((e) => setError((e as Error).message));
  }, []);

  return (
    <div className="flex h-full flex-col overflow-y-auto">
      <header className="border-b border-zinc-800 bg-zinc-900 px-8 py-5">
        <div className="text-xs uppercase tracking-wider text-zinc-500">
          Pillar 3 — Observability
        </div>
        <h1 className="text-xl font-semibold text-zinc-100">
          System observability
        </h1>
        <p className="mt-1 text-sm text-zinc-500">
          Custom dashboards over the same data Grafana would query —
          Make_Skills&apos;s own surface, no Grafana iframe.
        </p>
      </header>

      {error && (
        <div className="mx-8 mt-4 rounded border border-red-900 bg-red-950/40 px-4 py-2 text-sm text-red-300">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 p-8 lg:grid-cols-3">
        <KpiCard
          label="Memory records"
          value={summary?.total_records ?? "—"}
          hint="extracted from chat turns"
        />
        <KpiCard
          label="Conversation threads"
          value={summary?.total_threads ?? "—"}
          hint="LangGraph checkpoints"
        />
        <KpiCard
          label="Record types"
          value={summary?.by_type?.length ?? "—"}
          hint={
            summary?.by_type
              ?.slice(0, 3)
              .map((b) => `${b.type}:${b.count}`)
              .join(" · ") || null
          }
        />

        <Panel
          title="Records per day (last 30)"
          subtitle="When the recorder extracted records from chat"
          className="lg:col-span-3"
        >
          <ResponsiveContainer width="100%" height={220}>
            <LineChart data={byDay}>
              <CartesianGrid stroke="#27272a" strokeDasharray="3 3" />
              <XAxis
                dataKey="day"
                stroke="#71717a"
                fontSize={11}
                tickFormatter={(v) => v.slice(5)}
              />
              <YAxis stroke="#71717a" fontSize={11} allowDecimals={false} />
              <Tooltip
                contentStyle={{
                  background: "#18181b",
                  border: "1px solid #3f3f46",
                  borderRadius: 6,
                }}
                labelStyle={{ color: "#e4e4e7" }}
              />
              <Line
                type="monotone"
                dataKey="count"
                stroke="#3b82f6"
                strokeWidth={2}
                dot={{ fill: "#3b82f6", r: 3 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </Panel>

        <Panel
          title="Records by type"
          subtitle="What kind of memory the agent is accumulating"
        >
          {summary?.by_type && summary.by_type.length > 0 ? (
            <ResponsiveContainer width="100%" height={220}>
              <PieChart>
                <Pie
                  data={summary.by_type}
                  dataKey="count"
                  nameKey="type"
                  innerRadius={50}
                  outerRadius={80}
                  paddingAngle={2}
                >
                  {summary.by_type.map((b) => (
                    <Cell key={b.type} fill={TYPE_COLORS[b.type] || "#52525b"} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{
                    background: "#18181b",
                    border: "1px solid #3f3f46",
                    borderRadius: 6,
                  }}
                />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <Empty />
          )}
          <div className="mt-2 flex flex-wrap gap-2">
            {summary?.by_type?.map((b) => (
              <span
                key={b.type}
                className="flex items-center gap-1 text-xs text-zinc-400"
              >
                <span
                  className="h-2 w-2 rounded-full"
                  style={{ background: TYPE_COLORS[b.type] || "#52525b" }}
                />
                {b.type} · {b.count}
              </span>
            ))}
          </div>
        </Panel>

        <Panel
          title="Top project tags"
          subtitle="What the recorder thinks you're working on"
          className="lg:col-span-2"
        >
          {byTag.length > 0 ? (
            <ResponsiveContainer width="100%" height={220}>
              <BarChart
                data={byTag}
                layout="vertical"
                margin={{ left: 16, right: 16 }}
              >
                <CartesianGrid stroke="#27272a" strokeDasharray="3 3" />
                <XAxis type="number" stroke="#71717a" fontSize={11} />
                <YAxis
                  type="category"
                  dataKey="tag"
                  stroke="#a1a1aa"
                  fontSize={11}
                  width={100}
                />
                <Tooltip
                  contentStyle={{
                    background: "#18181b",
                    border: "1px solid #3f3f46",
                    borderRadius: 6,
                  }}
                />
                <Bar dataKey="count" fill="#10b981" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <Empty />
          )}
        </Panel>

        <Panel
          title="Recent activity"
          subtitle="Last 10 records the recorder extracted"
          className="lg:col-span-3"
        >
          {recent.length === 0 ? (
            <Empty />
          ) : (
            <div className="divide-y divide-zinc-800">
              {recent.map((r) => (
                <div key={r.id} className="py-3 first:pt-0 last:pb-0">
                  <div className="flex items-center gap-2 text-xs text-zinc-500">
                    <span
                      className="rounded px-1.5 py-0.5 font-mono"
                      style={{
                        background: `${TYPE_COLORS[r.type] || "#52525b"}33`,
                        color: TYPE_COLORS[r.type] || "#a1a1aa",
                      }}
                    >
                      {r.type}
                    </span>
                    {r.project_tags?.map((t) => (
                      <span key={t} className="text-zinc-600">
                        {t}
                      </span>
                    ))}
                    <span className="ml-auto">
                      {r.ts && new Date(r.ts * 1000).toLocaleString()}
                    </span>
                  </div>
                  <div className="mt-1 text-sm text-zinc-200">{r.content}</div>
                  {r.why && (
                    <div className="mt-0.5 text-xs italic text-zinc-500">
                      {r.why}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </Panel>
      </div>

      <footer className="px-8 pb-8 text-xs text-zinc-600">
        Same data source as Grafana (Postgres + LanceDB) · custom UI in
        Make_Skills aesthetic · agent-comms tracing (3a) and knowledge graph
        (3c) panels arrive when those pillars land
      </footer>
    </div>
  );
}

function KpiCard({
  label,
  value,
  hint,
}: {
  label: string;
  value: number | string;
  hint?: string | null;
}) {
  return (
    <div className="rounded-lg border border-zinc-800 bg-zinc-900 p-5">
      <div className="text-xs uppercase tracking-wider text-zinc-500">
        {label}
      </div>
      <div className="mt-2 text-3xl font-semibold tabular-nums text-zinc-100">
        {value}
      </div>
      {hint && (
        <div className="mt-1 line-clamp-1 text-xs text-zinc-500">{hint}</div>
      )}
    </div>
  );
}

function Panel({
  title,
  subtitle,
  className,
  children,
}: {
  title: string;
  subtitle?: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div
      className={`rounded-lg border border-zinc-800 bg-zinc-900 p-5 ${className || ""}`}
    >
      <div className="mb-4">
        <h2 className="text-sm font-semibold text-zinc-200">{title}</h2>
        {subtitle && (
          <p className="text-xs text-zinc-500">{subtitle}</p>
        )}
      </div>
      {children}
    </div>
  );
}

function Empty() {
  return (
    <div className="flex h-[200px] items-center justify-center text-sm text-zinc-600">
      No data yet — talk to the agent to start populating this.
    </div>
  );
}
