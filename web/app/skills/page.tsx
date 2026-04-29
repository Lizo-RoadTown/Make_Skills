"use client";
import { useEffect, useState } from "react";
import ReactMarkdown from "react-markdown";
import rehypeHighlight from "rehype-highlight";
import remarkGfm from "remark-gfm";

const AGENT_URL =
  process.env.NEXT_PUBLIC_AGENT_URL || "http://localhost:8001";

type Skill = {
  name: string;
  description: string;
  path: string;
};

export default function SkillsPage() {
  const [skills, setSkills] = useState<Skill[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [content, setContent] = useState<string>("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetch(`${AGENT_URL}/skills/list`)
      .then((r) => r.json())
      .then((j) => setSkills(j.skills || []));
  }, []);

  useEffect(() => {
    if (!selected) return;
    setLoading(true);
    fetch(`${AGENT_URL}/skills/file?path=${encodeURIComponent(selected)}`)
      .then((r) => r.json())
      .then((j) => setContent(j.content || ""))
      .finally(() => setLoading(false));
  }, [selected]);

  return (
    <div className="flex h-full">
      <aside className="hidden w-72 shrink-0 flex-col border-r border-zinc-800 bg-zinc-950 md:flex">
        <div className="border-b border-zinc-800 px-4 py-3">
          <h2 className="text-sm font-semibold text-zinc-300">Skills</h2>
          <p className="text-xs text-zinc-500">
            {skills.length} loaded · authored + curated
          </p>
        </div>
        <div className="flex-1 overflow-y-auto">
          {skills.length === 0 && (
            <div className="p-4 text-sm text-zinc-500">loading…</div>
          )}
          {skills.map((s) => {
            const active = selected === s.path;
            return (
              <button
                key={s.path}
                type="button"
                onClick={() => setSelected(s.path)}
                className={`block w-full px-4 py-3 text-left transition ${
                  active
                    ? "bg-zinc-800"
                    : "hover:bg-zinc-900"
                }`}
              >
                <div
                  className={`text-sm font-medium ${
                    active ? "text-zinc-100" : "text-zinc-300"
                  }`}
                >
                  {s.name}
                </div>
                <div className="mt-0.5 line-clamp-2 text-xs text-zinc-500">
                  {s.description}
                </div>
              </button>
            );
          })}
        </div>
      </aside>

      <div className="flex flex-1 flex-col">
        <header className="border-b border-zinc-800 bg-zinc-900 px-6 py-3">
          <div className="text-sm font-semibold text-zinc-300">
            {selected ? selected.split("/")[0] : "Select a skill"}
          </div>
          <div className="text-xs text-zinc-500">
            Skills are markdown wisdom. Some are paired with tools (functions); see the agentic-upskilling skill for the promotion loop.
          </div>
        </header>
        <div className="flex-1 overflow-y-auto">
          {loading && (
            <div className="p-6 text-sm text-zinc-500">loading…</div>
          )}
          {!loading && selected && (
            <article className="roadmap-md mx-auto max-w-4xl px-6 py-8 text-zinc-100">
              <ReactMarkdown
                remarkPlugins={[remarkGfm]}
                rehypePlugins={[rehypeHighlight]}
              >
                {content}
              </ReactMarkdown>
            </article>
          )}
          {!loading && !selected && (
            <div className="p-6 text-sm text-zinc-500">
              Pick a skill on the left to read its SKILL.md.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
