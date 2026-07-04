import OpenAI from 'openai';
import {
  ProviderAuthError,
  ProviderConnectionError,
  ProviderContextLengthExceededError,
  ProviderInvalidRequestError,
  ProviderOverloadedError,
  ProviderRateLimitError,
  ProviderTimeoutError,
  type AIMessage,
  type AIProviderAdapter,
  type CompletionRequest,
  type CompletionResponse,
} from '@interview-sdk/core';

export interface OpenAIAdapterConfig {
  apiKey?: string;
  model?: string;
  /** Inject a pre-configured client (e.g. for testing, or a custom baseURL/org). */
  client?: OpenAI;
}

const DEFAULT_MODEL = 'gpt-5.4-mini';
const CONTEXT_LENGTH_PATTERN = /context length|maximum context|too long|token limit/i;

function toResponsesInput(
  messages: AIMessage[],
): Array<{ role: 'system' | 'user' | 'assistant'; content: string }> {
  return messages.map((message) => ({ role: message.role, content: message.content }));
}

export class OpenAIAdapter implements AIProviderAdapter {
  readonly id = 'openai';
  private readonly client: OpenAI;
  private readonly model: string;

  constructor(config: OpenAIAdapterConfig = {}) {
    this.client = config.client ?? new OpenAI({ apiKey: config.apiKey });
    this.model = config.model ?? DEFAULT_MODEL;
  }

  async complete(request: CompletionRequest): Promise<CompletionResponse> {
    try {
      const response = await this.client.responses.create({
        model: this.model,
        input: toResponsesInput(request.messages),
        ...(request.maxOutputTokens !== undefined
          ? { max_output_tokens: request.maxOutputTokens }
          : {}),
        ...(request.temperature !== undefined ? { temperature: request.temperature } : {}),
        // json_object (not json_schema) since our response shapes carry
        // dynamic keys (rubric dimension ids) that a fixed JSON schema can't
        // express — see core's evaluation/follow-up response schemas.
        ...(request.responseFormat === 'json' ? { text: { format: { type: 'json_object' } } } : {}),
      });

      if (!response.output_text) {
        throw new ProviderInvalidRequestError('OpenAI response contained no output text.', this.id);
      }

      return { text: response.output_text, raw: response };
    } catch (error) {
      throw this.normalizeError(error);
    }
  }

  private normalizeError(error: unknown): Error {
    if (error instanceof OpenAI.RateLimitError) {
      return new ProviderRateLimitError(error.message, this.id, undefined, { cause: error });
    }
    if (
      error instanceof OpenAI.AuthenticationError ||
      error instanceof OpenAI.PermissionDeniedError
    ) {
      return new ProviderAuthError(error.message, this.id, { cause: error });
    }
    if (error instanceof OpenAI.InternalServerError) {
      return new ProviderOverloadedError(error.message, this.id, { cause: error });
    }
    if (error instanceof OpenAI.APIConnectionTimeoutError) {
      return new ProviderTimeoutError(error.message, this.id, { cause: error });
    }
    if (error instanceof OpenAI.APIConnectionError) {
      return new ProviderConnectionError(error.message, this.id, { cause: error });
    }
    if (error instanceof OpenAI.BadRequestError || error instanceof OpenAI.NotFoundError) {
      // OpenAI has no distinct error type for context-length overflow or a
      // retired model id — both surface as 400/404, so context-length is
      // detected heuristically from the message text.
      if (CONTEXT_LENGTH_PATTERN.test(error.message)) {
        return new ProviderContextLengthExceededError(error.message, this.id, { cause: error });
      }
      return new ProviderInvalidRequestError(error.message, this.id, { cause: error });
    }
    if (error instanceof OpenAI.APIError) {
      return new ProviderInvalidRequestError(error.message, this.id, { cause: error });
    }
    return error instanceof Error ? error : new Error(String(error));
  }
}

export function createOpenAIAdapter(config?: OpenAIAdapterConfig): OpenAIAdapter {
  return new OpenAIAdapter(config);
}
