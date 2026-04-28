// Single integration point with the FastAPI agent.
// Matches the SSE shape emitted by platform/api/main.py /chat/stream:
//   data: {"event":"thread","thread_id":"..."}
//   data: {"event":"chunk","data":"..."}
//   data: {"event":"error","detail":"..."}
//   data: {"event":"done"}

const AGENT_URL = process.env.NEXT_PUBLIC_AGENT_URL || "http://localhost:8001";

export type StreamEvent =
  | { event: "thread"; thread_id: string }
  | { event: "chunk"; data: string }
  | { event: "error"; detail: string }
  | { event: "done" };

export async function* streamChat(
  message: string,
  threadId: string | null,
): AsyncGenerator<StreamEvent> {
  let res: Response;
  try {
    res = await fetch(`${AGENT_URL}/chat/stream`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message, thread_id: threadId }),
    });
  } catch (err) {
    yield { event: "error", detail: `network: ${(err as Error).message}` };
    return;
  }

  if (!res.ok || !res.body) {
    yield { event: "error", detail: `HTTP ${res.status}` };
    return;
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });

    let nl: number;
    while ((nl = buffer.indexOf("\n\n")) >= 0) {
      const raw = buffer.slice(0, nl).trim();
      buffer = buffer.slice(nl + 2);
      if (!raw.startsWith("data:")) continue;
      const payload = raw.slice(5).trim();
      try {
        yield JSON.parse(payload) as StreamEvent;
      } catch {
        // skip malformed events
      }
    }
  }
}
