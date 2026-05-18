"use client";
/**
 * Save — wizard step 7. The agent ships to the student's stable.
 *
 * Posts to /agents/create. The backend writes user_agents + child
 * student_skills + student_integrations rows in a single transaction
 * scoped by tenant. Draft localStorage is cleared on success so the
 * wizard starts fresh next time.
 */
import { motion } from "motion/react";
import { useCallback, useMemo, useState } from "react";
import Link from "next/link";
import { Character } from "./Character";
import { Dialog } from "./Dialog";
import { EvolvedAvatar } from "./EvolvedAvatar";
import type { WizardDraft } from "./wizardMachine";

const AGENT_URL = process.env.NEXT_PUBLIC_AGENT_URL || "http://localhost:8001";
const DRAFT_KEY = "make_skills.agent_draft.v1";

async function persistAgent(draft: WizardDraft): Promise<{ id: string }> {
  const payload = {
    name: draft.name.trim(),
    starter: draft.starter,
    provider: draft.provider,
    model: draft.model || null,
    persona: draft.persona || null,
    skills: draft.skill
      ? [
          {
            name: draft.skill.name,
            description: draft.skill.description,
            body_md: draft.skill.body,
          },
        ]
      : [],
    integrations: (draft.integrations || []).map((slug) => ({
      mcp_server_slug: slug,
      config: {},
    })),
  };
  const res = await fetch(`${AGENT_URL}/agents/create`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(`save failed (${res.status}): ${detail.slice(0, 200)}`);
  }
  const data = await res.json();
  try {
    window.localStorage.removeItem(DRAFT_KEY);
  } catch {}
  return { id: data.id };
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
  const [saveError, setSaveError] = useState<string | null>(null);

  const skillsForAvatar = useMemo(
    () => (draft.skill ? [{ name: draft.skill.name }] : []),
    [draft.skill],
  );

  const greetingText = `Here's ${draft.name?.trim() || "your agent"}. Take a look. If it's right, send it to your stable.`;

  const ship = useCallback(async () => {
    setPhase("saving");
    setSaveError(null);
    try {
      const { id } = await persistAgent(draft);
      setSavedId(id);
      // Small pause so the celebration animation feels intentional
      setTimeout(() => setPhase("saved"), 400);
    } catch (e) {
      setSaveError((e as Error).message);
      setPhase("reviewing");
    }
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
                <div className="text-2xl font-semibold text-text">
                  {draft.name?.trim()}
                </div>
                {draft.provider && (
                  <div className="mt-1 font-mono text-xs text-text-subtle">
                    brain: {draft.provider}
                    {draft.model ? ` · ${draft.model}` : ""}
                  </div>
                )}
              </div>
              <div className="w-full rounded-lg border border-zinc-800 bg-zinc-950/50 px-5 py-4">
                <Row label="idea">
                  <span className="italic text-text-muted">
                    &ldquo;{draft.persona || "—"}&rdquo;
                  </span>
                </Row>
                <Row label="skill">
                  {draft.skill ? (
                    <span className="font-mono text-text">
                      {draft.skill.name}
                    </span>
                  ) : (
                    <span className="text-text-dim">—</span>
                  )}
                </Row>
                <Row label="tools">
                  <span className="text-text-muted">
                    {draft.tools?.length || 0} wired
                  </span>
                </Row>
                <Row label="integrations">
                  <span className="text-text-muted">
                    {draft.integrations?.length || 0} wired
                  </span>
                </Row>
              </div>
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={onBack}
                  className="rounded border border-zinc-800 px-4 py-2 text-sm text-text-muted hover:bg-zinc-900"
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
              {saveError && (
                <div className="mt-3 max-w-md rounded border border-red-900 bg-red-950/40 px-3 py-2 text-xs text-red-300">
                  Save failed: {saveError}
                </div>
              )}
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
                <div className="text-2xl font-semibold text-text">
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
                  className="rounded border border-zinc-800 px-4 py-2 text-sm text-text-muted hover:bg-zinc-900"
                >
                  Hatch another
                </button>
                <Link
                  href="/agents"
                  className="rounded border border-zinc-800 px-4 py-2 text-sm text-text-muted hover:bg-zinc-900"
                >
                  View your stable
                </Link>
                {savedId && (
                  <Link
                    href={`/chat/${savedId}`}
                    className="rounded bg-blue-600 px-5 py-2 text-sm font-semibold text-white transition hover:bg-blue-500"
                  >
                    Chat with {draft.name?.trim() || "it"} →
                  </Link>
                )}
              </div>
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
      <div className="w-28 shrink-0 text-[10px] uppercase tracking-wider text-text-subtle">
        {label}
      </div>
      <div className="flex-1 text-sm">{children}</div>
    </div>
  );
}
