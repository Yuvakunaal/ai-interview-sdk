import type { Question } from '@interview-sdk/core';
import { describe, expect, it } from 'vitest';
import { CliUsageError } from './errors.js';
import { PERSONAS, getPersona } from './personas.js';

const question: Question = {
  id: 'q1',
  prompt: 'Explain how hash maps handle collisions.',
  concepts: ['hashing', 'collisions'],
};

describe('PERSONAS', () => {
  it('defines exactly the five personas from the spec', () => {
    expect(PERSONAS.map((persona) => persona.id)).toEqual([
      'strong',
      'weak',
      'off_topic',
      'silent',
      'adversarial',
    ]);
  });

  it('strong mentions every declared concept', () => {
    const strong = getPersona('strong');
    const { text } = strong.answer(question);
    expect(text).toContain('hashing');
    expect(text).toContain('collisions');
  });

  it('strong falls back to a generic thorough answer when no concepts are declared', () => {
    const strong = getPersona('strong');
    const { text } = strong.answer({ id: 'q2', prompt: 'Describe your approach.' });
    expect(text.length).toBeGreaterThan(20);
  });

  it('silent produces an empty, silent answer', () => {
    const silent = getPersona('silent');
    const { text, isSilence } = silent.answer(question);
    expect(text).toBe('');
    expect(isSilence).toBe(true);
  });

  it('adversarial answer contains an injection attempt', () => {
    const adversarial = getPersona('adversarial');
    const { text } = adversarial.answer(question);
    expect(text.toLowerCase()).toContain('ignore all previous instructions');
  });

  it('is deterministic — the same persona answers the same question identically every time', () => {
    const weak = getPersona('weak');
    expect(weak.answer(question)).toEqual(weak.answer(question));
  });

  it('throws CliUsageError for an unknown persona id', () => {
    expect(() => getPersona('nonexistent')).toThrow(CliUsageError);
  });
});
