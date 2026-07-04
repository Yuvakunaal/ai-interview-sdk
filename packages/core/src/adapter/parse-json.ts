import type { ZodType } from 'zod';
import { MalformedAdapterResponseError } from '../errors.js';

export function parseAdapterJson<T>(text: string, schema: ZodType<T>): T {
  let json: unknown;
  try {
    json = JSON.parse(text);
  } catch {
    throw new MalformedAdapterResponseError('Adapter response was not valid JSON.', text);
  }

  const result = schema.safeParse(json);
  if (!result.success) {
    throw new MalformedAdapterResponseError(
      `Adapter response did not match the expected shape: ${result.error.message}`,
      text,
    );
  }
  return result.data;
}
