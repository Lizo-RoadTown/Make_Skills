"use client";
import { useSession } from "next-auth/react";
import { useEffect, useState } from "react";

type Invitation = {
  id: string;
  email: string;
  token: string;
  createdAt: string;
  consumedAt: string | null;
  consumedByEmail: string | null;
  status: "pending" | "consumed";
};

export default function InvitationsAdminPage() {
  const { data: session, status } = useSession();

  const [invites, setInvites] = useState<Invitation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [emailInput, setEmailInput] = useState("");
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  async function refresh() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/invitations");
      if (!res.ok) {
        const e = await res.json().catch(() => ({}));
        throw new Error(e.error || `HTTP ${res.status}`);
      }
      const data = await res.json();
      setInvites(data.invitations || []);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (status === "authenticated" && session?.user.role === "admin") {
      refresh();
    } else if (status === "authenticated") {
      setLoading(false);
    }
  }, [status, session?.user.role]);

  async function createInvite() {
    if (!emailInput.trim()) return;
    setCreating(true);
    setCreateError(null);
    try {
      const res = await fetch("/api/invitations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: emailInput.trim() }),
      });
      if (!res.ok) {
        const e = await res.json().catch(() => ({}));
        throw new Error(e.error || `HTTP ${res.status}`);
      }
      setEmailInput("");
      await refresh();
    } catch (e) {
      setCreateError((e as Error).message);
    } finally {
      setCreating(false);
    }
  }

  async function revokeInvite(id: string) {
    if (!confirm("Revoke this invitation? The recipient will no longer be able to sign in with it.")) {
      return;
    }
    try {
      const res = await fetch(`/api/invitations/${id}`, { method: "DELETE" });
      if (!res.ok) {
        const e = await res.json().catch(() => ({}));
        throw new Error(e.error || `HTTP ${res.status}`);
      }
      await refresh();
    } catch (e) {
      alert(`Could not revoke: ${(e as Error).message}`);
    }
  }

  if (status === "loading") {
    return <div className="p-8 text-sm text-zinc-500">Loading…</div>;
  }
  if (status !== "authenticated") {
    return (
      <div className="p-8 text-sm text-zinc-500">
        Please sign in to manage invitations.
      </div>
    );
  }
  if (session?.user.role !== "admin") {
    return (
      <div className="p-8">
        <div className="rounded border border-amber-900 bg-amber-950/40 px-4 py-3 text-sm text-amber-300">
          Admin role required. You&apos;re signed in as a member; ask your
          workspace admin to issue invitations.
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col">
      <header className="border-b border-zinc-800 bg-zinc-900 px-8 py-5">
        <div className="text-xs uppercase tracking-wider text-zinc-500">
          Manage · Admin
        </div>
        <h1 className="text-xl font-semibold text-zinc-100">Invitations</h1>
        <p className="mt-1 max-w-3xl text-sm text-zinc-500">
          Issue or revoke invitations for your workspace. Recipients can
          sign in with the email you specify here; the invitation is
          consumed atomically on first successful sign-in.
        </p>
      </header>

      <div className="flex-1 overflow-y-auto px-8 py-6">
        {/* Issue form */}
        <section className="mb-8 max-w-2xl">
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-zinc-400">
            Issue invitation
          </h2>
          <div className="flex gap-2">
            <input
              type="email"
              value={emailInput}
              onChange={(e) => setEmailInput(e.target.value)}
              placeholder="user@example.com"
              className="flex-1 rounded border border-zinc-800 bg-zinc-900 px-3 py-2 text-sm text-zinc-100 placeholder-zinc-600 focus:border-zinc-600 focus:outline-none"
              disabled={creating}
            />
            <button
              type="button"
              onClick={createInvite}
              disabled={creating || !emailInput.trim()}
              className="rounded bg-blue-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-blue-500 disabled:cursor-not-allowed disabled:bg-zinc-800 disabled:text-zinc-500"
            >
              {creating ? "Issuing…" : "Issue invite"}
            </button>
          </div>
          {createError && (
            <div className="mt-2 rounded border border-red-900 bg-red-950/40 px-3 py-2 text-xs text-red-300">
              {createError}
            </div>
          )}
        </section>

        {/* Invites list */}
        <section>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-semibold uppercase tracking-wider text-zinc-400">
              Invitations ({invites.length})
            </h2>
            <button
              type="button"
              onClick={refresh}
              className="text-xs text-zinc-500 hover:text-zinc-300"
            >
              Refresh
            </button>
          </div>
          {loading && <div className="text-sm text-zinc-500">Loading…</div>}
          {error && (
            <div className="rounded border border-red-900 bg-red-950/40 px-4 py-2 text-sm text-red-300">
              {error}
            </div>
          )}
          {!loading && !error && invites.length === 0 && (
            <div className="rounded border border-zinc-800 bg-zinc-900 px-4 py-3 text-sm text-zinc-500">
              No invitations yet. Issue one above.
            </div>
          )}
          {!loading && !error && invites.length > 0 && (
            <div className="overflow-hidden rounded-lg border border-zinc-800">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-zinc-800 bg-zinc-900 text-left text-xs uppercase tracking-wider text-zinc-500">
                    <th className="px-4 py-2.5 font-medium">Email</th>
                    <th className="px-4 py-2.5 font-medium">Status</th>
                    <th className="px-4 py-2.5 font-medium">Issued</th>
                    <th className="px-4 py-2.5 font-medium">Consumed</th>
                    <th className="px-4 py-2.5 font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-800 bg-zinc-950">
                  {invites.map((inv) => (
                    <tr key={inv.id}>
                      <td className="px-4 py-3 text-zinc-200">{inv.email}</td>
                      <td className="px-4 py-3">
                        {inv.status === "pending" ? (
                          <span className="rounded bg-amber-900/40 px-2 py-0.5 text-[11px] uppercase tracking-wider text-amber-200">
                            pending
                          </span>
                        ) : (
                          <span className="rounded bg-emerald-900/40 px-2 py-0.5 text-[11px] uppercase tracking-wider text-emerald-200">
                            consumed
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-xs text-zinc-500">
                        {new Date(inv.createdAt).toLocaleString()}
                      </td>
                      <td className="px-4 py-3 text-xs text-zinc-500">
                        {inv.consumedAt ? (
                          <>
                            {new Date(inv.consumedAt).toLocaleString()}
                            {inv.consumedByEmail &&
                              inv.consumedByEmail !== inv.email && (
                                <span className="ml-1 text-zinc-600">
                                  (as {inv.consumedByEmail})
                                </span>
                              )}
                          </>
                        ) : (
                          "—"
                        )}
                      </td>
                      <td className="px-4 py-3">
                        {inv.status === "pending" && (
                          <button
                            type="button"
                            onClick={() => revokeInvite(inv.id)}
                            className="text-xs text-red-400 hover:text-red-300"
                          >
                            Revoke
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
