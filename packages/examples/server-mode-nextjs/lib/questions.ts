import type { Question, RubricDimensionInput } from '@interview-sdk/core';

export const questions: Question[] = [
  {
    id: 'q1',
    prompt: 'How would you design a URL shortener?',
    concepts: ['hashing', 'collision handling', 'datastore'],
  },
  {
    id: 'q2',
    prompt: 'Explain how React decides whether to re-render a component.',
    concepts: ['virtual dom', 'reconciliation', 'state'],
  },
];

export const rubric: RubricDimensionInput[] = [
  { id: 'technical', label: 'Technical depth', weight: 3 },
  { id: 'communication', label: 'Communication clarity', weight: 1 },
];
