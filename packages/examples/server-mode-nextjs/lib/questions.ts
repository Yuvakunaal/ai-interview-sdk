import type { Question, RubricDimensionInput } from '@interview-sdk/core';

export const questions: Question[] = [
  {
    id: 'q1',
    prompt: 'How does a hash map resolve collisions in a production system?',
    concepts: ['hashing', 'collision resolution'],
  },
  {
    id: 'q2',
    prompt: 'What happens to a React component when state changes?',
    concepts: ['re-render', 'virtual dom'],
  },
  {
    id: 'q3',
    prompt: 'Describe one trade-off you would make when designing a reliable API.',
    concepts: ['trade-offs', 'reliability'],
  },
];

export const rubric: RubricDimensionInput[] = [
  { id: 'technical', label: 'Technical accuracy', weight: 3 },
  { id: 'communication', label: 'Communication clarity', weight: 1 },
  { id: 'systems', label: 'Systems thinking', weight: 2 },
];
