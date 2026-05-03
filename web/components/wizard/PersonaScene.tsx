"use client";
/**
 * Persona — wizard step 3 (the agent's idea / what it's for).
 *
 * Free-form text. The student writes a short prompt that becomes the
 * agent's system instructions: who it is, what it cares about, how it
 * behaves. Examples are visible to seed thought, not to constrain.
 */
import { motion, AnimatePresence } from "motion/react";
import { useCallback, useMemo, useState } from "react";
import { Character, type CharacterMood, type CharacterState } from "./Character";
import { Dialog } from "./Dialog";

const EXAMPLES = [
  {
    label: "A research companion",
    text: "You are a careful research companion. When given a topic, you find primary sources, summarize the spread of opinions, and tell me what's contested. You don't make things up.",
  },
  {
    label: "A coding pair",
    text: "You are my coding pair. You read code carefully before suggesting changes. You prefer the smallest fix that works. You ask me before doing anything that's hard to reverse.",
  },
  {
    label: "A patient explainer",
    text: "You explain things in plain language to someone who's smart but new to the topic. You start from what they probably already know and build outward. You pause for questions.",
  },
];

type Phase = "greeting" | "writing" | "reacting" | "done";

type Props = {
  initialPersona?: string;
  onComplete: (payload: { persona: string }) => void;
  onBack: () => void;
};

export function PersonaScene({ initialPersona, onComplete, onBack }: Props) {
  const [phase, setPhase] = useState<Phase>("greeting");
  const [text, setText] = useState(initialPersona || "");

  const guideState: CharacterState = useMemo(() => {
    if (phase === "greeting" || phase === "reacting") return "speaking";
    if (phase === "writing") return "thinking";
    return "idle";
  }, [phase]);

  const guideMood: CharacterMood = useMemo(() => {
    if (phase === "reacting" || phase === "done") return "approving";
    return "neutral";
  }, [phase]);

  const greetingText =
    "Now the idea. Tell it who it is and what it cares about. The brain you picked will follow this voice forever — or until you change it.";

  const trimmed = text.trim();
  const wordCount = trimmed ? trimmed.split(/\s+/).length : 0;

  const reactionText = useMemo(() => {
    if (!trimmed) return "";
    if (wordCount < 8) return "Short. Direct. Could work — short personas force the brain to fill in gaps. We'll see.";
    if (wordCount < 30) return "Good shape. Specific enough to behave consistently, loose enough to handle unexpected stuff.";
    return "Thorough. The agent will follow this closely. If it ends up too rigid, you can come back and trim.";
  }, [trimmed, wordCount]);

  const submit = useCallback(() => {
    if (!trimmed) return;
    setPhase("reacting");
  }, [trimmed]);

  const confirm = useCallback(() => {
    if (!trimmed) return;
    onComplete({ persona: trimmed });
  }, [trimmed, onComplete]);

  return (
    <div className="relative flex h-full w-full flex-col">
      <div className="flex flex-1 items-center justify-center px-8 py-10">
        <div className="w-full max-w-2xl">
          <AnimatePresence mode="wait">
            {phase === "writing" && (
              <motion.div
                key="writing"
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -12 }}
                transition={{ duration: 0.3 }}
                className="flex flex-col gap-4"
              >
                <textarea
                  autoFocus
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                  rows={6}
                  placeholder="who is this agent? what does it care about? how does it behave?"
                  className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-4 py-3 text-sm text-zinc-100 placeholder:text-zinc-600 focus:border-blue-500 focus:outline-none"
                />
                <div className="flex items-center justify-between">
                  <div className="text-[11px] uppercase tracking-wider text-zinc-600">
                    {wordCount} word{wordCount === 1 ? "" : "s"}
                  </div>
                  <div className="flex gap-2">
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
                      disabled={!trimmed}
                      className="rounded bg-blue-600 px-4 py-1.5 text-xs font-semibold text-white transition hover:bg-blue-500 disabled:cursor-not-allowed disabled:bg-zinc-800 disabled:text-zinc-500"
                    >
                      Set the idea
                    </button>
                  </div>
                </div>
                <div className="rounded border border-zinc-800 bg-zinc-950/50 p-3">
                  <div className="mb-2 text-[10px] uppercase tracking-wider text-zinc-600">
                    examples — click to use
                  </div>
                  <div className="flex flex-col gap-1.5">
                    {EXAMPLES.map((ex) => (
                      <button
                        key={ex.label}
                        type="button"
                        onClick={() => setText(ex.text)}
                        className="rounded px-2 py-1 text-left text-xs text-zinc-400 transition hover:bg-zinc-900 hover:text-zinc-200"
                      >
                        <span className="font-semibold text-zinc-300">
                          {ex.label}
                        </span>{" "}
                        — {ex.text.slice(0, 70)}…
                      </button>
                    ))}
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
                  the idea
                </div>
                <div className="max-w-xl rounded-lg border border-zinc-800 bg-zinc-950 px-5 py-4 text-sm italic text-zinc-300">
                  &ldquo;{trimmed}&rdquo;
                </div>
                <div className="mt-2 flex gap-3">
                  <button
                    type="button"
                    onClick={() => setPhase("writing")}
                    className="rounded border border-zinc-800 px-4 py-2 text-sm text-zinc-400 hover:bg-zinc-900"
                  >
                    Edit
                  </button>
                  <button
                    type="button"
                    onClick={confirm}
                    className="rounded bg-blue-600 px-5 py-2 text-sm font-semibold text-white transition hover:bg-blue-500"
                  >
                    Build a skill →
                  </button>
                </div>
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
              onComplete={() => setPhase("writing")}
            />
          )}
          {phase === "reacting" && (
            <Dialog
              text={reactionText}
              speakerName="Guide"
              onComplete={() => setPhase("done")}
            />
          )}
        </div>
      </div>
    </div>
  );
}
