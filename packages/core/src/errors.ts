export class InterviewSdkError extends Error {
  constructor(message: string) {
    super(message);
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

export class DuplicateSubmissionError extends InterviewSdkError {}

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
