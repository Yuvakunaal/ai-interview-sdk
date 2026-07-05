import { writeFile } from 'node:fs/promises';
import { CliConfigError } from '../errors.js';
import { fileExists } from '../fs-utils.js';
import {
  createStarterQuestionPack,
  validateQuestionPack,
  type QuestionPackValidationResult,
} from '../question-pack.js';
import { loadStructuredFile } from '../structured-file.js';

/** `interview-sdk pack validate <file>`: checks a question pack against the open pack format (§12). */
export async function validateQuestionPackFile(
  filePath: string,
): Promise<QuestionPackValidationResult> {
  const raw = await loadStructuredFile(filePath);
  return validateQuestionPack(raw);
}

export interface CreateQuestionPackFileOptions {
  force?: boolean;
}

/** `interview-sdk pack init <name> <file>`: writes a starter question pack a developer can edit. */
export async function createQuestionPackFile(
  filePath: string,
  name: string,
  options: CreateQuestionPackFileOptions = {},
): Promise<void> {
  if (!options.force && (await fileExists(filePath))) {
    throw new CliConfigError(`"${filePath}" already exists. Pass --force to overwrite it.`);
  }
  const pack = createStarterQuestionPack(name);
  await writeFile(filePath, `${JSON.stringify(pack, null, 2)}\n`, 'utf8');
}
