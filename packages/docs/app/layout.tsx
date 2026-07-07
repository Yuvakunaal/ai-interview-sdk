import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { Nav } from '../components/Nav';
import { PrevNext } from '../components/PrevNext';
import { TableOfContents } from '../components/TableOfContents';
import './globals.css';

export const metadata: Metadata = {
  title: {
    default: '@interview-sdk docs',
    template: '%s · @interview-sdk docs',
  },
  description:
    'Documentation for the AI Interview SDK: install, Client Mode, Server Mode, provider integrations, rubric cookbook, and security.',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>
        <div className="docs-shell">
          <Nav />
          <div className="docs-main">
            <main className="docs-content">
              {children}
              <PrevNext />
            </main>
            <TableOfContents />
          </div>
        </div>
      </body>
    </html>
  );
}
