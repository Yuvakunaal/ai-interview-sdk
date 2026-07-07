import { useCallback, useEffect, useRef, useState } from 'react';
import { AudioLevelMeter } from './AudioLevelMeter.js';
import { useMicLevelMeter } from '../hooks/useMicLevelMeter.js';

export interface AudioRecorder {
  stop: () => Promise<Blob>;
  /**
   * The live MediaStream backing this recording, when available — enables
   * a real input-level meter on the SAME stream already feeding
   * MediaRecorder, never a second getUserMedia() request. Optional:
   * test-injected fake recorders can omit it and the live meter simply
   * doesn't render.
   */
  stream?: MediaStream;
}

async function createBrowserAudioRecorder(): Promise<AudioRecorder> {
  if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
    throw new Error('This browser does not support microphone capture.');
  }
  if (typeof MediaRecorder === 'undefined') {
    throw new Error('This browser does not support MediaRecorder.');
  }

  const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
  const mediaRecorder = new MediaRecorder(stream);
  const chunks: Blob[] = [];
  mediaRecorder.ondataavailable = (event) => {
    if (event.data.size > 0) chunks.push(event.data);
  };
  mediaRecorder.start();

  return {
    stream,
    stop: () =>
      new Promise<Blob>((resolve) => {
        mediaRecorder.onstop = () => {
          for (const track of stream.getTracks()) track.stop();
          resolve(new Blob(chunks, { type: mediaRecorder.mimeType || 'audio/webm' }));
        };
        mediaRecorder.stop();
      }),
  };
}

export interface MicButtonProps {
  /** Turns captured audio into text — typically a VoiceProviderAdapter's transcribe(). */
  transcribe: (audio: Blob) => Promise<string>;
  onTranscript: (text: string) => void;
  /**
   * Called on mic denial, capture failure, empty audio, or a transcription
   * error. The candidate always has the text input in QuestionCard as a
   * fallback — this button never needs to render its own.
   */
  onError?: (error: Error) => void;
  disabled?: boolean;
  label?: string;
  /** Injectable for testing; defaults to a real getUserMedia/MediaRecorder implementation. */
  createRecorder?: () => Promise<AudioRecorder>;
  /** Notified whenever recording starts/stops — informational only, not fired for the initial mount. */
  onRecordingChange?: (isRecording: boolean) => void;
  /** Promotes this control to the primary, inviting call-to-action (e.g. once it's the candidate's turn). Defaults to false — zero visual change for existing callers. */
  emphasized?: boolean;
  /** Live input-amplitude meter while recording, sourced from the same capture stream already feeding MediaRecorder. Defaults to true; renders nothing when no stream is available. */
  showLevelMeter?: boolean;
  /** Notified with the live amplitude data whenever it changes — lets a caller drive its own separate meter display (e.g. a self-view tile) instead of this button's own inline one. Informational only. */
  onLevelsChange?: (levels: number[], isSupported: boolean) => void;
}

export function MicButton({
  transcribe,
  onTranscript,
  onError,
  disabled = false,
  label = 'Record answer',
  createRecorder = createBrowserAudioRecorder,
  onRecordingChange,
  emphasized = false,
  showLevelMeter = true,
  onLevelsChange,
}: MicButtonProps) {
  const [isRecording, setIsRecording] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  // The stream is also mirrored into state (not read from the ref during
  // render) since the level-meter hook below needs a reactive value.
  const [activeStream, setActiveStream] = useState<MediaStream | null>(null);
  const recorderRef = useRef<AudioRecorder | null>(null);
  const isFirstRender = useRef(true);

  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }
    onRecordingChange?.(isRecording);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- notify on isRecording transitions only, skipping the initial mount
  }, [isRecording]);

  const { levels, isSupported } = useMicLevelMeter(activeStream, isRecording);

  useEffect(() => {
    onLevelsChange?.(levels, isSupported);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- report on data changes only; onLevelsChange is expected to be stable per session
  }, [levels, isSupported]);

  const stopAndTranscribe = useCallback(async () => {
    const recorder = recorderRef.current;
    recorderRef.current = null;
    setIsRecording(false);
    setActiveStream(null);
    if (!recorder) return;

    setIsTranscribing(true);
    try {
      const audio = await recorder.stop();
      if (audio.size === 0) {
        throw new Error(
          'No audio was captured. Check your microphone and try again, or type your answer.',
        );
      }
      const text = await transcribe(audio);
      onTranscript(text);
    } catch (error) {
      onError?.(error instanceof Error ? error : new Error(String(error)));
    } finally {
      setIsTranscribing(false);
    }
  }, [onError, onTranscript, transcribe]);

  const startRecording = useCallback(async () => {
    try {
      const recorder = await createRecorder();
      recorderRef.current = recorder;
      setActiveStream(recorder.stream ?? null);
      setIsRecording(true);
    } catch (error) {
      onError?.(
        error instanceof Error
          ? error
          : new Error('Microphone access was denied or is unavailable.'),
      );
    }
  }, [createRecorder, onError]);

  const handleClick = useCallback(() => {
    if (isRecording) {
      void stopAndTranscribe();
    } else {
      void startRecording();
    }
  }, [isRecording, startRecording, stopAndTranscribe]);

  const buttonClass = emphasized ? 'isdk-btn isdk-btn--mic isdk-btn--mic-invite' : 'isdk-btn isdk-btn--mic';

  return (
    <span className="isdk-mic">
      <button
        className={buttonClass}
        type="button"
        onClick={handleClick}
        disabled={disabled || isTranscribing}
        aria-pressed={isRecording}
        aria-label={isRecording ? 'Stop recording' : label}
      >
        {isRecording ? (
          <svg className="isdk-btn__icon" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <rect x="7" y="7" width="10" height="10" rx="2" fill="currentColor" />
          </svg>
        ) : (
          <svg className="isdk-btn__icon" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <rect x="9" y="3" width="6" height="11" rx="3" fill="currentColor" />
            <path
              d="M5 11a7 7 0 0 0 14 0M12 18v3"
              stroke="currentColor"
              strokeWidth="1.6"
              strokeLinecap="round"
            />
          </svg>
        )}
        <span className="isdk-btn__label">
          {isTranscribing ? 'Transcribing…' : isRecording ? 'Stop recording' : label}
        </span>
      </button>
      {showLevelMeter && isRecording && (
        <AudioLevelMeter levels={levels} variant="listening" isIdle={!isSupported} />
      )}
    </span>
  );
}
