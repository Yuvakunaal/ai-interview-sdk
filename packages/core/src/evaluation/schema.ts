import { z } from 'zod';

export const evaluationFlagSchema = z.enum([
  'no_answer',
  'skipped',
  'very_short_answer',
  'very_long_answer',
  'off_topic',
  'i_dont_know',
  'avoidance',
  'hint_request',
  'candidate_question',
  'contradiction',
  'partial_concept_coverage',
]);

/**
 * An array field, tolerant of the shapes smaller/faster models (verified
 * against real Groq `llama-3.1-8b-instant` responses, which hit all three
 * cases repeatedly) actually return instead of respecting the documented
 * array type:
 * - a bare `null` (common LLM convention for "nothing here") instead of
 *   omitting the field
 * - a single bare value instead of a one-item array
 * - (for enum items, e.g. `flags`) an outright invalid/hallucinated value
 *   that doesn't match any enum member — dropped rather than failing the
 *   whole evaluation, since there's no safe way to coerce a made-up value
 *   into a real one
 * Without this, a real, common model response fails the entire evaluation
 * with a schema error over what's a minor, auxiliary field — not the
 * dimension scores that actually drive the candidate's score.
 */
function toleratedArray<T extends z.ZodTypeAny>(itemSchema: T) {
  return z
    .preprocess((value) => {
      if (value === null) return [];
      if (value === undefined) return value;
      const items = Array.isArray(value) ? value : [value];
      return items.filter((item) => itemSchema.safeParse(item).success);
    }, z.array(itemSchema))
    .optional()
    .default([]);
}

/**
 * A scalar optional field that tolerates a real model returning `null`
 * (verified against real Groq responses for both `matchesAnswerKey` and
 * `rationale`) instead of omitting the field — the two mean the same thing
 * here, so `null` shouldn't be a harder validation failure than absence.
 */
function nullableOptional<T extends z.ZodTypeAny>(baseSchema: T) {
  return baseSchema
    .nullable()
    .optional()
    .transform((value) => value ?? undefined);
}

export const evaluationResponseSchema = z.object({
  dimensionScores: z.record(z.string(), z.number().min(0).max(100)),
  conceptCoverage: z
    .preprocess((value) => {
      // Both also verified against real Groq responses:
      // - an entry with `concept: null` instead of a real concept name —
      //   unlike the auxiliary fields above, there's no reasonable value to
      //   coerce a missing concept name *into* — an entry that doesn't say
      //   which concept it's about is unusable (it would otherwise surface
      //   as a blank/null bullet in the report's "missed concepts" list via
      //   `build-report.ts`), so it's dropped rather than kept or coerced.
      // - `covered` omitted/null entirely for an entry whose `concept` name
      //   *is* present — defaulted to `false` (the conservative reading:
      //   coverage the model didn't confirm doesn't count as covered),
      //   rather than failing the whole evaluation over one incomplete entry.
      // - the whole field returned as a bare `null` rather than omitted or
      //   an empty array — same convention as `toleratedArray` above.
      if (value === null) return [];
      if (!Array.isArray(value)) return value;
      return value
        .filter(
          (item): item is Record<string, unknown> =>
            typeof item === 'object' && item !== null && typeof (item as { concept?: unknown }).concept === 'string',
        )
        .map((item) => ({ ...item, covered: item.covered ?? false }));
    }, z.array(
      z.object({
        concept: z.string(),
        covered: z.boolean(),
        // Same real-world "null instead of omitted" tolerance as
        // matchesAnswerKey/rationale below, one level deeper.
        partial: nullableOptional(z.boolean()),
      }),
    ))
    .optional()
    .default([]),
  contradictions: toleratedArray(z.string()),
  flags: toleratedArray(evaluationFlagSchema),
  matchesAnswerKey: nullableOptional(z.boolean()),
  rationale: nullableOptional(z.string()),
});

export type EvaluationResponse = z.infer<typeof evaluationResponseSchema>;
