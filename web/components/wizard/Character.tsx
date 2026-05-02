"use client";
/**
 * Wizard guide character — SVG implementation today.
 *
 * This component is an architectural seam. Today it renders a small SVG
 * face with state-driven CSS animations. Later (when we have Rive .riv
 * assets, or eventually Unreal pixel-streamed characters), the
 * implementation swaps without changing the prop surface or any caller
 * — wizard scenes pass the same `state` / `mood` / `speaking` and the
 * new backend interprets them.
 */
import { motion } from "motion/react";
import type { ReactElement } from "react";

export type CharacterState = "idle" | "thinking" | "speaking" | "reacting";
export type CharacterMood = "neutral" | "amused" | "curious" | "approving";

type Props = {
  name?: string;
  state?: CharacterState;
  mood?: CharacterMood;
  size?: number;
};

export function Character({
  state = "idle",
  mood = "neutral",
  size = 120,
}: Props) {
  // Mouth shape per state. Speaking = open ellipse (animated via CSS),
  // thinking = small line, idle = subtle smile.
  const mouthByState: Record<CharacterState, ReactElement> = {
    idle: <path d="M 14 26 Q 20 30 26 26" stroke="#a1a1aa" strokeWidth="1.5" fill="none" strokeLinecap="round" />,
    thinking: <line x1="16" y1="27" x2="24" y2="27" stroke="#a1a1aa" strokeWidth="1.5" strokeLinecap="round" />,
    speaking: <ellipse className="character-mouth-speaking" cx="20" cy="27" rx="3" ry="2" fill="#27272a" />,
    reacting: <path d="M 14 26 Q 20 32 26 26" stroke="#a1a1aa" strokeWidth="1.5" fill="none" strokeLinecap="round" />,
  };

  // Eye expression. Approving = slight crescent. Curious = wide. Amused =
  // squint. Neutral = round dot.
  const eyeY = mood === "amused" ? 18 : 17;
  const eyeR = mood === "curious" ? 1.6 : 1.2;

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className="relative"
      style={{ width: size, height: size }}
      aria-hidden="true"
    >
      <motion.svg
        viewBox="0 0 40 40"
        width={size}
        height={size}
        animate={
          state === "speaking"
            ? { y: [0, -1, 0] }
            : state === "thinking"
              ? { rotate: [-2, 2, -2] }
              : { y: 0, rotate: 0 }
        }
        transition={{
          duration: state === "speaking" ? 0.5 : 2,
          repeat: state === "speaking" || state === "thinking" ? Infinity : 0,
          ease: "easeInOut",
        }}
      >
        {/* Body — soft hex */}
        <polygon
          points="20,4 33,11 33,29 20,36 7,29 7,11"
          fill="#18181b"
          stroke="#52525b"
          strokeWidth="1"
        />
        {/* Eyes */}
        <circle cx="15" cy={eyeY} r={eyeR} fill="#e4e4e7" />
        <circle cx="25" cy={eyeY} r={eyeR} fill="#e4e4e7" />
        {/* Mood marker — a small dot near the eye for amused/approving */}
        {mood === "approving" && (
          <circle cx="15" cy={eyeY - 2.5} r="0.6" fill="#3b82f6" />
        )}
        {/* Mouth */}
        {mouthByState[state]}
      </motion.svg>
      <style jsx>{`
        :global(.character-mouth-speaking) {
          animation: char-mouth 0.32s ease-in-out infinite alternate;
          transform-origin: 20px 27px;
        }
        @keyframes char-mouth {
          from {
            transform: scaleY(0.4);
          }
          to {
            transform: scaleY(1);
          }
        }
      `}</style>
    </motion.div>
  );
}
