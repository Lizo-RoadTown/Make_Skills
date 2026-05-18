"use client";
import { useEffect, useState } from "react";
import { Chat } from "@/components/Chat";

const AGENT_URL = process.env.NEXT_PUBLIC_AGENT_URL || "http://localhost:8001";

type AgentSummary = {
  id: string;
  name: string;
  provider: string;
  model: string | null;
  persona: string | null;
  skills: { id: string; name: string; description: string }[];
};

export default function ChatWithAgentPage({
  params,
}: {
  params: Promise<{ agent_id: string }>;
}) {
  const [agentId, setAgentId] = useState<string | null>(null);
  const [agent, setAgent] = useState<AgentSummary | null>(null);
  const [threadId, setThreadId] = useState<string | null>(null);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { agent_id } = await params;
      if (cancelled) return;
      setAgentId(agent_id);
      try {
        const res = await fetch(`${AGENT_URL}/agents/get/${agent_id}`);
        if (res.status === 404) {
          setNotFound(true);
          return;
        }
        if (!res.ok) {
          setNotFound(true);
          return;
        }
        const data = await res.json();
        if (!cancelled) setAgent(data);
      } catch {
        if (!cancelled) setNotFound(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [params]);

  if (notFound) {
    return (
      <div className="flex h-full items-center justify-center text-sm text-zinc-500">
        Agent not found.
      </div>
    );
  }

  if (!agentId || !agent) {
    return (
      <div className="flex h-full items-center justify-center text-sm text-zinc-500">
        Loading…
      </div>
    );
  }

  return (
    <div className="flex h-full">
      <aside className="hidden w-64 shrink-0 flex-col border-r border-zinc-800 bg-zinc-950 md:flex">
        <div className="border-b border-zinc-800 px-4 py-3">
          <div className="text-[10px] uppercase tracking-wider text-zinc-500">
            Your agent
          </div>
          <div className="mt-0.5 text-sm font-semibold text-zinc-100">
            {agent.name}
          </div>
          <div className="mt-0.5 font-mono text-[10px] text-zinc-600">
            {agent.provider}
            {agent.model ? ` · ${agent.model}` : ""}
          </div>
        </div>
        {agent.persona && (
          <div className="border-b border-zinc-800 px-4 py-3">
            <div className="text-[10px] uppercase tracking-wider text-zinc-500">
              Idea
            </div>
            <p className="mt-1 text-xs italic text-zinc-400 line-clamp-6">
              &ldquo;{agent.persona}&rdquo;
            </p>
          </div>
        )}
        {agent.skills.length > 0 && (
          <div className="px-4 py-3">
            <div className="text-[10px] uppercase tracking-wider text-zinc-500">
              Skills
            </div>
            <ul className="mt-2 flex flex-col gap-2">
              {agent.skills.map((s) => (
                <li
                  key={s.id}
                  className="rounded border border-zinc-800 bg-zinc-900 px-2 py-1.5"
                >
                  <div className="font-mono text-[11px] text-blue-300">
                    {s.name}
                  </div>
                  <div className="mt-0.5 text-[10px] text-zinc-500 line-clamp-3">
                    {s.description}
                  </div>
                </li>
              ))}
            </ul>
          </div>
        )}
      </aside>
      <div className="flex h-full flex-1 flex-col">
        <Chat
          threadId={threadId}
          onThreadChange={setThreadId}
          agentId={agentId}
          title={agent.name}
        />
      </div>
    </div>
  );
}
