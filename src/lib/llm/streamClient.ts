/**
 * Browser-side reader for POST /api/turn/stream (SSE). FEATURE_PLAN.md §1.2.
 *
 * Falls back cleanly: if the endpoint isn't there or doesn't stream, the caller
 * catches `StreamUnavailable` and POSTs /api/turn instead.
 */

export class StreamUnavailable extends Error {}

export interface StreamHandlers {
  onText: (delta: string) => void;
  onRoll: (roll: unknown) => void;
  /** Fired once, for either terminal event. `kind` distinguishes them. */
  onDone: (result: { kind: string } & Record<string, unknown>) => void;
  onError: (message: string) => void;
}

export async function runTurnStream(body: unknown, h: StreamHandlers): Promise<void> {
  let res: Response;
  try {
    res = await fetch("/api/turn/stream", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
  } catch (e) {
    throw new StreamUnavailable((e as Error).message);
  }

  const ctype = res.headers.get("content-type") ?? "";
  if (!ctype.includes("text/event-stream") || !res.body) {
    // A validation error (JSON) or a proxy that buffered the whole response.
    if (ctype.includes("application/json")) {
      const j = (await res.json().catch(() => null)) as { error?: string } | null;
      if (j?.error) {
        h.onError(j.error);
        return;
      }
    }
    throw new StreamUnavailable(`non-stream response (${res.status} ${ctype})`);
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buf = "";

  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    buf += decoder.decode(value, { stream: true });

    let sep: number;
    while ((sep = buf.indexOf("\n\n")) !== -1) {
      const frame = buf.slice(0, sep);
      buf = buf.slice(sep + 2);
      let event = "message";
      const dataLines: string[] = [];
      for (const line of frame.split("\n")) {
        if (line.startsWith("event:")) event = line.slice(6).trim();
        else if (line.startsWith("data:")) dataLines.push(line.slice(5).trimStart());
      }
      if (dataLines.length === 0) continue;
      let data: unknown;
      try {
        data = JSON.parse(dataLines.join("\n"));
      } catch {
        continue;
      }
      if (event === "text") h.onText((data as { delta: string }).delta);
      else if (event === "roll") h.onRoll(data);
      else if (event === "awaiting-roll" || event === "done") h.onDone(data as { kind: string } & Record<string, unknown>);
      else if (event === "error") h.onError((data as { message: string }).message);
    }
  }
}
