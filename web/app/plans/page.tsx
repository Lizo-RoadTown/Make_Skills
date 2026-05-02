import { MarkdownTreeBrowser } from "@/components/MarkdownTreeBrowser";

export default function PlansPage() {
  return (
    <MarkdownTreeBrowser
      subdir="plans"
      title="Plans"
      description="Dated 'what to do next' snapshots. Each plan is append-only — newer files supersede older ones; older files stay readable as historical context."
      emptyText="No plans yet. Run the next-actions-planning skill to generate one."
    />
  );
}
