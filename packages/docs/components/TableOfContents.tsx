'use client';

import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';

interface TocEntry {
  id: string;
  text: string;
}

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\w\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-');
}

/**
 * Reads its own "on this page" list straight from the h2s actually rendered
 * on the current page, rather than a hand-maintained list per page that can
 * silently drift out of sync with the real content. Assigns each heading a
 * stable id if it doesn't already have one, then scroll-spies which section
 * is current via IntersectionObserver.
 */
export function TableOfContents() {
  const pathname = usePathname();
  const [entries, setEntries] = useState<TocEntry[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);

  useEffect(() => {
    // Nav/TOC live in the persistent layout, not the page itself — they
    // never remount on a client-side transition between sibling routes, so
    // this effect must re-run on every pathname change, not just on mount,
    // or the TOC keeps showing whichever page was current on first load.
    setActiveId(null);
    const headings = Array.from(document.querySelectorAll<HTMLHeadingElement>('.docs-content h2'));
    const seen = new Set<string>();

    const built = headings.map((heading) => {
      if (!heading.id) {
        let id = slugify(heading.textContent ?? '');
        let n = 2;
        while (seen.has(id) || document.getElementById(id)) {
          id = `${slugify(heading.textContent ?? '')}-${n}`;
          n += 1;
        }
        heading.id = id;
      }
      seen.add(heading.id);
      return { id: heading.id, text: heading.textContent ?? '' };
    });
    setEntries(built);

    if (built.length === 0) return;

    const observer = new IntersectionObserver(
      (observerEntries) => {
        for (const entry of observerEntries) {
          if (entry.isIntersecting) {
            setActiveId(entry.target.id);
            break;
          }
        }
      },
      { rootMargin: '-15% 0% -70% 0%' },
    );
    for (const heading of headings) observer.observe(heading);
    return () => observer.disconnect();
  }, [pathname]);

  if (entries.length === 0) return null;

  return (
    <nav className="docs-toc" aria-label="On this page">
      <p className="docs-toc-heading">On this page</p>
      <ul>
        {entries.map((entry) => (
          <li key={entry.id}>
            <a href={`#${entry.id}`} className={entry.id === activeId ? 'is-active' : undefined}>
              {entry.text}
            </a>
          </li>
        ))}
      </ul>
    </nav>
  );
}
