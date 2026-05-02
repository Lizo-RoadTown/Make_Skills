"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { signIn, signOut, useSession } from "next-auth/react";
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
  requiresRole?: "admin";
};

// Workflow-oriented groupings (THINK / BUILD / TEST / OBSERVE / MANAGE).
// See docs/proposals/sidebar-architecture.md for the rationale.
const NAV: NavGroup[] = [
  {
    label: "Think",
    items: [
      { href: "/roadmap", label: "Roadmap", status: "live" },
      { href: "/plans", label: "Plans", status: "live" },
      { href: "/proposals", label: "Proposals", status: "live" },
    ],
  },
  {
    label: "Build",
    items: [
      { href: "/", label: "Chat", status: "live" },
      { href: "/agents", label: "Agents", pillar: "1", status: "stub" },
      { href: "/skills", label: "Skills", status: "live" },
    ],
  },
  {
    label: "Test",
    items: [
      { href: "/test-runs", label: "Test runs", status: "live" },
      { href: "/sessions", label: "Sessions", status: "stub" },
      { href: "/upskilling", label: "Quests", pillar: "2", status: "stub" },
    ],
  },
  {
    label: "Observe",
    items: [
      { href: "/observability", label: "Dashboard", pillar: "3", status: "live" },
      { href: "/memory", label: "Memory", status: "live" },
      { href: "/docs", label: "Docs", status: "live" },
    ],
  },
  {
    label: "Manage",
    items: [
      { href: "/integrations", label: "Integrations", status: "live" },
      { href: "/credentials", label: "Credentials", status: "stub" },
      { href: "/environments", label: "Environments", status: "stub" },
      { href: "/settings", label: "Settings", status: "stub" },
    ],
  },
  {
    label: "Admin",
    requiresRole: "admin",
    items: [
      { href: "/admin/invitations", label: "Invitations", status: "live" },
    ],
  },
];

export function Sidebar() {
  const pathname = usePathname();
  const { data: session } = useSession();
  const userRole = session?.user?.role;
  const visibleGroups = NAV.filter(
    (g) => !g.requiresRole || g.requiresRole === userRole,
  );
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
      {/* Mobile top bar — visible below md only */}
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
        <div className="w-7" />
      </div>

      {/* Mobile-only spacer so content doesn't sit under the fixed top bar */}
      <div className="h-12 shrink-0 md:hidden" />

      {/* Mobile drawer overlay */}
      {open && (
        <button
          type="button"
          aria-label="Close navigation menu"
          onClick={() => setOpen(false)}
          className="fixed inset-0 z-40 bg-black/60 md:hidden"
        />
      )}

      {/* Mobile drawer — slides in/out, only renders below md */}
      <aside
        aria-label="Mobile navigation"
        className={`fixed top-0 bottom-0 left-0 z-50 flex w-64 flex-col border-r border-zinc-800 bg-zinc-950 transition-transform md:hidden ${
          open ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <SidebarHeader onClose={() => setOpen(false)} closable />
        <SidebarNav
          groups={visibleGroups}
          pathname={pathname}
          onItemClick={() => setOpen(false)}
        />
        <AccountSection />
        <SidebarFooter />
      </aside>

      {/* Desktop sidebar — always-visible flex column, never positioned */}
      <aside
        aria-label="Navigation"
        className="hidden w-60 shrink-0 flex-col border-r border-zinc-800 bg-zinc-950 md:flex"
      >
        <SidebarHeader />
        <SidebarNav groups={visibleGroups} pathname={pathname} />
        <AccountSection />
        <SidebarFooter />
      </aside>
    </>
  );
}

function SidebarHeader({
  onClose,
  closable = false,
}: {
  onClose?: () => void;
  closable?: boolean;
}) {
  return (
    <div className="flex shrink-0 items-center justify-between border-b border-zinc-800 px-5 py-4">
      <Link href="/" className="block">
        <h1 className="text-sm font-semibold tracking-tight text-zinc-100">
          Make_Skills
        </h1>
        <p className="text-xs text-zinc-500">humancensys.com</p>
      </Link>
      {closable && (
        <button
          type="button"
          onClick={onClose}
          aria-label="Close navigation menu"
          className="rounded p-1 text-zinc-400 hover:bg-zinc-800"
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
      )}
    </div>
  );
}

function SidebarNav({
  groups,
  pathname,
  onItemClick,
}: {
  groups: NavGroup[];
  pathname: string | null;
  onItemClick?: () => void;
}) {
  return (
    <nav className="flex-1 overflow-y-auto px-2 py-4">
      {groups.map((group) => (
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
                onClick={onItemClick}
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
  );
}

function SidebarFooter() {
  return (
    <div className="shrink-0 border-t border-zinc-800 px-5 py-3 text-xs text-zinc-600">
      <a
        href="https://github.com/Lizo-RoadTown/Make_Skills"
        target="_blank"
        rel="noopener noreferrer"
        className="hover:text-zinc-400"
      >
        Apache 2.0 · GitHub →
      </a>
    </div>
  );
}

/**
 * Bottom-of-sidebar account section. Profile + sign-out when authenticated,
 * sign-in link when not.
 */
function AccountSection() {
  const { data: session, status } = useSession();

  if (status === "loading") {
    return (
      <div className="shrink-0 border-t border-zinc-800 px-5 py-3 text-xs text-zinc-600">
        Loading…
      </div>
    );
  }

  if (!session?.user) {
    return (
      <div className="shrink-0 border-t border-zinc-800 px-2 py-3">
        <button
          type="button"
          onClick={() => signIn()}
          className="flex w-full items-center justify-center rounded px-3 py-1.5 text-sm text-zinc-300 hover:bg-zinc-900 hover:text-zinc-100"
        >
          Sign in
        </button>
      </div>
    );
  }

  const user = session.user;
  const initials = (user.name || user.email || "?")
    .split(/[\s@]/)
    .filter(Boolean)
    .slice(0, 2)
    .map((s: string) => s[0]?.toUpperCase())
    .join("");

  return (
    <div className="shrink-0 border-t border-zinc-800 px-2 py-3">
      <div className="mb-1 px-3 text-[11px] font-medium uppercase tracking-wider text-zinc-500">
        Account
      </div>
      <div className="flex items-center gap-2 px-3 py-1.5">
        {user.image ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={user.image} alt="" className="h-7 w-7 rounded-full" />
        ) : (
          <span className="flex h-7 w-7 items-center justify-center rounded-full bg-zinc-800 text-[11px] font-medium text-zinc-300">
            {initials || "U"}
          </span>
        )}
        <div className="min-w-0 flex-1">
          <div className="truncate text-xs text-zinc-200">
            {user.name || user.email}
          </div>
          {user.name && user.email && (
            <div className="truncate text-[10px] text-zinc-500">
              {user.email}
            </div>
          )}
        </div>
      </div>
      <button
        type="button"
        onClick={() => signOut({ callbackUrl: "/auth/signin" })}
        className="mt-1 flex w-full items-center rounded px-3 py-1.5 text-sm text-zinc-400 hover:bg-zinc-900 hover:text-zinc-200"
      >
        Sign out
      </button>
    </div>
  );
}
