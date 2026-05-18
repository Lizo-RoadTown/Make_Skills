import { redirect } from "next/navigation";

/**
 * /sessions consolidated into /observability?tab=sessions per the
 * UX_CONTRACT "one place per concern" rule. /sessions/[thread_id]
 * (the detail/replay view) is preserved separately.
 */
export default function SessionsRedirect() {
  redirect("/observability?tab=sessions");
}
