"use client";
/**
 * Brain — wizard step 2 (pick the LLM provider).
 *
 * Surfaces the supported providers from /providers/list (model_registry
 * + key-presence detection). Shows ready-to-use providers first; ones
 * that need an API key are visible but tagged. Reactions are
 * choice-aware — Claude is framed for reasoning, Llama-via-Groq for
 * speed, Ollama for sovereignty, etc.
 */
import { motion, AnimatePresence } from "motion/react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Character, type CharacterMood, type CharacterState } from "./Character";
import { Dialog } from "./Dialog";

const AGENT_URL = process.env.NEXT_PUBLIC_AGENT_URL || "http://localhost:8001";

type Provider = {
  slug: string;
  label: string;
  description: string;
  tier: string;
  starter_model: string | null;
  key_env_vars: string[];
  ready: boolean;
};

// Fallback list — used when /providers/list isn't reachable yet
// (Vercel preview before Render redeploys, API offline, etc.). Mirrors
// the v1 starter set returned by platform/api/provider_inspector.py.
const FALLBACK_PROVIDERS: Provider[] = [
  {
    slug: "anthropic",
    label: "Anthropic",
    description: "Claude — strong at long reasoning and following nuanced instructions. Paid API.",
    tier: "paid",
    starter_model: "claude-sonnet-4-6",
    key_env_vars: ["ANTHROPIC_API_KEY"],
    ready: false,
  },
  {
    slug: "openai",
    label: "OpenAI",
    description: "GPT — broadly capable, well-known, fast. Paid API.",
    tier: "paid",
    starter_model: "gpt-5.2",
    key_env_vars: ["OPENAI_API_KEY"],
    ready: false,
  },
  {
    slug: "google",
    label: "Google",
    description: "Gemini — large free tier, fast, strong on multimodal tasks. Free + paid.",
    tier: "free-tier",
    starter_model: "gemini-2.5-flash",
    key_env_vars: ["GOOGLE_API_KEY", "GEMINI_API_KEY"],
    ready: false,
  },
  {
    slug: "huggingface",
    label: "Hugging Face",
    description: "Open-weight models via HF Inference Providers. Free tier; pick from many.",
    tier: "free-tier",
    starter_model: "Qwen/Qwen3-32B-Instruct",
    key_env_vars: ["HUGGINGFACEHUB_API_TOKEN", "HF_TOKEN"],
    ready: false,
  },
  {
    slug: "together",
    label: "Together",
    description: "Hosted open-weight models (Llama, Mixtral, etc.). Pay-as-you-go.",
    tier: "paid",
    starter_model: "meta-llama/Meta-Llama-3.1-70B-Instruct-Turbo",
    key_env_vars: ["TOGETHER_API_KEY"],
    ready: false,
  },
  {
    slug: "groq",
    label: "Groq",
    description: "Hosted open-weight models on custom hardware — very fast inference. Free tier.",
    tier: "free-tier",
    starter_model: "llama-3.3-70b-versatile",
    key_env_vars: ["GROQ_API_KEY"],
    ready: false,
  },
  {
    slug: "ollama",
    label: "Ollama",
    description: "Run open-weight models locally. No API key, no cost.",
    tier: "local",
    starter_model: "llama3.1:8b",
    key_env_vars: [],
    ready: true,
  },
];

const PROVIDER_REACTIONS: Record<string, string> = {
  anthropic:
    "Claude. Goes deep on instructions and multi-step reasoning. Slower than the others, costs money, worth it for serious work.",
  openai:
    "GPT. Broad knowledge, fast, well-known. Costs money. Safe pick if the agent's job isn't unusual.",
  google:
    "Gemini. Generous free tier and fast. Strong on visual stuff if your agent ever needs that.",
  huggingface:
    "Hugging Face. Open-weight models, free tier. You'll feel the difference vs. Claude on hard tasks — but for many agents, it's enough.",
  together:
    "Together. Hosted open-weight models, decent prices. Fine choice if you want Llama-class without running it yourself.",
  groq:
    "Groq. Same open-weight models as Together, but stupidly fast — they built custom hardware. Free tier is real.",
  ollama:
    "Ollama. Runs on your own machine. No API key, no cost, no one watching. Slower unless your laptop is beefy.",
};

type Phase = "greeting" | "picking" | "reacting" | "done";

type Props = {
  onComplete: (payload: { provider: string; model: string }) => void;
  onBack: () => void;
};

