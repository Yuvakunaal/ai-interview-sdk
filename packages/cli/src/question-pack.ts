import { z } from 'zod';

const questionSchema = z.object({
  id: z.string().min(1),
  prompt: z.string().min(1),
  concepts: z.array(z.string()).optional(),
  answerKey: z.string().optional(),
  difficulty: z.enum(['easy', 'medium', 'hard']).optional(),
  maxFollowUps: z.number().int().nonnegative().optional(),
  timeLimitMs: z.number().positive().optional(),
});

const rubricDimensionSchema = z.object({
  id: z.string().min(1),
  label: z.string().min(1),
  weight: z.number().positive(),
  description: z.string().optional(),
});

/**
 * The open question-pack format from §12: question sets + rubrics + concept
 * maps, published as `@interview-sdk/pack-*` npm packages (or kept private).
 * `conceptMap` documents what each concept id referenced by a question
 * actually means — useful when a pack is shared beyond the team that wrote
 * the questions.
 */
export const questionPackSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
  version: z.string().optional(),
  questions: z.array(questionSchema).min(1),
  rubric: z.array(rubricDimensionSchema).min(1),
  conceptMap: z.record(z.string(), z.string()).optional(),
});

export type QuestionPack = z.infer<typeof questionPackSchema>;

export interface QuestionPackValidationResult {
  valid: boolean;
  issues: string[];
  pack?: QuestionPack;
}

function collectPackIssues(pack: QuestionPack): string[] {
  const issues: string[] = [];

  const seenQuestionIds = new Set<string>();
  for (const question of pack.questions) {
    if (seenQuestionIds.has(question.id)) {
      issues.push(`Duplicate question id: "${question.id}".`);
    }
    seenQuestionIds.add(question.id);
  }

  const seenRubricIds = new Set<string>();
  for (const dimension of pack.rubric) {
    if (seenRubricIds.has(dimension.id)) {
      issues.push(`Duplicate rubric dimension id: "${dimension.id}".`);
    }
    seenRubricIds.add(dimension.id);
  }

  if (pack.conceptMap) {
    const declaredConcepts = new Set(pack.questions.flatMap((question) => question.concepts ?? []));
    for (const concept of Object.keys(pack.conceptMap)) {
      if (!declaredConcepts.has(concept)) {
        issues.push(`conceptMap defines "${concept}" but no question declares it.`);
      }
    }
  }

  return issues;
}

/**
 * Validates a parsed question-pack document (already JSON/YAML-parsed, see
 * `structured-file.ts`) against the schema, plus a couple of structural
 * checks the schema alone can't express (duplicate ids, an orphaned
 * conceptMap entry).
 */
export function validateQuestionPack(raw: unknown): QuestionPackValidationResult {
  const parsed = questionPackSchema.safeParse(raw);
  if (!parsed.success) {
    return {
      valid: false,
      issues: parsed.error.issues.map(
        (issue) => `${issue.path.join('.') || '(root)'}: ${issue.message}`,
      ),
    };
  }
  const issues = collectPackIssues(parsed.data);
  return { valid: issues.length === 0, issues, pack: parsed.data };
}

/** Starter content for `interview-sdk pack init <name>`. */
export function createStarterQuestionPack(name: string): QuestionPack {
  return {
    name,
    description: `Starter question pack for ${name}.`,
    version: '0.1.0',
    questions: [
      {
        id: 'q1',
        prompt: 'Replace this with your first interview question.',
        concepts: ['example-concept'],
      },
    ],
    rubric: [{ id: 'technical', label: 'Technical depth', weight: 1 }],
    conceptMap: {
      'example-concept': 'Describe what this concept means and why it matters.',
    },
  };
}
