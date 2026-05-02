"use client";
/**
 * Four starter silhouettes for the Hatch step. Abstract SVG forms — no
 * commissioned art yet — each with a one-line dry tagline. Picking
 * doesn't lock the agent's eventual capabilities; it's an aesthetic +
 * tonal choice that the guide reacts to.
 */
import { motion } from "motion/react";
import type { ReactElement } from "react";

export type StarterSlug = "orb" | "cube" | "spark" | "loom";

export type Starter = {
  slug: StarterSlug;
  label: string;
  tagline: string;
  svg: ReactElement;
};

export const STARTERS: Starter[] = [
  {
    slug: "orb",
    label: "Orb",
    tagline: "Round, easy-going. A generalist.",
    svg: (
      <g>
        <circle cx="32" cy="32" r="20" fill="#1e3a8a" stroke="#3b82f6" strokeWidth="1.5" />
        <circle cx="26" cy="26" r="3" fill="#bfdbfe" opacity="0.6" />
      </g>
    ),
  },
  {
    slug: "cube",
    label: "Cube",
    tagline: "Square. Methodical. Likes structure.",
    svg: (
      <g>
        <rect x="14" y="14" width="36" height="36" rx="3" fill="#3f3f46" stroke="#a1a1aa" strokeWidth="1.5" />
        <line x1="14" y1="26" x2="50" y2="26" stroke="#a1a1aa" strokeWidth="1" opacity="0.5" />
        <line x1="26" y1="14" x2="26" y2="50" stroke="#a1a1aa" strokeWidth="1" opacity="0.5" />
      </g>
    ),
  },
  {
    slug: "spark",
    label: "Spark",
    tagline: "Pointy, restless. Always halfway out the door.",
    svg: (
      <g>
        <polygon
          points="32,8 38,26 56,32 38,38 32,56 26,38 8,32 26,26"
          fill="#7c2d12"
          stroke="#f97316"
          strokeWidth="1.5"
        />
      </g>
    ),
  },
  {
    slug: "loom",
    label: "Loom",
    tagline: "Lattice. Slow to start, hard to break.",
    svg: (
      <g>
        <rect x="14" y="14" width="36" height="36" fill="#14532d" stroke="#22c55e" strokeWidth="1.5" />
        <line x1="14" y1="26" x2="50" y2="26" stroke="#22c55e" strokeWidth="1" opacity="0.6" />
        <line x1="14" y1="38" x2="50" y2="38" stroke="#22c55e" strokeWidth="1" opacity="0.6" />
        <line x1="26" y1="14" x2="26" y2="50" stroke="#22c55e" strokeWidth="1" opacity="0.6" />
        <line x1="38" y1="14" x2="38" y2="50" stroke="#22c55e" strokeWidth="1" opacity="0.6" />
      </g>
    ),
  },
];

type Props = {
  selected: StarterSlug | null;
  onPick: (slug: StarterSlug) => void;
};

export function StarterPicker({ selected, onPick }: Props) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      {STARTERS.map((s, i) => {
        const isSelected = selected === s.slug;
        return (
          <motion.button
            key={s.slug}
            type="button"
            onClick={() => onPick(s.slug)}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.08 * i, duration: 0.3 }}
            whileHover={{ scale: 1.03 }}
            whileTap={{ scale: 0.98 }}
            className={`flex flex-col items-center gap-2 rounded-lg border p-4 text-left transition ${
              isSelected
                ? "border-blue-500 bg-zinc-900 shadow-[0_0_0_1px_rgb(59,130,246)]"
                : "border-zinc-800 bg-zinc-950 hover:border-zinc-700 hover:bg-zinc-900"
            }`}
          >
            <svg viewBox="0 0 64 64" width="64" height="64">
              {s.svg}
            </svg>
            <div className="text-sm font-semibold text-zinc-100">{s.label}</div>
            <div className="text-[11px] leading-snug text-zinc-500">{s.tagline}</div>
          </motion.button>
        );
      })}
    </div>
  );
}
