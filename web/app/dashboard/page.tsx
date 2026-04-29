import { redirect } from "next/navigation";

export default function DashboardPage() {
  // Old route — replaced by the custom /observability dashboard.
  // Grafana stays available for local ops at http://localhost:3001
  // but we no longer iframe it on humancensys.com.
  redirect("/observability");
}
