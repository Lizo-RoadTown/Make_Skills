"use client";
import ReactMarkdown from "react-markdown";
import rehypeHighlight from "rehype-highlight";

type Props = { role: "user" | "agent"; content: string };

export function MessageBubble({ role, content }: Props) {
  if (role === "user") {
    return (
      <div className="flex justify-end">
        <div className="max-w-[80%] whitespace-pre-wrap rounded-2xl bg-blue-600 px-4 py-2 text-white">
          {content}
        </div>
      </div>
    );
  }
  return (
    <div className="flex justify-start">
      <div className="agent-md max-w-[85%] rounded-2xl bg-zinc-800 px-4 py-3 text-zinc-100">
        <ReactMarkdown rehypePlugins={[rehypeHighlight]}>
          {content || "…"}
        </ReactMarkdown>
      </div>
    </div>
  );
}
