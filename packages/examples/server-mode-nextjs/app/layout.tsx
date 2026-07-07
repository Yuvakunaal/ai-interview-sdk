import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import '@interview-sdk/react/styles.css';
import './globals.css';

export const metadata: Metadata = {
  title: '@interview-sdk — Server Mode example',
  description:
    'Next.js example running <InterviewWidget mode="server" /> against @interview-sdk/server.',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
