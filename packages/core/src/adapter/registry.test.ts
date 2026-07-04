import { describe, expect, it } from 'vitest';
import { AdapterNotRegisteredError } from '../errors.js';
import { AdapterRegistry } from './registry.js';
import type { AIProviderAdapter, VoiceProviderAdapter } from './types.js';

function fakeAIProvider(id: string): AIProviderAdapter {
  return {
    id,
    async complete() {
      return { text: '{}' };
    },
  };
}

function fakeVoiceProvider(id: string): VoiceProviderAdapter {
  return { id };
}

describe('AdapterRegistry', () => {
  it('registers and retrieves an AI provider adapter by id', () => {
    const registry = new AdapterRegistry();
    const adapter = fakeAIProvider('openai');
    registry.registerAIProvider(adapter);

    expect(registry.getAIProvider('openai')).toBe(adapter);
  });

  it('throws AdapterNotRegisteredError for an unregistered AI provider', () => {
    const registry = new AdapterRegistry();
    expect(() => registry.getAIProvider('openai')).toThrow(AdapterNotRegisteredError);
  });

  it('registers and retrieves a voice provider adapter by id', () => {
    const registry = new AdapterRegistry();
    const adapter = fakeVoiceProvider('deepgram');
    registry.registerVoiceProvider(adapter);

    expect(registry.getVoiceProvider('deepgram')).toBe(adapter);
  });

  it('throws AdapterNotRegisteredError for an unregistered voice provider', () => {
    const registry = new AdapterRegistry();
    expect(() => registry.getVoiceProvider('deepgram')).toThrow(AdapterNotRegisteredError);
  });

  it('lists registered provider ids', () => {
    const registry = new AdapterRegistry();
    registry.registerAIProvider(fakeAIProvider('openai'));
    registry.registerAIProvider(fakeAIProvider('claude'));
    registry.registerVoiceProvider(fakeVoiceProvider('deepgram'));

    expect(registry.listAIProviders().sort()).toEqual(['claude', 'openai']);
    expect(registry.listVoiceProviders()).toEqual(['deepgram']);
  });

  it('overwrites a previously registered adapter with the same id (one-line provider swap)', () => {
    const registry = new AdapterRegistry();
    const first = fakeAIProvider('openai');
    const second = fakeAIProvider('openai');
    registry.registerAIProvider(first);
    registry.registerAIProvider(second);

    expect(registry.getAIProvider('openai')).toBe(second);
  });
});
