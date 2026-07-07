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
  const voiceProps = hasVoice
    ? `
      synthesize={voiceProvider.synthesize.bind(voiceProvider)}
      transcribe={async (audio) => (await voiceProvider.transcribe(await audio.arrayBuffer())).text}`
    : '';

  return `import { InterviewWidget } from '@interview-sdk/react';
import '@interview-sdk/react/styles.css';

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
