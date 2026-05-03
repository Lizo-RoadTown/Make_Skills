"use client";
/**
 * Skill build — wizard step 4 (Section 1's pedagogical centerpiece).
 *
 * Shape A: pick a job → co-author SKILL.md → see it become a tool.
 * The point isn't to attach a pre-baked skill — it's to teach the
 * student what a skill IS by walking them through writing one for a
 * concrete job they've chosen.
 *
 * Each section of the SKILL.md gets its own labeled input. As the
 * student focuses each input, the guide character speaks about THAT
 * section — what it's for, why it matters, how the LLM uses it.
 */
import { motion, AnimatePresence } from "motion/react";
import { useCallback, useMemo, useState } from "react";
import { Character, type CharacterMood, type CharacterState } from "./Character";
import { Dialog } from "./Dialog";

type Phase =
  | "greeting"
  | "pickingJob"
  | "reactingToJob"
  | "authoring"
  | "reactingToAuthor"
  | "done";

type Job = {
  slug: string;
  label: string;
  blurb: string;
  scaffold: SkillDraft;
  reaction: string;
};

export type SkillDraft = {
  name: string;
  description: string;
  probe: string;
  decide: string;
  act: string;
  report: string;
};

const EMPTY: SkillDraft = {
  name: "",
  description: "",
  probe: "",
  decide: "",
  act: "",
  report: "",
};

const JOBS: Job[] = [
  {
    slug: "research_topic",
    label: "Research a topic",
    blurb: "Find primary sources, summarize what's known and what's contested.",
    reaction:
      "Research. The honest version of this is harder than it sounds — most agents just google and call it done. Let's write something that actually reads sources.",
    scaffold: {
      name: "research_topic",
      description:
        "Given a topic, find primary sources, summarize the spread of opinions, and flag what's contested.",
      probe:
        "Read the topic. List what you'd need to know to write a serious overview — primary sources, key disagreements, missing context.",
      decide:
        "If the topic is too broad to cover responsibly in one pass, ask the user to narrow it. If sources contradict each other, surface the disagreement instead of picking a side.",
      act:
        "Pull at least 3 sources. Quote claims rather than paraphrasing. Note where authors disagree.",
      report:
        "Return: a short summary, the contested points (with both sides), and the sources used.",
    },
  },
  {
    slug: "explain_concept",
    label: "Explain a concept",
    blurb: "Plain language, building from what someone likely already knows.",
    reaction:
      "Explanation. The hardest part is figuring out where the listener is — too elementary and they tune out, too advanced and they get lost.",
    scaffold: {
      name: "explain_concept",
      description:
        "Explain a concept in plain language, starting from what the audience likely already knows.",
      probe:
        "Identify the concept and any audience signals (who they are, what they already know). If the audience is unspecified, default to a curious smart adult who isn't a specialist.",
      decide:
        "If the concept can't be explained without prerequisite ideas, list those first and ask whether to cover them or assume them.",
      act:
        "Build the explanation in 3-5 layers, each one adding a small leap. Use a concrete example before any abstraction.",
      report:
        "Deliver the explanation. Offer to go deeper, simpler, or sideways into a related concept.",
    },
  },
  {
    slug: "summarize_paper",
    label: "Summarize a paper",
    blurb: "Tight summary covering thesis, method, findings, limits.",
    reaction:
      "Paper summaries. The valuable ones include limits and what the paper *didn't* show — most summaries skip that.",
    scaffold: {
      name: "summarize_paper",
      description:
        "Read a paper and produce a tight summary covering thesis, method, findings, and limits.",
      probe:
        "Locate the paper's thesis (often not in the abstract), the method, the headline findings, and what the authors flag as limitations.",
      decide:
        "If the paper is outside your training cutoff or behind a paywall, say so before trying to summarize. Don't fabricate.",
      act:
        "Write four short sections: thesis (what they argue), method (how they tested it), findings (what they got), limits (what it doesn't show).",
      report:
        "Return the four-section summary. Optionally flag related papers worth reading.",
    },
  },
  {
    slug: "draft_email",
    label: "Draft an email",
    blurb: "Tonal, appropriate, doesn't sound like a robot wrote it.",
    reaction:
      "Email drafts. The trick is the tone — formal vs casual, warm vs neutral. Your skill should ask before guessing.",
    scaffold: {
      name: "draft_email",
      description:
        "Draft an email that fits the recipient and the situation. Asks for tone if unclear.",
      probe:
        "Identify recipient, subject, and what outcome the user wants. If tone isn't specified (formal/casual, warm/neutral), ask.",
      decide:
        "If the request is sensitive (apology, bad news, request for a favor), draft conservatively and flag it for the user to soften or sharpen.",
      act:
        "Write a draft with a clear first line, a focused middle, and a specific ask or close.",
      report:
        "Return the draft. Offer to adjust tone, length, or directness.",
    },
  },
];

