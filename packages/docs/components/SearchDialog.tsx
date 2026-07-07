'use client';

import Link from 'next/link';
import { useEffect, useMemo, useRef, useState } from 'react';
import { FLAT_NAV_ITEMS } from '../lib/nav-data';

/**
 * A small, entirely static, client-side search — no external search
 * service, matching the Zero-Infra Guarantee the rest of this SDK holds
 * itself to. The index is just the same NAV_SECTIONS data already used for
 * the sidebar; there are only a dozen pages, so a substring match over
 * label+description is genuinely sufficient, not a placeholder for
 * something heavier.
 */
export function SearchDialog() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        setOpen((current) => !current);
      }
      if (event.key === 'Escape') {
        setOpen(false);
      }
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  useEffect(() => {
    if (open) {
      setQuery('');
      // Wait for the dialog to actually mount before focusing it.
      requestAnimationFrame(() => inputRef.current?.focus());
    }
  }, [open]);

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return FLAT_NAV_ITEMS;
    return FLAT_NAV_ITEMS.filter(
      (item) =>
        item.label.toLowerCase().includes(q) || item.description.toLowerCase().includes(q),
    );
  }, [query]);

  return (
    <>
      <button
        type="button"
        className="docs-search-trigger"
        onClick={() => setOpen(true)}
        aria-haspopup="dialog"
      >
        <span>Search docs…</span>
        <span className="docs-search-kbd">⌘K</span>
      </button>

      {open && (
        <div
          className="docs-search-overlay"
          role="presentation"
          onClick={(event) => {
            if (event.target === event.currentTarget) setOpen(false);
          }}
        >
          <div className="docs-search-modal" role="dialog" aria-modal="true" aria-label="Search documentation">
            <input
              ref={inputRef}
              type="text"
              className="docs-search-input"
              placeholder="Search documentation…"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
            />
            <ul className="docs-search-results">
              {results.length === 0 && <li className="docs-search-empty">No pages match &ldquo;{query}&rdquo;.</li>}
              {results.map((item) => (
                <li key={item.href}>
                  <Link href={item.href} onClick={() => setOpen(false)}>
                    <span className="docs-search-result-label">{item.label}</span>
                    <span className="docs-search-result-desc">{item.description}</span>
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}
    </>
  );
}
