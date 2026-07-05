import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import {
  validateInterviewConfig,
  type AIProviderAdapter,
  type FollowUpEngineConfig,
  type Question,
  type RubricDimensionInput,
} from '@interview-sdk/core';
import { CliConfigError } from './errors.js';

export interface InterviewCliConfig {
  questions: Question[];
  rubric: RubricDimensionInput[];
  adapter: AIProviderAdapter;
  maxFollowUpDepth?: number;
  followUpConfig?: FollowUpEngineConfig;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function isAdapter(value: unknown): value is AIProviderAdapter {
  return isRecord(value) && typeof value.id === 'string' && typeof value.complete === 'function';
}

/**
 * Loads a developer's `interview.config.(js|mjs|ts)` — a plain module whose
 * default export is `{ questions, rubric, adapter }`. Uses a real dynamic
 * `import()` of the resolved file URL: unlike the bundler-time problem
 * @interview-sdk/react solved for optional peer deps, this runs directly in
 * Node with no bundler in the loop, so a computed import specifier here is
 * just... a dynamic import, no special handling required.
 */
export async function loadInterviewCliConfig(configPath: string): Promise<InterviewCliConfig> {
  const fileUrl = pathToFileURL(resolve(configPath)).href;

  let mod: unknown;
  try {
    mod = await import(fileUrl);
  } catch (error) {
    throw new CliConfigError(
      `Could not load config file "${configPath}": ${error instanceof Error ? error.message : String(error)}`,
    );
  }

  const config = isRecord(mod) && 'default' in mod ? mod.default : mod;
  if (!isRecord(config)) {
    throw new CliConfigError(
      `Config file "${configPath}" must have a default export shaped like { questions, rubric, adapter }.`,
    );
  }

  const missing: string[] = [];
  if (!Array.isArray(config.questions)) missing.push('questions');
  if (!Array.isArray(config.rubric)) missing.push('rubric');
  if (!isAdapter(config.adapter)) missing.push('adapter');
  if (missing.length > 0) {
    throw new CliConfigError(
      `Config file "${configPath}" is missing or has an invalid: ${missing.join(', ')}.`,
    );
  }

  const questions = config.questions as Question[];
  const rubric = config.rubric as RubricDimensionInput[];
  validateInterviewConfig({
    questions,
    rubric,
    maxFollowUpDepth: config.maxFollowUpDepth as number | undefined,
  });

  return {
    questions,
    rubric,
    adapter: config.adapter as AIProviderAdapter,
    maxFollowUpDepth: config.maxFollowUpDepth as number | undefined,
    followUpConfig: config.followUpConfig as FollowUpEngineConfig | undefined,
  };
}
