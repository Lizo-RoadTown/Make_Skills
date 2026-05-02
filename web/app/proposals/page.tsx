import { MarkdownTreeBrowser } from "@/components/MarkdownTreeBrowser";

export default function ProposalsPage() {
  return (
    <MarkdownTreeBrowser
      subdir="proposals"
      title="Design proposals"
      description="Pre-decision design documents. Each proposal lives here while it's being shaped — when accepted, an ADR captures the decision and links back to the proposal as historical context."
      emptyText="No proposals yet."
    />
  );
}
