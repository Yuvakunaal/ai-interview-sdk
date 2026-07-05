import { useCallback, useRef, useState } from 'react';

export interface AudioRecorder {
  stop: () => Promise<Blob>;
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
}

export function MicButton({
  transcribe,
  onTranscript,
  onError,
  disabled = false,
  label = 'Record answer',
  createRecorder = createBrowserAudioRecorder,
}: MicButtonProps) {
  const [isRecording, setIsRecording] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const recorderRef = useRef<AudioRecorder | null>(null);

  const stopAndTranscribe = useCallback(async () => {
    const recorder = recorderRef.current;
    recorderRef.current = null;
    setIsRecording(false);
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
      recorderRef.current = await createRecorder();
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

  return (
    <button
      className="isdk-btn isdk-btn--mic"
      type="button"
      onClick={handleClick}
      disabled={disabled || isTranscribing}
      aria-pressed={isRecording}
      aria-label={isRecording ? 'Stop recording' : label}
    >
      {isTranscribing ? 'Transcribing…' : isRecording ? 'Stop recording' : label}
    </button>
  );
}
