"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";

type NavItem = {
  href: string;
  label: string;
  icon: string;
  pillar?: string;
  status?: "live" | "stub";
};

const NAV: NavItem[] = [
  { href: "/", label: "Chat", icon: "💬", status: "live" },
  { href: "/memory", label: "Memory", icon: "🧠", status: "live" },
  { href: "/roadmap", label: "Roadmap", icon: "🛣", status: "live" },
  { href: "/docs", label: "Docs", icon: "📚", status: "live" },
  { href: "/skills", label: "Skills", icon: "⚒", status: "live" },
  {
    href: "/agents",
    label: "Agents",
    icon: "🐾",
    pillar: "Pillar 1",
    status: "stub",
  },
  {
    href: "/upskilling",
    label: "Upskilling",
    icon: "🌱",
    pillar: "Pillar 2",
    status: "stub",
  },
  {
    href: "/observability",
    label: "Observability",
    icon: "📈",
    pillar: "Pillar 3",
    status: "stub",
  },
  {
    href: "/dashboard",
    label: "Grafana",
    icon: "📊",
    pillar: "Pillar 3",
    status: "live",
  },
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="hidden w-56 shrink-0 flex-col border-r border-zinc-800 bg-zinc-950 md:flex">
      <div className="border-b border-zinc-800 px-4 py-4">
        <h1 className="text-sm font-semibold text-zinc-200">Make_Skills</h1>
        <p className="text-xs text-zinc-500">humancensys.com</p>
      </div>
      <nav className="flex-1 overflow-y-auto p-2">
        {NAV.map((item) => {
          const active = pathname === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`mb-1 flex items-center gap-2 rounded px-3 py-2 text-sm transition ${
                active
                  ? "bg-zinc-800 text-zinc-100"
                  : "text-zinc-400 hover:bg-zinc-900 hover:text-zinc-200"
              }`}
            >
              <span className="text-base leading-none">{item.icon}</span>
              <span className="flex-1">{item.label}</span>
              {item.status === "stub" && (
                <span
                  className="rounded bg-zinc-800 px-1.5 py-0.5 text-[10px] uppercase tracking-wider text-zinc-500"
                  title="Placeholder — coming soon"
                >
                  soon
                </span>
              )}
            </Link>
          );
        })}
      </nav>
      <div className="border-t border-zinc-800 px-4 py-3 text-xs text-zinc-600">
        <p>
          Apache 2.0 ·{" "}
          <a
            href="https://github.com/Lizo-RoadTown/Make_Skills"
            target="_blank"
            rel="noopener noreferrer"
            className="text-blue-400 hover:underline"
          >
            GitHub
          </a>
        </p>
      </div>
    </aside>
  );
}
