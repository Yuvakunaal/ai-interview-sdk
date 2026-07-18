import type { SynthesisResult } from '@interview-sdk/core';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { QuestionCard } from './QuestionCard.js';

describe('QuestionCard', () => {
  it('announces new questions/follow-ups via a live region that updates in place, not the remounted heading', () => {
    const { rerender, container } = render(
      <QuestionCard
        prompt="Explain hash maps."
        questionNumber={1}
        totalQuestions={3}
        onSubmit={vi.fn()}
      />,
    );

    const announcer = container.querySelector('[aria-live="polite"]');
    expect(announcer).not.toBeNull();
    expect(announcer).toHaveTextContent('Question 1 of 3: Explain hash maps.');
    // The visible heading itself must not carry aria-live — the whole body
    // it lives in remounts per prompt (a brand-new node with aria-live
    // already on it is not reliably announced), so it would be inert.
    expect(screen.getByRole('heading', { name: 'Explain hash maps.' })).not.toHaveAttribute(
      'aria-live',
    );

    rerender(
      <QuestionCard
        prompt="Can you elaborate on collisions?"
        questionNumber={1}
        totalQuestions={3}
        isFollowUp
        onSubmit={vi.fn()}
      />,
    );

    // Same node, updated text — this is what makes assistive tech announce it.
    expect(container.querySelector('[aria-live="polite"]')).toBe(announcer);
    expect(announcer).toHaveTextContent('Follow-up: Can you elaborate on collisions?');
  });

  it('moves focus to the heading on the very first question', () => {
    render(
      <QuestionCard
        prompt="Explain hash maps."
        questionNumber={1}
        totalQuestions={3}
        onSubmit={vi.fn()}
      />,
    );
    expect(screen.getByRole('heading', { name: 'Explain hash maps.' })).toHaveFocus();
  });

  it('moves focus to the new heading on every subsequent question, instead of losing it to <body>', () => {
    const { rerender } = render(
      <QuestionCard
        prompt="Explain hash maps."
        questionNumber={1}
        totalQuestions={3}
        onSubmit={vi.fn()}
      />,
    );

    // Candidate tabs into the answer field, then submits — the parent
    // advances to a new prompt, remounting this whole body via `key`.
    screen.getByLabelText('Your answer').focus();
    expect(screen.getByLabelText('Your answer')).toHaveFocus();

    rerender(
      <QuestionCard
        prompt="Explain binary search."
        questionNumber={2}
        totalQuestions={3}
        onSubmit={vi.fn()}
      />,
    );

    // The old textarea no longer exists once remounted; without an explicit
    // refocus, the browser silently drops focus to <body>, forcing a
    // keyboard-only candidate to Tab from the very top of the page after
    // every single answer. The new heading must pick up focus instead.
    expect(screen.getByRole('heading', { name: 'Explain binary search.' })).toHaveFocus();
  });

  it('renders the question number, prompt, and answer field', () => {
    render(
      <QuestionCard
        prompt="Explain hash maps."
        questionNumber={1}
        totalQuestions={3}
        onSubmit={vi.fn()}
      />,
    );

    expect(screen.getByText('Question 1 of 3')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Explain hash maps.' })).toBeInTheDocument();
    expect(screen.getByLabelText('Your answer')).toBeInTheDocument();
  });

  it('marks a follow-up prompt distinctly', () => {
    render(
      <QuestionCard
        prompt="Can you elaborate?"
        questionNumber={1}
        totalQuestions={3}
        isFollowUp
        onSubmit={vi.fn()}
      />,
    );
    expect(screen.getByText('Question 1 of 3 — follow-up')).toBeInTheDocument();
  });

  it('submits the typed answer and clears the field', async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();
    render(
      <QuestionCard
        prompt="Explain hash maps."
        questionNumber={1}
        totalQuestions={1}
        onSubmit={onSubmit}
      />,
    );

    const textarea = screen.getByLabelText('Your answer');
    await user.type(textarea, 'It uses buckets.');
    await user.click(screen.getByRole('button', { name: 'Submit answer' }));

    expect(onSubmit).toHaveBeenCalledWith('It uses buckets.');
    expect(textarea).toHaveValue('');
  });

  it('reports the pasted length via onAnswerPaste when provided', async () => {
    const user = userEvent.setup();
    const onAnswerPaste = vi.fn();
    render(
      <QuestionCard
        prompt="Explain hash maps."
        questionNumber={1}
        totalQuestions={1}
        onSubmit={vi.fn()}
        onAnswerPaste={onAnswerPaste}
      />,
    );

    await user.click(screen.getByLabelText('Your answer'));
    await user.paste('a suspiciously complete answer');

    expect(onAnswerPaste).toHaveBeenCalledWith('a suspiciously complete answer'.length);
  });

  it('does not throw on paste when onAnswerPaste is not provided', async () => {
    const user = userEvent.setup();
    render(
      <QuestionCard prompt="Explain hash maps." questionNumber={1} totalQuestions={1} onSubmit={vi.fn()} />,
    );

    await user.click(screen.getByLabelText('Your answer'));
    await expect(user.paste('some text')).resolves.not.toThrow();
  });

  it('disables Submit answer when the answer is empty, and never calls onSubmit for a blank answer', async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();
    render(
      <QuestionCard
        prompt="Explain hash maps."
        questionNumber={1}
        totalQuestions={1}
        onSubmit={onSubmit}
      />,
    );

    const submitButton = screen.getByRole('button', { name: 'Submit answer' });
    expect(submitButton).toBeDisabled();

    await user.click(submitButton);
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('disables Submit answer for whitespace-only text, and enables it once real text is typed', async () => {
    const user = userEvent.setup();
    render(
      <QuestionCard
        prompt="Explain hash maps."
        questionNumber={1}
        totalQuestions={1}
        onSubmit={vi.fn()}
      />,
    );

    const textarea = screen.getByLabelText('Your answer');
    const submitButton = screen.getByRole('button', { name: 'Submit answer' });

    await user.type(textarea, '   ');
    expect(submitButton).toBeDisabled();

    await user.type(textarea, 'a real answer');
    expect(submitButton).toBeEnabled();
  });

  it('shows a hint when provided', () => {
    render(
      <QuestionCard
        prompt="Explain hash maps."
        questionNumber={1}
        totalQuestions={1}
        onSubmit={vi.fn()}
        hint="Think about how collisions are resolved."
      />,
    );
    expect(screen.getByRole('note', { name: 'Hint' })).toHaveTextContent(
      'Think about how collisions are resolved.',
    );
  });

  it('calls onRequestHint only when the hint button is provided and clicked', async () => {
    const user = userEvent.setup();
    const onRequestHint = vi.fn();
    render(
      <QuestionCard
        prompt="Explain hash maps."
        questionNumber={1}
        totalQuestions={1}
        onSubmit={vi.fn()}
        onRequestHint={onRequestHint}
      />,
    );

    await user.click(screen.getByRole('button', { name: 'Request a hint' }));
    expect(onRequestHint).toHaveBeenCalledTimes(1);
  });

  it('does not render a hint button when onRequestHint is not provided', () => {
    render(
      <QuestionCard
        prompt="Explain hash maps."
        questionNumber={1}
        totalQuestions={1}
        onSubmit={vi.fn()}
      />,
    );
    expect(screen.queryByRole('button', { name: 'Request a hint' })).not.toBeInTheDocument();
  });

  it('calls onSkip when the skip button is provided and clicked', async () => {
    const user = userEvent.setup();
    const onSkip = vi.fn();
    render(
      <QuestionCard
        prompt="Explain hash maps."
        questionNumber={1}
        totalQuestions={1}
        onSubmit={vi.fn()}
        onSkip={onSkip}
      />,
    );

    await user.click(screen.getByRole('button', { name: 'Skip question' }));
    expect(onSkip).toHaveBeenCalledTimes(1);
  });

  it('disables the form while submitting', () => {
    render(
      <QuestionCard
        prompt="Explain hash maps."
        questionNumber={1}
        totalQuestions={1}
        onSubmit={vi.fn()}
        isSubmitting
      />,
    );
    expect(screen.getByLabelText('Your answer')).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Submit answer' })).toBeDisabled();
  });

  it('does not render a mic button in text-only mode (no transcribe prop)', () => {
    render(
      <QuestionCard
        prompt="Explain hash maps."
        questionNumber={1}
        totalQuestions={1}
        onSubmit={vi.fn()}
      />,
    );
    expect(screen.queryByRole('button', { name: 'Record answer' })).not.toBeInTheDocument();
  });

  it('renders a mic button when transcribe is provided, and appends its transcript to the answer', async () => {
    const user = userEvent.setup();
    const transcribe = vi.fn(async () => 'it uses buckets');
    render(
      <QuestionCard
        prompt="Explain hash maps."
        questionNumber={1}
        totalQuestions={1}
        onSubmit={vi.fn()}
        transcribe={transcribe}
        createRecorder={vi.fn(async () => ({ stop: vi.fn(async () => new Blob(['audio'])) }))}
      />,
    );

    await user.click(screen.getByRole('button', { name: 'Record answer' }));
    await user.click(screen.getByRole('button', { name: 'Stop recording' }));

    await waitFor(() =>
      expect(screen.getByLabelText('Your answer')).toHaveValue('it uses buckets'),
    );
  });

  it('disables Submit answer while recording (the answer box reads empty until the transcript lands), then re-enables it once the transcript arrives', async () => {
    const user = userEvent.setup();
    const transcribe = vi.fn(async () => 'it uses buckets');
    render(
      <QuestionCard
        prompt="Explain hash maps."
        questionNumber={1}
        totalQuestions={1}
        onSubmit={vi.fn()}
        transcribe={transcribe}
        createRecorder={vi.fn(async () => ({ stop: vi.fn(async () => new Blob(['audio'])) }))}
      />,
    );

    const submitButton = screen.getByRole('button', { name: 'Submit answer' });
    expect(submitButton).toBeDisabled();

    await user.click(screen.getByRole('button', { name: 'Record answer' }));
    expect(submitButton).toBeDisabled();

    await user.click(screen.getByRole('button', { name: 'Stop recording' }));
    await waitFor(() => expect(submitButton).toBeEnabled());
  });

  it('does not speak the prompt in silent mode (no synthesize prop)', () => {
    render(
      <QuestionCard
        prompt="Explain hash maps."
        questionNumber={1}
        totalQuestions={1}
        onSubmit={vi.fn()}
      />,
    );
    expect(screen.queryByRole('button', { name: /play question/i })).not.toBeInTheDocument();
  });

  it('speaks the prompt when synthesize is provided', async () => {
    const playSpy = vi
      .spyOn(window.HTMLMediaElement.prototype, 'play')
      .mockResolvedValue(undefined);
    vi.stubGlobal('URL', {
      ...URL,
      createObjectURL: vi.fn(() => 'blob:fake-url'),
      revokeObjectURL: vi.fn(),
    });
    const synthesize = vi.fn(async () => ({
      audio: new ArrayBuffer(4),
      mimeType: 'audio/mpeg',
    }));

    render(
      <QuestionCard
        prompt="Explain hash maps."
        questionNumber={1}
        totalQuestions={1}
        onSubmit={vi.fn()}
        synthesize={synthesize}
      />,
    );

    await waitFor(() => expect(synthesize).toHaveBeenCalledWith('Explain hash maps.'));
    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'Replay question' })).toBeInTheDocument(),
    );

    playSpy.mockRestore();
    vi.unstubAllGlobals();
  });

  it('shows an "AI" identity label in the AI tile\'s circle instead of a bare circle, before speaking starts', () => {
    const synthesize = vi.fn(() => new Promise<SynthesisResult>(() => {})); // never resolves — stays in the pre-playback state
    render(
      <QuestionCard
        prompt="Explain hash maps."
        questionNumber={1}
        totalQuestions={1}
        onSubmit={vi.fn()}
        synthesize={synthesize}
      />,
    );
    expect(screen.getByText('AI', { selector: '.isdk-question-audio__orb-label' })).toBeInTheDocument();
  });

  it('shows the same "AI" identity label in voice-enabled mode with no synthesize (transcribe-only)', () => {
    render(
      <QuestionCard
        prompt="Explain hash maps."
        questionNumber={1}
        totalQuestions={1}
        onSubmit={vi.fn()}
        transcribe={vi.fn(async () => 'answer')}
      />,
    );
    expect(screen.getByText('AI', { selector: '.isdk-question-audio__orb-label' })).toBeInTheDocument();
  });

  it('speaks every subsequent question too, not just the first one', async () => {
    const playSpy = vi
      .spyOn(window.HTMLMediaElement.prototype, 'play')
      .mockResolvedValue(undefined);
    vi.stubGlobal('URL', {
      ...URL,
      createObjectURL: vi.fn(() => 'blob:fake-url'),
      revokeObjectURL: vi.fn(),
    });
    const synthesize = vi.fn(async () => ({
      audio: new ArrayBuffer(4),
      mimeType: 'audio/mpeg',
    }));

    const { rerender } = render(
      <QuestionCard
        prompt="Explain hash maps."
        questionNumber={1}
        totalQuestions={2}
        onSubmit={vi.fn()}
        synthesize={synthesize}
      />,
    );

    await waitFor(() => expect(playSpy).toHaveBeenCalledTimes(1));

    // This is exactly how InterviewWidget advances to the next question —
    // a new `prompt` prop on the same <QuestionCard>.
    rerender(
      <QuestionCard
        prompt="Explain binary search."
        questionNumber={2}
        totalQuestions={2}
        onSubmit={vi.fn()}
        synthesize={synthesize}
      />,
    );

    await waitFor(() => expect(synthesize).toHaveBeenLastCalledWith('Explain binary search.'));
    await waitFor(() => expect(playSpy).toHaveBeenCalledTimes(2));

    playSpy.mockRestore();
    vi.unstubAllGlobals();
  });

  it('gates the mic button while the AI is speaking, then enables it once playback ends', async () => {
    const playSpy = vi
      .spyOn(window.HTMLMediaElement.prototype, 'play')
      .mockResolvedValue(undefined);
    vi.stubGlobal('URL', {
      ...URL,
      createObjectURL: vi.fn(() => 'blob:fake-url'),
      revokeObjectURL: vi.fn(),
    });
    const synthesize = vi.fn(async () => ({ audio: new ArrayBuffer(4), mimeType: 'audio/mpeg' }));
    const transcribe = vi.fn(async () => 'an answer');

    const { container } = render(
      <QuestionCard
        prompt="Explain hash maps."
        questionNumber={1}
        totalQuestions={1}
        onSubmit={vi.fn()}
        synthesize={synthesize}
        transcribe={transcribe}
        createRecorder={vi.fn(async () => ({ stop: vi.fn(async () => new Blob(['audio'])) }))}
      />,
    );

    await waitFor(() => expect(playSpy).toHaveBeenCalledTimes(1));
    expect(screen.getByRole('button', { name: 'Record answer' })).toBeDisabled();
    expect(screen.getByText('AI is asking…')).toBeInTheDocument();

    fireEvent(container.querySelector('audio')!, new Event('play'));
    fireEvent(container.querySelector('audio')!, new Event('ended'));

    expect(screen.getByRole('button', { name: 'Record answer' })).toBeEnabled();
    expect(screen.getByText('Your turn')).toBeInTheDocument();

    playSpy.mockRestore();
    vi.unstubAllGlobals();
  });

  it('releases the mic gate if question audio fails, instead of deadlocking the candidate', async () => {
    vi.stubGlobal('URL', {
      ...URL,
      createObjectURL: vi.fn(() => 'blob:fake-url'),
      revokeObjectURL: vi.fn(),
    });
    const synthesize = vi.fn(async () => {
      throw new Error('voice provider is overloaded');
    });
    const transcribe = vi.fn(async () => 'an answer');
    const onVoiceError = vi.fn();

    render(
      <QuestionCard
        prompt="Explain hash maps."
        questionNumber={1}
        totalQuestions={1}
        onSubmit={vi.fn()}
        synthesize={synthesize}
        transcribe={transcribe}
        onVoiceError={onVoiceError}
        createRecorder={vi.fn(async () => ({ stop: vi.fn(async () => new Blob(['audio'])) }))}
      />,
    );

    await waitFor(() => expect(onVoiceError).toHaveBeenCalledTimes(1));
    expect(screen.getByRole('button', { name: 'Record answer' })).toBeEnabled();
    expect(screen.getByText('Your turn')).toBeInTheDocument();

    vi.unstubAllGlobals();
  });

  it('shows a recording pill while the mic is active', async () => {
    const user = userEvent.setup();
    const transcribe = vi.fn(async () => 'an answer');

    render(
      <QuestionCard
        prompt="Explain hash maps."
        questionNumber={1}
        totalQuestions={1}
        onSubmit={vi.fn()}
        transcribe={transcribe}
        createRecorder={vi.fn(async () => ({ stop: vi.fn(async () => new Blob(['audio'])) }))}
      />,
    );

    await user.click(screen.getByRole('button', { name: 'Record answer' }));
    await waitFor(() => expect(screen.getByText('● Recording')).toBeInTheDocument());
  });

  it('never disables the textarea because of voice turn-state — only isSubmitting/disabled gate it', async () => {
    const playSpy = vi
      .spyOn(window.HTMLMediaElement.prototype, 'play')
      .mockResolvedValue(undefined);
    vi.stubGlobal('URL', {
      ...URL,
      createObjectURL: vi.fn(() => 'blob:fake-url'),
      revokeObjectURL: vi.fn(),
    });
    const synthesize = vi.fn(async () => ({ audio: new ArrayBuffer(4), mimeType: 'audio/mpeg' }));

    render(
      <QuestionCard
        prompt="Explain hash maps."
        questionNumber={1}
        totalQuestions={1}
        onSubmit={vi.fn()}
        synthesize={synthesize}
      />,
    );

    await waitFor(() => expect(playSpy).toHaveBeenCalledTimes(1));
    // Still 'ai_speaking' at this point (no play/ended event fired) — the
    // textarea must remain fully usable regardless.
    expect(screen.getByLabelText('Your answer')).toBeEnabled();

    playSpy.mockRestore();
    vi.unstubAllGlobals();
  });

  it('does not render a turn pill in fully text-only mode (no synthesize or transcribe)', () => {
    render(
      <QuestionCard
        prompt="Explain hash maps."
        questionNumber={1}
        totalQuestions={1}
        onSubmit={vi.fn()}
      />,
    );
    expect(screen.queryByText('Your turn')).not.toBeInTheDocument();
    expect(screen.queryByText('AI is asking…')).not.toBeInTheDocument();
  });

  it('shows a Muted badge on the candidate tile whenever the mic is not actively recording', () => {
    const transcribe = vi.fn(async () => 'an answer');
    render(
      <QuestionCard
        prompt="Explain hash maps."
        questionNumber={1}
        totalQuestions={1}
        onSubmit={vi.fn()}
        transcribe={transcribe}
        createRecorder={vi.fn(async () => ({ stop: vi.fn(async () => new Blob(['audio'])) }))}
      />,
    );
    expect(screen.getByText('Muted')).toBeInTheDocument();
  });

  it('hides the Muted badge while actually recording', async () => {
    const user = userEvent.setup();
    const transcribe = vi.fn(async () => 'an answer');
    render(
      <QuestionCard
        prompt="Explain hash maps."
        questionNumber={1}
        totalQuestions={1}
        onSubmit={vi.fn()}
        transcribe={transcribe}
        createRecorder={vi.fn(async () => ({ stop: vi.fn(async () => new Blob(['audio'])) }))}
      />,
    );
    await user.click(screen.getByRole('button', { name: 'Record answer' }));
    await waitFor(() => expect(screen.queryByText('Muted')).not.toBeInTheDocument());
  });

  it('shows the candidate name and its initial on the candidate tile', () => {
    const transcribe = vi.fn(async () => 'an answer');
    render(
      <QuestionCard
        prompt="Explain hash maps."
        questionNumber={1}
        totalQuestions={1}
        onSubmit={vi.fn()}
        transcribe={transcribe}
        candidateName="Alex Chen"
      />,
    );
    expect(screen.getByText('Alex Chen')).toBeInTheDocument();
    expect(screen.getByText('A')).toBeInTheDocument();
  });

  it('defaults the candidate name to "You" when not provided', () => {
    const transcribe = vi.fn(async () => 'an answer');
    render(
      <QuestionCard
        prompt="Explain hash maps."
        questionNumber={1}
        totalQuestions={1}
        onSubmit={vi.fn()}
        transcribe={transcribe}
      />,
    );
    expect(screen.getByText('You')).toBeInTheDocument();
  });

  it('shows the topic tag in the question meta when provided', () => {
    render(
      <QuestionCard
        prompt="Explain hash maps."
        questionNumber={1}
        totalQuestions={3}
        onSubmit={vi.fn()}
        topic="Concurrency"
      />,
    );
    expect(screen.getByText('Question 1 of 3 — Concurrency')).toBeInTheDocument();
  });

  it('toggles the Speaker control to mute/unmute the AI audio', async () => {
    const user = userEvent.setup();
    const playSpy = vi.spyOn(window.HTMLMediaElement.prototype, 'play').mockResolvedValue(undefined);
    vi.stubGlobal('URL', {
      ...URL,
      createObjectURL: vi.fn(() => 'blob:fake-url'),
      revokeObjectURL: vi.fn(),
    });
    const synthesize = vi.fn(async () => ({ audio: new ArrayBuffer(4), mimeType: 'audio/mpeg' }));

    const { container } = render(
      <QuestionCard
        prompt="Explain hash maps."
        questionNumber={1}
        totalQuestions={1}
        onSubmit={vi.fn()}
        synthesize={synthesize}
      />,
    );

    await waitFor(() => expect(playSpy).toHaveBeenCalledTimes(1));
    const speakerButton = screen.getByRole('button', { name: 'Speaker' });
    expect(container.querySelector('audio')).toHaveProperty('muted', false);

    await user.click(speakerButton);
    expect(speakerButton).toHaveAttribute('aria-pressed', 'true');
    expect(container.querySelector('audio')).toHaveProperty('muted', true);

    playSpy.mockRestore();
    vi.unstubAllGlobals();
  });

  it('renders Pause as a plain button so it never submits the in-progress answer', async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();
    const onPause = vi.fn();
    render(
      <QuestionCard
        prompt="Explain hash maps."
        questionNumber={1}
        totalQuestions={1}
        onSubmit={onSubmit}
        onPause={onPause}
        elapsedLabel="0:42"
      />,
    );

    await user.type(screen.getByLabelText('Your answer'), 'Partial answer in progress');
    await user.click(screen.getByRole('button', { name: 'Pause' }));

    expect(onPause).toHaveBeenCalledTimes(1);
    expect(onSubmit).not.toHaveBeenCalled();
    expect(screen.getByLabelText('Your answer')).toHaveValue('Partial answer in progress');
  });

  it('disables Pause when pauseDisabled is set', () => {
    render(
      <QuestionCard
        prompt="Explain hash maps."
        questionNumber={1}
        totalQuestions={1}
        onSubmit={vi.fn()}
        onPause={vi.fn()}
        pauseDisabled
      />,
    );
    expect(screen.getByRole('button', { name: 'Pause' })).toBeDisabled();
  });

  it('does not render a timer or Pause button when neither is provided', () => {
    render(
      <QuestionCard
        prompt="Explain hash maps."
        questionNumber={1}
        totalQuestions={1}
        onSubmit={vi.fn()}
      />,
    );
    expect(screen.queryByRole('button', { name: 'Pause' })).not.toBeInTheDocument();
  });

  it('labels the toolbar hint/skip controls "Hints"/"Skip" (not the text-only labels) once voice is enabled', () => {
    const transcribe = vi.fn(async () => 'an answer');
    render(
      <QuestionCard
        prompt="Explain hash maps."
        questionNumber={1}
        totalQuestions={1}
        onSubmit={vi.fn()}
        onRequestHint={vi.fn()}
        onSkip={vi.fn()}
        transcribe={transcribe}
      />,
    );
    expect(screen.getByRole('button', { name: 'Hints' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Skip' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Request a hint' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Skip question' })).not.toBeInTheDocument();
  });
});
