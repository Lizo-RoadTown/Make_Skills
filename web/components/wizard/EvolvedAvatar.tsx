"use client";
/**
 * The agent-being-built avatar — starter silhouette + per-skill marks.
 *
 * v1 implementation: deterministic decoration. Each skill in the
 * student's draft contributes a small sigil placed at a hash-derived
 * angle around the silhouette. Two students who pick the same starter
 * and write skills with different names get visually different
 * creatures.
 *
 * This component is the architectural seam for the evolving-creature
 * vision. Later it'll be replaced with a procedural / genetic engine;
 * the prop surface (`starter`, `skills`, `size`) stays stable so the
 * wizard, header avatar, and future "your stable" page don't change.
 */
import { motion } from "motion/react";
import type { ReactElement } from "react";
import { STARTERS, type StarterSlug } from "./StarterSilhouette";

type Props = {
  starter: StarterSlug | null;
  skills: { name: string }[];
  size?: number;
  /** Whether to gently bob — useful on the final / save screens. */
  animated?: boolean;
};

// Cheap deterministic hash — good enough for placing decoration.
function hash(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) {
    h = (h * 31 + s.charCodeAt(i)) | 0;
  }
  return Math.abs(h);
}

const MARK_COLORS = ["#fde047", "#86efac", "#7dd3fc", "#fda4af", "#c4b5fd", "#fdba74"];

function SkillMark({ skill, index, total }: { skill: { name: string }; index: number; total: number }) {
  const h = hash(skill.name + index);
  // Distribute marks around the silhouette. Slight jitter on radius.
  const baseAngle = (index / Math.max(total, 1)) * Math.PI * 2 - Math.PI / 2;
  const jitter = ((h % 60) - 30) * (Math.PI / 180);
  const angle = baseAngle + jitter;
  const radius = 28 + (h % 5);
  const cx = 32 + Math.cos(angle) * radius;
  const cy = 32 + Math.sin(angle) * radius;
  const color = MARK_COLORS[h % MARK_COLORS.length];
  const shapeKind = h % 3;

  return (
    <motion.g
      initial={{ opacity: 0, scale: 0 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ delay: 0.1 * index, type: "spring", stiffness: 200 }}
    >
      {shapeKind === 0 && (
        <circle cx={cx} cy={cy} r={2.5} fill={color} stroke="#0a0a0a" strokeWidth="0.5" />
      )}
      {shapeKind === 1 && (
        <rect
          x={cx - 2}
          y={cy - 2}
          width={4}
          height={4}
          fill={color}
          stroke="#0a0a0a"
          strokeWidth="0.5"
          transform={`rotate(${(h % 90)} ${cx} ${cy})`}
        />
      )}
      {shapeKind === 2 && (
        <polygon
          points={`${cx},${cy - 3} ${cx + 2.6},${cy + 1.5} ${cx - 2.6},${cy + 1.5}`}
          fill={color}
          stroke="#0a0a0a"
          strokeWidth="0.5"
        />
      )}
    </motion.g>
  );
}

export function EvolvedAvatar({ starter, skills, size = 64, animated = false }: Props) {
  const starterDef = STARTERS.find((s) => s.slug === starter);
  if (!starterDef) {
    // No starter yet — render an empty placeholder dot.
    return <div className="rounded-full bg-zinc-800" style={{ width: size, height: size }} />;
  }

  const visibleSkills = skills.slice(0, 8); // cap visible marks; can stack later

  const inner: ReactElement = (
    <svg viewBox="0 0 64 64" width={size} height={size}>
      {starterDef.svg}
      {visibleSkills.map((sk, i) => (
        <SkillMark key={sk.name + i} skill={sk} index={i} total={visibleSkills.length} />
      ))}
    </svg>
  );

  if (!animated) return inner;

  return (
    <motion.div
      animate={{ y: [0, -4, 0] }}
      transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
    >
      {inner}
    </motion.div>
  );
}
