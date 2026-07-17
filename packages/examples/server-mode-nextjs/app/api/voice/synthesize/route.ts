import { mockSynthesize } from '../../../../lib/mock-voice';

// TODO: swap mockSynthesize() for a real provider before shipping, e.g.:
//   import { ElevenLabsAdapter } from '@interview-sdk/adapter-elevenlabs';
//   const voice = new ElevenLabsAdapter({ apiKey: process.env.ELEVENLABS_API_KEY! });
//   await voice.synthesize(text)

/**
 * Server-side TTS proxy, kept entirely server-side even in this mock form —
 * the browser only ever talks to this same-origin route, never a provider
 * key. The client wrapper (lib/voice-client.ts) POSTs { text } here and gets
 * back audio bytes, matching what QuestionAudio expects from a synthesize()
 * call. Swapping in a real provider (see TODO above) doesn't change that
 * shape or the client wrapper at all.
 */
export async function POST(request: Request): Promise<Response> {
  const { text } = (await request.json()) as { text: string };
  const result = await mockSynthesize(text);
  return new Response(result.audio as BodyInit, {
    headers: { 'Content-Type': result.mimeType },
  });
}
