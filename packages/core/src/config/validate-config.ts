import { ConfigValidationError } from '../errors.js';
import { collectRubricIssues } from '../rubric/rubric.js';
import type { InterviewConfig } from '../types.js';

const LANGUAGE_TAG_PATTERN = /^[a-zA-Z]{2,3}(-[a-zA-Z0-9]+)*$/;
const VALID_DIFFICULTIES = ['easy', 'medium', 'hard', 'adaptive'];

function isValidUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch {
    return false;
  }
}

// Config can come from untyped sources (JSON, a CMS, the dashboard) where a
// "string" field might actually be a number/object at runtime — checking
// the type here means that fails validation cleanly instead of crashing
// on `.trim()` a few lines down.
function isBlank(value: unknown): boolean {
  return typeof value !== 'string' || value.trim() === '';
}

/**
 * Fails loud on invalid developer configuration (§7 Configuration
 * Validation): empty questions, missing rubric, invalid weights, duplicate
 * questions, invalid webhook/callback URLs, invalid voice/language settings.
 * Collects every issue before throwing once, rather than failing on the
 * first problem found.
 */
export function validateInterviewConfig(config: InterviewConfig): void {
  const issues: string[] = [];

  if (!config.questions || config.questions.length === 0) {
    issues.push('At least one question is required.');
  } else {
    const seenIds = new Set<string>();
    for (const question of config.questions) {
      if (isBlank(question.id)) {
        issues.push('A question is missing an id.');
      } else if (seenIds.has(question.id)) {
        issues.push(`Duplicate question id: "${question.id}".`);
      } else {
        seenIds.add(question.id);
      }
      if (isBlank(question.prompt)) {
        issues.push(`Question "${question.id ?? '(unknown)'}" is missing a prompt.`);
      }
    }
  }

  if (!config.rubric || config.rubric.length === 0) {
    issues.push('A rubric is required (at least one weighted dimension).');
  } else {
    issues.push(...collectRubricIssues(config.rubric));
  }

  if (config.webhook) {
    if (!config.webhook.url || !isValidUrl(config.webhook.url)) {
      issues.push(`Invalid webhook URL: "${config.webhook.url}". Must be an absolute http(s) URL.`);
    }
  }

  if (config.voice?.language && !LANGUAGE_TAG_PATTERN.test(config.voice.language)) {
    issues.push(`Invalid voice language tag: "${config.voice.language}".`);
  }

  if (config.language && !LANGUAGE_TAG_PATTERN.test(config.language)) {
    issues.push(`Invalid language tag: "${config.language}".`);
  }

  if (config.difficulty && !VALID_DIFFICULTIES.includes(config.difficulty)) {
    issues.push(
      `Invalid difficulty: "${config.difficulty}". Must be one of: ${VALID_DIFFICULTIES.join(', ')}.`,
    );
  }

  if (config.maxFollowUpDepth !== undefined) {
    if (!Number.isInteger(config.maxFollowUpDepth) || config.maxFollowUpDepth < 0) {
      issues.push(
        `Invalid maxFollowUpDepth: "${config.maxFollowUpDepth}". Must be a non-negative integer.`,
      );
    }
  }

  if (config.sessionTimeoutMs !== undefined) {
    if (!Number.isFinite(config.sessionTimeoutMs) || config.sessionTimeoutMs <= 0) {
      issues.push(
        `Invalid sessionTimeoutMs: "${config.sessionTimeoutMs}". Must be a positive number.`,
      );
    }
  }

  if (issues.length > 0) {
    throw new ConfigValidationError(issues);
  }
}
