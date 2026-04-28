"use client";
import { useState } from "react";
import { Chat } from "@/components/Chat";
import { ThreadSidebar } from "@/components/ThreadSidebar";

export default function Page() {
  const [threadId, setThreadId] = useState<string | null>(null);
  return (
    <div className="flex h-full">
      <ThreadSidebar currentThreadId={threadId} onSelect={setThreadId} />
      <Chat threadId={threadId} onThreadChange={setThreadId} />
    </div>
  );
}
