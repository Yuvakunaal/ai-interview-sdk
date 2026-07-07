import { ElevenLabsAdapter } from '@interview-sdk/adapter-elevenlabs';

if (!process.env.ELEVENLABS_API_KEY) {
  throw new Error(
    'ELEVENLABS_API_KEY is not set — add it to .env.local (never NEXT_PUBLIC_, this must stay server-only).',
  );
}

const voice = new ElevenLabsAdapter({ apiKey: process.env.ELEVENLABS_API_KEY });

/**
 * Real STT via @interview-sdk/adapter-elevenlabs, kept entirely server-side
 * — see synthesize/route.ts for why. The client wrapper POSTs the recorded
 * answer's raw audio bytes as the request body and gets back { text }.
 */
export async function POST(request: Request): Promise<Response> {
  const audio = await request.arrayBuffer();
  const result = await voice.transcribe(audio);
  return Response.json({ text: result.text });
}
