import { describe, expect, it } from 'vitest';
import { ConfigValidationError } from '../errors.js';
import type { InterviewConfig } from '../types.js';
import { validateInterviewConfig } from './validate-config.js';

function baseConfig(overrides: Partial<InterviewConfig> = {}): InterviewConfig {
  return {
    questions: [{ id: 'q1', prompt: 'Explain hash maps.' }],
    rubric: [{ id: 'technical', label: 'Technical', weight: 1 }],
    ...overrides,
  };
}

describe('validateInterviewConfig', () => {
  it('accepts a minimal valid configuration without throwing', () => {
    expect(() => validateInterviewConfig(baseConfig())).not.toThrow();
  });

  it('fails loud on an empty questions array', () => {
    expect(() => validateInterviewConfig(baseConfig({ questions: [] }))).toThrow(
      ConfigValidationError,
    );
  });

  it('fails loud on duplicate question ids', () => {
    expect(() =>
      validateInterviewConfig(
        baseConfig({
          questions: [
            { id: 'q1', prompt: 'A' },
            { id: 'q1', prompt: 'B' },
          ],
        }),
      ),
    ).toThrow(/Duplicate question id/);
  });

  it('fails loud on a question with a blank id', () => {
    expect(() =>
      validateInterviewConfig(
        baseConfig({ questions: [{ id: '   ', prompt: 'Explain hash maps.' }] }),
      ),
    ).toThrow(/missing an id/);
  });

  it('fails loud on a question missing a prompt', () => {
    expect(() =>
      validateInterviewConfig(baseConfig({ questions: [{ id: 'q1', prompt: '' }] })),
    ).toThrow(/missing a prompt/);
  });

  it('fails loud (not crashes) on a non-string question id from an untyped config source', () => {
    expect(() =>
      validateInterviewConfig(
        baseConfig({
          // Simulates a JSON/CMS-sourced config where "id" isn't guaranteed
          // to be a string at runtime, despite the TypeScript type.
          questions: [{ id: 123 as unknown as string, prompt: 'Explain hash maps.' }],
        }),
      ),
    ).toThrow(/missing an id/);
  });

  it('fails loud (not crashes) on a non-string question prompt from an untyped config source', () => {
    expect(() =>
      validateInterviewConfig(
        baseConfig({
          questions: [{ id: 'q1', prompt: { en: 'Explain hash maps.' } as unknown as string }],
        }),
      ),
    ).toThrow(/missing a prompt/);
  });

  it('fails loud on a missing rubric', () => {
    expect(() => validateInterviewConfig(baseConfig({ rubric: [] }))).toThrow(/rubric is required/);
  });

  it('fails loud on invalid rubric weights', () => {
    expect(() =>
      validateInterviewConfig(
        baseConfig({ rubric: [{ id: 'technical', label: 'Technical', weight: -1 }] }),
      ),
    ).toThrow(/invalid weight/);
  });

  it('fails loud on an invalid webhook URL', () => {
    expect(() => validateInterviewConfig(baseConfig({ webhook: { url: 'not-a-url' } }))).toThrow(
      /Invalid webhook URL/,
    );
  });

  it('accepts a well-formed https webhook URL', () => {
    expect(() =>
      validateInterviewConfig(
        baseConfig({ webhook: { url: 'https://example.com/webhooks/interview' } }),
      ),
    ).not.toThrow();
  });

  it('fails loud on an invalid voice language tag', () => {
    expect(() =>
      validateInterviewConfig(baseConfig({ voice: { provider: 'deepgram', language: '???' } })),
    ).toThrow(/Invalid voice language tag/);
  });

  it('accepts valid BCP-47-ish language tags for English, Hindi, and Telugu', () => {
    for (const language of ['en', 'hi', 'te']) {
      expect(() => validateInterviewConfig(baseConfig({ language }))).not.toThrow();
    }
  });

  it('fails loud on an invalid top-level language tag', () => {
    expect(() => validateInterviewConfig(baseConfig({ language: '1234' }))).toThrow(
      /Invalid language tag/,
    );
  });

  it('fails loud on an invalid difficulty setting', () => {
    // @ts-expect-error - intentionally invalid to prove it fails loud
    expect(() => validateInterviewConfig(baseConfig({ difficulty: 'impossible' }))).toThrow(
      /Invalid difficulty/,
    );
  });

  it('fails loud on a negative maxFollowUpDepth', () => {
    expect(() => validateInterviewConfig(baseConfig({ maxFollowUpDepth: -1 }))).toThrow(
      /Invalid maxFollowUpDepth/,
    );
  });

  it('fails loud on a non-positive sessionTimeoutMs', () => {
    expect(() => validateInterviewConfig(baseConfig({ sessionTimeoutMs: 0 }))).toThrow(
      /Invalid sessionTimeoutMs/,
    );
  });

  it('collects every issue in a single throw rather than stopping at the first', () => {
    try {
      validateInterviewConfig(
        baseConfig({
          questions: [],
          rubric: [{ id: 'technical', label: 'Technical', weight: -1 }],
          webhook: { url: 'not-a-url' },
        }),
      );
      expect.fail('expected validateInterviewConfig to throw');
    } catch (error) {
      expect(error).toBeInstanceOf(ConfigValidationError);
      const issues = (error as ConfigValidationError).issues;
      expect(issues.length).toBeGreaterThanOrEqual(3);
    }
  });

  it('does not require an answer key on a question (optional, not a config error)', () => {
    expect(() =>
      validateInterviewConfig(
        baseConfig({ questions: [{ id: 'q1', prompt: 'Explain hash maps.' }] }),
      ),
    ).not.toThrow();
  });
});
