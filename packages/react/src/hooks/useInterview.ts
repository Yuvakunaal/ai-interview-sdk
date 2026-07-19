import {
  InterviewFlowEngine,
  defineRubric,
  validateInterviewConfig,
  type EvaluationTurn,
  type InterviewEventEmitter,
  type Question,
  type RubricDimensionInput,
  type SessionState,
} from '@interview-sdk/core';
import { useCallback, useMemo, useRef, useState } from 'react';
import {
  buildReport,
  type IntegritySignals,
  type InterviewReport,
  type TranscriptEntry,
} from './build-report.js';
import type { InterviewProcessor } from '../processor/types.js';

export interface UseInterviewOptions {
  questions: Question[];
  rubric: RubricDimensionInput[];
  processor: InterviewProcessor;
  maxFollowUpDepth?: number;
  sessionTimeoutMs?: number;
  onSessionEnd?: (report: InterviewReport) => void;
  /** Resume a session from a snapshot returned by this same hook's getSnapshot() — e.g. one restored after a page refresh or loaded back from your own backend. Only read once, on mount. */
  initialSnapshot?: InterviewSnapshot;
  /** Read once whenever a report is built (on completion or voluntary end) and attached to it as `integritySignals` — e.g. from useIntegritySignals() in @interview-sdk/react. Omit if you don't track this. */
  getIntegritySignals?: () => IntegritySignals;
}

export interface SubmitAnswerOptions {
  isSkipped?: boolean;
  isSilence?: boolean;
}

/** Everything needed to resume this exact session elsewhere — persist it (localStorage, your own backend) and pass it back as `initialSnapshot` to pick up where it left off after a refresh or disconnect. */
export interface InterviewSnapshot {
  flowState: SessionState;
  transcript: TranscriptEntry[];
}

export interface UseInterviewResult {
  status: SessionState['status'];
  /** Wall-clock time the session actually started, for a live elapsed-time display. Undefined until start() is called. */
  startedAt: number | undefined;
  currentQuestion: Question | undefined;
  currentPrompt: string | undefined;
  isFollowUpPrompt: boolean;
  transcript: TranscriptEntry[];
  isProcessing: boolean;
  error: Error | undefined;
  report: InterviewReport | undefined;
  start: () => void;
  pause: () => void;
  resume: () => void;
  /** Voluntarily ends the session before every question has been answered, building a report from whatever's been answered so far. */
  endInterview: () => void;
  submitAnswer: (text: string, opts?: SubmitAnswerOptions) => Promise<void>;
  retryLastAnswer: () => Promise<void>;
  /** A serializable snapshot of the whole session right now — see InterviewSnapshot. */
  getSnapshot: () => InterviewSnapshot;
  /** The underlying typed event emitter (sessionStart/sessionPause/sessionResume/sessionEnd/sessionExpired/questionAdvance/followUpGenerated/scoreComputed) — subscribe for your own analytics or logging, independent of the UI. */
  events: InterviewEventEmitter;
}

interface PendingProcessAnswer {
  question: Question;
  answer: TranscriptEntry['answer'];
  previousTurns: EvaluationTurn[];
  currentFollowUpDepth: number;
  askedFollowUps: string[];
}

