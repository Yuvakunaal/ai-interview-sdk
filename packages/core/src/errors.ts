export class InterviewSdkError extends Error {
  constructor(message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = new.target.name;
  }
}

export class ConfigValidationError extends InterviewSdkError {
  readonly issues: string[];

  constructor(issues: string[]) {
    super(`Invalid interview configuration:\n- ${issues.join('\n- ')}`);
    this.issues = issues;
  }
}

export class RubricValidationError extends InterviewSdkError {
  readonly issues: string[];

  constructor(issues: string[]) {
    super(`Invalid rubric configuration:\n- ${issues.join('\n- ')}`);
    this.issues = issues;
  }
}

/**
 * The raw (untrimmed) answer text exceeded the hard length cap enforced
 * before any AI call is made. Distinct from the `very_long_answer`
 * evaluation flag, which still scores a long-but-reasonable answer — this
 * error exists to stop a pathologically large payload (abuse, or a client
 * bug) from ever being forwarded to a paid provider API.
 */
export class AnswerTooLongError extends InterviewSdkError {
  readonly maxLength: number;
  readonly actualLength: number;

  constructor(maxLength: number, actualLength: number) {
    super(`Answer text is ${actualLength} characters, exceeding the ${maxLength}-character limit.`);
    this.maxLength = maxLength;
    this.actualLength = actualLength;
  }
}

/**
 * `previousTurns` is client-supplied (see ServerAnswerProcessor) and, unlike
 * the current answer, has no natural single-answer length check to bound
 * it — a client could otherwise attach an arbitrarily large fabricated
 * history to inflate AI provider token costs on every request.
 */
export class TooManyPreviousTurnsError extends InterviewSdkError {
  readonly maxTurns: number;
  readonly actualTurns: number;

  constructor(maxTurns: number, actualTurns: number) {
    super(`Received ${actualTurns} previous turns, exceeding the ${maxTurns}-turn limit.`);
    this.maxTurns = maxTurns;
    this.actualTurns = actualTurns;
  }
}

export class SessionExpiredError extends InterviewSdkError {}

export class FollowUpDepthExceededError extends InterviewSdkError {}

export class AdapterNotRegisteredError extends InterviewSdkError {}

export class MalformedAdapterResponseError extends InterviewSdkError {
  readonly raw: string;

  constructor(message: string, raw: string) {
    super(message);
    this.raw = raw;
  }
}

/**
 * Base class every adapter maps its provider-specific SDK exceptions onto,
 * so core's retry/failover logic (see adapter/retry.ts, adapter/failover.ts)
 * can react uniformly without knowing about any particular provider's SDK.
 */
export class ProviderError extends InterviewSdkError {
  readonly providerId: string;

  constructor(message: string, providerId: string, options?: ErrorOptions) {
    super(message, options);
    this.providerId = providerId;
  }
}

/** Invalid, expired, or revoked API key; also permission-denied responses. */
export class ProviderAuthError extends ProviderError {}

/** Provider rate limit hit. `retryAfterMs`, if the provider supplied one, overrides backoff timing. */
export class ProviderRateLimitError extends ProviderError {
  readonly retryAfterMs?: number;

  constructor(message: string, providerId: string, retryAfterMs?: number, options?: ErrorOptions) {
    super(message, providerId, options);
    this.retryAfterMs = retryAfterMs;
  }
}

/** Provider is temporarily overloaded (e.g. HTTP 529/503) — safe to retry with backoff. */
export class ProviderOverloadedError extends ProviderError {}

/** Network-level failure reaching the provider (no response received). */
export class ProviderConnectionError extends ProviderError {}

/** The request to the provider timed out. */
export class ProviderTimeoutError extends ProviderError {}

/** Candidate/developer content exceeded the model's context window. */
export class ProviderContextLengthExceededError extends ProviderError {}

/**
 * Malformed request, unknown/deprecated model id, or any other 4xx that
 * retrying verbatim will not fix.
 */
export class ProviderInvalidRequestError extends ProviderError {}
