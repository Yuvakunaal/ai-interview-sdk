import { InterviewSdkError } from '@interview-sdk/core';

/**
 * Thrown when a request references a question id that isn't in this
 * processor's configured question bank. The processor always scores against
 * its own server-side question/rubric configuration — it never trusts a
 * client-supplied question or rubric body, only the id used to look one up —
 * so an unknown id is a hard error rather than falling back to the client's copy.
 */
export class UnknownQuestionIdError extends InterviewSdkError {}
