"use client";
import { useEffect, useMemo, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeHighlight from "rehype-highlight";

const AGENT_URL =
  process.env.NEXT_PUBLIC_AGENT_URL || "http://localhost:8001";

type TreeNode = {
  type: "file" | "dir";
  name: string;
  path: string;
  children?: TreeNode[];
};

type Props = {
  /** Directory under docs/ to browse, e.g. "plans", "proposals", "test-runs". */
  subdir: string;
  /** Page title shown above the file list. */
  title: string;
  /** One-line description shown under the title. */
  description: string;
  /** Optional: text shown when the directory is empty. */
  emptyText?: string;
};

/**
 * Generic browser for a markdown subdirectory under docs/. Used by the
 * /plans, /proposals, and /test-runs pages — each just hands a different
 * subdir. The api side already exposes /docs/tree and /docs/file via
 * the existing fileviewer module; this component reuses both.
 */
export function MarkdownTreeBrowser({ subdir, title, description, emptyText }: Props) {
  const [tree, setTree] = useState<TreeNode[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const [selectedPath, setSelectedPath] = useState<string | null>(null);
  const [content, setContent] = useState<string>("");
  const [contentLoading, setContentLoading] = useState(false);

  // Fetch the docs tree, then filter to the requested subdir.
  useEffect(() => {
    setLoading(true);
    fetch(`${AGENT_URL}/docs/tree`)
      .then((r) => r.json())
      .then((data) => {
        const root: TreeNode[] = data.tree || [];
        const subdirNode = root.find(
          (n) => n.type === "dir" && n.name === subdir,
        );
        const files = (subdirNode?.children || []).filter(
          (c) => c.type === "file" && c.name.endsWith(".md"),
        );
        // Most recent first by name (assuming YYYY-MM-DD prefix or natural order).
        files.sort((a, b) => b.name.localeCompare(a.name));
        setTree(files);
        if (files[0]) setSelectedPath(files[0].path);
      })
      .catch((e) => setError((e as Error).message))
      .finally(() => setLoading(false));
  }, [subdir]);

  // Fetch the selected file's contents.
  useEffect(() => {
    if (!selectedPath) return;
    setContentLoading(true);
    fetch(`${AGENT_URL}/docs/file?path=${encodeURIComponent(selectedPath)}`)
      .then((r) => r.json())
      .then((data) => setContent(data.content || ""))
      .catch((e) => setContent(`# Error loading file\n\n${(e as Error).message}`))
      .finally(() => setContentLoading(false));
  }, [selectedPath]);

  const formatLabel = useMemo(
    () => (filename: string) =>
      filename.replace(/\.md$/, "").replace(/-/g, " "),
    [],
  );

  return (
    <div className="flex h-full flex-col">
      <header className="border-b border-zinc-800 bg-zinc-900 px-8 py-5">
        <h1 className="text-xl font-semibold text-zinc-100">{title}</h1>
        <p className="mt-1 text-sm text-zinc-500">{description}</p>
      </header>

      {error && (
        <div className="mx-8 mt-4 rounded border border-red-900 bg-red-950/40 px-4 py-2 text-sm text-red-300">
          {error}
        </div>
      )}

      <div className="flex flex-1 min-h-0">
        {/* File list */}
        <aside className="w-72 shrink-0 overflow-y-auto border-r border-zinc-800 bg-zinc-950 p-3">
          {loading ? (
            <div className="px-3 py-2 text-xs text-zinc-500">Loading…</div>
          ) : tree.length === 0 ? (
            <div className="px-3 py-2 text-xs text-zinc-500">
              {emptyText || `No ${subdir} yet.`}
            </div>
          ) : (
            tree.map((file) => (
              <button
                key={file.path}
                type="button"
                onClick={() => setSelectedPath(file.path)}
                className={`block w-full rounded px-3 py-1.5 text-left text-sm transition ${
                  selectedPath === file.path
                    ? "bg-zinc-800/80 text-zinc-50"
                    : "text-zinc-400 hover:bg-zinc-900 hover:text-zinc-200"
                }`}
              >
                <span className="block truncate">{formatLabel(file.name)}</span>
              </button>
            ))
          )}
        </aside>

        {/* Content pane */}
        <main className="flex-1 min-w-0 overflow-y-auto px-8 py-6">
          {contentLoading ? (
            <div className="text-sm text-zinc-500">Loading…</div>
          ) : !selectedPath ? (
            <div className="text-sm text-zinc-500">
              Pick a file from the left to view it.
            </div>
          ) : (
            <article className="prose prose-invert prose-zinc max-w-3xl">
              <ReactMarkdown
                remarkPlugins={[remarkGfm]}
                rehypePlugins={[rehypeHighlight]}
              >
                {content}
              </ReactMarkdown>
            </article>
          )}
        </main>
      </div>
    </div>
  );
}
