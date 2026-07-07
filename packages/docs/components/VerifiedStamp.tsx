import type { ReactNode } from 'react';

export interface VerifiedStampProps {
  date: string;
  children?: ReactNode;
}

/**
 * Echoes ReportCard's own "✓ Complete" stamp (and the dashboard's copy-code
 * confirmation, which reuses the same treatment) — this SDK's own "verified"
 * visual language, reused for its own documentation. A dated mark that a
 * page's claims were actually checked against real code, not assumed to
 * still hold — model names, error taxonomies, and defaults shift fast.
 */
export function VerifiedStamp({ date, children }: VerifiedStampProps) {
  return (
    <p className="docs-stamp">
      <span className="docs-stamp-mark">✓</span>
      Verified {date}
      {children ? <> — {children}</> : null}
    </p>
  );
}
