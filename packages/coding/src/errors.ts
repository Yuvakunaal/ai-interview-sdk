import { InterviewSdkError } from '@interview-sdk/core';

/** No execution provider is configured for the requested language. */
export class UnsupportedLanguageError extends InterviewSdkError {}

/** The sandbox itself failed to start or respond — distinct from the candidate's code failing inside it. */
export class SandboxUnavailableError extends InterviewSdkError {}
