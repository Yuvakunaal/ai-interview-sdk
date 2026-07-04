import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { MicButton, type AudioRecorder } from './MicButton.js';

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

  it('reports an error when the browser has no mediaDevices support', async () => {
    const user = userEvent.setup();
    const onError = vi.fn();
    render(<MicButton transcribe={vi.fn()} onTranscript={vi.fn()} onError={onError} />);

    await user.click(screen.getByRole('button'));

    await waitFor(() => expect(onError).toHaveBeenCalledTimes(1));
    expect(onError.mock.calls[0]![0].message).toMatch(/does not support microphone capture/);
  });
});
