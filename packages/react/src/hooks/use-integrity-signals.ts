import { useCallback, useEffect, useMemo, useRef } from 'react';
import type { IntegritySignals } from './build-report.js';

export interface UseIntegritySignalsResult {
  /** Call whenever the interview's own active/inactive state changes (e.g. in_progress vs. paused/not_started) — tab switches and pastes are only counted while active. */
  setActive: (active: boolean) => void;
  /** Call from your answer input's onPaste with the pasted text's length. */
  recordPaste: (pastedLength: number) => void;
  /** A point-in-time copy of everything recorded so far — safe to call repeatedly (e.g. when building a report). */
  getSnapshot: () => IntegritySignals;
}

/**
 * Tracks two low-risk, non-biometric integrity signals: how many times the
 * candidate's tab lost visibility, and how many times they pasted into an
 * answer. `enabled` gates whether the underlying `visibilitychange` listener
 * is attached at all — pass the developer's own opt-in flag (e.g.
 * InterviewWidget's `trackIntegritySignals` prop), not a constant true, so a
 * candidate isn't tracked unless the integrating developer explicitly chose
 * to.
 */
export function useIntegritySignals(enabled: boolean): UseIntegritySignalsResult {
  const activeRef = useRef(false);
  const tabSwitchCountRef = useRef(0);
  const tabSwitchTimestampsRef = useRef<number[]>([]);
  const pasteEventsRef = useRef<Array<{ length: number; timestamp: number }>>([]);

  useEffect(() => {
    if (!enabled || typeof document === 'undefined') return;
    const handleVisibilityChange = () => {
      if (!activeRef.current || !document.hidden) return;
      tabSwitchCountRef.current += 1;
      tabSwitchTimestampsRef.current = [...tabSwitchTimestampsRef.current, Date.now()];
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, [enabled]);

  const setActive = useCallback((active: boolean) => {
    activeRef.current = active;
  }, []);

  const recordPaste = useCallback((pastedLength: number) => {
    if (!activeRef.current) return;
    pasteEventsRef.current = [
      ...pasteEventsRef.current,
      { length: pastedLength, timestamp: Date.now() },
    ];
  }, []);

  const getSnapshot = useCallback(
    (): IntegritySignals => ({
      tabSwitchCount: tabSwitchCountRef.current,
      tabSwitchTimestamps: tabSwitchTimestampsRef.current,
      pasteEvents: pasteEventsRef.current,
    }),
    [],
  );

  return useMemo(
    () => ({ setActive, recordPaste, getSnapshot }),
    [setActive, recordPaste, getSnapshot],
  );
}
