// An exact match against the whole (normalized) answer, never a substring
// check — "I don't know the exact algorithm, but it's probably a hash
// function" is a real attempt and must still go to the AI for real
// scoring. Only a bare admission with no other content short-circuits.
// Every entry here is pre-normalized the same way normalize() below
// transforms input (apostrophes stripped entirely) — Set membership is
// exact-string, so an entry with a literal apostrophe would never match.
const DONT_KNOW_PHRASES = new Set([
  'i dont know',
  'i do not know',
  'dont know',
  'do not know',
  'idk',
  'no idea',
  'i have no idea',
  'no clue',
  'i have no clue',
  'not sure',
  'im not sure',
  'i am not sure',
  'no comment',
  'i cant answer that',
  'i cannot answer that',
  'i cant answer this',
  'pass',
  'skip',
]);

function normalize(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/[’‘]/g, "'")
    .replace(/[.!?]+$/, '')
    .replace(/'/g, '')
    .replace(/\s+/g, ' ');
}

/**
 * Detects a bare admission that the candidate doesn't know the answer —
 * a real answer's score shouldn't depend on an AI provider choosing to be
 * lenient here, since models can (and did, in practice) still hand out a
 * generous partial score for exactly this kind of non-answer.
 */
export function isExplicitDontKnowAnswer(text: string): boolean {
  return DONT_KNOW_PHRASES.has(normalize(text));
}
