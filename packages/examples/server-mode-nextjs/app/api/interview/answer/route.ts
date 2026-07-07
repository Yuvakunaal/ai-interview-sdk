import { OpenAIAdapter } from '@interview-sdk/adapter-openai';
import { createInterviewAnswerHandler, ServerAnswerProcessor } from '@interview-sdk/server';
import OpenAI from 'openai';
import { questions, rubric } from '../../../../lib/questions';

// Built lazily on first request rather than at module scope: `next build`
// statically imports every route module during page-data collection, before
// any env vars are guaranteed to be set, so an eager throw here would fail
// the build itself rather than just an unconfigured request.
let handler: ReturnType<typeof createInterviewAnswerHandler> | undefined;

function getHandler(): ReturnType<typeof createInterviewAnswerHandler> {
  if (handler) return handler;

  if (!process.env.GROQ_API_KEY) {
    throw new Error(
      'GROQ_API_KEY is not set — add it to .env.local (never NEXT_PUBLIC_, this must stay server-only).',
    );
  }

  // Groq exposes an OpenAI-compatible endpoint (including the Responses API
  // this adapter uses), so the existing, unmodified OpenAIAdapter works
  // against it directly — just inject a client pointed at Groq's baseURL
  // instead of OpenAI's. Confirmed with a real request against
  // https://api.groq.com/openai/v1/responses before wiring this in.
  const groqClient = new OpenAI({
    apiKey: process.env.GROQ_API_KEY,
    baseURL: 'https://api.groq.com/openai/v1',
  });

  const processor = new ServerAnswerProcessor({
    questions,
    rubric,
    adapter: new OpenAIAdapter({ client: groqClient, model: 'llama-3.1-8b-instant' }),
    signingSecret: process.env.INTERVIEW_SIGNING_SECRET,
    // Must match the client's maxFollowUpDepth (app/page.tsx) — otherwise the
    // server could decide to generate a follow-up the client's own flow
    // engine will then reject for exceeding its configured depth.
    followUpConfig: { maxDepth: 1 },
  });

  handler = createInterviewAnswerHandler(processor, {
    onError: (error) => console.error('interview answer processing failed', error),
  });
  return handler;
}

export async function POST(request: Request): Promise<Response> {
  return getHandler()(request);
}
