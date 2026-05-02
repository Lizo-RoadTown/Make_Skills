"use client";
import { useSession } from "next-auth/react";
import { useState } from "react";
import { Chat } from "@/components/Chat";
import { Landing } from "@/components/Landing";
import { ThreadSidebar } from "@/components/ThreadSidebar";

export default function Page() {
  const { data: session, status } = useSession();
  const [threadId, setThreadId] = useState<string | null>(null);

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
      <Chat threadId={threadId} onThreadChange={setThreadId} />
    </div>
  );
}
