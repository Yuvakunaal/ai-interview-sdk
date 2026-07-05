import { readFile } from 'node:fs/promises';
import { extname } from 'node:path';
import { parse as parseYaml } from 'yaml';
import { CliConfigError } from './errors.js';

/**
 * Reads a JSON or YAML file and returns its parsed contents. Backs both
 * question-pack loading and bias-harness sample-set loading — the spec
 * calls for an "open JSON/YAML format" in both places, so this is the one
 * place that decides which parser to use.
 */
export async function loadStructuredFile(filePath: string): Promise<unknown> {
  let raw: string;
  try {
    raw = await readFile(filePath, 'utf8');
  } catch (error) {
    throw new CliConfigError(
      `Could not read "${filePath}": ${error instanceof Error ? error.message : String(error)}`,
    );
  }

  const ext = extname(filePath).toLowerCase();
  try {
    if (ext === '.yaml' || ext === '.yml') {
      return parseYaml(raw);
    }
    return JSON.parse(raw);
  } catch (error) {
    throw new CliConfigError(
      `Could not parse "${filePath}" as ${ext === '.yaml' || ext === '.yml' ? 'YAML' : 'JSON'}: ${
        error instanceof Error ? error.message : String(error)
      }`,
    );
  }
}
