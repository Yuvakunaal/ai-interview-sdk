import { ElevenLabsAdapter } from '@interview-sdk/adapter-elevenlabs';

if (!process.env.ELEVENLABS_API_KEY) {
  throw new Error(
    'ELEVENLABS_API_KEY is not set — add it to .env.local (never NEXT_PUBLIC_, this must stay server-only).',
  );
}

// "Rachel" (the adapter's default voice) is a library voice that requires a
// paid ElevenLabs plan to use via the API — confirmed by a real 402 from
// this account. "Sarah" is one of the premade voices this account's key can
// actually use.
const voice = new ElevenLabsAdapter({
  apiKey: process.env.ELEVENLABS_API_KEY,
  voiceId: 'EXAVITQu4vr4xnSDxMaL',
});

/**
 * Real TTS via @interview-sdk/adapter-elevenlabs, kept entirely server-side
 * — the browser only ever talks to this same-origin route, never sees the
 * ElevenLabs key. The client wrapper (lib/voice-client.ts) POSTs { text }
 * here and gets real audio bytes back, matching what QuestionAudio expects
 * from a synthesize() call.
 */
export async function POST(request: Request): Promise<Response> {
  const { text } = (await request.json()) as { text: string };
  const result = await voice.synthesize(text);
  return new Response(result.audio as BodyInit, {
    headers: { 'Content-Type': result.mimeType },
  });
}
