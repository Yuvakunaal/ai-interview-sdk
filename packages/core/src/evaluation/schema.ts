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

export const evaluationResponseSchema = z.object({
  dimensionScores: z.record(z.string(), z.number().min(0).max(100)),
  conceptCoverage: z
    .array(
      z.object({
        concept: z.string(),
        covered: z.boolean(),
        partial: z.boolean().optional(),
      }),
    )
    .optional()
    .default([]),
  contradictions: z.array(z.string()).optional().default([]),
  flags: z.array(evaluationFlagSchema).optional().default([]),
  matchesAnswerKey: z.boolean().optional(),
  rationale: z.string().optional(),
});

export type EvaluationResponse = z.infer<typeof evaluationResponseSchema>;
