"use client";
import { useSession } from "next-auth/react";
import { useEffect, useState } from "react";
import { Chat } from "@/components/Chat";
import { Landing } from "@/components/Landing";
import { ThreadSidebar } from "@/components/ThreadSidebar";
import { listThreads } from "@/lib/threads";

const AGENT_URL =
  process.env.NEXT_PUBLIC_AGENT_URL || "http://localhost:8001";

export default function Page() {
  const { data: session, status } = useSession();
  const [threadId, setThreadId] = useState<string | null>(null);
  // null = still checking; once resolved, true means show welcome state.
  const [firstTime, setFirstTime] = useState<boolean | null>(null);

  useEffect(() => {
    if (!session?.user) return;
    const hasThreads = listThreads().length > 0;
    if (hasThreads) {
      setFirstTime(false);
      return;
    }
    fetch(`${AGENT_URL}/agents/list`)
      .then((r) => (r.ok ? r.json() : { agents: [] }))
      .then((j) => setFirstTime((j.agents || []).length === 0))
      .catch(() => setFirstTime(false));
  }, [session?.user]);

  if (status === "loading") {
    return (
      <div className="flex h-full items-center justify-center text-sm text-zinc-500">
        Loading…
      </div>
    );
  }

  if (!session?.user) {
    return <Landing />;
  }

  return (
    <div className="flex h-full">
      <ThreadSidebar currentThreadId={threadId} onSelect={setThreadId} />
      <Chat
        threadId={threadId}
        onThreadChange={setThreadId}
        firstTime={firstTime === true}
      />
    </div>
  );
}
