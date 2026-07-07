import Anthropic from '@anthropic-ai/sdk';
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

export interface ClaudeAdapterConfig {
  apiKey?: string;
  model?: string;
  /** Inject a pre-configured client (e.g. for testing, or a Bedrock/Vertex/Foundry backend). */
  client?: Anthropic;
}

const DEFAULT_MODEL = 'claude-opus-4-8';
const DEFAULT_MAX_OUTPUT_TOKENS = 4096;
const CONTEXT_LENGTH_PATTERN = /context length|too long|maximum context|prompt is too long/i;

/** Parses a Retry-After header (seconds, or an HTTP date) into milliseconds. */
function parseRetryAfterMs(headers: Headers | undefined): number | undefined {
  const value = headers?.get('retry-after');
  if (!value) return undefined;
  const seconds = Number(value);
  if (Number.isFinite(seconds)) return seconds * 1000;
  const dateMs = Date.parse(value);
  return Number.isFinite(dateMs) ? Math.max(0, dateMs - Date.now()) : undefined;
}

function toAnthropicMessages(messages: AIMessage[]): {
  system: string;
  messages: Anthropic.MessageParam[];
} {
  const systemParts: string[] = [];
  const conversation: Anthropic.MessageParam[] = [];

  for (const message of messages) {
    if (message.role === 'system') {
      systemParts.push(message.content);
    } else {
      conversation.push({ role: message.role, content: message.content });
    }
  }

  return { system: systemParts.join('\n\n'), messages: conversation };
}

export class ClaudeAdapter implements AIProviderAdapter {
  readonly id = 'claude';
  private readonly client: Anthropic;
  private readonly model: string;

  constructor(config: ClaudeAdapterConfig = {}) {
    this.client = config.client ?? new Anthropic({ apiKey: config.apiKey });
    this.model = config.model ?? DEFAULT_MODEL;
  }

  async complete(request: CompletionRequest): Promise<CompletionResponse> {
    const { system, messages } = toAnthropicMessages(request.messages);

    try {
      const response = await this.client.messages.create({
        model: this.model,
        max_tokens: request.maxOutputTokens ?? DEFAULT_MAX_OUTPUT_TOKENS,
        ...(system ? { system } : {}),
        messages,
        ...(request.temperature !== undefined ? { temperature: request.temperature } : {}),
      });

      if (response.stop_reason === 'refusal') {
        throw new ProviderInvalidRequestError(
          'Claude declined to respond to this request (safety refusal).',
          this.id,
        );
      }

      const textBlock = response.content.find(
        (block): block is Anthropic.TextBlock => block.type === 'text',
      );
      if (!textBlock) {
        throw new ProviderInvalidRequestError(
          'Claude response contained no text content block.',
          this.id,
        );
      }

      return { text: textBlock.text, raw: response };
    } catch (error) {
      throw this.normalizeError(error);
    }
  }

  private normalizeError(error: unknown): Error {
    if (error instanceof Anthropic.RateLimitError) {
      return new ProviderRateLimitError(
        error.message,
        this.id,
        parseRetryAfterMs(error.headers),
        { cause: error },
      );
    }
    if (
      error instanceof Anthropic.AuthenticationError ||
      error instanceof Anthropic.PermissionDeniedError
    ) {
      return new ProviderAuthError(error.message, this.id, { cause: error });
    }
    if (error instanceof Anthropic.InternalServerError) {
      return new ProviderOverloadedError(error.message, this.id, { cause: error });
    }
    if (error instanceof Anthropic.APIConnectionTimeoutError) {
      return new ProviderTimeoutError(error.message, this.id, { cause: error });
    }
    if (error instanceof Anthropic.APIConnectionError) {
      return new ProviderConnectionError(error.message, this.id, { cause: error });
    }
    if (error instanceof Anthropic.BadRequestError || error instanceof Anthropic.NotFoundError) {
      // Anthropic has no distinct error type for context-length overflow or a
      // retired model id — both surface as 400/404 invalid_request_error, so
      // context-length is detected heuristically from the message text.
      if (CONTEXT_LENGTH_PATTERN.test(error.message)) {
        return new ProviderContextLengthExceededError(error.message, this.id, { cause: error });
      }
      return new ProviderInvalidRequestError(error.message, this.id, { cause: error });
    }
    if (error instanceof Anthropic.APIError) {
      return new ProviderInvalidRequestError(error.message, this.id, { cause: error });
    }
    return error instanceof Error ? error : new Error(String(error));
  }
}

export function createClaudeAdapter(config?: ClaudeAdapterConfig): ClaudeAdapter {
  return new ClaudeAdapter(config);
}
