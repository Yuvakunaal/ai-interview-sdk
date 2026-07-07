import { useEffect, useState } from 'react';
import { AudioLevelMeter } from './AudioLevelMeter.js';
import { useMicLevelMeter } from '../hooks/useMicLevelMeter.js';

export interface InterviewLobbyProps {
  /** Begins the real interview session — typically useInterview's start(). */
  onJoin: () => void;
  /** Whether this interview uses voice at all (a transcribe function was given to InterviewWidget). Text-only mode skips the mic check entirely. */
  voiceEnabled: boolean;
  totalQuestions?: number;
  /**
   * Requests a live mic stream purely to preview it — never produces a
   * recording, distinct from MicButton's Blob-producing AudioRecorder.
   * Defaults to a real getUserMedia({ audio: true }) call. Injectable for
   * testing.
   */
  requestMicStream?: () => Promise<MediaStream>;
  /** Overrides the primary action's visible text. Defaults to 'Start interview'. */
  joinLabel?: string;
}

async function defaultRequestMicStream(): Promise<MediaStream> {
  if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
    throw new Error('This browser does not support microphone capture.');
  }
  return navigator.mediaDevices.getUserMedia({ audio: true });
}

type CheckStatus = 'idle' | 'checking' | 'active' | 'error';

/**
 * A pre-join screen — a mic check plus a "ready to begin" confirmation,
 * matching the lobby real video-call/interview platforms put candidates
 * through before a live session. The mic check is always optional: joining
 * never depends on it succeeding, matching this codebase's standing rule
 * that voice is an enhancement, never a blocker.
 */
export function InterviewLobby({
  onJoin,
  voiceEnabled,
  totalQuestions,
  requestMicStream = defaultRequestMicStream,
  joinLabel = 'Start interview',
}: InterviewLobbyProps) {
  const [status, setStatus] = useState<CheckStatus>('idle');
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | undefined>(undefined);

  const { levels, isSupported } = useMicLevelMeter(stream, status === 'active');

  useEffect(() => {
    // Stop the preview stream if the candidate navigates away without
    // joining — the mic must never stay hot longer than this screen.
    return () => {
      stream?.getTracks().forEach((track) => track.stop());
    };
  }, [stream]);

  const testMicrophone = async () => {
    setStatus('checking');
    setErrorMessage(undefined);
    try {
      const nextStream = await requestMicStream();
      setStream(nextStream);
      setStatus('active');
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : 'Microphone access was denied or is unavailable.',
      );
      setStatus('error');
    }
  };

  const handleJoin = () => {
    stream?.getTracks().forEach((track) => track.stop());
    onJoin();
  };

  // One cohesive meta line rather than two flat, disconnected sentences —
  // question count and answer mode are both quick facts, not separate
  // thoughts, so they read as a single scannable line.
  const metaParts: string[] = [];
  if (typeof totalQuestions === 'number') {
    metaParts.push(`${totalQuestions} question${totalQuestions === 1 ? '' : 's'}`);
  }
  if (!voiceEnabled) {
    metaParts.push('Answered by typing');
  }

  return (
    <div className="isdk-lobby">
      <p className="isdk-kicker">Before you begin</p>
      <h2 className="isdk-lobby__title">
        {voiceEnabled ? 'Ready to join the interview?' : 'Ready to begin?'}
      </h2>
      {metaParts.length > 0 && <p className="isdk-lobby__meta">{metaParts.join(' · ')}</p>}

      {voiceEnabled && (
        <div className="isdk-lobby__mic-check">
          {status === 'active' ? (
            <div className="isdk-lobby__mic-active">
              <AudioLevelMeter levels={levels} variant="listening" isIdle={!isSupported} />
              <span>Microphone connected — speak to see the level move.</span>
            </div>
          ) : (
            <button
              className="isdk-btn isdk-btn--secondary"
              type="button"
              onClick={() => void testMicrophone()}
              disabled={status === 'checking'}
            >
              {status === 'checking' ? 'Checking microphone…' : 'Test microphone'}
            </button>
          )}
          {status === 'error' && (
            <p className="isdk-lobby__hint" role="note" aria-label="Microphone check">
              {errorMessage} You can still continue — typing is always available as a fallback.
            </p>
          )}
        </div>
      )}

      <div className="isdk-lobby__actions">
        <button className="isdk-btn isdk-btn--primary" type="button" onClick={handleJoin}>
          {joinLabel}
        </button>
      </div>
    </div>
  );
}
