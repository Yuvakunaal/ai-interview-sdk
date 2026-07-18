import type { Question } from '@interview-sdk/core';
import { useState } from 'react';

export function conceptsToText(concepts: Question['concepts']): string {
  return concepts?.join(', ') ?? '';
}

export function textToConcepts(text: string): string[] {
  return text
    .split(',')
    .map((concept) => concept.trim())
    .filter(Boolean);
}

/**
 * A plain <input> whose value was `conceptsToText(question.concepts)` fights
 * the user while typing: parsing on every keystroke and filtering out empty
 * segments means a trailing "," (about to type the next concept) gets
 * silently erased the instant it's typed, before the next word can be
 * entered — comma-separated input never sticks mid-typing, even though the
 * final parsed array is correct on paste (a single onChange with the whole
 * value, no incremental stripping). Owning the raw text locally — reset via
 * the caller's own `key` when switching to a different question — lets the
 * user type freely while still reporting the parsed array up live.
 */
export function ConceptsInput({
  concepts,
  onChange,
}: {
  concepts: Question['concepts'];
  onChange: (concepts: string[]) => void;
}) {
  const [text, setText] = useState(() => conceptsToText(concepts));
  return (
    <input
      value={text}
      onChange={(event) => {
        const raw = event.target.value;
        setText(raw);
        onChange(textToConcepts(raw));
      }}
    />
  );
}
