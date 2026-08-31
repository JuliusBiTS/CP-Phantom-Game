/**
 * POST /api/transcribe — server-side speech-to-text, if a key is configured.
 *
 * Optional. Set ONE of:
 *   GROQ_API_KEY   → Groq whisper-large-v3-turbo (has a free tier; fast, accurate)
 *   OPENAI_API_KEY → OpenAI whisper-1 ($0.006/min)
 * If neither is set the endpoint reports unavailable and the client falls back
 * to local Whisper / the Web Speech API — everything still works with no key.
 *
 * GET  /api/transcribe → { available, provider }
 * POST multipart/form-data { audio: File } → { text }
 */

import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const maxDuration = 60;

function provider(): { url: string; key: string; model: string; name: string } | null {
  if (process.env.GROQ_API_KEY) {
    return {
      url: "https://api.groq.com/openai/v1/audio/transcriptions",
      key: process.env.GROQ_API_KEY,
      model: "whisper-large-v3-turbo",
      name: "groq",
    };
  }
  if (process.env.OPENAI_API_KEY) {
    return {
      url: "https://api.openai.com/v1/audio/transcriptions",
      key: process.env.OPENAI_API_KEY,
      model: "whisper-1",
      name: "openai",
    };
  }
  return null;
}

export function GET() {
  const p = provider();
  return NextResponse.json({ available: !!p, provider: p?.name ?? null });
}

export async function POST(req: NextRequest) {
  const p = provider();
  if (!p) {
    return NextResponse.json(
      { error: "No transcription key configured (set GROQ_API_KEY or OPENAI_API_KEY)." },
      { status: 501 },
    );
  }

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json({ error: "expected multipart/form-data" }, { status: 400 });
  }
  const audio = form.get("audio");
  if (!(audio instanceof Blob)) {
    return NextResponse.json({ error: "missing 'audio' file" }, { status: 400 });
  }
  if (audio.size > 25 * 1024 * 1024) {
    return NextResponse.json({ error: "audio too large (25 MB max)" }, { status: 413 });
  }

  const upstream = new FormData();
  upstream.append("file", audio, "audio.webm");
  upstream.append("model", p.model);
  upstream.append("response_format", "json");
  upstream.append("language", "en");

  try {
    const res = await fetch(p.url, {
      method: "POST",
      headers: { authorization: `Bearer ${p.key}` },
      body: upstream,
    });
    if (!res.ok) {
      const detail = await res.text();
      console.error(`[/api/transcribe] ${p.name} ${res.status}`, detail.slice(0, 500));
      return NextResponse.json({ error: `${p.name} transcription failed (${res.status})` }, { status: 502 });
    }
    const data = (await res.json()) as { text?: string };
    return NextResponse.json({ text: (data.text ?? "").trim() });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
