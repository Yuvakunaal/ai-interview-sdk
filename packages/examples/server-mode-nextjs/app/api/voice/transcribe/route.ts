import { ElevenLabsAdapter } from '@interview-sdk/adapter-elevenlabs';

// Built lazily on first request rather than at module scope: `next build`
// statically imports every route module during page-data collection, before
// any env vars are guaranteed to be set, so an eager throw here would fail
// the build itself rather than just an unconfigured request.
let voice: ElevenLabsAdapter | undefined;

function getVoice(): ElevenLabsAdapter {
  if (voice) return voice;

  if (!process.env.ELEVENLABS_API_KEY) {
    throw new Error(
      'ELEVENLABS_API_KEY is not set — add it to .env.local (never NEXT_PUBLIC_, this must stay server-only).',
    );
  }

  voice = new ElevenLabsAdapter({ apiKey: process.env.ELEVENLABS_API_KEY });
  return voice;
}

/**
 * Real STT via @interview-sdk/adapter-elevenlabs, kept entirely server-side
 * — see synthesize/route.ts for why. The client wrapper POSTs the recorded
 * answer's raw audio bytes as the request body and gets back { text }.
 */
export async function POST(request: Request): Promise<Response> {
  const audio = await request.arrayBuffer();
  const result = await getVoice().transcribe(audio);
  return Response.json({ text: result.text });
}
