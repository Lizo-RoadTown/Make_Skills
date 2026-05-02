"use client";
/**
 * Save — wizard step 7. The agent ships to the student's stable.
 *
 * v1: persists to localStorage `make_skills.agents.v1`. The /agents
 * page reads this list and merges with bundled presets. Future: POST
 * to /agents/create which writes a `user_agents` row keyed off the
 * caller's tenant_id.
 */
import { motion } from "motion/react";
import { useCallback, useMemo, useState } from "react";
import Link from "next/link";
import { Character } from "./Character";
import { Dialog } from "./Dialog";
import { EvolvedAvatar } from "./EvolvedAvatar";
import type { WizardDraft } from "./wizardMachine";

const AGENTS_KEY = "make_skills.agents.v1";
const DRAFT_KEY = "make_skills.agent_draft.v1";

type StoredAgent = WizardDraft & { id: string; savedAt: number };

function loadAgents(): StoredAgent[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(AGENTS_KEY);
    if (raw) return JSON.parse(raw);
  } catch {}
  return [];
}

function saveAgent(draft: WizardDraft): StoredAgent {
  const agents = loadAgents();
  const stored: StoredAgent = {
    ...draft,
    id: `agent_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    savedAt: Date.now(),
  };
  agents.unshift(stored);
  try {
    window.localStorage.setItem(AGENTS_KEY, JSON.stringify(agents));
    window.localStorage.removeItem(DRAFT_KEY);
  } catch {}
  return stored;
}

type Props = {
  draft: WizardDraft;
  onRestart: () => void;
  onBack: () => void;
};

type Phase = "greeting" | "reviewing" | "saving" | "saved";

export function SaveScene({ draft, onRestart, onBack }: Props) {
  const [phase, setPhase] = useState<Phase>("greeting");
  const [savedId, setSavedId] = useState<string | null>(null);

  const skillsForAvatar = useMemo(
    () => (draft.skill ? [{ name: draft.skill.name }] : []),
    [draft.skill],
  );

  const greetingText = `Here's ${draft.name?.trim() || "your agent"}. Take a look. If it's right, send it to your stable.`;

  const ship = useCallback(() => {
    setPhase("saving");
    const stored = saveAgent(draft);
    setSavedId(stored.id);
    // Small pause so the celebration animation feels intentional
    setTimeout(() => setPhase("saved"), 400);
  }, [draft]);

  return (
    <div className="relative flex h-full w-full flex-col">
      <div className="flex flex-1 items-center justify-center overflow-y-auto px-8 py-10">
        <div className="w-full max-w-2xl">
          {phase === "reviewing" && (
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3 }}
              className="flex flex-col items-center gap-6"
            >
              <EvolvedAvatar
                starter={draft.starter}
                skills={skillsForAvatar}
                size={160}
                animated
              />
              <div className="text-center">
                <div className="text-2xl font-semibold text-zinc-100">
                  {draft.name?.trim()}
                </div>
                {draft.provider && (
                  <div className="mt-1 font-mono text-xs text-zinc-500">
                    brain: {draft.provider}
                    {draft.model ? ` · ${draft.model}` : ""}
                  </div>
                )}
              </div>
              <div className="w-full rounded-lg border border-zinc-800 bg-zinc-950/50 px-5 py-4">
                <Row label="idea">
                  <span className="italic text-zinc-300">
                    &ldquo;{draft.persona || "—"}&rdquo;
                  </span>
                </Row>
                <Row label="skill">
                  {draft.skill ? (
                    <span className="font-mono text-zinc-200">
                      {draft.skill.name}
                    </span>
                  ) : (
                    <span className="text-zinc-600">—</span>
                  )}
                </Row>
                <Row label="tools">
                  <span className="text-zinc-300">
                    {draft.tools?.length || 0} wired
                  </span>
                </Row>
                <Row label="integrations">
                  <span className="text-zinc-300">
                    {draft.integrations?.length || 0} wired
                  </span>
                </Row>
              </div>
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={onBack}
                  className="rounded border border-zinc-800 px-4 py-2 text-sm text-zinc-400 hover:bg-zinc-900"
                >
                  ← Back
                </button>
                <button
                  type="button"
                  onClick={ship}
                  className="rounded bg-blue-600 px-6 py-2 text-sm font-semibold text-white transition hover:bg-blue-500"
                >
                  Send to your stable
                </button>
              </div>
            </motion.div>
          )}

          {phase === "saving" && (
            <motion.div
              initial={{ scale: 0.9 }}
              animate={{ scale: [1, 1.1, 1], rotate: [0, 5, -5, 0] }}
              transition={{ duration: 0.6 }}
              className="flex flex-col items-center gap-4"
            >
              <EvolvedAvatar
                starter={draft.starter}
                skills={skillsForAvatar}
                size={180}
              />
              <div className="text-sm uppercase tracking-wider text-blue-400">
                shipping…
              </div>
            </motion.div>
          )}

          {phase === "saved" && (
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.4 }}
              className="flex flex-col items-center gap-6"
            >
              <motion.div
                animate={{ y: [0, -6, 0] }}
                transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
              >
                <EvolvedAvatar
                  starter={draft.starter}
                  skills={skillsForAvatar}
                  size={140}
                />
              </motion.div>
              <div className="text-center">
                <div className="text-2xl font-semibold text-zinc-100">
                  {draft.name?.trim()}
                </div>
                <div className="mt-1 text-xs uppercase tracking-wider text-blue-400">
                  in your stable
                </div>
              </div>
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={onRestart}
                  className="rounded border border-zinc-800 px-4 py-2 text-sm text-zinc-300 hover:bg-zinc-900"
                >
                  Hatch another
                </button>
                <Link
                  href="/agents"
                  className="rounded bg-blue-600 px-5 py-2 text-sm font-semibold text-white transition hover:bg-blue-500"
                >
                  View your stable →
                </Link>
              </div>
              {savedId && (
                <div className="text-[10px] font-mono text-zinc-700">
                  {savedId}
                </div>
              )}
            </motion.div>
          )}
        </div>
      </div>

      {phase === "greeting" && (
        <div className="pointer-events-none absolute bottom-8 left-8 right-8 flex items-end gap-4">
          <div className="pointer-events-auto shrink-0">
            <Character state="speaking" mood="approving" size={96} />
          </div>
          <div className="pointer-events-auto flex-1">
            <Dialog
              text={greetingText}
              speakerName="Guide"
              onComplete={() => setPhase("reviewing")}
            />
          </div>
        </div>
      )}
    </div>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-baseline gap-3 border-b border-zinc-900 py-2 last:border-0">
      <div className="w-28 shrink-0 text-[10px] uppercase tracking-wider text-zinc-500">
        {label}
      </div>
      <div className="flex-1 text-sm">{children}</div>
    </div>
  );
}
