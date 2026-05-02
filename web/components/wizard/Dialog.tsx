"use client";
/**
 * Wizard dialog — typewriter reveal with click-to-fast-forward.
 *
 * Takes a string + onComplete callback. Reveals letter-by-letter at a
 * cadence that feels human, not robotic. Click anywhere on the bubble
 * (or hit space) to skip to the end. When complete, fires onComplete
 * so the wizard machine can transition to the choice phase.
 */
import { motion, AnimatePresence } from "motion/react";
import { useCallback, useEffect, useRef, useState } from "react";

type Props = {
  text: string;
  speakerName?: string;
  onComplete?: () => void;
  /** Override per-character delay (ms). Default 22ms. */
  speed?: number;
};

export function Dialog({ text, speakerName, onComplete, speed = 22 }: Props) {
  const [revealed, setRevealed] = useState(0);
  const [done, setDone] = useState(false);

  // Ref so parent-supplied callback identity changes don't restart the
  // typing/completion effect (which used to kill the 280ms pause and
  // strand the wizard between steps).
  const onCompleteRef = useRef(onComplete);
  onCompleteRef.current = onComplete;

  useEffect(() => {
    setRevealed(0);
    setDone(false);
  }, [text]);

  useEffect(() => {
    if (done) return;
    if (revealed >= text.length) {
      const t = setTimeout(() => {
        setDone(true);
        onCompleteRef.current?.();
      }, 280);
      return () => clearTimeout(t);
    }
    const ch = text[revealed];
    const delay =
      ch === "." || ch === "?" || ch === "!"
        ? speed * 6
        : ch === ","
          ? speed * 3
          : speed;
    const t = setTimeout(() => setRevealed((r) => r + 1), delay);
    return () => clearTimeout(t);
  }, [revealed, text, speed, done]);

  const fastForward = useCallback(() => {
    if (done) {
      onCompleteRef.current?.();
    } else {
      setRevealed(text.length);
    }
  }, [done, text.length]);

  // Handle space-to-skip / advance
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === " " || e.key === "Enter") {
        e.preventDefault();
        fastForward();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [fastForward]);

  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={text}
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -6 }}
        transition={{ duration: 0.25 }}
        onClick={fastForward}
        className="relative max-w-xl cursor-pointer rounded-lg border border-zinc-700 bg-zinc-900/90 px-5 py-4 shadow-lg backdrop-blur"
      >
        {speakerName && (
          <div className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
            {speakerName}
          </div>
        )}
        <p className="text-sm leading-relaxed text-zinc-200">
          {text.slice(0, revealed)}
          {!done && (
            <motion.span
              animate={{ opacity: [1, 0.2, 1] }}
              transition={{ duration: 0.7, repeat: Infinity }}
              className="ml-0.5 inline-block h-3 w-1 bg-zinc-400 align-middle"
            />
          )}
        </p>
        {!done && (
          <div className="mt-2 text-[10px] uppercase tracking-wider text-zinc-600">
            click or press space to skip
          </div>
        )}
      </motion.div>
    </AnimatePresence>
  );
}
