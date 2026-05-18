import { redirect } from "next/navigation";

/**
 * /memory consolidated into /observability?tab=memory per the
 * UX_CONTRACT "one place per concern" rule.
 */
export default function MemoryRedirect() {
  redirect("/observability?tab=memory");
}
