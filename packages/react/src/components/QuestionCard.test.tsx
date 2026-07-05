import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { QuestionCard } from './QuestionCard.js';

describe('QuestionCard', () => {
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

  it('submits an empty string when the candidate submits without typing anything', async () => {
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

    await user.click(screen.getByRole('button', { name: 'Submit answer' }));

    expect(onSubmit).toHaveBeenCalledWith('');
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
});
