"use client";
import Link from "next/link";
import { useEffect, useState } from "react";

const AGENT_URL =
  process.env.NEXT_PUBLIC_AGENT_URL || "http://localhost:8001";

type Provider = {
  slug: string;
  label: string;
  description: string;
  tier: string;
  starter_model: string | null;
  key_env_vars: string[];
  ready: boolean;
};

type StoredKey = {
  provider_slug: string;
  created_at: string | null;
  updated_at: string | null;
};

export default function SettingsKeysPage() {
  const [providers, setProviders] = useState<Provider[]>([]);
  const [stored, setStored] = useState<StoredKey[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editingSlug, setEditingSlug] = useState<string | null>(null);
  const [keyValue, setKeyValue] = useState("");
  const [saving, setSaving] = useState(false);

  async function refresh() {
    setError(null);
    try {
      const [pRes, sRes] = await Promise.all([
        fetch(`${AGENT_URL}/providers/list`),
        fetch(`${AGENT_URL}/secrets/list`),
      ]);
      const p = await pRes.json();
      setProviders(p.providers || []);
      if (sRes.status === 403) {
        setStored([]);
        setError("admin role required to manage keys");
      } else if (sRes.ok) {
        const s = await sRes.json();
        setStored(s.providers_with_keys || []);
      } else {
        setError(`couldn't load keys: ${sRes.status}`);
      }
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    refresh();
  }, []);

  function isStored(slug: string): StoredKey | undefined {
    return stored.find((s) => s.provider_slug === slug);
  }

  async function saveKey() {
    if (!editingSlug || !keyValue.trim()) return;
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`${AGENT_URL}/secrets/set`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          provider_slug: editingSlug,
          value: keyValue.trim(),
        }),
      });
      if (!res.ok && res.status !== 204) {
        const detail = await res.text();
        throw new Error(`save failed (${res.status}): ${detail}`);
      }
      setEditingSlug(null);
      setKeyValue("");
      await refresh();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSaving(false);
    }
  }

  async function deleteKey(slug: string) {
    if (!confirm(`Delete the saved ${slug} key?`)) return;
    setError(null);
    try {
      const res = await fetch(`${AGENT_URL}/secrets/${slug}`, {
        method: "DELETE",
      });
      if (!res.ok && res.status !== 204) {
        const detail = await res.text();
        throw new Error(`delete failed (${res.status}): ${detail}`);
      }
      await refresh();
    } catch (e) {
      setError((e as Error).message);
    }
  }

  return (
    <div className="flex h-full flex-col">
      <header className="border-b border-zinc-800 bg-zinc-900 px-8 py-5">
        <div className="text-xs uppercase tracking-wider text-zinc-500">
          <Link href="/settings" className="hover:text-zinc-300">
            Settings
          </Link>{" "}
          · API keys
        </div>
        <h1 className="text-xl font-semibold text-zinc-100">Provider keys</h1>
        <p className="mt-1 max-w-3xl text-sm text-zinc-500">
          Paste your own API keys for the LLM providers your agents use.
          Stored encrypted at rest. Your keys, your bill — the platform calls
          the provider on your behalf with the key you provide here.
        </p>
      </header>

      {error && (
        <div className="mx-8 mt-4 rounded border border-red-900 bg-red-950/40 px-4 py-2 text-sm text-red-300">
          {error}
        </div>
      )}

      <div className="flex-1 overflow-y-auto px-8 py-6">
        {loading && <div className="text-sm text-zinc-500">Loading…</div>}
        {!loading && (
          <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
            {providers.map((p) => {
              const s = isStored(p.slug);
              const isEditing = editingSlug === p.slug;
              const needsKey = p.key_env_vars.length > 0;

              return (
                <div
                  key={p.slug}
                  className={`rounded-lg border p-5 ${
                    s
                      ? "border-emerald-800 bg-zinc-900"
                      : "border-zinc-800 bg-zinc-950"
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <h2 className="text-base font-semibold text-zinc-100">
                          {p.label}
                        </h2>
                        {!needsKey && (
                          <span className="rounded bg-violet-950 px-1.5 py-0.5 text-[10px] uppercase tracking-wider text-violet-300">
                            no key needed
                          </span>
                        )}
                        {s && (
                          <span className="rounded bg-emerald-950 px-1.5 py-0.5 text-[10px] uppercase tracking-wider text-emerald-300">
                            saved
                          </span>
                        )}
                      </div>
                      <p className="mt-1 text-xs text-zinc-500">
                        {p.description}
                      </p>
                      {s?.updated_at && (
                        <p className="mt-1 text-[11px] text-zinc-600">
                          updated {new Date(s.updated_at).toLocaleString()}
                        </p>
                      )}
                    </div>
                  </div>

                  {needsKey && (
                    <div className="mt-4 border-t border-zinc-800 pt-4">
                      {isEditing ? (
                        <div className="flex flex-col gap-2">
                          <input
                            type="password"
                            autoFocus
                            value={keyValue}
                            onChange={(e) => setKeyValue(e.target.value)}
                            placeholder={`paste your ${p.label} API key`}
                            className="rounded border border-zinc-700 bg-zinc-950 px-3 py-2 font-mono text-sm text-zinc-100 placeholder:text-zinc-700 focus:border-blue-500 focus:outline-none"
                          />
                          <div className="flex justify-end gap-2">
                            <button
                              type="button"
                              onClick={() => {
                                setEditingSlug(null);
                                setKeyValue("");
                              }}
                              className="rounded border border-zinc-800 px-3 py-1 text-xs text-zinc-400 hover:bg-zinc-900"
                            >
                              Cancel
                            </button>
                            <button
                              type="button"
                              onClick={saveKey}
                              disabled={!keyValue.trim() || saving}
                              className="rounded bg-blue-600 px-3 py-1 text-xs font-semibold text-white transition hover:bg-blue-500 disabled:cursor-not-allowed disabled:bg-zinc-800 disabled:text-zinc-500"
                            >
                              {saving ? "Saving…" : "Save"}
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div className="flex items-center justify-between">
                          <div className="text-[11px] uppercase tracking-wider text-zinc-600">
                            {p.key_env_vars.join(" / ")}
                          </div>
                          <div className="flex gap-2">
                            {s && (
                              <button
                                type="button"
                                onClick={() => deleteKey(p.slug)}
                                className="rounded border border-zinc-800 px-3 py-1 text-xs text-zinc-500 hover:bg-zinc-900 hover:text-red-400"
                              >
                                Delete
                              </button>
                            )}
                            <button
                              type="button"
                              onClick={() => {
                                setEditingSlug(p.slug);
                                setKeyValue("");
                              }}
                              className="rounded bg-blue-600 px-3 py-1 text-xs font-semibold text-white transition hover:bg-blue-500"
                            >
                              {s ? "Replace key" : "Set key"}
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
