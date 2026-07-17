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

  it.each([
    'मुझे नहीं पता',
    'मुझे पता नहीं',
    'पता नहीं',
    'पता नहीं।', // trailing Devanagari danda, not a Latin period
    '  पता नहीं  ',
    'నాకు తెలియదు',
    'తెలియదు',
  ])('flags a bare admission in Hindi/Telugu, the SDK\'s documented additional languages: %j', (text) => {
    expect(isExplicitDontKnowAnswer(text)).toBe(true);
  });

  it.each([
    'यह हैश मैप बकेट्स का उपयोग करता है।', // a real Hindi answer, not a "don't know"
    'ఇది hash function ఉపయోగిస్తుంది', // a real, mixed Telugu/English answer
    'मुझे नहीं पता कि exact algorithm क्या है, लेकिन शायद hashing है।', // a real hedge, not a bare admission
  ])('does not flag a real (or mixed-language) attempt: %j', (text) => {
    expect(isExplicitDontKnowAnswer(text)).toBe(false);
  });
});