export function BrainScene({ onComplete, onBack }: Props) {
  const [phase, setPhase] = useState<Phase>("greeting");
  // Start populated with the fallback list so providers always show,
  // even when the API hasn't deployed /providers/list yet.
  const [providers, setProviders] = useState<Provider[]>(FALLBACK_PROVIDERS);
  const [chosen, setChosen] = useState<Provider | null>(null);

  useEffect(() => {
    fetch(`${AGENT_URL}/providers/list`)
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => {
        if (j?.providers && j.providers.length > 0) {
          setProviders(j.providers);
        }
      })
      .catch(() => {
        // Keep the fallback list — silent failure is fine here.
      });
  }, []);

  const guideState: CharacterState = useMemo(() => {
    if (phase === "greeting" || phase === "reacting") return "speaking";
    if (phase === "picking") return "idle";
    return "idle";
  }, [phase]);

  const guideMood: CharacterMood = useMemo(() => {
    if (phase === "reacting") return "approving";
    return "neutral";
  }, [phase]);

  const greetingText =
    "Pick a brain. This is the LLM that does the actual thinking — when your agent reads or writes anything, this is what runs. The choice mostly trades off smarts vs. speed vs. cost.";

  const reactionText = chosen
    ? PROVIDER_REACTIONS[chosen.slug] ||
      `${chosen.label}. Solid choice. Moving on.`
    : "";

  const pick = useCallback((p: Provider) => {
    setChosen(p);
    setPhase("reacting");
  }, []);

  const confirm = useCallback(() => {
    if (!chosen) return;
    onComplete({ provider: chosen.slug, model: chosen.starter_model || "" });
  }, [chosen, onComplete]);

  // Sort: ready first, then by free-tier/local before paid
  const sorted = useMemo(() => {
    const tierOrder: Record<string, number> = { "free-tier": 0, local: 1, paid: 2 };
    return [...providers].sort((a, b) => {
      if (a.ready !== b.ready) return a.ready ? -1 : 1;
      return (tierOrder[a.tier] ?? 99) - (tierOrder[b.tier] ?? 99);
    });
  }, [providers]);

  return (
    <div className="relative flex h-full w-full flex-col">
      <div className="flex flex-1 items-center justify-center px-8 py-10">
        <div className="w-full max-w-3xl">
          <AnimatePresence mode="wait">
            {phase === "picking" && (
              <motion.div
                key="picker"
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -12 }}
                transition={{ duration: 0.3 }}
              >
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  {sorted.map((p, i) => (
                    <motion.button
                      key={p.slug}
                      type="button"
                      onClick={() => pick(p)}
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.05 * i, duration: 0.3 }}
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                      className="flex flex-col gap-1.5 rounded-lg border border-zinc-800 bg-zinc-950 p-4 text-left transition hover:border-zinc-600 hover:bg-zinc-900"
                    >
                      <div className="flex items-center justify-between">
                        <div className="text-base font-semibold text-zinc-100">
                          {p.label}
                        </div>
                        <div className="flex gap-1.5">
                          <span
                            className={`rounded px-1.5 py-0.5 text-[10px] uppercase tracking-wider ${
                              p.tier === "free-tier"
                                ? "bg-emerald-950 text-emerald-400"
                                : p.tier === "local"
                                  ? "bg-violet-950 text-violet-400"
                                  : "bg-amber-950 text-amber-400"
                            }`}
                          >
                            {p.tier}
                          </span>
                          {!p.ready && (
                            <span className="rounded bg-zinc-800 px-1.5 py-0.5 text-[10px] uppercase tracking-wider text-zinc-400">
                              needs key
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="text-xs text-zinc-500">{p.description}</div>
                      {p.starter_model && (
                        <div className="mt-1 font-mono text-[10px] text-zinc-600">
                          {p.starter_model}
                        </div>
                      )}
                    </motion.button>
                  ))}
                </div>
              </motion.div>
            )}

            {phase === "done" && chosen && (
              <motion.div
                key="done"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.4 }}
                className="flex flex-col items-center gap-4"
              >
                <div className="text-sm uppercase tracking-wider text-zinc-500">
                  brain
                </div>
                <div className="text-2xl font-semibold text-zinc-100">
                  {chosen.label}
                </div>
                {chosen.starter_model && (
                  <div className="font-mono text-xs text-zinc-500">
                    {chosen.starter_model}
                  </div>
                )}
                <div className="mt-2 flex gap-3">
                  <button
                    type="button"
                    onClick={onBack}
                    className="rounded border border-zinc-800 px-4 py-2 text-sm text-zinc-400 hover:bg-zinc-900"
                  >
                    ← Back
                  </button>
                  <button
                    type="button"
                    onClick={confirm}
                    className="rounded bg-blue-600 px-5 py-2 text-sm font-semibold text-white transition hover:bg-blue-500"
                  >
                    Add the idea →
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
              onComplete={() => setPhase("picking")}
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
