"use client";
/**
 * Section 1 wizard shell.
 *
 * Owns the macro state machine, header chrome (step name, progress
 * dots, agent-being-built avatar, restart), and routes the active
 * step to its scene component. Each scene calls onComplete with its
 * payload; the machine accumulates the draft and transitions.
 */
import { useMachine } from "@xstate/react";
import { AnimatePresence, motion } from "motion/react";
import { BrainScene } from "./BrainScene";
import { EvolvedAvatar } from "./EvolvedAvatar";
import { HatchScene } from "./HatchScene";
import { IntegrationsScene } from "./IntegrationsScene";
import { PersonaScene } from "./PersonaScene";
import { SaveScene } from "./SaveScene";
import { SkillBuildScene } from "./SkillBuildScene";
import { ToolsScene } from "./ToolsScene";
import {
  STEP_ORDER,
  wizardMachine,
  type WizardStep,
} from "./wizardMachine";

const STEP_LABELS: Record<WizardStep, string> = {
  hatch: "Hatch",
  brain: "Brain",
  persona: "Idea",
  skill_build: "Skill",
  tools: "Tools",
  integrations: "Integrations",
  save: "Save",
};

export function WizardShell() {
  const [snapshot, send] = useMachine(wizardMachine);
  const draft = snapshot.context.draft;
  const currentStep = snapshot.value as WizardStep;
  const stepIndex = STEP_ORDER.indexOf(currentStep);
  const skillsForAvatar = draft.skill ? [{ name: draft.skill.name }] : [];

  return (
    <div className="relative flex h-full w-full flex-col bg-zinc-950">
      {/* Header chrome */}
      <header className="flex shrink-0 items-center justify-between border-b border-zinc-800 px-8 py-4">
        <div className="flex items-center gap-4">
          <div className="text-xs uppercase tracking-wider text-zinc-500">
            Section 1 · {STEP_LABELS[currentStep]}
          </div>
          {/* Progress dots */}
          <div className="flex items-center gap-1.5">
            {STEP_ORDER.map((s, i) => (
              <div
                key={s}
                className={`h-1.5 rounded-full transition-all ${
                  i < stepIndex
                    ? "w-3 bg-blue-500"
                    : i === stepIndex
                      ? "w-6 bg-blue-400"
                      : "w-3 bg-zinc-800"
                }`}
                title={STEP_LABELS[s]}
              />
            ))}
          </div>
        </div>
        <div className="flex items-center gap-3">
          <AnimatePresence>
            {draft.starter && (
              <motion.div
                key="agent-avatar"
                initial={{ opacity: 0, scale: 0.6, x: 20 }}
                animate={{ opacity: 1, scale: 1, x: 0 }}
                exit={{ opacity: 0, scale: 0.6 }}
                transition={{ type: "spring", duration: 0.5 }}
                className="flex items-center gap-2 rounded-full border border-zinc-700 bg-zinc-900 px-3 py-1"
              >
                <EvolvedAvatar
                  starter={draft.starter}
                  skills={skillsForAvatar}
                  size={28}
                />
                <span className="text-xs text-zinc-300">
                  {draft.name.trim() || "unnamed"}
                </span>
                {draft.provider && (
                  <span className="rounded bg-zinc-800 px-1.5 py-0.5 text-[9px] uppercase tracking-wider text-zinc-400">
                    {draft.provider}
                  </span>
                )}
              </motion.div>
            )}
          </AnimatePresence>
          <button
            type="button"
            onClick={() => send({ type: "RESTART" })}
            className="text-[11px] uppercase tracking-wider text-zinc-600 hover:text-zinc-400"
          >
            restart
          </button>
        </div>
      </header>

      {/* Active step scene */}
      <div className="relative flex-1 overflow-hidden">
        {currentStep === "hatch" && (
          <HatchScene
            draft={draft}
            onComplete={(payload) =>
              send({ type: "COMPLETE_HATCH", payload })
            }
          />
        )}
        {currentStep === "brain" && (
          <BrainScene
            onComplete={(payload) =>
              send({ type: "COMPLETE_BRAIN", payload })
            }
            onBack={() => send({ type: "BACK" })}
          />
        )}
        {currentStep === "persona" && (
          <PersonaScene
            initialPersona={draft.persona}
            onComplete={(payload) =>
              send({ type: "COMPLETE_PERSONA", payload })
            }
            onBack={() => send({ type: "BACK" })}
          />
        )}
        {currentStep === "skill_build" && (
          <SkillBuildScene
            initial={
              draft.skill
                ? {
                    name: draft.skill.name,
                    description: draft.skill.description,
                  }
                : undefined
            }
            onComplete={(payload) =>
              send({ type: "COMPLETE_SKILL", payload })
            }
            onBack={() => send({ type: "BACK" })}
          />
        )}
        {currentStep === "tools" && (
          <ToolsScene
            ownSkill={
              draft.skill
                ? {
                    name: draft.skill.name,
                    description: draft.skill.description,
                  }
                : undefined
            }
            initialTools={draft.tools}
            onComplete={(payload) =>
              send({ type: "COMPLETE_TOOLS", payload })
            }
            onBack={() => send({ type: "BACK" })}
          />
        )}
        {currentStep === "integrations" && (
          <IntegrationsScene
            initial={draft.integrations}
            onComplete={(payload) =>
              send({ type: "COMPLETE_INTEGRATIONS", payload })
            }
            onBack={() => send({ type: "BACK" })}
          />
        )}
        {currentStep === "save" && (
          <SaveScene
            draft={draft}
            onRestart={() => send({ type: "RESTART" })}
            onBack={() => send({ type: "BACK" })}
          />
        )}
      </div>
    </div>
  );
}
