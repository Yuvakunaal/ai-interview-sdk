import { RubricValidationError } from '../errors.js';
import type { Rubric, RubricDimensionInput } from '../types.js';

// Config can come from an untyped source (JSON, a CMS) where "id" might
// actually be a number/object at runtime — checking the type means that
// fails validation cleanly instead of crashing on `.trim()` below.
function isBlank(value: unknown): boolean {
  return typeof value !== 'string' || value.trim() === '';
}

/** Shared by defineRubric() and the developer-configuration validator, so the two never drift apart. */
export function collectRubricIssues(dimensions: RubricDimensionInput[] | undefined): string[] {
  const issues: string[] = [];

  if (!dimensions || dimensions.length === 0) {
    issues.push('Rubric must define at least one dimension.');
  }

  const seenIds = new Set<string>();
  for (const dimension of dimensions ?? []) {
    if (isBlank(dimension.id)) {
      issues.push('A rubric dimension is missing an id.');
    } else if (seenIds.has(dimension.id)) {
      issues.push(`Duplicate rubric dimension id: "${dimension.id}".`);
    } else {
      seenIds.add(dimension.id);
    }

    if (!Number.isFinite(dimension.weight) || dimension.weight <= 0) {
      issues.push(
        `Rubric dimension "${dimension.id ?? '(unknown)'}" has an invalid weight (${dimension.weight}). ` +
          'Weight must be a positive finite number.',
      );
    }
  }

  return issues;
}

export function defineRubric(dimensions: RubricDimensionInput[]): Rubric {
  const issues = collectRubricIssues(dimensions);

  if (issues.length > 0) {
    throw new RubricValidationError(issues);
  }

  const totalWeight = dimensions.reduce((sum, dimension) => sum + dimension.weight, 0);

  return {
    dimensions: dimensions.map((dimension) => ({
      ...dimension,
      normalizedWeight: dimension.weight / totalWeight,
    })),
  };
}

export interface RubricScore {
  total: number;
  breakdown: Record<string, { score: number; weight: number; weighted: number }>;
}

export function scoreRubric(rubric: Rubric, dimensionScores: Record<string, number>): RubricScore {
  const breakdown: RubricScore['breakdown'] = {};
  let total = 0;

  for (const dimension of rubric.dimensions) {
    const rawScore = dimensionScores[dimension.id] ?? 0;
    const clampedScore = Math.min(100, Math.max(0, rawScore));
    const weighted = clampedScore * dimension.normalizedWeight;

    breakdown[dimension.id] = {
      score: clampedScore,
      weight: dimension.normalizedWeight,
      weighted,
    };
    total += weighted;
  }

  return { total: Math.round(total * 100) / 100, breakdown };
}
