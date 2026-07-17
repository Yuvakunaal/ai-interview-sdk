import type { Question, RubricDimensionInput } from '@interview-sdk/core';

export type RuntimeMode = 'voice' | 'hybrid' | 'text';

export interface IntegrationCodeOptions {
  questions: Question[];
  rubric: RubricDimensionInput[];
  runtimeMode: RuntimeMode;
  includeFollowUps: boolean;
  sessionMinutes: number;
  roleTitle?: string;
}

/**
 * Generates the exact <InterviewWidget> integration code for the current
 * dashboard configuration. Always outputs Server Mode — the
 * security-correct default (keys and scoring stay server-side) — even
 * though this dashboard's own live preview runs Client Mode against a
 * local mock adapter.
 */
export function buildIntegrationCode({
  questions,
  rubric,
  runtimeMode,
  includeFollowUps,
  sessionMinutes,
  roleTitle,
}: IntegrationCodeOptions): string {
  const hasVoice = runtimeMode !== 'text';
  const roleTitleProp = roleTitle
    ? `
      roleTitle="${roleTitle.replace(/"/g, '\\"')}"`
    : '';
  // Proxies through your own backend rather than constructing a voice
  // adapter here — this file is always Server Mode, and calling a voice
  // provider directly from the browser would expose that key client-side,
  // undermining the exact guarantee Server Mode exists for. Mirrors
  // packages/examples/server-mode-nextjs's own voice-client.ts pattern.
  const voiceProps = hasVoice
    ? `
      synthesize={async (text) => {
        const response = await fetch('/api/voice/synthesize', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ text }),
        });
        const audio = await response.arrayBuffer();
        return { audio, mimeType: response.headers.get('Content-Type') ?? 'audio/mpeg' };
      }}
      transcribe={async (audio) => {
        const response = await fetch('/api/voice/transcribe', {
          method: 'POST',
          headers: { 'Content-Type': 'application/octet-stream' },
          body: audio,
        });
        const { text } = await response.json();
        return text;
      }}`
    : '';

  const voiceRoutesNote = hasVoice
    ? `
// \`interview-sdk init\` scaffolds /api/interview/answer, but not the two
// voice routes below — you write those yourself. Each just wraps a real
// voice adapter (@interview-sdk/adapter-deepgram or
// @interview-sdk/adapter-elevenlabs) server-side: POST /api/voice/synthesize
// takes { text }, returns synthesized audio bytes; POST /api/voice/transcribe
// takes raw audio bytes, returns { text }. See
// packages/examples/server-mode-nextjs/app/api/voice in the SDK repo for a
// complete, working reference implementation of both.
`
    : '';

  return `import { InterviewWidget } from '@interview-sdk/react';
import '@interview-sdk/react/styles.css';
${voiceRoutesNote}
const questions = ${JSON.stringify(questions, null, 2)};

const rubric = ${JSON.stringify(rubric, null, 2)};

export function CandidateInterview() {
  return (
    <InterviewWidget
      mode="server"
      apiBaseUrl="/api/interview/answer"
      questions={questions}
      rubric={rubric}
      maxFollowUpDepth={${includeFollowUps ? 1 : 0}}
      sessionTimeoutMs={${sessionMinutes * 60 * 1000}}${roleTitleProp}${voiceProps}
    />
  );
}`;
}
