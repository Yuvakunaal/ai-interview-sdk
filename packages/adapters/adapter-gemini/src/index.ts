import { ApiError, GoogleGenAI } from '@google/genai';
import {
  ProviderAuthError,
  ProviderContextLengthExceededError,
  ProviderInvalidRequestError,
  ProviderOverloadedError,
  ProviderRateLimitError,
  type AIMessage,
  type AIProviderAdapter,
  type CompletionRequest,
  type CompletionResponse,
} from '@interview-sdk/core';

export interface GeminiAdapterConfig {
  apiKey?: string;
  model?: string;
  /** Inject a pre-configured client (e.g. for testing, or Vertex/Enterprise mode). */
  client?: GoogleGenAI;
}

const DEFAULT_MODEL = 'gemini-3.5-flash';
const CONTEXT_LENGTH_PATTERN = /context length|too long|token limit|maximum.*tokens/i;

function toGeminiContents(messages: AIMessage[]): {
  systemInstruction: string;
  contents: Array<{ role: 'user' | 'model'; parts: Array<{ text: string }> }>;
} {
  const systemParts: string[] = [];
  const contents: Array<{ role: 'user' | 'model'; parts: Array<{ text: string }> }> = [];

  for (const message of messages) {
    if (message.role === 'system') {
      systemParts.push(message.content);
    } else {
      contents.push({
        role: message.role === 'assistant' ? 'model' : 'user',
        parts: [{ text: message.content }],
      });
    }
  }

  return { systemInstruction: systemParts.join('\n\n'), contents };
}

export class GeminiAdapter implements AIProviderAdapter {
  readonly id = 'gemini';
  private readonly client: GoogleGenAI;
  private readonly model: string;

  constructor(config: GeminiAdapterConfig = {}) {
    // Unlike the Claude/OpenAI SDKs, @google/genai does not retry
    // rate-limit/server errors by default — opt in explicitly here so
    // Gemini's out-of-the-box resilience matches the other adapters.
    this.client =
      config.client ??
      new GoogleGenAI({ apiKey: config.apiKey, httpOptions: { retryOptions: { attempts: 2 } } });
    this.model = config.model ?? DEFAULT_MODEL;
  }

  async complete(request: CompletionRequest): Promise<CompletionResponse> {
    const { systemInstruction, contents } = toGeminiContents(request.messages);

    try {
      const response = await this.client.models.generateContent({
        model: this.model,
        contents,
        config: {
          ...(systemInstruction ? { systemInstruction } : {}),
          ...(request.maxOutputTokens !== undefined
            ? { maxOutputTokens: request.maxOutputTokens }
            : {}),
          ...(request.temperature !== undefined ? { temperature: request.temperature } : {}),
          // responseMimeType only (no responseSchema) since our response
          // shapes carry dynamic keys (rubric dimension ids) that Gemini's
          // OpenAPI-subset schema format can't express.
          ...(request.responseFormat === 'json' ? { responseMimeType: 'application/json' } : {}),
        },
      });

      if (!response.text) {
        throw new ProviderInvalidRequestError('Gemini response contained no text.', this.id);
      }

      return { text: response.text, raw: response };
    } catch (error) {
      throw this.normalizeError(error);
    }
  }

  private normalizeError(error: unknown): Error {
    if (!(error instanceof ApiError)) {
      return error instanceof Error ? error : new Error(String(error));
    }

    if (error.status === 401 || error.status === 403) {
      return new ProviderAuthError(error.message, this.id, { cause: error });
    }
    if (error.status === 429) {
      return new ProviderRateLimitError(error.message, this.id, undefined, { cause: error });
    }
    if (error.status >= 500) {
      return new ProviderOverloadedError(error.message, this.id, { cause: error });
    }
    if (CONTEXT_LENGTH_PATTERN.test(error.message)) {
      return new ProviderContextLengthExceededError(error.message, this.id, { cause: error });
    }
    return new ProviderInvalidRequestError(error.message, this.id, { cause: error });
  }
}

export function createGeminiAdapter(config?: GeminiAdapterConfig): GeminiAdapter {
  return new GeminiAdapter(config);
}
