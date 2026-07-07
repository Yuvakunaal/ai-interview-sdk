import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { App } from './App.js';

describe('App', () => {
  it('renders the hero headline and primary CTA', () => {
    render(<App />);
    expect(
      screen.getByRole('heading', {
        level: 1,
        name: 'Prove your rubric is fair, before a candidate ever sees it.',
      }),
    ).toBeInTheDocument();
    expect(screen.getByText('npm install @interview-sdk/core')).toBeInTheDocument();
  });

  it('renders all four scripted personas in the scorecard with their exact scores', () => {
    render(<App />);
    const scorecard = screen.getByRole('img', { name: /Bias and consistency report/ });
    expect(scorecard).toBeInTheDocument();
    expect(screen.getByText('Strong answer')).toBeInTheDocument();
    expect(screen.getByText('94')).toBeInTheDocument();
    expect(screen.getByText('Weak answer')).toBeInTheDocument();
    expect(screen.getByText('38')).toBeInTheDocument();
    expect(screen.getByText('Off-topic')).toBeInTheDocument();
    expect(screen.getByText('12')).toBeInTheDocument();
    expect(screen.getByText('Adversarial injection')).toBeInTheDocument();
    expect(screen.getByText('41')).toBeInTheDocument();
  });

  it('links to the real GitHub repo from both the nav and the footer', () => {
    render(<App />);
    const githubLinks = screen.getAllByRole('link', {
      name: /github.com\/Yuvakunaal\/ai-interview-sdk|GitHub/,
    });
    for (const link of githubLinks) {
      expect(link).toHaveAttribute(
        'href',
        expect.stringContaining('github.com/Yuvakunaal/ai-interview-sdk'),
      );
    }
    expect(githubLinks.length).toBeGreaterThanOrEqual(2);
  });

  it('renders all 12 spec sheet rows', () => {
    render(<App />);
    expect(screen.getByText('Evaluation Engine')).toBeInTheDocument();
    expect(screen.getByText('Follow-Up Engine')).toBeInTheDocument();
    expect(screen.getByText('Rubric Engine')).toBeInTheDocument();
    expect(screen.getByText('Voice Layer')).toBeInTheDocument();
    expect(screen.getByText('Multi-Language')).toBeInTheDocument();
    expect(screen.getByText('Reports')).toBeInTheDocument();
    expect(screen.getByText('Webhooks')).toBeInTheDocument();
    expect(screen.getByText('Accessibility')).toBeInTheDocument();
    expect(screen.getByText('Provider Resilience')).toBeInTheDocument();
    expect(screen.getByText('Observability')).toBeInTheDocument();
    expect(screen.getByText('Coding Mode')).toBeInTheDocument();
    expect(screen.getByText('Developer Trust Tooling')).toBeInTheDocument();
  });

  it('recommends Server Mode, not Client Mode, in the architecture section', () => {
    render(<App />);
    const recommended = screen.getByText('— recommended');
    expect(recommended.parentElement).toHaveTextContent('Server Mode — recommended');
  });

  it('has a skip link targeting the main content region', () => {
    render(<App />);
    const skipLink = screen.getByRole('link', { name: 'Skip to content' });
    expect(skipLink).toHaveAttribute('href', '#main');
    expect(screen.getByRole('main')).toHaveAttribute('id', 'main');
  });

  it('toggles the mobile nav menu open and closed via the nav toggle button', () => {
    render(<App />);
    const toggle = screen.getByRole('button', { name: 'Open menu' });
    expect(toggle).toHaveAttribute('aria-expanded', 'false');
    expect(toggle).toHaveAttribute('aria-controls', 'primary-nav');

    fireEvent.click(toggle);
    expect(toggle).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByRole('button', { name: 'Close menu' })).toBe(toggle);

    fireEvent.click(toggle);
    expect(toggle).toHaveAttribute('aria-expanded', 'false');
  });

  it('closes the mobile nav menu after a link inside it is clicked', () => {
    render(<App />);
    const toggle = screen.getByRole('button', { name: 'Open menu' });
    fireEvent.click(toggle);
    expect(toggle).toHaveAttribute('aria-expanded', 'true');

    fireEvent.click(screen.getByRole('link', { name: 'Architecture' }));
    expect(toggle).toHaveAttribute('aria-expanded', 'false');
  });
});
