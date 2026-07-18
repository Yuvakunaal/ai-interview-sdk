import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { Nav } from '../components/Nav';
import { PrevNext } from '../components/PrevNext';
import { TableOfContents } from '../components/TableOfContents';
import './globals.css';

const SITE_URL = 'https://ai-interview-sdk.vercel.app';
const OG_IMAGE = `${SITE_URL}/og-image.png`;
const DESCRIPTION =
  'Documentation for the AI Interview SDK: install, Client Mode, Server Mode, provider integrations, rubric cookbook, and security.';

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: '@interview-sdk docs',
    template: '%s · @interview-sdk docs',
  },
  description: DESCRIPTION,
  openGraph: {
    type: 'website',
    siteName: '@interview-sdk',
    url: `${SITE_URL}/docs`,
    title: '@interview-sdk docs',
    description: DESCRIPTION,
    images: [
      {
        url: OG_IMAGE,
        width: 1600,
        height: 791,
        alt: 'AI Interview SDK — Bias & Consistency Report, verified before go-live',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: '@interview-sdk docs',
    description: DESCRIPTION,
    images: [OG_IMAGE],
  },
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
