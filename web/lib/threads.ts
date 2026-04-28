// localStorage-backed thread history for the sidebar.
// The agent's conversation state lives in Postgres; this is just the
// list of thread_ids the user has opened from this browser.

export type Thread = { id: string; firstMessage: string; createdAt: number };

const KEY = "make-skills-threads";
const MAX = 50;

export function listThreads(): Thread[] {
  if (typeof window === "undefined") return [];
  try {
    return JSON.parse(localStorage.getItem(KEY) || "[]") as Thread[];
  } catch {
    return [];
  }
}

export function rememberThread(id: string, firstMessage: string): void {
  if (typeof window === "undefined") return;
  const all = listThreads();
  if (all.find((t) => t.id === id)) return;
  all.unshift({ id, firstMessage, createdAt: Date.now() });
  localStorage.setItem(KEY, JSON.stringify(all.slice(0, MAX)));
}

export function clearThreads(): void {
  if (typeof window === "undefined") return;
  localStorage.removeItem(KEY);
}
