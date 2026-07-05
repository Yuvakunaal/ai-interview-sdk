import type {
  AIProviderAdapter,
  Question,
  RubricDimensionInput,
  SynthesisResult,
} from '@interview-sdk/core';
import { defineRubric, validateInterviewConfig } from '@interview-sdk/core';
import { useMemo, useState } from 'react';
import { useInterview, type UseInterviewResult } from '../hooks/useInterview.js';
import type { InterviewReport } from '../hooks/build-report.js';
import { ClientModeProcessor } from '../processor/client-mode-processor.js';
import { ServerModeProcessor } from '../processor/server-mode-processor.js';
import { QuestionCard } from './QuestionCard.js';
import { ReportCard } from './ReportCard.js';
import { TranscriptViewer } from './TranscriptViewer.js';

export type InterviewMode = 'client' | 'server';

export interface InterviewWidgetProps {
  questions: Question[];
  rubric: RubricDimensionInput[];
  mode: InterviewMode;
  /** Required in Client Mode: the AI provider adapter that runs directly in the browser. Prototyping only. */
  adapter?: AIProviderAdapter;
  /** Server Mode: URL of the developer's own answer-processing endpoint. Defaults to /api/interview/answer. */
  apiBaseUrl?: string;
  /** Server Mode: extra headers (e.g. an auth token) sent with every request. */
  serverHeaders?: Record<string, string>;
  maxFollowUpDepth?: number;
  sessionTimeoutMs?: number;
  onSessionEnd?: (report: InterviewReport) => void;
  /** Enables the mic button; omit for text-only mode (the accessible default). */
  transcribe?: (audio: Blob) => Promise<string>;
  /** Speaks each question/follow-up aloud; omit for a silent, text-only prompt (the accessible default). */
  synthesize?: (text: string) => Promise<SynthesisResult>;
  onVoiceError?: (error: Error) => void;
  /**
   * Client Mode exposes AI keys in the browser and lets scores be computed
   * client-side — it refuses to run under NODE_ENV=production unless this
   * is explicitly set. Use Server Mode for production instead.
   */
  allowClientModeInProduction?: boolean;
}

function assertClientModeAllowed(
  mode: InterviewMode,
  allowInProduction: boolean | undefined,
): void {
  if (mode !== 'client') return;
  const isProduction = typeof process !== 'undefined' && process.env?.NODE_ENV === 'production';
  if (isProduction && !allowInProduction) {
    throw new Error(
      'InterviewWidget: Client Mode is prototyping-only and refuses to run with ' +
        'NODE_ENV=production, because it exposes AI provider keys in the browser and ' +
        'lets scores be computed (and tampered with) client-side. Use mode="server" ' +
        'with @interview-sdk/server for production, or pass allowClientModeInProduction ' +
        'if you have deliberately accepted that risk.',
    );
  }
}

function buildHint(question: Question): string | undefined {
  if (!question.concepts || question.concepts.length === 0) return undefined;
  return `Consider covering: ${question.concepts.join(', ')}.`;
}

export function InterviewWidget({
  questions,
  rubric,
  mode,
  adapter,
  apiBaseUrl,
  serverHeaders,
  maxFollowUpDepth,
  sessionTimeoutMs,
  onSessionEnd,
  transcribe,
  synthesize,
  onVoiceError,
  allowClientModeInProduction,
}: InterviewWidgetProps) {
  assertClientModeAllowed(mode, allowClientModeInProduction);

  validateInterviewConfig({ questions, rubric, maxFollowUpDepth, sessionTimeoutMs });

  if (mode === 'client' && !adapter) {
    throw new Error(
      'InterviewWidget: mode="client" requires an `adapter` prop (an @interview-sdk/adapter-* instance).',
    );
  }

  const normalizedRubric = useMemo(() => defineRubric(rubric), [rubric]);

  const processor = useMemo(
    () =>
      mode === 'client'
        ? new ClientModeProcessor(adapter!, { maxDepth: maxFollowUpDepth })
        : new ServerModeProcessor({ endpoint: apiBaseUrl, headers: serverHeaders }),
    // Constructed once for the widget's lifetime — mode/adapter/endpoint are
    // not expected to change on an already-mounted interview.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  // Tracks which prompt the hint was requested for, rather than a plain
  // boolean, so the hint doesn't keep showing once the prompt moves on
  // (new question or new follow-up) without another explicit request.
  const [hintRequestedForPrompt, setHintRequestedForPrompt] = useState<string | undefined>(
    undefined,
  );

  const interview: UseInterviewResult = useInterview({
    questions,
    rubric,
    processor,
    maxFollowUpDepth,
    sessionTimeoutMs,
    onSessionEnd,
  });

  if (interview.status === 'completed' && interview.report) {
    return <ReportCard report={interview.report} rubric={normalizedRubric} />;
  }

  if (interview.status === 'not_started') {
    return (
      <div className="isdk-widget isdk-widget--start">
        <button className="isdk-btn isdk-btn--primary" type="button" onClick={interview.start}>
          Start interview
        </button>
      </div>
    );
  }

  return (
    <div className="isdk-widget">
      {interview.error && (
        <div className="isdk-widget__error" role="alert">
          <p>{interview.error.message}</p>
          <button
            className="isdk-btn isdk-btn--secondary"
            type="button"
            onClick={() => void interview.retryLastAnswer()}
          >
            Retry
          </button>
        </div>
      )}

      {interview.status === 'paused' ? (
        <button className="isdk-btn isdk-btn--primary" type="button" onClick={interview.resume}>
          Resume
        </button>
      ) : (
        interview.currentQuestion && (
          <QuestionCard
            prompt={interview.currentPrompt ?? interview.currentQuestion.prompt}
            questionNumber={questions.findIndex((q) => q.id === interview.currentQuestion!.id) + 1}
            totalQuestions={questions.length}
            isFollowUp={interview.isFollowUpPrompt}
            isSubmitting={interview.isProcessing}
            onSubmit={(text) => void interview.submitAnswer(text)}
            onSkip={() => void interview.submitAnswer('', { isSkipped: true })}
            onRequestHint={() => setHintRequestedForPrompt(interview.currentPrompt)}
            hint={
              hintRequestedForPrompt === interview.currentPrompt
                ? buildHint(interview.currentQuestion)
                : undefined
            }
            transcribe={transcribe}
            synthesize={synthesize}
            onVoiceError={onVoiceError}
          />
        )
      )}

      <button
        className="isdk-btn isdk-btn--secondary isdk-widget__pause"
        type="button"
        onClick={interview.pause}
        disabled={interview.status !== 'in_progress'}
      >
        Pause
      </button>

      <TranscriptViewer transcript={interview.transcript} />
    </div>
  );
}
