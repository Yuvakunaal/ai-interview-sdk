// An exact match against the whole (normalized) answer, never a substring
// check — "I don't know the exact algorithm, but it's probably a hash
// function" is a real attempt and must still go to the AI for real
// scoring. Only a bare admission with no other content short-circuits.
// Every entry here is pre-normalized the same way normalize() below
// transforms input (apostrophes stripped entirely) — Set membership is
// exact-string, so an entry with a literal apostrophe would never match.
// Hindi and Telugu are the two additional languages this SDK explicitly
// documents supporting (see the "Multi-language interviews" cookbook page)
// — this isn't an attempt at exhaustive i18n coverage, just the same bare-
// admission guarantee English gets, in the two languages actually claimed.
// Devanagari/Telugu script has no case distinction, so normalize()'s
// toLowerCase() is a harmless no-op for these entries.
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
  // Hindi
  'मुझे नहीं पता',
  'मुझे पता नहीं',
  'पता नहीं',
  'नहीं पता',
  'मालूम नहीं',
  // Telugu
  'నాకు తెలియదు',
  'తెలియదు',
]);

function normalize(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/[’‘]/g, "'")
    // Latin .!? plus the Devanagari danda/double danda (।॥) — the natural
    // way a Hindi sentence ends, not covered by the Latin punctuation class.
    .replace(/[.!?।॥]+$/, '')
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
