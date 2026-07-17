import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { MicButton, type AudioRecorder } from './MicButton.js';

function fakeRecorderWithStream(audio: Blob, stopTrack: () => void): AudioRecorder {
  return {
    stop: vi.fn(async () => audio),
    stream: { getTracks: () => [{ stop: stopTrack }] } as unknown as MediaStream,
  };
}

function fakeRecorder(audio: Blob): AudioRecorder {
  return { stop: vi.fn(async () => audio) };
}

class FakeMediaRecorder {
  ondataavailable: ((event: { data: Blob }) => void) | null = null;
  onstop: (() => void) | null = null;
  mimeType = 'audio/webm';
  start() {
    queueMicrotask(() => this.ondataavailable?.({ data: new Blob(['captured-chunk']) }));
  }
  stop() {
    queueMicrotask(() => this.onstop?.());
  }
}

afterEach(() => {
  vi.unstubAllGlobals();
  // @ts-expect-error - restoring jsdom's default (absent) mediaDevices between tests.
  delete navigator.mediaDevices;
});

describe('MicButton', () => {
  it('renders the default label and is not pressed initially', () => {
    render(<MicButton transcribe={vi.fn()} onTranscript={vi.fn()} />);
    const button = screen.getByRole('button', { name: 'Record answer' });
    expect(button).toHaveAttribute('aria-pressed', 'false');
  });

  it('renders a custom label', () => {
    render(<MicButton transcribe={vi.fn()} onTranscript={vi.fn()} label="Answer with voice" />);
    expect(screen.getByRole('button', { name: 'Answer with voice' })).toBeInTheDocument();
  });

  it('starts recording on click and shows a pressed state', async () => {
    const user = userEvent.setup();
    const createRecorder = vi.fn(async () => fakeRecorder(new Blob(['audio'])));
    render(
      <MicButton transcribe={vi.fn()} onTranscript={vi.fn()} createRecorder={createRecorder} />,
    );

    await user.click(screen.getByRole('button'));

    expect(createRecorder).toHaveBeenCalledTimes(1);
    expect(screen.getByRole('button', { name: 'Stop recording' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
  });

  it('stops recording, transcribes the audio, and reports the transcript', async () => {
    const user = userEvent.setup();
    const audio = new Blob(['audio-bytes']);
    const createRecorder = vi.fn(async () => fakeRecorder(audio));
    const transcribe = vi.fn(async () => 'a hash map uses buckets');
    const onTranscript = vi.fn();
    render(
      <MicButton
        transcribe={transcribe}
        onTranscript={onTranscript}
        createRecorder={createRecorder}
      />,
    );

    await user.click(screen.getByRole('button')); // start
    await user.click(screen.getByRole('button', { name: 'Stop recording' })); // stop

    await waitFor(() => expect(onTranscript).toHaveBeenCalledWith('a hash map uses buckets'));
    expect(transcribe).toHaveBeenCalledWith(audio);
  });

  it('reports an error and does not call transcribe when captured audio is empty', async () => {
    const user = userEvent.setup();
    const createRecorder = vi.fn(async () => fakeRecorder(new Blob([])));
    const transcribe = vi.fn();
    const onError = vi.fn();
    render(
      <MicButton
        transcribe={transcribe}
        onTranscript={vi.fn()}
        onError={onError}
        createRecorder={createRecorder}
      />,
    );

    await user.click(screen.getByRole('button'));
    await user.click(screen.getByRole('button', { name: 'Stop recording' }));

    await waitFor(() => expect(onError).toHaveBeenCalledTimes(1));
    expect(onError.mock.calls[0]![0]).toBeInstanceOf(Error);
    expect(transcribe).not.toHaveBeenCalled();
  });

  it('reports an error when mic access is denied (createRecorder rejects), staying not-recording', async () => {
    const user = userEvent.setup();
    const createRecorder = vi.fn(async () => {
      throw new Error('Permission denied');
    });
    const onError = vi.fn();
    render(
      <MicButton
        transcribe={vi.fn()}
        onTranscript={vi.fn()}
        onError={onError}
        createRecorder={createRecorder}
      />,
    );

    await user.click(screen.getByRole('button'));

    await waitFor(() => expect(onError).toHaveBeenCalledTimes(1));
    expect(screen.getByRole('button')).toHaveAttribute('aria-pressed', 'false');
  });

  it('reports an error when transcription itself fails', async () => {
    const user = userEvent.setup();
    const createRecorder = vi.fn(async () => fakeRecorder(new Blob(['audio'])));
    const transcribe = vi.fn(async () => {
      throw new Error('provider is overloaded');
    });
    const onError = vi.fn();
    render(
      <MicButton
        transcribe={transcribe}
        onTranscript={vi.fn()}
        onError={onError}
        createRecorder={createRecorder}
      />,
    );

    await user.click(screen.getByRole('button'));
    await user.click(screen.getByRole('button', { name: 'Stop recording' }));

    await waitFor(() => expect(onError).toHaveBeenCalledTimes(1));
    expect(onError.mock.calls[0]![0].message).toBe('provider is overloaded');
  });

  it('is disabled when the disabled prop is set', () => {
    render(<MicButton transcribe={vi.fn()} onTranscript={vi.fn()} disabled />);
    expect(screen.getByRole('button')).toBeDisabled();
  });

  it('records and transcribes using the real browser recorder when createRecorder is not overridden', async () => {
    const user = userEvent.setup();
    vi.stubGlobal('MediaRecorder', FakeMediaRecorder);
    const stopTrack = vi.fn();
    const getUserMedia = vi.fn(async () => ({
      getTracks: () => [{ stop: stopTrack }],
    }));
    Object.defineProperty(navigator, 'mediaDevices', {
      value: { getUserMedia },
      configurable: true,
    });
    const transcribe = vi.fn(async (_audio: Blob) => 'a hash map uses buckets');
    const onTranscript = vi.fn();

    render(<MicButton transcribe={transcribe} onTranscript={onTranscript} />);

    await user.click(screen.getByRole('button'));
    expect(getUserMedia).toHaveBeenCalledWith({ audio: true });
    expect(screen.getByRole('button', { name: 'Stop recording' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );

    await user.click(screen.getByRole('button', { name: 'Stop recording' }));

    await waitFor(() => expect(onTranscript).toHaveBeenCalledWith('a hash map uses buckets'));
    expect(stopTrack).toHaveBeenCalledTimes(1);
    expect(transcribe.mock.calls[0]![0]).toBeInstanceOf(Blob);
  });

  it('stops the live mic stream if the button unmounts while still recording (e.g. Pause mid-answer)', async () => {
    const user = userEvent.setup();
    const stopTrack = vi.fn();
    const createRecorder = vi.fn(async () =>
      fakeRecorderWithStream(new Blob(['audio']), stopTrack),
    );
    const { unmount } = render(
      <MicButton transcribe={vi.fn()} onTranscript={vi.fn()} createRecorder={createRecorder} />,
    );

    await user.click(screen.getByRole('button'));
    expect(screen.getByRole('button', { name: 'Stop recording' })).toBeInTheDocument();

    // The candidate pauses (or the widget otherwise unmounts this control)
    // mid-recording, without ever clicking "Stop recording" — the mic must
    // not stay hot indefinitely just because no explicit stop happened.
    unmount();

    expect(stopTrack).toHaveBeenCalledTimes(1);
  });

  it('reports an error when the browser has no mediaDevices support', async () => {
    const user = userEvent.setup();
    const onError = vi.fn();
    render(<MicButton transcribe={vi.fn()} onTranscript={vi.fn()} onError={onError} />);

    await user.click(screen.getByRole('button'));

    await waitFor(() => expect(onError).toHaveBeenCalledTimes(1));
    expect(onError.mock.calls[0]![0].message).toMatch(/does not support microphone capture/);
  });

  it('calls onRecordingChange on start/stop transitions, skipping the initial mount', async () => {
    const user = userEvent.setup();
    const createRecorder = vi.fn(async () => fakeRecorder(new Blob(['audio'])));
    const onRecordingChange = vi.fn();
    render(
      <MicButton
        transcribe={vi.fn(async () => 'text')}
        onTranscript={vi.fn()}
        createRecorder={createRecorder}
        onRecordingChange={onRecordingChange}
      />,
    );

    expect(onRecordingChange).not.toHaveBeenCalled();

    await user.click(screen.getByRole('button'));
    // createRecorder() is itself async, so onRecordingChange(true) lands via
    // a follow-up state update + effect, not synchronously with the click —
    // asserting this without waitFor is exactly the kind of timing
    // assumption that's fast-machine-only, and flaked in CI.
    await waitFor(() => expect(onRecordingChange).toHaveBeenNthCalledWith(1, true));

    await user.click(screen.getByRole('button', { name: 'Stop recording' }));
    await waitFor(() => expect(onRecordingChange).toHaveBeenNthCalledWith(2, false));
  });

  it('applies the emphasized modifier class when the emphasized prop is set', () => {
    render(<MicButton transcribe={vi.fn()} onTranscript={vi.fn()} emphasized />);
    expect(screen.getByRole('button')).toHaveClass('isdk-btn--mic-invite');
  });

  it('does not apply the emphasized modifier class by default', () => {
    render(<MicButton transcribe={vi.fn()} onTranscript={vi.fn()} />);
    expect(screen.getByRole('button')).not.toHaveClass('isdk-btn--mic-invite');
  });

  it('shows no level meter before recording starts, and an idle one once it does', async () => {
    const user = userEvent.setup();
    const createRecorder = vi.fn(async () => fakeRecorder(new Blob(['audio'])));
    const { container } = render(
      <MicButton
        transcribe={vi.fn(async () => 'text')}
        onTranscript={vi.fn()}
        createRecorder={createRecorder}
      />,
    );

    expect(container.querySelector('.isdk-audio-meter')).not.toBeInTheDocument();

    await user.click(screen.getByRole('button'));
    // No real AudioContext in jsdom, so isSupported stays false — the meter
    // still renders (matching QuestionAudio's degrade behavior) but idle-styled.
    expect(container.querySelector('.isdk-audio-meter')).toBeInTheDocument();
    expect(container.querySelector('.isdk-audio-meter')).toHaveClass('isdk-audio-meter--idle');
  });

  it('hides the level meter entirely when showLevelMeter is false', async () => {
    const user = userEvent.setup();
    const createRecorder = vi.fn(async () => fakeRecorder(new Blob(['audio'])));
    const { container } = render(
      <MicButton
        transcribe={vi.fn(async () => 'text')}
        onTranscript={vi.fn()}
        createRecorder={createRecorder}
        showLevelMeter={false}
      />,
    );

    await user.click(screen.getByRole('button'));
    expect(container.querySelector('.isdk-audio-meter')).not.toBeInTheDocument();
  });

  it('calls onLevelsChange with live data so a caller can drive its own separate meter', async () => {
    const user = userEvent.setup();
    const createRecorder = vi.fn(async () => fakeRecorder(new Blob(['audio'])));
    const onLevelsChange = vi.fn();
    render(
      <MicButton
        transcribe={vi.fn(async () => 'text')}
        onTranscript={vi.fn()}
        createRecorder={createRecorder}
        onLevelsChange={onLevelsChange}
      />,
    );

    await user.click(screen.getByRole('button'));
    await waitFor(() => expect(onLevelsChange).toHaveBeenCalled());
    const [levels, isSupported] = onLevelsChange.mock.calls.at(-1)!;
    expect(Array.isArray(levels)).toBe(true);
    expect(typeof isSupported).toBe('boolean');
  });
});
