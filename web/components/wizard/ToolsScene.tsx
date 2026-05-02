"use client";
/**
 * Tools — wizard step 5.
 *
 * The student wires their freshly-written skill (and any bundled
 * workspace skills they want) as TOOLS the agent can call. This is the
 * conceptual bridge: a skill is a recipe (markdown); a tool is the
 * callable version — what the agent reaches for during a run.
 */
import { motion, AnimatePresence } from "motion/react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Character, type CharacterMood, type CharacterState } from "./Character";
import { Dialog } from "./Dialog";

const AGENT_URL = process.env.NEXT_PUBLIC_AGENT_URL || "http://localhost:8001";

type BundledSkill = {
  path: string;
  name: string;
  description: string;
};

type Phase = "greeting" | "picking" | "reacting" | "done";

type Props = {
  ownSkill?: { name: string; description: string };
  initialTools?: string[];
  onComplete: (payload: { tools: string[] }) => void;
  onBack: () => void;
};

export function ToolsScene({ ownSkill, initialTools = [], onComplete, onBack }: Props) {
  const [phase, setPhase] = useState<Phase>("greeting");
  const [bundled, setBundled] = useState<BundledSkill[]>([]);
  const [error, setError] = useState<string | null>(null);
  // Tool slugs — own skill is auto-checked. Bundled skills toggle on/off.
  const [selected, setSelected] = useState<Set<string>>(() => {
    const init = new Set(initialTools);
    if (ownSkill) init.add(`own:${ownSkill.name}`);
    return init;
  });

  useEffect(() => {
    fetch(`${AGENT_URL}/skills/list`)
      .then((r) => r.json())
      .then((j) => setBundled(j.skills || []))
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

  const greetingText = ownSkill
    ? `${ownSkill.name} is the first tool. The workspace ships with some pre-written skills too — pick any that fit. Skipping is fine; you can always come back.`
    : "Pick the skills your agent gets to call. The bundled ones are starting points — eventually you'll write more of your own.";

  const toggle = useCallback((slug: string) => {
    setSelected((s) => {
      const next = new Set(s);
      if (next.has(slug)) next.delete(slug);
      else next.add(slug);
      return next;
    });
  }, []);

  const submit = useCallback(() => {
    setPhase("reacting");
  }, []);

  const finalize = useCallback(() => {
    setPhase("done");
  }, []);

  const ship = useCallback(() => {
    onComplete({ tools: Array.from(selected) });
  }, [selected, onComplete]);

  const reactionText = useMemo(() => {
    const count = selected.size;
    if (count === 0) return "Zero tools. The agent will be a conversationalist with no hands. That's a real choice — sometimes that's what you want.";
    if (count === 1) return "One tool. Specialist agent. It'll be very good at exactly one thing.";
    if (count <= 3) return `${count} tools. Reasonable spread — enough variety, not so much the agent gets confused about which to reach for.`;
    return `${count} tools. Lots of options. The description on each one matters even more now — that's how the agent decides which to reach for.`;
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
                className="flex flex-col gap-3"
              >
                {ownSkill && (
                  <div>
                    <div className="mb-2 text-[10px] uppercase tracking-wider text-zinc-500">
                      Your skill
                    </div>
                    <ToolRow
                      slug={`own:${ownSkill.name}`}
                      label={ownSkill.name}
                      description={ownSkill.description}
                      checked={selected.has(`own:${ownSkill.name}`)}
                      onToggle={toggle}
                      highlight
                    />
                  </div>
                )}
                <div>
                  <div className="mb-2 mt-2 text-[10px] uppercase tracking-wider text-zinc-500">
                    Bundled skills
                  </div>
                  {error && (
                    <div className="mb-2 rounded border border-red-900 bg-red-950/40 px-3 py-2 text-xs text-red-300">
                      couldn&apos;t reach the API: {error}
                    </div>
                  )}
                  <div className="flex flex-col gap-1.5">
                    {bundled.map((s) => (
                      <ToolRow
                        key={s.path}
                        slug={`bundled:${s.path}`}
                        label={s.name}
                        description={s.description || s.path}
                        checked={selected.has(`bundled:${s.path}`)}
                        onToggle={toggle}
                      />
                    ))}
                    {bundled.length === 0 && !error && (
                      <div className="text-xs text-zinc-600">loading…</div>
                    )}
                  </div>
                </div>
                <div className="flex items-center justify-between pt-2">
                  <button
                    type="button"
                    onClick={onBack}
                    className="rounded border border-zinc-800 px-3 py-1.5 text-xs text-zinc-400 hover:bg-zinc-900"
                  >
                    ← Back
                  </button>
                  <button
                    type="button"
                    onClick={submit}
                    className="rounded bg-blue-600 px-4 py-1.5 text-xs font-semibold text-white transition hover:bg-blue-500"
                  >
                    Wire them up
                  </button>
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
                  toolbelt
                </div>
                <div className="text-2xl font-semibold text-zinc-100">
                  {selected.size} tool{selected.size === 1 ? "" : "s"}
                </div>
                <button
                  type="button"
                  onClick={ship}
                  className="rounded bg-blue-600 px-5 py-2 text-sm font-semibold text-white transition hover:bg-blue-500"
                >
                  Add integrations →
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

function ToolRow({
  slug,
  label,
  description,
  checked,
  onToggle,
  highlight = false,
}: {
  slug: string;
  label: string;
  description: string;
  checked: boolean;
  onToggle: (slug: string) => void;
  highlight?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={() => onToggle(slug)}
      className={`flex items-start gap-3 rounded-lg border px-3 py-2 text-left transition ${
        checked
          ? highlight
            ? "border-blue-500 bg-blue-950/30"
            : "border-zinc-600 bg-zinc-900"
          : "border-zinc-800 bg-zinc-950 hover:border-zinc-700 hover:bg-zinc-900"
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
        <span className="block font-mono text-xs text-zinc-100">{label}</span>
        <span className="mt-0.5 block text-xs text-zinc-500">{description}</span>
      </span>
    </button>
  );
}
