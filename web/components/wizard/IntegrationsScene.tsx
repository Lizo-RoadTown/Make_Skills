"use client";
/**
 * Integrations — wizard step 6.
 *
 * MCP servers from .mcp.json + the curated recommended list. The
 * student picks any that fit their agent's job. Skipping is encouraged
 * — most agents don't need every integration.
 */
import { motion, AnimatePresence } from "motion/react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Character, type CharacterMood, type CharacterState } from "./Character";
import { Dialog } from "./Dialog";

const AGENT_URL = process.env.NEXT_PUBLIC_AGENT_URL || "http://localhost:8001";

type McpServer = {
  name: string;
  description: string;
  category?: string;
  configured?: boolean;
};

type Phase = "greeting" | "picking" | "reacting" | "done";

type Props = {
  initial?: string[];
  onComplete: (payload: { integrations: string[] }) => void;
  onBack: () => void;
};

export function IntegrationsScene({ initial = [], onComplete, onBack }: Props) {
  const [phase, setPhase] = useState<Phase>("greeting");
  const [configured, setConfigured] = useState<McpServer[]>([]);
  const [recommended, setRecommended] = useState<McpServer[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set(initial));

  useEffect(() => {
    fetch(`${AGENT_URL}/mcp/list`)
      .then((r) => r.json())
      .then((j) => {
        setConfigured(
          (j.configured || []).map((s: McpServer) => ({ ...s, configured: true })),
        );
        setRecommended(j.recommended || []);
      })
      .catch((e) => setError((e as Error).message));
  }, []);

  const guideState: CharacterState = useMemo(() => {
    if (phase === "greeting" || phase === "reacting") return "speaking";
    return "idle";
  }, [phase]);

  const guideMood: CharacterMood = useMemo(() => {
    if (phase === "reacting" || phase === "done") return "approving";
    return "neutral";
  }, [phase]);

  const greetingText =
    "Integrations are connections to the outside — Notion, Slack, GitHub, that kind of thing. Add the ones your agent will actually use. Most agents don't need many.";

  const toggle = useCallback((name: string) => {
    setSelected((s) => {
      const next = new Set(s);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      return next;
    });
  }, []);

  const submit = useCallback(() => setPhase("reacting"), []);
  const finalize = useCallback(() => setPhase("done"), []);
  const ship = useCallback(
    () => onComplete({ integrations: Array.from(selected) }),
    [selected, onComplete],
  );

  const reactionText = useMemo(() => {
    const count = selected.size;
    if (count === 0) return "No integrations. Pure inside-the-head agent. That's actually most of them.";
    if (count === 1) return "One integration. Focused.";
    return `${count} integrations. Make sure each one actually fits the job — agents with too many connections get distracted.`;
  }, [selected]);

  return (
    <div className="relative flex h-full w-full flex-col">
      <div className="flex flex-1 items-center justify-center overflow-y-auto px-8 py-10">
        <div className="w-full max-w-3xl">
          <AnimatePresence mode="wait">
            {phase === "picking" && (
              <motion.div
                key="picking"
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -12 }}
                transition={{ duration: 0.3 }}
                className="flex flex-col gap-4"
              >
                {error && (
                  <div className="rounded border border-red-900 bg-red-950/40 px-3 py-2 text-xs text-red-300">
                    couldn&apos;t reach the API: {error}
                  </div>
                )}
                {configured.length > 0 && (
                  <div>
                    <div className="mb-2 text-[10px] uppercase tracking-wider text-zinc-500">
                      Configured in this workspace
                    </div>
                    <div className="flex flex-col gap-1.5">
                      {configured.map((s) => (
                        <IntegrationRow
                          key={s.name}
                          server={s}
                          checked={selected.has(s.name)}
                          onToggle={toggle}
                        />
                      ))}
                    </div>
                  </div>
                )}
                {recommended.length > 0 && (
                  <div>
                    <div className="mb-2 text-[10px] uppercase tracking-wider text-zinc-500">
                      Recommended (not yet wired in this workspace)
                    </div>
                    <div className="flex flex-col gap-1.5">
                      {recommended.map((s) => (
                        <IntegrationRow
                          key={s.name}
                          server={s}
                          checked={selected.has(s.name)}
                          onToggle={toggle}
                          dim
                        />
                      ))}
                    </div>
                  </div>
                )}
                <div className="flex items-center justify-between pt-2">
                  <button
                    type="button"
                    onClick={onBack}
                    className="rounded border border-zinc-800 px-3 py-1.5 text-xs text-zinc-400 hover:bg-zinc-900"
                  >
                    ← Back
                  </button>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setSelected(new Set());
                        submit();
                      }}
                      className="rounded border border-zinc-800 px-3 py-1.5 text-xs text-zinc-500 hover:bg-zinc-900"
                    >
                      Skip
                    </button>
                    <button
                      type="button"
                      onClick={submit}
                      className="rounded bg-blue-600 px-4 py-1.5 text-xs font-semibold text-white transition hover:bg-blue-500"
                    >
                      Add them
                    </button>
                  </div>
                </div>
              </motion.div>
            )}

            {phase === "done" && (
              <motion.div
                key="done"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.4 }}
                className="flex flex-col items-center gap-4"
              >
                <div className="text-sm uppercase tracking-wider text-zinc-500">
                  integrations
                </div>
                <div className="text-2xl font-semibold text-zinc-100">
                  {selected.size === 0
                    ? "none"
                    : `${selected.size} wired`}
                </div>
                <button
                  type="button"
                  onClick={ship}
                  className="rounded bg-blue-600 px-5 py-2 text-sm font-semibold text-white transition hover:bg-blue-500"
                >
                  Send to your stable →
                </button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      <div className="pointer-events-none absolute bottom-8 left-8 right-8 flex items-end gap-4">
        <div className="pointer-events-auto shrink-0">
          <Character state={guideState} mood={guideMood} size={96} />
        </div>
        <div className="pointer-events-auto flex-1">
          {phase === "greeting" && (
            <Dialog
              text={greetingText}
              speakerName="Guide"
              onComplete={() => setPhase("picking")}
            />
          )}
          {phase === "reacting" && (
            <Dialog
              text={reactionText}
              speakerName="Guide"
              onComplete={finalize}
            />
          )}
        </div>
      </div>
    </div>
  );
}

