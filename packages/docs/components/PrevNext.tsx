'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { FLAT_NAV_ITEMS } from '../lib/nav-data';

/** Prev/next links derived from the same nav order the sidebar uses — one list to keep in sync, not two. */
export function PrevNext() {
  const pathname = usePathname();
  const index = FLAT_NAV_ITEMS.findIndex((item) => item.href === pathname);
  if (index === -1) return null;

  const prev = index > 0 ? FLAT_NAV_ITEMS[index - 1] : undefined;
  const next = index < FLAT_NAV_ITEMS.length - 1 ? FLAT_NAV_ITEMS[index + 1] : undefined;
  if (!prev && !next) return null;

  return (
    <div className="docs-prev-next">
      {prev ? (
        <Link href={prev.href}>
          <span className="docs-prev-next-dir">← Previous</span>
          {prev.label}
        </Link>
      ) : (
        <span />
      )}
      {next ? (
        <Link href={next.href} className="docs-prev-next-next">
          <span className="docs-prev-next-dir">Next →</span>
          {next.label}
        </Link>
      ) : (
        <span />
      )}
    </div>
  );
}
