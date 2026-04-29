"use client";
import { useEffect, useState } from "react";
import ReactMarkdown from "react-markdown";
import rehypeHighlight from "rehype-highlight";
import remarkGfm from "remark-gfm";

const AGENT_URL =
  process.env.NEXT_PUBLIC_AGENT_URL || "http://localhost:8001";

type FileNode = {
  type: "file";
  name: string;
  path: string;
  title: string;
};
type DirNode = {
  type: "dir";
  name: string;
  path: string;
  children: TreeNode[];
};
type TreeNode = FileNode | DirNode;

export default function DocsPage() {
  const [tree, setTree] = useState<TreeNode[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [content, setContent] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch(`${AGENT_URL}/docs/tree`)
      .then((r) => r.json())
      .then((j) => {
        setTree(j.tree || []);
        // auto-select the docs/README.md if it exists
        const readme = (j.tree || []).find(
          (n: TreeNode) => n.type === "file" && n.name === "README.md",
        );
        if (readme) setSelected((readme as FileNode).path);
      })
      .catch((e) => setError((e as Error).message));
  }, []);

  useEffect(() => {
    if (!selected) return;
    setLoading(true);
    setError(null);
    fetch(
      `${AGENT_URL}/docs/file?path=${encodeURIComponent(
        selected.replace(/^docs\//, ""),
      )}`,
    )
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      })
      .then((j) => setContent(j.content || ""))
      .catch((e) => setError((e as Error).message))
      .finally(() => setLoading(false));
  }, [selected]);

  return (
    <div className="flex h-full">
      <aside className="hidden w-64 shrink-0 flex-col border-r border-zinc-800 bg-zinc-950 md:flex">
        <div className="border-b border-zinc-800 px-4 py-3">
          <h2 className="text-sm font-semibold text-zinc-300">Documentation</h2>
          <p className="text-xs text-zinc-500">Concepts · How-to · Reference · Decisions · Proposals</p>
        </div>
        <div className="flex-1 overflow-y-auto p-2 text-sm">
          {tree.length === 0 && (
            <div className="p-3 text-zinc-500">No docs yet.</div>
          )}
          {tree.map((node) => (
            <TreeNodeView
              key={node.path}
              node={node}
              selected={selected}
              onSelect={setSelected}
            />
          ))}
        </div>
      </aside>

      <div className="flex flex-1 flex-col">
        <header className="border-b border-zinc-800 bg-zinc-900 px-6 py-3">
          <div className="text-sm font-semibold text-zinc-300">
            {selected || "Select a doc"}
          </div>
          <div className="text-xs text-zinc-500">
            All files under docs/ — tracked in git, edited in VS Code, rendered here.
          </div>
        </header>
        {error && (
          <div className="border-b border-red-900 bg-red-950/40 px-6 py-2 text-sm text-red-300">
            {error}
          </div>
        )}
        <div className="flex-1 overflow-y-auto">
          {loading && <div className="p-6 text-sm text-zinc-500">loading…</div>}
          {!loading && selected && (
            <article className="roadmap-md mx-auto max-w-4xl px-6 py-8 text-zinc-100">
              <ReactMarkdown
                remarkPlugins={[remarkGfm]}
                rehypePlugins={[rehypeHighlight]}
              >
                {content || "(empty)"}
              </ReactMarkdown>
            </article>
          )}
          {!loading && !selected && (
            <div className="p-6 text-sm text-zinc-500">
              Pick a doc on the left.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function TreeNodeView({
  node,
  selected,
  onSelect,
  depth = 0,
}: {
  node: TreeNode;
  selected: string | null;
  onSelect: (path: string) => void;
  depth?: number;
}) {
  if (node.type === "dir") {
    return (
      <div>
        <div
          className="px-2 py-1 text-xs uppercase tracking-wider text-zinc-500"
          style={{ paddingLeft: 8 + depth * 12 }}
        >
          {node.name}
        </div>
        {node.children.map((c) => (
          <TreeNodeView
            key={c.path}
            node={c}
            selected={selected}
            onSelect={onSelect}
            depth={depth + 1}
          />
        ))}
      </div>
    );
  }
  const active = selected === node.path;
  return (
    <button
      type="button"
      onClick={() => onSelect(node.path)}
      className={`block w-full truncate rounded px-2 py-1 text-left ${
        active
          ? "bg-zinc-800 text-zinc-100"
          : "text-zinc-400 hover:bg-zinc-900 hover:text-zinc-200"
      }`}
      style={{ paddingLeft: 8 + depth * 12 }}
      title={node.path}
    >
      {node.title || node.name}
    </button>
  );
}
