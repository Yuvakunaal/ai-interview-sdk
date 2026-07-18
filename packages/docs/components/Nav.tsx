'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import { NAV_SECTIONS } from '../lib/nav-data';
import { SearchDialog } from './SearchDialog';
import { ThemeToggle } from './ThemeToggle';

export function Nav() {
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);

  // The sidebar lives in the persistent layout, not the page — close the
  // mobile drawer on every navigation rather than leaving it open over
  // whatever page just loaded underneath it.
  useEffect(() => {
    setMenuOpen(false);
  }, [pathname]);

  return (
    <nav className="docs-nav" aria-label="Documentation">
      <div className="docs-nav-top">
        <div className="docs-nav-brand">
          {/* Plain <a>, not next/link — this deliberately escapes the docs
              site's own basePath to land on the marketing site's root. */}
          <a href="/" className="docs-nav-wordmark">
            @interview<span>-sdk</span>
          </a>
          <span className="docs-nav-brand-badge">Docs</span>
        </div>
        <SearchDialog />
        <ThemeToggle />
        <button
          type="button"
          className="docs-nav-toggle"
          aria-expanded={menuOpen}
          aria-controls="docs-nav-menu"
          aria-label={menuOpen ? 'Close navigation' : 'Open navigation'}
          onClick={() => setMenuOpen((open) => !open)}
        >
          <span aria-hidden="true" />
          <span aria-hidden="true" />
          <span aria-hidden="true" />
        </button>
      </div>

      <div id="docs-nav-menu" className={menuOpen ? 'docs-nav-menu is-open' : 'docs-nav-menu'}>
        <div className="docs-nav-sections">
          {NAV_SECTIONS.map((section) => (
            <div key={section.label} className="docs-nav-section">
              <p className="docs-nav-heading">{section.label}</p>
              <ul>
                {section.items.map((item) => (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      aria-current={pathname === item.href ? 'page' : undefined}
                    >
                      {item.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <a
          className="docs-nav-github"
          href="https://www.npmjs.com/org/interview-sdk"
          target="_blank"
          rel="noopener noreferrer"
        >
          npm ↗
        </a>
        <a
          className="docs-nav-github"
          href="https://github.com/Yuvakunaal/ai-interview-sdk"
          target="_blank"
          rel="noopener noreferrer"
        >
          GitHub ↗
        </a>
      </div>
    </nav>
  );
}
