"use client";
/**
 * Hatch — Section 1 wizard step 1 (identity first).
 *
 * Self-contained scene: picks starter form + name, with the guide
 * reacting at each beat. Calls onComplete with the hatch payload when
 * the student confirms. Does not own the wizard's outer chrome (header,
 * progress, agent avatar) — that's WizardShell's job.
 */
import { motion, AnimatePresence } from "motion/react";
import { useCallback, useMemo, useState } from "react";
import { Character, type CharacterMood, type CharacterState } from "./Character";
import { Dialog } from "./Dialog";
import { STARTERS, StarterPicker, type StarterSlug } from "./StarterSilhouette";
import type { WizardDraft } from "./wizardMachine";

type Phase =
  | "greeting"
  | "pickingStarter"
  | "reactingToStarter"
  | "naming"
  | "reactingToName"
  | "done";

const STARTER_REACTIONS: Record<StarterSlug, string> = {
  orb: "An Orb. Friendly. Doesn't pick fights. We'll see what it ends up being good at.",
  cube: "A Cube. You like things tidy. So does the Cube.",
  spark: "A Spark. Restless. Going to lose track of it the second you turn around.",
  loom: "A Loom. Slow to warm up. Worth it, usually.",
};

type Props = {
  draft: WizardDraft;
  onComplete: (payload: {
    name: string;
    starter: StarterSlug;
    hatchedAt: number;
  }) => void;
};

export function HatchScene({ draft, onComplete }: Props) {
  // If the student already has a hatched draft, skip to "done" so they
  // can pick up where they left off — but they can also Restart from
  // the shell to reset.
  const initialPhase: Phase = draft.hatchedAt && draft.starter ? "done" : "greeting";
  const [phase, setPhase] = useState<Phase>(initialPhase);
  const [name, setName] = useState(draft.name || "");
  const [starter, setStarter] = useState<StarterSlug | null>(draft.starter);

  const guideState: CharacterState = useMemo(() => {
    if (phase === "greeting" || phase === "reactingToStarter" || phase === "reactingToName")
      return "speaking";
    if (phase === "naming") return "thinking";
    return "idle";
  }, [phase]);

  const guideMood: CharacterMood = useMemo(() => {
    if (phase === "reactingToStarter") return "amused";
    if (phase === "reactingToName" || phase === "done") return "approving";
    return "neutral";
  }, [phase]);

  const greetingText =
    "We're going to build an agent. They're like little players you'll send out to do work — and you can build a whole stable of them. First step is hatching one.";

  const reactionToStarter = starter ? STARTER_REACTIONS[starter] : "";
  const trimmedName = name.trim();
  const reactionToName = trimmedName
    ? `${trimmedName}. Okay. ${trimmedName} it is. Empty inside still — no brain, no idea, no skills. We'll get to that.`
    : "";

  const pickStarter = useCallback((slug: StarterSlug) => {
    setStarter(slug);
    setPhase("reactingToStarter");
  }, []);

  const submitName = useCallback(() => {
    if (!trimmedName) return;
    setPhase("reactingToName");
  }, [trimmedName]);

  const finalize = useCallback(() => {
    if (!starter || !trimmedName) return;
    setPhase("done");
  }, [starter, trimmedName]);

  const selectedStarter = STARTERS.find((s) => s.slug === starter);

  return (
    <div className="relative flex h-full w-full flex-col">
      {/* Center column — choice surfaces */}
      <div className="flex flex-1 items-center justify-center px-8 py-10">
        <div className="w-full max-w-2xl">
          <AnimatePresence mode="wait">
            {phase === "pickingStarter" && (
              <motion.div
                key="picker"
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -12 }}
                transition={{ duration: 0.3 }}
              >
                <StarterPicker selected={starter} onPick={pickStarter} />
              </motion.div>
            )}

            {phase === "naming" && (
              <motion.div
                key="naming"
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -12 }}
                transition={{ duration: 0.3 }}
                className="flex flex-col items-center gap-3"
              >
                <input
                  autoFocus
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") submitName();
                  }}
                  placeholder="give it a name"
                  className="w-full max-w-md rounded-lg border border-zinc-700 bg-zinc-950 px-4 py-3 text-center text-lg text-zinc-100 placeholder:text-zinc-600 focus:border-blue-500 focus:outline-none"
                />
                <button
                  type="button"
                  onClick={submitName}
                  disabled={!trimmedName}
                  className="rounded bg-blue-600 px-4 py-1.5 text-sm font-semibold text-white transition hover:bg-blue-500 disabled:cursor-not-allowed disabled:bg-zinc-800 disabled:text-zinc-500"
                >
                  hatch
                </button>
              </motion.div>
            )}

            {phase === "done" && selectedStarter && (
              <motion.div
                key="done"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.4 }}
                className="flex flex-col items-center gap-6"
              >
                <motion.div
                  initial={{ y: 10 }}
                  animate={{ y: [0, -6, 0] }}
                  transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
                >
                  <svg viewBox="0 0 64 64" width="120" height="120">
                    {selectedStarter.svg}
                  </svg>
                </motion.div>
                <div className="text-2xl font-semibold text-zinc-100">
                  {trimmedName}
                </div>
                <button
                  type="button"
                  onClick={() =>
                    onComplete({
                      name: trimmedName,
                      starter: starter!,
                      hatchedAt: Date.now(),
                    })
                  }
                  className="rounded bg-blue-600 px-5 py-2 text-sm font-semibold text-white transition hover:bg-blue-500"
                >
                  Pick a brain →
                </button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* Bottom-left — guide character + dialog */}
      <div className="pointer-events-none absolute bottom-8 left-8 right-8 flex items-end gap-4">
        <div className="pointer-events-auto shrink-0">
          <Character state={guideState} mood={guideMood} size={96} />
        </div>
        <div className="pointer-events-auto flex-1">
          {phase === "greeting" && (
            <Dialog
              text={greetingText}
              speakerName="Guide"
              onComplete={() => setPhase("pickingStarter")}
            />
          )}
          {phase === "reactingToStarter" && (
            <Dialog
              text={reactionToStarter}
              speakerName="Guide"
              onComplete={() => setPhase("naming")}
            />
          )}
          {phase === "reactingToName" && (
            <Dialog
              text={reactionToName}
              speakerName="Guide"
              onComplete={finalize}
            />
          )}
        </div>
      </div>
    </div>
  );
}
