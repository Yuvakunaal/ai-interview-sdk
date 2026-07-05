import { InterviewSdkError } from '@interview-sdk/core';

/** A developer-facing config file (interview.config, a question pack, a sample set) is missing or malformed. */
export class CliConfigError extends InterviewSdkError {}

/** Bad command-line arguments — unknown command, missing required flag, invalid persona id, etc. */
export class CliUsageError extends InterviewSdkError {}
