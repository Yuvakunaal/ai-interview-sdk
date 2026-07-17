export interface NavItem {
  href: string;
  label: string;
  /** Shown under the label in search results. */
  description: string;
}

export interface NavSection {
  label: string;
  items: NavItem[];
}

/**
 * Single source of truth for the sidebar, the search index, and prev/next
 * links — add a page once here and all three stay in sync.
 */
export const NAV_SECTIONS: NavSection[] = [
  {
    label: 'Get started',
    items: [
      { href: '/', label: 'Overview', description: 'What this SDK is, and where to go next.' },
      {
        href: '/dashboard',
        label: 'Local Dashboard',
        description: 'Design your interview in the browser, then copy the integration code.',
      },
      {
        href: '/quick-start',
        label: 'Quick Start',
        description: 'Client Mode — a running interview in five steps, no backend.',
      },
      {
        href: '/production',
        label: 'Production Setup',
        description: 'Server Mode — what you actually ship.',
      },
      {
        href: '/saving-results',
        label: 'Saving results',
        description: 'Store every interview report in your own database, verified.',
      },
    ],
  },
  {
    label: 'Integrations',
    items: [
      {
        href: '/integrations/react-nextjs',
        label: 'React + Next.js',
        description: 'Client/server component boundaries and the App Router route pattern.',
      },
      {
        href: '/integrations/providers',
        label: 'AI & voice providers',
        description: 'OpenAI, Claude, Gemini, Deepgram, ElevenLabs.',
      },
    ],
  },
  {
    label: 'Guides',
    items: [
      {
        href: '/cookbook/rubric-evaluation',
        label: 'Rubric & evaluation cookbook',
        description: 'How scoring, concept coverage, and follow-ups actually work.',
      },
      {
        href: '/styling-and-composition',
        label: 'Styling, composition & a11y',
        description: 'Theming, headless mode, composable pieces, and report export.',
      },
      {
        href: '/error-handling',
        label: 'Error handling & resilience',
        description: 'The provider error taxonomy, hard limits, retries, and config validation.',
      },
      {
        href: '/session-persistence-and-events',
        label: 'Session persistence & events',
        description: 'Resuming after a refresh, and the typed event emitter — core-only today.',
      },
      {
        href: '/coding-interviews',
        label: 'Coding Interview Mode',
        description: 'Sandboxed code execution and weighted test-case scoring.',
      },
      {
        href: '/security',
        label: 'Security & compliance',
        description: 'The architecture-level guarantees, and what stays your responsibility.',
      },
      {
        href: '/trust-tooling',
        label: 'Simulator & Bias Harness',
        description: 'Prove your rubric is fair before a candidate ever sees it.',
      },
    ],
  },
];

export const FLAT_NAV_ITEMS: NavItem[] = NAV_SECTIONS.flatMap((section) => section.items);
