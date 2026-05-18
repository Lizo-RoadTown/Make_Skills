import { redirect } from "next/navigation";

/**
 * /test-runs consolidated into /observability?tab=test-runs per the
 * UX_CONTRACT "one place per concern" rule.
 */
export default function TestRunsRedirect() {
  redirect("/observability?tab=test-runs");
}
