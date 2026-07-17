import { mockTranscribe } from '../../../../lib/mock-voice';

// TODO: swap mockTranscribe() for a real provider before shipping, e.g.:
//   import { ElevenLabsAdapter } from '@interview-sdk/adapter-elevenlabs';
//   const voice = new ElevenLabsAdapter({ apiKey: process.env.ELEVENLABS_API_KEY! });
//   (await voice.transcribe(audio)).text

/**
 * Server-side STT proxy — see synthesize/route.ts for why this stays
 * server-side even in mock form. The client wrapper POSTs the recorded
 * answer's raw audio bytes as the request body and gets back { text }.
 */
export async function POST(request: Request): Promise<Response> {
  const audio = await request.blob();
  const text = await mockTranscribe(audio);
  return Response.json({ text });
}