export function useInterview(options: UseInterviewOptions): UseInterviewResult {
  // Same guarantee <InterviewWidget> gives you — fails loud on empty
  // questions, invalid rubric weights, duplicate ids, etc. — so headless
  // consumers of this hook aren't left to discover a bad config from a
  // more confusing downstream failure instead.
  validateInterviewConfig({
    questions: options.questions,
    rubric: options.rubric,
    maxFollowUpDepth: options.maxFollowUpDepth,
    sessionTimeoutMs: options.sessionTimeoutMs,
  });

  const rubric = useMemo(() => defineRubric(options.rubric), [options.rubric]);

  const [flow] = useState(() => {
    const config = {
      questions: options.questions,
      maxFollowUpDepth: options.maxFollowUpDepth,
      sessionTimeoutMs: options.sessionTimeoutMs,
    };
    return options.initialSnapshot
      ? InterviewFlowEngine.fromState(options.initialSnapshot.flowState, config)
      : new InterviewFlowEngine(config);
  });

  const [flowState, setFlowState] = useState<SessionState>(() =>
    // A snapshot resumed after a real gap (page refresh, closed tab) may
    // already be past sessionTimeoutMs — refreshExpiry() (rather than
    // getState()) makes sure that shows up immediately as 'expired' instead
    // of misleadingly rendering the question UI until the next submit throws.
    options.initialSnapshot ? flow.refreshExpiry() : flow.getState(),
  );
  const [transcript, setTranscript] = useState<TranscriptEntry[]>(
    () => options.initialSnapshot?.transcript ?? [],
  );
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<Error | undefined>(undefined);
  const [report, setReport] = useState<InterviewReport | undefined>(undefined);
  const pendingRef = useRef<PendingProcessAnswer | undefined>(undefined);
  // If the candidate pauses while an answer is mid-flight being scored, the
  // AI call can't be cancelled — but applying its result's flow transition
  // (advance/recordFollowUp) the instant it resolves would silently move
  // the session forward behind a screen that still says "Paused". This
  // stashes that transition to apply exactly once the candidate resumes,
  // instead of either losing the real score or applying it invisibly.
  const deferredTransitionRef = useRef<(() => void) | undefined>(undefined);

  const currentQuestion = options.questions[flowState.currentQuestionIndex];
  const askedFollowUps = currentQuestion
    ? (flowState.followUpPromptsAsked[currentQuestion.id] ?? [])
    : [];
  const currentPrompt = askedFollowUps.at(-1) ?? currentQuestion?.prompt;
  const isFollowUpPrompt = askedFollowUps.length > 0;

  const start = useCallback(() => {
    setFlowState(flow.start());
  }, [flow]);

  const pause = useCallback(() => {
    setFlowState(flow.pause());
  }, [flow]);

  const resume = useCallback(() => {
    // flow.resume() deliberately throws SessionExpiredError once the
    // timeout has elapsed while paused — a real, expected outcome, not a
    // bug in the engine. It must be caught here: this runs synchronously
    // inside an onClick handler, and React error boundaries never catch
    // event-handler exceptions, so an unguarded throw would crash the
    // whole widget instead of surfacing a recoverable message.
    let nextState: SessionState;
    try {
      nextState = flow.resume();
    } catch (caught) {
      setFlowState(flow.getState());
      setError(caught instanceof Error ? caught : new Error(String(caught)));
      return;
    }
    setFlowState(nextState);
    if (nextState.status === 'in_progress' && deferredTransitionRef.current) {
      const applyDeferredTransition = deferredTransitionRef.current;
      deferredTransitionRef.current = undefined;
      applyDeferredTransition();
    }
  }, [flow]);

  const endInterview = useCallback(() => {
    const wasAlreadyDone =
      flow.getState().status === 'completed' || flow.getState().status === 'expired';
    const nextState = flow.end();
    setFlowState(nextState);
    if (!wasAlreadyDone && nextState.status === 'completed') {
      const finalReport = buildReport(
        nextState.sessionId,
        rubric,
        transcript,
        options.getIntegritySignals?.(),
      );
      setReport(finalReport);
      options.onSessionEnd?.(finalReport);
    }
  }, [flow, rubric, transcript, options]);

  const runProcessor = useCallback(
    async (pending: PendingProcessAnswer) => {
      setIsProcessing(true);
      setError(undefined);
      try {
        const result = await options.processor.processAnswer({
          question: pending.question,
          rubric,
          answer: pending.answer,
          previousTurns: pending.previousTurns,
          currentFollowUpDepth: pending.currentFollowUpDepth,
          askedFollowUps: pending.askedFollowUps,
        });

        const nextTranscript = [
          ...transcript,
          {
            question: pending.question,
            prompt: pending.askedFollowUps.at(-1) ?? pending.question.prompt,
            isFollowUp: pending.askedFollowUps.length > 0,
            answer: pending.answer,
            evaluation: result.evaluation,
          },
        ];
        setTranscript(nextTranscript);
        pendingRef.current = undefined;
        flow.events.emit('scoreComputed', {
          sessionId: flow.getState().sessionId,
          questionId: pending.question.id,
          result: result.evaluation,
        });

        const applyTransition = () => {
          if (result.followUp) {
            setFlowState(flow.recordFollowUp(result.followUp.prompt));
          } else {
            const nextState = flow.advance();
            setFlowState(nextState);
            if (nextState.status === 'completed') {
              const finalReport = buildReport(
                nextState.sessionId,
                rubric,
                nextTranscript,
                options.getIntegritySignals?.(),
              );
              setReport(finalReport);
              options.onSessionEnd?.(finalReport);
            }
          }
        };

        const statusWhenScoringLanded = flow.getState().status;
        if (statusWhenScoringLanded === 'paused') {
          deferredTransitionRef.current = applyTransition;
        } else if (statusWhenScoringLanded === 'in_progress') {
          applyTransition();
        }
        // Any other status (completed/expired) means the session was ended
        // by other means — endInterview(), or expiry — while this answer
        // was still being scored. The score itself is preserved above, but
        // applying a late advance()/recordFollowUp() on top of an
        // already-finished session would silently mutate it and could
        // fire onSessionEnd a second time with a different report.
      } catch (caught) {
        setError(caught instanceof Error ? caught : new Error(String(caught)));
      } finally {
        setIsProcessing(false);
      }
    },
    [flow, options, rubric, transcript],
  );

  const submitAnswer = useCallback(
    async (text: string, opts: SubmitAnswerOptions = {}) => {
      if (isProcessing) return;

      const beforeCount = flow.getState().answers.length;
      // flow.submitAnswer() throws SessionExpiredError/InterviewSdkError for
      // real, expected states (session expired mid-question, submitting
      // outside "in_progress"). Left unguarded, this rejects a promise
      // nobody awaits (onSubmit={(text) => void interview.submitAnswer(text)}),
      // producing a silent unhandled rejection instead of visible feedback.
      let nextState: SessionState;
      try {
        nextState = flow.submitAnswer({ text, ...opts });
      } catch (caught) {
        setFlowState(flow.getState());
        setError(caught instanceof Error ? caught : new Error(String(caught)));
        return;
      }
      setFlowState(nextState);

      if (nextState.answers.length === beforeCount) {
        // The flow engine treats this as the same turn already answered.
        // If the last processing attempt for it failed, retry rather than
        // silently no-op'ing — a caller may reasonably call submitAnswer
        // again instead of retryLastAnswer().
        if (pendingRef.current) {
          await runProcessor(pendingRef.current);
        }
        return;
      }

      const question = options.questions[nextState.currentQuestionIndex];
      if (!question) return;

      // Only this question's own prior turns (i.e. earlier follow-ups on the
      // same question) belong here — every unrelated question answered
      // earlier in the interview was previously included too, which grew
      // unbounded over a long interview and, worse, actively confused
      // evaluation: by question 5 or so the model was handed several
      // unrelated (sometimes duplicate-text) prior answers in the same
      // request despite the system prompt telling it to ignore them, and
      // real testing showed that noise was enough to make it misjudge a
      // perfectly good final answer. A brand-new top-level question
      // correctly gets an empty array here — there's no earlier turn to
      // provide context from yet.
      const previousTurns: EvaluationTurn[] = transcript
        .filter((entry) => entry.question.id === question.id)
        .map((entry) => ({
          question: entry.question,
          answer: entry.answer,
        }));

      const pending: PendingProcessAnswer = {
        question,
        answer: nextState.answers.at(-1)!,
        previousTurns,
        currentFollowUpDepth: nextState.followUpDepthForCurrentQuestion,
        askedFollowUps: nextState.followUpPromptsAsked[question.id] ?? [],
      };
      pendingRef.current = pending;

      await runProcessor(pending);
    },
    [flow, isProcessing, options.questions, runProcessor, transcript],
  );

  const retryLastAnswer = useCallback(async () => {
    if (isProcessing || !pendingRef.current) return;
    await runProcessor(pendingRef.current);
  }, [isProcessing, runProcessor]);

  const getSnapshot = useCallback(
    (): InterviewSnapshot => ({ flowState: flow.getState(), transcript }),
    [flow, transcript],
  );

  return {
    status: flowState.status,
    startedAt: flowState.startedAt,
    currentQuestion,
    currentPrompt,
    isFollowUpPrompt,
    transcript,
    isProcessing,
    error,
    report,
    start,
    pause,
    resume,
    endInterview,
    submitAnswer,
    retryLastAnswer,
    getSnapshot,
    events: flow.events,
  };
}
