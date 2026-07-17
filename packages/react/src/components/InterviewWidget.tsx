import type {
  AIProviderAdapter,
  Question,
  RubricDimensionInput,
  SynthesisResult,
} from '@interview-sdk/core';
import { defineRubric } from '@interview-sdk/core';
import { useEffect, useMemo, useState, type CSSProperties } from 'react';
import { useInterview, type InterviewSnapshot, type UseInterviewResult } from '../hooks/useInterview.js';
import type { InterviewReport } from '../hooks/build-report.js';
import { useIntegritySignals } from '../hooks/use-integrity-signals.js';
import { ClientModeProcessor } from '../processor/client-mode-processor.js';
import { ServerModeProcessor } from '../processor/server-mode-processor.js';
import { InterviewErrorBoundary } from './InterviewErrorBoundary.js';
import { InterviewLobby } from './InterviewLobby.js';
import { InterviewProgress } from './InterviewProgress.js';
import { LiveSignals } from './LiveSignals.js';
import { QuestionCard } from './QuestionCard.js';
import { ReportCard } from './ReportCard.js';
import { TranscriptChat } from './TranscriptChat.js';

/**
 * Best-effort only — a full disk, private-browsing storage lockout, or
 * disabled localStorage must never break the interview itself, so every
 * failure here is swallowed and treated as "nothing to resume from."
 */
function readPersistedSnapshot(key: string | undefined): InterviewSnapshot | undefined {
  if (!key || typeof window === 'undefined') return undefined;
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return undefined;
    return JSON.parse(raw) as InterviewSnapshot;
  } catch {
    return undefined;
  }
}

function writePersistedSnapshot(key: string, snapshot: InterviewSnapshot): void {
  try {
    window.localStorage.setItem(key, JSON.stringify(snapshot));
  } catch {
    // Best-effort — see readPersistedSnapshot above.
  }
}

function clearPersistedSnapshot(key: string): void {
  try {
    window.localStorage.removeItem(key);
  } catch {
    // Best-effort — see readPersistedSnapshot above.
  }
}

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
  /**
   * Requests a live mic stream for the pre-join lobby's mic check — purely a
   * preview, never a recording. Defaults to a real getUserMedia call.
   * Injectable for testing.
   */
  requestMicStream?: () => Promise<MediaStream>;
  /** Overrides the lobby's primary action text. Defaults to 'Start interview'. */
  joinLabel?: string;
  /** Optional session context shown in the header (e.g. "Senior Software Engineer — Round 2"). */
  roleTitle?: string;
  /** The candidate's own display name, shown on their tile. Defaults to "You". */
  candidateName?: string;
  /**
   * Called when the final report's PDF or CSV export fails and falls back
   * to a JSON download (e.g. the optional `jspdf` peer dependency isn't
   * installed) — the report itself already shows a visible notice when
   * this happens; use this to also log it or notify your own backend.
   */
  onExportError?: (error: Error, format: 'pdf' | 'csv') => void;
  /**
   * When set, automatically saves the session to localStorage under this
   * key after every state change, and resumes from it on mount — a page
   * refresh or accidental tab close picks back up on the same question with
   * the same transcript, no manual getSnapshot()/initialSnapshot wiring
   * needed. Cleared automatically once the interview completes or expires.
   * Omit for a fresh session on every mount (the previous default, still
   * fully supported). Use a key that's unique per candidate+interview (e.g.
   * including a session or candidate id) — otherwise two different
   * candidates on the same browser profile would resume each other's answers.
   */
  persistKey?: string;
  /**
   * Tracks two low-risk, non-biometric integrity signals while the
   * interview is active — how many times the tab lost focus, and how many
   * times the candidate pasted into an answer — and attaches them to the
   * final report as `integritySignals`. Off by default; if you turn this
   * on, disclose it to candidates (most platforms that track tab-switching
   * say so up front). These are signals for a human reviewer to weigh in
   * context, never an automated cheating verdict.
   */
  trackIntegritySignals?: boolean;
  /** Extra class name(s) added to the root element, alongside `isdk-widget`. */
  className?: string;
  /**
   * Inline styles on the root element — the escape hatch for hosts whose
   * ancestor chain doesn't carry a definite height all the way down (e.g.
   * `style={{ height: '100dvh' }}`), since the widget's own CSS fills 100%
   * of its container but can't invent a height no ancestor provides.
   */
  style?: CSSProperties;
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

