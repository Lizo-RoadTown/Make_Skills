/**
 * Section 1 wizard state machine — XState v5.
 *
 * Models the macro progression across wizard steps. Each step
 * component manages its own internal phases (typewriter beats, choice
 * UI) — this machine cares about step boundaries, the draft being
 * accumulated, and back/forward transitions.
 *
 * Steps:
 *   hatch        — name + starter form (identity first)
 *   brain        — pick LLM provider
 *   persona      — write the agent's idea/purpose
 *   skill_build  — build a first skill (centerpiece, multi-screen)
 *   tools        — wire skills as tools
 *   integrations — pick MCP servers
 *   save         — name finalize + commit to bucket
 *
 * Draft persists to localStorage on every COMPLETE_STEP.
 */
import { assign, setup } from "xstate";

import type { StarterSlug } from "./StarterSilhouette";

export type WizardDraft = {
  // Hatch
  name: string;
  starter: StarterSlug | null;
  hatchedAt?: number;
  // Brain
  provider?: string;
  model?: string;
  // Persona
  persona?: string;
  // Skill (placeholder shape — refined when we build the step)
  skill?: {
    name: string;
    description: string;
    body: string;
  };
  // Tools / integrations (shape TBD; arrays of slugs for now)
  tools?: string[];
  integrations?: string[];
};

export type WizardStep =
  | "hatch"
  | "brain"
  | "persona"
  | "skill_build"
  | "tools"
  | "integrations"
  | "save";

export const STEP_ORDER: WizardStep[] = [
  "hatch",
  "brain",
  "persona",
  "skill_build",
  "tools",
  "integrations",
  "save",
];

const DRAFT_KEY = "make_skills.agent_draft.v1";

function loadDraft(): WizardDraft {
  if (typeof window === "undefined") return { name: "", starter: null };
  try {
    const raw = window.localStorage.getItem(DRAFT_KEY);
    if (raw) return JSON.parse(raw);
  } catch {}
  return { name: "", starter: null };
}

function saveDraft(d: WizardDraft) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(DRAFT_KEY, JSON.stringify(d));
  } catch {}
}

export type WizardEvent =
  | { type: "COMPLETE_HATCH"; payload: Pick<WizardDraft, "name" | "starter" | "hatchedAt"> }
  | { type: "COMPLETE_BRAIN"; payload: Pick<WizardDraft, "provider" | "model"> }
  | { type: "COMPLETE_PERSONA"; payload: { persona: string } }
  | { type: "COMPLETE_SKILL"; payload: { skill: NonNullable<WizardDraft["skill"]> } }
  | { type: "COMPLETE_TOOLS"; payload: { tools: string[] } }
  | { type: "COMPLETE_INTEGRATIONS"; payload: { integrations: string[] } }
  | { type: "BACK" }
  | { type: "RESTART" };

export const wizardMachine = setup({
  types: {
    context: {} as { draft: WizardDraft },
    events: {} as WizardEvent,
  },
  actions: {
    persist: ({ context }) => saveDraft(context.draft),
    reset: assign({ draft: () => ({ name: "", starter: null }) }),
  },
}).createMachine({
  id: "wizard",
  initial: "hatch",
  context: () => ({ draft: loadDraft() }),
  states: {
    hatch: {
      on: {
        COMPLETE_HATCH: {
          target: "brain",
          actions: [
            assign({
              draft: ({ context, event }) => ({ ...context.draft, ...event.payload }),
            }),
            "persist",
          ],
        },
        RESTART: { target: "hatch", actions: ["reset", "persist"] },
      },
    },
    brain: {
      on: {
        COMPLETE_BRAIN: {
          target: "persona",
          actions: [
            assign({
              draft: ({ context, event }) => ({ ...context.draft, ...event.payload }),
            }),
            "persist",
          ],
        },
        BACK: "hatch",
        RESTART: { target: "hatch", actions: ["reset", "persist"] },
      },
    },
    persona: {
      on: {
        COMPLETE_PERSONA: {
          target: "skill_build",
          actions: [
            assign({
              draft: ({ context, event }) => ({
                ...context.draft,
                persona: event.payload.persona,
              }),
            }),
            "persist",
          ],
        },
        BACK: "brain",
        RESTART: { target: "hatch", actions: ["reset", "persist"] },
      },
    },
    skill_build: {
      on: {
        COMPLETE_SKILL: {
          target: "tools",
          actions: [
            assign({
              draft: ({ context, event }) => ({
                ...context.draft,
                skill: event.payload.skill,
              }),
            }),
            "persist",
          ],
        },
        BACK: "persona",
        RESTART: { target: "hatch", actions: ["reset", "persist"] },
      },
    },
    tools: {
      on: {
        COMPLETE_TOOLS: {
          target: "integrations",
          actions: [
            assign({
              draft: ({ context, event }) => ({
                ...context.draft,
                tools: event.payload.tools,
              }),
            }),
            "persist",
          ],
        },
        BACK: "skill_build",
        RESTART: { target: "hatch", actions: ["reset", "persist"] },
      },
    },
    integrations: {
      on: {
        COMPLETE_INTEGRATIONS: {
          target: "save",
          actions: [
            assign({
              draft: ({ context, event }) => ({
                ...context.draft,
                integrations: event.payload.integrations,
              }),
            }),
            "persist",
          ],
        },
        BACK: "tools",
        RESTART: { target: "hatch", actions: ["reset", "persist"] },
      },
    },
    save: {
      on: {
        BACK: "integrations",
        RESTART: { target: "hatch", actions: ["reset", "persist"] },
      },
    },
  },
});
