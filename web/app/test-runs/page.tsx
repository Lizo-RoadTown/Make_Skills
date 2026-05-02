import { MarkdownTreeBrowser } from "@/components/MarkdownTreeBrowser";

export default function TestRunsPage() {
  return (
    <MarkdownTreeBrowser
      subdir="test-runs"
      title="Test runs"
      description="Test outcomes from production-shape verification flows. Each run captures the test cases attempted, what passed, what failed, and the friction surfaces encountered along the way."
      emptyText="No test runs yet."
    />
  );
}
