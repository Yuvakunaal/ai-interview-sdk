import type { ReactNode } from 'react';

export type CalloutType = 'note' | 'tip' | 'warning';

const LABEL: Record<CalloutType, string> = {
  note: 'Note',
  tip: 'Tip',
  warning: 'Warning',
};

export interface CalloutProps {
  type?: CalloutType;
  children: ReactNode;
}

/** A note/tip/warning aside — replaces a plain <blockquote> with something that actually distinguishes "here's a detail" from "here's something you need to design around". */
export function Callout({ type = 'note', children }: CalloutProps) {
  return (
    <div className={`docs-callout docs-callout--${type}`} role="note">
      <p className="docs-callout-title">
        <span className="docs-callout-dot" aria-hidden="true" />
        {LABEL[type]}
      </p>
      <div className="docs-callout-body">{children}</div>
    </div>
  );
}
