export type MessageRole = 'system' | 'user' | 'assistant';

export interface AIMessage {
  role: MessageRole;
  content: string;
}

export interface CompletionRequest {
  messages: AIMessage[];
  responseFormat?: 'json' | 'text';
  maxOutputTokens?: number;
  temperature?: number;
}

export interface CompletionResponse {
  text: string;
  raw?: unknown;
}

/**
 * The single method every AI provider adapter implements. Core builds
 * structured messages (candidate free text always isolated in its own
 * `user` message, never concatenated into the system prompt) and never
 * talks to a provider SDK directly — adapters own that.
 */
export interface AIProviderAdapter {
  readonly id: string;
  complete(request: CompletionRequest): Promise<CompletionResponse>;
}

export interface TranscriptResult {
  text: string;
  raw?: unknown;
}

export interface SynthesisResult {
  audio: ArrayBuffer | Uint8Array;
  mimeType: string;
  raw?: unknown;
}

export interface VoiceProviderAdapter {
  readonly id: string;
  transcribe?(audio: ArrayBuffer | Uint8Array): Promise<TranscriptResult>;
  synthesize?(text: string): Promise<SynthesisResult>;
}
