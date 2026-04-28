"use client";
import { useEffect, useState } from "react";
import { clearThreads, listThreads, type Thread } from "@/lib/threads";

type Props = {
  currentThreadId: string | null;
  onSelect: (id: string | null) => void;
  refreshKey?: number;
};

export function ThreadSidebar({ currentThreadId, onSelect, refreshKey }: Props) {
  const [threads, setThreads] = useState<Thread[]>([]);

  useEffect(() => {
    setThreads(listThreads());
  }, [currentThreadId, refreshKey]);

  return (
    <aside className="hidden w-64 shrink-0 flex-col border-r border-zinc-800 bg-zinc-950 md:flex">
      <div className="flex items-center justify-between border-b border-zinc-800 p-4">
        <h2 className="text-sm font-semibold text-zinc-300">Conversations</h2>
        <button
          onClick={() => onSelect(null)}
          className="text-xs text-blue-400 hover:underline"
        >
          + New
        </button>
      </div>
      <div className="flex-1 overflow-y-auto">
        {threads.length === 0 && (
          <div className="p-4 text-sm text-zinc-500">No conversations yet</div>
        )}
        {threads.map((t) => (
          <button
            key={t.id}
            onClick={() => onSelect(t.id)}
            className={`block w-full truncate p-3 text-left text-sm hover:bg-zinc-800 ${
              t.id === currentThreadId
                ? "bg-zinc-800 text-zinc-100"
                : "text-zinc-400"
            }`}
            title={t.firstMessage}
          >
            {t.firstMessage.slice(0, 60)}
          </button>
        ))}
      </div>
      {threads.length > 0 && (
        <div className="border-t border-zinc-800 p-2">
          <button
            onClick={() => {
              if (
                confirm("Clear local conversation list? (Server-side history is unaffected.)")
              ) {
                clearThreads();
                setThreads([]);
                onSelect(null);
              }
            }}
            className="w-full text-xs text-zinc-500 hover:text-zinc-300"
          >
            Clear local list
          </button>
        </div>
      )}
    </aside>
  );
}
