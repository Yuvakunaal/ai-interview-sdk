import { ConfigValidationError } from '../errors.js';
import {
  ProviderAuthError,
  ProviderConnectionError,
  ProviderInvalidRequestError,
  ProviderOverloadedError,
  ProviderRateLimitError,
  ProviderTimeoutError,
} from '../errors.js';
import type { AIProviderAdapter, CompletionRequest, CompletionResponse } from './types.js';

export interface FailoverAdapterConfig {
  adapters: AIProviderAdapter[];
  isFailoverEligible?: (error: unknown) => boolean;
}

function defaultIsFailoverEligible(error: unknown): boolean {
  return (
    error instanceof ProviderAuthError ||
    error instanceof ProviderRateLimitError ||
    error instanceof ProviderOverloadedError ||
    error instanceof ProviderConnectionError ||
    error instanceof ProviderTimeoutError ||
    error instanceof ProviderInvalidRequestError
  );
}

/**
 * Composite AIProviderAdapter that tries each adapter in order, falling
 * over to the next on a failover-eligible error. Implements the same
 * interface as any single adapter, so it can be registered or passed
 * anywhere an AIProviderAdapter is expected — multi-provider failover
 * becomes a one-line config change, per §12's Adapter Registry design.
 */
export class FailoverAdapter implements AIProviderAdapter {
  readonly id: string;
  private readonly adapters: AIProviderAdapter[];
  private readonly isFailoverEligible: (error: unknown) => boolean;

  constructor(config: FailoverAdapterConfig) {
    if (!config.adapters || config.adapters.length === 0) {
      throw new ConfigValidationError(['FailoverAdapter requires at least one adapter.']);
    }
    this.adapters = config.adapters;
    this.id = `failover(${this.adapters.map((adapter) => adapter.id).join(',')})`;
    this.isFailoverEligible = config.isFailoverEligible ?? defaultIsFailoverEligible;
  }

  async complete(request: CompletionRequest): Promise<CompletionResponse> {
    let lastError: unknown;
    for (const adapter of this.adapters) {
      try {
        return await adapter.complete(request);
      } catch (error) {
        lastError = error;
        if (!this.isFailoverEligible(error)) {
          throw error;
        }
      }
    }
    throw lastError;
  }
}
