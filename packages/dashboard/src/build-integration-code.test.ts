import type { Question, RubricDimensionInput } from '@interview-sdk/core';
import { describe, expect, it } from 'vitest';
import { buildIntegrationCode } from './build-integration-code.js';

const questions: Question[] = [
  { id: 'q1', prompt: 'Explain hash maps.', concepts: ['hashing'] },
];

const rubric: RubricDimensionInput[] = [{ id: 'technical', label: 'Technical', weight: 1 }];

function options(overrides: Partial<Parameters<typeof buildIntegrationCode>[0]> = {}) {
  return {
    questions,
    rubric,
    runtimeMode: 'hybrid' as const,
    includeFollowUps: true,
    sessionMinutes: 18,
    ...overrides,
  };
}

describe('buildIntegrationCode', () => {
  it('always recommends Server Mode, regardless of the local preview mode', () => {
    const code = buildIntegrationCode(options());
    expect(code).toContain('mode="server"');
    expect(code).toContain('apiBaseUrl="/api/interview/answer"');
  });

  it('embeds the current questions and rubric as real JSON, not placeholders', () => {
    const code = buildIntegrationCode(options());
    expect(code).toContain('"prompt": "Explain hash maps."');
    expect(code).toContain('"label": "Technical"');
  });

  it('sets maxFollowUpDepth to 1 when follow-ups are enabled, 0 when disabled', () => {
    expect(buildIntegrationCode(options({ includeFollowUps: true }))).toContain(
      'maxFollowUpDepth={1}',
    );
    expect(buildIntegrationCode(options({ includeFollowUps: false }))).toContain(
      'maxFollowUpDepth={0}',
    );
  });

  it('converts sessionMinutes to milliseconds', () => {
    const code = buildIntegrationCode(options({ sessionMinutes: 20 }));
    expect(code).toContain('sessionTimeoutMs={1200000}');
  });

  it('includes voice props for "voice" and "hybrid" modes, correctly adapting transcribe\'s shape', () => {
    // VoiceProviderAdapter.transcribe takes an ArrayBuffer/Uint8Array and
    // returns a TranscriptResult, but InterviewWidget's transcribe prop is
    // (audio: Blob) => Promise<string> — a direct pass-through of
    // voiceProvider.transcribe would be a type/runtime mismatch, so the
    // generated code must wrap it instead.
    for (const runtimeMode of ['voice', 'hybrid'] as const) {
      const code = buildIntegrationCode(options({ runtimeMode }));
      expect(code).toContain('synthesize={voiceProvider.synthesize.bind(voiceProvider)}');
      expect(code).toContain(
        'transcribe={async (audio) => (await voiceProvider.transcribe(await audio.arrayBuffer())).text}',
      );
    }
  });

  it('omits voice props entirely for "text" mode', () => {
    const code = buildIntegrationCode(options({ runtimeMode: 'text' }));
    expect(code).not.toContain('synthesize=');
    expect(code).not.toContain('transcribe=');
  });

  it('omits roleTitle when not provided', () => {
    const code = buildIntegrationCode(options());
    expect(code).not.toContain('roleTitle');
  });

  it('includes roleTitle when provided, with embedded quotes escaped', () => {
    const code = buildIntegrationCode(options({ roleTitle: 'Senior "Staff" Engineer' }));
    expect(code).toContain('roleTitle="Senior \\"Staff\\" Engineer"');
  });

  it('produces syntactically balanced JSX (every opening angle bracket has a matching close)', () => {
    const code = buildIntegrationCode(options({ roleTitle: 'Senior Engineer' }));
    const opens = code.match(/<InterviewWidget/g)?.length ?? 0;
    const selfCloses = code.match(/\/>/g)?.length ?? 0;
    expect(opens).toBe(1);
    expect(selfCloses).toBe(1);
  });
});
