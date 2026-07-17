import type { Question, RubricDimensionInput, SynthesisResult } from '@interview-sdk/core';
import { InterviewWidget } from '@interview-sdk/react';
import '@interview-sdk/react/styles.css';
import { ElevenLabsAdapter } from '@interview-sdk/adapter-elevenlabs';
import { OpenAIAdapter } from '@interview-sdk/adapter-openai';
import OpenAI from 'openai';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';

// The real, unwrapped <InterviewWidget> — no page chrome, no custom CSS of
// its own, just @interview-sdk/react/styles.css (the component's own real
// stylesheet, which is designed to own the full page by itself). This is
// what a candidate actually sees.
//
// Real providers, not mocks:
// - Evaluation: Groq's OpenAI-compatible endpoint via the unmodified
//   OpenAIAdapter, same pattern as packages/examples/server-mode-nextjs.
// - Voice input: a real ElevenLabsAdapter.transcribe() call.
// - Voice output: Groq's Orpheus TTS (canopylabs/orpheus-v1-english,
//   female "tara" voice) via the same Groq key. Note: the model needs a
//   one-time terms acceptance on the Groq console; until then the API
//   returns 400 model_terms_required and QuestionAudio silently falls back
//   to text-only prompts (its designed failure mode) rather than breaking.
//   (ElevenLabs TTS isn't used here: this account's free plan returns 402
//   payment_required for prebuilt voices via the API.)

const { VITE_GROQ_API_KEY, VITE_ELEVENLABS_API_KEY } = import.meta.env;

if (!VITE_GROQ_API_KEY) {
  throw new Error('VITE_GROQ_API_KEY is not set — add it to packages/examples/basic-demo/.env.local');
}
if (!VITE_ELEVENLABS_API_KEY) {
  throw new Error(
    'VITE_ELEVENLABS_API_KEY is not set — add it to packages/examples/basic-demo/.env.local',
  );
}

const questions: Question[] = [
  {
    id: 'q1',
    prompt:
      'What is the purpose of the SELECT statement in SQL and how do you use it to retrieve data from a table?',
    concepts: ['SQL fundamentals', 'SELECT statement', 'data retrieval'],
  },
  {
    id: 'q2',
    prompt:
      'Explain the different types of JOINs in SQL (INNER JOIN, LEFT JOIN, RIGHT JOIN, FULL OUTER JOIN) and when you would use each one.',
    concepts: [
      'SQL JOINs',
      'INNER JOIN',
      'LEFT JOIN',
      'RIGHT JOIN',
      'FULL OUTER JOIN',
      'table relationships',
    ],
  },
  {
    id: 'q3',
    prompt:
      'How do you use the WHERE clause in SQL to filter records? Explain the difference between WHERE and HAVING clauses.',
    concepts: ['SQL WHERE clause', 'HAVING clause', 'filtering records', 'conditional queries'],
  },
];

const rubric: RubricDimensionInput[] = [
  { id: 'technical', label: 'Technical accuracy', weight: 3 },
  { id: 'communication', label: 'Communication clarity', weight: 1 },
  { id: 'systems', label: 'Systems thinking', weight: 2 },
];

// Groq exposes an OpenAI-compatible endpoint (including the Responses API
// this adapter uses), so the existing, unmodified OpenAIAdapter works
// against it directly — just inject a client pointed at Groq's baseURL.
// dangerouslyAllowBrowser is required here specifically because this is
// Client Mode: the whole key ships to the browser, which is exactly why
// Client Mode is prototyping-only (see InterviewWidget's own production
// guard).
const groqClient = new OpenAI({
  apiKey: VITE_GROQ_API_KEY,
  baseURL: 'https://api.groq.com/openai/v1',
  dangerouslyAllowBrowser: true,
});

const adapter = new OpenAIAdapter({ client: groqClient, model: 'llama-3.1-8b-instant' });

const voiceAdapter = new ElevenLabsAdapter({ apiKey: VITE_ELEVENLABS_API_KEY });

// Real text-to-speech on the same Groq key — "tara" is one of Orpheus's
// female voices. Returns the SynthesisResult shape QuestionAudio expects.
async function synthesizeWithGroq(text: string): Promise<SynthesisResult> {
  const response = await groqClient.audio.speech.create({
    model: 'canopylabs/orpheus-v1-english',
    voice: 'tara',
    input: text,
    response_format: 'wav',
  });
  return { audio: await response.arrayBuffer(), mimeType: 'audio/wav' };
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <InterviewWidget
      questions={questions}
      rubric={rubric}
      mode="client"
      adapter={adapter}
      maxFollowUpDepth={1}
      sessionTimeoutMs={1080000}
      synthesize={synthesizeWithGroq}
      transcribe={async (audio) => (await voiceAdapter.transcribe(await audio.arrayBuffer())).text}
      onSessionEnd={(report) => console.log('Interview finished:', report)}
    />
  </StrictMode>,
);
