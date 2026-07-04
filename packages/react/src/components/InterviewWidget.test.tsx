import type { AIProviderAdapter, Question } from '@interview-sdk/core';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { InterviewWidget } from './InterviewWidget.js';

const questions: Question[] = [
  { id: 'q1', prompt: 'Explain hash maps.', concepts: ['hashing', 'collisions'] },
  { id: 'q2', prompt: 'Explain binary search.' },
];

const rubric = [{ id: 'technical', label: 'Technical', weight: 1 }];

function fakeAdapter(responses: string[]): AIProviderAdapter {
  let call = 0;
  return {
    id: 'fake',
    complete: vi.fn(async () => {
      const text = responses[Math.min(call, responses.length - 1)] ?? '{}';
      call += 1;
      return { text };
    }),
  };
}

afterEach(() => {
  vi.unstubAllEnvs();
});

describe('InterviewWidget', () => {
  it('shows a start button before the interview begins', () => {
    const adapter = fakeAdapter(['{}']);
    render(
      <InterviewWidget questions={questions} rubric={rubric} mode="client" adapter={adapter} />,
    );
    expect(screen.getByRole('button', { name: 'Start interview' })).toBeInTheDocument();
  });

  it('throws a clear config error in client mode with no adapter', () => {
    const renderInvalid = () =>
      render(<InterviewWidget questions={questions} rubric={rubric} mode="client" />);
    expect(renderInvalid).toThrow(/requires an `adapter` prop/);
  });

  it('fails loud on an invalid rubric via validateInterviewConfig', () => {
    const adapter = fakeAdapter(['{}']);
    const renderInvalid = () =>
      render(
        <InterviewWidget
          questions={questions}
          rubric={[{ id: 'technical', label: 'Technical', weight: -1 }]}
          mode="client"
          adapter={adapter}
        />,
      );
    expect(renderInvalid).toThrow(/Invalid interview configuration/);
  });

  it('refuses to run Client Mode under NODE_ENV=production without the override flag', () => {
    vi.stubEnv('NODE_ENV', 'production');
    const adapter = fakeAdapter(['{}']);
    const renderInProd = () =>
      render(
        <InterviewWidget questions={questions} rubric={rubric} mode="client" adapter={adapter} />,
      );
    expect(renderInProd).toThrow(/refuses to run/);
  });

  it('runs Client Mode under NODE_ENV=production when allowClientModeInProduction is set', () => {
    vi.stubEnv('NODE_ENV', 'production');
    const adapter = fakeAdapter(['{}']);
    render(
      <InterviewWidget
        questions={questions}
        rubric={rubric}
        mode="client"
        adapter={adapter}
        allowClientModeInProduction
      />,
    );
    expect(screen.getByRole('button', { name: 'Start interview' })).toBeInTheDocument();
  });

  it('runs a full interview end-to-end in Client Mode and shows the report', async () => {
    const user = userEvent.setup();
    const adapter = fakeAdapter([
      JSON.stringify({
        dimensionScores: { technical: 90 },
        conceptCoverage: [{ concept: 'hashing', covered: true }],
      }),
      JSON.stringify({ dimensionScores: { technical: 95 } }),
    ]);
    const onSessionEnd = vi.fn();
    render(
      <InterviewWidget
        questions={questions}
        rubric={rubric}
        mode="client"
        adapter={adapter}
        onSessionEnd={onSessionEnd}
      />,
    );

    await user.click(screen.getByRole('button', { name: 'Start interview' }));
    expect(screen.getByRole('heading', { name: 'Explain hash maps.' })).toBeInTheDocument();

    await user.type(screen.getByLabelText('Your answer'), 'It uses buckets.');
    await user.click(screen.getByRole('button', { name: 'Submit answer' }));

    await waitFor(() =>
      expect(screen.getByRole('heading', { name: 'Explain binary search.' })).toBeInTheDocument(),
    );

    await user.type(screen.getByLabelText('Your answer'), 'Divide and conquer.');
    await user.click(screen.getByRole('button', { name: 'Submit answer' }));

    await waitFor(() =>
      expect(screen.getByRole('heading', { name: 'Interview Report' })).toBeInTheDocument(),
    );
    expect(onSessionEnd).toHaveBeenCalledTimes(1);
  });

  it('shows a hint tied to the current question, and it clears on the next question', async () => {
    const user = userEvent.setup();
    const adapter = fakeAdapter([JSON.stringify({ dimensionScores: { technical: 90 } })]);
    render(
      <InterviewWidget questions={questions} rubric={rubric} mode="client" adapter={adapter} />,
    );

    await user.click(screen.getByRole('button', { name: 'Start interview' }));
    await user.click(screen.getByRole('button', { name: 'Request a hint' }));

    expect(screen.getByLabelText('Hint')).toHaveTextContent('hashing, collisions');

    await user.click(screen.getByRole('button', { name: 'Submit answer' }));

    await waitFor(() =>
      expect(screen.getByRole('heading', { name: 'Explain binary search.' })).toBeInTheDocument(),
    );
    expect(screen.queryByLabelText('Hint')).not.toBeInTheDocument();
  });

  it('lets the candidate skip a question', async () => {
    const user = userEvent.setup();
    const adapter = fakeAdapter(['{}']);
    render(
      <InterviewWidget questions={questions} rubric={rubric} mode="client" adapter={adapter} />,
    );

    await user.click(screen.getByRole('button', { name: 'Start interview' }));
    await user.click(screen.getByRole('button', { name: 'Skip question' }));

    await waitFor(() =>
      expect(screen.getByRole('heading', { name: 'Explain binary search.' })).toBeInTheDocument(),
    );
    expect(adapter.complete).not.toHaveBeenCalled();
  });

  it('shows a retry option when processing an answer fails', async () => {
    const user = userEvent.setup();
    const adapter: AIProviderAdapter = {
      id: 'fake',
      complete: vi.fn(async () => {
        throw new Error('provider is overloaded');
      }),
    };
    render(
      <InterviewWidget questions={questions} rubric={rubric} mode="client" adapter={adapter} />,
    );

    await user.click(screen.getByRole('button', { name: 'Start interview' }));
    await user.type(screen.getByLabelText('Your answer'), 'It uses buckets.');
    await user.click(screen.getByRole('button', { name: 'Submit answer' }));

    await waitFor(() =>
      expect(screen.getByRole('alert')).toHaveTextContent('provider is overloaded'),
    );
    expect(screen.getByRole('button', { name: 'Retry' })).toBeInTheDocument();
  });

  it('pauses and resumes the interview', async () => {
    const user = userEvent.setup();
    const adapter = fakeAdapter(['{}']);
    render(
      <InterviewWidget questions={questions} rubric={rubric} mode="client" adapter={adapter} />,
    );

    await user.click(screen.getByRole('button', { name: 'Start interview' }));
    await user.click(screen.getByRole('button', { name: 'Pause' }));

    expect(screen.getByRole('button', { name: 'Resume' })).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Resume' }));
    expect(screen.getByRole('heading', { name: 'Explain hash maps.' })).toBeInTheDocument();
  });

  it('runs in Server Mode by POSTing to the configured endpoint', async () => {
    const user = userEvent.setup();
    const fetchImpl = vi.fn(
      async (_input: RequestInfo | URL, _init?: RequestInit) =>
        new Response(
          JSON.stringify({
            evaluation: {
              questionId: 'q1',
              totalScore: 88,
              dimensionScores: {},
              conceptCoverage: [],
              contradictions: [],
              flags: [],
            },
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } },
        ),
    );
    // ServerModeProcessor isn't directly configurable with fetchImpl through
    // InterviewWidget's props, so this test verifies mode="server" renders
    // and functions using the real fetch — stub the global instead.
    vi.stubGlobal('fetch', fetchImpl);

    render(
      <InterviewWidget
        questions={questions}
        rubric={rubric}
        mode="server"
        apiBaseUrl="/api/answer"
      />,
    );

    await user.click(screen.getByRole('button', { name: 'Start interview' }));
    await user.type(screen.getByLabelText('Your answer'), 'It uses buckets.');
    await user.click(screen.getByRole('button', { name: 'Submit answer' }));

    await waitFor(() => expect(fetchImpl).toHaveBeenCalledTimes(1));
    expect(fetchImpl.mock.calls[0]![0]).toBe('/api/answer');

    vi.unstubAllGlobals();
  });
});
