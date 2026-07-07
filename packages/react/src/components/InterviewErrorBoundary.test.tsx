import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { InterviewErrorBoundary } from './InterviewErrorBoundary.js';

function Bomb({ shouldThrow }: { shouldThrow: boolean }): React.ReactElement {
  if (shouldThrow) throw new Error('Simulated runtime failure.');
  return <div>All good</div>;
}

describe('InterviewErrorBoundary', () => {
  it('renders children normally when nothing throws', () => {
    render(
      <InterviewErrorBoundary shellClassName="isdk-widget" resetKey="a">
        <Bomb shouldThrow={false} />
      </InterviewErrorBoundary>,
    );
    expect(screen.getByText('All good')).toBeInTheDocument();
  });

  it('shows a recoverable fallback instead of a blank page when a descendant throws', () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
    render(
      <InterviewErrorBoundary shellClassName="isdk-widget" resetKey="a">
        <Bomb shouldThrow />
      </InterviewErrorBoundary>,
    );
    expect(screen.getByText('The interview hit an unexpected error')).toBeInTheDocument();
    expect(screen.getByText('Simulated runtime failure.')).toBeInTheDocument();
    consoleError.mockRestore();
  });

  it('lets "Try again" clear the error and re-render children', async () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
    const user = userEvent.setup();
    let shouldThrow = true;
    function Toggle(): React.ReactElement {
      return <Bomb shouldThrow={shouldThrow} />;
    }
    const { rerender } = render(
      <InterviewErrorBoundary shellClassName="isdk-widget" resetKey="a">
        <Toggle />
      </InterviewErrorBoundary>,
    );
    expect(screen.getByText('The interview hit an unexpected error')).toBeInTheDocument();

    shouldThrow = false;
    await user.click(screen.getByRole('button', { name: 'Try again' }));
    rerender(
      <InterviewErrorBoundary shellClassName="isdk-widget" resetKey="a">
        <Toggle />
      </InterviewErrorBoundary>,
    );
    expect(screen.getByText('All good')).toBeInTheDocument();
    consoleError.mockRestore();
  });

  it('automatically recovers when resetKey changes while an error is showing, without needing "Try again"', () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
    let shouldThrow = true;
    function Toggle(): React.ReactElement {
      return <Bomb shouldThrow={shouldThrow} />;
    }
    const { rerender } = render(
      <InterviewErrorBoundary shellClassName="isdk-widget" resetKey="a">
        <Toggle />
      </InterviewErrorBoundary>,
    );
    expect(screen.getByText('The interview hit an unexpected error')).toBeInTheDocument();

    // Simulates a host app editing live config (e.g. a question builder) —
    // the underlying data changed (new resetKey), so this should retry
    // rendering on its own rather than staying stuck on the fallback.
    shouldThrow = false;
    rerender(
      <InterviewErrorBoundary shellClassName="isdk-widget" resetKey="b">
        <Toggle />
      </InterviewErrorBoundary>,
    );
    expect(screen.getByText('All good')).toBeInTheDocument();
    consoleError.mockRestore();
  });
});
