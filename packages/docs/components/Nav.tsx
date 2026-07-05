import Link from 'next/link';

interface NavSection {
  label: string;
  items: { href: string; label: string }[];
}

const SECTIONS: NavSection[] = [
  {
    label: 'Get started',
    items: [
      { href: '/', label: 'Overview' },
      { href: '/quick-start', label: 'Quick Start (Client Mode)' },
      { href: '/production', label: 'Production Setup (Server Mode)' },
    ],
  },
  {
    label: 'Integrations',
    items: [
      { href: '/integrations/react-nextjs', label: 'React + Next.js' },
      { href: '/integrations/providers', label: 'AI & voice providers' },
    ],
  },
  {
    label: 'Guides',
    items: [
      { href: '/cookbook/rubric-evaluation', label: 'Rubric & evaluation cookbook' },
      { href: '/security', label: 'Security & compliance' },
      { href: '/trust-tooling', label: 'Simulator & Bias Harness' },
    ],
  },
];

export function Nav() {
  return (
    <nav className="docs-nav" aria-label="Documentation">
      <Link href="/" className="docs-nav-brand">
        @interview<span>-sdk</span>
      </Link>
      {SECTIONS.map((section) => (
        <div key={section.label} className="docs-nav-section">
          <p className="docs-nav-heading">{section.label}</p>
          <ul>
            {section.items.map((item) => (
              <li key={item.href}>
                <Link href={item.href}>{item.label}</Link>
              </li>
            ))}
          </ul>
        </div>
      ))}
      <a
        className="docs-nav-github"
        href="https://github.com/Yuvakunaal/ai-interview-sdk"
        target="_blank"
        rel="noopener noreferrer"
      >
        GitHub ↗
      </a>
    </nav>
  );
}
