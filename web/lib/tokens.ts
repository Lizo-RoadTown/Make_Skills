/**
 * Design tokens — TypeScript companion to globals.css.
 *
 * The CSS file is the source of truth for actual values (Tailwind v4
 * `@theme inline` generates utility classes from it). This module
 * exists for JS-side consumers: animation durations, dynamic class
 * lookups by state name, sizing scales referenced in motion configs.
 *
 * If you add a new token here, mirror it in globals.css. If you only
 * need it in markup, prefer Tailwind utilities (e.g. `bg-correct-soft`)
 * over importing from this file.
 */

// Semantic state names — mirror docs/UX_CONTRACT.md.
export type SemanticState =
  | "candidate"     // selected, unjudged. Suboptimal-but-valid shares this.
  | "correct"       // the agent is doing its job
  | "active"        // what's being worked on right now
  | "invalid";      // blocked, retry required

/**
 * Tailwind class fragments per state. Compose into a className like:
 *   `inline-flex rounded px-2 py-1 ${semanticClasses.correct.full}`
 *
 * Each state has three variants:
 *   .full   = bg-soft + border-edge + text — the "filled card" treatment
 *   .text   = just text-* — for inline text spans
 *   .chip   = bg + text — solid, no border, for compact chips
 */
export const semanticClasses: Record<
  SemanticState,
  { full: string; text: string; chip: string }
> = {
  candidate: {
    full: "bg-candidate-soft border border-candidate-edge text-candidate",
    text: "text-candidate",
    chip: "bg-candidate text-candidate-soft",
  },
  correct: {
    full: "bg-correct-soft border border-correct-edge text-correct",
    text: "text-correct",
    chip: "bg-correct text-correct-soft",
  },
  active: {
    full: "bg-active-soft border border-active-edge text-active",
    text: "text-active",
    chip: "bg-active text-active-soft",
  },
  invalid: {
    full: "bg-invalid-soft border border-invalid-edge text-invalid",
    text: "text-invalid",
    chip: "bg-invalid text-invalid-soft",
  },
};

/**
 * Animation budget — per UX_CONTRACT.md.
 * Durations in milliseconds. Use these in motion configs so the cadence
 * stays consistent across surfaces.
 */
export const motion = {
  /** State changes (button press feedback, focus rings appearing) */
  instant: 150,
  /** Most UI transitions */
  short: 200,
  /** Larger transitions (page transitions, modal open) */
  medium: 300,
  /** Choice / scene swaps — animations that need to feel deliberate */
  long: 450,
} as const;

/**
 * Spacing rhythm — tight, default, loose.
 * Maps to Tailwind's spacing scale; only useful when you need to refer
 * to spacing by intent rather than by number.
 */
export const spacing = {
  tight: "gap-1.5 p-2",
  default: "gap-3 p-4",
  loose: "gap-6 p-6",
} as const;
