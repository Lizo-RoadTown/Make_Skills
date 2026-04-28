"use client";
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
};

export function Chat({ threadId, onThreadChange }: Props) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [streaming, setStreaming] = useState(false);
  const [thinking, setThinking] = useState(false);
  const scrollRef = useRef<HTMLDivElement | null>(null);

  // Reset the displayed messages when the user picks a different thread.
  // (We don't fetch server history yet — just start with an empty view.)
  useEffect(() => {
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

    for await (const ev of streamChat(msg, threadId)) {
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
        <h1 className="text-sm font-semibold text-zinc-300">Make_Skills agent</h1>
      </header>
      <div ref={scrollRef} className="flex-1 overflow-y-auto">
        <div className="mx-auto flex max-w-3xl flex-col gap-4 p-4">
          {messages.length === 0 && !thinking && (
            <div className="mt-20 text-center text-zinc-500">
              <p className="text-lg text-zinc-300">Make_Skills agent</p>
              <p className="mt-2 text-sm">
                Ask anything — I&apos;ll route to the right skill or subagent.
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
