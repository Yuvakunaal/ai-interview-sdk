import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { InterviewLobby } from './InterviewLobby.js';

function fakeStream(): MediaStream {
  return { getTracks: () => [] } as unknown as MediaStream;
}

describe('InterviewLobby', () => {
  it('renders a join button using the default label', () => {
    render(<InterviewLobby onJoin={vi.fn()} voiceEnabled={false} />);
    expect(screen.getByRole('button', { name: 'Start interview' })).toBeInTheDocument();
  });

  it('supports a custom join label', () => {
    render(<InterviewLobby onJoin={vi.fn()} voiceEnabled={false} joinLabel="Begin" />);
    expect(screen.getByRole('button', { name: 'Begin' })).toBeInTheDocument();
  });

  it('calls onJoin when the join button is clicked', async () => {
    const user = userEvent.setup();
    const onJoin = vi.fn();
    render(<InterviewLobby onJoin={onJoin} voiceEnabled={false} />);

    await user.click(screen.getByRole('button', { name: 'Start interview' }));
    expect(onJoin).toHaveBeenCalledTimes(1);
  });

  it('shows the question count when provided', () => {
    render(<InterviewLobby onJoin={vi.fn()} voiceEnabled={false} totalQuestions={3} />);
    expect(screen.getByText('3 questions · Answered by typing')).toBeInTheDocument();
  });

  it('skips the mic check entirely in text-only mode', () => {
    render(<InterviewLobby onJoin={vi.fn()} voiceEnabled={false} />);
    expect(screen.queryByRole('button', { name: 'Test microphone' })).not.toBeInTheDocument();
    expect(screen.getByText('Answered by typing')).toBeInTheDocument();
  });

  it('offers a mic check when voice is enabled, and never blocks joining before it succeeds', async () => {
    const user = userEvent.setup();
    const onJoin = vi.fn();
    render(<InterviewLobby onJoin={onJoin} voiceEnabled />);

    expect(screen.getByRole('button', { name: 'Test microphone' })).toBeInTheDocument();
    // Joining works immediately, without ever running the mic check.
    await user.click(screen.getByRole('button', { name: 'Start interview' }));
    expect(onJoin).toHaveBeenCalledTimes(1);
  });

  it('shows a live meter once the mic check succeeds', async () => {
    const user = userEvent.setup();
    const requestMicStream = vi.fn(async () => fakeStream());
    render(<InterviewLobby onJoin={vi.fn()} voiceEnabled requestMicStream={requestMicStream} />);

    await user.click(screen.getByRole('button', { name: 'Test microphone' }));
    await waitFor(() =>
      expect(screen.getByText(/Microphone connected/)).toBeInTheDocument(),
    );
  });

  it('reports a friendly message and still allows joining when the mic check fails', async () => {
    const user = userEvent.setup();
    const requestMicStream = vi.fn(async () => {
      throw new Error('Permission denied');
    });
    const onJoin = vi.fn();
    render(<InterviewLobby onJoin={onJoin} voiceEnabled requestMicStream={requestMicStream} />);

    await user.click(screen.getByRole('button', { name: 'Test microphone' }));
    await waitFor(() => expect(screen.getByRole('note', { name: 'Microphone check' })).toBeInTheDocument());
    expect(screen.getByRole('note', { name: 'Microphone check' })).toHaveTextContent(
      'Permission denied',
    );

    await user.click(screen.getByRole('button', { name: 'Start interview' }));
    expect(onJoin).toHaveBeenCalledTimes(1);
  });

  it('stops the preview stream before calling onJoin', async () => {
    const user = userEvent.setup();
    const stopTrack = vi.fn();
    const requestMicStream = vi.fn(async () => ({ getTracks: () => [{ stop: stopTrack }] }) as unknown as MediaStream);
    const onJoin = vi.fn();
    render(<InterviewLobby onJoin={onJoin} voiceEnabled requestMicStream={requestMicStream} />);

    await user.click(screen.getByRole('button', { name: 'Test microphone' }));
    await waitFor(() => expect(screen.getByText(/Microphone connected/)).toBeInTheDocument());

    await user.click(screen.getByRole('button', { name: 'Start interview' }));
    expect(stopTrack).toHaveBeenCalledTimes(1);
    expect(onJoin).toHaveBeenCalledTimes(1);
  });
});
