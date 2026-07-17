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

  it('includes voice props for "voice" and "hybrid" modes that proxy through the developer\'s own backend', () => {
    // This is always Server Mode output — constructing a voice adapter (or
    // referencing one, e.g. "voiceProvider") directly here would either be
    // an undefined-variable bug or, if it were defined, expose that voice
    // key client-side, undermining the whole point of Server Mode. The
    // generated synthesize/transcribe must be real, self-contained fetch
    // calls to the developer's own /api/voice/* routes, matching
    // packages/examples/server-mode-nextjs's proven voice-client.ts pattern.
    for (const runtimeMode of ['voice', 'hybrid'] as const) {
      const code = buildIntegrationCode(options({ runtimeMode }));
      expect(code).not.toContain('voiceProvider');
      expect(code).toContain("fetch('/api/voice/synthesize'");
      expect(code).toContain("fetch('/api/voice/transcribe'");
      expect(code).toContain('synthesize={async (text) =>');
      expect(code).toContain('transcribe={async (audio) =>');
    }
  });

  it('notes that the two voice routes need to be hand-written, since interview-sdk init only scaffolds the answer route', () => {
    for (const runtimeMode of ['voice', 'hybrid'] as const) {
      const code = buildIntegrationCode(options({ runtimeMode }));
      expect(code).toContain('interview-sdk init` scaffolds /api/interview/answer');
      expect(code).toContain('server-mode-nextjs/app/api/voice');
    }
  });

  it('omits voice props and the voice-routes note entirely for "text" mode', () => {
    const code = buildIntegrationCode(options({ runtimeMode: 'text' }));
    expect(code).not.toContain('synthesize=');
    expect(code).not.toContain('transcribe=');
    expect(code).not.toContain('/api/voice/');
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
