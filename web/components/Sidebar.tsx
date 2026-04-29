"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

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
        status: "live",
      },
    ],
  },
];

export function Sidebar() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  // Close drawer when route changes
  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  // Close drawer on Escape
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <>
      {/* Mobile top bar — visible below md */}
      <div className="fixed top-0 left-0 right-0 z-30 flex items-center justify-between border-b border-zinc-800 bg-zinc-950 px-4 py-3 md:hidden">
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-label="Open navigation menu"
          className="rounded p-1 text-zinc-300 hover:bg-zinc-800"
        >
          <svg
            width="20"
            height="20"
            viewBox="0 0 20 20"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
          >
            <line x1="3" y1="6" x2="17" y2="6" />
            <line x1="3" y1="10" x2="17" y2="10" />
            <line x1="3" y1="14" x2="17" y2="14" />
          </svg>
        </button>
        <Link href="/" className="text-sm font-semibold text-zinc-100">
          Make_Skills
        </Link>
        <div className="w-7" /> {/* spacer to balance the hamburger */}
      </div>

      {/* Mobile-only spacer so content doesn't sit under the fixed top bar */}
      <div className="h-12 md:hidden" />

      {/* Drawer overlay (mobile only, when open) */}
      {open && (
        <button
          type="button"
          aria-label="Close navigation menu"
          onClick={() => setOpen(false)}
          className="fixed inset-0 z-40 bg-black/60 md:hidden"
        />
      )}

      {/* Sidebar — fixed slide-in on mobile, static on md+ */}
      <aside
        className={`fixed top-0 bottom-0 left-0 z-50 w-64 transform flex-col border-r border-zinc-800 bg-zinc-950 transition-transform md:static md:z-0 md:flex md:w-60 md:translate-x-0 ${
          open ? "flex translate-x-0" : "flex -translate-x-full md:translate-x-0"
        }`}
      >
        <div className="flex items-center justify-between border-b border-zinc-800 px-5 py-4">
          <Link href="/" className="block">
            <h1 className="text-sm font-semibold tracking-tight text-zinc-100">
              Make_Skills
            </h1>
            <p className="text-xs text-zinc-500">humancensys.com</p>
          </Link>
          {/* Close button (mobile only) */}
          <button
            type="button"
            onClick={() => setOpen(false)}
            aria-label="Close navigation menu"
            className="rounded p-1 text-zinc-400 hover:bg-zinc-800 md:hidden"
          >
            <svg
              width="18"
              height="18"
              viewBox="0 0 18 18"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
            >
              <line x1="4" y1="4" x2="14" y2="14" />
              <line x1="14" y1="4" x2="4" y2="14" />
            </svg>
          </button>
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
    </>
  );
}
