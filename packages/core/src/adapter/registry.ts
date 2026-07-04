import { AdapterNotRegisteredError } from '../errors.js';
import type { AIProviderAdapter, VoiceProviderAdapter } from './types.js';

export class AdapterRegistry {
  private readonly aiProviders = new Map<string, AIProviderAdapter>();
  private readonly voiceProviders = new Map<string, VoiceProviderAdapter>();

  registerAIProvider(adapter: AIProviderAdapter): void {
    this.aiProviders.set(adapter.id, adapter);
  }

  getAIProvider(id: string): AIProviderAdapter {
    const adapter = this.aiProviders.get(id);
    if (!adapter) {
      throw new AdapterNotRegisteredError(
        `No AI provider adapter registered for "${id}". Install and register ` +
          `@interview-sdk/adapter-${id} (or your own adapter with that id) before use.`,
      );
    }
    return adapter;
  }

  registerVoiceProvider(adapter: VoiceProviderAdapter): void {
    this.voiceProviders.set(adapter.id, adapter);
  }

  getVoiceProvider(id: string): VoiceProviderAdapter {
    const adapter = this.voiceProviders.get(id);
    if (!adapter) {
      throw new AdapterNotRegisteredError(
        `No voice provider adapter registered for "${id}". Install and register ` +
          `@interview-sdk/adapter-${id} (or your own adapter with that id) before use.`,
      );
    }
    return adapter;
  }

  listAIProviders(): string[] {
    return Array.from(this.aiProviders.keys());
  }

  listVoiceProviders(): string[] {
    return Array.from(this.voiceProviders.keys());
  }
}
