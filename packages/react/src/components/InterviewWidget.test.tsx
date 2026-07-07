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

  it('shows a clear, recoverable error for an invalid rubric via validateInterviewConfig', () => {
    // Unlike the mode/adapter checks above, an invalid rubric is caught by
    // InterviewErrorBoundary rather than thrown synchronously — questions
    // and rubric are exactly the props a host app (a question builder,
    // this SDK's own dashboard) is likely to edit live, so this must never
    // be able to take the whole host page down with it. It still fails
    // clearly and immediately; it just renders instead of throwing.
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
    const adapter = fakeAdapter(['{}']);
    render(
      <InterviewWidget
        questions={questions}
        rubric={[{ id: 'technical', label: 'Technical', weight: -1 }]}
        mode="client"
        adapter={adapter}
      />,
    );
    expect(screen.getByText(/Invalid interview configuration/)).toBeInTheDocument();
    consoleError.mockRestore();
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

  it('pausing with a partially typed answer does not submit it', async () => {
    const user = userEvent.setup();
    const adapter = fakeAdapter(['{}']);
    render(
      <InterviewWidget questions={questions} rubric={rubric} mode="client" adapter={adapter} />,
    );

    await user.click(screen.getByRole('button', { name: 'Start interview' }));
    await user.type(screen.getByLabelText('Your answer'), 'Partial thought');
    await user.click(screen.getByRole('button', { name: 'Pause' }));

    expect(screen.getByRole('button', { name: 'Resume' })).toBeInTheDocument();
    expect(adapter.complete).not.toHaveBeenCalled();
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

  it('speaks the current question aloud when synthesize is provided', async () => {
    const user = userEvent.setup();
    const playSpy = vi
      .spyOn(window.HTMLMediaElement.prototype, 'play')
      .mockResolvedValue(undefined);
    vi.stubGlobal('URL', {
      ...URL,
      createObjectURL: vi.fn(() => 'blob:fake-url'),
      revokeObjectURL: vi.fn(),
    });
    const adapter = fakeAdapter(['{}']);
    const synthesize = vi.fn(async () => ({
      audio: new ArrayBuffer(4),
      mimeType: 'audio/mpeg',
    }));

    render(
      <InterviewWidget
        questions={questions}
        rubric={rubric}
        mode="client"
        adapter={adapter}
        synthesize={synthesize}
      />,
    );

    await user.click(screen.getByRole('button', { name: 'Start interview' }));

    await waitFor(() => expect(synthesize).toHaveBeenCalledWith('Explain hash maps.'));

    playSpy.mockRestore();
    vi.unstubAllGlobals();
  });

  it('shows the optional role title in the header once the interview is underway', async () => {
    const user = userEvent.setup();
    const adapter = fakeAdapter(['{}']);
    render(
      <InterviewWidget
        questions={questions}
        rubric={rubric}
        mode="client"
        adapter={adapter}
        roleTitle="Senior Software Engineer — Round 2"
      />,
    );
    await user.click(screen.getByRole('button', { name: 'Start interview' }));
    expect(screen.getByText('Senior Software Engineer — Round 2')).toBeInTheDocument();
  });

  it('shows the interview progress checklist, one row per question', async () => {
    const user = userEvent.setup();
    const adapter = fakeAdapter(['{}']);
    render(
      <InterviewWidget questions={questions} rubric={rubric} mode="client" adapter={adapter} />,
    );
    await user.click(screen.getByRole('button', { name: 'Start interview' }));
    expect(screen.getByRole('list', { name: 'Interview progress' })).toBeInTheDocument();
    expect(screen.getByText('Explain binary search.')).toBeInTheDocument();
  });

  it('ends the interview early via the End Interview button and shows a report from partial answers', async () => {
    const user = userEvent.setup();
    const adapter = fakeAdapter([JSON.stringify({ dimensionScores: { technical: 90 } })]);
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
    await user.type(screen.getByLabelText('Your answer'), 'It uses buckets.');
    await user.click(screen.getByRole('button', { name: 'Submit answer' }));
    await waitFor(() =>
      expect(screen.getByRole('heading', { name: 'Explain binary search.' })).toBeInTheDocument(),
    );

    await user.click(screen.getByRole('button', { name: 'End Interview' }));

    await waitFor(() =>
      expect(screen.getByRole('heading', { name: 'Interview Report' })).toBeInTheDocument(),
    );
    expect(onSessionEnd).toHaveBeenCalledTimes(1);
  });

  it('passes onExportError through to the report, since jspdf is never installed in this environment', async () => {
    const user = userEvent.setup();
    vi.stubGlobal('URL', {
      ...URL,
      createObjectURL: vi.fn(() => 'blob:fake-url'),
      revokeObjectURL: vi.fn(),
    });
    const clickSpy = vi
      .spyOn(HTMLAnchorElement.prototype, 'click')
      .mockImplementation(() => {});
    const adapter = fakeAdapter([JSON.stringify({ dimensionScores: { technical: 90 } })]);
    const onExportError = vi.fn();
    render(
      <InterviewWidget
        questions={questions}
        rubric={rubric}
        mode="client"
        adapter={adapter}
        onExportError={onExportError}
      />,
    );

    await user.click(screen.getByRole('button', { name: 'Start interview' }));
    await user.type(screen.getByLabelText('Your answer'), 'It uses buckets.');
    await user.click(screen.getByRole('button', { name: 'Submit answer' }));
    await waitFor(() =>
      expect(screen.getByRole('heading', { name: 'Explain binary search.' })).toBeInTheDocument(),
    );
    await user.click(screen.getByRole('button', { name: 'End Interview' }));
    await waitFor(() =>
      expect(screen.getByRole('heading', { name: 'Interview Report' })).toBeInTheDocument(),
    );

    await user.click(screen.getByRole('button', { name: 'Export PDF' }));
    await waitFor(() => expect(onExportError).toHaveBeenCalledWith(expect.any(Error), 'pdf'));
    expect(screen.getByRole('status')).toHaveTextContent(
      "PDF export isn't available here — downloaded a JSON file instead.",
    );

    clickSpy.mockRestore();
    vi.unstubAllGlobals();
  });

  it('never shows the REC badge unless the mic is genuinely recording', async () => {
    const user = userEvent.setup();
    const adapter = fakeAdapter(['{}']);
    const transcribe = vi.fn(async () => 'an answer');
    render(
      <InterviewWidget
        questions={questions}
        rubric={rubric}
        mode="client"
        adapter={adapter}
        transcribe={transcribe}
      />,
    );
    await user.click(screen.getByRole('button', { name: 'Start interview' }));
    expect(screen.queryByText('● REC')).not.toBeInTheDocument();
  });

  it('applies className/style to the root shell in every session state', async () => {
    const user = userEvent.setup();
    const adapter = fakeAdapter([JSON.stringify({ dimensionScores: { technical: 90 } })]);
    const { container } = render(
      <InterviewWidget
        questions={questions}
        rubric={rubric}
        mode="client"
        adapter={adapter}
        className="my-shell"
        style={{ height: '100dvh' }}
      />,
    );

    const shell = () => container.firstElementChild as HTMLElement;

    // not_started
    expect(shell()).toHaveClass('isdk-widget', 'my-shell');
    expect(shell()).toHaveStyle({ height: '100dvh' });

    await user.click(screen.getByRole('button', { name: 'Start interview' }));
    // in_progress
    expect(shell()).toHaveClass('isdk-widget', 'my-shell');
    expect(shell()).toHaveStyle({ height: '100dvh' });

    await user.click(screen.getByRole('button', { name: 'Pause' }));
    // paused
    expect(shell()).toHaveClass('isdk-widget', 'my-shell');
    await user.click(screen.getByRole('button', { name: 'Resume' }));

    await user.type(screen.getByLabelText('Your answer'), 'It uses buckets.');
    await user.click(screen.getByRole('button', { name: 'Submit answer' }));
    await waitFor(() =>
      expect(screen.getByRole('heading', { name: 'Explain binary search.' })).toBeInTheDocument(),
    );
    await user.click(screen.getByRole('button', { name: 'End Interview' }));
    await waitFor(() =>
      expect(screen.getByRole('heading', { name: 'Interview Report' })).toBeInTheDocument(),
    );
    // completed
    expect(shell()).toHaveClass('isdk-widget', 'my-shell');
  });

  it('passes the candidate name through to the candidate tile', async () => {
    const user = userEvent.setup();
    const adapter = fakeAdapter(['{}']);
    const transcribe = vi.fn(async () => 'an answer');
    render(
      <InterviewWidget
        questions={questions}
        rubric={rubric}
        mode="client"
        adapter={adapter}
        transcribe={transcribe}
        candidateName="Alex Chen"
      />,
    );
    await user.click(screen.getByRole('button', { name: 'Start interview' }));
    expect(screen.getByText('Alex Chen')).toBeInTheDocument();
  });

  it('uses the same candidate name in the transcript sidebar as on the candidate tile, not the "You" default', async () => {
    const user = userEvent.setup();
    const adapter = fakeAdapter([JSON.stringify({ dimensionScores: { technical: 90 } })]);
    const transcribe = vi.fn(async () => 'an answer');
    render(
      <InterviewWidget
        questions={questions}
        rubric={rubric}
        mode="client"
        adapter={adapter}
        transcribe={transcribe}
        candidateName="Alex Chen"
      />,
    );
    await user.click(screen.getByRole('button', { name: 'Start interview' }));
    await user.type(screen.getByRole('textbox'), 'It uses buckets.');
    await user.click(screen.getByRole('button', { name: 'Submit answer' }));

    await waitFor(() => expect(screen.getAllByText('Alex Chen').length).toBeGreaterThan(1));
    expect(screen.queryByText('You')).not.toBeInTheDocument();
  });
});