function formatElapsed(ms: number): string {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
}

/**
 * mode/adapter are a one-time setup choice in real apps (typically a
 * memoized value, never re-derived per keystroke), so throwing loudly and
 * immediately here — outside InterviewErrorBoundary — fits: it's exactly
 * the kind of developer mistake that should be impossible to miss.
 *
 * Rubric/question validation is deliberately NOT duplicated here. Unlike
 * mode/adapter, questions and rubric are exactly the props a host app is
 * likely to edit live (a question builder, a dashboard) — a momentarily
 * blank prompt while someone retypes it is normal, not a bug, and must
 * never take the whole host page down with it. useInterview below already
 * validates this config as the single source of truth for both this
 * component and any headless consumer of that hook; here, that throw
 * happens inside the boundary, so a real invalid config still fails
 * clearly and immediately (the boundary's fallback renders the message),
 * it just can't escape and unmount an app embedding this widget.
 */
export function InterviewWidget(props: InterviewWidgetProps) {
  assertClientModeAllowed(props.mode, props.allowClientModeInProduction);

  if (props.mode === 'client' && !props.adapter) {
    throw new Error(
      'InterviewWidget: mode="client" requires an `adapter` prop (an @interview-sdk/adapter-* instance).',
    );
  }

  const shellClassName = ['isdk-widget', props.className].filter(Boolean).join(' ');
  // Lets the boundary auto-recover once the config it choked on actually
  // changes (the next keystroke fixing that blank prompt) instead of
  // staying stuck on its fallback until something manually resets it. This
  // computation runs here, outside the boundary, so it must never throw
  // itself — a circular reference in caller-supplied questions/rubric (a
  // plausible authoring mistake) would otherwise crash synchronously before
  // the boundary ever gets a chance to render its fallback. Auto-recovery
  // simply won't fire for such a pathological config; the widget still
  // renders instead of crashing, which is what actually matters here.
  let resetKey: string;
  try {
    resetKey = JSON.stringify({
      questions: props.questions,
      rubric: props.rubric,
      maxFollowUpDepth: props.maxFollowUpDepth,
      sessionTimeoutMs: props.sessionTimeoutMs,
    });
  } catch {
    resetKey = 'unserializable-config';
  }
  return (
    <InterviewErrorBoundary shellClassName={shellClassName} resetKey={resetKey}>
      <InterviewWidgetInner {...props} />
    </InterviewErrorBoundary>
  );
}

