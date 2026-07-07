import type { Question, RubricDimensionInput } from '@interview-sdk/core';

export const questions: Question[] = [
  {
    id: 'q3',
    prompt: 'What is select statement in SQL?',
    concepts: ['rows'],
  },
  {
    id: 'q2',
    prompt: 'To edit the column name, what command you will write?',
    concepts: ['alter'],
  },
];

export const rubric: RubricDimensionInput[] = [
  { id: 'technical', label: 'Technical accuracy', weight: 3 },
  { id: 'communication', label: 'Communication clarity', weight: 1 },
  { id: 'systems', label: 'Systems thinking', weight: 2 },
];
