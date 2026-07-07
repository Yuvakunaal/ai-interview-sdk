'use client';

import { useState } from 'react';

export function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);

  return (
    <button
      type="button"
      className="isdk-code-copy"
      data-copied={copied}
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(text);
        } catch {
          // Clipboard access denied/unavailable — the code is still fully
          // selectable by hand, so this is a lost convenience, not a dead end.
          return;
        }
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
      }}
    >
      {copied ? 'Copied' : 'Copy'}
    </button>
  );
}
