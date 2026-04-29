"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";

type NavItem = {
  href: string;
  label: string;
  pillar?: string;
  status?: "live" | "stub";
};

type NavGroup = {
  label: string;
  items: NavItem[];
};

const NAV: NavGroup[] = [
  {
    label: "Workspace",
    items: [
      { href: "/", label: "Chat", status: "live" },
      { href: "/memory", label: "Memory", status: "live" },
      { href: "/roadmap", label: "Roadmap", status: "live" },
    ],
  },
  {
    label: "Library",
    items: [
      { href: "/skills", label: "Skills", status: "live" },
      { href: "/docs", label: "Docs", status: "live" },
    ],
  },
  {
    label: "Pillars",
    items: [
      { href: "/agents", label: "Agents", pillar: "1", status: "stub" },
      { href: "/upskilling", label: "Upskilling", pillar: "2", status: "stub" },
      {
        href: "/observability",
        label: "Observability",
        pillar: "3",
        status: "stub",
      },
      { href: "/dashboard", label: "Grafana", pillar: "3b", status: "live" },
    ],
  },
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="hidden w-60 shrink-0 flex-col border-r border-zinc-800 bg-zinc-950 md:flex">
      <div className="border-b border-zinc-800 px-5 py-4">
        <Link href="/" className="block">
          <h1 className="text-sm font-semibold tracking-tight text-zinc-100">
            Make_Skills
          </h1>
          <p className="text-xs text-zinc-500">humancensys.com</p>
        </Link>
      </div>
      <nav className="flex-1 overflow-y-auto px-2 py-4">
        {NAV.map((group) => (
          <div key={group.label} className="mb-5">
            <div className="mb-1 px-3 text-[11px] font-medium uppercase tracking-wider text-zinc-500">
              {group.label}
            </div>
            {group.items.map((item) => {
              const active =
                item.href === "/"
                  ? pathname === "/"
                  : pathname?.startsWith(item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`group relative flex items-center justify-between rounded px-3 py-1.5 text-sm transition ${
                    active
                      ? "bg-zinc-800/80 text-zinc-50"
                      : "text-zinc-400 hover:bg-zinc-900 hover:text-zinc-200"
                  }`}
                >
                  {active && (
                    <span className="absolute left-0 top-1.5 bottom-1.5 w-0.5 rounded-full bg-blue-500" />
                  )}
                  <span className="flex items-center gap-2">
                    {item.label}
                    {item.pillar && (
                      <span className="text-[10px] font-mono text-zinc-600">
                        P{item.pillar}
                      </span>
                    )}
                  </span>
                  {item.status === "stub" && (
                    <span className="text-[9px] uppercase tracking-wider text-zinc-600">
                      soon
                    </span>
                  )}
                </Link>
              );
            })}
          </div>
        ))}
      </nav>
      <div className="border-t border-zinc-800 px-5 py-3 text-xs text-zinc-600">
        <a
          href="https://github.com/Lizo-RoadTown/Make_Skills"
          target="_blank"
          rel="noopener noreferrer"
          className="hover:text-zinc-400"
        >
          Apache 2.0 · GitHub →
        </a>
      </div>
    </aside>
  );
}
