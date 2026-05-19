"use client";
import Image from "next/image";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { streamChat } from "@/lib/agent-client";
import { rememberThread } from "@/lib/threads";
import { Composer } from "./Composer";
import { MessageBubble } from "./MessageBubble";
import { ThinkingDots } from "./ThinkingDots";

type Message = { role: "user" | "agent"; content: string };

type Props = {
  threadId: string | null;
  onThreadChange: (id: string) => void;
  /** UUID of a student-built agent. Omit / null = platform default. */
  agentId?: string | null;
  /** Optional header label override (e.g., the agent's name). */
  title?: string;
  /** First-time user: no agents in their stable AND no past chat threads.
   *  Shows a rich welcome with hero image + onboarding CTAs instead of the
   *  bare "Ask anything" greeting. */
  firstTime?: boolean;
};

export function Chat({
  threadId,
  onThreadChange,
  agentId,
  title,
  firstTime = false,
}: Props) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [streaming, setStreaming] = useState(false);
  const [thinking, setThinking] = useState(false);
  const scrollRef = useRef<HTMLDivElement | null>(null);

  // Track streaming state in a ref so the reset effect below doesn't
  // depend on it (which would cause the effect to re-fire when streaming
  // flips, wiping the response).
  const streamingRef = useRef(false);
  streamingRef.current = streaming;

  // Reset the displayed messages when the user picks a different thread
  // via ThreadSidebar — but NOT when we ourselves caused the threadId
  // change mid-send (the stream's first event is `thread`, which calls
  // onThreadChange; without this guard the reset would wipe the user
  // message + the in-flight response).
  useEffect(() => {
    if (streamingRef.current) return;
    setMessages([]);
  }, [threadId]);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }, [messages, thinking]);

  const send = async (msg: string) => {
    setMessages((prev) => [
      ...prev,
      { role: "user", content: msg },
      { role: "agent", content: "" },
    ]);
    setStreaming(true);
    setThinking(true);

    let agentText = "";
    let firstChunk = true;

    for await (const ev of streamChat(msg, threadId, agentId ?? null)) {
      if (ev.event === "thread") {
        if (!threadId) {
          rememberThread(ev.thread_id, msg);
          onThreadChange(ev.thread_id);
        }
      } else if (ev.event === "chunk") {
        if (firstChunk) {
          setThinking(false);
          firstChunk = false;
        }
        agentText += ev.data;
        setMessages((prev) => {
          const next = [...prev];
          next[next.length - 1] = { role: "agent", content: agentText };
          return next;
        });
      } else if (ev.event === "error") {
        agentText = `**Error:** ${ev.detail}`;
        setMessages((prev) => {
          const next = [...prev];
          next[next.length - 1] = { role: "agent", content: agentText };
          return next;
        });
      } else if (ev.event === "done") {
        break;
      }
    }

    setThinking(false);
    setStreaming(false);
  };

  return (
    <div className="flex h-full flex-1 flex-col">
      <header className="border-b border-zinc-800 bg-zinc-900 px-6 py-3">
        <h1 className="text-sm font-semibold text-zinc-300">
          {title || "Make_Skills agent"}
        </h1>
      </header>
      <div ref={scrollRef} className="flex-1 overflow-y-auto">
        <div className="mx-auto flex max-w-3xl flex-col gap-4 p-4">
          {messages.length === 0 && !thinking && firstTime && (
            <div className="mt-8 flex flex-col items-center gap-6 text-center">
              <div className="relative aspect-[16/7] w-full max-w-2xl overflow-hidden rounded-xl border border-zinc-800">
                <Image
                  src="/illustrations/agents-hero.jpg"
                  alt=""
                  fill
                  priority
                  className="object-cover"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-zinc-950 via-zinc-950/40 to-transparent" />
              </div>
              <div className="max-w-md">
                <h2 className="text-2xl font-semibold text-zinc-100">
                  Welcome to Make_Skills
                </h2>
                <p className="mt-3 text-sm text-zinc-400">
                  Two ways to begin. Hatch your first agent — about five
                  minutes, picks its brain, persona, and a starter skill.
                  Or just chat with the default below.
                </p>
              </div>
              <div className="flex flex-col items-center gap-2">
                <Link
                  href="/agents/build"
                  className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white shadow-[0_0_24px_-8px_rgb(59,130,246)] transition hover:bg-blue-500"
                >
                  Hatch an agent →
                </Link>
                <p className="text-[11px] text-zinc-600">
                  or just type below
                </p>
              </div>
            </div>
          )}
          {messages.length === 0 && !thinking && !firstTime && (
            <div className="mt-20 text-center text-zinc-500">
              <p className="text-lg text-zinc-300">
                {title || "Make_Skills agent"}
              </p>
              <p className="mt-2 text-sm">
                {agentId
                  ? "Ask something this agent's persona + skills can handle."
                  : "Ask anything — I'll route to the right skill or subagent."}
              </p>
            </div>
          )}
          {messages.map((m, i) => (
            <MessageBubble key={i} role={m.role} content={m.content} />
          ))}
          {thinking && <ThinkingDots />}
        </div>
      </div>
      <Composer onSend={send} disabled={streaming} />
    </div>
  );
}
