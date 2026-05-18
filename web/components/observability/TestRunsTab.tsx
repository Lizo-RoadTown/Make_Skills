"use client";
/**
 * Observability — Test runs tab.
 *
 * Friction-surface logs from real end-to-end runs. Each file is a
 * step-by-step narrative of what worked, what broke, what wasn't
 * documented. Renders the existing MarkdownTreeBrowser pointed at
 * docs/test-runs/.
 */
import { MarkdownTreeBrowser } from "@/components/MarkdownTreeBrowser";

export function TestRunsTab() {
  return (
    <MarkdownTreeBrowser
      subdir="test-runs"
      title="Test runs"
      description="Friction-surface logs from real end-to-end runs. Each file is a step-by-step narrative of what worked, what broke, what wasn't documented."
      emptyText="No test runs yet."
    />
  );
}