function InterviewWidgetInner({
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
  requestMicStream,
  joinLabel,
  roleTitle,
  candidateName,
  onExportError,
  persistKey,
  trackIntegritySignals = false,
  className,
  style,
}: InterviewWidgetProps) {
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
  // Mirrors QuestionCard's own recording state up here, purely so the
  // header's REC badge reflects genuinely-live recording — never a
  // constant, faked "always recording" claim.
  const [isRecording, setIsRecording] = useState(false);

  // Read exactly once, on mount — matching initialSnapshot's own contract in
  // useInterview. persistKey changing on an already-mounted widget does not
  // re-trigger a resume; that's a config change, not a runtime event.
  const [initialSnapshot] = useState(() => readPersistedSnapshot(persistKey));

  const integrity = useIntegritySignals(trackIntegritySignals);

  const interview: UseInterviewResult = useInterview({
    questions,
    rubric,
    processor,
    maxFollowUpDepth,
    sessionTimeoutMs,
    onSessionEnd,
    ...(initialSnapshot ? { initialSnapshot } : {}),
    ...(trackIntegritySignals ? { getIntegritySignals: integrity.getSnapshot } : {}),
  });

  useEffect(() => {
    integrity.setActive(interview.status === 'in_progress');
  }, [interview.status, integrity]);

  const { status: interviewStatus, transcript: interviewTranscript, getSnapshot } = interview;
  useEffect(() => {
    if (!persistKey) return;
    if (interviewStatus === 'not_started') return;
    if (interviewStatus === 'completed' || interviewStatus === 'expired') {
      clearPersistedSnapshot(persistKey);
      return;
    }
    writePersistedSnapshot(persistKey, getSnapshot());
  }, [persistKey, interviewStatus, interviewTranscript, getSnapshot]);

  // Computed after useInterview so its config validation (which collects
  // every issue into one clear error) is what a bad rubric surfaces as,
  // rather than defineRubric's own narrower first-issue-only error.
  const normalizedRubric = useMemo(() => defineRubric(rubric), [rubric]);

  // A live elapsed-time display, ticking only while the session is actually
  // running — sourced from the flow engine's real startedAt timestamp
  // (exposed by useInterview), not reinvented as separate session logic.
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (interview.status !== 'in_progress') return;
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, [interview.status]);
  const elapsedLabel = interview.startedAt
    ? formatElapsed(now - interview.startedAt)
    : undefined;
  const elapsedFraction =
    interview.startedAt && sessionTimeoutMs
      ? Math.min(1, Math.max(0, (now - interview.startedAt) / sessionTimeoutMs))
      : undefined;

  const shellClassName = ['isdk-widget', className].filter(Boolean).join(' ');

  if (interview.status === 'completed' && interview.report) {
    return (
      <div className={`${shellClassName} isdk-widget--center`} style={style}>
        <div className="isdk-widget__hero">
          <ReportCard
            report={interview.report}
            rubric={normalizedRubric}
            {...(onExportError ? { onExportError } : {})}
          />
        </div>
      </div>
    );
  }

  if (interview.status === 'expired') {
    return (
      <div className={`${shellClassName} isdk-widget--center`} style={style}>
        <div className="isdk-widget__hero">
          <div className="isdk-lobby">
            <p className="isdk-kicker">Session expired</p>
            <h2 className="isdk-lobby__title">This interview session has timed out</h2>
            <p className="isdk-lobby__meta">
              {interview.error?.message ??
                'The time limit for this session was reached, so it can no longer be resumed.'}
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (interview.status === 'not_started') {
    return (
      <div className={`${shellClassName} isdk-widget--center`} style={style}>
        <div className="isdk-widget__hero">
          <InterviewLobby
            onJoin={interview.start}
            voiceEnabled={Boolean(transcribe)}
            totalQuestions={questions.length}
            {...(requestMicStream ? { requestMicStream } : {})}
            {...(joinLabel ? { joinLabel } : {})}
          />
        </div>
      </div>
    );
  }

  return (
    <div className={shellClassName} style={style}>
      <header className="isdk-widget__header">
        {roleTitle ? <p className="isdk-widget__role-title">{roleTitle}</p> : <span aria-hidden="true" />}
        <div className="isdk-widget__header-actions">
          {isRecording && <span className="isdk-widget__rec-badge">● REC</span>}
          <button
            className="isdk-btn isdk-btn--secondary isdk-widget__end"
            type="button"
            onClick={() => interview.endInterview()}
          >
            End Interview
          </button>
        </div>
      </header>

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
        <div className="isdk-widget__paused">
          <div className="isdk-widget__hero">
            <div className="isdk-lobby">
              <p className="isdk-kicker">Paused</p>
              <h2 className="isdk-lobby__title">Taking a break?</h2>
              <p className="isdk-lobby__meta">Your progress is saved. Resume when you&rsquo;re ready.</p>
              <div className="isdk-lobby__actions">
                <button
                  className="isdk-btn isdk-btn--primary"
                  type="button"
                  onClick={interview.resume}
                >
                  Resume
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : (
        interview.currentQuestion && (
          <div className="isdk-widget__body">
            <div className="isdk-widget__stage-wrap">
              <QuestionCard
                prompt={interview.currentPrompt ?? interview.currentQuestion.prompt}
                questionNumber={
                  questions.findIndex((q) => q.id === interview.currentQuestion!.id) + 1
                }
                totalQuestions={questions.length}
                isFollowUp={interview.isFollowUpPrompt}
                topic={interview.currentQuestion.concepts?.[0]}
                {...(candidateName ? { candidateName } : {})}
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
                onRecordingChange={setIsRecording}
                elapsedLabel={elapsedLabel}
                elapsedFraction={elapsedFraction}
                onPause={interview.pause}
                pauseDisabled={interview.status !== 'in_progress'}
                {...(trackIntegritySignals ? { onAnswerPaste: integrity.recordPaste } : {})}
              />
            </div>

            <aside className="isdk-widget__sidebar" aria-label="Interview progress and transcript">
              <InterviewProgress
                questions={questions}
                currentQuestion={interview.currentQuestion}
                transcript={interview.transcript}
              />
              <TranscriptChat
                transcript={interview.transcript}
                {...(candidateName ? { candidateName } : {})}
              />
              <LiveSignals rubric={normalizedRubric} transcript={interview.transcript} />
            </aside>
          </div>
        )
      )}
    </div>
  );
}