const FIELD_TIPS: Record<keyof SkillDraft, string> = {
  name:
    "Short, lowercase, underscores. This is just an identifier — what the agent calls it internally.",
  description:
    "This is the most important line. The LLM reads this to decide WHEN to reach for the skill. Be specific about what triggers it.",
  probe:
    "What does the agent need to find out before doing the work? Probe is where it gathers context, reads inputs, asks clarifying questions.",
  decide:
    "Where should the agent stop and ask, vs just proceed? Decide names the judgment calls — what's the threshold for 'this needs human input'.",
  act:
    "The actual work. Keep it concrete — 'pull 3 sources, quote claims directly' beats 'do thorough research'.",
  report:
    "What does the agent tell you when it's done? Include what to return AND when to flag uncertainty.",
};

type Props = {
  initial?: Partial<SkillDraft>;
  onComplete: (payload: { skill: { name: string; description: string; body: string } }) => void;
  onBack: () => void;
};

function composeBody(d: SkillDraft): string {
  return [
    "## PROBE",
    d.probe.trim(),
    "",
    "## DECIDE",
    d.decide.trim(),
    "",
    "## ACT",
    d.act.trim(),
    "",
    "## REPORT",
    d.report.trim(),
  ].join("\n");
}

export function SkillBuildScene({ initial, onComplete, onBack }: Props) {
  const [phase, setPhase] = useState<Phase>("greeting");
  const [job, setJob] = useState<Job | null>(null);
  const [draft, setDraft] = useState<SkillDraft>({ ...EMPTY, ...initial });
  const [activeField, setActiveField] = useState<keyof SkillDraft | null>(null);

  const guideState: CharacterState = useMemo(() => {
    if (phase === "greeting" || phase === "reactingToJob" || phase === "reactingToAuthor")
      return "speaking";
    if (phase === "authoring") return "thinking";
    return "idle";
  }, [phase]);

  const guideMood: CharacterMood = useMemo(() => {
    if (phase === "reactingToAuthor" || phase === "done") return "approving";
    if (phase === "reactingToJob") return "amused";
    return "neutral";
  }, [phase]);

  const greetingText =
    "Skills are how your agent does things. Each one is a markdown file: a name, a description, and a structure for HOW the work happens. We'll write one together. Pick a job for it.";

  const pickJob = useCallback((j: Job) => {
    setJob(j);
    setDraft({ ...j.scaffold });
    setPhase("reactingToJob");
  }, []);

  const usePrompt = useMemo(() => {
    if (activeField && phase === "authoring") return FIELD_TIPS[activeField];
    return null;
  }, [activeField, phase]);

  const allFilled = (Object.keys(EMPTY) as (keyof SkillDraft)[]).every(
    (k) => draft[k].trim().length > 0,
  );

  const submit = useCallback(() => {
    if (!allFilled) return;
    setPhase("reactingToAuthor");
  }, [allFilled]);

  const finalize = useCallback(() => {
    setPhase("done");
  }, []);

  const ship = useCallback(() => {
    onComplete({
      skill: {
        name: draft.name.trim(),
        description: draft.description.trim(),
        body: composeBody(draft),
      },
    });
  }, [draft, onComplete]);

  const reactionToAuthor = useMemo(() => {
    if (!draft.description.trim()) return "";
    const wc = draft.description.trim().split(/\s+/).length;
    if (wc < 8)
      return `${draft.name}. Description is short — that can work, but the LLM has less to go on when deciding when to reach for it.`;
    return `${draft.name}. Description is specific. Agent will know when to reach for this. We'll wire it as a tool next.`;
  }, [draft]);

  return (
    <div className="relative flex h-full w-full flex-col">
      <div className="flex flex-1 items-center justify-center overflow-y-auto px-8 py-10">
        <div className="w-full max-w-3xl">
          <AnimatePresence mode="wait">
            {phase === "pickingJob" && (
              <motion.div
                key="pickingJob"
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -12 }}
                transition={{ duration: 0.3 }}
                className="grid grid-cols-1 gap-3 sm:grid-cols-2"
              >
                {JOBS.map((j, i) => (
                  <motion.button
                    key={j.slug}
                    type="button"
                    onClick={() => pickJob(j)}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.05 * i, duration: 0.3 }}
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    className="rounded-lg border border-zinc-800 bg-zinc-950 p-4 text-left transition hover:border-zinc-600 hover:bg-zinc-900"
                  >
                    <div className="text-sm font-semibold text-zinc-100">
                      {j.label}
                    </div>
                    <div className="mt-1 text-xs text-zinc-500">{j.blurb}</div>
                  </motion.button>
                ))}
              </motion.div>
            )}

            {phase === "authoring" && (
              <motion.div
                key="authoring"
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -12 }}
                transition={{ duration: 0.3 }}
                className="flex flex-col gap-3"
              >
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <Field
                    label="name"
                    value={draft.name}
                    onChange={(v) => setDraft((d) => ({ ...d, name: v }))}
                    onFocus={() => setActiveField("name")}
                    placeholder="research_topic"
                    mono
                  />
                  <Field
                    label="description (the most important line)"
                    value={draft.description}
                    onChange={(v) => setDraft((d) => ({ ...d, description: v }))}
                    onFocus={() => setActiveField("description")}
                    placeholder="Given a topic, find primary sources..."
                  />
                </div>
                <BodyField
                  label="PROBE — what does it find out first?"
                  value={draft.probe}
                  onChange={(v) => setDraft((d) => ({ ...d, probe: v }))}
                  onFocus={() => setActiveField("probe")}
                />
                <BodyField
                  label="DECIDE — where does it stop and ask?"
                  value={draft.decide}
                  onChange={(v) => setDraft((d) => ({ ...d, decide: v }))}
                  onFocus={() => setActiveField("decide")}
                />
                <BodyField
                  label="ACT — what's the actual work?"
                  value={draft.act}
                  onChange={(v) => setDraft((d) => ({ ...d, act: v }))}
                  onFocus={() => setActiveField("act")}
                />
                <BodyField
                  label="REPORT — what does it tell you when done?"
                  value={draft.report}
                  onChange={(v) => setDraft((d) => ({ ...d, report: v }))}
                  onFocus={() => setActiveField("report")}
                />
                <div className="flex items-center justify-between pt-2">
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
                    disabled={!allFilled}
                    className="rounded bg-blue-600 px-4 py-1.5 text-xs font-semibold text-white transition hover:bg-blue-500 disabled:cursor-not-allowed disabled:bg-zinc-800 disabled:text-zinc-500"
                  >
                    Save the skill
                  </button>
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
                  skill written
                </div>
                <motion.div
                  initial={{ scale: 0.5, rotate: -10 }}
                  animate={{ scale: 1, rotate: 0 }}
                  transition={{ type: "spring", stiffness: 180 }}
                  className="rounded-lg border border-blue-700 bg-zinc-900 px-6 py-4 shadow-[0_0_30px_rgba(59,130,246,0.25)]"
                >
                  <div className="font-mono text-sm text-blue-300">
                    {draft.name}
                  </div>
                  <div className="mt-1 text-xs text-zinc-400">
                    {draft.description}
                  </div>
                </motion.div>
                <div className="max-w-md text-center text-xs text-zinc-500">
                  This skill is now part of your agent&apos;s shape. You&apos;ll
                  wire it as a tool next.
                </div>
                <div className="mt-2 flex gap-3">
                  <button
                    type="button"
                    onClick={() => setPhase("authoring")}
                    className="rounded border border-zinc-800 px-4 py-2 text-sm text-zinc-400 hover:bg-zinc-900"
                  >
                    Edit
                  </button>
                  <button
                    type="button"
                    onClick={ship}
                    className="rounded bg-blue-600 px-5 py-2 text-sm font-semibold text-white transition hover:bg-blue-500"
                  >
                    Wire it as a tool →
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
              onComplete={() => setPhase("pickingJob")}
            />
          )}
          {phase === "reactingToJob" && job && (
            <Dialog
              text={job.reaction}
              speakerName="Guide"
              onComplete={() => setPhase("authoring")}
            />
          )}
          {phase === "authoring" && usePrompt && (
            <FieldHint key={activeField} text={usePrompt} />
          )}
          {phase === "reactingToAuthor" && (
            <Dialog
              text={reactionToAuthor}
              speakerName="Guide"
              onComplete={finalize}
            />
          )}
        </div>
      </div>
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  onFocus,
  placeholder,
  mono = false,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  onFocus: () => void;
  placeholder?: string;
  mono?: boolean;
}) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-[10px] uppercase tracking-wider text-zinc-500">
        {label}
      </span>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onFocus={onFocus}
        placeholder={placeholder}
        className={`rounded border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 placeholder:text-zinc-700 focus:border-blue-500 focus:outline-none ${
          mono ? "font-mono" : ""
        }`}
      />
    </label>
  );
}

function BodyField({
  label,
  value,
  onChange,
  onFocus,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  onFocus: () => void;
}) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-[10px] uppercase tracking-wider text-zinc-500">
        {label}
      </span>
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onFocus={onFocus}
        rows={2}
        className="rounded border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm text-zinc-200 placeholder:text-zinc-700 focus:border-blue-500 focus:outline-none"
      />
    </label>
  );
}

function FieldHint({ text }: { text: string }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2 }}
      className="max-w-xl rounded-lg border border-zinc-800 bg-zinc-900/80 px-4 py-3 text-xs text-zinc-300 backdrop-blur"
    >
      <div className="mb-0.5 text-[10px] font-semibold uppercase tracking-wider text-zinc-600">
        Guide
      </div>
      {text}
    </motion.div>
  );
}
