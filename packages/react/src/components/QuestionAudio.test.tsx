import type { SynthesisResult } from '@interview-sdk/core';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { QuestionAudio } from './QuestionAudio.js';

function result(): SynthesisResult {
  return { audio: new ArrayBuffer(4), mimeType: 'audio/mpeg' };
}

let createObjectURL: ReturnType<typeof vi.fn>;
let revokeObjectURL: ReturnType<typeof vi.fn>;
let playSpy: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  createObjectURL = vi.fn(() => 'blob:fake-url');
  revokeObjectURL = vi.fn();
  vi.stubGlobal('URL', { ...URL, createObjectURL, revokeObjectURL });
  playSpy = vi.spyOn(window.HTMLMediaElement.prototype, 'play').mockResolvedValue(undefined);
});

afterEach(() => {
  playSpy.mockRestore();
  vi.unstubAllGlobals();
});

describe('QuestionAudio', () => {
  it('synthesizes on mount and autoplays once ready', async () => {
    const synthesize = vi.fn(async () => result());
    render(<QuestionAudio text="Explain hash maps." synthesize={synthesize} />);

    expect(screen.getByRole('button')).toBeDisabled();
    await waitFor(() => expect(playSpy).toHaveBeenCalledTimes(1));
    expect(synthesize).toHaveBeenCalledWith('Explain hash maps.');
    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'Replay question' })).toBeInTheDocument(),
    );
  });

  it('falls back to a manual "Play question" button when autoplay is blocked', async () => {
    playSpy.mockRejectedValueOnce(new Error('NotAllowedError'));
    const synthesize = vi.fn(async () => result());
    render(<QuestionAudio text="Explain hash maps." synthesize={synthesize} />);

    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'Play question' })).toBeInTheDocument(),
    );

    const user = userEvent.setup();
    playSpy.mockResolvedValueOnce(undefined);
    await user.click(screen.getByRole('button', { name: 'Play question' }));

    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'Replay question' })).toBeInTheDocument(),
    );
  });

  it('does not attempt to play automatically when autoPlay is false', async () => {
    const synthesize = vi.fn(async () => result());
    render(<QuestionAudio text="Explain hash maps." synthesize={synthesize} autoPlay={false} />);

    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'Play question' })).toBeInTheDocument(),
    );
    expect(playSpy).not.toHaveBeenCalled();
  });

  it('reports an error and renders nothing when synthesis fails', async () => {
    const onError = vi.fn();
    const synthesize = vi.fn(async () => {
      throw new Error('voice provider is overloaded');
    });
    const { container } = render(
      <QuestionAudio text="Explain hash maps." synthesize={synthesize} onError={onError} />,
    );

    await waitFor(() => expect(onError).toHaveBeenCalledTimes(1));
    expect(onError.mock.calls[0]![0].message).toBe('voice provider is overloaded');
    expect(container).toBeEmptyDOMElement();
  });

  it('reports an error when a manual play attempt fails', async () => {
    playSpy.mockRejectedValueOnce(new Error('autoplay blocked'));
    const onError = vi.fn();
    const synthesize = vi.fn(async () => result());
    render(<QuestionAudio text="Explain hash maps." synthesize={synthesize} onError={onError} />);

    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'Play question' })).toBeInTheDocument(),
    );

    const user = userEvent.setup();
    playSpy.mockRejectedValueOnce(new Error('still blocked'));
    await user.click(screen.getByRole('button', { name: 'Play question' }));

    await waitFor(() => expect(onError).toHaveBeenCalledTimes(1));
    expect(onError.mock.calls[0]![0].message).toBe('still blocked');
  });

  it('re-synthesizes and revokes the previous audio URL when the text changes', async () => {
    const synthesize = vi.fn(async () => result());
    const { rerender } = render(
      <QuestionAudio text="Explain hash maps." synthesize={synthesize} />,
    );

    // Wait for the first synthesis cycle to fully settle (autoplay resolved)
    // before swapping text, so its cleanup doesn't race the second cycle.
    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'Replay question' })).toBeInTheDocument(),
    );
    rerender(<QuestionAudio text="Explain binary search." synthesize={synthesize} />);

    await waitFor(() => expect(synthesize).toHaveBeenCalledTimes(2));
    expect(synthesize).toHaveBeenLastCalledWith('Explain binary search.');
    expect(revokeObjectURL).toHaveBeenCalledWith('blob:fake-url');
  });

  // jsdom's mocked play() (above) does not cause the <audio> element to fire
  // a real 'play'/'pause'/'ended' event on its own — these must be dispatched
  // manually to exercise the turn-state callbacks a caller relies on.
  it('calls onPlaybackStart when the audio element fires a real play event', async () => {
    const synthesize = vi.fn(async () => result());
    const onPlaybackStart = vi.fn();
    const { container } = render(
      <QuestionAudio text="Explain hash maps." synthesize={synthesize} onPlaybackStart={onPlaybackStart} />,
    );

    await waitFor(() => expect(playSpy).toHaveBeenCalledTimes(1));
    fireEvent(container.querySelector('audio')!, new Event('play'));

    expect(onPlaybackStart).toHaveBeenCalledTimes(1);
  });

  it('calls onPlaybackEnd when the audio element fires a real ended event', async () => {
    const synthesize = vi.fn(async () => result());
    const onPlaybackEnd = vi.fn();
    const { container } = render(
      <QuestionAudio text="Explain hash maps." synthesize={synthesize} onPlaybackEnd={onPlaybackEnd} />,
    );

    await waitFor(() => expect(playSpy).toHaveBeenCalledTimes(1));
    const audio = container.querySelector('audio')!;
    fireEvent(audio, new Event('play'));
    fireEvent(audio, new Event('ended'));

    expect(onPlaybackEnd).toHaveBeenCalledTimes(1);
  });

  it('calls onPlaybackEnd on a real pause event too', async () => {
    const synthesize = vi.fn(async () => result());
    const onPlaybackEnd = vi.fn();
    const { container } = render(
      <QuestionAudio text="Explain hash maps." synthesize={synthesize} onPlaybackEnd={onPlaybackEnd} />,
    );

    await waitFor(() => expect(playSpy).toHaveBeenCalledTimes(1));
    const audio = container.querySelector('audio')!;
    fireEvent(audio, new Event('play'));
    fireEvent(audio, new Event('pause'));

    expect(onPlaybackEnd).toHaveBeenCalledTimes(1);
  });

  it('renders a presence indicator alongside the control by default', async () => {
    const synthesize = vi.fn(async () => result());
    const { container } = render(<QuestionAudio text="Explain hash maps." synthesize={synthesize} />);

    await waitFor(() => expect(playSpy).toHaveBeenCalledTimes(1));
    expect(container.querySelector('.isdk-question-audio__orb')).toBeInTheDocument();
  });

  it('omits the presence indicator when showLevelMeter is false', async () => {
    const synthesize = vi.fn(async () => result());
    const { container } = render(
      <QuestionAudio text="Explain hash maps." synthesize={synthesize} showLevelMeter={false} />,
    );

    await waitFor(() => expect(playSpy).toHaveBeenCalledTimes(1));
    expect(container.querySelector('.isdk-question-audio__orb')).not.toBeInTheDocument();
  });

  it('mutes the underlying audio element without affecting playback itself', async () => {
    const synthesize = vi.fn(async () => result());
    const { container } = render(
      <QuestionAudio text="Explain hash maps." synthesize={synthesize} muted />,
    );

    await waitFor(() => expect(playSpy).toHaveBeenCalledTimes(1));
    expect(container.querySelector('audio')).toHaveProperty('muted', true);
  });

  it('is unmuted by default', async () => {
    const synthesize = vi.fn(async () => result());
    const { container } = render(<QuestionAudio text="Explain hash maps." synthesize={synthesize} />);

    await waitFor(() => expect(playSpy).toHaveBeenCalledTimes(1));
    expect(container.querySelector('audio')).toHaveProperty('muted', false);
  });
});
