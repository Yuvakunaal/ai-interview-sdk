import type { EvaluationResult } from './types.js';

export interface InterviewEventMap {
  sessionStart: { sessionId: string };
  sessionPause: { sessionId: string };
  sessionResume: { sessionId: string };
  // No totalScore here — the flow engine only ever sees CandidateAnswer,
  // never an EvaluationResult, so it structurally cannot compute a real
  // score. Get the real total from useInterview's onSessionEnd callback
  // (InterviewReport.totalScore) or by aggregating your own scoreComputed
  // listeners — never from this event.
  sessionEnd: { sessionId: string };
  sessionExpired: { sessionId: string };
  questionAdvance: { sessionId: string; questionId: string; index: number };
  followUpGenerated: { sessionId: string; questionId: string; prompt: string; depth: number };
  scoreComputed: { sessionId: string; questionId: string; result: EvaluationResult };
}

export type InterviewEventName = keyof InterviewEventMap;

type Handler<K extends InterviewEventName> = (payload: InterviewEventMap[K]) => void;

export class InterviewEventEmitter {
  // Stored untyped internally because TS can't verify a generic `K` against
  // a mapped type's indexed Set member; the typed `on`/`off`/`emit` methods
  // below are the real type-safety boundary for consumers.
  private readonly listeners = new Map<InterviewEventName, Set<Handler<InterviewEventName>>>();

  on<K extends InterviewEventName>(event: K, handler: Handler<K>): () => void {
    let set = this.listeners.get(event);
    if (!set) {
      set = new Set();
      this.listeners.set(event, set);
    }
    set.add(handler as Handler<InterviewEventName>);
    return () => set.delete(handler as Handler<InterviewEventName>);
  }

  off<K extends InterviewEventName>(event: K, handler: Handler<K>): void {
    this.listeners.get(event)?.delete(handler as Handler<InterviewEventName>);
  }

  emit<K extends InterviewEventName>(event: K, payload: InterviewEventMap[K]): void {
    const set = this.listeners.get(event);
    if (!set) return;
    for (const handler of set) {
      handler(payload);
    }
  }
}