function IntegrationRow({
  server,
  checked,
  onToggle,
  dim = false,
}: {
  server: McpServer;
  checked: boolean;
  onToggle: (name: string) => void;
  dim?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={() => onToggle(server.name)}
      className={`flex items-start gap-3 rounded-lg border px-3 py-2 text-left transition ${
        checked
          ? "border-blue-500 bg-blue-950/30"
          : `border-zinc-800 ${dim ? "opacity-70" : ""} bg-zinc-950 hover:border-zinc-700 hover:bg-zinc-900`
      }`}
    >
      <span
        className={`mt-0.5 inline-flex h-4 w-4 shrink-0 items-center justify-center rounded border ${
          checked
            ? "border-blue-500 bg-blue-500 text-white"
            : "border-zinc-700 bg-zinc-950"
        }`}
      >
        {checked && (
          <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
            <path d="M2 5 L4 7 L8 3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
        )}
      </span>
      <span className="flex-1">
        <span className="flex items-center gap-2">
          <span className="font-mono text-xs text-zinc-100">{server.name}</span>
          {server.category && (
            <span className="rounded bg-zinc-800 px-1.5 py-0.5 text-[9px] uppercase tracking-wider text-zinc-500">
              {server.category}
            </span>
          )}
        </span>
        <span className="mt-0.5 block text-xs text-zinc-500">
          {server.description}
        </span>
      </span>
    </button>
  );
}
