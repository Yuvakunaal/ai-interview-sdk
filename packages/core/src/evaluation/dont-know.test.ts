import { describe, expect, it } from 'vitest';
import { isExplicitDontKnowAnswer } from './dont-know.js';

describe('isExplicitDontKnowAnswer', () => {
  it.each([
    'i dont know',
    "I don't know",
    "I DON'T KNOW",
    'I do not know.',
    'idk',
    'IDK',
    'no idea',
    'I have no idea!',
    'not sure',
    "I'm not sure",
    'i am not sure',
    'no clue',
    'pass',
    'skip',
    '  i dont know  ',
  ])('flags a bare admission: %j', (text) => {
    expect(isExplicitDontKnowAnswer(text)).toBe(true);
  });

  it.each([
    "I don't know the exact algorithm, but it's probably a hash function.",
    'A hash map uses buckets.',
    'Not sure if this is right, but I think it uses chaining for collisions.',
    'I know this one — it uses linear probing.',
    '',
  ])('does not flag a real attempt or partial hedge: %j', (text) => {
    expect(isExplicitDontKnowAnswer(text)).toBe(false);
  });
});
